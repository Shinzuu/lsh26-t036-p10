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

- (none)

## Notes — things everyone should know

Gotchas found mid-build: API quirks, deploy traps, licence flags. One line each.

- (none)
