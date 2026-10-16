#!/usr/bin/env bash
# Measure the graphics specimen: sizes and contrast from rendered pixels, the request list,
# and the page with scripting off.
#
#   bash tools/graphics-measure.sh [shots-dir]
#
# What it does, in order:
#   1. serves docs/graphics from a loopback port (the same folder, nothing else);
#   2. at 360 and at 1440: sets the viewport, kills the headless scrollbar gutter, reads the
#      bounding box of every [data-probe], then takes two full-page shots — one with the
#      probes visible and one with every probe `visibility: hidden`, so the pixel *behind*
#      each mark is the real surface rather than a colour read off the stylesheet;
#   3. runs tools/graphics-contrast.py over the two shots to produce the contrast table;
#   4. renders the page once more with JavaScript disabled (tools/graphics-js-off.ts, over
#      the same browser's DevTools socket), lists the requests the page made, and compares
#      the scripting-off pixels with the scripting-on ones.
#
# Scratch only: the default shots directory is under /tmp, so the repository stays clean.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SHOTS="${1:-/tmp/ss-graphics-shots}"
PORT="${PORT:-8317}"
SESSION="gfx-measure"
mkdir -p "$SHOTS"
cd "$REPO"

nohup python3 -m http.server "$PORT" --directory "$REPO/docs/graphics" >"$SHOTS/http.log" 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true; agent-browser --session "$SESSION" close >/dev/null 2>&1 || true' EXIT
sleep 1

URL="http://127.0.0.1:$PORT/graphics-specimen.html"
if [ "$(curl -s -o /dev/null -w '%{http_code}' "$URL")" != "200" ]; then
  echo "the specimen did not serve from $URL — see $SHOTS/http.log" >&2
  exit 1
fi

NOHSCROLL="$(mktemp)"
cat >"$NOHSCROLL" <<'JS'
(function(){var id="ss-noscroll";if(!document.getElementById(id)){var s=document.createElement("style");s.id=id;s.textContent="html{scrollbar-width:none}::-webkit-scrollbar{width:0;height:0}";document.head.appendChild(s);}return document.documentElement.clientWidth;})()
JS
RECTS="$(mktemp)"
cat >"$RECTS" <<'JS'
JSON.stringify({probes:[...document.querySelectorAll('[data-probe]')].map(function(e){var r=e.getBoundingClientRect();return {id:e.getAttribute('data-probe'),x:r.x+window.scrollX,y:r.y+window.scrollY,w:r.width,h:r.height}}),size:[document.documentElement.clientWidth,document.documentElement.scrollHeight]})
JS
HIDE="$(mktemp)"
cat >"$HIDE" <<'JS'
(function(){var id="ss-hide-probes";if(!document.getElementById(id)){var s=document.createElement("style");s.id=id;s.textContent="[data-probe]{visibility:hidden}";document.head.appendChild(s);}return document.querySelectorAll("[data-probe]").length;})()
JS

for WIDTH in 360 1440; do
  agent-browser --session "$SESSION" open "$URL" >/dev/null
  agent-browser --session "$SESSION" set viewport "$WIDTH" 900 >/dev/null
  agent-browser --session "$SESSION" eval -b "$(base64 -w0 "$NOHSCROLL")" >/dev/null
  agent-browser --session "$SESSION" eval -b "$(base64 -w0 "$RECTS")" > "$SHOTS/rects-$WIDTH.json"
  agent-browser --session "$SESSION" screenshot --full "$SHOTS/spec-$WIDTH-vis.png" >/dev/null
  agent-browser --session "$SESSION" eval -b "$(base64 -w0 "$HIDE")" >/dev/null
  agent-browser --session "$SESSION" screenshot --full "$SHOTS/spec-$WIDTH-hidden.png" >/dev/null
  python3 - "$SHOTS/spec-$WIDTH-vis.png" <<'PY'
import struct, sys
data = open(sys.argv[1], "rb").read(33)
print(f"  {sys.argv[1]}: {struct.unpack('>II', data[16:24])[0]}px wide")
PY
done

python3 tools/graphics-contrast.py "$SHOTS" 360
python3 tools/graphics-contrast.py "$SHOTS" 1440

# The page with scripting off, over the same browser's DevTools socket.
agent-browser --session "$SESSION" open "$URL" >/dev/null
agent-browser --session "$SESSION" set viewport 360 900 >/dev/null
agent-browser --session "$SESSION" eval -b "$(base64 -w0 "$NOHSCROLL")" >/dev/null
CDP_ORIGIN="$(agent-browser --session "$SESSION" get cdp-url | sed -E 's#(ws://[^/]+)/.*#\1#')"
CDP_HTTP="${CDP_ORIGIN/ws:/http:}"
bun run tools/graphics-js-off.ts "$URL" "$CDP_HTTP" "$SHOTS/js-off.json" "$SHOTS/js-off-top.png"

PYTHON="${IMAGING_PYTHON:-/home/team/shared/.tools/imaging-venv/bin/python}"
[ -x "$PYTHON" ] || PYTHON=python3
"$PYTHON" - "$SHOTS" <<'PY'
import hashlib, sys
from pathlib import Path
shots = Path(sys.argv[1])
try:
    from PIL import Image
except ImportError:
    print("Pillow is not available here: compare the scripting-off picture by eye")
    raise SystemExit(0)
full = Image.open(shots / "spec-360-vis.png").convert("RGB")
off = Image.open(shots / "js-off-top.png").convert("RGB")
crop = full.crop((0, 0, off.width, off.height))
same = hashlib.sha256(crop.tobytes()).hexdigest() == hashlib.sha256(off.tobytes()).hexdigest()
print(f"\nscripting off: the first {off.width}x{off.height} pixels are "
      f"{'byte-identical' if same else 'DIFFERENT'} with script execution disabled")
PY
