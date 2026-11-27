/**
 * Site Sourced — **the Northshore theme**: the owner's experimental design pass on one
 * demonstration (24 Nov 2026).
 *
 * The owner's words: *"revise and publish the Northshore Garden Works review demo as an
 * experimental design pass, not a Maple clone. Use your own best judgment on
 * header/navigation, imagery, color palette, typography, layout, hierarchy, spacing, copy
 * presentation, and functionality."*
 *
 * ## What this is, and what it is not
 *
 * It is a **stylesheet variant for one record**. `styles.css` is written per bundle, so the
 * theme needs no page-level scope and no class on the markup: the block below is appended to
 * the stylesheet of the Northshore build and to no other. Every page of the bundle is the
 * page the shared renderer writes — **the theme moves one file and no page** — which is the
 * same shape as the ghost controls (`ghost-controls.ts`) and is why a client build cannot
 * inherit it: the decision is keyed to the slug *and* to the demonstration phase, and a
 * client's site is neither.
 *
 * It is not a second template. Every rule the build enforces on the shared design still
 * holds on this demo, and the theme is written to sit inside them rather than to test them:
 *
 *   - **The home header stays on the photograph** with the scrim `headerOverlayProblems`
 *     requires (the owner's 6 Oct retouch). The theme does not touch that block.
 *   - **Every button stays the outlined ghost** drawn in its surface's colour (owner, 10 and
 *     16 Oct). The theme changes a button's *shape* — square, small caps, letter-spaced —
 *     and never its fill, and it writes no `:hover`/`:active` rule on any control, because a
 *     state rule that does not declare its own colour is the defect `ghostControlsProblems`
 *     clause 6 refuses.
 *   - **The graphics rule** (owner, 24 Nov): a mark only beside the label it belongs to, no
 *     repetition, generous whitespace, no arc under a subpage band. The theme adds no mark
 *     of its own; the layer's marks are recoloured by `currentColor` and nothing else.
 *
 * ## The design, in one paragraph
 *
 * Maple Avenue is a barbershop: white paper, a bright leaf-green accent, rounded pills, a
 * white card per service. Northshore is a two-truck landscaping crew, and its demo is a
 * **field guide**: warm bone paper instead of white, deep evergreen ink instead of
 * blue-black, squared corners everywhere (the radius tokens are 3px), small-caps
 * letter-spaced controls, hairline rules instead of card shadows, services as a ruled list
 * rather than a grid of tiles, a dark evergreen band for every inner page's title, a second
 * dark band for "How an inquiry works", and a footer that closes the page with a forest rule.
 * The photograph keeps its place at the top of the home page; everything under it is a
 * different page from Maple's.
 *
 * ## Every colour pair, measured at build time
 *
 * The palette is a new set of values, so the contrast claims are not left in a comment:
 * `northshoreThemeProblems` reads the tokens **out of the stylesheet this module writes** and
 * computes every pair the design relies on, at build time, against the floors in `PAIRS`.
 * Change a token without re-measuring and the build fails with the number it now reaches.
 */
import type { FormDeliveryMode } from "./types.ts";

/** The one record this design pass is for. */
export const NORTHSHORE_THEME_SLUG = "northshore-garden-works";

/**
 * The marker the block declares: a custom property no other rule in the bundle writes, so
 * the build can see in the stylesheet it ships that the theme was written, instead of
 * trusting that the renderer called it. It paints nothing.
 */
export const NORTHSHORE_THEME_MARKER = "--theme";
/** The theme's own name, as the marker's value and the manifest's `treatment`. */
export const NORTHSHORE_THEME_NAME = "northshore-field-guide";

/**
 * The font files this pass brings into the bundle, and the shared face it replaces.
 *
 * Both files are copied into `fonts/` by `buildBundle` when — and only when — the theme is in
 * force, and the shared display face is left out of that bundle entirely: a bundle ships the
 * fonts it uses. The `.woff2` is a latin subset of **Source Serif 4** at weight 600, self-hosted
 * and loaded by a relative `url()` from `styles.css`, so the page fetches nothing from anyone
 * else's server; the `.txt` is its SIL Open Font License text, which has to travel with it.
 */
export const NORTHSHORE_THEME_FONT_FILES = ["source-serif-4-latin-600.woff2", "OFL-source-serif-4.txt"] as const;

/** The shared display face the theme's own face stands in for, and the bundle does not carry. */
export const NORTHSHORE_THEME_REPLACED_FONT_FILES = ["fraunces-latin-600.woff2"] as const;

/** What this build decided about the theme. */
export interface NorthshoreThemeDecision {
  enabled: boolean;
  slug: string;
  /** The treatment's name when it is on, `null` when it is not. */
  name: string | null;
  /** Why — the same sentence the warning and the refusal carry. */
  basis: string;
}

/**
 * The theme is on for the one demonstration it was designed for, and off everywhere else:
 * another record, and every delivered build. There is no switch: the owner asked for this
 * demo to *be* the design pass, so a build of it that silently skipped the theme would be a
 * review copy that lies about what it shows. The refusal runs the other way instead — a
 * stylesheet carrying the theme for any other slug fails the build by name.
 */
export function northshoreThemeDecision(vars: { slug: string; phase: FormDeliveryMode }): NorthshoreThemeDecision {
  const enabled = vars.slug === NORTHSHORE_THEME_SLUG && vars.phase === "demo";
  return {
    enabled,
    slug: vars.slug,
    name: enabled ? NORTHSHORE_THEME_NAME : null,
    basis:
      vars.slug !== NORTHSHORE_THEME_SLUG
        ? `the theme is ${NORTHSHORE_THEME_SLUG}'s own design pass (owner direction, 24 Nov 2026) and this record is "${vars.slug}"; every other bundle — Maple Avenue and every client build — keeps the shared design.`
        : vars.phase !== "demo"
          ? `the theme is a review copy's design pass; ${NORTHSHORE_THEME_SLUG} is being built as a delivered site, and a delivered site carries the design its owner agreed to, not our experiment.`
          : `${NORTHSHORE_THEME_SLUG} is a demonstration, so this build carries the theme: the field-guide palette, squared corners, ruled lists and dark title bands described in src/demo/theme-northshore.ts. Most of it is styles.css, and two pieces of markup move with it, on this record alone: the service cards carry no repeated mark, and the home hero no longer repeats the header's Contact Us button (the call and the form stay).`,
  };
}

/* ---------------------------------------------------------------- the stylesheet */

/**
 * The theme, as CSS. Appended to the bundle's stylesheet **after** every other block, so it
 * wins by document order at equal specificity — the same cascade the ghost treatment relies
 * on. Two rules it deliberately does not write: any `background` on `.button`/`.call-button`
 * (the fill is the treatment's, not the theme's) and any state rule on a control.
 */
export function northshoreCss(): string {
  return `
/* ==================== the Northshore theme — the owner's second experimental pass (24 Nov 2026)
   A field guide, not a barbershop: bone paper, evergreen ink, hairline rules, ruled lists,
   restrained corners, and a dark evergreen band for every inner page's title. The type is one
   open-licence superfamily in two roles — Source Serif 4 for display, Source Sans 3 for text —
   both files inside the bundle.
   Written for one demonstration (${NORTHSHORE_THEME_SLUG}) and appended to that bundle's
   stylesheet alone. It paints no mark of its own, adds no request, and touches no page.
   Source: src/demo/theme-northshore.ts — the measured pairs are in PAIRS there. */
.ns-theme { ${NORTHSHORE_THEME_MARKER}: ${NORTHSHORE_THEME_NAME}; }

/* The display face this pass brings with it: a self-hosted latin subset of Source Serif 4 at
   one weight (SIL Open Font License 1.1, fonts/OFL-source-serif-4.txt travels with it). The
   shared Fraunces face is not written into this bundle's stylesheet and its file is not copied
   into it (render.ts, build.ts): a bundle ships the fonts it uses. */
@font-face {
  font-family: "Source Serif 4";
  src: url("fonts/source-serif-4-latin-600.woff2") format("woff2");
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}

:root {
  /* Colour. The ink is a deep evergreen rather than a blue-black, the accent is the green of
     a hedge in shade, and the paper is warm — the three changes that do most of the work. */
  --accent: #3C6B45;
  --accent-ink: #2A4E32;
  --accent-soft: #E3E9D8;
  --ink: #14231A;
  --body-text: #2F3D33;
  --muted: #55625A;
  --paper: #FAF7EF;
  --paper-2: #EFEADD;
  --line: #D9D2C0;
  --footer-ink: #C9D2C6;

  /* Type. One superfamily in two roles: Source Serif 4 (600) carries the display line, the
     section headings, the wordmark and the figures; Source Sans 3 carries every word a visitor
     reads in a sentence. The scale is a little smaller and a lot calmer than the first pass —
     a serif with a 1.03 line-height at 3.6rem needs no tighter tracking to hold together. */
  --font-display: "Source Serif 4", "Source Serif Pro", Georgia, "Times New Roman", serif;
  --fs-display: clamp(2.35rem, 11vw, 3.6rem);
  --fs-page: clamp(1.95rem, 8vw, 2.75rem);
  --fs-h2: clamp(1.4rem, 5vw, 1.95rem);
  --fs-h3: 1.25rem;
  --fs-lead: clamp(1.0625rem, 2.4vw, 1.1875rem);
  --fs-label: 0.6875rem;

  /* Space: one step more generous than the shared rhythm at every section boundary. */
  --section-y: clamp(3.25rem, 8.5vw, 5.5rem);

  /* Shape: a restrained radius, two steps — 6px on anything a thumb presses (buttons, fields,
     chips, the numbered steps) and 10px on anything that is a surface (the menu panel, a
     notice, the framed form). Never a pill, never a hard square. */
  --r-sm: 4px;
  --r-md: 6px;
  --r-lg: 10px;
}

body { background: var(--paper); color: var(--body-text); }
h1 { line-height: 1.03; letter-spacing: -0.012em; }
h2 { line-height: 1.14; letter-spacing: -0.008em; }
h3 { letter-spacing: 0; }
p { line-height: 1.62; }
/* Figures that line up in a column — the hours table is the one place a visitor compares
   numbers row against row, and proportional digits make that harder than it needs to be. */
.hours-row, .hours dt, .hours dd, .step-num { font-variant-numeric: tabular-nums; }

/* The proposal banner is honest furniture and stays first, in flow and visible without
   scrolling — but it is a notice, not a headline: a bone strip with the page's own hairline
   under it, where the shared design paints a black slab that out-shouts the header. */
.proposal-banner {
  background: var(--paper-2);
  color: var(--ink);
  border-bottom: 1px solid var(--line);
}
.proposal-banner p { font-size: 0.8125rem; line-height: 1.5; padding: 0.75rem 0; }

/* --------------------------------------------------------------- header */
/* A paper header ruled off with the ink itself, on every page but the home page — where the
   header is on the photograph and the shared overlay block owns it (untouched here). */
.site-header { border-bottom: 1px solid var(--ink); }
.wordmark { font-size: 1.1875rem; letter-spacing: -0.005em; }

/* ------------------------------------------- the phone header: two rows, both of them meant */
/* At 320–414 the header is two rows and the shared rule leaves both of them to chance: the
   wordmark is given "flex: 1 1 50%", so it grows to fill the first line and its last letter
   lands on the right gutter, while the trigger's 44px box sits 16px from the left edge and the
   name starts 60px in — the site's name is the only line on the page that does not begin on the
   page's column, and the row reads as a bar packed edge to edge. The action, which cannot share
   a line with both, is then left alone on the second row, right-aligned, belonging to nothing.
   So each row is given a job instead: **the name owns the first row on the page's own left
   column, and the second row is the header's control bar — the menu at the left gutter, the
   page's action at the right gutter.** Two things follow, and they are the point: the name
   starts where every other line on the page starts, and the trigger no longer competes with it
   for the same line, so it has air above and beside it instead of being wedged against the
   last letter. Nothing is added, removed or reordered in the document: the same <details>, the
   same three items, the same two rows, no script and no new mechanism — this is the same
   header, composed. The wide header is untouched: the min-width block further down restores
   the one-line row, and its own rules never see these.
   The one thing the composition costs, stated rather than hidden: the trigger is the first of
   the three in the document and the name is the first to the eye, so the tab order reaches the
   trigger before the name — a swap of two neighbours inside one header, with nothing skipped,
   nothing hidden and nothing added. The markup is not ours to reorder on this record alone (a
   page that moved for one demonstration would move for Maple and every client build with it),
   and the alternative — the name starting 60px in behind the trigger's box, which is what the
   shared rule gives — is the layout this replaces. */
@media (max-width: 47.99rem) {
  /* The name takes the row it now has: the full measure, on the gutter, and 44px tall so that
     the way home is a target a thumb can hit rather than a 23px line of type. */
  .wordmark { order: -1; flex: 1 1 100%; display: flex; align-items: center; min-height: 2.75rem; }
  /* The control bar. The trigger keeps its own 44x44 box, its outline and its colour; what it
     loses is the name's shoulder. The action keeps its place at the right gutter, and now it
     shares the row with the control rather than sitting alone on one. */
  .site-header .call-button { order: 1; margin-left: auto; }
}

/* ---------------------------------------------- the menu: one control, not two */
/* The owner's first fix of this pass: the open menu must feel like the same control as the
   button that opened it. Four things make a panel read as a second, separate control — its
   own shape, its own shadow, a different fill from its trigger, and a gap of page between
   them. All four go:
     - the trigger and the panel are the same surface with the same 1px outline;
     - the panel loses its shadow, so nothing floats;
     - the trigger's open state is drawn on the trigger itself — the three bars become an X;
     - the panel is the header's own full width, flush under the header's rule, so the two
       boxes share one edge and one outline instead of the panel hanging off the trigger's
       corner as a separate card.
   Nothing here changes what the control does: a native <details>, keyboard-operable, no script. */
.site-menu-summary {
  border: 1px solid var(--ink);
  border-radius: var(--r-md);
  /* Transparent, never filled (owner, 24 Nov 2026): the trigger is an outline and nothing
     else, so it reads the same as every other control on the page and lets the surface it
     sits on show through. The outline follows that surface — ink on bone paper, white over
     the home photograph — which is the rule the buttons already keep. */
  background: transparent;
  color: var(--ink);
}
.site-menu[open] .site-menu-summary { background: transparent; border-color: var(--ink); }
/* **The icon is one 18x18 footprint in both states** (owner, 25 Nov 2026: the bars and the X
   integrated with the trigger, and white in every state). The shared sheet draws the three
   bars as one 18x2 element plus two shadows, and the open state crossed that same 2px
   element — so the X spanned about 13px where the bars spanned 18 and read as a smaller,
   weaker mark floating inside the same box. Here both states are drawn in the same 18x18
   square at the same 2px weight: three bars at rest, two full diagonals when open. The markup
   is untouched — one span, no icon file, no second element. */
.site-menu-icon { position: relative; width: 1.125rem; height: 1.125rem; background: none; box-shadow: none; }
.site-menu-icon::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0.5rem;
  height: 2px;
  background: currentColor;
  box-shadow: 0 -0.4375rem 0 currentColor, 0 0.4375rem 0 currentColor;
}
.site-menu[open] .site-menu-icon::before { box-shadow: none; transform: rotate(45deg); }
.site-menu[open] .site-menu-icon::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0.5rem;
  height: 2px;
  background: currentColor;
  transform: rotate(-45deg);
}
/* The home header sits on the photograph, so the trigger is white there — outline and icon
   alike, in the closed, open, focus and active states. Every other page keeps the ink its
   paper header calls for: white on bone paper is 1.07:1, and the outline follows the surface,
   as the buttons do. The sheet the trigger opens is paper on both surfaces, so the trigger is
   the only thing whose colour changes with the surface under it. */
.page--index .site-menu-summary,
.page--index .site-menu[open] .site-menu-summary { border-color: #fff; color: #fff; }
/* The trigger's two engaged states, in the vocabulary every other control on the page already
   speaks: a state is a **thicker outline**, never a fill (owner, 16 Oct 2026). Closed, the
   trigger is a 1px outline; open — the menu is up and the control is doing something — it
   thickens to the 2px the header's action wears, in the same colour the surface gave it, so
   the engaged control and the primary action read at one weight. A press thickens it the same
   way, which is the only answer a phone gets between the tap and the page: on a sheet this
   size the tap is the whole interaction, and until now nothing on the trigger acknowledged it.
   box-sizing is border-box site-wide, so the 44x44 target stays exactly 44x44 and the header
   does not move by a pixel; the keyboard's ring is an outline rather than a border, so the
   focus treatment is untouched and still wins. */
.site-menu[open] .site-menu-summary,
.site-menu-summary:active { border-width: 2px; }

/* ------------------------------------------------------ the phone menu: a sheet */
/* The owner's second look at this menu (brief of 25 Nov 2026): it has to read as a deliberate,
   finished thing rather than a dropdown of small text. A small card hung off the trigger's
   corner reads as a box that happens to be open; a sheet reads as the page's own navigation.
   So below 48rem the panel is the header's full width — edge to edge, squared, flush under the
   header's ink rule and ruled off at its foot — with the page's links set as a ruled list of
   small caps on 52px rows, and one heavier rule before Contact Us, the row that asks something
   of the visitor where the other three only take them somewhere.
   Nothing is added to the page for it: the same <details>, the same <nav>, the same four links,
   no script, no shadow, no mark and no icon beyond the trigger's own bars/X. */
@media (max-width: 47.99rem) {
  .site-nav {
    left: 0;
    right: 0;
    width: auto;
    min-width: 0;
    margin-top: 0;
    padding: 0;
    background: var(--paper);
    border: 0;
    border-top: 1px solid var(--ink);
    border-bottom: 1px solid var(--ink);
    border-radius: 0;
    box-shadow: none;
    /* **A short screen scrolls the sheet, it does not lose the bottom of it.** The sheet hangs
       under the header at top: 100%, and the header is its positioned ancestor, so 100% in the
       cap below is exactly the header's own height. What is left between the sheet's foot and
       the bottom of the screen is therefore the viewport, minus the header, minus the one thing
       above the header: the proposal banner, which is 4rem at every phone width (measured 64px
       at 568, 640 and 740 wide; one line, 44.5px, from about 50rem). Four 52px rows and the
       heavier rule before Contact Us come to 221px, so a portrait phone has room to spare and
       nothing here applies to it. A landscape phone does not: 568x320 leaves 320 - 132 = 188px
       below the header, and before this cap the last row and the sheet's foot rule fell 33px
       past the bottom of the screen, where nothing could reach them — an absolutely positioned
       box adds no height to the page to scroll, and the sheet had no scroll of its own. Now the
       sheet stops at the screen's own foot and the rows travel inside it, so the last row can be
       scrolled to. Where the content already fits, the cap is never reached: the sheet is its
       own height, no scrollbar, no clipping, not a pixel of difference on a normal phone. The
       top and bottom rules stay on the sheet's own edge while the rows move under them, so it
       still reads as one sheet flush under the header rather than as a scrolled box. */
    max-height: calc(100vh - 100% - 4rem);
    max-height: calc(100dvh - 100% - 4rem);
    overflow-y: auto;
    /* A flick that reaches the end of the sheet must not carry on into the page behind it. */
    overscroll-behavior: contain;
  }
  .site-nav ul { gap: 0; }
  /* The row's own hairline, full bleed: on a sheet the rules are the structure, and a rule
     that stops at the gutter would read as a box inside a box. */
  .site-nav li { border-top: 1px solid var(--line); }
  .site-nav li:first-child { border-top: 0; }
  .site-nav li:nth-last-child(2) { margin-top: var(--s-2); border-top: 1px solid var(--ink); }
  .site-nav a {
    min-height: 3.25rem;
    /* The leading bar below is 4px of the row, so the words still start on the gutter's line,
       under the wordmark. */
    padding: 0 var(--gutter) 0 calc(var(--gutter) - 4px);
    border: 0;
    border-left: 4px solid transparent;
    border-radius: 0;
    background: none;
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink);
  }
  .site-nav a:hover { background: var(--paper-2); color: var(--ink); }
  /* The current page: the accent's bar on the row's leading edge, the accent's ink in the
     words, and the alternate band behind them. Three quiet signals rather than one loud one,
     so the row a visitor is already on is unmistakable without shouting — and it is the same
     state the wide row shows with its underline, in the shape this menu has. */
  .site-nav a[aria-current="page"] {
    background: var(--paper-2);
    color: var(--accent-ink);
    border-left-color: var(--accent);
  }
  /* A press has to be answered before the page changes. The rows carried a hover state and
     nothing else, and on a phone there is no hover to give: the finger lands, the page
     navigates, and nothing in between said the tap had been taken. The pressed row deepens a
     step past the hover band — to the rule colour, one tone under the alternate band — so the
     answer is unmistakable and still the palette's own. The current page's row deepens too and
     keeps its accent bar and accent ink: its own rule is the more specific of the two, so it
     has to be said again here, or the row a visitor is already on would be the one silent row
     on the sheet. */
  .site-nav a:active { background: var(--line); color: var(--ink); }
  .site-nav a[aria-current="page"]:active {
    background: var(--line);
    color: var(--accent-ink);
    border-left-color: var(--accent);
  }
  /* The ring is drawn inside the row: a full-bleed row's focus ring hung outside it would be
     clipped by the sheet's own edge. */
  .site-nav a:focus-visible { outline-offset: -3px; }
}

/* --------------------------------------------------------------- buttons */
/* Shape only. The fill, the ink, the white ghost over the photograph and every state belong
   to the treatment in the shared sheet, and the theme leaves all of it alone. */
.button, .call-button {
  border-radius: var(--r-md);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding-inline: 1.05rem;
}
.button--small { font-size: 0.6875rem; padding-inline: 0.9rem; }

/* ------------------------------------------------------------------- hero */
/* The photograph keeps the first screen; the copy over it is the theme's. The two actions
   are stacked full width on a phone so a thumb has one target under another, and the pair is
   ranked by weight rather than by fill: the message form — the one route that works on a
   demonstration — carries the heavier outline and the larger box, the phone number the
   lighter one. Nothing is reordered, so the tab order still matches the eye's order. */
.hero h1 { font-size: var(--fs-display); max-width: 15ch; }
.hero-lead { max-width: 27rem; }
.hero-inner { padding-bottom: var(--s-7); }
.hero-actions { flex-direction: column; align-items: stretch; gap: var(--s-2); }
.hero-actions .button { width: 100%; }
.hero-actions .button--paper { min-height: 2.75rem; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.08em; }
.hero-actions .button--ghost { min-height: 3rem; border-width: 2px; font-size: 0.8125rem; letter-spacing: 0.1em; }
.hero-caption { font-size: 0.8125rem; max-width: 40em; }

/* --------------------------------------------------------------- page head */
/* Every inner page opens on a dark evergreen band: the title is the loudest thing on the
   page and the band is what makes it so, without a photograph and without a shadow. No mark
   is added to the band — the layer's page mark sits in the eyebrow, beside its label. */
.page-head {
  background: var(--ink);
  border-bottom: 0;
  padding: clamp(2.75rem, 9vw, 4.5rem) 0 clamp(2.25rem, 7vw, 3rem);
}
.page-head h1 { color: #F7F4EA; font-size: var(--fs-page); line-height: 1.0; }
.page-head .lead { color: #D6DED0; max-width: 32em; }
.page-head .eyebrow { color: #A9C0A4; }
.page-head + .section { padding-top: var(--section-y); }

/* --------------------------------------------------------------- eyebrow */
/* No dash, no accent bar: a tracked small-caps label in the accent's ink. It reads as a
   caption to the thing under it, which is what an eyebrow is for. */
.eyebrow { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.16em; color: var(--accent-ink); }
.eyebrow::before { display: none; }

/* --------------------------------------------------------------- sections */
/* A hairline above each section heading, the width of the text measure: the page's rhythm
   comes from rules, not from shadows. */
.section h2::before {
  content: "";
  display: block;
  width: 100%;
  height: 1px;
  border-radius: 0;
  background: var(--line);
  margin-bottom: var(--s-4);
}
.section--alt { background: var(--paper-2); border-block: 1px solid var(--line); }
/* **The home page's services heading has to out-rank the five card headings under it**
   (owner, 25 Nov 2026). The field guide's own devices do it — scale, the ink rule that marks
   a change of subject, and air: the section's h2 goes to a display size and takes the ink
   rule where every other section keeps the hairline, the card headings step down a little,
   and the list starts a step further below the heading than it did. No badge, box, shadow,
   icon or mark is added, and nothing here reaches the services page, whose cards are the
   page's own h2s. */
.section--alt#services h2 { font-size: clamp(2rem, 8.5vw, 2.5rem); letter-spacing: -0.015em; margin-bottom: var(--s-2); }
.section--alt#services h2::before { height: 2px; background: var(--ink); margin-bottom: var(--s-3); }
.section--alt#services .services { margin-top: var(--s-6); }
.lead { max-width: 32em; }

/* The services list, as a ruled menu: one line per service, its note under it, its action at
   the foot. The card surface, the shadow and the radius all go — the list is the page's own
   paper, divided by hairlines, which is cheaper on the eye than five identical boxes. */
.services { gap: 0; margin-top: var(--s-5); border-top: 1px solid var(--line); }
.services li { border-bottom: 1px solid var(--line); }
.services .card.service-tile {
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}
.services .service-tile--cta .service-tile-body { padding: var(--s-5) 0 var(--s-3); }
.services h3 { font-size: 1.1875rem; letter-spacing: 0; }
.services p { font-size: 0.9375rem; }
/* The card's action, sized to sit with its card rather than on top of it (the owner's second
   fix of this pass). The first pass set it in 0.75rem caps at 700 with wide tracking, which
   made a 44px ink-outlined slab the heaviest thing in a row whose heading is one line of
   serif — the button read as the card's headline. It keeps the 44px target, the outlined
   treatment and its own ink; what it loses is the weight and the letter-spacing that made it
   shout, and the padding that made it wide. It hugs its label and sits at the card's own
   left edge, one step below the note it belongs to. */
.services .service-tile--cta .service-cta {
  align-self: flex-start;
  min-height: 2.75rem;
  max-width: 100%;
  margin: 0 0 var(--s-4);
  padding: 0 0.8rem;
  border-radius: var(--r-md);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

/* The hours table and the extras card: ruled, not boxed. */
.hours.card, .extras.card {
  background: transparent;
  border: 0;
  border-top: 1px solid var(--line);
  border-radius: 0;
  box-shadow: none;
}
.hours-row, .extras-item { padding-inline: 0; }

/* How an inquiry works: the page's second dark band, and the numbered steps set as a plan. */
#how { background: var(--ink); }
#how h2 { color: #F7F4EA; }
#how h2::before { background: rgba(247, 244, 234, .22); }
#how .steps { border-top: 1px solid rgba(247, 244, 234, .18); }
#how .steps li { border-bottom-color: rgba(247, 244, 234, .14); }
#how .step-num {
  width: 2rem;
  height: 2rem;
  border: 1px solid #A9C0A4;
  border-radius: var(--r-sm);
  background: none;
  color: #A9C0A4;
  font-family: var(--font-display);
  font-size: 1rem;
}
#how .step-text { color: #E4E8DC; }

/* The CTA band: a rule of ink across the top of its own measure, so the page's last ask
   reads as a heading rather than as another band of paper. */
#contact { border-block: 1px solid var(--line); }
#contact > .wrap { border-top: 2px solid var(--ink); padding-top: var(--s-5); }

/* ------------------------------------------------------------ contact + form */
/* The form is the contact page's work, so it is framed by the same ink rule and its fields
   are filled with the page's own paper. The notice is a surface, so it takes the surface
   radius; the fields are things a thumb presses, so they take the control radius. */
.notice, .form-notice {
  background: var(--paper-2);
  border: 1px solid var(--line);
  border-left: 3px solid var(--accent);
  border-radius: var(--r-lg);
}
.contact-form { border-top: 2px solid var(--ink); padding-top: var(--s-5); }
.field input, .field textarea, .field select { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--paper); }
.chip-text { border-radius: var(--r-md); }
.chip input:checked + .chip-text { border-color: var(--ink); }
.field-group-legend, .extras-item dt { letter-spacing: 0.14em; }
.contact-fallback { border-top: 1px solid var(--line); }

/* ------------------------------------------------------------- privacy page */
.privacy-notice { max-width: 40rem; }
.privacy-notice h2 { margin-top: var(--s-6); padding-top: var(--s-4); border-top: 1px solid var(--line); font-size: 1.15rem; }
.privacy-notice h2:first-child { border-top: 0; padding-top: 0; }

/* ---------------------------------------------------------------- footer */
.site-footer {
  background: var(--ink);
  border-top: 4px solid var(--accent);
  padding: var(--s-8) 0;
}
.footer-biz { font-size: 1.6rem; letter-spacing: -0.02em; }
.footer-contact { font-size: 0.9375rem; }
.disclaimer { font-size: 0.875rem; }

/* ------------------------------------------------------------ wider screens */
@media (min-width: 48rem) {
  .hero-inner { padding-bottom: var(--s-8); }
  /* The hero's pair sits side by side again, in the order it is written. */
  .hero-actions { flex-direction: row; align-items: center; gap: var(--s-3); }
  .hero-actions .button { width: auto; }
  /* One ruled line per service, full measure: a menu, not a grid of tiles. */
  .services { grid-template-columns: minmax(0, 1fr); }
  .services .service-tile--cta { flex-direction: row; align-items: center; justify-content: space-between; gap: var(--s-6); }
  .services .service-tile--cta .service-tile-body { padding: var(--s-5) 0; }
  .services .service-tile--cta .service-cta { flex: none; margin: 0; }
  /* ------------------------------------------------ the classic wide header */
  /* The owner's direction (25 Nov 2026): on desktop the page links are listed plainly beside
     the wordmark, with no hamburger, no panel and no box around them. What was wrong was the
     box: the panel's ink surface was written for the phone's sheet and outlived it up here,
     where it drew an evergreen rectangle behind five links that sat on the header's own line.
     The fill, the outline and the panel's geometry are undone for the wide row, and what is
     left is the header's own surface with the links on it — white over the home photograph,
     ink on paper — and the outlined action at the end.
     The wide row keeps a 44px-tall target per link and the current page's mark: an underline
     in the accent (white over the photograph), set a little clear of the caps so it reads as a
     rule rather than as a clipped descender. */
  .site-nav {
    flex: 0 0 auto;
    margin-left: var(--s-6);
    padding: 0;
    background: none;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    width: auto;
    min-width: 0;
  }
  .site-nav ul { gap: 0 1.75rem; }
  .site-nav li { margin: 0; border: 0; }
  .site-nav a {
    min-height: 2.75rem;
    padding: 0 0 0.25rem;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: none;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink);
  }
  .site-nav li:last-child a { border-bottom: 2px solid transparent; }
  .site-nav a:hover { background: none; color: var(--ink); border-bottom-color: var(--line); }
  .site-nav a[aria-current="page"] { background: none; color: var(--accent-ink); border-bottom-color: var(--accent); }
  /* Over the photograph the row is white, its hover rule is white at two-thirds, and the
     current page's rule is solid white: the same three states, on the other surface. */
  .page--index .site-header .site-nav a { color: #fff; }
  .page--index .site-header .site-nav a:hover { color: #fff; border-bottom-color: rgba(255, 255, 255, .6); }
  .page--index .site-header .site-nav a[aria-current="page"] { color: #fff; border-bottom-color: #fff; }
  /* The action closes the row: a gap from the last link, and no auto margin of its own now
     that the wordmark's own growth is what holds the pair against the right edge. */
  .site-header .call-button { margin-left: var(--s-6); }
}
`;
}

/* ------------------------------------------------------------ the measured pairs */

type Rgb = [number, number, number];

/** WCAG relative luminance of an 8-bit sRGB colour. */
function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** The WCAG contrast ratio between two opaque colours. */
function contrastRatio(one: Rgb, two: Rgb): number {
  const a = relativeLuminance(one);
  const b = relativeLuminance(two);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** `#RRGGBB` (or `#RGB`) to channels; anything else is `null`, and the check says so. */
function hexToRgb(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, "");
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}

/**
 * Every colour pair the theme's design relies on, with the floor each one has to clear and
 * what a visitor reads through it. `fg` and `bg` are written as the stylesheet writes them —
 * a `var(--token)` or a literal hex — and are resolved out of the stylesheet the build ships,
 * so a token that moves without its number being re-measured fails the build.
 *
 * Floors: 4.5:1 for text a visitor reads, 3:1 for a control's own boundary (the focus ring).
 */
export const PAIRS: readonly { fg: string; bg: string; min: number; what: string }[] = [
  { fg: "var(--body-text)", bg: "var(--paper)", min: 4.5, what: "body copy on the page's paper" },
  { fg: "var(--body-text)", bg: "var(--paper-2)", min: 4.5, what: "body copy on an alternate band" },
  { fg: "var(--muted)", bg: "var(--paper)", min: 4.5, what: "the muted line — hours, captions, caveats" },
  { fg: "var(--muted)", bg: "var(--paper-2)", min: 4.5, what: "the muted line on an alternate band" },
  { fg: "var(--ink)", bg: "var(--paper)", min: 4.5, what: "headings, and every control's words and outline" },
  { fg: "var(--ink)", bg: "var(--paper-2)", min: 4.5, what: "headings on an alternate band" },
  { fg: "var(--accent-ink)", bg: "var(--paper)", min: 4.5, what: "links and the eyebrow" },
  { fg: "var(--accent-ink)", bg: "var(--paper-2)", min: 4.5, what: "links on an alternate band" },
  { fg: "var(--accent)", bg: "var(--paper)", min: 3, what: "the focus ring, and the rules the accent draws" },
  { fg: "var(--accent)", bg: "var(--paper-2)", min: 3, what: "the phone menu's current-page bar on its alternate band" },
  { fg: "var(--footer-ink)", bg: "var(--ink)", min: 4.5, what: "the footer's small print" },
  { fg: "#F7F4EA", bg: "var(--ink)", min: 4.5, what: "an inner page's title on its dark band" },
  { fg: "#D6DED0", bg: "var(--ink)", min: 4.5, what: "an inner page's lead on its dark band" },
  { fg: "#A9C0A4", bg: "var(--ink)", min: 4.5, what: "the eyebrow and the step numerals on a dark band" },
  { fg: "#E4E8DC", bg: "var(--ink)", min: 4.5, what: "the inquiry steps' text on a dark band" },
];

/**
 * The `:root` declarations of the stylesheet, as the build reads them back — **the last
 * block**, because the theme's own `:root` comes after the shared one and is what the
 * cascade resolves to. Reading the first block would measure the palette the theme replaces.
 */
function tokensOf(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  const blocks = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/:root\s*\{([\s\S]*?)\}/g)];
  const root = blocks[blocks.length - 1];
  if (!root) return tokens;
  for (const line of root[1]!.split(";")) {
    const match = /^\s*(--[a-z0-9-]+)\s*:\s*(.+?)\s*$/i.exec(line);
    if (match) tokens.set(match[1]!, match[2]!);
  }
  return tokens;
}

/** A `var(--x)` or a literal, resolved against the stylesheet's own `:root`. */
function resolve(value: string, tokens: Map<string, string>): Rgb | null {
  const variable = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i.exec(value.trim());
  if (variable) {
    const token = tokens.get(variable[1]!);
    return token === undefined ? null : hexToRgb(token);
  }
  return hexToRgb(value);
}

/**
 * The theme's own checks. Four clauses, all of them able to fire:
 *
 *  1. the theme is in force and the stylesheet does not carry it — a build that asked for the
 *     design pass and shipped the shared design;
 *  2. the stylesheet carries it and the theme is **not** in force — the theme smuggled into a
 *     record it is not scoped to (Maple Avenue, a client build, a delivered build);
 *  3. it is in force for a slug other than the one it was designed for;
 *  4. every colour pair in `PAIRS` clears its floor **as measured off this stylesheet**.
 */
export function northshoreThemeProblems(vars: {
  slug: string;
  decision: NorthshoreThemeDecision;
  /** The stylesheet the bundle ships. */
  css: string;
}): string[] {
  const problems: string[] = [];
  const { slug, decision, css } = vars;
  const carries = css.includes(NORTHSHORE_THEME_MARKER);

  if (decision.enabled && !carries) {
    problems.push(
      `the stylesheet this bundle ships does not carry the Northshore theme (no rule declares ${NORTHSHORE_THEME_MARKER}: ${NORTHSHORE_THEME_NAME}) while this build decided it should: the design pass would ship as the shared design wearing its name. ${decision.basis}`,
    );
  }
  if (carries && !decision.enabled) {
    problems.push(
      `the stylesheet this bundle ships carries the Northshore theme (${NORTHSHORE_THEME_MARKER}: ${NORTHSHORE_THEME_NAME}) while it is not in force for "${slug}". The theme is one demonstration's design pass: it is refused on every other record, and refused in the delivered phase, because a client's site carries the design its owner agreed to. ${decision.basis}`,
    );
  }
  if (decision.enabled && slug !== NORTHSHORE_THEME_SLUG) {
    problems.push(
      `the Northshore theme is in force for "${slug}", but it was designed for ${NORTHSHORE_THEME_SLUG} alone. A design pass is one record's, never the template's: a second record wearing it is a record whose own design was never looked at.`,
    );
  }
  if (carries) {
    const tokens = tokensOf(css);
    for (const pair of PAIRS) {
      const fg = resolve(pair.fg, tokens);
      const bg = resolve(pair.bg, tokens);
      if (!fg || !bg) {
        problems.push(
          `the Northshore theme's pair "${pair.fg} on ${pair.bg}" (${pair.what}) cannot be measured: ${!fg ? pair.fg : pair.bg} is not a colour this build can read out of the stylesheet. A contrast claim that cannot be computed is not a claim.`,
        );
        continue;
      }
      const ratio = contrastRatio(fg, bg);
      if (ratio < pair.min) {
        problems.push(
          `the Northshore theme's pair "${pair.fg} on ${pair.bg}" (${pair.what}) reaches ${ratio.toFixed(2)}:1 — rgb(${fg.join(", ")}) on rgb(${bg.join(", ")}) — under the ${pair.min}:1 it needs. The palette is measured off the stylesheet this build ships, so a token that moves has to be re-measured.`,
        );
      }
    }
  }
  return problems;
}
