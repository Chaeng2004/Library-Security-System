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
import { AuthLayout } from '../components/layout/AuthLayout'

const MFA_FRIENDLY_NAME = 'Authenticator app'
const MFA_ISSUER = 'LibrarySecuritySystem'

function getTotpFactors(factorsData) {
  if (!factorsData) return []
  if (Array.isArray(factorsData.totp) && factorsData.totp.length > 0) return factorsData.totp
  if (Array.isArray(factorsData.all)) {
    return factorsData.all.filter(
      (f) => f.factor_type === 'totp' || f.factorType === 'totp'
    )
  }
  return factorsData.totp ?? []
}

async function unenrollTotpFactors(factors, { onlyUnverified = true } = {}) {
  const toRemove = factors.filter((f) => !onlyUnverified || f.status !== 'verified')
  const failures = []
  for (const f of toRemove) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
    if (error) failures.push(error.message)
  }
  return failures
}

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
  const [resetting, setResetting] = useState(false)
  // [MFA] true when a verified factor already exists — skip enrollment, just challenge.
  const [isReauth, setIsReauth] = useState(false)
  // [MFA] Resume an in-progress enrollment (no QR available).
  const [resumeWithoutQr, setResumeWithoutQr] = useState(false)

  const enrollStarted = useRef(false)

  const enrollNewTotp = useCallback(async () => {
    return supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: MFA_ISSUER,
      friendlyName: MFA_FRIENDLY_NAME,
    })
  }, [])

  // [MFA] startEnrollment — ISO 27001 A.9.4. Handles two cases:
  // 1. No verified factor → enroll a new TOTP factor (shows QR code).
  // 2. Verified factor already exists → issue a challenge directly (re-authentication).
  // To change the TOTP issuer name search for "issuer:" in this function.
  const startEnrollment = useCallback(async () => {
    setEnrolling(true)
    setServerError('')
    setResumeWithoutQr(false)

    const { data: existing, error: listError } = await supabase.auth.mfa.listFactors()

    // [SESSION-TIMEOUT] Stale JWT — user deleted from the database while session was live.
    // Sign out immediately to clear the invalid token from localStorage.
    if (isStaleSessionError(listError)) {
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
      return
    }

    const totpFactors = getTotpFactors(existing)
    const verifiedFactor = totpFactors.find((f) => f.status === 'verified')

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

    const unverified = totpFactors.filter((f) => f.status !== 'verified')

    // Resume a single in-progress enrollment instead of creating a duplicate factor.
    if (unverified.length === 1) {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: unverified[0].id,
      })
      if (!challengeError) {
        setEnrollData({ factorId: unverified[0].id, qrCode: null, secret: null })
        setChallengeId(challenge.id)
        setIsReauth(false)
        setResumeWithoutQr(true)
        setEnrolling(false)
        return
      }
    }

    // [MFA] Clean up leftover unverified factors before enrolling a new one —
    // Supabase rejects enroll() if an unverified factor with the same name exists.
    const unenrollFailures = await unenrollTotpFactors(unverified)
    if (unenrollFailures.length > 0) {
      setServerError(
        'Could not remove a previous MFA setup. Use "Reset MFA setup" below, or ask an admin to clear MFA factors in Supabase Dashboard → Authentication → Users.'
      )
      setEnrolling(false)
      return
    }

    let { data, error } = await enrollNewTotp()
    if (error?.message?.includes('already exists')) {
      await unenrollTotpFactors(totpFactors, { onlyUnverified: true })
      ;({ data, error } = await enrollNewTotp())
    }

    if (error) {
      if (isStaleSessionError(error)) {
        await supabase.auth.signOut()
        navigate('/login', { replace: true })
        return
      }
      setServerError(
        `MFA setup failed: ${error.message}. Use "Reset MFA setup" below if this keeps happening.`
      )
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
  }, [navigate, enrollNewTotp])

  const handleResetMfa = async () => {
    setResetting(true)
    setServerError('')
    try {
      const { data: existing } = await supabase.auth.mfa.listFactors()
      const totpFactors = getTotpFactors(existing)
      const failures = await unenrollTotpFactors(totpFactors, { onlyUnverified: true })
      if (failures.length > 0) {
        setServerError(
          'Reset failed — remove MFA factors manually in Supabase Dashboard → Authentication → Users → select user → MFA factors.'
        )
        return
      }
      enrollStarted.current = false
      enrollStarted.current = true
      await startEnrollment()
    } finally {
      setResetting(false)
    }
  }

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
    try {
      const { data: existing } = await supabase.auth.mfa.listFactors()
      await unenrollTotpFactors(getTotpFactors(existing), { onlyUnverified: true })
    } catch {
      // Proceed even if cleanup fails — user chose to skip.
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

  const mfaSubtitle = isReauth
    ? 'Open your authenticator app and enter the 6-digit code.'
    : resumeWithoutQr
      ? 'Enter the code from your authenticator app to finish setup, or reset below if you lost access.'
      : 'Scan the QR code with Google Authenticator, Authy, or any TOTP app.'

  if (enrolling) {
    return (
      <AuthLayout
        title={isReauth ? 'Verify your identity' : 'Set up two-factor authentication'}
        subtitle="Setting up authenticator…"
        wide
      >
        <Card>
          <p className="text-sm text-gray-500 text-center py-4">Please wait…</p>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={isReauth ? 'Verify your identity' : 'Set up two-factor authentication'}
      subtitle={mfaSubtitle}
      wide
      footer={
        <p className="mt-6 text-center text-xs text-gray-400">
          Signed in as <span className="font-medium">{user?.email}</span>
        </p>
      }
    >
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
                {(serverError || resumeWithoutQr) && !isReauth && (
                  <button
                    type="button"
                    onClick={handleResetMfa}
                    disabled={resetting}
                    className="text-sm text-red-600 hover:text-red-800 underline text-center disabled:opacity-50"
                  >
                    {resetting ? 'Resetting…' : 'Reset MFA setup'}
                  </button>
                )}
              </form>
            </>
          )}
        </Card>
    </AuthLayout>
  )
}
