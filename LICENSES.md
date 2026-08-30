# Third-Party Material and AI Disclosure

Material frameworks, libraries, starters, templates, UI kits, fonts, icons and assets used
in this repository. Nothing here is GPL, LGPL, AGPL, MPL, SSPL or non-commercial.

| Name | Version or source URL | Licence | Used for |
|---|---|---|---|
| react | ^19.2.8 · <https://react.dev> | MIT | The user interface |
| react-dom | ^19.2.8 | MIT | Rendering React to the browser |
| @number-flow/react | ^0.6.2 · <https://number-flow.barvian.me> | MIT | Animating the money figures between values when the target date or household changes |
| lucide-react | ^1.37.0 · <https://lucide.dev> | ISC | Icons on the load controls and the headline figures |
| vite | ^8.2.0 | MIT | Build tooling — not shipped to the browser |
| @vitejs/plugin-react | ^6.1.0 | MIT | Build tooling — not shipped |
| tailwindcss | ^4.3.3 | MIT | Styling |
| @tailwindcss/vite | ^4.3.3 | MIT | Build tooling — not shipped |
| wrangler | ^4.123.0 | MIT OR Apache-2.0 | Cloudflare Pages deploy CLI — not shipped |
| Our own starter kit — Vite + React + Tailwind scaffold and helper scripts | Written by this team before the event in the team's private preparation repository; declared in full in `EVENT.md` | MIT, our own code | The application shell and the `preflight.sh` / `smoke-live.sh` scripts. `src/lib/chart-scale.js` is a copy of its charts module's scale helpers |
| P10 sample data — case PUB-01 and the 25-case pack | Organizers' `P10_prepaid_meter_public.json`, copied unmodified | Supplied by LofiStack to participants | `src/data/seed-p10.json` (the seeded household) and `src/data/cases-p10.json` (the household selector) |
| The tariff, fixed charges and VAT rate | Stated verbatim in the P10 problem statement and used exactly as written | Supplied by LofiStack | The whole calculation |

No fonts, icon sets beyond `lucide-react`, images, audio or video were used. The interface
uses the browser's own system font stack.

Two dependencies that came with our starter kit were removed rather than shipped:
`@supabase/supabase-js`, because the storage adapter it served was deleted and this
application has no backend, and `motion`, which was trialled for card transitions and
dropped because it cost 40 kB gzipped for a fade.

## AI tools

**Claude Code (Anthropic)** — the only AI tool used. It assisted with reading and reconciling
the organizer documents, drafting the build specification, and implementing units against it.
Its output was verified by 57 `node --test` cases covering every slab boundary, the
calendar-month reset and the once-per-month fixed charges; by an independently computed
reference over all 25 published cases for item 4; by each required item being tested by a
team member who had not built it, against their own reference written from the problem text
rather than from our code; and by confirming every item on the deployed URL rather than
locally. Also recorded in `evaluation-manifest.json`.

## Original-work statement

Everything not declared in this file or `EVENT.md` was created by the registered team during
the event window.
