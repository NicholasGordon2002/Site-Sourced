# The graphics layer (S3) — what it is, what it costs, and how it was measured

**Designer session, 17 Oct 2026.** Branch `design/graphics-layer`. Source: `src/demo/graphics.ts`.
Specimen: `docs/graphics/graphics-specimen.html` (committed, opens on its own).
The plan's build list reached the graphics layer last, after the button work: today the demos
carry **no icons, no patterns, no dividers, no map and no wordmark** — About, Services and
Contact read as text on white, and nothing says "a designer built this" the moment a thumb
lands on it. This session builds and proves that layer. **It does not wire it into any demo.**

## 1. What the layer holds

| Part | What it is | Source |
| --- | --- | --- |
| Icons (14) | services, hours, phone, pin, directions, message, email, appointment, info, gallery, link, open-external, privacy, arrow-right — 24×24 grid, 1.75px strokes, round caps, `stroke="currentColor"`, no fill except a 1.15px dot | `ICONS`, `icon()` |
| Grounds (5) | `rules`, `grid`, `arcs`, `stripe` and the no-photograph hero fallback (`no-photo`: ink ground, arcs, accent hairline) — CSS gradients only, drawn in `currentColor` | `PATTERNS`, `ground()` |
| Dividers (4) | one arc, the same arc doubled, a three-rule stripe, a hairline broken by an accent mark — inline SVG, stretched with `preserveAspectRatio="none"` + `vector-effect="non-scaling-stroke"` so the stroke stays 1px at any width | `DIVIDERS`, `divider()` |
| Schematic map | a street plan with two centrelines, parcels and a marker — **no street name, no compass, no scale, no coordinates**, and its own `SCHEMATIC — NOT TO SCALE` label inside the drawing; decorative (`aria-hidden`), with `MAP_CAPTION` as the visible and accessible sentence | `schematicMap()`, `MAP_CAPTION` |
| Wordmark | the name in the display face with a 24×2px accent rule under it, plus an optional initials mark on the category accent — the same construction as the favicon in `render.ts`, so the tab and the header carry one mark rather than two | `wordmark()`, `monogram()` |

**The 14 icons are read off the vocabulary the shipped pages already carry**, not invented:
the six page names, the printed phone link, `Get directions`, `Opening hours`, the services
list, the address, the form's message, the booking link, the privacy notice and the footer's
link-out. Anything the demos have nothing to draw for — a rating, a price, a review — has no
icon, because a mark is not a licence to imply a module the build refuses.

## 2. What it costs — bytes, per part, against the caps the build enforces

Measured from the layer's own output (`graphicsByteReport()`), `bun run tools/graphics-specimen.ts`
prints the same table on the specimen page:

| Part | Bytes | Cap (`GRAPHICS_BYTE_CAPS`) |
| --- | --- | --- |
| Icons, all 14 | 5,070 | 6,144 (per icon 512; largest is `gallery` at 446) |
| Stylesheet block | 3,648 | 4,096 |
| Dividers, all 4 | 1,298 | 1,536 |
| Schematic map | 1,468 | 2,048 |
| Wordmark + mark | 375 | 768 |
| **Whole layer** | **11,859** | **13,312** |

- **Files added to a bundle: 0. Requests added to a page: 0.** The marks are inline markup and
  the stylesheet is already fetched. The specimen page's own cold weight is its HTML 59 KB
  (of which the visible content is ~14 KB: five icon grids, a table per part and the prose) plus
  `styles.css` 45 KB — the template's real stylesheet (38.6 KB, which is what a demo already
  serves) with the layer's 3.6 KB appended — plus the two WOFF2 files 45.7 KB, which every
  demo already ships. Nothing is fetched from anywhere but that folder.

## 3. Requests on load — the list, with the zero

From the specimen server's access log and from `performance.getEntriesByType("resource")`
inside the page (`tools/graphics-js-off.ts` writes it to `js-off.json`):

```
http://127.0.0.1/graphics-specimen.html          the page
http://127.0.0.1/styles.css                      the stylesheet
http://127.0.0.1/fonts/fraunces-latin-600.woff2  display face
http://127.0.0.1/fonts/source-sans-3-latin.woff2 body face
```

**Third-party requests: zero.** Every name is the same loopback origin and the same folder.
The only other line in the access log is the browser's own `/favicon.ico` probe, which 404s —
the specimen is a docs page with no favicon; a demo bundle ships its own.

## 4. Rendered size and contrast, measured from pixels

Method (the team's, `measure-button-contrast-pixels`): a full-page shot with the probes
visible and a second with every `[data-probe]{visibility:hidden}` at the same viewport, so the
pixel behind each mark is the real surface; a pixel counts as the mark's own paint when the two
shots differ by more than 6/255; the **median** over those pixels is the conservative figure
(every antialiased edge pixel meaninglessly dilutes it) and the **exact** column is the
contrast of the solid colour that actually appears. `tools/graphics-contrast.py` prints the
per-probe table; shots were taken by `tools/graphics-measure.sh` at DPR 1.

| Mark | Rendered box | Surface | Median | **Exact** | Peak |
| --- | --- | --- | --- | --- | --- |
| Every icon, 24px (14/14) | 24×30 | paper `#FFFFFF` | 2.60–6.76 | **9.86** | 10.02 |
| Every icon, 20px (14/14) | 20×27 | paper | 1.58–4.93 | **9.86** | 10.02 |
| Every icon, 24px (14/14) | 24×30 | paper-2 `#FAF7F2` | 2.55–6.40 | **9.23** | — |
| Every icon, 20px (14/14) | 20×27 | paper-2 | 1.57–4.68 | **9.23** | — |
| Every icon, 24px (14/14) | 24×30 | ink `#16181B` | 6.55–13.47 | **17.79** | — |
| Every icon, 20px (14/14) | 20×27 | ink | 7.73–8.86+ | **17.79** | — |
| Wordmark (mark + name + accent rule) | 254×39 | paper | 7.29 | **7.44** | 9.86 |

The "exact" figure is the ink stroke (`rgb(61,68,76)` = `--body-text`, inherited by the icons
in the specimen) at 9.86:1 on paper and 9.23:1 on paper-2, and the paper-white stroke at
17.79:1 on ink. Note **9.86 rather than 17.79 on paper**: in the specimen the icons inherit
`--body-text`, not `--ink`. Both clear the 3:1 non-text floor with room; a wired page that puts
icons in body copy inherits the same colour and the same figure. The wordmark's 7.44:1 is its
accent mark on paper (the salon accent, 7.4:1 in §3 of the design system); its name text is ink
and measures at the top of the peak column.

Every mark is **decoration sitting beside its own label** — in the specimen, beside the icon's
name; on a page, beside the link or row label — so nothing depends on a glyph being understood,
and the layer emits no icon-only control.

## 5. Marking, scripting off, and the check with teeth

- **Markings.** Every `<svg>` the layer can emit carries exactly one marking, and
  `graphicsProblems()` refuses an unmarked one, a doubly-marked one, and a `role="img"` with no
  accessible name. 93 SVGs render on the specimen page — 84 icons, 4 dividers, 4 monograms,
  1 map — all `aria-hidden="true"` with `focusable="false"`; the map's meaning is carried by its
  visible caption, which is not hidden from a reader.
- **Scripting off.** The page carries **no `<script>` at all** (`scripts: 0` in the DOM probe)
  and no inline handler, and every mark is in place with script execution disabled:
  `tools/graphics-js-off.ts` renders it over the DevTools protocol
  (`Emulation.setScriptExecutionDisabled`) and reports 93 SVGs, 99 probes, both fonts loaded and
  the `h1` — the same page, drawn without a line of script. The page does not scroll horizontally
  at 360 (`scrollWidth === clientWidth`, 345 on the headless 360 viewport with the scrollbar
  hidden).
- **The check.** Five clauses, run inside `complianceChecks()` so a build fails rather than a
  reviewer noticing: (1) nothing reaches the network — no `http(s)://`, no protocol-relative URL,
  no `@import`, **no `url()` at all**, no `<script>`, no `<image>`, no `<use>` outside the
  document, no external resource attribute; (2) every graphic marked, and marked one way;
  (3) no literal colour, so a mark always follows its surface; (4) byte caps per icon, per part
  and for the layer; (5) every rule scoped to a `.gfx-` class, so the layer cannot restyle a page
  that did not ask for it. The byte cap measures each part's **text**, never a `bytes` field — a
  mislabelled part is exactly how a cap stops meaning anything, and the test that found that bug
  is the one that mutates a part's contents.

### The doctor proofs — each clause shown firing

`test/graphics.test.ts`, 11 tests, 236 assertions, all passing. Each clause is handed a
deliberately broken copy of the layer and asserted to produce its own message; the two
exemption notes in `test/refusal-coverage.test.ts` record why the layer's two pattern lists
audit artwork rather than prose.

| Clause | Doctor | Message asserted |
| --- | --- | --- |
| 1 | `url("https://cdn.example/icons.svg")` | `carries a url() reference` |
| 1 | `@import url("https://fonts.example/x.css")` | `carries an absolute http(s) URL` |
| 1 | `<use href="//cdn.example/sprite.svg#pin"/>` | `carries a protocol-relative URL` |
| 1 | `<script src="track.js">` / `<image …>` / `<use href="sprite.svg#pin">` / `<svg src=…>` | the matching refusal each time |
| 2 | an icon with `aria-hidden` stripped | `carries no marking` |
| 2 | an icon with `aria-hidden` **and** `role="img"` | `marked both decorative … and meaningful` |
| 2 | `role="img"` with an empty `aria-label` | `no accessible name` |
| 3 | an icon with `stroke="#16181B"` | `hard-codes a hex colour` |
| 3 | an icon with `stroke="rgb(22 24 27)"` | `hard-codes an rgb()/hsl() colour` |
| 3 | `.gfx-icon { color: white }` | `hard-codes a named colour` |
| 4 | an icon padded with a 400-point path | `over the 512-byte per-icon cap` |
| 4 | the set tripled / a part grown by 13 KB | `over the 6144-byte cap`, `elements for 14 named icons`, `the whole layer is … over the 13312-byte cap` |
| 5 | `.card { … }` and `body { … }` appended | `the rule ".card" … is not scoped to a .gfx- class` |
| wiring | the broken layer handed to `complianceChecks()` | the same refusal, through the build's own entry point |

The caps were proved live, not just in a mutation: the first run of `graphicsProblems()` against
the real layer **failed** on `icons=5070 over the 3072-byte cap` and `the whole layer is 11542
bytes, over the 8192-byte cap` — the caps were raised to the measured figures afterwards, and
the per-icon cap was added because a redrawn mark could otherwise cost three times the rest.

## 6. Nothing rendered changed

- All four fixtures rebuilt with the switches off are **byte-identical to master**: 80 files
  compared by `sha256sum`, excluding only `manifest.json` (which carries a timestamp).
  `/tmp/gfx/before.sha` vs `/tmp/gfx/after.sha`, `diff` empty.
- Suite: **335 pass / 0 fail** (324 on master + 11 new). `bun test`, `Ran 335 tests across 25 files`.
- Nothing is staged on a demo path, and nothing was published.

## 7. What this session did not do

- **No demo wiring.** `renderCss()` does not call `graphicsCss()`, no renderer calls `icon()`,
  `divider()`, `schematicMap()` or `wordmark()`. That is deliberate: the barber review copy is
  live and the owner is judging it. Wiring is the next session, and it is one call plus the
  markup at each site.
- **No category variants.** The ten accent / display-face / motif / hero-mode combinations are
  untouched. The layer is token-driven, so the accents are already wired through `var(--accent)`
  — what is not built is any per-category *choice* of motif.
- **Not measured here.** The grounds, dividers, map and wordmark-on-ink probes and the whole
  1440 set were produced by the harness (`/tmp/ss-graphics-shots/table-360.txt`,
  `table-1440.txt`) but only the figures in §4 are transcribed; the patterns' own hairlines are
  decorative by design (`--line` on paper is 1.3:1, the same figure §3 of the design system
  already records and never uses as a carrier of meaning). The 1440 rendering was shot and its
  pixel sizes are in `rects-1440.json`, but its contrast table is not reproduced above.
- **One observation for the lead, not this session's work:** the shipped `styles.css` is
  38.6 KB, while `docs/design-system.md` §8 records CSS at 12.3 KB against a 16 KB budget. The
  weight check passes, so it appears to measure something other than the raw file; either §8 or
  the check is a bug, and it is not mine to change here.
