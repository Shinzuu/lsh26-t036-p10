/**
 * Keeping a household between visits.
 *
 * Only meters the user set up themselves are saved. The published sample cases
 * are not, and neither is a pasted fixture — so a judge, or anyone else, opening
 * the live URL for the first time always lands on the seeded household with the
 * balance line already drawn. That property is worth protecting; it is what
 * makes the page safe to hand to a stranger.
 *
 * Every call is wrapped: private browsing, a full quota and disabled storage all
 * throw, and none of them should take the application down.
 */
const KEY = 'p10:my-meter'

export function saveMeter(kase) {
  try {
    localStorage.setItem(KEY, JSON.stringify(kase))
    return true
  } catch {
    return false
  }
}

export function loadMeter() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const kase = JSON.parse(raw)
    // Shape-check enough to know it will not break the engine. Anything odd is
    // discarded rather than half-loaded.
    if (!kase?.case_id || !Array.isArray(kase.days) || kase.days.length === 0) return null
    return kase
  } catch {
    return null
  }
}

export function clearMeter() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to do — the meter simply will not persist */
  }
}

/** Download the household as JSON, so the data belongs to the person who typed it. */
export function downloadCase(kase) {
  const blob = new Blob([JSON.stringify(kase, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${String(kase.case_id).replace(/[^\w.-]+/g, '-').toLowerCase() || 'meter'}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
