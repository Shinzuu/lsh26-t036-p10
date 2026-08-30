/**
 * The slide-over menu behind the hamburger.
 *
 * Built on the native `<dialog>` so the browser gives us the things a hand-rolled
 * overlay usually forgets: focus is trapped inside while it is open, Escape
 * closes it, and the rest of the page is inert to a screen reader. All this file
 * adds is the slide, the scrim, and closing when the scrim is clicked.
 */
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Drawer({ open, onClose, title, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // The dialog element itself is the backdrop; a click that lands on it
        // rather than on the panel inside means "outside".
        if (e.target === ref.current) onClose()
      }}
      className="drawer m-0 h-dvh max-h-none w-80 max-w-[85vw] bg-ink-50 p-0 text-ink-900 shadow-2xl backdrop:bg-ink-900/50 dark:bg-ink-900 dark:text-ink-50"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-ink-300/60 px-4 py-3">
          <p className="text-sm font-semibold tracking-tight">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex size-9 items-center justify-center rounded-xl text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700/40"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </dialog>
  )
}
