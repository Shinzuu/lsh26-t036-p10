/**
 * Brief confirmations.
 *
 * Loading a household changes every figure on the page at once. Without a word
 * of acknowledgement that reads as a glitch, so an action that succeeds says so
 * and then gets out of the way.
 *
 * The live region is polite and always mounted — announcing into a region that
 * appears at the same moment as its text is unreliable in most screen readers.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback((message, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t.slice(-2), { id, message, tone }])
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function Toast({ id, message, tone, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4200)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const Icon = tone === 'info' ? Info : CheckCircle2

  return (
    <div
      className="toast-in pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-card border border-ink-300/60 bg-white px-4 py-3 text-sm shadow-lg dark:bg-ink-900"
      key={id}
    >
      <Icon className={`mt-0.5 size-4 shrink-0 ${tone === 'info' ? 'text-accent' : 'text-ok'}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-m-1 shrink-0 rounded p-1 text-ink-500 hover:text-ink-900 dark:hover:text-ink-50"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  return ctx?.toast ?? (() => {})
}
