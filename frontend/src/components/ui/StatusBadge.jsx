const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  return_pending: 'bg-blue-100 text-blue-800',
  returned: 'bg-gray-100 text-gray-800',
  admin: 'bg-purple-100 text-purple-800',
  user: 'bg-gray-100 text-gray-800',
  available: 'bg-green-100 text-green-800',
  unavailable: 'bg-red-100 text-red-800',
}

const STATUS_LABELS = {
  pending: 'Pending',
  active: 'Active',
  return_pending: 'Return pending',
  returned: 'Returned',
  admin: 'Admin',
  user: 'User',
  available: 'Available',
  unavailable: 'Borrowed',
}

export function StatusBadge({ status, label, className = '' }) {
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-800'
  const text = label ?? STATUS_LABELS[status] ?? status
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${style} ${className}`}>
      {text}
    </span>
  )
}
