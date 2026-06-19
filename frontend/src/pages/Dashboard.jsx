import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

// i-change lang ang first nemric literal kung gusto nyo baguhin yung session seconds
// wag na galawin ang warning_ms.
const IDLE_MS = 15 * 60 * 1000
const WARNING_MS = 60 * 1000

function formatSeconds(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function formatDate(ts) {
  return new Date(ts).toLocaleString()
}

const EVENT_LABELS = {
  LOGIN_SUCCESS: 'Signed in',
  LOGIN_FAILURE: 'Failed login attempt',
  MFA_ENROLLED: 'MFA enrolled',
  MFA_CHALLENGE_SUCCESS: 'MFA verified',
  MFA_CHALLENGE_FAILURE: 'MFA failed',
  LOGOUT: 'Signed out',
  SESSION_TIMEOUT: 'Session timed out',
  USER_REGISTERED: 'Account registered',
}

function resolveUserRole(user) {
  const metadataRole = user?.app_metadata?.role || user?.user_metadata?.role
  if (typeof metadataRole === 'string' && metadataRole.trim()) {
    return metadataRole.trim().toLowerCase()
  }

  const email = String(user?.email || '').toLowerCase()
  if (email === String(import.meta.env.VITE_ADMIN_EMAIL || '').toLowerCase()) {
    return 'admin'
  }

  return 'user'
}

function StatCard({ label, value, helper }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
      {helper && <p className="text-[11px] text-gray-400 mt-1">{helper}</p>}
    </div>
  )
}

function SectionTitle({ title, description }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const role = resolveUserRole(user)
  const [auditLogs, setAuditLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    const { data } = await supabase
      .from('audit_logs')
      .select('id, event_type, detail, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    setAuditLogs(data ?? [])
    setLogsLoading(false)
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Automatic session termination after IDLE_MS of inactivity.
  const handleTimeout = useCallback(async () => {
    await signOut('timeout')
    navigate('/login', { replace: true })
  }, [signOut, navigate])

  const { secondsLeft, isWarning } = useIdleTimeout(handleTimeout, IDLE_MS, WARNING_MS)

  const confirmLogout = async () => {
    setShowLogoutConfirm(false)
    await signOut('user')
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-base font-semibold text-gray-900">Sign out?</h2>
            <p className="mt-2 text-sm text-gray-500">
              Your current session will be terminated. You will need to sign in and verify your identity again.
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <Button onClick={confirmLogout}>Sign out</Button>
            </div>
          </div>
        </div>
      )}

      {isWarning && (
        <div className="bg-gray-900 text-white text-sm text-center py-2 px-4">
          Your session will expire in{' '}
          <span className="font-semibold tabular-nums">{formatSeconds(secondsLeft)}</span>
          {' '}due to inactivity.
        </div>
      )}

      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900">Library Security System</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-500">Signed in as</p>
              <p className="text-sm font-medium text-gray-900">{user?.email}</p>
            </div>
            <Button variant="secondary" onClick={() => setShowLogoutConfirm(true)}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {role === 'admin' ? 'Admin dashboard' : 'User dashboard'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${isWarning ? 'bg-gray-400' : 'bg-gray-300'}`} />
              <span className="text-gray-500">
                Session idle timeout:{' '}
                <span className={`font-semibold tabular-nums ${isWarning ? 'text-gray-900' : 'text-gray-600'}`}>
                  {formatSeconds(secondsLeft)}
                </span>
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle
            title="Session status"
            description="Connected to Supabase auth and the audit log table."
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Role', value: role === 'admin' ? 'Admin' : 'User', helper: 'Resolved from auth metadata or email fallback' },
              { label: 'Authentication', value: 'Password + MFA', helper: 'Supabase auth' },
              { label: 'Session', value: 'Active (AAL2)', helper: 'MFA required' },
              { label: 'Idle timeout', value: `${IDLE_MS / 60000} minutes`, helper: 'Auto sign-out on inactivity' },
            ].map((item) => (
              <StatCard key={item.label} {...item} />
            ))}
          </div>
        </Card>

        {role === 'admin' ? (
          <Card>
            <SectionTitle
              title="Admin controls"
              description="Basic working controls for now. These read from the live auth session and audit log."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label="Admin capability"
                value="View all security logs"
                helper="Currently backed by audit_logs"
              />
              <StatCard
                label="Pending database work"
                value="Role table / profile table"
                helper="See databse-update.md"
              />
            </div>
          </Card>
        ) : (
          <Card>
            <SectionTitle
              title="Your account"
              description="Regular user view with the same live data source."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label="What you can do"
                value="View your account status"
                helper="Signed-in user only"
              />
              <StatCard
                label="Security"
                value="MFA protected"
                helper="AAL2 is required before dashboard access"
              />
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center justify-between mb-4 gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Security event log</h3>
              <p className="text-xs text-gray-500 mt-1">
                Live from Supabase table: <span className="font-medium">audit_logs</span>
              </p>
            </div>
            <button
              onClick={fetchLogs}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Refresh
            </button>
          </div>
          {logsLoading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Loading events…</p>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No events recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs text-gray-500 font-medium pb-2">Event</th>
                    <th className="text-left text-xs text-gray-500 font-medium pb-2">Detail</th>
                    <th className="text-left text-xs text-gray-500 font-medium pb-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 pr-4">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            log.event_type.includes('FAILURE') ? 'bg-gray-400' : 'bg-gray-700'
                          }`} />
                          <span className="text-gray-800 whitespace-nowrap">
                            {EVENT_LABELS[log.event_type] ?? log.event_type}
                          </span>
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-500 text-xs">
                        {log.detail && Object.keys(log.detail).length > 0
                          ? JSON.stringify(log.detail)
                          : '—'}
                      </td>
                      <td className="py-2 text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  )
}
