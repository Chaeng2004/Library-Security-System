export function isStaleSessionError(error) {
  if (!error) return false
  return (
    error.status === 403 ||
    error.message?.includes('does not exist') ||
    error.message?.includes('JWT')
  )
}
