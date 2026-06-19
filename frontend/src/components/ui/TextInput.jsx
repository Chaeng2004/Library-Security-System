export function TextInput({ id, label, error, className = '', rightSlot, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          className={`w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder-gray-400
            bg-white outline-none transition
            focus:ring-2 focus:ring-gray-900 focus:border-gray-900
            ${error ? 'border-red-500' : 'border-gray-300'}
            ${rightSlot ? 'pr-10' : ''}
            ${className}`}
          {...props}
        />
        {rightSlot && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {rightSlot}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
