import { useCallback, useState } from 'react'
import { ToastContext } from './toast-context'

const TONE_STYLES = {
  success: 'bg-green-50 border-green-200 text-green-900',
  error: 'bg-red-50 border-red-200 text-red-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
}

function ToastItem({ toast, onDismiss }) {
  return (
    <div
      role="status"
      className={`pointer-events-auto w-full max-w-sm rounded-xl border shadow-lg px-4 py-3 text-sm ${TONE_STYLES[toast.type] ?? TONE_STYLES.info}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 text-current opacity-60 hover:opacity-100"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((message, type = 'info', durationMs = 4500) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type }])
    if (durationMs > 0) {
      setTimeout(() => dismiss(id), durationMs)
    }
    return id
  }, [dismiss])

  const toast = {
    success: (message, durationMs) => push(message, 'success', durationMs),
    error: (message, durationMs) => push(message, 'error', durationMs),
    info: (message, durationMs) => push(message, 'info', durationMs),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none w-[calc(100%-2rem)] sm:w-auto sm:max-w-sm"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
