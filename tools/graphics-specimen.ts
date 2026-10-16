#!/usr/bin/env bun
/**
 * The graphics layer's specimen page: the whole layer on one page a non-designer can open
 * and judge, at 360px and at 1440px, with its own measured table printed on it.
 *
 *   bun run tools/graphics-specimen.ts            # writes docs/graphics/
 *   bun run tools/graphics-specimen.ts --check    # rebuilds in memory and diffs the file
 *
 * What it writes (all committed, so a reviewer needs to run nothing):
 *
 *   docs/graphics/graphics-specimen.html   the page
 *   docs/graphics/fonts/*.woff2 + OFL.txt  the two fonts the demos already ship
 *
 * **This is not a demo page and it is not wired into any bundle.** It is a docs artifact:
 * it carries no proposal banner, no footer disclaimer and no business's details, because
 * it is not a proposal to anybody — it is the layer laid out for judging. Its own CSS is
 * the real stylesheet (`renderCss()` for the salon category) plus the real layer
 * (`graphicsCss()`), so a thing that looks wrong here looks wrong on a wired page; the
 * only extra rules are the specimen's own swatch chrome, which is marked as such and never
 * imported by the generator.
 *
 * Every element the contrast table measures carries `data-probe`; `tools/graphics-measure`
 * reads their boxes from the browser and samples them out of a screenshot. The probes are
 * the drawing only (never the label, never the swatch's padding), so a number in the table
 * is about the mark and its surface and nothing else.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { profileFor } from "../src/demo/copy.ts";
import {
  DIVIDER_NAMES,
  DIVIDERS,
  GRAPHICS_BYTE_CAPS,
  GRAPHICS_VERSION,
  ICONS,
  ICON_NAMES,
  type IconName,
  MAP_CAPTION,
  PATTERN_NAMES,
  PATTERNS,
  WORDMARK_NOTE,
  divider,
  graphicsByteReport,
  graphicsCss,
  graphicsParts,
  ground,
  icon,
  monogram,
  schematicMap,
  wordmark,
} from "../src/demo/graphics.ts";
import { renderCss } from "../src/demo/render.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

const OUT_DIR = join(import.meta.dir, "..", "docs", "graphics");
const FONT_DIR = join(import.meta.dir, "..", "src", "demo", "assets", "fonts");
const FONT_FILES = ["fraunces-latin-600.woff2", "source-sans-3-latin.woff2", "OFL.txt"];

/** The category the specimen is drawn in: the salon accent, the one the plan screenshots use. */
const SPECIMEN_RECORD: BusinessRecord = {
  name: "Maple Avenue Barber Shop",
  category: "Barber shop",
  city: "Hamilton, ON",
  form_recipient: "unused@example.invalid",
};

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(2)} KB`;

/** The specimen's own chrome. Not the layer: swatch boxes, grids and the label type. */
const SPECIMEN_CSS = `
/* ------------------------------------------------- specimen chrome (not the layer)
   Layout for judging only. Nothing here is imported by the generator: it is this page's
   own scaffolding, and the layer itself is written by graphicsCss() above. */
.sp { padding-block: var(--s-7); border-top: var(--rule); }
.sp:first-of-type { border-top: 0; }
.sp h2 { margin-bottom: var(--s-2); }
.sp-intro { max-width: 34em; color: var(--muted); }
.sp-note {
  background: var(--accent-soft);
  border-left: 4px solid var(--accent);
  border-radius: var(--r-md);
  padding: var(--s-3) var(--s-4);
  margin-block: var(--s-5);
  font-size: var(--fs-small);
}
.sp-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2); margin-top: var(--s-3); }
.sp-grid > * { min-width: 0; }
.sp-cell__name { overflow-wrap: anywhere; }
@media (min-width: 48rem) { .sp-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
@media (min-width: 64rem) { .sp-grid--icons { grid-template-columns: repeat(7, minmax(0, 1fr)); } }
.sp-cell {
  min-width: 0;
  border: var(--rule);
  border-radius: var(--r-md);
  padding: var(--s-2) var(--s-3);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-2);
  min-height: 64px;
}
.sp-cell--on-ink { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.sp-cell--pattern {
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: var(--s-1);
  min-height: 0;
}
.sp-cell--pattern .sp-cell__name { text-align: left; }
.sp-cell--on-paper2 { background: var(--paper-2); }
.sp-cell__marks { display: flex; align-items: center; gap: var(--s-3); min-height: 24px; }
.sp-cell__name { font-size: var(--fs-label); letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); text-align: right; }
.sp-cell--on-ink .sp-cell__name { color: var(--footer-ink); }
.sp-swatch { display: block; width: 100%; height: 96px; border: var(--rule); border-radius: var(--r-md); overflow: hidden; }
.sp-ground-demo { padding: var(--s-4); border-radius: var(--r-md); }
.sp-ground-demo p { margin: 0; line-height: 28px; }
.sp-dividers { display: grid; gap: var(--s-5); margin-top: var(--s-4); }
.sp-divider-row { display: grid; gap: var(--s-2); }
.sp-divider-row__label { font-size: var(--fs-label); letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.sp-pair { display: grid; gap: var(--s-4); margin-top: var(--s-4); }
.sp-pair > * { min-width: 0; }
@media (min-width: 48rem) { .sp-pair { grid-template-columns: 1fr 1fr; } }
.sp-panel { border: var(--rule); border-radius: var(--r-lg); padding: var(--s-4); display: grid; gap: var(--s-3); }
.sp-panel--on-ink { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.sp-caption { font-size: var(--fs-small); color: var(--muted); }
.sp-panel--on-ink .sp-caption { color: var(--footer-ink); }
.sp-figure { margin: 0; display: grid; gap: var(--s-2); }
.sp-table { width: 100%; border-collapse: collapse; margin-top: var(--s-3); font-size: var(--fs-small); }
.sp-table th, .sp-table td { text-align: left; padding: var(--s-2); border-bottom: var(--rule); }
.sp-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
.sp-head { display: flex; flex-wrap: wrap; gap: var(--s-3); align-items: baseline; justify-content: space-between; }
`;

function iconCell(name: IconName, surface: "paper" | "paper2" | "ink"): string {
  const surfaceClass = surface === "ink" ? " sp-cell--on-ink" : surface === "paper2" ? " sp-cell--on-paper2" : "";
  return `        <div class="sp-cell${surfaceClass}">
          <span class="sp-cell__marks">
            <span data-probe="icon-${name}-24-${surface}">${icon(name, { size: 24 })}</span>
            <span data-probe="icon-${name}-20-${surface}">${icon(name, { size: 20 })}</span>
          </span>
          <span class="sp-cell__name">${name}</span>
        </div>`;
}

function stylesheet(): string {
  return `${renderCss(profileFor(SPECIMEN_RECORD), "graphics-specimen")}
${graphicsCss()}
${SPECIMEN_CSS}`;
}

function render(): string {
  const report = graphicsByteReport();
  // The stylesheet is a separate file, for the same reason a demo's is: it makes this
  // page's request list the real one (its own folder, three files, no third-party origin).
  const name = SPECIMEN_RECORD.name;
  const rows = report.parts
    .map(
      (part) =>
        `            <tr><th scope="row">${part.name}</th><td class="num">${part.bytes} B</td><td class="num">${part.cap ?? "—"}</td><td class="num">${kb(part.bytes)}</td></tr>`,
    )
    .join("\n");
  const iconTable = ICON_NAMES.map(
    (name_) => `        <tr><th scope="row">${name_}</th><td>${ICONS[name_].note}</td></tr>`,
  ).join("\n");

  return `<!doctype html>
<html lang="en" class="page page--specimen">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Docs artifact, not a demo and not a business's page: never indexed, never published. -->
<meta name="robots" content="noindex, nofollow">
<title>Graphics layer specimen — Site Sourced (${GRAPHICS_VERSION})</title>
<!-- Generated by tools/graphics-specimen.ts. Edit the generator or src/demo/graphics.ts,
     never this file: re-running the generator reproduces it byte for byte. -->
<link rel="stylesheet" href="styles.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="sp">
  <div class="wrap sp-head">
    <span data-probe="wordmark-header">${wordmark(name, { mark: true })}</span>
    <p class="sp-caption">Graphics layer specimen ${GRAPHICS_VERSION}</p>
  </div>
</header>
<main id="main">
  <div class="wrap">
    <section class="sp">
      <h1>Graphics layer</h1>
      <p class="sp-intro">Every mark below is hand-drawn in this repository — inline SVG and CSS, no icon set bought, borrowed or scraped, no font service, no CDN. Nothing on this page loads a file from anywhere but this folder.</p>
      <p class="sp-note"><strong>Internal specimen.</strong> This page exists so the layer can be judged on a phone before any demo is wired to it. It is not a demo, it is not published, and no demo page carries these marks yet.</p>
    </section>

    <section class="sp">
      <div class="sp-head">
        <h2>Icons at both sizes, on all three surfaces</h2>
      </div>
      <p class="sp-intro">Each icon sits beside its own name: the drawing is decoration and the label carries the meaning, so nothing on a page depends on a glyph being understood. The same set is drawn on paper, on the warm secondary surface and on the ink surface — the stroke is <code>currentColor</code>, so the mark follows whatever surface it is on instead of carrying a colour of its own.</p>

      <h3>On paper, at 24px and 20px</h3>
      <div class="sp-grid sp-grid--icons">
${ICON_NAMES.map((n) => iconCell(n, "paper")).join("\n")}
      </div>

      <h3>On the warm secondary surface, at 24px and 20px</h3>
      <div class="sp-grid sp-grid--icons">
${ICON_NAMES.map((n) => iconCell(n, "paper2")).join("\n")}
      </div>

      <h3>On the ink surface, at 24px and 20px</h3>
      <div class="sp-grid sp-grid--icons">
${ICON_NAMES.map((n) => iconCell(n, "ink")).join("\n")}
      </div>

      <h3>What each mark is for</h3>
      <table class="sp-table">
        <tbody>
${iconTable}
        </tbody>
      </table>
    </section>

    <section class="sp">
      <h2>Section grounds</h2>
      <p class="sp-intro">What a section carries when there is no photograph clean enough to use, and the quiet texture a section gets when it needs to read as a different surface. All five are CSS gradients — no image, no file, no request — and they draw in <code>currentColor</code>, so the same ground is a warm hairline on paper and white on ink.</p>
      <div class="sp-grid">
${PATTERN_NAMES.map(
  (n) => `        <div class="sp-cell sp-cell--pattern">
          <span class="sp-swatch ${ground(n)}${n === "no-photo" ? "" : ""}" data-probe="ground-${n}"${n === "no-photo" ? "" : ""}></span>
          <span class="sp-cell__name">${n}</span>
          <span class="sp-caption">${PATTERNS[n].note}</span>
        </div>`,
).join("\n")}
      </div>
      <div class="sp-pair">
        <div class="sp-panel">
          <h3 style="margin:0">A ground on paper, in context</h3>
          <div class="${ground("rules")} gfx-ground--on-paper sp-ground-demo">
            <p style="margin:0"><strong>Opening hours</strong></p>
            <p style="margin:0">A ruled ground sits behind a short list without becoming a table nobody asked for.</p>
          </div>
        </div>
        <div class="sp-panel sp-panel--on-ink">
          <h3 style="margin:0">The same ground over ink</h3>
          <div class="${ground("rules")} gfx-ground--on-ink sp-ground-demo">
            <p style="margin:0"><strong>The no-photograph hero</strong></p>
            <p style="margin:0">When a bundle has no usable photograph, the first screen is an ink ground with arcs and one accent hairline — never a gradient pretending to be a picture.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="sp">
      <h2>Dividers</h2>
      <p class="sp-intro">One arc, the same arc doubled, a three-rule stripe and a hairline broken by an accent mark. Each stretches to the width it is given while its stroke stays 1px, so a divider does not get heavier on a wide screen.</p>
      <div class="sp-dividers">
${DIVIDER_NAMES.map(
  (n) => `        <div class="sp-divider-row">
          <span class="sp-divider-row__label">${n}</span>
          <span data-probe="divider-${n}">${divider(n)}</span>
          <span class="sp-caption">${DIVIDERS[n].note}</span>
        </div>`,
).join("\n")}
      </div>
    </section>

    <section class="sp">
      <h2>The schematic map</h2>
      <p class="sp-intro">A stand-in for the map a visitor would open, and plainly not that map: a street plan with no street name, no compass, no scale and no coordinates in it. A demo cannot honestly place a marker — a fictional fixture's address is invented, and a real record's coordinates are not something the record carries — so the drawing carries no geography and its caption does the talking.</p>
      <figure class="sp-figure">
        <span data-probe="map">${schematicMap()}</span>
        <figcaption class="sp-caption">${MAP_CAPTION} The drawing is <code>aria-hidden</code>; this sentence is what a screen reader gets, and it is the whole point of the component.</figcaption>
      </figure>
    </section>

    <section class="sp">
      <h2>The wordmark</h2>
      <p class="sp-intro">${WORDMARK_NOTE} The initials come from the record's own name and nothing is invented; there is no logo, because a business's own mark is the one thing we may never draw.</p>
      <div class="sp-pair">
        <div class="sp-panel">
          <span class="sp-caption">Name, accent rule, mark — 28px mark, as a header would set it</span>
          <span data-probe="wordmark-paper">${wordmark(name, { mark: true })}</span>
          <span class="sp-caption">Name and rule only, where a mark would be a second copy of the same idea</span>
          <span data-probe="wordmark-rule-paper">${wordmark(name)}</span>
        </div>
        <div class="sp-panel sp-panel--on-ink">
          <span class="sp-caption">The same lockup on the ink surface</span>
          <span data-probe="wordmark-ink" class="gfx-ground--on-ink">${wordmark(name, { mark: true, size: 40 })}</span>
          <span class="sp-caption">The mark alone, at 40px</span>
          <span data-probe="monogram-40">${monogram(name, { size: 40 })}</span>
        </div>
      </div>
    </section>

    <section class="sp">
      <h2>What the layer costs</h2>
      <p class="sp-intro">Measured from the layer's own output, byte for byte. It adds <strong>no file and no request</strong> to a bundle: the marks are inline markup and the stylesheet is already fetched. The caps are the build's own refusal limits — <code>graphicsProblems()</code> fails a demo build that writes more.</p>
      <table class="sp-table">
        <thead><tr><th scope="col">Part</th><th scope="col" class="num">Bytes</th><th scope="col" class="num">Cap</th><th scope="col" class="num">Size</th></tr></thead>
        <tbody>
${rows}
          <tr><th scope="row">Whole layer</th><td class="num">${report.layerBytes} B</td><td class="num">${report.layerCap}</td><td class="num">${kb(report.layerBytes)}</td></tr>
        </tbody>
      </table>
      <p class="sp-caption">Files this page loads from anywhere but this folder: <strong>none</strong>. Requests it makes to another origin: <strong>none</strong>. Icons: ${ICON_NAMES.length}. Dividers: ${DIVIDER_NAMES.length}. Grounds: ${PATTERN_NAMES.length}. The layer's parts: ${graphicsParts().length}. The page carries no <code>&lt;script&gt;</code> at all, so it renders identically with scripting off; its only files are the two fonts beside it, which every demo already ships.</p>
    </section>
  </div>
</main>
<footer class="site-footer">
  <div class="wrap">
    <p class="footer-small">Internal specimen — generated by <code>tools/graphics-specimen.ts</code> from <code>src/demo/graphics.ts</code> (${GRAPHICS_VERSION}). Not a demo page, not published, and no demo bundle carries these marks yet.</p>
  </div>
</footer>
</body>
</html>
`;
}

/** Writes the page and the fonts beside it; `--check` proves the committed file is current. */
function main(): void {
  const check = process.argv.includes("--check");
  const html = render();
  const target = join(OUT_DIR, "graphics-specimen.html");
  const cssTarget = join(OUT_DIR, "styles.css");
  if (check) {
    const existing = existsSync(target) ? readFileSync(target, "utf8") : "";
    const existingCss = existsSync(cssTarget) ? readFileSync(cssTarget, "utf8") : "";
    if (existing !== html || existingCss !== stylesheet()) {
      console.error("docs/graphics/graphics-specimen.html is stale — re-run tools/graphics-specimen.ts");
      process.exit(1);
    }
    console.log(`up to date: ${target} (${Buffer.byteLength(html, "utf8")} B)`);
    return;
  }
  mkdirSync(join(OUT_DIR, "fonts"), { recursive: true });
  writeFileSync(target, html);
  writeFileSync(cssTarget, stylesheet());
  for (const file of FONT_FILES) copyFileSync(join(FONT_DIR, file), join(OUT_DIR, "fonts", file));
  console.log(
    `wrote ${target} (${Buffer.byteLength(html, "utf8")} B) and styles.css (${Buffer.byteLength(stylesheet(), "utf8")} B)`,
  );
}

if (import.meta.main) main();

/** Exported so the measurement script and the tests can render the same page. */
export { render as renderSpecimen, stylesheet as specimenStylesheet, SPECIMEN_CSS, SPECIMEN_RECORD, OUT_DIR };
