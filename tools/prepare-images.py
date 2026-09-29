#!/usr/bin/env python3
"""Site Sourced — prepare one hero image into a responsive variant set.

Build-time tool only. It runs on a workstation, never on a demo bundle and never on
a client's site: what it produces is plain `.jpg` files that sit inside the bundle
like any other file, and nothing in a delivered site needs Python, Pillow or this
script to keep working.

What it does, and why each part exists:

* **Re-encodes to real JPEG.** A `.jpg` that is actually a PNG (which is how the
  first three fixtures shipped — 2.2–3.6 MB each) is a bug on its own: a browser, a
  linter and a CDN all disagree about what the file is. The source's real format is
  reported, and the output is always baseline JPEG.
* **Cuts the tier widths** the design system's `srcset` asks for (600 / 900 / 1200 /
  1600 by default), never upscaling: the largest tier is `min(native width, 1600)`,
  and its file is named with its real width so the name never lies.
* **Fits each tier to a byte budget** by stepping the JPEG quality down a ladder
  (84 → 80 → 76 → 72 → 68). If a tier cannot fit even at the bottom of the ladder
  the script writes **nothing** and exits non-zero, with the numbers printed: an
  over-budget hero is exactly what `bun run demo` refuses to publish (see
  `src/demo/weight.ts`), so it should never reach the repo either.
* **Writes nothing else.** No metadata, no EXIF: the input of this script is either
  a CC0/public-domain photograph or a labelled AI-generated illustration, and the
  output carries no camera, GPS or author tag.

Budgets (from `docs/design-system.md` §8): the hero is ≤ 180 KB at its largest
width, and ≤ 120 KB for the file a 360px phone downloads.

Reproducing: the committed `.jpg` files are the artefact of record. To recreate the
smaller tiers from the master file, point `--in` at the largest committed variant:

    <python> tools/prepare-images.py --in test/fixtures/images/barber-hero-1536.jpg \\
        --out-dir test/fixtures/images

See README.md § "Preparing images" for the one-time venv.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

# The tier widths the page's `srcset` is written for.
TIERS = (600, 900, 1200, 1600)

# Byte budget per tier, in KB, straight from docs/design-system.md §8: the hero is
# ≤ 180 KB at its largest width, and ≤ 120 KB for the file a 360px phone downloads.
# Every tier is held to the hero ceiling; the 600 tier — the one a phone actually
# requests — is held to the tighter figure.
TIER_BUDGET_KB = {600: 120}
DEFAULT_BUDGET_KB = 180

# Highest quality first: "high enough that you would show it to a customer" without
# spending bytes a phone does not need. The bottom of the ladder is only reached by a
# tier that is very nearly over budget anyway — it exists so a detailed photograph
# keeps its width rather than being dropped for a few kilobytes.
QUALITY_LADDER = (84, 80, 76, 72, 68, 64, 60)


def encode(image: "Image.Image", quality: int, progressive: bool) -> bytes:
    """One JPEG encode, with no metadata carried over from the source."""
    from io import BytesIO

    buf = BytesIO()
    image.save(
        buf,
        format="JPEG",
        quality=quality,
        optimize=True,
        progressive=progressive,
        # 4:2:0 chroma: the standard for photographs, and cheaper than 4:4:4 at
        # every quality on this ladder.
        subsampling=2,
    )
    return buf.getvalue()


def fit(image: "Image.Image", budget_bytes: int, progressive: bool) -> tuple[bytes, int]:
    """The largest quality on the ladder that fits the budget, or the floor."""
    best = encode(image, QUALITY_LADDER[-1], progressive)
    for quality in QUALITY_LADDER:
        data = encode(image, quality, progressive)
        if len(data) <= budget_bytes:
            return data, quality
        best = data
    return best, QUALITY_LADDER[-1]


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--in", dest="source", required=True, help="the source image (PNG, JPEG or WebP)")
    parser.add_argument("--out-dir", required=True, help="directory to write the variants into")
    parser.add_argument("--base", help="file-name stem (default: the source's stem, without a tier suffix)")
    parser.add_argument("--tiers", default=",".join(str(t) for t in TIERS), help="comma-separated tier widths")
    parser.add_argument("--max-width", type=int, default=TIERS[-1], help="never emit wider than this")
    parser.add_argument("--baseline", action="store_true", help="write baseline JPEGs instead of progressive")
    args = parser.parse_args(argv)

    src = Path(args.source)
    if not src.is_file():
        print(f"error: no such file: {src}", file=sys.stderr)
        return 2

    tiers = sorted({int(t) for t in args.tiers.split(",") if t.strip()})
    out_dir = Path(args.out_dir)
    base = args.base or src.stem
    # A stem that already ends in a tier number ("barber-hero-1536") should not
    # produce "barber-hero-1536-600.jpg".
    for tier in tiers:
        suffix = f"-{tier}"
        if base.endswith(suffix):
            base = base[: -len(suffix)]

    im = Image.open(src)
    real_format = im.format or "unknown"
    if src.suffix.lower() in (".jpg", ".jpeg") and real_format != "JPEG":
        print(f"note: {src.name} is labelled .jpg but its bytes are {real_format} — re-encoding to real JPEG")
    rgb = im.convert("RGB")
    native = rgb.width

    largest = min(native, args.max_width)
    if largest < min(tiers):
        print(f"error: source is only {native}px wide, smaller than the smallest tier", file=sys.stderr)
        return 2
    widths = sorted({w for w in tiers if w < largest} | {largest})

    progressive = not args.baseline
    plan: list[tuple[int, bytes, int, int]] = []
    dropped: list[tuple[int, int, int]] = []
    for width in widths:
        resized = rgb if width == native else rgb.resize((width, round(rgb.height * width / native)), Image.LANCZOS)
        budget_kb = TIER_BUDGET_KB.get(width, DEFAULT_BUDGET_KB)
        budget_bytes = budget_kb * 1024
        data, quality = fit(resized, budget_bytes, progressive)
        if len(data) > budget_bytes:
            # The budget is the design system's, so the tier goes rather than the
            # budget: a smaller file at the same aspect ratio still fills the same
            # box, and nothing on the page says how wide the picture behind it is.
            dropped.append((width, len(data), budget_kb))
            continue
        plan.append((width, data, quality, budget_kb))

    print(f"source {src} — {real_format} {im.width}x{im.height}, re-encoded as {'progressive' if progressive else 'baseline'} JPEG")
    print(f"{'file':<28}{'width':>7}{'height':>8}{'quality':>9}{'bytes':>10}{'budget KB':>11}  fits")
    for width, data, quality, budget_kb in plan:
        height = round(rgb.height * width / native)
        print(f"{base}-{width}.jpg".ljust(28) + f"{width:>7}{height:>8}{quality:>9}{len(data):>10}{budget_kb:>11}  yes")
    for width, size, budget_kb in dropped:
        print(f"{base}-{width}.jpg".ljust(28) + f"{width:>7}{'':>8}{'':>9}{size:>10}{budget_kb:>11}  NO")

    if not plan:
        print(f"\nnothing written: no tier of {src.name} fits its budget even at q{QUALITY_LADDER[-1]}.", file=sys.stderr)
        return 1
    if dropped:
        print(
            "\ndropped "
            + ", ".join(f"{base}-{w}.jpg ({size / 1024:.0f} KB vs {budget} KB at q{QUALITY_LADDER[-1]})" for w, size, budget in dropped)
            + f"\nthe largest tier this image supports is {plan[-1][0]}px; the aspect ratio is unchanged, so the space"
            "\nthe page reserves for the hero is unchanged too."
        )

    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[str] = []
    for width, data, _, _ in plan:
        path = out_dir / f"{base}-{width}.jpg"
        path.write_bytes(data)
        written.append(path.name)

    print("\nwrote " + ", ".join(written) + f" in {out_dir}")
    print("\nrecord snippet (the build re-measures every file and refuses a wrong width):")
    print('  "variants": [')
    for width, _, _, _ in plan:
        print(f'    {{ "file": "images/{base}-{width}.jpg", "width": {width} }},')
    print("  ]")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
