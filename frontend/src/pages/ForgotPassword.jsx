import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { logEvent, AUDIT_EVENTS } from '../lib/audit'
import { validate, forgotPasswordSchema } from '../lib/validation'
import { Card } from '../components/ui/Card'
import { TextInput } from '../components/ui/TextInput'
import { Button } from '../components/ui/Button'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    const { data: parsed, errors: validationErrors } = validate(forgotPasswordSchema, { email })
    if (validationErrors) { setErrors(validationErrors); return }
    setErrors({})

    setLoading(true)
    try {
      await supabase.auth.resetPasswordForEmail(parsed.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      // Log regardless of whether the email exists — generic response prevents enumeration
      await logEvent(AUDIT_EVENTS.PASSWORD_RESET_REQUESTED, {}, parsed.email)
      setSubmitted(true)
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
          <h1 className="text-2xl font-semibold text-gray-900">Reset your password</h1>
          <p className="mt-1 text-sm text-gray-500">
            {submitted ? 'Check your inbox' : 'Enter your email to receive a reset link'}
          </p>
        </div>

        <Card>
          {submitted ? (
            <div className="text-center py-2">
              <p className="text-sm text-gray-700">
                If an account exists for that email, a password reset link has been sent.
              </p>
              <p className="text-xs text-gray-500 mt-3">
                Check your spam folder if you don&apos;t see it within a few minutes.
              </p>
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
              <Button type="submit" loading={loading} className="w-full mt-2">
                Send reset link
              </Button>
            </form>
          )}
        </Card>

        <p className="mt-4 text-center text-sm text-gray-500">
          <Link
            to="/login"
            className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-600"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
