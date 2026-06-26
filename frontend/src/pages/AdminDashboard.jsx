import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { getPendingBorrowings, getPendingReturnBorrowings, getAllBorrowings, approveBorrowing, rejectBorrowing, confirmReturn, getBooks, addBook, updateBook, deleteBook, getAllUsers, getBorrowingCountsByUserIds, updateUserCreditScore } from '../lib/api'
import { getCreditTier, getBorrowLimit, formatProfileName } from '../lib/credit'
import { formatDate } from '../lib/format'
import { AdminShell } from '../components/layout/AdminShell'
import { supabase } from '../lib/supabaseClient'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import { Button } from '../components/ui/Button'
import { TextInput } from '../components/ui/TextInput'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusBadge } from '../components/ui/StatusBadge'

const VALID_TABS = new Set(['pending', 'returns', 'all', 'books', 'users'])

const IDLE_MS = 15 * 60 * 60 * 1000
const WARNING_MS = 60 * 1000

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { signOut } = useAuth()

  const [pendingBorrowings, setPendingBorrowings] = useState([])
  const [pendingReturnBorrowings, setPendingReturnBorrowings] = useState([])
  const [allBorrowings, setAllBorrowings] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionStatus, setActionStatus] = useState({})
  const currentTab = searchParams.get('tab')
  const activeTab = VALID_TABS.has(currentTab) ? currentTab : 'pending'
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
    const { data: borrowCounts } = await getBorrowingCountsByUserIds(userIds)
    setUsersList(
      profiles.map((u) => ({
        ...u,
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

  const statusBadge = (status) => <StatusBadge status={status} />

  return (
    <AdminShell title="Admin Dashboard">
      <ConfirmModal
        open={!!confirmAction}
        title={`${confirmActionLabel}?`}
        description={confirmActionDesc}
        confirmLabel={confirmActionLabel}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
        confirmVariant={confirmAction?.type === 'reject' ? 'danger' : 'primary'}
        loading={confirmAction && actionStatus[confirmAction.borrowing?.id] === 'loading'}
      />

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Pending Requests"
            value={loading ? '…' : String(pendingBorrowings.length)}
            variant="yellow"
            icon="clock"
            prominent
          />
          <StatCard
            label="Return Requests"
            value={loading ? '…' : String(pendingReturnBorrowings.length)}
            variant="blue"
            icon="return"
            prominent
          />
          <StatCard
            label="Active Borrowings"
            value={loading ? '…' : String(allBorrowings.filter(b => b.status === 'active').length)}
            variant="green"
            icon="book"
            prominent
          />
          <StatCard
            label="Total Borrowings"
            value={loading ? '…' : String(allBorrowings.length)}
            variant="gray"
            icon="clipboard"
            prominent
          />
        </div>

        <div className="flex gap-2 flex-wrap">
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

        <div className="min-h-[200px]">
        {loading && (activeTab === 'pending' || activeTab === 'returns' || activeTab === 'all') && (
          <LoadingSpinner label="Loading borrowings…" />
        )}

        {!loading && activeTab === 'pending' && (
          pendingBorrowings.length === 0 ? (
            <Card><EmptyState title="No pending requests" description="New borrow requests will appear here." /></Card>
          ) : (
            <div className="grid gap-4">
              {pendingBorrowings.map((borrowing) => (
                <Card key={borrowing.id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
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
                  <div className="flex gap-2 shrink-0 flex-wrap">
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
            <Card><EmptyState title="No return requests" description="User return requests will appear here." /></Card>
          ) : (
            <div className="grid gap-4">
              {pendingReturnBorrowings.map((borrowing) => (
                <Card key={borrowing.id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
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
                  <div className="flex gap-2 shrink-0 items-center flex-wrap">
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
              <Card><EmptyState title="No borrowings yet" /></Card>
            ) : (
              allBorrowings.map((borrowing) => (
                <Card key={borrowing.id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
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
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
              <LoadingSpinner label="Loading books…" />
            ) : books.length === 0 ? (
              <Card><EmptyState title="No books in the library" description="Add your first book to get started." /></Card>
            ) : (
              <div className="grid gap-3">
                {books.map(book => (
                  <Card key={book.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
              <LoadingSpinner label="Loading users…" />
            ) : usersList.length === 0 ? (
              <Card><EmptyState title="No users found" description="Registered users will appear here after section 7 SQL is applied." /></Card>
            ) : (
              <div className="space-y-3 overflow-x-auto">
                <div className="hidden md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 min-w-[640px]">
                  <span>User</span>
                  <span>Contact</span>
                  <span>Borrowings</span>
                  <span>Credit</span>
                  <span className="text-right">Actions</span>
                </div>
                {usersList.map((usr) => {
                  const displayName = formatProfileName(usr)
                  const email = usr.email?.trim() || null
                  const score = usr.credit_score ?? 100
                  const tier = getCreditTier(score)
                  const stats = usr.borrowStats ?? { active: 0, return_pending: 0, pending: 0, total: 0 }
                  const openLoans = stats.active + stats.return_pending + stats.pending
                  const primaryLabel = displayName || email || `User ${usr.id.slice(0, 8)}…`

                  return (
                    <Card key={usr.id}>
                      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center min-w-0 md:min-w-[640px]">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900 truncate">
                              {primaryLabel}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${
                              usr.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {usr.role || 'user'}
                            </span>
                          </div>
                          {displayName && email && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{email}</p>
                          )}
                          {!email && (
                            <p className="text-xs text-gray-400 mt-0.5">ID: {usr.id.slice(0, 8)}…</p>
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
                            {email || (
                              <span className="text-gray-400 italic" title="No email in Auth, borrowings, or audit logs">
                                Not on file
                              </span>
                            )}
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
        </div>
      </div>

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
                Adjusting this will change the user&apos;s maximum book borrowing capacity.
              </p>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <Button onClick={handleCreditUpdateSubmit}>Save Score</Button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
