import { useState } from 'react'
import { Link } from 'react-router-dom'
import { logEvent, AUDIT_EVENTS } from '../lib/audit'
import { validate, registerSchema } from '../lib/validation'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui/Card'
import { TextInput } from '../components/ui/TextInput'
import { Button } from '../components/ui/Button'

function getErrorMessage(error, fallback = 'Unable to create account. Please try again.') {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (typeof error.message === 'string' && error.message.trim()) return error.message
  if (typeof error.error_description === 'string' && error.error_description.trim()) return error.error_description
  if (typeof error.msg === 'string' && error.msg.trim()) return error.msg
  const code = error.code || error.error_code || error.status
  if (code && typeof error.msg === 'string' && error.msg.trim()) {
    return `${error.msg} (${code})`
  }
  try {
    const serialized = JSON.stringify(error)
    if (serialized && serialized !== '{}') return serialized
  } catch {
    // Fall through to the generic fallback.
  }
  return fallback
}

const PASSWORD_RULES = [
  { label: 'At least 8 characters',      test: (v) => v.length >= 8 },
  { label: 'One uppercase letter (A–Z)',  test: (v) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter (a–z)',  test: (v) => /[a-z]/.test(v) },
  { label: 'One number (0–9)',            test: (v) => /[0-9]/.test(v) },
  { label: 'One special character',       test: (v) => /[^A-Za-z0-9]/.test(v) },
]

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

function PasswordChecklist({ value }) {
  if (!value) return null
  return (
    <ul className="mt-1 space-y-1">
      {PASSWORD_RULES.map(({ label, test }) => {
        const passed = test(value)
        return (
          <li key={label} className={`flex items-center gap-1.5 text-xs ${passed ? 'text-gray-600' : 'text-gray-400'}`}>
            {passed ? (
              <svg className="w-3.5 h-3.5 text-gray-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="w-3.5 h-3.5 flex-shrink-0 flex items-center justify-center">
                <span className="w-1 h-1 rounded-full bg-gray-300 inline-block" />
              </span>
            )}
            {label}
          </li>
        )
      })}
    </ul>
  )
}

export default function Register() {
  const { signUp } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const confirmMismatch = confirmTouched && confirmPassword.length > 0 && password !== confirmPassword
  const confirmMatch = confirmTouched && confirmPassword.length > 0 && password === confirmPassword

  // [AUDIT-LOG] [INPUT-VALIDATION] handleSubmit — ISO 27001 A.9.2 / A.8.
  // Validates all fields via registerSchema before calling signUp.
  // USER_REGISTERED is logged on success; generic errors prevent email enumeration.
  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')

    const { data: parsed, errors: validationErrors } = validate(registerSchema, {
      email,
      password,
      confirmPassword,
    })
    if (validationErrors) { setErrors(validationErrors); return }
    setErrors({})

    setLoading(true)
    try {
      const { data, error } = await signUp(parsed.email, parsed.password)

      if (error) {
        console.error('[signUp error]', error)
        setServerError(getErrorMessage(error))
        return
      }

      // [INPUT-VALIDATION] Supabase returns identities:[] for duplicate emails — fake-success prevents user enumeration.
      if (!data?.user || data.user.identities?.length === 0) {
        setSuccess(true)
        return
      }

      await logEvent(AUDIT_EVENTS.USER_REGISTERED, {}, parsed.email, data.user?.id ?? null)
      setSuccess(true)
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
          <p className="mt-1 text-sm text-gray-500">Create your account</p>
        </div>

        <Card>
          {success ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">Check your email</p>
                <p className="mt-1 text-sm text-gray-500">
                  We sent a confirmation link to <span className="font-medium">{email}</span>.
                  Click it to activate your account, then sign in.
                </p>
              </div>
              <Link
                to="/login"
                className="text-sm font-medium text-gray-900 underline underline-offset-2 hover:text-gray-600"
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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

              <div className="flex flex-col gap-1">
                <TextInput
                  id="password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordTouched(true) }}
                  error={errors.password}
                  placeholder="••••••••"
                  rightSlot={<EyeToggle show={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
                />
                <PasswordChecklist value={passwordTouched ? password : ''} />
              </div>

              <div className="flex flex-col gap-1">
                <TextInput
                  id="confirm-password"
                  label="Confirm password"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setConfirmTouched(true) }}
                  error={confirmMismatch ? 'Passwords do not match' : (errors.confirmPassword ?? null)}
                  placeholder="••••••••"
                  rightSlot={<EyeToggle show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />}
                />
                {confirmMatch && (
                  <p className="flex items-center gap-1.5 text-xs text-gray-600">
                    <svg className="w-3.5 h-3.5 text-gray-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Passwords match
                  </p>
                )}
              </div>

              {serverError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {serverError}
                </p>
              )}
              <Button type="submit" loading={loading} className="w-full mt-2">
                Create account
              </Button>
            </form>
          )}
        </Card>

        {!success && (
          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-600">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
