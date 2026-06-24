import { z } from 'zod'

// [INPUT-VALIDATION] ISO 27001 A.8 / A.14.2 — All user-facing input passes through
// these Zod schemas before any network call. Transforms normalize data so downstream
// code always works with clean, sanitized values.

export const emailSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
  z.string().min(1, 'Email is required').email('Enter a valid email address'),
)

// [INPUT-VALIDATION] passwordSchema — complexity rules per ISO 27001 A.9.3 / NIST 800-63B.
// To change requirements search for "passwordSchema".
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((val) => /[A-Z]/.test(val), 'Must contain at least one uppercase letter')
  .refine((val) => /[a-z]/.test(val), 'Must contain at least one lowercase letter')
  .refine((val) => /[0-9]/.test(val), 'Must contain at least one number')
  .refine((val) => /[^A-Za-z0-9]/.test(val), 'Must contain at least one special character')

// [MFA] [INPUT-VALIDATION] totpCodeSchema — TOTP codes are exactly 6 digits; any
// other format is rejected before the code is sent to Supabase mfa.verify().
export const totpCodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const mfaVerifySchema = z.object({
  code: totpCodeSchema,
})

// [INPUT-VALIDATION] registerSchema — ISO 27001 A.8 / A.14.2.
// confirmPassword must match password; enforced client-side before any Supabase call.
export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

// [INPUT-VALIDATION] validate — runs a Zod schema and returns a flat { field: message }
// error map so form fields can display per-field errors without extra parsing.
export function validate(schema, data) {
  const result = schema.safeParse(data)
  if (result.success) {
    return { data: result.data, errors: null }
  }
  const errors = {}
  for (const issue of result.error.issues) {
    const key = issue.path[0] ?? '_'
    if (!errors[key]) errors[key] = issue.message
  }
  return { data: null, errors }
}
