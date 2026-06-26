import { Button } from './Button'

export function ConfirmModal({ open, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, confirmVariant = 'primary', loading = false }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" role="dialog" aria-modal="true">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="mt-2 text-sm text-gray-500">{description}</p>}
        <div className="mt-5 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          {confirmVariant === 'danger' ? (
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition disabled:opacity-50"
            >
              {confirmLabel}
            </button>
          ) : (
            <Button onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
          )}
        </div>
      </div>
    </div>
  )
}
