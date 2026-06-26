import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../hooks/useToast'
import { getBooks, borrowBook, getUserBorrowings, getUserProfile } from '../lib/api'
import { resolveBookCoverSrc } from '../lib/bookCovers'
import { getMinDueDateString, validate, dueDateSchema } from '../lib/validation'
import { AppShell } from '../components/layout/AppShell'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { TextInput } from '../components/ui/TextInput'
import { CreditScoreCard } from '../components/ui/CreditScoreCard'
import { Skeleton } from '../components/ui/Skeleton'
import { BookCoverThumb } from '../components/ui/BookCoverThumb'
import { EmptyState } from '../components/ui/EmptyState'

const OPEN_BORROW_STATUSES = ['pending', 'active', 'return_pending']

function isOpenBorrowing(status) {
  return OPEN_BORROW_STATUSES.includes(status)
}

function isOverdueBorrowing(b) {
  return (b.status === 'active' || b.status === 'return_pending') && new Date(b.due_date) < new Date()
}

export default function Books() {
  const { user, role } = useAuth()
  const toast = useToast()
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [borrowingStatus, setBorrowingStatus] = useState({})
  const [borrowings, setBorrowings] = useState([])
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [detailBookId, setDetailBookId] = useState(null)
  const [dueDate, setDueDate] = useState('')
  const [dueDateError, setDueDateError] = useState('')
  const [creditScore, setCreditScore] = useState(100)

  const fetchBooks = useCallback(async (search = '', onlyAvailable = false) => {
    setLoading(true)
    const filters = {}
    if (search.trim()) filters.search = search
    if (onlyAvailable) filters.available = true
    const { data, error } = await getBooks(filters)
    if (!error) {
      setBooks(data || [])
    }
    setLoading(false)
  }, [])

  const fetchUserBorrowings = useCallback(async () => {
    if (!user?.id) return
    const [borrowingsData, profileData] = await Promise.all([
      getUserBorrowings(user.id),
      getUserProfile(user.id)
    ])
    setBorrowings(borrowingsData.data || [])
    if (profileData.data) {
      setCreditScore(profileData.data.credit_score ?? 100)
    }
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBooks()
    fetchUserBorrowings()
  }, [fetchBooks, fetchUserBorrowings])

  const handleSearch = async (value) => {
    setSearchTerm(value)
    if (value.trim()) {
      const { data } = await getBooks({ search: value, ...(availableOnly ? { available: true } : {}) })
      setBooks(data || [])
    } else {
      fetchBooks('', availableOnly)
    }
  }

  const handleAvailableToggle = () => {
    const next = !availableOnly
    setAvailableOnly(next)
    fetchBooks(searchTerm, next)
  }

  const handleBorrow = async (bookId) => {
    setSelectedBookId(bookId)
    setDueDateError('')
    // Default due date: today + 14 days (must still be after today)
    const d = new Date()
    d.setDate(d.getDate() + 14)
    setDueDate(d.toISOString().split('T')[0])
  }

  const handleConfirmBorrow = async () => {
    const { errors } = validate(dueDateSchema, dueDate)
    if (errors) {
      setDueDateError(errors.dueDate ?? errors._ ?? 'Invalid due date')
      return
    }
    setDueDateError('')

    // Prevent duplicate requests
    const alreadyRequested = borrowings.some(
      b => b.book_id === selectedBookId && isOpenBorrowing(b.status)
    )
    if (alreadyRequested) {
      toast.error('You already have a pending or active request for this book.')
      setSelectedBookId(null)
      setDueDate('')
      return
    }

    setBorrowingStatus(prev => ({ ...prev, [selectedBookId]: 'loading' }))
    const { error } = await borrowBook(selectedBookId, user.id, dueDate)
    
    if (error) {
      setBorrowingStatus(prev => ({ ...prev, [selectedBookId]: 'error' }))
      toast.error('Failed to request book: ' + error.message)
    } else {
      setBorrowingStatus(prev => ({ ...prev, [selectedBookId]: 'success' }))
      toast.success('Borrow request submitted. Waiting for admin approval.')
      fetchBooks()
      fetchUserBorrowings()
      setSelectedBookId(null)
      setDueDate('')
      setTimeout(() => {
        setBorrowingStatus(prev => ({ ...prev, [selectedBookId]: null }))
      }, 2000)
    }
  }

  const minDueDate = getMinDueDateString()
  const openBorrowCount = borrowings.filter(b => b.status === 'active' || b.status === 'return_pending').length
  const openLoanCount = borrowings.filter(b => isOpenBorrowing(b.status)).length

  const hasFilters = searchTerm.trim() || availableOnly

  const clearFilters = () => {
    setSearchTerm('')
    setAvailableOnly(false)
    fetchBooks('', false)
  }

  const selectedBook = books.find(b => b.id === selectedBookId)

  return (
    <AppShell title="Browse Books" badges={{ borrowings: openBorrowCount }}>
      <div className="flex flex-col gap-6">
      {/* Date Picker Modal */}
      {selectedBookId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Due Date</h2>
            <p className="text-sm text-gray-600 mb-4">
              Book: <span className="font-medium">{selectedBook?.title}</span>
            </p>
            
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value)
                  setDueDateError('')
                }}
                min={minDueDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">
                Due date must be after today
              </p>
              {dueDateError && (
                <p className="text-xs text-red-600 mt-1">{dueDateError}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setSelectedBookId(null)
                  setDueDate('')
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <Button
                onClick={handleConfirmBorrow}
                loading={borrowingStatus[selectedBookId] === 'loading'}
                variant={borrowingStatus[selectedBookId] === 'success' ? 'secondary' : 'primary'}
              >
                {borrowingStatus[selectedBookId] === 'success' ? '✓ Requested' : 'Request Book'}
              </Button>
            </div>
          </div>
        </div>
      )}
        <Card>
          <CreditScoreCard
            score={creditScore}
            openLoans={openLoanCount}
            compact
          />
        </Card>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <TextInput
              placeholder="Search books by title or author..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full"
            />
          </div>
          <button
            onClick={handleAvailableToggle}
            className={`px-4 py-2 text-sm font-medium rounded-md border transition shrink-0 ${
              availableOnly
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {availableOnly ? 'Available only' : 'All books'}
          </button>
        </div>

        {/* Books Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Card key={i}>
                <div className="flex gap-4">
                  <Skeleton className="w-20 h-[120px] rounded-md shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : books.length === 0 ? (
          <Card>
            <EmptyState
              title={hasFilters ? 'No books match your search' : 'No books in the catalog'}
              description={hasFilters ? 'Try different keywords or filters.' : 'Check back later for new titles.'}
              action={hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-medium text-gray-900 underline underline-offset-2"
                >
                  Clear search & filters
                </button>
              ) : null}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => {
              const alreadyBorrowed = borrowings.some(
                b => b.book_id === book.id && isOpenBorrowing(b.status)
              )
              const maxBorrows = Math.floor(creditScore / 20)
              const currentBorrowsCount = borrowings.filter(b => isOpenBorrowing(b.status)).length
              const limitReached = currentBorrowsCount >= maxBorrows
              const hasOverdue = borrowings.some(isOverdueBorrowing)
              const isSuspended = maxBorrows <= 0

              let buttonDisabled = !book.available || role === 'admin' || alreadyBorrowed || limitReached || hasOverdue || isSuspended
              let buttonText = 'Request Book'

              if (role === 'admin') {
                buttonText = 'Admin View Only'
              } else if (alreadyBorrowed) {
                buttonText = 'Requested / Borrowed'
              } else if (!book.available) {
                buttonText = 'Not Available'
              } else if (hasOverdue) {
                buttonText = 'Blocked: Overdue Book'
              } else if (isSuspended) {
                buttonText = 'Blocked: Suspended Credit'
              } else if (limitReached) {
                buttonText = 'Blocked: Limit Reached'
              }

              return (
              <Card key={book.id} className="flex flex-col hover:shadow-md transition-shadow">
                <div 
                  className="flex gap-4 flex-1 min-h-0 mb-4 cursor-pointer"
                  onClick={() => setDetailBookId(book.id)}
                >
                  <BookCoverThumb book={book} size="md" />
                  <div className="flex-1 min-w-0 flex flex-col">
                    <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-2">
                      {book.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">{book.author}</p>
                    <p className="text-xs text-gray-500 mb-4 line-clamp-2">
                      {book.description || 'No description'}
                    </p>
                    <div className="flex justify-between items-center text-sm mt-auto">
                      <span className="text-xs text-gray-600">ISBN: {book.isbn || 'N/A'}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        book.available
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {book.available ? 'Available' : 'Borrowed'}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleBorrow(book.id)}
                  disabled={buttonDisabled}
                  loading={borrowingStatus[book.id] === 'loading'}
                  variant={
                    borrowingStatus[book.id] === 'success' ? 'secondary' :
                    buttonDisabled ? 'secondary' : 'primary'
                  }
                  className="w-full text-xs font-medium"
                >
                  {borrowingStatus[book.id] === 'success' ? 'Requested' : buttonText}
                </Button>
              </Card>
            )})}
          </div>
        )}

      {/* Book Details Modal */}
      {detailBookId && (() => {
        const book = books.find(b => b.id === detailBookId)
        if (!book) return null
        
        const alreadyBorrowed = borrowings.some(
          b => b.book_id === book.id && isOpenBorrowing(b.status)
        )
        const maxBorrows = Math.floor(creditScore / 20)
        const currentBorrowsCount = borrowings.filter(b => isOpenBorrowing(b.status)).length
        const limitReached = currentBorrowsCount >= maxBorrows
        const hasOverdue = borrowings.some(isOverdueBorrowing)
        const isSuspended = maxBorrows <= 0

        let buttonDisabled = !book.available || role === 'admin' || alreadyBorrowed || limitReached || hasOverdue || isSuspended
        let buttonText = 'Request Book'

        if (role === 'admin') {
          buttonText = 'Admin View Only'
        } else if (alreadyBorrowed) {
          buttonText = 'Requested / Borrowed'
        } else if (!book.available) {
          buttonText = 'Not Available'
        } else if (hasOverdue) {
          buttonText = 'Blocked: Overdue Book'
        } else if (isSuspended) {
          buttonText = 'Blocked: Suspended Credit'
        } else if (limitReached) {
          buttonText = 'Blocked: Limit Reached'
        }

        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
              <div className="flex justify-between items-start gap-4 mb-4">
                <h2 className="text-lg font-bold text-gray-900">{book.title}</h2>
                <button
                  onClick={() => setDetailBookId(null)}
                  className="text-gray-400 hover:text-gray-600 transition font-bold"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-6 mb-6">
                {resolveBookCoverSrc(book) ? (
                  <div className="shrink-0 w-32 h-[180px] rounded-lg overflow-hidden bg-gray-50 border border-gray-200">
                    <img
                      src={resolveBookCoverSrc(book)}
                      alt={`${book.title} cover`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <BookCoverThumb book={book} size="lg" className="rounded-lg border-gray-200" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 mb-1">Author: <span className="font-normal text-gray-600">{book.author}</span></p>
                  <p className="text-sm font-semibold text-gray-800 mb-2">ISBN: <span className="font-normal text-gray-600">{book.isbn || 'N/A'}</span></p>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Description:</p>
                  <p className="text-xs text-gray-600 leading-relaxed max-h-[100px] overflow-y-auto pr-2">
                    {book.description || 'No description provided.'}
                  </p>
                  <div className="mt-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      book.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {book.available ? 'Available' : 'Borrowed'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-end border-t border-gray-100 pt-4">
                <button
                  onClick={() => setDetailBookId(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <Button
                  onClick={() => {
                    setDetailBookId(null)
                    handleBorrow(book.id)
                  }}
                  disabled={buttonDisabled}
                  variant={buttonDisabled ? 'secondary' : 'primary'}
                  className="text-xs font-medium"
                >
                  {buttonText}
                </Button>
              </div>
            </div>
          </div>
        )
      })()}
      </div>
    </AppShell>
  )
}
