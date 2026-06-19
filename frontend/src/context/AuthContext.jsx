import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { logEvent, AUDIT_EVENTS } from '../lib/audit'

// [SESSION-TIMEOUT] isStaleSessionError — detects a 403 JWT whose subject no longer
// exists in the database (user deleted while a session was live). Callers must
// immediately sign out to wipe the invalid token from localStorage.
export function isStaleSessionError(error) {
  if (!error) return false
  return (
    error.status === 403 ||
    error.message?.includes('does not exist') ||
    error.message?.includes('JWT')
  )
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [user, setUser] = useState(null)
  // [MFA] aal1 = password only; aal2 = password + verified TOTP factor.
  // ProtectedRoute blocks dashboard access until aal2 is confirmed.
  const [aal, setAal] = useState(null)

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
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s) refreshAal()
      else setAal(null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s) refreshAal()
      else setAal(null)
    })

    return () => subscription.unsubscribe()
  }, [refreshAal])

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
    <AuthContext.Provider value={{ session, user, aal, refreshAal, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
