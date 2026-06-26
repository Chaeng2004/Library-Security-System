import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { getPendingBorrowings, getPendingReturnBorrowings, getAllBorrowings, approveBorrowing, rejectBorrowing, confirmReturn, getBooks, addBook, updateBook, deleteBook, getAllUsers, getUserEmailsByIds, getBorrowingCountsByUserIds, updateUserCreditScore } from '../lib/api'
import { getCreditTier, getBorrowLimit, formatProfileName } from '../lib/credit'
import { supabase } from '../lib/supabaseClient'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { TextInput } from '../components/ui/TextInput'

const VALID_TABS = new Set(['pending', 'returns', 'all', 'books', 'users'])

function formatDate(dateString) {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

const IDLE_MS = 15 * 60 * 60 * 1000
const WARNING_MS = 60 * 1000

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, signOut } = useAuth()

  const [pendingBorrowings, setPendingBorrowings] = useState([])
  const [pendingReturnBorrowings, setPendingReturnBorrowings] = useState([])
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
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)

  // Users management state
  const [usersList, setUsersList] = useState([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [creditFormScore, setCreditFormScore] = useState(100)

  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    const [pending, returns, all] = await Promise.all([
      getPendingBorrowings(),
      getPendingReturnBorrowings(),
      getAllBorrowings(),
    ])
    setPendingBorrowings(pending.data || [])
    setPendingReturnBorrowings(returns.data || [])
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
    const userIds = profiles.map((u) => u.id)
    const [{ data: emailMap }, { data: borrowCounts }] = await Promise.all([
      getUserEmailsByIds(userIds),
      getBorrowingCountsByUserIds(userIds),
    ])
    setUsersList(
      profiles.map((u) => ({
        ...u,
        email: emailMap?.[u.id] || null,
        borrowStats: borrowCounts?.[u.id] ?? { active: 0, return_pending: 0, pending: 0, total: 0 },
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

  const { secondsLeft } = useIdleTimeout(handleTimeout, IDLE_MS, WARNING_MS)

  useEffect(() => {
    sessionStorage.setItem('sessionIdleSecondsLeft', secondsLeft)
  }, [secondsLeft])

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
      const { error } = await confirmReturn(borrowing.id, borrowing.book_id)
      if (error) {
        setActionStatus(prev => ({ ...prev, [borrowing.id]: 'error' }))
        alert('Failed to confirm return: ' + error.message)
      } else {
        fetchData()
      }
    }
  }

  const confirmActionLabel = confirmAction?.type === 'approve' ? 'Approve'
    : confirmAction?.type === 'reject' ? 'Reject'
    : 'Confirm Return'
  const confirmActionDesc = confirmAction?.type === 'approve'
    ? 'This will mark the borrowing as active and make the book unavailable.'
    : confirmAction?.type === 'reject'
    ? 'This will permanently delete the borrowing request.'
    : 'Confirm the user has physically returned this book. Credit score will be updated and the book will become available again.'

  const handleBookFormSubmit = async () => {
    if (!bookForm.title.trim() || !bookForm.author.trim()) {
      setBookActionStatus('Title and author are required.')
      return
    }
    setBookActionStatus('saving')
    let cover_url = bookForm.cover_url
    if (coverFile) {
      const ext = coverFile.name.split('.').pop()
      const path = `covers/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('book-covers').upload(path, coverFile, { upsert: true })
      if (uploadError) { setBookActionStatus('Error: ' + uploadError.message); return }
      cover_url = supabase.storage.from('book-covers').getPublicUrl(path).data.publicUrl
    }
    if (editingBook) {
      const { error } = await updateBook(editingBook.id, { ...bookForm, cover_url })
      if (error) { setBookActionStatus('Error: ' + error.message); return }
    } else {
      const { error } = await addBook({ ...bookForm, cover_url })
      if (error) { setBookActionStatus('Error: ' + error.message); return }
    }
    setBookActionStatus('')
    setShowBookForm(false)
    setEditingBook(null)
    setBookForm({ title: '', author: '', isbn: '', description: '', available: true, cover_url: '' })
    setCoverFile(null)
    setCoverPreview(null)
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
    setCoverFile(null)
    setCoverPreview(book.cover_url || null)
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
      return_pending: 'bg-blue-100 text-blue-800',
      returned: 'bg-gray-100 text-gray-800',
    }
    const labels = {
      pending: 'Pending',
      active: 'Active',
      return_pending: 'Return pending',
      returned: 'Returned',
    }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-800'}`}>
        {labels[status] ?? status}
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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <Card>
            <p className="text-xs text-gray-500">Pending Requests</p>
            <p className="text-3xl font-bold text-yellow-600 mt-1">{pendingBorrowings.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Return Requests</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{pendingReturnBorrowings.length}</p>
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
            onClick={() => setTab('returns')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'returns' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            Return Requests ({pendingReturnBorrowings.length})
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

        {!loading && activeTab === 'returns' && (
          pendingReturnBorrowings.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-500">No pending return requests</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingReturnBorrowings.map((borrowing) => (
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
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 items-center">
                    {statusBadge(borrowing.status)}
                    <Button
                      onClick={() => setConfirmAction({ type: 'return', borrowing })}
                      loading={actionStatus[borrowing.id] === 'loading'}
                      variant="primary"
                      className="text-sm"
                    >
                      Confirm Return
                    </Button>
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
                    {borrowing.status === 'return_pending' && (
                      <button
                        onClick={() => setConfirmAction({ type: 'return', borrowing })}
                        disabled={actionStatus[borrowing.id] === 'loading'}
                        className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
                      >
                        Confirm Return
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
              <Button onClick={() => { setEditingBook(null); setBookForm({ title: '', author: '', isbn: '', description: '', available: true, cover_url: '' }); setCoverFile(null); setCoverPreview(null); setShowBookForm(true) }}>
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
                    onChange={e => {
                      setBookForm(p => ({ ...p, cover_url: e.target.value }))
                      if (!coverFile) setCoverPreview(e.target.value || null)
                    }}
                    placeholder="https://... (optional)"
                  />
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Upload Cover Image <span className="text-gray-400 font-normal">(optional)</span></label>
                    {coverPreview && (
                      <div className="mb-2 w-16 h-24 rounded-md overflow-hidden bg-gray-50 border border-gray-200">
                        <img src={coverPreview} alt="Preview" className="w-full h-full object-contain" />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files[0]
                        if (!file) return
                        setCoverFile(file)
                        setCoverPreview(URL.createObjectURL(file))
                      }}
                      className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                    />
                  </div>
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
              <div>
                <h2 className="text-base font-semibold text-gray-900">Users & Credit ({usersList.length})</h2>
                <p className="text-xs text-gray-500 mt-0.5">Profiles, borrowing activity, and credit tiers</p>
              </div>
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
              <div className="space-y-3">
                <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <span>User</span>
                  <span>Contact</span>
                  <span>Borrowings</span>
                  <span>Credit</span>
                  <span className="text-right">Actions</span>
                </div>
                {usersList.map((usr) => {
                  const displayName = formatProfileName(usr)
                  const score = usr.credit_score ?? 100
                  const tier = getCreditTier(score)
                  const stats = usr.borrowStats ?? { active: 0, return_pending: 0, pending: 0, total: 0 }
                  const openLoans = stats.active + stats.return_pending + stats.pending

                  return (
                    <Card key={usr.id} className="p-4">
                      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 truncate">
                              {displayName || usr.email || `User ${usr.id.slice(0, 8)}…`}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${
                              usr.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {usr.role || 'user'}
                            </span>
                          </div>
                          {displayName && usr.email && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{usr.email}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            Library ID: {usr.library_id?.trim() ? usr.library_id : 'Not set'}
                            {usr.created_at && (
                              <> · Joined {formatDate(usr.created_at)}</>
                            )}
                          </p>
                        </div>

                        <div className="text-xs text-gray-600 space-y-0.5">
                          <p>
                            <span className="text-gray-400">Email: </span>
                            {usr.email || <span className="text-gray-400 italic">Unknown</span>}
                          </p>
                          {usr.phone?.trim() && (
                            <p><span className="text-gray-400">Phone: </span>{usr.phone}</p>
                          )}
                        </div>

                        <div className="text-xs text-gray-600 space-y-0.5">
                          <p><span className="text-gray-400">Active: </span><span className="font-medium text-gray-900">{stats.active}</span></p>
                          <p><span className="text-gray-400">Pending: </span>{stats.pending + stats.return_pending}</p>
                          <p><span className="text-gray-400">Total: </span>{stats.total}</p>
                          <p><span className="text-gray-400">Limit: </span>{getBorrowLimit(score)} books ({openLoans} open)</p>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-900">{score}</span>
                            <span className="text-xs text-gray-400">/ 200</span>
                          </div>
                          <span className={`inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border ${tier.color}`}>
                            {tier.name}
                          </span>
                        </div>

                        <div className="flex md:justify-end">
                          <button
                            onClick={() => {
                              setEditingUser(usr)
                              setCreditFormScore(score)
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
                          >
                            Adjust Credit
                          </button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
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
              {formatProfileName(editingUser) || editingUser.email || `User ${editingUser.id.slice(0, 8)}…`}
            </p>
            {editingUser.email && formatProfileName(editingUser) && (
              <p className="text-xs text-gray-400">{editingUser.email}</p>
            )}
            <p className="mt-1 text-xs">
              Current: <span className="font-semibold text-gray-700">{editingUser.credit_score ?? 100}</span>
              {' · '}
              <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${getCreditTier(editingUser.credit_score ?? 100).color}`}>
                {getCreditTier(editingUser.credit_score ?? 100).name}
              </span>
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
