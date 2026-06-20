import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { getPendingBorrowings, getAllBorrowings, approveBorrowing, rejectBorrowing } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

function formatSeconds(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

const IDLE_MS = 15 * 60 * 1000
const WARNING_MS = 60 * 1000

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [pendingBorrowings, setPendingBorrowings] = useState([])
  const [allBorrowings, setAllBorrowings] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionStatus, setActionStatus] = useState({})
  const [activeTab, setActiveTab] = useState('pending')
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // { type: 'approve'|'reject', borrowing }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [pending, all] = await Promise.all([getPendingBorrowings(), getAllBorrowings()])
    setPendingBorrowings(pending.data || [])
    setAllBorrowings(all.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleTimeout = useCallback(async () => {
    await signOut('timeout')
    navigate('/login', { replace: true })
  }, [signOut, navigate])

  const { secondsLeft, isWarning } = useIdleTimeout(handleTimeout, IDLE_MS, WARNING_MS)

  const handleApprove = async (borrowing) => {
    setConfirmAction({ type: 'approve', borrowing })
  }

  const handleReject = async (borrowingId) => {
    setConfirmAction({ type: 'reject', borrowing: { id: borrowingId } })
  }

  const handleConfirmAction = async () => {
    const { type, borrowing } = confirmAction
    setConfirmAction(null)
    setActionStatus(prev => ({ ...prev, [borrowing.id]: 'loading' }))

    if (type === 'approve') {
      const { error } = await approveBorrowing(borrowing.id, borrowing.book_id)
      if (error) {
        setActionStatus(prev => ({ ...prev, [borrowing.id]: 'error' }))
        alert('Failed to approve: ' + error.message)
      } else {
        setActionStatus(prev => ({ ...prev, [borrowing.id]: 'approved' }))
        fetchData()
      }
    } else {
      const { error } = await rejectBorrowing(borrowing.id)
      if (error) {
        setActionStatus(prev => ({ ...prev, [borrowing.id]: 'error' }))
        alert('Failed to reject: ' + error.message)
      } else {
        fetchData()
      }
    }
  }

  const statusBadge = (status) => {
    const map = {
      pending: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      returned: 'bg-gray-100 text-gray-800',
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-base font-semibold text-gray-900">
              {confirmAction.type === 'approve' ? 'Approve request?' : 'Reject request?'}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {confirmAction.type === 'approve'
                ? 'This will mark the borrowing as active and make the book unavailable.'
                : 'This will permanently delete the borrowing request.'}
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition ${
                  confirmAction.type === 'approve' ? 'bg-gray-900 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmAction.type === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
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
              <Button onClick={async () => { setShowLogoutConfirm(false); await signOut('user'); navigate('/login', { replace: true }) }}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}
      {isWarning && (
        <div className="bg-gray-900 text-white text-sm text-center py-2 px-4">
          Session expires in{' '}
          <span className="font-semibold tabular-nums">{formatSeconds(secondsLeft)}</span>
          {' '}due to inactivity.
        </div>
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Library System</h1>
            <p className="text-sm text-gray-500">Admin Dashboard</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm font-medium text-gray-900 hidden sm:block">{user?.email}</p>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex gap-4">
          <button
            onClick={() => navigate('/admin')}
            className="px-4 py-2 text-sm font-medium text-gray-900 bg-gray-100 rounded-md"
          >
            Admin Dashboard
          </button>
          <button
            onClick={() => navigate('/books')}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            Browse Books
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <p className="text-xs text-gray-500">Pending Requests</p>
            <p className="text-3xl font-bold text-yellow-600 mt-1">{pendingBorrowings.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Active Borrowings</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {allBorrowings.filter(b => b.status === 'active').length}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Total Borrowings</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{allBorrowings.length}</p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'pending' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            Pending Requests ({pendingBorrowings.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            All Borrowings
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-gray-900 rounded-full"></div>
          </div>
        ) : activeTab === 'pending' ? (
          pendingBorrowings.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-500">No pending requests</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingBorrowings.map((borrowing) => (
                <Card key={borrowing.id} className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900">
                      {borrowing.books?.title || 'Unknown Book'}
                    </h3>
                    <p className="text-sm text-gray-600">{borrowing.books?.author || 'Unknown Author'}</p>
                    <div className="mt-2 text-xs text-gray-500 space-y-1">
                      <p>Requested by: <span className="font-medium text-gray-700">{borrowing.user_email}</span></p>
                      <p>Requested: {formatDate(borrowing.borrowed_date)}</p>
                      <p>Due: {formatDate(borrowing.due_date)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      onClick={() => handleApprove(borrowing)}
                      loading={actionStatus[borrowing.id] === 'loading'}
                      variant="primary"
                      className="text-sm"
                    >
                      Approve
                    </Button>
                    <button
                      onClick={() => handleReject(borrowing.id)}
                      disabled={actionStatus[borrowing.id] === 'loading'}
                      className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : (
          <div className="grid gap-4">
            {allBorrowings.length === 0 ? (
              <Card className="text-center py-12">
                <p className="text-gray-500">No borrowings yet</p>
              </Card>
            ) : (
              allBorrowings.map((borrowing) => (
                <Card key={borrowing.id} className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900">
                      {borrowing.books?.title || 'Unknown Book'}
                    </h3>
                    <p className="text-sm text-gray-600">{borrowing.books?.author || 'Unknown Author'}</p>
                    <div className="mt-2 text-xs text-gray-500 space-y-1">
                      <p>User: <span className="font-medium text-gray-700">{borrowing.user_email}</span></p>
                      <p>Borrowed: {formatDate(borrowing.borrowed_date)}</p>
                      <p>Due: {formatDate(borrowing.due_date)}</p>
                      {borrowing.returned_date && <p>Returned: {formatDate(borrowing.returned_date)}</p>}
                    </div>
                  </div>
                  {statusBadge(borrowing.status)}
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}
