import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// [MFA] [SESSION-TIMEOUT] ProtectedRoute — enforces aal2 (password + verified TOTP)
// before rendering any child route. aal1 (password only) redirects to /mfa-setup.
// To change the required assurance level search for "ProtectedRoute".
export function ProtectedRoute({ children }) {
  const { session, aal } = useAuth()

  if (session === undefined) return null

  if (!session) return <Navigate to="/login" replace />

  if (aal !== 'aal2') return <Navigate to="/mfa-setup" replace />

  return children
}
