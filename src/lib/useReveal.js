/**
 * Reveal on first sight.
 *
 * Sections fade and rise a few pixels the first time they scroll into view, once
 * each. It is the one piece of motion on the page that is not tied to a number
 * changing, and it earns its place by giving the long page a sense of sections
 * arriving rather than a single wall appearing at once.
 *
 * Two rules it obeys:
 *   - `prefers-reduced-motion` short-circuits it entirely; the element is simply
 *     visible from the start, never animated.
 *   - If IntersectionObserver is missing, the element is visible. Motion is a
 *     nicety and must never be the reason something cannot be read.
 */
import { useEffect, useRef, useState } from 'react'

export function useReveal({ margin = '0px 0px -10% 0px' } = {}) {
  const ref = useRef(null)
  const [shown, setShown] = useState(() => {
    if (typeof window === 'undefined') return true
    if (!('IntersectionObserver' in window)) return true
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  })

  useEffect(() => {
    if (shown || !ref.current) return
    const el = ref.current
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: margin, threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown, margin])

  return { ref, shown }
}
