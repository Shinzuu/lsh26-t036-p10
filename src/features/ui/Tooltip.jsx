/**
 * A tooltip a keyboard can reach.
 *
 * Hover-only tooltips hide their content from anyone not using a mouse, so this
 * opens on focus too, closes on Escape, and is wired with `aria-describedby` so
 * a screen reader announces it as a description rather than as stray text.
 *
 * It carries detail that supports a figure — what a slab rate means, why a
 * charge appears — and never anything the reader must have to use the page.
 */
import { useId, useRef, useState } from 'react'

export default function Tooltip({ label, children, side = 'top', className = '' }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const timer = useRef(null)

  const show = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOpen(true), 80)
  }
  const hide = () => {
    clearTimeout(timer.current)
    setOpen(false)
  }

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === 'Escape') hide()
      }}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      <span
        role="tooltip"
        id={id}
        hidden={!open}
        className={`pointer-events-none absolute z-40 w-max max-w-64 rounded-lg bg-ink-900 px-2.5 py-1.5 text-xs font-normal leading-snug text-ink-50 shadow-lg dark:bg-ink-50 dark:text-ink-900 ${
          side === 'top'
            ? 'bottom-full left-1/2 mb-2 -translate-x-1/2'
            : 'top-full left-1/2 mt-2 -translate-x-1/2'
        }`}
      >
        {label}
      </span>
    </span>
  )
}
