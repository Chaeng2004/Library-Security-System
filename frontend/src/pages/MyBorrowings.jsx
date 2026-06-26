import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserBorrowings, requestReturn } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export default function MyBorrowings() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  
  const [borrowings, setBorrowings] = useState([])
  const [loading, setLoading] = useState(true)
  const [returnStatus, setReturnStatus] = useState({})

  const fetchBorrowings = useCallback(async () => {
    setLoading(true)
    const { data } = await getUserBorrowings(user.id)
    setBorrowings(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBorrowings()
  }, [fetchBorrowings])

  const handleRequestReturn = async (borrowingId) => {
    setReturnStatus(prev => ({ ...prev, [borrowingId]: 'loading' }))
    const { error } = await requestReturn(borrowingId)
    
    if (error) {
      setReturnStatus(prev => ({ ...prev, [borrowingId]: 'error' }))
      alert('Failed to request return: ' + error.message)
    } else {
      setReturnStatus(prev => ({ ...prev, [borrowingId]: 'success' }))
      fetchBorrowings()
      setTimeout(() => {
        setReturnStatus(prev => ({ ...prev, [borrowingId]: null }))
      }, 2000)
    }
  }

  const handleLogout = async () => {
    await signOut('user')
    navigate('/login', { replace: true })
  }

  const activeBorrowings = borrowings.filter(b => b.status === 'active')
  const returnPendingBorrowings = borrowings.filter(b => b.status === 'return_pending')
  const pendingBorrowings = borrowings.filter(b => b.status === 'pending')
  const returnedBorrowings = borrowings.filter(b => b.status === 'returned')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Library System</h1>
            <p className="text-sm text-gray-500">My Borrowings</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            Dashboard
          </button>
          <button
            onClick={() => navigate('/books')}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            Browse Books
          </button>
          <button
            onClick={() => navigate('/my-borrowings')}
            className="px-4 py-2 text-sm font-medium text-gray-900 bg-gray-100 rounded-md"
          >
            My Borrowings ({activeBorrowings.length + returnPendingBorrowings.length})
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            Profile
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-gray-900 rounded-full"></div>
          </div>
        ) : (
          <>
            {/* Pending Borrowings */}
            <div className="mb-12">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Pending Requests</h2>
              {pendingBorrowings.length === 0 ? (
                <Card className="text-center py-8">
                  <p className="text-gray-500">No pending requests</p>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {pendingBorrowings.map((borrowing) => (
                    <Card key={borrowing.id} className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {borrowing.books?.title || 'Unknown Book'}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {borrowing.books?.author || 'Unknown Author'}
                        </p>
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>Requested: {formatDate(borrowing.borrowed_date)}</p>
                          {borrowing.due_date && <p>Due: {formatDate(borrowing.due_date)}</p>}
                        </div>
                      </div>
                      <span className="ml-4 px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pending Approval
                      </span>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Return pending — awaiting admin confirmation */}
            {returnPendingBorrowings.length > 0 && (
              <div className="mb-12">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Return Pending Confirmation</h2>
                <div className="grid gap-4">
                  {returnPendingBorrowings.map((borrowing) => (
                    <Card key={borrowing.id} className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {borrowing.books?.title || 'Unknown Book'}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {borrowing.books?.author || 'Unknown Author'}
                        </p>
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>Borrowed: {formatDate(borrowing.borrowed_date)}</p>
                          {borrowing.due_date && <p>Due: {formatDate(borrowing.due_date)}</p>}
                        </div>
                      </div>
                      <span className="ml-4 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Awaiting Admin
                      </span>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Active Borrowings */}
            <div className="mb-12">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Active Borrowings</h2>
              {activeBorrowings.length === 0 ? (
                <Card className="text-center py-8">
                  <p className="text-gray-500">No active borrowings</p>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {activeBorrowings.map((borrowing) => (
                    <Card key={borrowing.id} className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {borrowing.books?.title || 'Unknown Book'}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {borrowing.books?.author || 'Unknown Author'}
                        </p>
                        <div className="text-xs text-gray-500 space-y-1">
                          <p>Borrowed: {formatDate(borrowing.borrowed_date)}</p>
                          {borrowing.due_date && <p>Due: {formatDate(borrowing.due_date)}</p>}
                          <p>ISBN: {borrowing.books?.isbn || 'N/A'}</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleRequestReturn(borrowing.id)}
                        loading={returnStatus[borrowing.id] === 'loading'}
                        variant={returnStatus[borrowing.id] === 'success' ? 'secondary' : 'primary'}
                        className="ml-4"
                      >
                        {returnStatus[borrowing.id] === 'success' ? '✓ Requested' : 'Request Return'}
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Returned Books History */}
            {returnedBorrowings.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Return History</h2>
                <div className="grid gap-4">
                  {returnedBorrowings.map((borrowing) => (
                    <Card key={borrowing.id} className="opacity-75">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {borrowing.books?.title || 'Unknown Book'}
                          </h3>
                          <p className="text-sm text-gray-600 mb-2">
                            {borrowing.books?.author || 'Unknown Author'}
                          </p>
                          <div className="text-xs text-gray-500 space-y-1">
                            <p>Borrowed: {formatDate(borrowing.borrowed_date)}</p>
                            <p>Returned: {formatDate(borrowing.returned_date)}</p>
                          </div>
                        </div>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          Returned
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
