import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserProfile, updateUserProfile } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { TextInput } from '../components/ui/TextInput'

export default function UserProfile() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    library_id: ''
  })
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    setLoading(true)
    const { data, error } = await getUserProfile(user.id)
    if (data) {
      setProfile({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || '',
        address: data.address || '',
        library_id: data.library_id || ''
      })
    }
    setLoading(false)
  }

  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setUpdating(true)
    setMessage('')
    const { error } = await updateUserProfile(user.id, profile)
    
    if (error) {
      setMessage('Error saving profile: ' + error.message)
    } else {
      setMessage('Profile updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    }
    setUpdating(false)
  }

  const handleLogout = async () => {
    await signOut('user')
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Library System</h1>
            <p className="text-sm text-gray-500">User Profile</p>
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
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            My Borrowings
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="px-4 py-2 text-sm font-medium text-gray-900 bg-gray-100 rounded-md"
          >
            Profile
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl">
          {/* Account Information */}
          <Card className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Account Information</h2>
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-gray-600">{user?.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">User ID</label>
                <p className="mt-1 text-gray-600 text-xs break-all">{user?.id}</p>
              </div>
            </div>
          </Card>

          {/* Profile Information */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-gray-900 rounded-full"></div>
            </div>
          ) : (
            <Card>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Personal Information</h2>
              
              {message && (
                <div className={`mb-4 p-3 rounded-md text-sm ${
                  message.includes('Error')
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-green-50 text-green-800 border border-green-200'
                }`}>
                  {message}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      First Name
                    </label>
                    <TextInput
                      value={profile.first_name}
                      onChange={(e) => handleInputChange('first_name', e.target.value)}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      Last Name
                    </label>
                    <TextInput
                      value={profile.last_name}
                      onChange={(e) => handleInputChange('last_name', e.target.value)}
                      placeholder="Enter last name"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Library ID
                  </label>
                  <TextInput
                    value={profile.library_id}
                    onChange={(e) => handleInputChange('library_id', e.target.value)}
                    placeholder="Enter library ID"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Phone Number
                  </label>
                  <TextInput
                    value={profile.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Enter phone number"
                    type="tel"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    Address
                  </label>
                  <textarea
                    value={profile.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Enter address"
                    rows="4"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <Button
                    onClick={handleSave}
                    loading={updating}
                    variant="primary"
                  >
                    Save Changes
                  </Button>
                  <Button
                    onClick={fetchProfile}
                    variant="secondary"
                    disabled={updating}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
