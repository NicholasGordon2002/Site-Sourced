# The ghost controls — the second button treatment, and what keeps it honest

**This is the file `src/demo/ghost-controls.ts` sends a reader to** (`ghost-controls.ts` ×3,
`service-card-action.ts` ×2, the manifest note written in `build.ts`) and the one that did not
exist until 10 Oct 2026. Every number below is either read out of the code the build reads, or
measured — and where nothing on disk carries a number this document says **not measured** rather
than inventing one.

| | |
|---|---|
| **What it is** | One review treatment, two controls: the header's action and the nested service-card CTA, **transparent**, with the **outline and the words in the colour of the surface each sits on**. |
| **Owner's direction** | By text, 10 Oct 2026: "the header action transparent with white text and a white outline", the nested card CTA "the same treatment with black text and a black outline" (`GHOST_CONTROLS_BASIS`, `ghost-controls.ts`). |
| **The lead's ruling** | The same day: one system — the outline follows the surface — because white on the paper headers is 1.00:1. |
| **Opt-in** | `DEMO_GHOST_CONTROLS`, value-addressed. Unset in the repository, so every published build is unchanged. |
| **Scope** | The `maple-avenue-barber-shop` demonstration, in the demonstration phase. Refused in the delivered phase and on every other record (`ghostControlsDecision`). |
| **Files it can move** | One: `styles.css`. No page of any bundle is touched, with the switch on or off (clause 0b). |
| **Status** | Live on the review copy only. Not part of the design signed off on 7 Oct 2026, not part of the frozen template. |

## 1. What the treatment is

Both controls are the same object drawn on different surfaces (`ghostControlsCss()`,
`ghost-controls.ts`; `SERVICE_CARD_ACTION_NESTED_CSS`, `service-card-action.ts`):

| control | surface it sits on | fill | words | outline |
|---|---|---|---|---|
| `.page--index .site-header .call-button` (`GHOST_HOME_ACTION_SELECTOR`) | the home page's hero **photograph**, behind the header's scrim | `transparent` | `#fff` (`GHOST_SCRIM_COLOUR`) | `1px #fff` (`border-color`) |
| `.site-header .call-button` (`GHOST_HEADER_ACTION_SELECTOR`) | **paper** — `var(--paper)`, every other page's header | `transparent` | `var(--ink)` (`GHOST_PAPER_INK`) | `1px var(--ink)` |
| `.services .service-tile--cta .service-cta` | the service card's own paper surface | `transparent` | `var(--ink)` | `1px var(--ink)` |

- **One rule makes them one treatment**: the ghost is drawn in the colour of the surface it sits
  on. The card CTA takes its colours from `ghost-controls.ts` (`GHOST_PAPER_INK`,
  `GHOST_PAPER_FILL_HOVER`, `GHOST_PAPER_FILL_ACTIVE`) precisely so the two controls cannot drift.
- **The marker**: each marked rule declares `--ghost-control: ink` or `: white`
  (`GHOST_CONTROLS_MARKER`, `GHOST_SURFACE_INK`, `GHOST_SURFACE_WHITE`). No other rule in the
  bundle uses that property, so the build can see its own treatment in the CSS it ships instead of
  trusting the renderer. The review copy's stylesheet carries it **twice** (the paper rule and the
  home rule); the switch-off stylesheet carries it **zero** times, and no page of either bundle
  carries it at all (this session: `grep -c -- '--ghost-control:' /tmp/gdoc/{on,off}/maple-avenue-barber-shop/styles.css`
  → 2 and 0; `grep -rl -- '--ghost-control' /tmp/gdoc/{on,review}/maple-avenue-barber-shop/*.html` → 0
  files each, and the marker appears on the paper rule at line 960 and the home rule at line 990 of
  the switch-on stylesheet).
- **States.** Every state rule declares its own `color` (clause 6). On paper the states deepen the
  ink: hover `rgba(22, 24, 27, .08)`, active `rgba(22, 24, 27, .16)`, plus an inset ring that
  doubles the outline to 2px **without growing the 44px box**. On the photograph the same states
  deepen the veil (`rgba(10, 12, 14, .55)` / `.8`) **and** thicken the outline with a white halo —
  because on that band the fill cannot be the cue (§5).
- **Geometry is untouched**: no border-*width* change, no new radius, size, colour or breakpoint.
  The boxes are the ones the published design already had.
- **Nothing depends on JavaScript.** The treatment is a stylesheet; the markup is the same
  `<a class="call-button header-action">` and `<a class="service-cta">` the page always rendered.

## 2. The opt-in, and what it refuses

`DEMO_GHOST_CONTROLS` is **value-addressed**: the value names the treatment, not merely "on"
(`GHOST_CONTROLS_SURFACES`, `ghostControlsDecision`).

| value | result |
|---|---|
| unset, empty, `0`, `false`, `off` | off — the published stylesheet, byte for byte (`ghostControlsRequested`). |
| `1` · `true` · `on` · `yes` · `ghost` · `surface` · `follow-surface` · `outline-follows-surface` | on: `follow-surface`, the one resolution this build paints. |
| anything else — including `white`, `dark`, `2`, `maybe`, `follow surface`, `surfce` | **refused, and since `06db184` the build FAILS** (clause 0a). The accepted spellings are the eight above and nothing else; `follow surface` and `surfce` are near-misses of them, which is how the hole was found (`test/ghost-controls.test.ts`, "a switch value this build cannot read is refused rather than guessed at"). |

The refusal is not a warning: `ghostControlsProblems` clause 0a pushes a **problem**, and the
problem list is what `buildBundle` turns into `fail()`. The warning that used to be printed for
this case was removed for exactly that reason — a warning pushed before `fail()` is never printed
by anything, which would leave two accounts of one event and no reader for the honest one
(`build.ts`, the comment at the `ghost.enabled` warning). The build records the value it could not
read in the manifest's `ghost_controls.basis` too.

Scope refusals, each with its own basis sentence in the manifest: the **delivered phase**
(`phase === "business"`) and **every record except** `GHOST_CONTROLS_SLUG`
(`ghostControlsDecision`). A client's site carries the design the client agreed to.

## 3. The gate — the clause list

`ghostControlsProblems({ pages, css, decision })` in `src/demo/build.ts`, run from
`complianceChecks` on every bundle against the stylesheet the bundle actually ships. The function's
own header counts **eight clauses**; the code additionally labels a **4b**, which is a ninth check
over the same subject:

| clause | what it refuses | how it reads it |
|---|---|---|
| **0a** | a switch value that names no treatment this build paints | `decision.unrecognised`; read **before** the stylesheet, so an unreadable switch fails whatever stylesheet was written |
| **0b** | the marker reaching a **page** | `page.html.includes(GHOST_CONTROLS_MARKER)` for every rendered page |
| **1** | a stylesheet painting the ghost while the opt-in is **not** in force | marked rules found, `decision.enabled === false` |
| **2** | an opt-in that painted **nothing** | `decision.enabled === true`, zero marked rules |
| **3** | one surface only; a `white` claim not scoped to `.page--index`; an `ink` claim scoped to it; a marker on anything but the header's action | the marker's value on each marked rule vs the rule's selector |
| **4** | a fill at rest on a marked ghost; words and outline in different colours; a non-white ghost claiming the photograph; a non-ink ghost claiming paper; text under **4.5:1** (`LABEL_CONTRAST`) or outline under **3:1** (`WASH_CONTROL_CONTRAST`) against `--paper` | the shipped stylesheet, un-commented, resolved into rules |
| **4b** | a header state fill that is not ink, or that leaves the words under 4.5:1 on its own fill — read through `stateDeclarations` for `rest`/`hover`/`active`, on the paper rules only (the home rules are measured against the wash in `headerOverlayProblems` clause 6) | `stateDeclarations(headerGhostRules, state)` |
| **5** | the card CTA: a fill at rest, a non-ink text colour, an outline that is not the words' colour, text or outline under the floor; and the same for its state fills | every rule whose selector names `SERVICE_CARD_ACTION_CTA_CLASS` (`.service-cta`) |
| **6** | **a state rule that leaves `color` to the cascade** — and a control with no `:hover`/`:active` rule at all. Read on the **last** rule carrying the state's own selector, because that is the declaration the browser uses | `stateDeclarations` merges in document order, so this clause is deliberately not the same reading as clause 4b |
| `headerOverlayProblems` **clause 6** | the home header's ghost: not transparent at rest, an unreadable outline colour, boundary under 3:1 or label under 4.5:1 **against the wash**, outline and words in different colours, a state fill that is not ink, or a state that leaves the label under 4.5:1 on its fill | the scrim is already computed there, so the photograph half is measured in that clause and the paper half in clause 4/4b — neither repeats the other |

Every clause is asserted in `test/ghost-controls.test.ts`, and clause 6 is proved against the
**stylesheet that shipped the defect** (the same test file, "clause 6: the last rule carrying a
state's own selector must declare its own color"). `stateDeclarations` (build.ts) is the helper
that resolves a control's declarations through the cascade; without it the treatment was refused
for the white pill it overrides.

## 4. Before/after byte diff — re-run 10 Oct 2026

Commands, from `/home/team/shared/pipeline` (the branch) and a `master` worktree. `.env.local` is
copied into the worktree and `SS_RETENTION_LOG` set, or every fixture build fails before it starts:

```bash
bun run src/demo/cli.ts -- --record test/fixtures --out /tmp/gdoc/off                      # switch off
DEMO_GHOST_CONTROLS=surface bun run src/demo/cli.ts -- --record test/fixtures --out /tmp/gdoc/on
# master 11c21c7, built in a worktree:
SS_RETENTION_LOG=/home/team/shared/ops/retention-log.md bun run src/demo/cli.ts -- --record test/fixtures --out /tmp/gdoc/master
diff -rq /tmp/gdoc/master /tmp/gdoc/off ; diff -rq /tmp/gdoc/off /tmp/gdoc/on
```

**84 files each side**: king-west-dental 22, maple-avenue-barber-shop 22, northshore-garden-works
21, red-hill-property-care 19 (10, 10, 10 and 8 HTML files respectively; the rest is each bundle's
`styles.css`, `site.js`, `favicon.svg`, `README.txt`, `manifest.json`, `fonts/` and `images/`).
`find /tmp/gdoc/{master,off,on} -type f | wc -l` → 84, 84, 84.

| comparison | files that differ | files identical |
|---|---|---|
| **master → branch, switch off** | the four `manifest.json` — and nothing else | **all 80 other files, byte for byte** (`diff -rq --exclude=manifest.json` → 0 lines) |
| **branch off → branch on** | `maple-avenue-barber-shop/styles.css` and the four `manifest.json` | every page, script, favicon and image of all four bundles, including the three other `styles.css` files |

| file | switch off | switch on (`surface`) |
|---|---|---|
| `maple-avenue-barber-shop/styles.css` | 38,636 B / 889 lines | **41,863 B / 949 lines** (+3,227 B, +60 lines) |
| `maple-avenue-barber-shop/*.html` | — | byte-identical (the treatment writes no markup) |
| `northshore-garden-works/styles.css` | — | byte-identical (the scope refusal, not a silent edit) |

Why `manifest.json` always differs, and what it now says: `generated_at` and each image's
`retrieved_at` are timestamps and differ run to run; and the branch adds a **`ghost_controls`**
record that `master` does not have at all. With the switch off it reads
`enabled: false, treatment: null`; on the record the treatment is scoped to it reads
`enabled: true, treatment: "follow-surface", marker: "--ghost-control", pages_changed: []`, with
`note` naming the two refused resolutions of the contrast problem. On the other three records it
reads `enabled: false` with a basis saying the treatment is scoped elsewhere — which is why those
three manifests differ from the off build **while their stylesheets do not**.

The published stylesheet is therefore the switch-off one, and the switch-off build of this branch
is the same bytes as a build from `master`. *(Attribution: measured this session, `/tmp/gdoc/`.)*

## 5. The measured numbers

**The rendered numbers are in `/home/team/shared/design/ghost-controls-measurements.md`** — read
from rendered pixels (a visible shot plus a matching backdrop shot with the control's
`visibility:hidden`), both viewports, every state, with the pre-fix failing rows kept beside the
fixed ones and marked `FIXED 10 Oct 2026`. Those shots were taken on `feat/ghost-controls` at
`ea47016`. **The stylesheet the tip ships is byte-identical to that build's** — this session,
`sha256sum` of `maple-avenue-barber-shop/styles.css` built from `ea47016` and from `06db184` both
`6edbce4de47b3a228d58ac69a72ff67c4b4759469d811b18507642b229d3819d` (only `build.ts` and the new test
file changed between the two commits), so the numbers describe the tip and not a predecessor.

| control / state | @360 | @1440 | standard |
|---|---|---|---|
| home header white ghost, **rest** | 15.31:1 median / **11.40:1** worst pixel | 18.74 / **18.15:1** | ≥4.5:1 text ✅ |
| home header white ghost, **hover** | 11.40:1 worst (was 1.53/1.00 ❌) | 18.15:1 (was 1.09/1.02 ❌) | ✅ |
| home header white ghost, **active** | 11.40:1 worst (was ❌) | 18.15:1 (was ❌) | ✅ |
| home header white ghost, **focus** | 11.44:1, ring `#fff` 2px / offset 2px at 17.38:1 | 18.15:1, ring 18.62:1 | ≥3:1 indicator ✅ |
| home ghost's **outline**, rest → hover → active | 1px `#fff` 16.54:1 → 2px 16.57:1 → 3px 16.57:1 + halo | 18.62:1 | ≥3:1 boundary ✅ |
| paper header + card CTA ink ghost, **all four states** | **17.79:1** (text and outline, `rgb(22,24,27)` on `#fff`) | 17.79:1 | ✅ |
| ink ghost hover / active **fill** | `rgb(237,237,237)` (1.17:1 vs white) / `rgb(218,218,218)` (1.40:1) | same | — (a cue, not a boundary) |
| focus ring, both systems | `#9E2B23` 2px at 2px offset → **7.44:1** on white | same | ≥3:1 ✅ |

Standards in the build's own constants: `LABEL_CONTRAST = 4.5`, `WASH_CONTROL_CONTRAST = 3`,
`WASH_TEXT_CONTRAST = 5.6` (`build.ts`). The stylesheet's own arithmetic sits beside these in §8 of
the measurements file (`#16181B` on `#FFFFFF` computes 17.85:1, renders 17.79:1 — antialiasing at
the sampled border pixels), and the manifest's `ghost_controls.surfaces` records the stylesheet's
figures (16.9:1 on paper; 5.9:1 for white on the scrim's worst pixel).

**Geometry, measured this session** on the review copy (local harness, scrollbar hidden so the
layout width is really 360/1440): header action **108.3 × 44** at both widths; card CTA **270 × 44**
at 360 and **488 × 44** at 1440, `background rgba(0, 0, 0, 0)`, `1px rgb(22, 24, 27)` border,
`--ghost-control: ink` on the header action. Every box clears the 44px floor.

**What is not measured**: no assistive-technology testing is possible here, so anything about
screen-reader output or focus *order* is reasoning. `:hover` was measured in a desktop browser; a
phone has no hover, so what an owner sees on a tap is `:active`, which is measured. The halo's
contrast is computed from the measured backdrop (≈4.4–4.5:1), **not counted from changed pixels**.
The card CTA's 1440 focus state was not captured. No number in this document was taken from the
stylesheet's hex values alone.

## 6. Tab stops on `services.html`, re-walked 10 Oct 2026

Real <kbd>Tab</kbd> presses in a browser against the review copy
(`DEMO_SERVICE_CARD_ACTION_BAR=nested DEMO_GHOST_CONTROLS=surface`, local harness on
`/tmp/gdoc/review`), read off `document.activeElement` after each press:

- **360px: 13 tab stops.** 1 skip link · 2 `Pages` summary (44×44) · 3 wordmark · **4 the header
  action** (108.3×44) · **5–8 the four card CTAs** (`.service-cta`, 270×44 each) · 9 `Get
  directions` · 10 the footer's `Contact Us` · 11–12 the two `tel:` links · 13 `Privacy notice`.
  The 14th press leaves the page.
- **1440px: 17 tab stops** — the same list with the wide nav's five links (Home, Services, About,
  Contact, Privacy) in place of the `Pages` summary, which is **not a tab stop at that width**:
  the phone menu is `display: none` (`getComputedStyle(.site-menu).display === "none"` at 1440,
  `"block"` at 360), so the summary inside it is unrendered and unfocusable — asked to focus
  itself directly it stays unfocused and its box measures 0×0.
- A DOM-derived count that skips ancestors with `display: none` agrees with the walk at both
  widths (13 and 17 stops, 4 `.service-cta` elements each time).

**Correction to a figure in circulation:** the measurement note above says "at 1440 … 17 anchors +
the summary = **18**". The walk says **17**, and the summary is the reason — it is hidden at that
width, so it cannot be the 18th stop. The page wins. At 360 the note's **13** is confirmed, and so
is "the 4th stop is the header action" and "5th–8th are the four card CTAs". **No document in this
repository previously stated a tab-stop figure**, and none states one now except this section: the
number that used to be repeated as "four" was the four card CTAs, not the page's stop count.

## 7. The two resolutions of the contrast problem that are deliberately NOT built

Both are named in the refusal text a reader gets when they try to switch them on
(`ghostControlsDecision`, `ghostControlsProblems` clause 0a):

1. **A white ghost on every header** — value `white`. Over the paper headers, white words and a
   white outline on `#FFFFFF` measure **1.00:1**: invisible. Not accepted, not built. The brief of
   10 Oct asked for that number rather than for the variant.
2. **Darkening the inner-page headers** so they can carry white — value `dark`. It would need
   every paper header to give up the surface the owner saw, and the scrim's own ink
   (`rgba(10, 12, 14, .64)`) is what reaches ≈6:1 for white over pure white (5.9:1 in the
   manifest's own arithmetic, 6.0:1 in the module's comment — two figures for one mechanism, so
   neither is quoted as the measured one here). That is a change
   to the headers **signed off on 7 Oct 2026**, so it is the **owner's call and not this team's**.
   Not built, and not proposed as built: it stays an open question for the owner.

This is why the outline follows the surface, and it is also why the ink ghost on paper is the
treatment the card CTA wears.

## 8. The two defects this treatment has already had

Both are recorded because the fix is the reason two clauses exist, and a future reader who deletes
a clause should know what it was for.

1. **Hover and active rendered the home header's words invisible** (1.00–1.53:1 on the
   photograph). Cause: the ghost's state rules declared `background` and `box-shadow` but not
   `color`, so `.page--index .site-header .call-button:hover { background: #F1EEE8; color:
   var(--ink) }` — the page's own rule for that exact state, at the same weight, earlier in the
   file — painted the words; `:active` matches `:hover`, so both states failed. The build gate
   agreed with the broken cascade, because `stateDeclarations` merges in document order and the
   ghost's *resting* rule (which does declare `color: #fff`) came later. **What refuses it now:**
   every state rule of the treatment declares its own `color`, the photograph's cue moved to the
   outline (1px → 2px → 3px plus a white halo) with a deeper veil, and `ghostControlsProblems`
   **clause 6** refuses the last rule carrying a state's own selector that declares no `color` —
   proved against the pre-fix stylesheet in `test/ghost-controls.test.ts`. The page's own rule was
   not at fault and was not moved.
2. **A switch value this build could not read warned and exited 0.** Until `06db184` it printed
   `! ghost controls refused: …`, wrote the **filled buttons** and reported success — a review copy
   that lies about what it shows, which is the one outcome `ghost-controls.ts` says must never
   happen. **What refuses it now:** `ghostControlsProblems` **clause 0a** turns the unreadable
   value into a build problem, read before the stylesheet, and the warning that shadows it was
   deleted so one event has one account. Asserted per value (including the near-misses
   `follow surface` and `surfce`) in `test/ghost-controls.test.ts`.

## 9. What this document does not establish

- Anything about screen readers or focus order beyond the counts in §6, which are key-press walks,
  not assistive-technology testing.
- That the treatment is *good*: whether the owner keeps it is the owner's call, and the review
  copy's job is to show it.
- The wash-side deltas' perceptual weight on a real phone screen: hover does not exist on touch.
- Any Google-side claim: nothing here is a fact about Google's booking or profiles.

## 10. Where each piece lives

| piece | file |
|---|---|
| the switch, the decision, the vocabulary, the CSS block | `src/demo/ghost-controls.ts` |
| the gate (`ghostControlsProblems`, clause 6 of `headerOverlayProblems`, `stateDeclarations`) and the manifest record | `src/demo/build.ts` |
| the card CTA's own block, drawn in these colours | `src/demo/service-card-action.ts` |
| the regression tests, one per clause | `test/ghost-controls.test.ts` |
| the rendered numbers, both viewports, every state | `/home/team/shared/design/ghost-controls-measurements.md` |
| the screenshots | `/home/team/shared/design/screenshots/ghost-*.png` |
| the review handoff that introduced it | `/home/team/shared/design/ghost-controls-review.md` |

## 11. The button family — the treatment extended to every button (16 Oct 2026)

Owner direction by text, 16 Oct 2026: the outlined transparent treatment consistent across **every
button** of the Maple Avenue review copy. The rule did not change — the ghost is drawn in the
colour of the surface it sits on — only the number of controls it covers:

| control | surface (measured by rendered pixels, not read off the class) | ghost |
|---|---|---|
| CTA band's action (`.cta-actions .button`) | the band's own `--paper-2` #FAF7F2 | ink |
| form submit (`.form-actions .button`) | the same band | ink |
| Get directions (`.button--small`) | `--paper` #FFFFFF | ink |
| home hero's phone action (`.button--paper`) | **the hero photograph** — its class says paper and its surface does not | white |
| home hero's request action (`.button--ghost`) | the hero photograph | white |
| header action (`.call-button`) | photograph on the home page, paper elsewhere | white / ink |

The stylesheet a switch-on build ships therefore carries **four** marked rules (the header's two
surfaces and the family's two), and `ghostControlsProblems` gained: clause 3 accepts the family's
selectors; clause 4 measures the family's paper rules against the **worse of `--paper` and
`--paper-2`** (the band is not white, and a number stated against white would be a number for a
surface the control is not on); clause 6 requires a state rule of the family to declare its own
colour, as it does for the header; and clause 7 refuses, by name, a control the **cascade** still
paints as a filled pill — read through `restPaintOf`, a specificity-then-order reader, because the
question is what the browser paints and not what the treatment's own rule says — and a treatment
that marks the header's action but not the family.

Deliberately untouched: the quiet links (the booking line and the form-privacy notice — links, not
buttons), the review-only booking-comparison page's Google-button emulation (it shows Google's own
product; outlining it would distort the comparison), and the nested card CTA's approved
`translateY(1px)` on `:active`.

Numbers, the rendered box table (unchanged in all four states), the rendered contrast table at 360
and 1440, and the hierarchy finding: see `design/every-button-outlined-2026-10-16.md`, which lives
outside this repository.

**The clause is a rule now, not prose.** The session that wrote the family treatment left clause 7
untested, and by this team's own rule a rule with no test is no rule. It has since gained one test
per condition it guards (`test/ghost-controls.test.ts`), and `docs/clause-7-doctor-proofs.md`
carries the mutation sweep behind them: each condition removed from `build.ts` one at a time, the
suite watched going red, and the file restored byte-exact (suite 316 → 324). Nothing of the
treatment moved: the stylesheet a switch-on build writes is byte-identical before and after, which
is what the review copy the owner is holding was built from.
