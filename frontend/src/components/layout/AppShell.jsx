import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'

const USER_NAV = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/books', label: 'Browse Books' },
  { path: '/my-borrowings', label: 'My Borrowings', badgeKey: 'borrowings' },
  { path: '/profile', label: 'Profile' },
]

const ADMIN_PROFILE_NAV = [
  { path: '/admin', label: 'Admin Dashboard' },
  { path: '/profile', label: 'Profile' },
]

function LibraryLogo() {
  return (
    <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    </div>
  )
}

export function AppShell({ title, subtitle, children, badges = {}, maxWidth = 'max-w-5xl', navVariant = 'user' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const confirmLogout = async () => {
    setShowLogoutConfirm(false)
    await signOut('user')
    navigate('/login', { replace: true })
  }

  const isActive = (path) => location.pathname === path
  const navItems = navVariant === 'admin' ? ADMIN_PROFILE_NAV : USER_NAV

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ConfirmModal
        open={showLogoutConfirm}
        title="Sign out?"
        description="Your session will end. You will need to sign in and verify your identity again."
        confirmLabel="Sign out"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className={`${maxWidth} mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4`}>
          <div className="flex items-center gap-3 min-w-0">
            <LibraryLogo />
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">Library Security System</p>
              {(title || subtitle) && (
                <p className="text-xs text-gray-500 truncate">
                  {title}{subtitle ? ` · ${subtitle}` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <p className="text-sm text-gray-600 hidden sm:block truncate max-w-[180px]" title={user?.email}>
              {user?.email}
            </p>
            <Button variant="secondary" onClick={() => setShowLogoutConfirm(true)} className="text-xs sm:text-sm">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className={`${maxWidth} mx-auto px-4 sm:px-6 py-2 flex gap-1 overflow-x-auto`}>
          {navItems.map(({ path, label, badgeKey }) => {
            const badge = badgeKey ? badges[badgeKey] : null
            return (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                className={`px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition shrink-0 ${
                  isActive(path)
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {label}
                {badge != null && badge > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full ${
                    isActive(path) ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>

      <main className={`flex-1 ${maxWidth} w-full mx-auto px-4 sm:px-6 py-6 sm:py-8`}>
        {children}
      </main>
    </div>
  )
}
