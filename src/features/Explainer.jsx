/**
 * A collapsed "why this number" note.
 *
 * The panels each carry a paragraph or two justifying how a figure was reached
 * — the baseline the higher-slab part is measured against, the assumptions
 * behind the run-out date, why two habits can legitimately cost the same. Those
 * paragraphs are the difference between a number and a claim, so none of them
 * can be deleted. But printed all at once they bury the figures they support,
 * and the figures are what someone opens the page for.
 *
 * So they collapse. The number leads; the reasoning is one click away and stays
 * in the DOM, which keeps it findable by search and by anyone checking our
 * arithmetic.
 */
import { ChevronRight } from 'lucide-react'

export default function Explainer({ label = 'How this is worked out', children, className = '' }) {
  return (
    <details className={`group mt-3 ${className}`}>
      <summary
        className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-ink-500
           hover:text-accent focus-visible:text-accent [&::-webkit-details-marker]:hidden"
      >
        <ChevronRight
          className="size-3.5 transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        {label}
      </summary>
      <div className="mt-2 border-l-2 border-ink-300/60 pl-3 text-xs leading-relaxed text-ink-500">
        {children}
      </div>
    </details>
  )
}
