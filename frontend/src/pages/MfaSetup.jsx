import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { logEvent, AUDIT_EVENTS } from '../lib/audit'
import { validate, mfaVerifySchema } from '../lib/validation'
import { useAuth } from '../context/AuthContext'
import { isStaleSessionError } from '../lib/authErrors'
import { Card } from '../components/ui/Card'
import { TextInput } from '../components/ui/TextInput'
import { Button } from '../components/ui/Button'

// [MFA] MfaSetup — ISO 27001 A.9.4 first-time TOTP enrollment.
// The factor is not trusted until the user confirms a valid code (status becomes 'verified').
// To look up enrollment logic search for "startEnrollment".
export default function MfaSetup() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromProfile = location.state?.from === 'profile'
  const { refreshAal, user, aal, session } = useAuth()

  const [enrollData, setEnrollData] = useState(null)
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState(null)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [enrolling, setEnrolling] = useState(true)
  const [skipping, setSkipping] = useState(false)
  // [MFA] true when a verified factor already exists — skip enrollment, just challenge.
  const [isReauth, setIsReauth] = useState(false)

  const enrollStarted = useRef(false)

  // [MFA] startEnrollment — ISO 27001 A.9.4. Handles two cases:
  // 1. No verified factor → enroll a new TOTP factor (shows QR code).
  // 2. Verified factor already exists → issue a challenge directly (re-authentication).
  // To change the TOTP issuer name search for "issuer:" in this function.
  const startEnrollment = useCallback(async () => {
    setEnrolling(true)

    const { data: existing, error: listError } = await supabase.auth.mfa.listFactors()

    // [SESSION-TIMEOUT] Stale JWT — user deleted from the database while session was live.
    // Sign out immediately to clear the invalid token from localStorage.
    if (isStaleSessionError(listError)) {
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
      return
    }

    const verifiedFactor = existing?.totp?.find((f) => f.status === 'verified')

    if (verifiedFactor) {
      // [MFA] Already enrolled — challenge the existing factor to reach aal2.
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: verifiedFactor.id,
      })
      if (challengeError) {
        if (isStaleSessionError(challengeError)) {
          await supabase.auth.signOut()
          navigate('/login', { replace: true })
          return
        }
        setServerError(`MFA challenge failed: ${challengeError.message}`)
        setEnrolling(false)
        return
      }
      setEnrollData({ factorId: verifiedFactor.id, qrCode: null, secret: null })
      setChallengeId(challenge.id)
      setIsReauth(true)
      setEnrolling(false)
      return
    }

    // [MFA] Clean up leftover unverified factors before enrolling a new one —
    // Supabase rejects enroll() if an unverified factor with the same name exists.
    const unverified = existing?.totp?.filter((f) => f.status !== 'verified') ?? []
    for (const f of unverified) {
      await supabase.auth.mfa.unenroll({ factorId: f.id })
    }

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'LibrarySecuritySystem' })
    if (error) {
      if (isStaleSessionError(error)) {
        await supabase.auth.signOut()
        navigate('/login', { replace: true })
        return
      }
      setServerError(`MFA setup failed: ${error.message}`)
      setEnrolling(false)
      return
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: data.id })
    if (challengeError) {
      if (isStaleSessionError(challengeError)) {
        await supabase.auth.signOut()
        navigate('/login', { replace: true })
        return
      }
      setServerError(`MFA challenge failed: ${challengeError.message}`)
      setEnrolling(false)
      return
    }

    setEnrollData({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    setChallengeId(challenge.id)
    setEnrolling(false)
  }, [navigate])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { navigate('/login', { replace: true }); return }
    if (aal === 'aal2') { navigate('/dashboard', { replace: true }); return }
    if (enrollStarted.current) return
    enrollStarted.current = true
    startEnrollment()
  }, [session, aal, navigate, startEnrollment])

  // [MFA] handleSkip — unenrolls the pending unverified factor and lets the user proceed
  // without MFA. Only available during first-time enrollment, not during re-auth.
  const handleSkip = async () => {
    setSkipping(true)
    if (enrollData?.factorId) {
      await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId }).catch(() => {})
    }
    navigate(fromProfile ? '/profile' : '/dashboard', { replace: true })
  }

  // [MFA] [INPUT-VALIDATION] handleVerify — validates the 6-digit code via mfaVerifySchema,
  // then calls mfa.verify(). On success the factor status becomes 'verified' and the
  // session is raised to aal2. Failures are logged via AUDIT_EVENTS.MFA_CHALLENGE_FAILURE.
  const handleVerify = async (e) => {
    e.preventDefault()
    setServerError('')

    const { data: parsed, errors: validationErrors } = validate(mfaVerifySchema, { code })
    if (validationErrors) { setErrors(validationErrors); return }
    setErrors({})

    setLoading(true)
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId,
        code: parsed.code,
      })

      if (error) {
        await logEvent(AUDIT_EVENTS.MFA_CHALLENGE_FAILURE, { reason: error.message, stage: 'enrollment' })
        setServerError('Invalid code. Make sure your device clock is synced and try again.')
        return
      }

      await logEvent(AUDIT_EVENTS.MFA_ENROLLED, { factorId: enrollData.factorId })
      await refreshAal()
      navigate(fromProfile ? '/profile' : '/dashboard', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  if (enrolling) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Setting up authenticator…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            {isReauth ? 'Verify your identity' : 'Set up two-factor authentication'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isReauth
              ? 'Open your authenticator app and enter the 6-digit code.'
              : 'Scan the QR code with Google Authenticator, Authy, or any TOTP app.'}
          </p>
        </div>

        <Card>
          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
              {serverError}
            </p>
          )}

          {enrollData && (
            <>
              {!isReauth && (
                <div className="flex flex-col items-center gap-4 mb-6">
                  <div className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <img src={enrollData.qrCode} alt="TOTP QR code" className="w-48 h-48" />
                  </div>
                  <div className="w-full">
                    <p className="text-xs text-gray-500 mb-1 text-center">
                      Can't scan? Enter this secret key manually:
                    </p>
                    <code className="block text-center text-xs bg-gray-100 text-gray-700 rounded px-3 py-2 break-all select-all">
                      {enrollData.secret}
                    </code>
                  </div>
                </div>
              )}

              <form onSubmit={handleVerify} className="flex flex-col gap-4" noValidate>
                <TextInput
                  id="totp-setup-code"
                  label={isReauth ? 'Verification code' : 'Enter the 6-digit code to confirm'}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  error={errors.code}
                  placeholder="000000"
                  className="text-center tracking-widest text-lg"
                />
                <Button type="submit" loading={loading} className="w-full">
                  {isReauth ? 'Verify' : 'Activate authenticator'}
                </Button>
                {!isReauth && (
                  fromProfile ? (
                    <button
                      type="button"
                      onClick={handleSkip}
                      disabled={skipping}
                      className="text-sm text-gray-500 hover:text-gray-700 underline text-center disabled:opacity-50"
                    >
                      {skipping ? 'Cancelling…' : 'Cancel'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleSkip}
                        disabled={skipping}
                        className="text-sm text-gray-500 hover:text-gray-700 underline text-center disabled:opacity-50"
                      >
                        {skipping ? 'Skipping…' : 'Skip for now'}
                      </button>
                      <p className="text-xs text-gray-400 text-center">
                        You can enable or disable two-factor authentication anytime from your{' '}
                        <span className="text-gray-500">Profile page</span>.
                      </p>
                    </>
                  )
                )}
              </form>
            </>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-gray-400">
          Signed in as <span className="font-medium">{user?.email}</span>
        </p>
      </div>
    </div>
  )
}
