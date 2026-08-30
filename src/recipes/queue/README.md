# queue

Queue position, status transitions, and "call next" — the second-biggest
coverage gap in the kit per `playbook/10-coverage.md`, and the one the
archetype doc names its own trap for: "race conditions look academic until
two people take position 3." Pure functions, dependency-free, plain arrays
in and plain arrays (or `{ data, error }`, `db.js`-style, where an operation
can genuinely fail) out.

The fix here is not a locking scheme bolted onto a broken data model — it's
not storing the broken part at all. Position is never written to a row; it
is recomputed from `created_at` order on every read, so there is no shared
counter for two joins to race on and no stale number for a cancellation to
leave behind. Status changes go through an explicit allowed-transition
graph instead of a free-form string field, so `waiting` jumping straight to
`served` fails loudly instead of quietly.

This recipe is logic only — no `.jsx` component. A queue's on-screen shape
(a numbered list, a "you are #3" banner, a staff-facing "call next" button)
varies too much by problem to fake with one generic component, the same
call `bd-formats` makes for the same reason: wire these functions into
whatever list/button your app already renders.

## Files

| File | What |
|---|---|
| `queue.js` | `derivePositions`, the `TRANSITIONS` graph + `canTransition`/`assertTransition`, `claimNext` + `applyClaim`, and `waitEstimate`. Every export documented with when to reach for it. |
| `queue.test.mjs` | `node --test` coverage: position derivation and stability under cancellation, the full transition legality matrix, a concurrent-claim simulation, and wait-estimate edge cases. |

## Using it

```bash
cp -r src/recipes/queue src/lib/queue
```

```js
import { derivePositions, assertTransition, claimNext, applyClaim, waitEstimate } from '../lib/queue/queue.js'
import { db } from '../lib/db.js'

// Rendering a list: never read a stored `position` field — derive it.
const { data: rows } = await db.list('queue_entries')
const withPositions = derivePositions(rows)
const withEstimates = waitEstimate(rows, 6) // avg 6 min/person, 1 server

// Changing status: always through the guard, never a bare db.update.
async function markNoShow(entry) {
  assertTransition(entry.status, 'no-show') // throws before the write if illegal
  return db.update('queue_entries', entry.id, { status: 'no-show' })
}

// "Call next" — compute an intent, then apply it as a compare-and-swap.
async function callNext(staffId) {
  const { data: rows } = await db.list('queue_entries')
  const intent = claimNext(rows, staffId)
  if (!intent) return { data: null, error: { code: 'empty_queue', message: 'Nobody is waiting.' } }

  // Re-read right before applying to narrow the staleness window, then let
  // applyClaim's status check be the actual guard against a second caller
  // who read the same stale snapshot — see "Optimistic concurrency" below.
  const { data: fresh } = await db.list('queue_entries')
  const { data, error } = applyClaim(fresh, intent)
  if (error) return { data: null, error } // truthful: "someone else already called them"
  return db.update('queue_entries', data.id, { status: data.status, claimedBy: data.claimedBy, claimedAt: data.claimedAt })
}
```

## The status graph

```
waiting ──> called ──> served
   │           │  └──> no-show
   └──> cancelled  └──> cancelled
```

`served`, `no-show`, and `cancelled` are terminal — nothing leaves them,
including back to `waiting`. A person who wants back in the queue after
cancelling gets a new entry (a fresh `created_at`, a fresh position at the
back), not a resurrected old one; that keeps `derivePositions`'s
arrival-order tiebreak meaning what it says.

`canTransition(from, to)` is a plain boolean check — use it to decide
whether to render a button at all. `assertTransition(from, to)` throws a
readable `Error` naming both the status you were on and every status you
were allowed to move to — call this immediately before any status write, so
an illegal jump is a loud failure at the call site instead of a silently
corrupted queue.

## Optimistic concurrency — why `claimNext` and `applyClaim` are two functions

`claimNext(entries, claimerId)` never touches storage. It looks at whatever
snapshot of the queue the caller currently has — which might be a few
hundred milliseconds stale — and returns a **claim intent**: "claim
whoever's #1, expecting them to still be `waiting`." Two staff tablets that
both fetched the queue a moment ago can compute the exact same intent, aimed
at the exact same person. That is expected, not a bug, as long as *applying*
the intent is a compare-and-swap rather than a blind write:

- **localStorage backend.** Re-read the row by id, check its status is
  still `expectedStatus` (`'waiting'`), and only then write `nextStatus`.
  `applyClaim(serverEntries, intent)` in this file models exactly that
  check against an in-memory array — the same read-check-write shape maps
  directly onto a `db.list` + `db.update` pair.
- **Supabase backend, claiming a specific id.** A single conditional
  `UPDATE` is the atomic guard — the `WHERE` clause *is* the
  compare-and-swap:

  ```sql
  UPDATE queue_entries SET status = 'called', claimed_by = :claimerId
  WHERE id = :id AND status = 'waiting'
  RETURNING *;
  ```

  Zero rows back means someone else's claim landed first — that is a
  normal outcome to branch on, not an error to log and ignore.

- **Supabase backend, "claim whichever is next" with no stale-read gap at
  all** — the `FOR UPDATE SKIP LOCKED` variant named in the seed pattern:

  ```sql
  UPDATE queue_entries SET status = 'called', claimed_by = :claimerId
  WHERE id = (
    SELECT id FROM queue_entries
    WHERE status = 'waiting'
    ORDER BY created_at, id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING *;
  ```

  `SKIP LOCKED` is what makes two concurrent claimers land on *different*
  rows instead of one blocking behind the other's row lock and then
  failing the `status = 'waiting'` check a moment later once it unblocks.

Either way, the loser of a race gets a **truthful outcome** back —
`applyClaim` returns `{ data: null, error: { code: 'stale_claim', message:
'Entry "..." is already "called" — someone else claimed it first.' } }` —
not a silent overwrite, and not a generic failure. `queue.test.mjs`'s
concurrent-claim tests simulate the full race: two intents computed from
one stale snapshot, applied in sequence against a shared "server" array,
one winner, one truthful loser, and a demonstration that the loser can
immediately re-derive and claim whoever the real next person is.

## `waitEstimate`

`waitEstimate(entries, avgServiceMinutes, { servers = 1 })` adds an
`estimatedWaitMinutes` field next to `position`: `(people ahead) / servers`
service rounds, times `avgServiceMinutes`, rounded down. Non-`waiting`
entries get `estimatedWaitMinutes: null` — deliberately, not `0` — because
"how much longer will they wait" does not apply to someone already called
or long gone; a UI can tell "no more wait" (`0`, position 1) apart from
"not part of the wait calculation" (`null`). Throws on a negative or
non-finite `avgServiceMinutes` or a non-positive-integer `servers` — both
are almost always a unit mistake (seconds instead of minutes, `0` servers)
worth catching at the call site rather than silently producing a nonsense
number.

## Verifying this recipe

```bash
node --test src/recipes/queue/queue.test.mjs
```

54 tests: position derivation (arrival order, the `created_at`+`id`
tiebreak, and that the tiebreak is stable regardless of input array order —
the actual "two people take position 3" fix), position stability across a
front-of-queue cancellation, a mid-queue cancellation, and a re-join after
cancelling; the full transition legality matrix (every legal move plus ten
illegal ones, including "skips being called" and every terminal status
refusing to leave); the concurrent-claim simulation described above; and
`waitEstimate` edge cases — an empty queue, position 1, zero
`avgServiceMinutes`, multiple servers splitting the queue proportionally, a
cancelled entry not inflating the estimate for people behind it, and the
four invalid-input throws.
