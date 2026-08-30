/**
 * Queue position, status transitions, and claim logic — no framework, no
 * network, no DOM.
 *
 * WHY THIS EXISTS
 * "Two people took position 3" is the trap `playbook/05-archetypes.md`
 * names for this archetype, and it is a data-model bug, not a locking bug:
 * the naive build stores a `position` column, writes it on insert, and
 * re-numbers everyone behind a cancellation by hand. Two joins racing that
 * write land on the same number, and a bad re-number after a cancellation
 * leaves a gap or a duplicate that only shows up once a judge cancels
 * someone mid-demo. The fix here is to never store position at all — it is
 * computed fresh from `created_at` order every time `derivePositions` runs,
 * so there is no shared mutable counter for two joins to race on and no
 * stale number for a cancellation to leave behind.
 *
 * The second trap this file closes is a status update that skips a step —
 * `waiting` jumping straight to `served` with nobody ever `called`. The
 * `TRANSITIONS` graph plus `assertTransition` make every allowed move
 * explicit and throw a readable error on anything else, so an illegal jump
 * fails loudly at the call site instead of quietly corrupting the queue.
 *
 * Everything in this file is a plain function over plain arrays — copy it
 * next to `db.js` and call it from whatever layer already does
 * `db.list`/`db.update`, same as every other recipe in this pack.
 */

// --- position -----------------------------------------------------------

/**
 * Compare two entries the same way the SQL seed pattern's
 * `rank() over (order by created_at)` does: earliest `created_at` first,
 * and — because two rows can share the exact same millisecond under real
 * concurrent inserts — `id` as an explicit, deterministic tiebreak so the
 * ordering never depends on array insertion order or a stable-sort
 * implementation detail.
 */
function compareByArrival(a, b) {
  const ta = new Date(a.created_at).getTime()
  const tb = new Date(b.created_at).getTime()
  if (ta !== tb) return ta - tb
  const ia = String(a.id)
  const ib = String(b.id)
  if (ia < ib) return -1
  if (ia > ib) return 1
  return 0
}

/**
 * Reach for this every time you need to show or use a queue position —
 * never read or write a `position` field on the row itself. Ranks the
 * `waiting` entries by arrival order (`created_at`, then `id` as a
 * tiebreak) and returns every entry from `entries` with a `position` field
 * added: 1-based for `waiting` rows, `null` for anything else (`called`,
 * `served`, `no-show`, `cancelled` — they are not in line any more).
 * Original array order and every other field are preserved untouched; this
 * only adds `position`.
 *
 * Because position is derived on every call instead of stored, "two people
 * take position 3" is structurally impossible — nobody assigns 3, and
 * cancelling the person who used to be #2 does not require re-writing
 * anyone else's row, since the next call to `derivePositions` recomputes
 * every position from whichever rows are still `waiting`.
 *
 * @param {Array<{ id: string|number, created_at: string|number|Date, status: string }>} entries
 * @returns {Array<object & { position: number | null }>}
 */
export function derivePositions(entries) {
  const waitingInOrder = entries.filter((e) => e.status === 'waiting').slice().sort(compareByArrival)
  const positionById = new Map(waitingInOrder.map((e, i) => [e.id, i + 1]))
  return entries.map((e) => ({ ...e, position: positionById.get(e.id) ?? null }))
}

// --- status transitions ---------------------------------------------------

/**
 * The entire allowed-status graph for a queue entry, written down in one
 * place so no call site has to reconstruct "what can follow what" from
 * memory under time pressure. `served`, `no-show`, and `cancelled` are
 * terminal — nothing leaves them, including back to `waiting` (re-joining
 * is a new entry, not a resurrected old one, so the arrival-order tiebreak
 * in `derivePositions` keeps meaning what it says).
 */
export const TRANSITIONS = {
  waiting: ['called', 'cancelled'],
  called: ['served', 'no-show', 'cancelled'],
  served: [],
  'no-show': [],
  cancelled: [],
}

/**
 * True/false check for whether `from -> to` is a legal move, with no
 * throwing — use this when you need to decide whether to show a button
 * (e.g. only render "Mark no-show" when `canTransition(entry.status,
 * 'no-show')`), and reach for `assertTransition` instead at the point an
 * update actually happens, so an illegal jump is impossible to apply by
 * accident.
 *
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransition(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to)
}

/**
 * Guard every status update through this before the `db.update` call —
 * exactly the seed pattern's advice. Throws a readable `Error` naming both
 * the illegal move and (for a `from` this graph does not even know about)
 * the fact that `from` itself is not a recognised status, rather than
 * silently treating an unknown status as having no allowed moves. Returns
 * `true` on a legal transition so it can sit inline in a call site as a
 * one-line assertion.
 *
 * @param {string} from
 * @param {string} to
 * @returns {true}
 * @throws {Error}
 */
export function assertTransition(from, to) {
  if (!(from in TRANSITIONS)) {
    throw new Error(`Illegal queue transition: unknown status "${from}" is not one of ${Object.keys(TRANSITIONS).join(', ')}.`)
  }
  if (!canTransition(from, to)) {
    const allowed = TRANSITIONS[from]
    const allowedText = allowed.length === 0 ? 'none — this is a terminal status' : allowed.join(', ')
    throw new Error(`Illegal queue transition: "${from}" -> "${to}". From "${from}", the only allowed next status is: ${allowedText}.`)
  }
  return true
}

// --- claiming the next entry ----------------------------------------------

/**
 * Reach for this to build "call next" — it never mutates anything and
 * never talks to storage itself; it only decides *what claim to attempt*
 * from the caller's current (possibly stale) view of the queue. Returns
 * `null` when nobody is waiting, otherwise the claim intent for whoever
 * `derivePositions` currently ranks #1: the entry id, who is claiming it,
 * and the `expectedStatus`/`nextStatus` pair an optimistic-concurrency
 * guard needs to apply the claim safely.
 *
 * OPTIMISTIC CONCURRENCY — why this returns an intent instead of a result:
 * two claimers (two staff tablets, or one staff member double-tapping) can
 * both call `claimNext` against the same stale snapshot and both get back
 * an intent naming the *same* entry. That is expected and harmless as long
 * as *applying* the intent is a compare-and-swap, not a blind write:
 *
 *   - localStorage backend: re-read the row by id, check its status is
 *     still `expectedStatus` ('waiting'), and only then write `nextStatus`
 *     — `applyClaim` below does exactly this against an in-memory snapshot,
 *     and the same read-check-write shape maps directly onto
 *     `db.list`/`db.update` calls.
 *   - Supabase backend: a single conditional UPDATE is the atomic guard —
 *     `UPDATE queue_entries SET status = 'called', claimed_by = :claimerId
 *      WHERE id = :id AND status = 'waiting' RETURNING *` — the WHERE
 *     clause is the compare-and-swap; a `0`-row result means someone else's
 *     claim landed first, which is a normal, expected outcome to check for,
 *     not an error to log and ignore.
 *   - Supabase, "claim whichever is next" instead of a specific id (no
 *     stale-read gap between "compute the intent" and "apply it" at all):
 *
 *       UPDATE queue_entries SET status = 'called', claimed_by = :claimerId
 *       WHERE id = (
 *         SELECT id FROM queue_entries
 *         WHERE status = 'waiting'
 *         ORDER BY created_at, id
 *         FOR UPDATE SKIP LOCKED
 *         LIMIT 1
 *       )
 *       RETURNING *;
 *
 *     `FOR UPDATE SKIP LOCKED` is what makes two concurrent claimers land on
 *     *different* rows instead of one blocking behind the other's lock and
 *     then failing the `status = 'waiting'` check a heartbeat later — each
 *     claimer skips whatever the other one is already mid-transaction on
 *     and locks the next free row instead.
 *
 * @param {Array<object>} entries
 * @param {string} claimerId
 * @param {number} [now]
 * @returns {{ id: any, claimerId: string, expectedStatus: 'waiting', nextStatus: 'called', claimedAt: string } | null}
 */
export function claimNext(entries, claimerId, now) {
  if (now === undefined) throw new Error("claimNext needs an explicit now (pass Date.now() at the call site) — pure functions never read the clock")
  const next = derivePositions(entries).find((e) => e.position === 1)
  if (!next) return null
  return {
    id: next.id,
    claimerId,
    expectedStatus: 'waiting',
    nextStatus: 'called',
    claimedAt: new Date(now).toISOString(),
  }
}

/**
 * The compare-and-swap half of the pattern documented on `claimNext` —
 * apply a claim intent against a snapshot of "what the server currently
 * has" and get back a truthful `{ data, error }` outcome, `db.js`-style.
 * Two claimers who both computed the same intent from the same stale read
 * do NOT both succeed here: whichever one applies first gets `{ data:
 * updatedEntry, error: null }`; the second one's re-check finds the row is
 * no longer `waiting` and gets back `{ data: null, error: { code:
 * 'stale_claim', ... } }` — a truthful, specific outcome to show ("someone
 * else already called them"), not a silent overwrite and not a generic
 * failure.
 *
 * `serverEntries` models whatever the real compare-and-swap checks against
 * at apply time — call this again with the freshly-updated array (or a
 * fresh `db.list` result) between two sequential claim attempts to see the
 * second one lose truthfully; see `queue.test.mjs`'s concurrent-claim tests
 * for the exact simulation.
 *
 * @param {Array<object>} serverEntries
 * @param {{ id: any, claimerId: string, expectedStatus: string, nextStatus: string, claimedAt: string }} intent
 * @returns {{ data: object|null, error: { code: string, message: string }|null }}
 */
export function applyClaim(serverEntries, intent) {
  const current = serverEntries.find((e) => e.id === intent.id)
  if (!current) {
    return { data: null, error: { code: 'not_found', message: `No queue entry with id "${intent.id}".` } }
  }
  if (current.status !== intent.expectedStatus) {
    return {
      data: null,
      error: {
        code: 'stale_claim',
        message: `Entry "${intent.id}" is already "${current.status}" — someone else claimed it first.`,
      },
    }
  }
  assertTransition(current.status, intent.nextStatus)
  const updated = {
    ...current,
    status: intent.nextStatus,
    claimedBy: intent.claimerId,
    claimedAt: intent.claimedAt,
  }
  return { data: updated, error: null }
}

// --- wait estimate ----------------------------------------------------------

/**
 * Reach for this for the "about N minutes" line next to a queue position —
 * a rough, honestly-labelled estimate, not a promise. Assumes
 * `avgServiceMinutes` per person and `servers` people being served in
 * parallel (default 1, a single counter/window); the entries ahead of a
 * given `waiting` row are split across however many servers are working,
 * so a busier front desk with more than one server shortens everyone's
 * wait proportionally. Non-`waiting` entries (already `called`, or a
 * terminal status) get `estimatedWaitMinutes: null` — they are not waiting
 * any more, so "how much longer will they wait" does not apply to them;
 * that is a deliberate `null`, not a zero, so a UI can tell "no more wait"
 * apart from "not in the queue's wait calculation at all".
 *
 * Throws on a negative or non-finite `avgServiceMinutes`, or a `servers`
 * that is not a positive integer — both are almost always a unit mistake
 * (seconds instead of minutes, `0` servers) rather than a real input worth
 * silently coercing.
 *
 * @param {Array<object>} entries
 * @param {number} avgServiceMinutes
 * @param {{ servers?: number }} [options]
 * @returns {Array<object & { position: number|null, estimatedWaitMinutes: number|null }>}
 */
export function waitEstimate(entries, avgServiceMinutes, { servers = 1 } = {}) {
  if (!Number.isFinite(avgServiceMinutes) || avgServiceMinutes < 0) {
    throw new Error(`waitEstimate: avgServiceMinutes must be a non-negative finite number, got ${avgServiceMinutes}.`)
  }
  if (!Number.isInteger(servers) || servers < 1) {
    throw new Error(`waitEstimate: servers must be a positive integer, got ${servers}.`)
  }
  return derivePositions(entries).map((e) => {
    if (e.position == null) return { ...e, estimatedWaitMinutes: null }
    const aheadCount = e.position - 1
    const estimatedWaitMinutes = Math.floor(aheadCount / servers) * avgServiceMinutes
    return { ...e, estimatedWaitMinutes }
  })
}
