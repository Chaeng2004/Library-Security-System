export function EmptyState({ title = 'Nothing here yet', description, action }) {
  return (
    <div className="text-center py-10 px-4">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
