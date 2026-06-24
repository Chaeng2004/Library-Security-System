import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getBooks, addBook } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { TextInput } from '../components/ui/TextInput'

const EMPTY_FORM = { title: '', author: '', isbn: '', description: '', cover_url: '' }

export default function AdminBooks() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchBooks = useCallback(async () => {
    setLoading(true)
    const { data } = await getBooks()
    setBooks(data || [])
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchBooks() }, [fetchBooks])

  const handleSearch = async (value) => {
    setSearchTerm(value)
    const { data } = await getBooks(value.trim() ? { search: value } : {})
    setBooks(data || [])
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.title.trim() || !form.author.trim()) {
      setFormError('Title and author are required.')
      return
    }

    setSaving(true)
    let cover_url = ''

    if (coverFile) {
      const ext = coverFile.name.split('.').pop()
      const path = `covers/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('book-covers')
        .upload(path, coverFile, { upsert: true })

      if (uploadError) {
        setFormError('Failed to upload cover: ' + uploadError.message)
        setSaving(false)
        return
      }

      const { data: urlData } = supabase.storage.from('book-covers').getPublicUrl(path)
      cover_url = urlData.publicUrl
    }

    const { error } = await addBook({ ...form, cover_url })
    if (error) {
      setFormError('Failed to add book: ' + error.message)
    } else {
      setShowModal(false)
      setForm(EMPTY_FORM)
      setCoverFile(null)
      setCoverPreview(null)
      fetchBooks()
    }
    setSaving(false)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setForm(EMPTY_FORM)
    setCoverFile(null)
    setCoverPreview(null)
    setFormError('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Add Book Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Book</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <TextInput
                label="Title"
                value={form.title}
                onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Book title"
              />
              <TextInput
                label="Author"
                value={form.author}
                onChange={(e) => setForm(p => ({ ...p, author: e.target.value }))}
                placeholder="Author name"
              />
              <TextInput
                label="ISBN"
                value={form.isbn}
                onChange={(e) => setForm(p => ({ ...p, isbn: e.target.value }))}
                placeholder="ISBN (optional)"
              />
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Book description (optional)"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Cover Image <span className="text-gray-400 font-normal">(optional)</span></label>
                {coverPreview && (
                  <div className="mb-2 w-20 h-[120px] rounded-md overflow-hidden bg-gray-50 border border-gray-200">
                    <img src={coverPreview} alt="Preview" className="w-full h-full object-contain" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
              </div>
              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{formError}</p>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <Button type="submit" loading={saving}>Add Book</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Library System</h1>
            <p className="text-sm text-gray-500">Manage Books</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm font-medium text-gray-900 hidden sm:block">{user?.email}</p>
            <button
              onClick={() => signOut('user').then(() => navigate('/login', { replace: true }))}
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
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            Admin Dashboard
          </button>
          <button
            onClick={() => navigate('/admin/books')}
            className="px-4 py-2 text-sm font-medium text-gray-900 bg-gray-100 rounded-md"
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
        <div className="flex gap-4 mb-8">
          <TextInput
            placeholder="Search books by title or author..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1"
          />
          <Button onClick={() => setShowModal(true)}>+ Add Book</Button>
        </div>

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
                <div className="flex gap-4 flex-1 min-h-0 mb-4">
                  {book.cover_url && (
                    <div className="flex-shrink-0 w-20 h-[120px] rounded-md overflow-hidden bg-gray-50">
                      <img
                        src={book.cover_url}
                        alt={`${book.title} cover`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">{book.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{book.author}</p>
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{book.description || 'No description'}</p>
                    <div className="flex justify-between items-center text-sm mt-auto">
                      <span className="text-gray-600">ISBN: {book.isbn || 'N/A'}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${book.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {book.available ? 'Available' : 'Borrowed'}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
