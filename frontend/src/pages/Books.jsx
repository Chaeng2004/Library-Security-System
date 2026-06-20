import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { getBooks, borrowBook, getUserBorrowings } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { TextInput } from '../components/ui/TextInput'

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
  const [dueDate, setDueDate] = useState('')

  useEffect(() => {
    fetchBooks()
    fetchUserBorrowings()
  }, [])

  const fetchBooks = async (search = searchTerm, onlyAvailable = availableOnly) => {
    setLoading(true)
    const filters = {}
    if (search.trim()) filters.search = search
    if (onlyAvailable) filters.available = true
    const { data, error } = await getBooks(filters)
    if (!error) {
      setBooks(data || [])
    }
    setLoading(false)
  }

  const fetchUserBorrowings = async () => {
    const { data } = await getUserBorrowings(user.id)
    setBorrowings(data || [])
  }

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

  const activeBorrowedBooks = borrowings.filter(b => b.status === 'active').map(b => b.book_id)

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
            {books.map((book) => (
              <Card key={book.id} className="flex flex-col hover:shadow-md transition-shadow">
                {book.cover_url ? (
                  <div className="-m-6 mb-4 bg-gray-100 rounded-t-xl h-48 overflow-hidden">
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="-m-6 mb-4 bg-gray-100 rounded-t-xl h-48 overflow-hidden flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                    {book.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">{book.author}</p>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                    {book.description || 'No description'}
                  </p>
                  
                  <div className="flex justify-between items-center text-sm mb-4">
                    <span className="text-gray-600">ISBN: {book.isbn || 'N/A'}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      book.available
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {book.available ? 'Available' : 'Borrowed'}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => handleBorrow(book.id)}
                  disabled={!book.available || role === 'admin'}
                  loading={borrowingStatus[book.id] === 'loading'}
                  variant={
                    borrowingStatus[book.id] === 'success' ? 'secondary' :
                    !book.available || role === 'admin' ? 'secondary' : 'primary'
                  }
                  className="w-full"
                >
                  {borrowingStatus[book.id] === 'success' ? 'Requested' :
                   role === 'admin' ? 'Admin View Only' :
                   !book.available ? 'Not Available' :
                   'Request Book'}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
