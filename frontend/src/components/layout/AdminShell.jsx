import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import { LibraryLogo } from './LibraryLogo'
import { SHELL_MAX_WIDTH, shellNavButtonClass } from './shellConstants'

const ADMIN_NAV = [
  { path: '/admin', label: 'Admin Dashboard' },
  { path: '/profile', label: 'Profile' },
]

export function AdminShell({ title = 'Admin Dashboard', subtitle, children, maxWidth = SHELL_MAX_WIDTH }) {
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
              <p className="text-xs text-gray-500 truncate">
                {title}{subtitle ? ` · ${subtitle}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-purple-100 text-purple-800 rounded">
              Admin
            </span>
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
          {ADMIN_NAV.map(({ path, label }) => (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className={shellNavButtonClass(isActive(path))}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className={`flex-1 ${maxWidth} w-full mx-auto px-4 sm:px-6 py-6 sm:py-8`}>
        {children}
      </main>
    </div>
  )
}
