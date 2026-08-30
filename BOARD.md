# Board — who is doing what, right now

**This file is the shared canvas between the four Claude sessions.** Chat and
memory do not sync across devices; this file does. Update your row when your
status changes, commit (`board: U2 building`), push. Pull before reading —
a stale board is worse than no board.

**FREEZE: __:__** — set once, in absolute local time, before the first line of
code, and never moved later. After freeze, only rollbacks and submission
artifacts land, committed by the integrator alone. A freeze time that exists
only in someone's head isn't a freeze — the 27 Aug drill had none written down
anywhere, ran 19 minutes past its own unwritten target, and scored 0/10 on
Speed for it.

| Unit | Bullet | Owner | Status | Last update (time + note) |
|---|---|---|---|---|
| U1 | 1 | shinzuu | pushed | 18:52 — branch `u1-household` pushed. seed-p10.json (PUB-01, 181 days), dataset.js (parseCase/parseCases/monthSummary), dataset.test.mjs (15 tests pass), DataSource.jsx (compiles, build passes). Needs the App.jsx wiring below before it is visible live. |
| U2 | 2 | Rimjhim | building | 18:47 — branch `u2-tariff-engine` cut and pushed. Writing the tariff contract and `node --test` suite first, chart after. |
| U3 | 3 | — | todo | — |
| U4 | 4 | — | todo | — |

Status values: `todo` → `building` → `pushed` → **`done-live`**. A row only
earns `done-live` when its note names the exact live-URL check performed —
e.g. "verified live: submitted update, marker recoloured, no reload." "The
crash stopped" is not `done-live`; "looks right" is not `done-live`. The drill
lost a bullet at judging because a fix was marked done off a local check that
was never re-run against the deployed URL.

## Blockers / requests to the integrator

One line each, newest on top. The integrator clears these and deletes the line.

- **U1 → integrator, 18:52. `src/App.jsx` must render `DataSource` or item 1 is
  invisible on the live URL.** Exact change, on top of the kit baseline:

  ```diff
  -import Loop from './lib/Loop.jsx'
  -import { backend } from './lib/db.js'
  +import DataSource from './features/DataSource.jsx'

  -const APP_NAME = 'Starter'
  -const TAGLINE = 'Rename me before you demo.'
  +const APP_NAME = 'Prepaid Meter Recharge Advisor'
  +const TAGLINE = 'Where the money goes, and when to recharge next.'
   ...
       <main>
  -      <Loop />
  +      <DataSource />
       </main>
  ```

  `DataSource` runs standalone (own state, seeded from PUB-01) and also accepts
  `{ kase, error, onLoad }` — pass those once `src/lib/store.js` exists and it
  becomes controlled with no further change here. The `backend === 'local'`
  localStorage chip should go too: this app has no backend.
- **U1 → integrator/operator, 18:52. `SPEC.md`, `NOTES.md` and `EVENT.md` are not
  in this repo.** SPEC exists in the prep repo at `event/SPEC-P10.md`; I built from
  that copy rather than committing someone else's file. `EVENT.md` is required in
  the first event commit (team `LSH26-T036`, problem `P10`, start code
  `LSH26-8490-C900`, declaration that the starter-kit baseline predates 18:00).
- **U1 → whoever owns NOTES.md, 18:52.** The organizers' `format_note` for P10 is
  truncated mid-sentence at "`source` `readings` uses the case's own", so a
  `source` other than `"readings"` is undocumented. All 25 public cases use
  `"readings"`. Worth one question in the support channel; U4 is the unit it hits.

## Notes — things everyone should know

Gotchas found mid-build: API quirks, deploy traps, licence flags. One line each.

- (none)
