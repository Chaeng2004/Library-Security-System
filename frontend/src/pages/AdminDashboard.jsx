import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { getPendingBorrowings, getAllBorrowings, approveBorrowing, rejectBorrowing, returnBook, getBooks, addBook, updateBook, deleteBook, getAllUsers, getUserEmailsByIds, updateUserCreditScore } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { TextInput } from '../components/ui/TextInput'

const VALID_TABS = new Set(['pending', 'all', 'books', 'users'])

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
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

const IDLE_MS = 15 * 60 * 60 * 1000
const WARNING_MS = 60 * 1000

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, signOut } = useAuth()

  const [pendingBorrowings, setPendingBorrowings] = useState([])
  const [allBorrowings, setAllBorrowings] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionStatus, setActionStatus] = useState({})
  const currentTab = searchParams.get('tab')
  const activeTab = VALID_TABS.has(currentTab) ? currentTab : 'pending'
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  // Books management state
  const [books, setBooks] = useState([])
  const [booksLoading, setBooksLoading] = useState(false)
  const [bookForm, setBookForm] = useState({ title: '', author: '', isbn: '', description: '', available: true, cover_url: '' })
  const [editingBook, setEditingBook] = useState(null) // null = create mode, object = edit mode
  const [showBookForm, setShowBookForm] = useState(false)
  const [bookActionStatus, setBookActionStatus] = useState('')

  // Users management state
  const [usersList, setUsersList] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [creditFormScore, setCreditFormScore] = useState(100)

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    const [pending, all] = await Promise.all([getPendingBorrowings(), getAllBorrowings()])
    setPendingBorrowings(pending.data || [])
    setAllBorrowings(all.data || [])
    setLoading(false)
  }, [])

  const fetchBooks = useCallback(async (showLoading = false) => {
    if (showLoading) setBooksLoading(true)
    const { data } = await getBooks()
    setBooks(data || [])
    setBooksLoading(false)
  }, [])

  const fetchUsers = useCallback(async (showLoading = false) => {
    if (showLoading) setUsersLoading(true)
    const { data } = await getAllUsers()
    const profiles = data || []
    const { data: emailMap } = await getUserEmailsByIds(profiles.map((u) => u.id))
    setUsersList(
      profiles.map((u) => ({
        ...u,
        email: u.email || emailMap?.[u.id] || null,
      }))
    )
    setUsersLoading(false)
  }, [])

  const setTab = (tab) => {
    const next = new URLSearchParams(searchParams)
    if (tab === 'pending') next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(false) }, [fetchData])
  useEffect(() => { 
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeTab === 'books') fetchBooks(false) 
    else if (activeTab === 'users') fetchUsers(false)
  }, [activeTab, fetchBooks, fetchUsers])

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
    } else if (type === 'reject') {
      const { error } = await rejectBorrowing(borrowing.id)
      if (error) {
        setActionStatus(prev => ({ ...prev, [borrowing.id]: 'error' }))
        alert('Failed to reject: ' + error.message)
      } else {
        fetchData()
      }
    } else if (type === 'return') {
      const { error } = await returnBook(borrowing.id, borrowing.book_id)
      if (error) {
        setActionStatus(prev => ({ ...prev, [borrowing.id]: 'error' }))
        alert('Failed to mark as returned: ' + error.message)
      } else {
        fetchData()
      }
    }
  }

  const confirmActionLabel = confirmAction?.type === 'approve' ? 'Approve'
    : confirmAction?.type === 'reject' ? 'Reject'
    : 'Mark as Returned'
  const confirmActionDesc = confirmAction?.type === 'approve'
    ? 'This will mark the borrowing as active and make the book unavailable.'
    : confirmAction?.type === 'reject'
    ? 'This will permanently delete the borrowing request.'
    : 'This will mark the book as returned and make it available again.'

  const handleBookFormSubmit = async () => {
    if (!bookForm.title.trim() || !bookForm.author.trim()) {
      setBookActionStatus('Title and author are required.')
      return
    }
    setBookActionStatus('saving')
    if (editingBook) {
      const { error } = await updateBook(editingBook.id, bookForm)
      if (error) { setBookActionStatus('Error: ' + error.message); return }
    } else {
      const { error } = await addBook(bookForm)
      if (error) { setBookActionStatus('Error: ' + error.message); return }
    }
    setBookActionStatus('')
    setShowBookForm(false)
    setEditingBook(null)
    setBookForm({ title: '', author: '', isbn: '', description: '', available: true, cover_url: '' })
    fetchBooks()
  }

  const handleDeleteBook = async (id) => {
    if (!window.confirm('Delete this book? This cannot be undone.')) return
    const { error } = await deleteBook(id)
    if (error) { alert('Failed to delete: ' + error.message); return }
    fetchBooks()
  }

  const openEditBook = (book) => {
    setEditingBook(book)
    setBookForm({ title: book.title, author: book.author, isbn: book.isbn || '', description: book.description || '', available: book.available, cover_url: book.cover_url || '' })
    setShowBookForm(true)
  }

  const handleCreditUpdateSubmit = async () => {
    if (creditFormScore < 0 || creditFormScore > 200) {
      alert('Credit score must be between 0 and 200')
      return
    }
    const { error } = await updateUserCreditScore(editingUser.id, creditFormScore)
    if (error) {
      alert('Failed to update credit score: ' + error.message)
    } else {
      setEditingUser(null)
      fetchUsers(false)
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
              {confirmActionLabel}?
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {confirmActionDesc}
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
                  confirmAction.type === 'approve' ? 'bg-gray-900 hover:bg-gray-700'
                  : confirmAction.type === 'return' ? 'bg-gray-900 hover:bg-gray-700'
                  : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmActionLabel}
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
            onClick={() => navigate('/admin/books')}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            Manage Books
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            Profile
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
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setTab('pending')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'pending' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            Pending Requests ({pendingBorrowings.length})
          </button>
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            All Borrowings
          </button>
          <button
            onClick={() => setTab('books')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'books' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            Manage Books
          </button>
          <button
            onClick={() => setTab('users')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'users' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            Users & Credits
          </button>
        </div>

        {loading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-gray-900 rounded-full"></div>
          </div>
        )}

        {!loading && activeTab === 'pending' && (
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
                  <div className="flex gap-2 shrink-0">
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
        )}

        {!loading && activeTab === 'all' && (
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
                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge(borrowing.status)}
                    {borrowing.status === 'active' && (
                      <button
                        onClick={() => setConfirmAction({ type: 'return', borrowing })}
                        disabled={actionStatus[borrowing.id] === 'loading'}
                        className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
                      >
                        Mark Returned
                      </button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {!loading && activeTab === 'books' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Books ({books.length})</h2>
              <Button onClick={() => { setEditingBook(null); setBookForm({ title: '', author: '', isbn: '', description: '', available: true, cover_url: '' }); setShowBookForm(true) }}>
                Add Book
              </Button>
            </div>

            {showBookForm && (
              <Card className="mb-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">{editingBook ? 'Edit Book' : 'New Book'}</h3>
                <div className="grid gap-3">
                  <TextInput
                    label="Title"
                    value={bookForm.title}
                    onChange={e => setBookForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="Book title"
                  />
                  <TextInput
                    label="Author"
                    value={bookForm.author}
                    onChange={e => setBookForm(p => ({ ...p, author: e.target.value }))}
                    placeholder="Author name"
                  />
                  <TextInput
                    label="ISBN"
                    value={bookForm.isbn}
                    onChange={e => setBookForm(p => ({ ...p, isbn: e.target.value }))}
                    placeholder="ISBN (optional)"
                  />
                  <TextInput
                    label="Cover URL"
                    value={bookForm.cover_url}
                    onChange={e => setBookForm(p => ({ ...p, cover_url: e.target.value }))}
                    placeholder="https://... (optional)"
                  />
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
                    <textarea
                      value={bookForm.description}
                      onChange={e => setBookForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Book description (optional)"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bookForm.available}
                      onChange={e => setBookForm(p => ({ ...p, available: e.target.checked }))}
                      className="rounded"
                    />
                    Available for borrowing
                  </label>
                  {bookActionStatus && bookActionStatus !== 'saving' && (
                    <p className="text-xs text-red-600">{bookActionStatus}</p>
                  )}
                  <div className="flex gap-3 pt-2">
                    <Button onClick={handleBookFormSubmit} loading={bookActionStatus === 'saving'}>
                      {editingBook ? 'Save Changes' : 'Add Book'}
                    </Button>
                    <Button variant="secondary" onClick={() => { setShowBookForm(false); setEditingBook(null); setBookActionStatus('') }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {booksLoading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-gray-900 rounded-full" />
              </div>
            ) : books.length === 0 ? (
              <Card className="text-center py-12">
                <p className="text-gray-500">No books in the library yet.</p>
              </Card>
            ) : (
              <div className="grid gap-3">
                {books.map(book => (
                  <Card key={book.id} className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{book.title}</p>
                      <p className="text-xs text-gray-500">{book.author} {book.isbn ? `— ${book.isbn}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        book.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {book.available ? 'Available' : 'Borrowed'}
                      </span>
                      <button
                        onClick={() => openEditBook(book)}
                        className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteBook(book.id)}
                        className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Registered Users ({usersList.length})</h2>
            </div>
            
            {usersLoading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-gray-900 rounded-full" />
              </div>
            ) : usersList.length === 0 ? (
              <Card className="text-center py-12">
                <p className="text-gray-500">No users found.</p>
              </Card>
            ) : (
              <div className="grid gap-3">
                {usersList.map(usr => (
                  <Card key={usr.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {usr.first_name || usr.last_name ? `${usr.first_name} ${usr.last_name}` : 'No Profile Name'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          usr.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {usr.role}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Email: {usr.email || 'Unavailable'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Library ID: {usr.library_id || 'N/A'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">User ID: {usr.id}</p>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <span className="text-xs text-gray-500 block">Credit Score</span>
                        <span className="text-sm font-bold text-gray-900 block mt-0.5">{usr.credit_score ?? 100} / 200</span>
                      </div>
                      <button
                        onClick={() => {
                          setEditingUser(usr)
                          setCreditFormScore(usr.credit_score ?? 100)
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
                      >
                        Adjust Credit
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Edit Credit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-base font-bold text-gray-900">Adjust Credit Score</h2>
            <p className="mt-2 text-xs text-gray-500">
              User: <span className="font-semibold text-gray-700">{editingUser.first_name || editingUser.last_name ? `${editingUser.first_name} ${editingUser.last_name}` : editingUser.id}</span>
            </p>
            
            <div className="my-5">
              <label className="text-xs font-medium text-gray-700 block mb-1">
                Credit Score (0 - 200)
              </label>
              <input
                type="number"
                min="0"
                max="200"
                value={creditFormScore}
                onChange={e => setCreditFormScore(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Adjusting this will change the user's maximum book borrowing capacity.
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <Button onClick={handleCreditUpdateSubmit}>
                Save Score
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
