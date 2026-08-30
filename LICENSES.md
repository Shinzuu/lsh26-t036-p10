# LICENSES.md

Everything this project is built from, and the licence it carries. Nothing here is GPL,
LGPL, AGPL, MPL, SSPL, or non-commercial.

## Runtime dependencies — shipped in the browser bundle

| Package | Version | Licence |
|---|---|---|
| react | ^19.2.8 | MIT |
| react-dom | ^19.2.8 | MIT |
| @number-flow/react | ^0.6.2 | MIT |
| lucide-react | ^1.37.0 | ISC |

`@supabase/supabase-js` came with our starter kit and was removed once the storage adapter
was deleted: this project has no backend and imports nothing from it. `motion` was trialled
for card transitions and removed — it cost 40 kB gzipped for a fade, which is a bad trade
for a judge opening the page on mobile data.

## Build and development dependencies — not shipped

| Package | Version | Licence |
|---|---|---|
| vite | ^8.2.0 | MIT |
| @vitejs/plugin-react | ^6.1.0 | MIT |
| tailwindcss | ^4.3.3 | MIT |
| @tailwindcss/vite | ^4.3.3 | MIT |
| wrangler (Cloudflare Pages deploy CLI) | ^4.123.0 | MIT OR Apache-2.0 |

## Pre-existing work of our own

| Asset | Source | Licence |
|---|---|---|
| Starter kit — Vite + React + Tailwind scaffold and helper scripts. Its capability modules and colour palettes were deleted once the build no longer used them; `src/lib/chart-scale.js` is a copy of the charts module's scale helpers | Written by this team before the event, in the team's private preparation repository. Declared in full in `EVENT.md` | MIT, our own code |

## Data

| Asset | Source | Terms |
|---|---|---|
| `src/data/seed-p10.json` | Case PUB-01 from the organizers' P10 participant release v2.1 fixture `P10_prepaid_meter_public.json`, copied unmodified | Supplied by LofiStack to participants for this event |
| The tariff, fixed charges and VAT rate | Stated verbatim in the P10 problem statement and used exactly as written | Supplied by LofiStack |

## Fonts, icons, images, sound

None. The interface uses the browser's own system font stack via Tailwind's defaults, no
icon set, no images beyond the favicon shipped in our starter kit, and no media.

## Added during the event

No third-party library, asset, font or snippet was added after 18:00. The dependency list
is exactly what the pre-existing starter kit carried.
