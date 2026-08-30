#!/usr/bin/env bash
# smoke-live.sh — the cheap half of live verification, in one command.
#
# Born from the 27 Aug drill: 16 minutes were lost to a live URL serving a
# stale bundle after a merge, with nobody able to tell whether the deploy or
# the code was wrong, and a bullet was marked "fixed" and reported to judges
# without ever being re-checked against the live URL. Both are one curl away
# from being caught. This script is that curl.
#
# Usage: bash scripts/smoke-live.sh https://app.pages.dev [expected-string ...]
#
# Checks, in order:
#   1. The URL returns HTTP 200 within 10s.
#   2. STALENESS — the live HTML's fingerprinted /assets/index-*.js name is
#      compared against the one baked into your last `npm run build`
#      (dist/index.html). A mismatch means the live bundle is NOT your last
#      local build: someone else deployed, or your deploy didn't land. If
#      dist/ doesn't exist locally, this check is skipped with a note, not
#      silently passed.
#   3. Each expected-string argument is grepped for inside the *deployed* JS
#      bundle — this is what catches "the feature is in the code, so it must
#      be live" claims that were only ever checked in the editor.
#   4. Response time, printed either way, for the record.
#
# Exits non-zero if any check fails. Does not touch git, npm, or wrangler —
# read-only against whatever URL you give it.

set -euo pipefail
cd "$(dirname "$0")/.."

fail=0
note() { printf '  %s\n' "$1"; }
ok()   { printf '\033[32m  ok\033[0m   %s\n' "$1"; }
bad()  { printf '\033[31m  FAIL\033[0m %s\n' "$1"; fail=1; }

if [ "$#" -lt 1 ]; then
  echo "usage: bash scripts/smoke-live.sh https://app.pages.dev [expected-string ...]" >&2
  exit 2
fi

url="$1"; shift
expected=("$@")

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

html="$tmp/live.html"
: > "$html"   # guarantee the file exists even if curl fails outright

echo
echo "smoke-live: $url"
echo "-------------------------------------------------------------"

# --- 1. reachability + timing ----------------------------------------------
resp="$(curl -sS -o "$html" -w '%{http_code} %{time_total}' -m 10 "$url" 2>/dev/null || echo "000 0")"
status="${resp%% *}"
elapsed="${resp##* }"

if [ "$status" = "200" ]; then
  ok "$url returned 200 in ${elapsed}s"
else
  bad "$url returned HTTP $status after ${elapsed}s — is it actually live?"
fi

# --- 2. staleness: live bundle name vs last local build ---------------------
live_js="$(grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' "$html" | head -n1 || true)"

if [ -z "$live_js" ]; then
  bad "no fingerprinted /assets/index-*.js found in the live HTML — wrong URL, build changed shape, or the fetch above failed"
elif [ -f dist/index.html ]; then
  local_js="$(grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' dist/index.html | head -n1 || true)"
  if [ "$live_js" = "$local_js" ]; then
    ok "live bundle matches local dist ($live_js)"
  else
    bad "live bundle differs from local dist — deploy is stale or someone else deployed (live: ${live_js:-none}, local dist: ${local_js:-none})"
  fi
else
  note "no dist/ here — run 'npm run build' first if you want staleness checked against your last build (skipped)"
fi

# --- 3. expected strings inside the deployed bundle --------------------------
if [ "${#expected[@]}" -eq 0 ]; then
  note "no expected strings given — skipping bundle-content check"
elif [ -z "$live_js" ]; then
  bad "cannot check bundle content — no live JS bundle URL found (see check 2 above)"
else
  origin="$(printf '%s' "$url" | grep -oE '^https?://[^/]+')"
  bundle="$tmp/live.js"
  if curl -sS -o "$bundle" -m 10 "${origin}${live_js}"; then
    for s in "${expected[@]}"; do
      if grep -qF -- "$s" "$bundle"; then
        ok "deployed bundle contains \"$s\""
      else
        bad "deployed bundle does NOT contain \"$s\" — it may only exist in your local/uncommitted copy"
      fi
    done
  else
    bad "couldn't download the live JS bundle ($origin$live_js) to check for expected strings"
  fi
fi

echo
if [ "$fail" -eq 0 ]; then
  printf '\033[32msmoke-live passed\033[0m\n\n'
else
  printf '\033[31msmoke-live FAILED — do not report this as working until it passes\033[0m\n\n'
fi
exit "$fail"
