import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { logEvent, AUDIT_EVENTS } from '../lib/audit'
import { getUserProfile } from '../lib/api'
import { isStaleSessionError } from '../lib/authErrors'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  // [MFA] aal1 = password only; aal2 = password + verified TOTP factor.
  // nextAal = 'aal2' when a verified factor exists but hasn't been satisfied this session.
  // ProtectedRoute enforces MFA only when nextAal === 'aal2' (user is enrolled).
  const [aal, setAal] = useState(null)
  const [nextAal, setNextAal] = useState(null)

  // [MFA] refreshAal — re-reads the server-side Authenticator Assurance Level after
  // every auth state change so ProtectedRoute always reflects the real AAL.
  // To look up AAL logic search for "refreshAal".
  const refreshAal = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (isStaleSessionError(error)) {
      await supabase.auth.signOut()
      return
    }
    setAal(data?.currentLevel ?? null)
    setNextAal(data?.nextLevel ?? null)
  }, [])

  const fetchRole = useCallback(async (userId) => {
    if (!userId) { setRole(null); return }
    const { data } = await getUserProfile(userId)
    setRole(data?.role ?? 'user')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s) { refreshAal(); fetchRole(s.user.id) }
      else { setAal(null); setNextAal(null); setRole(null) }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s) { refreshAal(); fetchRole(s.user.id) }
      else { setAal(null); setNextAal(null); setRole(null) }
    })

    return () => subscription.unsubscribe()
  }, [refreshAal, fetchRole])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }, [])

  const signUp = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    return { data, error }
  }, [])

  // [AUDIT-LOG] [SESSION-TIMEOUT] signOut — logs LOGOUT or SESSION_TIMEOUT before
  // terminating the Supabase session. Pass reason='timeout' for idle-timeout sign-outs.
  const signOut = useCallback(async (reason = 'user') => {
    const event = reason === 'timeout' ? AUDIT_EVENTS.SESSION_TIMEOUT : AUDIT_EVENTS.LOGOUT
    await logEvent(event, { reason })
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ session, user, role, aal, nextAal, refreshAal, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
