#!/usr/bin/env python3
"""Measure a rendered page's marks from its pixels.

    python3 tools/graphics-contrast.py <shots-dir> [width]

Reads, from `<shots-dir>`:

    rects-<width>.json          the probe boxes, in page coordinates, from the browser
    spec-<width>-vis.png        a full-page shot with the probes visible
    spec-<width>-hidden.png     the same page with every probe `visibility: hidden`, same
                                viewport, same scroll — so the pixel behind each mark is
                                the real surface, not a colour read off the stylesheet

Reports, per probe: the rendered box, the number of changed pixels, the median contrast
over those pixels, the highest contrast any changed pixel reached, and the colours that
actually appear (with counts and ratios). The "exact" column is the contrast of the most
frequent solid colour — the figure that answers WCAG (the median includes every
antialiased edge pixel, where the ratio is a blend and means nothing).

Reads PNGs with `zlib`/`struct` only: no Pillow, no dependency.
"""
import json
import struct
import sys
import zlib
from pathlib import Path

PNG_CHANNELS = {0: 1, 2: 3, 4: 2, 6: 4}


def read_png(path):
    raw = Path(path).read_bytes()
    if raw[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{path}: not a PNG")
    pos, idat, header = 8, bytearray(), None
    while pos < len(raw):
        (length,) = struct.unpack(">I", raw[pos : pos + 4])
        kind = raw[pos + 4 : pos + 8]
        body = raw[pos + 8 : pos + 8 + length]
        if kind == b"IHDR":
            header = struct.unpack(">IIBBBBB", body)
        elif kind == b"IDAT":
            idat += body
        elif kind == b"IEND":
            break
        pos += 12 + length
    width, height, depth, colour, _, _, _ = header
    if depth != 8:
        raise SystemExit(f"{path}: only 8-bit PNGs are read here (got {depth})")
    channels = PNG_CHANNELS[colour]
    data = zlib.decompress(bytes(idat))
    stride = width * channels
    out, prior = [], bytearray(stride)
    at = 0
    for _ in range(height):
        filter_type = data[at]
        at += 1
        line = bytearray(data[at : at + stride])
        at += stride
        for i in range(stride):
            left = line[i - channels] if i >= channels else 0
            up = prior[i]
            upleft = prior[i - channels] if i >= channels else 0
            if filter_type == 1:
                line[i] = (line[i] + left) & 0xFF
            elif filter_type == 2:
                line[i] = (line[i] + up) & 0xFF
            elif filter_type == 3:
                line[i] = (line[i] + ((left + up) >> 1)) & 0xFF
            elif filter_type == 4:
                p = left + up - upleft
                pa, pb, pc = abs(p - left), abs(p - up), abs(p - upleft)
                best = left if (pa <= pb and pa <= pc) else (up if pb <= pc else upleft)
                line[i] = (line[i] + best) & 0xFF
        out.append(bytes(line))
        prior = line
    return width, height, channels, out


def lum(rgb):
    def channel(value):
        value /= 255
        return value / 12.92 if value <= 0.03928 else ((value + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(v) for v in rgb[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def median(values):
    if not values:
        return float("nan")
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def measure(directory, width):
    rects_path = Path(directory) / f"rects-{width}.json"
    payload = json.loads(json.loads(rects_path.read_text().strip()))
    vw, vh, vc, vis = read_png(Path(directory) / f"spec-{width}-vis.png")
    hw, hh, hc, hid = read_png(Path(directory) / f"spec-{width}-hidden.png")
    if (vw, vh) != (hw, hh):
        raise SystemExit("the visible and hidden shots are not the same size")
    rows = []
    for probe in payload["probes"]:
        x0, y0 = int(probe["x"]), int(probe["y"])
        x1, y1 = int(probe["x"] + probe["w"] + 0.999), int(probe["y"] + probe["h"] + 0.999)
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(vw, x1), min(vh, y1)
        changed, counts, totals, peak = [], {}, {}, 0.0
        for y in range(y0, y1):
            vr, hr = vis[y], hid[y]
            for x in range(x0, x1):
                i = x * vc
                j = x * hc
                a = vr[i : i + 3]
                b = hr[j : j + 3]
                if max(abs(a[k] - b[k]) for k in range(3)) <= 6:
                    continue
                r = ratio(a, b)
                changed.append(r)
                counts[tuple(a)] = counts.get(tuple(a), 0) + 1
                totals[tuple(a)] = totals.get(tuple(a), 0.0) + r
                peak = max(peak, r)
        top = sorted(counts.items(), key=lambda kv: -kv[1])[:3]
        floor = max(4, int(0.02 * len(changed))) if changed else 4
        solid = [(rgb, n) for rgb, n in top if n >= floor]
        exact = solid[0][0] if solid else (top[0][0] if top else None)
        rows.append(
            {
                "id": probe["id"],
                "box": [round(probe["w"], 1), round(probe["h"], 1)],
                "changed": len(changed),
                "median": round(median(changed), 2) if changed else None,
                "exact_colour": exact,
                "exact": round(totals[exact] / counts[exact], 2) if exact else None,
                "peak": round(peak, 2) if changed else None,
                "top": [(rgb, n, round(totals[rgb] / n, 2)) for rgb, n in top],
            }
        )
    return rows, payload


def main():
    directory = sys.argv[1] if len(sys.argv) > 1 else "out/graphics-shots"
    widths = [int(sys.argv[2])] if len(sys.argv) > 2 else [360, 1440]
    for width in widths:
        rows, payload = measure(directory, width)
        print(f"\n=== width {width} (page {payload['size'][0]}x{payload['size'][1]}) — {len(rows)} probes")
        print(f"{'probe':34} {'box':>10} {'px':>6} {'median':>7} {'exact':>6} {'peak':>6}  solid colours (rgb: ratio)")
        for row in rows:
            box = f"{row['box'][0]:.0f}x{row['box'][1]:.0f}"
            colours = "  ".join(f"{rgb}: {r}" for rgb, _, r in row["top"][:2])
            print(
                f"{row['id']:34} {box:>10} {row['changed']:>6} "
                f"{(row['median'] if row['median'] is not None else float('nan')):>7} "
                f"{(row['exact'] if row['exact'] is not None else float('nan')):>6} "
                f"{(row['peak'] if row['peak'] is not None else float('nan')):>6}  {colours}"
            )
        Path(directory, f"contrast-{width}.json").write_text(json.dumps(rows, indent=2) + "\n")


if __name__ == "__main__":
    main()
