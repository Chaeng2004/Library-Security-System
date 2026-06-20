import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children, adminOnly = false }) {
  const { session, aal, role } = useAuth()

  if (session === undefined) return null

  if (!session) return <Navigate to="/login" replace />

  if (aal !== 'aal2') return <Navigate to="/mfa-setup" replace />

  if (adminOnly && role === null) return null

  if (adminOnly && role !== 'admin') return <Navigate to="/dashboard" replace />

  return children
}
