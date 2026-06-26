export function LoadingSpinner({ className = 'h-8 w-8', label = 'Loading…', minHeight }) {
  const resolvedMinHeight = minHeight ?? (label ? 'min-h-[200px]' : 'min-h-[4rem]')
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${resolvedMinHeight}`} role="status">
      <div
        className={`animate-spin border-4 border-gray-200 border-t-gray-900 rounded-full ${className}`}
        aria-hidden="true"
      />
      {label && <p className="text-sm text-gray-500">{label}</p>}
    </div>
  )
}
