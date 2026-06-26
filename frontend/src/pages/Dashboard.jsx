import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { getUserActiveBorrowings, getUserPendingBorrowings, getUserRecentBorrowings, getUserProfile, getUserBorrowings } from '../lib/api'
import { getBorrowLimit } from '../lib/credit'
import { formatDateTime } from '../lib/format'
import { AppShell } from '../components/layout/AppShell'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { CreditScoreCard } from '../components/ui/CreditScoreCard'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusBadge } from '../components/ui/StatusBadge'

const IDLE_MS = 15 * 60 * 60 * 1000
const WARNING_MS = 60 * 1000

const EVENT_LABELS = {
  LOGIN_SUCCESS: 'Signed in',
  LOGIN_FAILURE: 'Failed login attempt',
  MFA_ENROLLED: 'MFA enrolled',
  MFA_CHALLENGE_SUCCESS: 'MFA verified',
  MFA_CHALLENGE_FAILURE: 'MFA failed',
  MFA_DISABLED: 'MFA disabled',
  LOGOUT: 'Signed out',
  SESSION_TIMEOUT: 'Session timed out',
  USER_REGISTERED: 'Account registered',
  PASSWORD_RESET_REQUESTED: 'Password reset requested',
  PASSWORD_RESET_SUCCESS: 'Password reset',
}

function formatSeconds(s) {
  if (s >= 3600) {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
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
  const { user, role, aal, nextAal, signOut } = useAuth()

  const [auditLogs, setAuditLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [activeBorrowings, setActiveBorrowings] = useState([])
  const [pendingBorrowings, setPendingBorrowings] = useState([])
  const [returnPendingBorrowings, setReturnPendingBorrowings] = useState([])
  const [recentBorrowings, setRecentBorrowings] = useState([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [creditScore, setCreditScore] = useState(100)

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    const { data } = await supabase
      .from('audit_logs')
      .select('id, event_type, detail, created_at')
      .order('created_at', { ascending: false })
      .limit(15)
    setAuditLogs(data ?? [])
    setLogsLoading(false)
  }, [])

  const fetchStats = useCallback(async () => {
    if (!user?.id) return
    setStatsLoading(true)
    const [active, pending, recent, profile, allBorrowings] = await Promise.all([
      getUserActiveBorrowings(user.id),
      getUserPendingBorrowings(user.id),
      getUserRecentBorrowings(user.id, 3),
      getUserProfile(user.id),
      getUserBorrowings(user.id),
    ])
    setActiveBorrowings(active.data ?? [])
    setPendingBorrowings(pending.data ?? [])
    setRecentBorrowings(recent.data ?? [])
    setReturnPendingBorrowings((allBorrowings.data ?? []).filter((b) => b.status === 'return_pending'))
    if (profile.data) setCreditScore(profile.data.credit_score ?? 100)
    setStatsLoading(false)
  }, [user])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs()
      fetchStats()
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchLogs, fetchStats])

  const handleTimeout = useCallback(async () => {
    await signOut('timeout')
    navigate('/login', { replace: true })
  }, [signOut, navigate])

  const { secondsLeft, isWarning } = useIdleTimeout(handleTimeout, IDLE_MS, WARNING_MS)

  useEffect(() => {
    sessionStorage.setItem('sessionIdleSecondsLeft', secondsLeft)
  }, [secondsLeft])

  useEffect(() => {
    if (role === 'admin') navigate('/admin', { replace: true })
  }, [role, navigate])

  if (role === null || role === 'admin') return null

  const openLoans = activeBorrowings.length + pendingBorrowings.length + returnPendingBorrowings.length
  const navBadgeCount = activeBorrowings.length + returnPendingBorrowings.length
  const overdueCount = activeBorrowings.filter((b) => new Date(b.due_date) < new Date()).length
  const mfaLabel = aal === 'aal2' ? 'MFA verified (AAL2)' : nextAal === 'aal2' ? 'MFA required' : 'Password only (AAL1)'
  const idleMinutes = Math.round(IDLE_MS / 60000)

  return (
    <AppShell
      title="Dashboard"
      badges={{ borrowings: navBadgeCount }}
    >
      <div className="flex flex-col gap-6">
        <Card className="border-l-4 border-l-gray-900">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">User dashboard</h2>
              <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
            </div>
            <p className="text-xs text-gray-400">
              Session idle: {formatSeconds(secondsLeft)}
              {isWarning && <span className="ml-2 text-amber-600 font-medium">· expiring soon</span>}
            </p>
          </div>
          <CreditScoreCard score={creditScore} openLoans={openLoans} />
        </Card>

        {!statsLoading && overdueCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
            <div>
              <p className="text-sm font-semibold text-red-800">Overdue books</p>
              <p className="text-xs text-red-600 mt-0.5">
                You have {overdueCount} overdue book{overdueCount !== 1 ? 's' : ''}. Return them to avoid further credit penalties.
              </p>
            </div>
          </div>
        )}

        {!statsLoading && creditScore < 60 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800">Low credit score ({creditScore})</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your borrowing limit is {getBorrowLimit(creditScore)} book{getBorrowLimit(creditScore) !== 1 ? 's' : ''}. Return books on time to improve your score.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Active loans" value={statsLoading ? '…' : String(activeBorrowings.length)} />
          <StatCard label="Pending approval" value={statsLoading ? '…' : String(pendingBorrowings.length)} />
          <StatCard label="Overdue" value={statsLoading ? '…' : String(overdueCount)} />
          <StatCard label="Recent returns" value={statsLoading ? '…' : String(recentBorrowings.length)} helper="Last 3" />
        </div>

        {statsLoading ? (
          <LoadingSpinner label="Loading borrowings…" />
        ) : (
          <>
            {activeBorrowings.length > 0 && (
              <Card>
                <SectionTitle title="Currently borrowed" description="Active loans on your account" />
                <div className="divide-y divide-gray-100">
                  {activeBorrowings.map((b) => {
                    const overdue = new Date(b.due_date) < new Date()
                    return (
                      <div key={b.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{b.books?.title ?? '—'}</p>
                          <p className="text-xs text-gray-500">{b.books?.author ?? ''}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-gray-600'}`}>
                            Due {formatDateTime(b.due_date)}
                          </p>
                          {overdue && <StatusBadge status="unavailable" label="Overdue" className="mt-1" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {pendingBorrowings.length > 0 && (
              <Card>
                <SectionTitle title="Pending requests" />
                <div className="divide-y divide-gray-100">
                  {pendingBorrowings.map((b) => (
                    <div key={b.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{b.books?.title ?? '—'}</p>
                        <p className="text-xs text-gray-500">{b.books?.author ?? ''}</p>
                      </div>
                      <StatusBadge status="pending" />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {activeBorrowings.length === 0 && pendingBorrowings.length === 0 && recentBorrowings.length === 0 && (
              <Card>
                <EmptyState
                  title="No borrowings yet"
                  description="Browse the catalog to request your first book."
                  action={
                    <button
                      type="button"
                      onClick={() => navigate('/books')}
                      className="text-sm font-medium text-gray-900 underline underline-offset-2"
                    >
                      Browse books
                    </button>
                  }
                />
              </Card>
            )}

            {recentBorrowings.length > 0 && (
              <Card>
                <SectionTitle title="Recently returned" description="Your last 3 returned books" />
                <div className="divide-y divide-gray-100">
                  {recentBorrowings.map((b) => (
                    <div key={b.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{b.books?.title ?? '—'}</p>
                        <p className="text-xs text-gray-500">{b.books?.author ?? ''}</p>
                      </div>
                      <p className="text-xs text-gray-500 shrink-0">
                        {b.returned_date ? formatDateTime(b.returned_date) : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => navigate('/books')}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-left hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-semibold text-gray-900">Browse Books</p>
            <p className="text-xs text-gray-500 mt-1">Discover and borrow books</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/my-borrowings')}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-left hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-semibold text-gray-900">My Borrowings</p>
            <p className="text-xs text-gray-500 mt-1">{openLoans} open loan{openLoans !== 1 ? 's' : ''}</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-left hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-semibold text-gray-900">Profile</p>
            <p className="text-xs text-gray-500 mt-1">Manage your account</p>
          </button>
        </div>

        <Card>
          <SectionTitle title="Account & security" description="Live session details from Supabase Auth" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Role" value={role ?? 'user'} helper="From user_profiles" />
            <StatCard label="Authentication" value={mfaLabel} />
            <StatCard label="Borrow limit" value={`${getBorrowLimit(creditScore)} books`} helper={`Score: ${creditScore}`} />
            <StatCard label="Idle timeout" value={formatSeconds(secondsLeft)} helper={`${idleMinutes} min max · auto sign-out`} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4 gap-3">
            <SectionTitle title="Security event log" description="Recent activity from audit_logs" />
            <button type="button" onClick={fetchLogs} className="text-xs text-gray-500 hover:text-gray-700 underline shrink-0">
              Refresh
            </button>
          </div>
          {logsLoading ? (
            <LoadingSpinner className="h-6 w-6" label="" />
          ) : auditLogs.length === 0 ? (
            <EmptyState title="No events yet" description="Sign-in and security events will appear here." />
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs text-gray-500 font-medium pb-2 px-2">Event</th>
                    <th className="text-left text-xs text-gray-500 font-medium pb-2 px-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 px-2 text-gray-800 text-xs">
                        {EVENT_LABELS[log.event_type] ?? log.event_type}
                      </td>
                      <td className="py-2 px-2 text-gray-500 text-xs whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
