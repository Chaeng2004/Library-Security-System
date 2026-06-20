import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { logEvent, AUDIT_EVENTS } from '../lib/audit'
import { validate, loginSchema, mfaVerifySchema } from '../lib/validation'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui/Card'
import { TextInput } from '../components/ui/TextInput'
import { Button } from '../components/ui/Button'

function EyeToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-gray-400 hover:text-gray-600 focus:outline-none"
      aria-label={show ? 'Hide password' : 'Show password'}
    >
      {show ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const { signIn, refreshAal, session, aal } = useAuth()

  useEffect(() => {
    if (session === undefined) return
    if (!session) return
    if (aal === null) return
    if (aal === 'aal2') navigate('/dashboard', { replace: true })
    else navigate('/mfa-setup', { replace: true })
  }, [session, aal]) // eslint-disable-line react-hooks/exhaustive-deps

  const [step, setStep] = useState('password')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mfaState, setMfaState] = useState({ factorId: null, challengeId: null })

  // [MFA] [AUDIT-LOG] handlePasswordSubmit — ISO 27001 A.9.4 password authentication step.
  // Generic error messages are intentional to prevent user enumeration attacks.
  // Failed attempts are logged via logEvent before any error is displayed.
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setServerError('')

    const { data: parsed, errors: validationErrors } = validate(loginSchema, { email, password })
    if (validationErrors) { setErrors(validationErrors); return }
    setErrors({})

    setLoading(true)
    try {
      const { data, error } = await signIn(parsed.email, parsed.password)

      if (error) {
        // [AUDIT-LOG] Log the failure without revealing whether the email exists.
        await logEvent(AUDIT_EVENTS.LOGIN_FAILURE, { reason: 'invalid_credentials' }, parsed.email, null)
        setServerError('Invalid email or password.')
        return
      }

      await logEvent(AUDIT_EVENTS.LOGIN_SUCCESS, {}, parsed.email, data.user.id)

      // [MFA] Check for a verified TOTP factor; if found, issue a challenge instead
      // of navigating directly to /mfa-setup (enrollment is already done).
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.find((f) => f.status === 'verified')

      if (totp) {
        const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
          factorId: totp.id,
        })
        if (challengeError) {
          setServerError('Failed to start MFA challenge. Please try again.')
          return
        }
        setMfaState({ factorId: totp.id, challengeId: challenge.id })
        setStep('totp')
      } else {
        navigate('/mfa-setup', { replace: true })
      }
    } finally {
      setLoading(false)
    }
  }

  // [MFA] [INPUT-VALIDATION] handleTotpSubmit — ISO 27001 A.9.4 TOTP challenge step.
  // Code format is validated locally via mfaVerifySchema before the server call.
  // Success raises the session to aal2; failure is logged and shown generically.
  const handleTotpSubmit = async (e) => {
    e.preventDefault()
    setServerError('')

    const { data: parsed, errors: validationErrors } = validate(mfaVerifySchema, { code: totpCode })
    if (validationErrors) { setErrors(validationErrors); return }
    setErrors({})

    setLoading(true)
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaState.factorId,
        challengeId: mfaState.challengeId,
        code: parsed.code,
      })

      if (error) {
        await logEvent(AUDIT_EVENTS.MFA_CHALLENGE_FAILURE, { reason: error.message })
        setServerError('Invalid verification code. Please try again.')
        return
      }

      await logEvent(AUDIT_EVENTS.MFA_CHALLENGE_SUCCESS, {})
      await refreshAal()
      navigate('/dashboard', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-900 mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Library Security System</h1>
          <p className="mt-1 text-sm text-gray-500">
            {step === 'password' ? 'Sign in to your account' : 'Two-factor authentication'}
          </p>
        </div>

        <Card>
          {step === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4" noValidate>
              <TextInput
                id="email"
                label="Email address"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                placeholder="you@example.com"
              />
              <TextInput
                id="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                placeholder="••••••••"
                rightSlot={<EyeToggle show={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
              />
              {serverError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {serverError}
                </p>
              )}
              <Button type="submit" loading={loading} className="w-full mt-2">
                Sign in
              </Button>
            </form>
          ) : (
            <form onSubmit={handleTotpSubmit} className="flex flex-col gap-4" noValidate>
              <div className="text-center py-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 mb-3">
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">
                  Open your authenticator app and enter the 6-digit code.
                </p>
              </div>
              <TextInput
                id="totp-code"
                label="Verification code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                error={errors.code}
                placeholder="000000"
                className="text-center tracking-widest text-lg"
              />
              {serverError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {serverError}
                </p>
              )}
              <Button type="submit" loading={loading} className="w-full mt-2">
                Verify
              </Button>
              <button
                type="button"
                onClick={() => { setStep('password'); setTotpCode(''); setServerError('') }}
                className="text-sm text-gray-500 hover:text-gray-700 underline text-center"
              >
                Back to sign in
              </button>
              <p className="text-xs text-gray-400 text-center pt-1">
                Lost access to your authenticator?{' '}
                <span className="text-gray-500">Contact your administrator to reset MFA.</span>
              </p>
            </form>
          )}
        </Card>

        {step === 'password' && (
          <p className="mt-4 text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-600">
              Sign up
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
