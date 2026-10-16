# The graphics layer (S3) — what it is, what it costs, and how each number was measured

**Designer session, 16 Oct 2026.** Branch `design/graphics-layer` @ `0b31e2e`. Source:
`src/demo/graphics.ts`. Specimen: `docs/graphics/graphics-specimen.html` (committed, opens on
its own). **Raw outputs: `docs/graphics/evidence/`** — every number below names the file or the
command output beside it, and a number with no artifact is marked as an estimate.
The plan's build list reached the graphics layer last, after the button work: the demos carry
**no icons, no patterns, no dividers, no map and no wordmark** — About, Services and Contact read
as text on white, and nothing says "a designer built this" the moment a thumb lands on it. This
session builds and proves that layer. **It does not wire it into any demo.**

*Corrected 16 Oct 2026: the first draft of this doc was dated 17 Oct. The session ran on 16 Oct;
the date is fixed here and in the screenshot filenames (`graphics-specimen-360-full-2026-10-16.png`).*

## 0. How to look at it — five minutes, no build

- **Serve the specimen** (loopback only, never the live site):
  `cd docs/graphics && python3 -m http.server 8321`, then open
  `http://127.0.0.1:8321/graphics-specimen.html`.
- **The phone crops** — the 8432px full-page shot is unreadable at phone size, so it is cut into
  three 360px-wide crops, each named with its width, in `/home/team/shared/design/screenshots/`:
  `graphics-icons-360.png` (all 14 icons at both sizes on paper, paper-2 and ink),
  `graphics-grounds-dividers-360.png` (the five grounds and the four dividers),
  `graphics-map-wordmark-360.png` (the schematic map, the wordmark and the initials mark).
  Cut from `spec-360-vis.png` by `/home/team/shared/design/make-graphics-crops.py`, which prints
  the probe rectangles each band came from; the un-cut full shot is
  `graphics-specimen-360-full-2026-10-16.png` beside them.
- **Re-measure everything**: `bash tools/graphics-measure.sh /tmp/ss-graphics-shots` — starts the
  server, shoots at 360 and 1440 with the probes visible and hidden, prints both contrast tables,
  then renders the page with JavaScript disabled and reports the request list.

## 1. What the layer holds

| Part | What it is | Source |
| --- | --- | --- |
| Icons (14) | services, hours, phone, pin, directions, message, email, appointment, info, gallery, link, open-external, privacy, arrow-right — 24×24 grid, 1.75px strokes, round caps, `stroke="currentColor"`, no fill except a 1.15px dot | `ICONS`, `icon()` |
| Grounds (5) | `rules`, `grid`, `arcs`, `stripe` and the no-photograph hero fallback (`no-photo`: ink ground, arcs, accent hairline) — CSS gradients only, drawn in `currentColor` | `PATTERNS`, `ground()` |
| Dividers (4) | one arc, the same arc doubled, a three-rule stripe, a hairline broken by an accent mark — inline SVG, stretched with `preserveAspectRatio="none"` + `vector-effect="non-scaling-stroke"` so the stroke stays 1px at any width | `DIVIDERS`, `divider()` |
| Schematic map | a street plan with two centrelines, parcels and a marker — **no street name, no compass, no scale, no coordinates**, and its own `SCHEMATIC — NOT TO SCALE` label inside the drawing; decorative (`aria-hidden`), with `MAP_CAPTION` as the visible and accessible sentence | `schematicMap()`, `MAP_CAPTION` |
| Wordmark | the name in the display face with a 24×2px accent rule under it, plus an optional initials mark on the category accent — the same construction as the favicon in `render.ts`, so the tab and the header carry one mark rather than two | `wordmark()`, `monogram()` |

**Evidence:** the geometry claims (24×24 grid, one stroke weight, `aria-hidden`, the divider
attributes, the monogram's letters) are asserted per icon in `test/graphics.test.ts`, whose run on
this branch is `docs/graphics/evidence/suite-2026-10-16.txt` (335 pass / 0 fail).

**The 14 icons are read off the vocabulary the shipped pages already carry**, not invented: the six
page names, the printed phone link, `Get directions`, `Opening hours`, the services list, the
address, the form's message, the booking link, the privacy notice and the footer's link-out.
Anything the demos have nothing to draw for — a rating, a price, a review — has no icon, because a
mark is not a licence to imply a module the build refuses.

## 2. What it costs — bytes, per part, against the caps the build enforces

Straight out of the layer: `bun -e 'import {graphicsByteReport} from "./src/demo/graphics.ts";
console.log(JSON.stringify(graphicsByteReport(), null, 2))'` →
**`docs/graphics/evidence/byte-report.json`**. `bun run tools/graphics-specimen.ts` prints the same
table at the top of the specimen page.

| Part | Bytes | Cap (`GRAPHICS_BYTE_CAPS`) |
| --- | --- | --- |
| Icons, all 14 | 5,070 | 6,144 (per icon 512; largest is `gallery` at 446 — `docs/graphics/evidence/icons-per-icon-bytes.txt`) |
| Stylesheet block | 3,648 | 4,096 |
| Dividers, all 4 | 1,298 | 1,536 |
| Schematic map | 1,468 | 2,048 |
| Wordmark + mark | 375 | 768 |
| **Whole layer** | **11,859** | **13,312** |

- **Files added to a bundle: 0. Requests added to a page: 0.** That is not a promise in prose:
  the byte report carries `"assets": 0, "requests": 0`, because the layer emits markup and CSS
  only — there is no file for a page to fetch, which is the strongest available form of the claim.
- **The specimen page's own weight**, by `wc -c` (`docs/graphics/evidence/file-sizes.txt`):
  HTML **59,245 B**; `styles.css` **45,657 B**; the two WOFF2 files **18,096 + 28,740 = 46,836 B**.
  *(The first draft said the layer's 3.6 KB was simply appended to the template's stylesheet: it is
  not the whole difference. A demo's own `styles.css` is **38,636 B** — measured on the built
  bundles at `/tmp/gfx/{before,after}/maple-avenue-barber-shop/styles.css` — so 38,636 + 3,648 =
  42,284 leaves **3,373 B** of the specimen's own docs-page styles (`.sp-*`). That is what the
  committed `docs/graphics/styles.css` contains, and it is not weight any demo would carry.)*
- The two WOFF2 files are the fonts **every demo already ships** — see §7; adopting the layer adds
  no font file and no font bytes.

## 3. Requests on load — the list printed, not asserted

Two independent artifacts, both from the 16 Oct harness run (98 seconds, exit 0):

`docs/graphics/evidence/http.log` — the server's access log for that run, verbatim:

```
127.0.0.1 - - [16/Oct/2026 19:56:10] "GET /graphics-specimen.html HTTP/1.1" 200 -
127.0.0.1 - - [16/Oct/2026 19:56:11] "GET /graphics-specimen.html HTTP/1.1" 200 -
127.0.0.1 - - [16/Oct/2026 19:56:11] "GET /styles.css HTTP/1.1" 200 -
127.0.0.1 - - [16/Oct/2026 19:56:11] "GET /fonts/source-sans-3-latin.woff2 HTTP/1.1" 200 -
127.0.0.1 - - [16/Oct/2026 19:56:11] "GET /fonts/fraunces-latin-600.woff2 HTTP/1.1" 200 -
127.0.0.1 - - [16/Oct/2026 19:56:11] code 404, message File not found
127.0.0.1 - - [16/Oct/2026 19:56:11] "GET /favicon.ico HTTP/1.1" 404 -
```
(The first line is the harness's own `curl` health check before it drives the browser, which is
why the page appears twice.)

`docs/graphics/evidence/js-off.json` — the same page's `performance.getEntriesByType("resource")`,
read over the DevTools protocol with script execution disabled:

```
"resources": [
  "http://127.0.0.1:8321/styles.css",
  "http://127.0.0.1:8321/fonts/fraunces-latin-600.woff2",
  "http://127.0.0.1:8321/fonts/source-sans-3-latin.woff2"
]
```

**Third-party requests: zero.** Every name above is the same loopback origin and the same folder
(`docs/graphics`); there is no second host in either list, and no request of any kind that a demo
page would not already make. The only other line in the access log is the browser's own
`/favicon.ico` probe, which 404s — the specimen is a docs page with no favicon; a demo bundle
ships its own.

## 4. Rendered size and contrast, measured from pixels

Method (the team's, `measure-button-contrast-pixels`): `tools/graphics-measure.sh` takes a
full-page shot with the probes visible and a second with every `[data-probe]{visibility:hidden}`
at the same viewport, so the pixel behind each mark is the real surface; a pixel counts as the
mark's own paint when the two shots differ by more than 6/255; the **median** over those pixels is
the conservative figure (every antialiased edge pixel meaninglessly dilutes it) and the **exact**
column is the contrast of the solid colour that actually appears. `tools/graphics-contrast.py`
prints the per-probe table. Artifacts: **`docs/graphics/evidence/contrast-360.json`**,
`contrast-1440.json`, and the printed tables inside
**`docs/graphics/evidence/harness-run-2026-10-16.txt`** (99 probe rows at 360, 99 at 1440).

At 360, DPR 1, aggregates over the per-icon rows of that table:

| Mark | Rendered box | Surface | Median | **Exact** | Peak |
| --- | --- | --- | --- | --- | --- |
| Every icon, 24px (14/14) | 24×30 | paper `#FFFFFF` | 2.60–6.76 | **9.86** | 10.02 |
| Every icon, 20px (14/14) | 20×27 | paper | 1.58–4.87 | **4.87–9.86** | 10.02 |
| Every icon, 24px (14/14) | 24×30 | paper-2 `#FAF7F2` | 2.55–6.40 | **9.23** | 9.37 |
| Every icon, 20px (14/14) | 20×27 | paper-2 | 1.57–4.68 | **4.68–9.23** | 9.37 |
| Every icon, 24px (14/14) | 24×30 | ink `#16181B` | 5.28–13.47 | **17.79** | 17.79 |
| Every icon, 20px (14/14) | 20×27 | ink | 2.33–10.39 | **10.39–17.79** | 17.79 |
| Wordmark, header (mark + name + accent rule) | 254×39 | paper | 7.29 | **7.44** | 9.86 |
| Wordmark, the other three lockups | 286×32/39/49 | paper, ink | 2.39–7.29 | **2.39–7.44** | 17.79 |
| Grounds (5) | 130×96 | paper, ink | 9.86–17.79 | **9.86–17.79** | 17.79 |
| Dividers (4) | 320×24 | paper, paper-2 | 1.08–1.11 | **1.08–1.09** | 3.80 |
| Schematic map | 320×187 | paper | 1.07 | **1.07** | 7.44 |
| Monogram (40px) | 286×40 | ink | 2.39 | **2.39** | 17.79 |

Read this table with three notes, all of them consequences of the method:

1. **The "exact" figure is the ink stroke** (`rgb(61,68,76)` = `--body-text`, inherited by the icons
   in the specimen) at 9.86:1 on paper and 9.23:1 on paper-2, and the paper-white stroke at
   17.79:1 on ink. Note **9.86 rather than 17.79 on paper**: in the specimen the icons inherit
   `--body-text`, not `--ink`. Both clear the 3:1 non-text floor with room; a wired page that puts
   icons in body copy inherits the same colour and the same figure.
2. **The ranges at 20px and on ink are ranges, not one number.** The first draft printed a blanket
   9.86 for every 20px icon; the table says otherwise — `arrow-right` at 20px measures **4.87**
   because at that size its dominant painted colour is the lighter of the two solids the probe
   finds. 4.87:1 still clears 3:1. Anything quoted from this table should quote the range and the
   exception, which is why the raw per-probe JSON is committed beside it.
3. **The dividers and the map are decoration and measure like decoration** (1.07–1.11, i.e. the
   `--line` hairline the design system already records at 1.3:1 on paper and never uses as a
   carrier of meaning). Nothing is asked of them: the map's meaning is its visible sentence
   (`MAP_CAPTION`), the dividers carry none, and both are `aria-hidden`. A future page must not
   put a divider under text and call it a rule, and it must not lose the caption.

The wordmark's 7.44:1 is its accent mark on paper (the salon accent, 7.4:1 in §3 of the design
system); its name text is ink and measures at the top of the peak column. Every mark is
**decoration sitting beside its own label** — in the specimen, beside the icon's name; on a page,
beside the link or row label — so nothing depends on a glyph being understood, and the layer emits
no icon-only control.

The 1440 table is printed in the same `harness-run-2026-10-16.txt` and its probe rectangles are
`rects-1440.json`; its figures are **not** transcribed above, and nothing in §4 is claimed of 1440.

## 5. Marking, scripting off, and the check with teeth

- **Markings.** `docs/graphics/evidence/js-off.json` counts what the page actually rendered:
  **93 `<svg>`** — 84 icons, 4 dividers, 4 monograms, 1 map — and **99 `[data-probe]`**. Every
  `<svg>` the layer can emit carries exactly one marking, and `graphicsProblems()` refuses an
  unmarked one, a doubly-marked one, and a `role="img"` with no accessible name. The map is
  `aria-hidden` with `focusable="false"`; its meaning is carried by its visible caption, which is
  not hidden from a reader.
- **Scripting off.** The page carries **no `<script>` at all** (`"scripts": 0` in the DOM probe,
  taken with `Emulation.setScriptExecutionDisabled`), and the harness prints *"scripting off: the
  first 360x900 pixels are byte-identical with script execution disabled"* — the same page, drawn
  without a line of script, both fonts reported `loaded` in the same probe.
- **Horizontal scrolling.** The same probe reports `"scrollWidth": 360, "clientWidth": 360` — the
  page does not scroll sideways at 360. (An earlier scratch run of this probe on the same page
  reported `370` versus `360`; it is not reproducible in the 16 Oct re-run and is treated as a
  stale artifact — see §9.)
- **The check.** Five clauses, run inside `complianceChecks()` so a build fails rather than a
  reviewer noticing: (1) nothing reaches the network — no `http(s)://`, no protocol-relative URL,
  no `@import`, **no `url()` at all**, no `<script>`, no `<image>`, no `<use>` outside the
  document, no external resource attribute; (2) every graphic marked, and marked one way; (3) no
  literal colour, so a mark always follows its surface; (4) byte caps per icon, per part and for
  the layer; (5) every rule scoped to a `.gfx-` class, so the layer cannot restyle a page that did
  not ask for it. The byte cap measures each part's **text**, never a `bytes` field — a
  mislabelled part is exactly how a cap stops meaning anything.

### The doctor proofs — each condition shown firing

`docs/graphics-check-doctor-proofs.md`, generated from the run itself: **27 rows, one per
condition**, each mutating that condition in `graphics.ts` (or `build.ts` for the wiring row),
showing which test goes red, and restoring the file **byte-exact** — `graphics.ts`
`e7951586…` and `build.ts` `2d7a20d2…` identical before and after in all 27 rows.
Raw log: `docs/graphics/evidence/sweep-log.txt`; one bun transcript per row in
`docs/graphics/evidence/sweep/<id>.txt`. **24 of the 27 rows are guarded; 3 conditions come out
unguarded and are named there:**

1. `if (head.startsWith("@")) continue;` in `cssSelectors()` — untested, and it hides a real hole:
   a rule nested inside an `@media` block is **not inspected at all** (proved:
   `docs/graphics/evidence/gap-probes.txt`, `1b` reports `[]` for `@media (min-width: 40rem) { .card
   { … } }`, while `1a` shows the same rule refused at the top level). Latent today only because
   `graphicsCss()` contains no at-rule.
2. `if (cap !== undefined && …)` in the per-part cap — its false half is unreachable (the only
   uncapped part, the caption, is filtered out of `named`), so removing it changes nothing.
3. `const named = parts.filter((part) => part.name !== "caption")` — the caption exemption is not
   what keeps the cap passing (1,386 bytes of margin with the caption counted in).

The caps were proved live, not just in a mutation: the first run of `graphicsProblems()` against
the real layer **failed** on `icons=5070 over the 3072-byte cap` and `the whole layer is 11542
bytes, over the 8192-byte cap` — the caps were raised to the measured figures afterwards, and the
per-icon cap was added because a redrawn mark could otherwise cost three times the rest.

## 6. Nothing rendered changed

- All four fixtures rebuilt with the switches off are **byte-identical to master**:
  `docs/graphics/evidence/rebuild-diff.txt` prints the two `find … sha256sum` commands and the
  `diff` — 80 files in each tree, no output. Only `manifest.json` is excluded, because it carries a
  generated-at timestamp. (The trees compared are the ones built on 16 Oct —
  `/tmp/gfx/before` on master `dd319a5` and `/tmp/gfx/after` on this branch — and the file
  recomputes the comparison from them.)
- Suite: **335 pass / 0 fail**, 2,657 `expect()` calls, 25 files —
  `docs/graphics/evidence/suite-2026-10-16.txt`; 324 on master + 11 new.
- Nothing is staged on a demo path, and nothing was published.

## 7. The fonts, stated plainly

- **Which faces.** Fraunces (display: headings, the wordmark, figures) and Source Sans 3 (body:
  everything else). Fraunces is the static latin 600 subset; Source Sans 3 is the variable latin
  file that carries 400/600/700 from one 28 KB download. The pairing, the reasons for it and the
  weights are `docs/design-system.md` §2.
- **Are they already the faces the demos ship? Yes — byte for byte.** The branch adds
  `docs/graphics/fonts/fraunces-latin-600.woff2` and `source-sans-3-latin.woff2`, and the sha256 of
  each is **identical** to `src/demo/assets/fonts/…`, the copies every demo bundle already serves
  (`docs/graphics/evidence/fonts/sha256-and-history.txt`):
  `3a1de771…` (Fraunces, 18,096 B) and `7a19a702…` (Source Sans 3, 28,740 B), in both places.
  So **a demo that adopts this layer gains no font file and no font weight** — the cost table in §2
  is unchanged by the fonts, and the docs copies exist only so the specimen page opens on its own
  (`docs/graphics/` needs them beside the HTML).
- **Where the files came from.** They entered the repository in `0f95864` ("Design: written design
  system, token-based stylesheet, and the hero rebuilt on a real `<img>` (#4)"), the S1 design
  session, under `src/demo/assets/fonts/`. Upstream: **Fraunces**
  (https://github.com/undercasetype/Fraunces) and **Source Sans 3**
  (https://github.com/adobe-fonts/source-sans), both under the **SIL Open Font License 1.1**.
- **The licence travels with them.** `src/demo/assets/fonts/OFL.txt` — a plain-language note plus
  the OFL 1.1 text — is copied into every bundle as `fonts/OFL.txt` (design system §2: "the
  copyright notice and licence travel with the file, which is exactly what the bundle does"). The
  copy added by this branch, `docs/graphics/fonts/OFL.txt`, is byte-identical to it
  (`253539112…`), so the specimen page is licensed the same way the demos are.
- **The limit of this paragraph.** Nothing was re-downloaded or re-subset in this session: the
  provenance above is the design system's record plus the copy-identity proof, which is what can be
  checked from this machine. The subsetting step itself is not documented anywhere we can point at.

## 8. What this session did not do

- **No demo wiring.** `renderCss()` does not call `graphicsCss()`, no renderer calls `icon()`,
  `divider()`, `schematicMap()` or `wordmark()`. That is deliberate: the barber review copy is live
  and the owner is judging it. Wiring is the next session, and it is one call plus the markup at
  each site — and it is also where the `@media` hole in §5 must be closed first.
- **No category variants.** The ten accent / display-face / motif / hero-mode combinations are
  untouched. The layer is token-driven, so the accents are already wired through `var(--accent)` —
  what is not built is any per-category *choice* of motif.
- **Not staged, not published, nothing merged.** The branch is pushed; the owner's live review copy
  and every client build are untouched.
- Not transcribed here: the 1440 contrast table (§4) and the `.gfx-` namespace in *markup*, which
  `test/graphics.test.ts` checks outside `graphicsProblems()` rather than inside the build check.

## 9. Corrections and open items for the lead

- **Dates.** Fixed: this doc said 17 Oct; the session ran **16 Oct 2026**, and the owner-facing
  screenshot was renamed to `graphics-specimen-360-full-2026-10-16.png`.
- **The stale `scrollWidth: 370`.** One scratch run of the js-off probe (the previous session's
  copy in `/tmp`) reported `370` against a `360` client width on this same page. The 16 Oct re-run
  reports `360/360`. Nothing in the diff explains it, and it is not reproducible, so the doc now
  states the reproducible figure and flags the other one rather than quoting it.
- **The 20px and ink contrast figures** were ranges all along; §4 now prints the ranges and the
  `arrow-right`-at-20px exception instead of a blanket 9.86.
- **The stylesheet weight question stands, and now has a number.** A demo bundle's `styles.css` is
  **38,636 B** (measured, `/tmp/gfx/{before,after}/…/styles.css`), while `docs/design-system.md` §8
  records CSS at 12.3 KB against a 16 KB budget, and the build's weight check passes. Either §8 or
  that check measures something other than the shipped file — the same open item the last session
  raised, now with the file size attached. Not this session's to change.
- **What a wiring session must do first:** close the `@media` hole in clause 5 (and add a doctor
  for it), then wire, then re-run the sweep — a rule with no test is treated as no rule, and
  today three conditions in `graphicsProblems()` are exactly that.
