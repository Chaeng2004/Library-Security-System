import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { getUserProfile, updateUserProfile } from '../lib/api'
import { logEvent, AUDIT_EVENTS } from '../lib/audit'
import { validate, mfaVerifySchema } from '../lib/validation'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { TextInput } from '../components/ui/TextInput'

export default function UserProfile() {
  const navigate = useNavigate()
  const { user, role, signOut, refreshAal } = useAuth()

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

  // MFA state
  const [mfaFactor, setMfaFactor] = useState(null)
  const [mfaLoading, setMfaLoading] = useState(true)
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)
  const [disableCode, setDisableCode] = useState('')
  const [disableErrors, setDisableErrors] = useState({})
  const [disableServerError, setDisableServerError] = useState('')
  const [disabling, setDisabling] = useState(false)

  const fetchMfaStatus = useCallback(async () => {
    setMfaLoading(true)
    const { data } = await supabase.auth.mfa.listFactors()
    const verified = data?.totp?.find((f) => f.status === 'verified') ?? null
    setMfaFactor(verified)
    setMfaLoading(false)
  }, [])

  useEffect(() => {
    fetchProfile()
    fetchMfaStatus()
  }, [fetchMfaStatus])

  const fetchProfile = async () => {
    setLoading(true)
    const { data } = await getUserProfile(user.id)
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

  const handleDisableMfa = async (e) => {
    e.preventDefault()
    setDisableServerError('')

    const { data: parsed, errors: validationErrors } = validate(mfaVerifySchema, { code: disableCode })
    if (validationErrors) { setDisableErrors(validationErrors); return }
    setDisableErrors({})

    setDisabling(true)
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactor.id,
      })
      if (challengeError) {
        setDisableServerError('Failed to verify identity. Please try again.')
        return
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactor.id,
        challengeId: challenge.id,
        code: parsed.code,
      })
      if (verifyError) {
        setDisableServerError('Invalid code. Please try again.')
        return
      }

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: mfaFactor.id })
      if (unenrollError) {
        setDisableServerError('Failed to disable MFA. Please try again.')
        return
      }

      await logEvent(AUDIT_EVENTS.MFA_DISABLED, { factorId: mfaFactor.id })
      await refreshAal()
      setShowDisableConfirm(false)
      setDisableCode('')
      await fetchMfaStatus()
    } finally {
      setDisabling(false)
    }
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
          {role === 'admin' ? (
            <>
              <button
                onClick={() => navigate('/admin')}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
              >
                Admin Dashboard
              </button>
              <button
                onClick={() => navigate('/admin/books')}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
              >
                Manage Books
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
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

          {/* Two-Factor Authentication */}
          <Card className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Two-Factor Authentication</h2>
            {mfaLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : mfaFactor ? (
              <>
                <p className="text-sm text-gray-700 mb-4">
                  Two-factor authentication is <span className="font-medium text-green-700">enabled</span>.
                  Your account is protected by a TOTP authenticator app.
                </p>
                {!showDisableConfirm ? (
                  <Button
                    variant="danger"
                    onClick={() => { setShowDisableConfirm(true); setDisableServerError(''); setDisableCode('') }}
                  >
                    Disable two-factor authentication
                  </Button>
                ) : (
                  <form onSubmit={handleDisableMfa} className="flex flex-col gap-4" noValidate>
                    <p className="text-sm text-gray-600">
                      Enter your current 6-digit authenticator code to confirm.
                    </p>
                    <TextInput
                      id="disable-totp-code"
                      label="Verification code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={disableCode}
                      onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      error={disableErrors.code}
                      placeholder="000000"
                      className="text-center tracking-widest text-lg"
                    />
                    {disableServerError && (
                      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                        {disableServerError}
                      </p>
                    )}
                    <div className="flex gap-3">
                      <Button type="submit" loading={disabling} variant="danger">
                        Confirm disable
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={disabling}
                        onClick={() => { setShowDisableConfirm(false); setDisableCode(''); setDisableErrors({}) }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-gray-700 mb-4">
                  Two-factor authentication is <span className="font-medium text-gray-500">not enabled</span>.
                  Add an extra layer of security to your account.
                </p>
                <Button onClick={() => navigate('/mfa-setup', { state: { from: 'profile' } })}>
                  Enable two-factor authentication
                </Button>
              </>
            )}
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
                      disabled={updating}
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
                      disabled={updating}
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
                    disabled={updating}
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
                    disabled={updating}
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
                    disabled={updating}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
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
