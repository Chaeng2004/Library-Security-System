import { supabase } from './supabaseClient'

// [AUDIT-LOG] ISO 27001 A.12.4 / A.8.15 — All security events are written through
// the record_audit_event RPC (SECURITY DEFINER). Direct INSERT on audit_logs is
// revoked so clients cannot forge or tamper with log entries.
export const AUDIT_EVENTS = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  MFA_ENROLLED: 'MFA_ENROLLED',
  MFA_CHALLENGE_SUCCESS: 'MFA_CHALLENGE_SUCCESS',
  MFA_CHALLENGE_FAILURE: 'MFA_CHALLENGE_FAILURE',
  MFA_DISABLED: 'MFA_DISABLED',
  LOGOUT: 'LOGOUT',
  SESSION_TIMEOUT: 'SESSION_TIMEOUT',
  USER_REGISTERED: 'USER_REGISTERED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_SUCCESS: 'PASSWORD_RESET_SUCCESS',
}

// [AUDIT-LOG] logEvent — records a security event via the server-side RPC.
// Never throws so that an audit failure never blocks the calling UI operation.
// @param eventType  — one of AUDIT_EVENTS
// @param detail     — optional JSON payload e.g. { reason }
// @param email      — actor email (required for pre-auth events where no session exists)
// @param userId     — actor UUID, null for failed logins
export async function logEvent(eventType, detail = {}, email = null, userId = null) {
  try {
    const { data: { session } } = await supabase.auth.getSession()

    const resolvedUserId = userId ?? session?.user?.id ?? null
    const resolvedEmail = email ?? session?.user?.email ?? null

    await supabase.rpc('record_audit_event', {
      p_user_id: resolvedUserId,
      p_email: resolvedEmail,
      p_event_type: eventType,
      p_detail: detail,
      p_ip: null,
      p_user_agent: navigator.userAgent.slice(0, 500),
    })
  } catch {
    // [AUDIT-LOG] Intentionally swallowed — logging failure must never degrade the UI.
  }
}
