import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getBooks, borrowBook, getUserBorrowings, getUserProfile } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { TextInput } from '../components/ui/TextInput'
import cover1984 from '../assets/1984.svg'
import coverGreatGatsby from '../assets/thegreatgatsby.svg'
import coverMockingbird from '../assets/tokillamockingbird.svg'
import coverCatcher from '../assets/thecatcherintherye.svg'
import coverProud from '../assets/iyanlavanzant.svg'

const BOOK_COVERS = {
  'The Great Gatsby': coverGreatGatsby,
  'To Kill a Mockingbird': coverMockingbird,
  '1984': cover1984,
  'The Catcher in the Rye': coverCatcher,
  'Proud': coverProud,
}

function getBookCover(title) {
  return BOOK_COVERS[title] ?? null
}

export default function Books() {
  const navigate = useNavigate()
  const { user, signOut, role } = useAuth()
  
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [borrowingStatus, setBorrowingStatus] = useState({})
  const [borrowings, setBorrowings] = useState([])
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [detailBookId, setDetailBookId] = useState(null)
  const [dueDate, setDueDate] = useState('')
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
    // Pre-fill due date to today + 14 days
    const d = new Date()
    d.setDate(d.getDate() + 14)
    setDueDate(d.toISOString().split('T')[0])
  }

  const handleConfirmBorrow = async () => {
    if (!dueDate) {
      alert('Please select a due date')
      return
    }

    // Prevent duplicate requests
    const alreadyRequested = borrowings.some(
      b => b.book_id === selectedBookId && (b.status === 'pending' || b.status === 'active')
    )
    if (alreadyRequested) {
      alert('You already have a pending or active request for this book.')
      setSelectedBookId(null)
      setDueDate('')
      return
    }

    setBorrowingStatus(prev => ({ ...prev, [selectedBookId]: 'loading' }))
    const { error } = await borrowBook(selectedBookId, user.id, dueDate)
    
    if (error) {
      setBorrowingStatus(prev => ({ ...prev, [selectedBookId]: 'error' }))
      alert('Failed to request book: ' + error.message)
    } else {
      setBorrowingStatus(prev => ({ ...prev, [selectedBookId]: 'success' }))
      fetchBooks()
      fetchUserBorrowings()
      setSelectedBookId(null)
      setDueDate('')
      setTimeout(() => {
        setBorrowingStatus(prev => ({ ...prev, [selectedBookId]: null }))
      }, 2000)
    }
  }

  const getTodayDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  const handleLogout = async () => {
    await signOut('user')
    navigate('/login', { replace: true })
  }

  const selectedBook = books.find(b => b.id === selectedBookId)

  return (
    <div className="min-h-screen bg-gray-50">
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
                onChange={(e) => setDueDate(e.target.value)}
                min={getTodayDate()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">
                Select a date from today onwards
              </p>
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Library System</h1>
            <p className="text-sm text-gray-500">Browse & Borrow Books</p>
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
            className="px-4 py-2 text-sm font-medium text-gray-900 bg-gray-100 rounded-md"
          >
            Browse Books
          </button>
          <button
            onClick={() => navigate('/my-borrowings')}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            My Borrowings ({borrowings.filter(b => b.status === 'active').length})
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
        
        {/* Credit Standing Summary Bar */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-500">Credit Score:</span>
            <span className="text-lg font-bold text-gray-900">{creditScore}</span>
            <span className="text-xs text-gray-400">/ 200 pts</span>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
              creditScore >= 180 ? 'text-green-700 bg-green-50 border-green-200' :
              creditScore >= 140 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
              creditScore >= 100 ? 'text-blue-700 bg-blue-50 border-blue-200' :
              creditScore >= 60 ? 'text-yellow-700 bg-yellow-50 border-yellow-200' :
              creditScore >= 20 ? 'text-orange-700 bg-orange-50 border-orange-200' :
              'text-red-700 bg-red-50 border-red-200'
            }`}>
              {creditScore >= 180 ? 'Excellent' :
               creditScore >= 140 ? 'Very Good' :
               creditScore >= 100 ? 'Good' :
               creditScore >= 60 ? 'Fair' :
               creditScore >= 20 ? 'Poor' :
               'Suspended'}
            </span>
          </div>
          <div className="flex gap-6 text-sm flex-wrap">
            <div>
              <span className="text-gray-500">Active Borrowings:</span>{' '}
              <span className="font-bold text-gray-950">{borrowings.filter(b => b.status === 'active').length}</span>
            </div>
            <div>
              <span className="text-gray-500">Pending Requests:</span>{' '}
              <span className="font-bold text-gray-950">{borrowings.filter(b => b.status === 'pending').length}</span>
            </div>
            <div>
              <span className="text-gray-500">Limit Capacity:</span>{' '}
              <span className="font-bold text-gray-950">
                {borrowings.filter(b => b.status === 'active' || b.status === 'pending').length} / {Math.floor(creditScore / 20)}
              </span>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 flex flex-col sm:flex-row gap-3">
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
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-gray-900 rounded-full"></div>
          </div>
        ) : books.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-gray-500">No books found</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => {
              const alreadyBorrowed = borrowings.some(
                b => b.book_id === book.id && (b.status === 'pending' || b.status === 'active')
              )
              const maxBorrows = Math.floor(creditScore / 20)
              const currentBorrowsCount = borrowings.filter(b => b.status === 'active' || b.status === 'pending').length
              const limitReached = currentBorrowsCount >= maxBorrows
              const hasOverdue = borrowings.some(b => b.status === 'active' && new Date(b.due_date) < new Date())
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
                  {(book.cover_url || getBookCover(book.title)) ? (
                    <div className="flex-shrink-0 w-20 h-[120px] rounded-md overflow-hidden bg-gray-50 border border-gray-100">
                      <img
                        src={book.cover_url || getBookCover(book.title)}
                        alt={`${book.title} cover`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="shrink-0 w-20 h-[120px] rounded-md overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-100">
                      <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  )}
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
      </main>

      {/* Book Details Modal */}
      {detailBookId && (() => {
        const book = books.find(b => b.id === detailBookId)
        if (!book) return null
        
        const alreadyBorrowed = borrowings.some(
          b => b.book_id === book.id && (b.status === 'pending' || b.status === 'active')
        )
        const maxBorrows = Math.floor(creditScore / 20)
        const currentBorrowsCount = borrowings.filter(b => b.status === 'active' || b.status === 'pending').length
        const limitReached = currentBorrowsCount >= maxBorrows
        const hasOverdue = borrowings.some(b => b.status === 'active' && new Date(b.due_date) < new Date())
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
                {(book.cover_url || getBookCover(book.title)) ? (
                  <div className="shrink-0 w-32 h-[180px] rounded-lg overflow-hidden bg-gray-50 border border-gray-200">
                    <img
                      src={book.cover_url || getBookCover(book.title)}
                      alt={`${book.title} cover`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="shrink-0 w-32 h-[180px] rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
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
  )
}
