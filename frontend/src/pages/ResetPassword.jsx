import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { logEvent, AUDIT_EVENTS } from '../lib/audit'
import { validate, resetPasswordSchema } from '../lib/validation'
import { Card } from '../components/ui/Card'
import { TextInput } from '../components/ui/TextInput'
import { Button } from '../components/ui/Button'
import { AuthLayout } from '../components/layout/AuthLayout'

const PASSWORD_RULES = [
  { label: 'At least 8 characters',      test: (v) => v.length >= 8 },
  { label: 'One uppercase letter (A–Z)',  test: (v) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter (a–z)',  test: (v) => /[a-z]/.test(v) },
  { label: 'One number (0–9)',            test: (v) => /[0-9]/.test(v) },
  { label: 'One special character',       test: (v) => /[^A-Za-z0-9]/.test(v) },
]

function PasswordChecklist({ value }) {
  if (!value) return null
  return (
    <ul className="mt-1 space-y-1">
      {PASSWORD_RULES.map(({ label, test }) => {
        const passed = test(value)
        return (
          <li key={label} className={`flex items-center gap-1.5 text-xs ${passed ? 'text-green-600' : 'text-gray-400'}`}>
            {passed ? (
              <svg className="w-3.5 h-3.5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
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

export default function ResetPassword() {
  const navigate = useNavigate()

  const [ready, setReady] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const confirmMismatch = confirmTouched && confirmPassword.length > 0 && password !== confirmPassword
  const confirmMatch = confirmTouched && confirmPassword.length > 0 && password === confirmPassword

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      else {
        const t = setTimeout(() => setInvalid(true), 2000)
        return () => clearTimeout(t)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handlePasswordChange = (e) => {
    setPassword(e.target.value)
    setPasswordTouched(true)
    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
  }

  const handleConfirmChange = (e) => {
    setConfirmPassword(e.target.value)
    setConfirmTouched(true)
    if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setServerError('')

    const { data: parsed, errors: validationErrors } = validate(resetPasswordSchema, { password, confirmPassword })
    if (validationErrors) { setErrors(validationErrors); return }
    setErrors({})

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.password })
      if (error) {
        setServerError(error.message || 'Failed to reset password. Please try again.')
        return
      }
      await logEvent(AUDIT_EVENTS.PASSWORD_RESET_SUCCESS, {})
      await supabase.auth.signOut()
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  if (!ready && !invalid) {
    return (
      <AuthLayout title="Set a new password" subtitle="Verifying reset link…">
        <Card>
          <p className="text-sm text-gray-500 text-center py-4">Please wait…</p>
        </Card>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Set a new password">
        <Card>
          {invalid ? (
            <div className="text-center py-2">
              <p className="text-sm text-red-600">
                This reset link is invalid or has expired.
              </p>
              <p className="text-xs text-gray-500 mt-3">
                Request a new one from the{' '}
                <Link to="/forgot-password" className="underline text-gray-700">
                  forgot password
                </Link>{' '}
                page.
              </p>
            </div>
          ) : done ? (
            <div className="text-center py-2">
              <p className="text-sm text-gray-700 mb-4">
                Your password has been updated. Please sign in with your new password.
              </p>
              <Button onClick={() => navigate('/login', { replace: true })} className="w-full">
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1">
                <TextInput
                  id="password"
                  label="New password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={handlePasswordChange}
                  error={errors.password}
                  placeholder="••••••••"
                  rightSlot={<EyeToggle show={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
                />
                <PasswordChecklist value={passwordTouched ? password : ''} />
              </div>

              <div className="flex flex-col gap-1">
                <TextInput
                  id="confirmPassword"
                  label="Confirm new password"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={handleConfirmChange}
                  error={confirmMismatch ? 'Passwords do not match' : (errors.confirmPassword ?? null)}
                  placeholder="••••••••"
                  rightSlot={<EyeToggle show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />}
                />
                {confirmMatch && (
                  <p className="flex items-center gap-1.5 text-xs text-green-600">
                    <svg className="w-3.5 h-3.5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                Update password
              </Button>
            </form>
          )}
        </Card>
    </AuthLayout>
  )
}
