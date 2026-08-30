/**
 * Taking the data with you.
 *
 * Remembering a household between visits lives in the store, which owns the
 * case. This file is only the way out: a download in the organizers' own shape,
 * so a household that typed its readings here can keep them, move them, or hand
 * them to someone else.
 */
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
