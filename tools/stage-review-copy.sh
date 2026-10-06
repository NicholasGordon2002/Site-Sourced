#!/usr/bin/env bash
# stage-review-copy.sh — put freshly built demo bundles into the team site's WORKING copy so the
# owner can open them on a phone, WITHOUT publishing.
#
# Why this exists: the dev domain serves the WORKING copy of site/public/demo while the live domain
# serves the published snapshot (proven by marker probe, 6 Oct 2026). So a review link can show new
# work while the published pair the owner is judging stays untouched. Doing that copy by hand is
# where mistakes happen (an important file left behind, or manifest.json/README.txt leaking into a
# world-readable path), so the copy and its checks live here.
#
# Usage:  tools/stage-review-copy.sh [slug ...]
#         (default: the two review demos, maple-avenue-barber-shop northshore-garden-works)
# Expects: out/demos/<slug>/ already built (`bun run demo:fixtures` in the pipeline repo).
set -euo pipefail

PIPELINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_DEMO="/home/team/shared/site/public/demo"
DEV_BASE="https://99ffee1c9a8b4a6ccdd3567892c8fd80-dev.ctonew.app"
SLUGS=("$@")
[ ${#SLUGS[@]} -eq 0 ] && SLUGS=(maple-avenue-barber-shop northshore-garden-works)

fail=0
for slug in "${SLUGS[@]}"; do
  SRC="$PIPELINE/out/demos/$slug"
  DST="$SITE_DEMO/$slug"
  echo "=== $slug ==="
  if [ ! -f "$SRC/index.html" ]; then
    echo "  FAIL: $SRC/index.html not found — build the fixtures first"; fail=1; continue
  fi

  rm -rf "$DST"; mkdir -p "$DST"
  rsync -a --exclude='manifest.json' --exclude='README.txt' --exclude='img/' "$SRC/" "$DST/"

  # 1. the published bytes ARE the build's bytes
  if diff -r -x manifest.json -x README.txt -x img "$SRC" "$DST" >/dev/null; then
    echo "  bytes identical to the build ✓"
  else
    echo "  FAIL: staged copy differs from the build"; fail=1
  fi

  # 2. internals must not be reachable (manifest.json records the form recipient and internal notes)
  leaked=$(find "$DST" -name manifest.json -o -name README.txt | wc -l)
  [ "$leaked" -eq 0 ] && echo "  no internal files staged ✓" || { echo "  FAIL: $leaked internal file(s) staged"; fail=1; }

  # 3. demo furniture and the real form endpoint
  grep -q 'name="robots" content="noindex' "$DST/index.html" \
    && echo "  noindex present ✓" || { echo "  FAIL: noindex missing"; fail=1; }
  grep -q 'unsolicited design proposal' "$DST/index.html" \
    && echo "  proposal banner present ✓" || { echo "  FAIL: banner missing"; fail=1; }
  action=$(grep -o 'action="[^"]*"' "$DST/contact.html" | head -1)
  case "$action" in
    *submit-form.com*) echo "  form posts to the real endpoint ($action) ✓" ;;
    *) echo "  FAIL: form action looks wrong: $action"; fail=1 ;;
  esac
  echo "  files: $(find "$DST" -type f | wc -l)  size: $(du -sh "$DST" | cut -f1)"

  # 4. the dev domain really serves what we just staged (catch a stale/impatient review link).
  #    The dev server INJECTS one live-reload <script> (__engine_reload_attempt → EventSource
  #    "/__engine/events") into every page it serves — verified 6 Oct. So strip exactly that line and
  #    compare; anything else differing means the review link is not serving what we staged.
  #    Consequence for evidence: the dev URL is a preview, so it must NEVER be used to prove
  #    "works without JavaScript" — that check belongs on the local harness.
  code=$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 25 "$DEV_BASE/demo/$slug")
  served=$(curl -s -L --max-time 25 "$DEV_BASE/demo/$slug" | grep -v '__engine_reload_attempt')
  if [ "$code" = "200" ] && [ "$served" = "$(cat "$DST/index.html")" ]; then
    echo "  dev review link serves this build ✓  $DEV_BASE/demo/$slug"
  else
    echo "  WARN: dev link returned $code and its bytes do not match what we staged"
    echo "        (the working site may need a moment, or the copy did not land)"
  fi
done

[ "$fail" -eq 0 ] && echo "STAGED OK — nothing published; review links above." || echo "STAGING FAILED — do not send review links." >&2
exit "$fail"
