# Event Start Record

- **Team ID:** `LSH26-T036`
- **Problem ID:** `P10`
- **Repository:** `lsh26-t036-p10`
- **Event start code:** `LSH26-8490-C900`
- **Repository created before release:** No — created at 18:10 on 30 August 2026, after the 17:30 release.

## Material present before 6:00 PM

Every item below comes from one source: a **generic React starter kit the team wrote
before the event**, in the team's own private preparation repository. It contains no
solution to P10 or to any other released problem — it was written before the problems
were known. It was copied into this repository as the first commit,
`Starter kit baseline (pre-existing work, MIT — see LICENSES.md)`, and everything from the
second commit onward is event work.

| Material | Source or original location | What was already present |
|---|---|---|
| Application shell | `starter-kit-react/` in the team's private preparation repository | `index.html`, `src/main.jsx`, `src/App.jsx`, `src/app.css`, `src/lib/Loop.jsx` — a Vite + React 19 + Tailwind 4 shell with a placeholder demo component and template branding |
| Build and deploy configuration | same | `package.json`, `package-lock.json`, `vite.config.js`, `jsconfig.json`, `public/favicon.svg` |
| Storage adapter | same, `src/lib/db.js` | A generic adapter for localStorage or Supabase. Unused in this project — P10 needs no persistence — and deleted before submission |
| Capability library | same, `src/recipes/` | Thirteen generic, self-contained modules with their own `node --test` suites: csv-import, search-filter, charts, auth, upload, map, realtime, llm, bd-formats, export, matching, queue, corroborate. None is specific to any released problem. All of them have now been deleted from this repository; only `src/lib/chart-scale.js`, a copy of the charts recipe's scale helpers, remains, and it is part of the event build |
| Colour palettes | same, `src/themes/` | Five accessible palettes (slate, civic, ochre, plum, noir) as CSS custom-property blocks, plus a contrast test |
| Helper scripts | same, `scripts/` | `preflight.sh` (scans for committed secrets), `smoke-live.sh` (checks a deployed URL returns 200 and serves the expected bundle), `compress-video.sh` |
| Documentation templates | same | `README-TEMPLATE.md`, `SUBMISSION-TEMPLATE.md`, `LICENSES.md`, `BOARD.md`, `DEPLOY.md`, `CLAUDE.md` |
| Database templates | same, `templates/` and `schema.sql` | A generic Supabase roles-and-RLS schema and a permissions template. Unused in this project |

Third-party dependencies and their licences are listed in `LICENSES.md`.

**Sample data.** `src/data/seed-p10.json` is case PUB-01 from the organizers' published
participant release v2.1 fixture `P10_prepaid_meter_public.json`, copied unmodified — 181
consecutive daily readings from 2026-01-01 to 2026-06-30 with the household's recharge
history. It was added during event work, not before 6:00 PM, and is used as the
application's seed so the live URL is never empty. Any case in the same shape can also be
pasted or uploaded.

## Declaration

This file was added in the first event-work commit. The team will preserve the repository
history until results are announced.
