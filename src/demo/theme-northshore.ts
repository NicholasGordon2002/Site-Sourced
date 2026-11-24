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
          : `${NORTHSHORE_THEME_SLUG} is a demonstration, so this build carries the theme: the field-guide palette, squared corners, ruled lists and dark title bands described in src/demo/theme-northshore.ts. It is written in styles.css alone — no page of the bundle changes.`,
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
/* ==================== the Northshore theme — the owner's experimental design pass (24 Nov 2026)
   A field guide, not a barbershop: bone paper, evergreen ink, squared corners, hairline rules,
   ruled lists, small-caps controls, and a dark evergreen band for every inner page's title.
   Written for one demonstration (${NORTHSHORE_THEME_SLUG}) and appended to that bundle's
   stylesheet alone. It paints no mark of its own, adds no request, and touches no page.
   Source: src/demo/theme-northshore.ts — the measured pairs are in PAIRS there. */
.ns-theme { ${NORTHSHORE_THEME_MARKER}: ${NORTHSHORE_THEME_NAME}; }

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

  /* Type. The same two self-hosted faces, set differently: a larger, tighter display line,
     a slightly wider label, and a section heading that sits closer to its own hairline. */
  --fs-display: clamp(2.7rem, 13vw, 4.2rem);
  --fs-page: clamp(2.2rem, 9vw, 3.2rem);
  --fs-h2: clamp(1.55rem, 5.5vw, 2.15rem);
  --fs-h3: 1.3rem;
  --fs-lead: clamp(1.0625rem, 2.4vw, 1.1875rem);
  --fs-label: 0.7rem;

  /* Space: one step more generous than the shared rhythm at every section boundary. */
  --section-y: clamp(3.5rem, 9vw, 6rem);

  /* Shape: everything squares off. A garden plan is drawn with a rule, not a pill. */
  --r-sm: 3px;
  --r-md: 3px;
  --r-lg: 3px;
}

body { background: var(--paper); color: var(--body-text); }
h1 { line-height: 0.98; letter-spacing: -0.03em; }
h2 { letter-spacing: -0.02em; }
p { line-height: 1.65; }

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
.wordmark { font-size: 1.2rem; letter-spacing: -0.015em; }

.site-menu-summary {
  border: 1px solid var(--ink);
  border-radius: var(--r-md);
  background: var(--paper);
}
.site-menu[open] .site-menu-summary { background: var(--accent-soft); border-color: var(--ink); }

/* The phone's panel: a ruled card of small-caps links rather than a stack of grey chips. */
.site-nav {
  background: var(--paper);
  border: 1px solid var(--ink);
  border-radius: var(--r-md);
  padding: var(--s-1) var(--s-3);
}
.site-nav ul { gap: 0; }
.site-nav a {
  min-height: 2.75rem;
  padding: 0;
  border-radius: 0;
  border-bottom: 1px solid var(--line);
  background: none;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink);
}
.site-nav li:last-child a { border-bottom: 0; }
.site-nav a:hover { background: none; color: var(--accent-ink); }
.site-nav a[aria-current="page"] { background: none; color: var(--accent-ink); }

/* --------------------------------------------------------------- buttons */
/* Shape only. The fill, the ink, the white ghost over the photograph and every state belong
   to the treatment in the shared sheet, and the theme leaves all of it alone. */
.button, .call-button {
  border-radius: var(--r-md);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  padding-inline: 1.2rem;
}
.button--small { font-size: 0.75rem; padding-inline: 1rem; }

/* ------------------------------------------------------------------- hero */
/* The photograph keeps the first screen; the copy over it is the theme's. The two actions
   are stacked full width on a phone so a thumb has one target under another, and the pair is
   ranked by weight rather than by fill: the message form — the one route that works on a
   demonstration — carries the heavier outline and the larger box, the phone number the
   lighter one. Nothing is reordered, so the tab order still matches the eye's order. */
.hero h1 { font-size: var(--fs-display); max-width: 14ch; }
.hero-lead { max-width: 27rem; }
.hero-inner { padding-bottom: var(--s-7); }
.hero-actions { flex-direction: column; align-items: stretch; gap: var(--s-2); }
.hero-actions .button { width: 100%; }
.hero-actions .button--paper { min-height: 2.75rem; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.07em; }
.hero-actions .button--ghost { min-height: 3rem; border-width: 2px; font-size: 0.875rem; letter-spacing: 0.1em; }
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
.services .service-tile--cta .service-tile-body { padding: var(--s-5) 0 var(--s-4); }
.services h3 { font-size: 1.35rem; letter-spacing: -0.015em; }
.services p { font-size: 0.9375rem; }
.services .service-tile--cta .service-cta {
  align-self: flex-start;
  margin: 0 0 var(--s-5);
  padding: 0 1.1rem;
  border-radius: var(--r-md);
  font-size: 0.75rem;
  font-weight: 700;
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
   are squared and filled with the page's own paper. */
.notice, .form-notice {
  background: var(--paper-2);
  border: 1px solid var(--line);
  border-left: 3px solid var(--accent);
  border-radius: 0;
}
.contact-form { border-top: 2px solid var(--ink); padding-top: var(--s-5); }
.field input, .field textarea, .field select { border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--paper); }
.chip-text { border-radius: var(--r-sm); }
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
  .site-nav { border: 0; padding: 0; }
  .site-nav a { border-bottom: 2px solid transparent; font-size: 0.75rem; letter-spacing: 0.1em; }
  .site-nav li:last-child a { border-bottom: 2px solid transparent; }
  .site-nav a:hover { border-bottom-color: var(--line); }
  .site-nav a[aria-current="page"] { border-bottom-color: var(--accent); }
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
