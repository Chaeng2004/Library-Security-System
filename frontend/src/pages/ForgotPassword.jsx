import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { logEvent, AUDIT_EVENTS } from '../lib/audit'
import { validate, forgotPasswordSchema } from '../lib/validation'
import { Card } from '../components/ui/Card'
import { TextInput } from '../components/ui/TextInput'
import { Button } from '../components/ui/Button'
import { AuthLayout } from '../components/layout/AuthLayout'

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
      await logEvent(AUDIT_EVENTS.PASSWORD_RESET_REQUESTED, {}, parsed.email)
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={submitted ? 'Check your inbox' : 'Enter your email to receive a reset link'}
      footer={
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link
            to="/login"
            className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-600"
          >
            Back to sign in
          </Link>
        </p>
      }
    >
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
    </AuthLayout>
  )
}
