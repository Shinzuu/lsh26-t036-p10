# Hackathon build — read before any work

This is a LofiStack Hackathon 2026 problem repo, built under a 4-hour clock ending
22:00. Scoring facts that override normal instincts:

1. **The 4 MVP bullets in README.md are the spec.** They are pass/fail, checked by a
   judge in under a minute each. Build them in order. Nothing else — no extra feature,
   no refactor, no polish — starts until all four pass on the LIVE deployed URL.
2. **The live URL is the product.** `npm run deploy -- --project-name <name>` after
   every completed bullet. What is live at 22:00 gets screenshotted and judged; local
   work counts for nothing. Verify claims against the deployed URL, not localhost.
   `bash scripts/smoke-live.sh <url> [expected-string ...]` automates that check —
   200, staleness against your last local build, and a grep for what you shipped
   inside the live bundle — the 27 Aug drill lost 16 minutes to a stale deploy and
   a bullet marked "fixed" that was never re-checked live.
3. **After the team calls the code freeze (~21:15), no commits.** Every commit after
   the freeze costs real marks (early-submission bonus). If asked to fix something
   post-freeze, flag the cost first.
4. **UI/UX marks come from states, not decoration:** empty state, loading state, error
   state, usable at phone width, labelled controls, bad input → message not crash.
   Tailwind defaults done consistently are enough; decoration scores zero.
5. **Technical marks come from a clean data model and separation of concerns.** Name
   things after the domain. Keep state in one place (`src/lib/`). Deployed properly
   beats clever.
6. **Every new dependency or asset goes into LICENSES.md immediately.** MIT / Apache-2.0
   / BSD / ISC only. Never GPL, LGPL, AGPL, MPL, SSPL, or non-commercial assets.
7. **Never commit secrets.** `.env` is gitignored; only `VITE_`-prefixed public values
   (Supabase anon key) belong there. No service_role keys anywhere, ever.
8. **`src/recipes/` holds pre-solved capabilities** (csv-import, search-filter, charts,
   auth, upload, map, realtime, llm, bd-formats, export, matching, queue,
   corroborate). Copy the needed one into `src/lib/` and edit freely; delete
   unused recipes before the freeze.
   `src/recipes/realtime/verified-live.js` is the one to reach for whenever a
   bullet's literal text says *live* / *realtime* / *no reload* — it refuses to
   report the feed as working until a real event has proven it, instead of
   trusting a socket that only says `SUBSCRIBED`. See its README section
   "Proving live".
8a. **`src/themes/` holds five drop-in accessible palettes** (React kit only —
    no Svelte equivalent). Pick one at 18:25, add one `@import` line to
    `src/app.css`, never think about it again — see `src/themes/README.md`.
    | Theme | Reach for it when |
    |---|---|
    | `slate` | Default — no strong domain colour, dashboards, CRUD, internal tools |
    | `civic` | Forms and records — registration, complaints, permits |
    | `ochre` | Operations — dispatch, queues, delivery tracking, inventory |
    | `plum` | Consumer-facing — marketplace, feed, booking |
    | `noir` | Everything at AAA — insurance policy for a bad screen or daylight demo |
9. Seed demo data on first load. A judge must reach the core loop with zero setup —
   no signup wall, or demo credentials printed on the landing page.
10. When a task is done, state what was verified on the live URL. Do not report a
    subagent's claim as fact without checking.

## Four devices, one repo — sync rules

Four team members each run their own Claude Code session on their own machine.
Sessions share nothing except this repo — **if it matters to more than one
device, it goes in a committed file, not in chat.**

- **Start of every session:** `git pull --rebase` first, then read `SPEC.md`
  and `BOARD.md`.
- **`BOARD.md` is the shared canvas.** It shows what every device is doing.
  Update your unit's row on every status change (`todo` → `building` →
  `pushed` → `done-live`), commit (`board: U2 building`), push. Before
  starting anything, pull and read it — that is how you know what the other
  three Claudes are doing. `done-live` is only valid when your commit names
  the live-URL check you actually performed ("verified live: submitted
  update, marker recoloured, no reload") — "the crash stopped" is not
  `done-live`. The drill shipped a bullet marked fixed off a local check that
  was never re-run against the deployed URL; it broke live at judging.
- **Unit ownership:** `SPEC.md` assigns each unit an owner. Build only your
  unit; never touch another owner's files, even for a quick fix — report the
  problem instead.
- **Integrator-only files** (`src/App.jsx`, the state module, `src/app.css`,
  `index.html`, `package.json`) are touched by the integrator (shinzuu) and
  nobody else — **even for a redesign, even if you're sure your version is
  better.** Need a change there? Post the exact diff as a request on
  `BOARD.md`; do not make the edit yourself. The drill lost 16 minutes to two
  sessions independently rewriting `App.jsx` from the same base — reconciling
  the divergence ate the exact window a real bug fix needed.
- **Any `SPEC.md` rewrite (v2, v3…) gets diffed line-by-line against the
  sealed problem statement before it merges.** "Our design wants X" never
  silently overrides "the bullet says Y" — if a pivot changes the access
  model or scope mid-build, re-read every already-fixed bullet's literal text
  against the new design before locking `SPEC.md` back in. The drill's SPEC
  v2 quietly gated a bullet's public-visible field behind login during an RLS
  pivot; the sealed problem text had no such gate and nobody caught the
  contradiction before freeze — five marks for zero minutes of prevention.
- **A known bug on a scored bullet outranks all docs, polish, and badge
  work — always.** Don't merge a README/LICENSES/badge commit while any
  bullet-level defect is open on the board; if the real fix won't fit in the
  time left, ship the fallback that satisfies the bullet's literal wording
  instead. The drill spent its last 28 minutes on merge fallout, README, and
  decorative badges while a diagnosed ~30-minute realtime fix — named in the
  team's own code comment — sat unimplemented; that one bug cost 15–17 marks
  across five scoring categories.
- **Push immediately** when your unit's done-when passes: commit prefixed with
  the unit (`U2: …`), `git pull --rebase` if rejected, never `--force`.
- **Deploys are the integrator's job** — one device runs `npm run deploy`, after
  every merged unit. Everyone verifies on the live URL it produces.
- **Mid-build discoveries** that affect others (API quirk, deploy trap, licence
  issue) get one line in `NOTES.md`, committed and pushed — chat evaporates,
  files sync.
