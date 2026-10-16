# The graphics layer, wired onto the pages — the switch, the marks, and what it costs

**Engineer session, 17 Oct 2026.** Branch `feat/graphics-layer-wired` (PR #38), on master
`2957250`. The layer itself is S3 (`src/demo/graphics.ts`, `docs/graphics-layer.md`); this is the
half that puts it on the pages: `src/demo/graphics-wiring.ts`, plus the marks written into
`src/demo/render.ts`, `src/demo/family-render.ts`, `src/demo/service-card-action.ts` and
`src/demo/addresses.ts`. **Every number below names the command or the file it came from.**
This doc is the one the build's own manifest points at
(`graphics_layer.note` and `graphics_layer.switched_off_leaves`, `src/demo/build.ts`), which is
why it exists as a file rather than only in a report.

Nothing here is staged or published: the switch is unset in the repository, and the one
demonstration it can move is behind it.

## 1. The switch, exactly

`DEMO_GRAPHICS` (`GRAPHICS_VAR`, `src/demo/graphics-wiring.ts:81`). It is **value-addressed**,
like `DEMO_GHOST_CONTROLS` and `DEMO_SERVICE_CARD_ACTION_BAR` beside it: the **value** names the
treatment, and a value the build cannot read is **refused rather than guessed at**.

| value | effect |
| --- | --- |
| `layer` (the treatment's own name) | the layer is written onto the pages and into the stylesheet |
| `marks`, `graphics`, `1`, `true`, `on`, `yes` | the same thing — `GRAPHICS_SCOPES`, `graphics-wiring.ts:103-111`; the value is trimmed and lowercased first |
| unset, empty, `0`, `false`, `off` | off: no page and no stylesheet moves (`graphicsRequested`, `graphics-wiring.ts:138`) |
| anything else (`shiny`, `Layer2`, …) | **refused** — `graphicsDecision` records it in `unrecognised`, and `graphicsWiringProblems` clause 0 stops the build |

Two scope rules ride on top of the value, both refusals with their reason written into the
manifest's `graphics_layer.basis`:

- **one record** — the layer is wired into `maple-avenue-barber-shop` (`GRAPHICS_SLUG`) only, the
  copy the owner is reviewing. Another record's build reads the same variable and nothing moves;
- **never delivered** — a bundle in the delivered phase (`form_delivery: business`) refuses it: a
  client's site carries the design the client agreed to, and section marks are a proposal.

The manifest carries a `graphics_layer` block **only when the layer is on**, so with the switch
off a fixture's manifest is master's manifest apart from the two timestamps.

## 2. What it puts on each page

A mark is written **beside the label it belongs to** and nowhere else — the layer's own rule
(`graphics.ts`, rule 2; `docs/graphics-layer.md`), and the reason it emits no icon-only control.
The wiring sites, as they stand in the code:

| where | mark | code |
| --- | --- | --- |
| each inner page's eyebrow, and one arc divider under its band | the page's own mark (Services, About, Contact, Privacy) | `render.ts:701-702` |
| each recorded service card, inside the name block both card shapes share | `services` | `render.ts:321` |
| the `Opening hours` heading / the location heading | `hours` / `pin` | `render.ts:777,782` |
| the printed email and phone lines in the contact block | `email` / `phone` | `render.ts:638-639` |
| the footer's `Privacy notice` link, and the form's | `privacy` | `render.ts:679,1013` |
| the CTA band's heading | `message` | `render.ts:805` |
| the home page's `More about {name}` link | `arrow-right` | `render.ts:753` |
| beside a demonstration booking link (never inside it) | `appointment` | `render.ts:952` |
| the extras heading | `info` | `render.ts:1154` |
| the contact page's location column | the schematic map + `MAP_CAPTION` as its visible sentence | `render.ts:770-771` |
| a hero with no photograph | the `no-photo` ground | `render.ts:722` |

**Measured, per page** — counting each `<svg class="gfx-icon…">` in the built bundle and matching
its inner markup against `icon(name)` for the 14 names in `ICON_NAMES` (§6 has the script):

| page | marks |
| --- | --- |
| `index.html` | **10** — services×4 (one per service card), hours, pin, phone, privacy, message, arrow-right |
| `services.html` | **10** — services×5 (the page's own eyebrow + one per card), hours, pin, phone, privacy, message; one arc divider |
| `about.html` | **7** — info×2, hours, pin, phone, privacy, message; one arc divider |
| `contact.html` | **6** — privacy×2 (the form's and the footer's), hours, pin, phone, message; the schematic map with its caption; one arc divider |
| `privacy.html` | **2** — privacy×2 (its own eyebrow + the footer's link); one arc divider |
| `contact-<service>.html` (×4) | identical to `contact.html`: **6** marks, the map, the caption, the divider |
| `booking-comparison.html` | **1** — the footer's privacy mark (it carries no page band) |

The home page's hero here carries a photograph, so the `no-photo` ground is not on it: it appears
only for a record with no hero picture (`render.ts:722`).

## 3. What is not wired, and why

1. **The wordmark** — it belongs in the header, and the header's own approved check refuses it
   there: `wordmarkLinkProblems` requires the header's link to carry the business's name as
   **plain text** and nothing else. Replacing the header's name with a mark is a change to a page
   signed off on 7 Oct, so it is the owner's call, not this branch's.
2. **A mark inside any control** — the boxes the owner has already been shown (108×44, 270×44,
   488×44) are the numbers an inline mark would move. Marks sit beside controls, never in them,
   and clause 5 below refuses one that tries.
3. **A ground behind a control or behind body text** — the CTA band and the cards are the
   surfaces whose contrast the outlined buttons were measured against; `rules`, `grid`, `arcs`
   and `stripe` stay unwired for that reason.
4. **The `gallery` and `link` marks** — no page renders a Gallery or Socials module, so the
   vocabulary does not exist yet. `info` rides the extras card, where a record's own facts print.
5. **Any mark for a rating, a price or a review** — the build refuses those modules, and a mark is
   not a licence to imply one.

## 4. What it costs

**Zero files and zero requests.** Every mark is inline SVG and every rule is CSS; the layer's own
byte report (`graphicsByteReport`, `docs/graphics/evidence/byte-report.json`) carries
`"assets": 0, "requests": 0`, `layerBytes` 11,859 of a 13,312 cap, every part under its own cap.
The bundle is **22 files either way**: `(22 files, 710 KB)` with the switch off and
`(22 files, 750 KB)` with it on (both lines printed by the build's own summary).

**Per-page cold weight at 360 px**, four builds of the one record. The command, run from
`/home/team/shared/pipeline` with `SS_RETENTION_LOG=/home/team/shared/ops/retention-log.md`:

```
bun run src/demo/cli.ts -- --record test/fixtures/maple-avenue-barber-shop.json --out /tmp/wt/<A|B|C|D>
```

with A = no switches, B = `DEMO_GRAPHICS=layer`, C = `DEMO_GHOST_CONTROLS=surface
DEMO_SERVICE_CARD_ACTION_BAR=nested` (the switches the live review copy runs), D = all three.
Cold weight is the build's own `pageLoadout` (`src/demo/weight.ts:95`) at a 360 px screen: the
page, its stylesheet, both fonts, the favicon, `site.js` where the page carries a form, and the
one image file that screen fetches.

| page | A — off | B — `layer` | C — review copy | D — both (what a staged copy would show) |
| --- | --- | --- | --- | --- |
| `index.html` | 140,978 B (138 KB) | 149,138 B (146 KB) | 149,723 B (146 KB) | 157,883 B (**154 KB**) |
| `services.html` | 94,692 (92 KB) | 103,285 (101 KB) | 103,437 (101 KB) | 112,030 (109 KB) |
| `about.html` | 95,684 (93 KB) | 102,838 (100 KB) | 104,205 (102 KB) | 111,359 (109 KB) |
| `contact.html` | 101,742 (99 KB) | 110,176 (108 KB) | 110,263 (108 KB) | 118,697 (116 KB) |
| `privacy.html` | 93,788 (92 KB) | 99,223 (97 KB) | 102,309 (100 KB) | 107,744 (105 KB) |
| `contact-<service>.html` | 101,751–101,757 | 110,185–110,191 | 110,272–110,278 | 118,706–118,712 |

The heaviest page is `index.html` in every case, and the build's own note agrees with this table
to the KB: `weight: heaviest page is index.html at 138 / 146 / 146 / 154 KB cold at 360px (target
400 KB, ceiling 750 KB)`. Target 400 KB, ceiling 750 KB.

**What the layer adds to it:** `index.html` +8,160 B — **+3,707 B of markup** and **+4,453 B of
stylesheet**, and the stylesheet is paid by every page. `styles.css` is 38,636 B with the switch
off and **43,089 B** with it on. Across the five named pages the layer adds 5,435–8,593 B each
(privacy +5,435; about +7,154; index +8,160; contact +8,434; services +8,593).

For comparison, the review copy's own switches cost more than the layer does: `styles.css`
38,636 → 47,157 B (+8,521) and the home page +8,745 B; all three switches together give 51,610 B
of stylesheet and a home page of 157,883 B.

**Read the hero figures as DPR-1 numbers** — the plan's correction of 16 Oct applies: a 360 px
screen at DPR 2 fetches the 600-px hero (44,288 B here) not the 900-px one, and the page budget is
what holds a phone load honest, not the KB figure alone.

## 5. The check, and the sweep that proves each condition can fail

`graphicsWiringProblems` (`graphics-wiring.ts:256`) runs inside `complianceChecks()`
(`build.ts:3283` passes it the bundle's own pages, stylesheet and decision), so a bundle that
breaks one of its clauses **fails the build**:

- **clause 0** — a value that names no treatment is refused;
- **clause 1** — with the switch off, no page and no stylesheet carries the layer (the byte-identity
  claim, as a build refusal rather than a promise);
- **clause 2** — with it on, the opt-in really painted: every page carries at least one mark and
  the stylesheet carries the layer's rules and its version marker (`--graphics-layer`);
- **clause 3** — every mark is marked one way: `aria-hidden="true"` or `role="img"` with a name,
  and `focusable="false"` so it is not a tab stop in older Edge;
- **clause 4** — a page showing the schematic map prints `MAP_CAPTION`, its only carrier of meaning;
- **clause 5** — no mark inside a control whose box the owner has been shown.

```
bun run tools/graphics-sweep.ts --out <dir>
```

mutates one condition at a time, runs `test/graphics.test.ts`, restores the file and prints the
sha256 before and after. **Result on this branch (17 Oct):**

```
# 52 rows: 0 with no test going red (unguarded), 0 invalid (the row did not apply), 52 guarded
```

**Three rows were repaired to get there, and the two ways a row can stop applying are now refused
by the tool rather than reported as a skip:**

- `gw-mark-in-control` and `gw-fetch-image` carried `\b` and `\s` inside a template literal, where
  they are the backspace character and a plain `s`. The rows could never match the file they name,
  so they had been skipped silently since the day they were written. Both texts are escaped now
  (`\\b`, `\\s`) and both mutate and go red.
- `gw-wiring-in-build` **prepended** `pages: [],` to an object literal that already carried
  `pages,`. JavaScript takes the last property, so the file changed and the code did not: the row
  read 0 failures and looked like a condition with no test behind it. The row replaces the line
  now, and it goes red against `the clauses are wired into the build itself, not only callable`
  (`test/graphics.test.ts:482`), which was there all along.

The sweep now fails (`exit 1`, `# SWEEP INCOMPLETE`) if any row cannot be applied, and names a row
whose text carries a control character.

## 6. Reproducing the numbers

Build the four variants (§4), then, for per-page cold weights, call the same function the budget
calls — `pageLoadout` from `src/demo/weight.ts` — with `sizes` built from every file in the bundle
(including `images/`, or the hero goes uncounted) and `images` from the bundle's own
`manifest.json`. Cross-check the heaviest page against the build's `weight:` note; if the two
disagree, the images map is wrong. The per-page mark counts come from matching each
`<svg class="gfx-icon…">…</svg>`'s inner markup against `icon(name)` for each name in
`ICON_NAMES` (`src/demo/graphics.ts`).

The suite is `SS_RETENTION_LOG=/home/team/shared/ops/retention-log.md bun test` from
`/home/team/shared/pipeline`; the layer's own proofs, per-part byte caps and pixel contrast are in
`docs/graphics-layer.md` and `docs/graphics-check-doctor-proofs.md`.
