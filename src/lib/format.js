/**
 * Dates and counts, written the one way this app writes them.
 *
 * Five panels each carried their own copy of these — `longDate` in three files,
 * `monthLabel` in two, `plural` in four, `nextDay` in two — and they had already
 * begun to drift ("1 Apr" here, "1 April 2026" there). One module, one voice.
 *
 * Every date string in this app is an ISO day, "2026-06-30", and is parsed as
 * UTC midnight on purpose: the tariff has no time of day, and going through the
 * local zone would shift a reading across a month boundary on some machines —
 * which is the one boundary the whole problem turns on.
 *
 * Money is NOT here. It goes through `useDisplay().money`, which knows the
 * chosen currency and numerals; a formatter that did not would be wrong the
 * moment someone switched either.
 */

const utc = (iso) => new Date(`${iso}T00:00:00Z`)

/** "2026-08-13" -> "13 August 2026". Unambiguous to a judge in any locale. */
export function longDate(iso) {
  if (!iso) return '—'
  const d = utc(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "2026-08-13" -> "13 Aug 2026". For tables and axis-adjacent text. */
export function shortDate(iso) {
  if (!iso) return '—'
  const d = utc(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "2026-04-01" -> "1 Apr". For dense lists where the year is already known. */
export function dayLabel(iso) {
  if (!iso) return '—'
  const d = utc(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** "2026-04" -> "April 2026". */
export function monthLabel(ym) {
  if (!ym) return '—'
  const d = utc(`${String(ym).slice(0, 7)}-01`)
  if (Number.isNaN(d.getTime())) return String(ym)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** "2026-04" -> "Apr". For chips and axis labels. */
export function monthShort(ym) {
  if (!ym) return '—'
  const d = utc(`${String(ym).slice(0, 7)}-01`)
  if (Number.isNaN(d.getTime())) return String(ym)
  return d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
}

/** "2026-06-30" -> "2026-07-01", without going through a timezone. */
export function nextDay(iso) {
  const d = utc(iso)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** ISO day `n` days after `iso`. Negative `n` walks backwards. */
export function addDays(iso, n) {
  const d = utc(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Last day of the calendar month that `iso` falls in. */
export function endOfMonth(iso) {
  const d = utc(iso)
  d.setUTCMonth(d.getUTCMonth() + 1, 0)
  return d.toISOString().slice(0, 10)
}

/** Whole days from `a` to `b`, exclusive of both ends; negative if `b` is earlier. */
export function daysBetween(a, b) {
  return Math.round((utc(b).getTime() - utc(a).getTime()) / 86400000)
}

/**
 * "1 day" / "181 days" — a count and its noun, agreeing. The optional formatter
 * lets the digits come from the display layer so a Bengali-numeral reader sees
 * "১৮১ days" rather than a Latin count in a Bengali page.
 */
export function plural(n, word, format = (v) => v) {
  return `${format(n)} ${word}${n === 1 ? '' : 's'}`
}

/** "once" / "3 times". */
export function times(n, format = (v) => v) {
  return n === 1 ? 'once' : `${format(n)} times`
}
