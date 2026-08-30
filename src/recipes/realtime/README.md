# realtime

Live updates — queues, collaboration, notifications, "someone else just
changed this." A judge opening the app on their phone while you change
something on yours, and watching it update with no refresh, is one of the
strongest sixty-second demo moments available. This recipe is what makes
that moment work across two real devices when Supabase is configured, and
still work with zero setup when it isn't.

## What's here

| File | What |
|---|---|
| `live.js` | Three-tier live-updates adapter. Mirrors `src/lib/db.js`: Supabase env vars set → real `postgres_changes` subscription; no env vars → `BroadcastChannel` across tabs in the same browser; neither → interval polling. Same `subscribe`/`publish`/`status` calls either way. The Supabase tier is multi-subscriber-safe by construction — see gotcha 4. |
| `presence.js` | "Who else is on this screen right now." `join`/`leave`, a live present-users list, and a stale-entry sweep so a browser closed without a clean `leave()` disappears instead of lingering forever. |
| `LiveList.jsx` | A list that patches itself from live events instead of re-rendering: connection-status pill (live / polling / connecting / reconnecting / offline — see "Proving live" below), an "N others viewing" indicator, and a highlight ring on rows that just changed. Subscription setup/teardown lives in `useEffect` cleanup. |
| `verified-live.js` | Wraps `live.js` to refuse to claim `'live'` until it has proof — a real event delivered, not just a socket that reported `SUBSCRIBED`. See "Proving live" below; use it any time a bullet's literal text says *live* / *realtime* / *no reload*. |
| `live.test.mjs` | `node --test src/recipes/realtime/live.test.mjs` — reconnect backoff, event de-duplication, the poll tier's diff logic, and the presence sweep. Passing as shipped, and a real subscribe/publish round trip runs too: Node 22 has a global `BroadcastChannel`, so the tier the test exercises is the same one a no-Supabase demo runs on. |
| `verified-live.test.mjs` | `node --test src/recipes/realtime/verified-live.test.mjs` — the fake-transport suite for `verified-live.js`: proof-of-life, multi-subscriber safety, and the poll-failure honesty checks below. |

## Copy it in

```bash
cp -r src/recipes/realtime src/lib/realtime
```

```jsx
import { useEffect, useState } from 'react'
import { db } from '../lib/db.js'
import { live } from '../lib/realtime/live.js'
import LiveList from '../lib/realtime/LiveList.jsx'

const TABLE = 'items'

export default function ItemsScreen({ myUserId, myName }) {
  const [rows, setRows] = useState([])

  useEffect(() => {
    async function load() {
      const { data } = await db.list(TABLE)
      setRows(data ?? [])
    }
    load()
  }, [])

  async function add(title) {
    const { data, error } = await db.insert(TABLE, { title, done: false })
    if (!error) live.publish(TABLE, { eventType: 'INSERT', row: data, old: null }) // see gotcha 2
  }

  return (
    <LiveList table={TABLE} rows={rows} user={{ id: myUserId, name: myName }} row={(item) => <p>{item.title}</p>} />
  )
}
```

`LiveList` doesn't fetch its own data (recipes don't import `src/lib` — see
`../README.md`); the parent still owns `db.list`/`insert`/`update`/`remove`
exactly like `Loop.jsx`. Drop the `user` prop to skip presence entirely —
the list and the connection pill work without it.

## How the three tiers work

`live.js` picks a backend the same way `db.js` picks one — automatically,
from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`:

1. **Supabase env vars present** → a `postgres_changes` subscription per
   table via Supabase Realtime. Real push, works across two different
   devices — this is the tier that makes the phone-and-laptop demo moment
   happen.
2. **No env vars, `BroadcastChannel` available** (every modern browser,
   including Node 22, which is what `live.test.mjs` runs against) →
   messages posted on a per-table `BroadcastChannel`, received by every
   other tab in the same browser. Zero setup, fully offline.
3. **Neither** → polling every 2.5s against the exact `hack:<table>`
   localStorage key `db.js`'s local backend already writes, diffing the
   snapshot to produce INSERT/UPDATE/DELETE events. Last resort, but never
   silent.

`presence.js` follows the same idea with two tiers instead of three: real
Supabase Presence when configured, otherwise a roster written to
`hack:presence:<screen>` with a heartbeat and a sweep (BroadcastChannel is
used opportunistically for instant same-browser updates in the local tier,
but the sweep works with or without it).

## Proving live — `verified-live.js`

**Use it whenever a bullet's literal text says "live" / "realtime" / "no
reload".** `live.js`'s own status pill turns green the instant a channel
reports `SUBSCRIBED` — the socket opened, nothing more. If the table is
missing from the `supabase_realtime` publication (gotcha 1 below), that pill
stays green while zero events ever arrive. `verified-live.js` wraps `live.js`
(same transport, same reconnect logic — it opens no channel of its own) and
refuses to say `'live'` until a real event has been delivered, polling from
`t=0` as the honest fallback in the meantime. This is playbook rule R4 —
*"fixed" means the acceptance step re-ran and proved it, not that it looked
fixed* — enforced as code instead of as a habit.

```jsx
import { live } from './live.js'
import { createVerifiedLive, liveTransport } from './verified-live.js'
import { db } from '../../lib/db.js'

const verified = createVerifiedLive({
  connect: liveTransport(live),
  fetchRows: (table) => db.list(table).then((r) => r.data ?? []),
})
```

Four status values instead of `live.js`'s three — `'connecting'` (nothing
proven yet), `'polling'` (updates ARE flowing, via the fallback poll — the
feed itself is unproven), `'live'` (a real event arrived; poll stopped),
`'offline'`. **`LiveList.jsx`'s pill already understands all four** — it maps
both vocabularies, so pointing it at `verified.onStatus` instead of
`live.onStatus` (and driving `verified.subscribe` the same way, with
`fetchRows` wired to `db.list`) is the one integration change needed; it
never renders a false "Offline" over a feed that's actually polling. See
`verified-live.test.mjs` for the proof: a table another subscriber already
verified stays `'live'` for a late joiner instead of flapping back down, and
a permanently failing poll (an RLS-denied table, say) degrades to `'offline'`
after three misses instead of claiming `'polling'` forever.

## The three gotchas most likely to bite

**1. Supabase Realtime is OFF by default, per table — and a channel that
never fires looks exactly like a channel that's broken.** Enabling the
Realtime add-on for your project is not enough. Each table needs Realtime
switched on individually: **Database → Replication** in the Supabase
dashboard, then toggle the table (or `Database → Publications` → edit
`supabase_realtime` → add the table, depending on dashboard version).
Forget this and `.subscribe()` still reports `SUBSCRIBED` — the connection
is genuinely fine — but no `postgres_changes` event ever fires for that
table, for anyone, ever. It reads as a code bug and isn't one. This is the
classic 20-minute loss on this recipe; do it **before** the first test of
the live tier, not after it silently does nothing.

**2. The local tiers don't know a write happened unless you tell them.**
Supabase pushes because Postgres itself changed. `BroadcastChannel` and
polling have no database watching for them — call `live.publish(table,
event)` right after a successful `db.insert`/`update`/`remove`, with the
row you just wrote. Skip it and tab A's changes only reach tab B on
`BroadcastChannel`'s next unrelated message, or the poll tier's next
2.5s tick — either "eventually," never "now."

**3. `BroadcastChannel` never delivers a message back to the tab that sent
it — by spec, not by bug.** The tab that just wrote will not see its own
change arrive through `live.subscribe`. That's fine and intentional (it
already has the row from the write itself), but it means your own write
still needs the same optimistic-update pattern `Loop.jsx` uses — don't
wire "add a row" through `live.subscribe` alone or your own tab's list
will never update.

**4. HARD WARNING — one channel name, subscribed once, ever. Supabase
forbids adding a `postgres_changes` callback to a named channel after that
channel has called `.subscribe()`** — call it a second time (say, from a
second component that also wants live updates) and you get a runtime crash,
not a silent no-op. The fix is not "give each caller a try/catch" — it's
"give every table exactly one shared channel for the whole app," with every
listener attached to a `Set` and fanned out from inside a single `.on(...)`
callback, before `.subscribe()` is ever called. **This recipe's `live.js`
does this by construction** — `subscribeSupabase` is built on the
`createSharedChannel` helper (exported, and covered by `live.test.mjs`
directly): every table gets exactly one channel for the whole app, created
before its one `.subscribe()` call, fanned out to a listener `Set`, and torn
down with `removeChannel` only once the last subscriber for that table
leaves. Two `LiveList` instances on the same table, or one that unmounts and
remounts on a tab switch, share the one channel instead of colliding — you
don't have to remember to write this yourself. If you're hand-rolling a
similar data-access module elsewhere in the app (not through this recipe),
the pattern to copy is:

```js
// One shared channel per app, fanned out to every caller. Do this once,
// inside the module — never per-component.
const changeListeners = new Set()
let changeChannel = null

export function subscribeChanges(cb) {
  changeListeners.add(cb)

  if (!changeChannel) {
    const emit = (table, payload) => {
      const event = { table, eventType: payload.eventType, row: payload.new ?? null, old: payload.old ?? null }
      for (const listener of [...changeListeners]) listener(event)
    }
    changeChannel = supabase
      .channel('app-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (p) => emit('items', p))
      // .on(...) again for every other table this app needs — all of them
      // attached BEFORE the one .subscribe() call below, never after.
      .subscribe()
  }

  return () => {
    changeListeners.delete(cb)
    if (changeListeners.size === 0 && changeChannel) {
      supabase.removeChannel(changeChannel)
      changeChannel = null
    }
  }
}
```

This crashed a live hackathon build: the 27 Aug drill's map, updates feed,
dashboard, and shortage board each called `subscribeChanges()` independently
against a fixed-name channel, so an unmount/remount (a tab switch) tore the
channel down to zero listeners and immediately recreated it under the same
name, colliding with a channel that had already subscribed. It was "fixed"
twice — a shared-channel singleton, then a `try/catch` wrapper pasted around
only 1 of 6 call sites — but the wrapper just swallows the crash instead of
preventing it, and the real fix (the pattern above, done once, inside the
data-access module) was never implemented; the bug shipped broken to judging
and was billed across five scoring categories (~15–17 marks, the single most
expensive defect in that drill). **Do not copy a defensive try/catch into
every caller — the listener-Set pattern belongs inside `subscribeChanges()`
(or, if you're using this recipe, it's already inside `live.js`'s
`subscribeSupabase`) exactly once, and every caller gets the fix for free.**

## Presence latency, concretely

`presence.join`'s list updates two ways: instantly when someone else's tab
calls `leave()` cleanly, and only on the next sweep (every 5s by default,
tuned via `sweepIntervalMs`) when a tab disappears without one — a closed
laptop lid, a crashed tab, a killed browser. A stale entry can take up to
`staleMs` (20s default) past its last heartbeat to disappear. That's the
tradeoff that makes "someone closed their laptop" not leave a ghost in "N
others viewing" forever; it is not instant, and shouldn't be tuned much
tighter than the default heartbeat (8s) allows without risking false drops
on a merely slow tab.

## Verifying this recipe

```bash
node --test src/recipes/realtime/live.test.mjs src/recipes/realtime/verified-live.test.mjs
```

43 tests across the two files (`verify.sh` picks up both automatically).
`live.test.mjs` — 24: backoff-delay growth and its cap, `eventKey`/`createDeduper`
(the same change arriving twice must not double-apply), the poll tier's
`diffRows` (INSERT/UPDATE/DELETE detection), `createSharedChannel` — the
gotcha-4 fix itself: two subscribers to the same key share one resource and
both receive an event, unsubscribing one leaves the other live, unsubscribing
the last tears the resource down exactly once, and resubscribing afterwards
opens a genuinely fresh resource, not the torn-down one — `sweepStale`
(keep-fresh, drop-stale, mixed), and a real `live.subscribe`/`live.publish`
round trip on the `BroadcastChannel` tier — including a check that a change
published twice is only ever delivered once. `subscribeSupabase`'s actual
`postgres_changes` wiring isn't covered by this file — it needs a real
project with Realtime enabled per table (gotcha 1 above) — but it's a thin
wrapper around `createSharedChannel`, which is; sanity-check the wiring by
hand: open the app in two tabs (or a laptop and a phone) with `.env` filled
in, change something in one, and watch the other update without a refresh.

`verified-live.test.mjs` — 19, against a faked transport (no network, no
Supabase project): a delivered event, and only a delivered event, flips
status to `'live'`; a status already proven `'live'` does not flap back down
when a second subscriber mounts on the same table (the multi-widget scenario
in the module doc); two subscribers to one table share a single `fetchRows`
call per tick instead of doubling read load; and a `fetchRows` that fails on
every call never claims `'polling'` and degrades to `'offline'` after three
consecutive misses instead of parking there silently forever.

```bash
npx esbuild src/recipes/realtime/LiveList.jsx \
  --loader:.jsx=jsx --jsx=automatic --bundle \
  --external:react --external:react-dom --external:@supabase/supabase-js \
  --outfile=/dev/null
```
