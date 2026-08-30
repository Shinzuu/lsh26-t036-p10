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
| U1 | 1 | — | todo | — |
| U2 | 2 | — | todo | — |
| U3 | 3 | Robiul | pushed | 19:02 — `u3-questions` pushed. `src/features/Questions.jsx` only. Run-out date + target-date input with the four parts reconciling. Verified: esbuild compile, and an SSR harness against a reference engine over all 25 public fixture cases (parts sum to total in every one). Needs U2's `src/lib/tariff.js` + the store, and wiring into `App.jsx`, before it can be checked live. |
| U4 | 4 | — | todo | — |

Status values: `todo` → `building` → `pushed` → **`done-live`**. A row only
earns `done-live` when its note names the exact live-URL check performed —
e.g. "verified live: submitted update, marker recoloured, no reload." "The
crash stopped" is not `done-live`; "looks right" is not `done-live`. The drill
lost a bullet at judging because a fix was marked done off a local check that
was never re-run against the deployed URL.

## Blockers / requests to the integrator

One line each, newest on top. The integrator clears these and deletes the line.

- **U3 → integrator: wire the questions panel into `src/App.jsx`.** `u3-questions` is
  pushed but unreachable from `main.jsx`, so it cannot go live. Exact diff requested:

  ```diff
  + import Questions from './features/Questions.jsx'
  ...
      <main>
  +     <Questions />
      </main>
  ```

  It needs `src/lib/store.js` exporting `useCase()` and U2's `src/lib/tariff.js` exporting
  `projectRunOut`, `requiredRecharge` and `formatBDT` per SPEC-P10. Until both exist the
  import fails at build, so merge U2 first or land the store stub.
- **U3 → integrator: `SPEC.md` is not in this repo.** Copy it from the prep repo's
  `event/SPEC-P10.md`. Also `BOARD.md`'s `FREEZE: __:__` header is still blank.

## Notes — things everyone should know

Gotchas found mid-build: API quirks, deploy traps, licence flags. One line each.

- (none)
