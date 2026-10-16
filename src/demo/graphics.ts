/**
 * Site Sourced — the graphics layer (S3).
 *
 * What this file is: the hand-authored visual layer the demos have never had — an icon
 * set, CSS section grounds, a divider family, a schematic map stand-in and a wordmark
 * treatment. Everything here is **ours**: hand-drawn SVG paths and CSS, no scraped icon
 * set, no icon font, no CDN, no third-party asset. Every byte is inline or token-driven,
 * so the layer adds **no file to a bundle and no request to a page**.
 *
 * This file does not render a demo. As of 17 Oct 2026 nothing calls `graphicsCss()` or
 * `icon()` from `render.ts`: the layer is built, measured and proved here, and the wiring
 * into the generator is the next session's work (see `docs/graphics-layer.md`). That is
 * deliberate — the barber review copy is live and the owner is judging it, so no fixture's
 * bytes move while the layer is proved.
 *
 * Five rules the layer holds to, each enforced by `graphicsProblems()` below, which runs
 * inside `complianceChecks()` so a build fails rather than trusting the last person who
 * looked at a page (`WORKFLOW.md` rule 6: a rule with no test is not a rule):
 *
 *   1. **Nothing reaches the network.** Inline SVG and `currentColor` only: no `http(s)://`,
 *      no protocol-relative URL, no `@import`, no `url()` anywhere, no `<script>`, no
 *      `<image>`, no `<use>` pointing outside the same document. The page budget and the
 *      "no cookies, no analytics and no tracking on this page" sentence both depend on it.
 *   2. **Every graphic is marked, and marked one way.** An SVG in this layer is either
 *      decorative — `aria-hidden="true"`, because a label beside it already carries the
 *      meaning — or meaningful — `role="img"` plus a real accessible name. Never neither
 *      (an unmarked graphic a screen reader reads as noise), never both (a claim to be
 *      both decoration and content). Decoration is never the only carrier of meaning: an
 *      icon sits **beside** a label, and this layer emits no icon-only control.
 *   3. **Colour comes from the surface, never from the layer.** No literal colour: strokes
 *      are `currentColor`, fills are `var(--…)` tokens. That is the same principle the
 *      owner's outlined buttons rest on (the outline follows the surface) — an icon with a
 *      baked-in ink stroke is invisible on the ink footer, and one with a baked-in white
 *      stroke measures 1.00:1 on paper.
 *   4. **The layer stays inside its own budget.** Each part has a byte cap and the whole
 *      layer has one, measured below and reported by `graphicsByteReport()`.
 *   5. **The layer is additive.** Every selector it writes is scoped to a `.gfx-` class, so
 *      wiring it into the stylesheet cannot restyle a page that has not asked for it.
 *
 * Contrast, size and behaviour claims about this layer are settled on **rendered pixels**
 * (`docs/design-system.md` §10 and the team rule that a visual claim is never read off the
 * stylesheet): `docs/graphics-layer.md` carries the measured table and
 * `docs/graphics-check-doctor-proofs.md` the proof that each clause below can fail.
 */

/** Bumped when the layer's output changes shape; quoted in the specimen and the doc. */
export const GRAPHICS_VERSION = "s3.1";

const esc = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/* ---------------------------------------------------------------------- icons */

/**
 * The vocabulary is **read off the pages the demos actually ship**, not invented: the
 * labels and controls a built bundle carries today are the six nav/page names, the phone
 * link, `Get directions`, the hours table, the services list, the address, the form's
 * message, the booking link, the privacy notice and the footer's social/provenance links.
 * Each icon below names where it belongs. Categories we have nothing to draw for
 * (`Reviews`, a rating, a price) have **no** icon: a mark is not a licence to imply a
 * module the build refuses.
 *
 * Grid: 24×24, 1.75px strokes, round caps and joins, no fill except where a dot is the
 * shape (a 1.15px radius dot filled with the same `currentColor`).
 */
export const ICON_GRID = 24;
export const ICON_STROKE = 1.75;
/** The two sizes a page uses: inline with a label (20) and as a list/section mark (24). */
export const ICON_SIZES = [20, 24] as const;
export type IconSize = (typeof ICON_SIZES)[number];

export interface IconDraw {
  /** Inner markup of a 24×24 viewBox. Never a full `<svg>`: `icon()` supplies the frame. */
  readonly with: string;
  /** Where the page vocabulary calls for it. */
  readonly note: string;
}

export const ICONS = {
  services: {
    with: `<path d="M12.6 3.4h6.1a1.9 1.9 0 0 1 1.9 1.9v6.1a1.9 1.9 0 0 1-.56 1.34l-7.2 7.2a1.9 1.9 0 0 1-2.69 0l-6.1-6.1a1.9 1.9 0 0 1 0-2.69l7.2-7.2A1.9 1.9 0 0 1 12.6 3.4Z"/>
      <circle cx="16.6" cy="7.4" r="1.15"/>`,
    note: "The services list and each recorded service card",
  },
  hours: {
    with: `<circle cx="12" cy="12" r="8.6"/>
      <path d="M12 6.9v5.4l3.6 2.2"/>`,
    note: "`Opening hours` — also the hours row of the home page",
  },
  phone: {
    with: `<path d="M6.4 4.2h2.3l1.5 3.9-2 1.4a11.8 11.8 0 0 0 5.9 5.9l1.4-2 3.9 1.5v2.3a1.7 1.7 0 0 1-1.9 1.7A16.2 16.2 0 0 1 4.7 6.1 1.7 1.7 0 0 1 6.4 4.2Z"/>`,
    note: "The printed phone number and the hero's `Call …` button",
  },
  pin: {
    with: `<path d="M12 20.8s6.9-5.3 6.9-10.9a6.9 6.9 0 1 0-13.8 0c0 5.6 6.9 10.9 6.9 10.9Z"/>
      <circle cx="12" cy="9.7" r="2.6"/>`,
    note: "The recorded address",
  },
  directions: {
    with: `<path d="M5 19.4v-6.1a4.2 4.2 0 0 1 4.2-4.2h9.4"/>
      <path d="m14.9 5.3 3.8 3.8-3.8 3.8"/>`,
    note: "`Get directions`, the link out to a map the visitor already uses",
  },
  message: {
    with: `<rect x="3.6" y="4.6" width="16.8" height="14.8" rx="2.6"/>
      <path d="M7.4 9.6h9.2M7.4 13.2h6.2"/>`,
    note: "The contact page's message form and the CTA band",
  },
  email: {
    with: `<rect x="3" y="5.4" width="18" height="13.2" rx="2.2"/>
      <path d="M4 7.2l6.9 5.2a1.8 1.8 0 0 0 2.2 0L20 7.2"/>`,
    note: "The printed email address in the contact fallback",
  },
  appointment: {
    with: `<rect x="3.6" y="5.6" width="16.8" height="14.6" rx="2.6"/>
      <path d="M3.6 10.4h16.8M8.4 3.8v3.6M15.6 3.8v3.6"/>
      <circle cx="11.9" cy="15.3" r="1.15" fill="currentColor" stroke="none"/>`,
    note: "The demonstration booking link — a date is asked for, never promised",
  },
  info: {
    with: `<circle cx="12" cy="12" r="8.6"/>
      <path d="M12 11.2v5.4"/>
      <circle cx="12" cy="7.9" r="1.05" fill="currentColor" stroke="none"/>`,
    note: "About, and the record's own `Good to know` extras",
  },
  gallery: {
    with: `<rect x="3.4" y="5" width="17.2" height="14" rx="2.6"/>
      <path d="m4.7 16.6 4.1-4a1.6 1.6 0 0 1 2.2 0l4.4 4.3"/>
      <path d="m13.6 14.8 1.3-1.3a1.6 1.6 0 0 1 2.2 0l3.3 3.2"/>
      <circle cx="9.1" cy="9.6" r="1.5"/>`,
    note: "The Gallery module in the module map",
  },
  link: {
    with: `<path d="M9.7 14.3 14.3 9.7"/>
      <path d="M11.3 7.3 13 5.6a4 4 0 0 1 5.7 5.7l-1.7 1.7"/>
      <path d="M12.7 16.7 11 18.4a4 4 0 0 1-5.7-5.7l1.7-1.7"/>`,
    note: "The Socials module in the module map — a link out, not a network's logo",
  },
  "open-external": {
    with: `<path d="M14.2 4.4h5.4v5.4"/>
      <path d="M19.6 4.4 11.4 12.6"/>
      <path d="M17.8 14.4v3.8a1.8 1.8 0 0 1-1.8 1.8H6.2a1.8 1.8 0 0 1-1.8-1.8V8.4a1.8 1.8 0 0 1 1.8-1.8h3.8"/>`,
    note: "Any link that leaves our own page, beside the `↗` the template already prints",
  },
  privacy: {
    with: `<path d="M12 3.6 19.5 6.5v5.2c0 4.3-3.1 7.5-7.5 9.1-4.4-1.6-7.5-4.8-7.5-9.1V6.5Z"/>
      <path d="m8.9 12 2.2 2.2 4-4.2"/>`,
    note: "The privacy notice link in the footer's small print",
  },
  "arrow-right": {
    with: `<path d="M4.6 12h13.6"/>
      <path d="M13.4 7.4 18 12l-4.6 4.6"/>`,
    note: "A quiet link onward — `More about {name}`",
  },
} as const satisfies Record<string, IconDraw>;

export const ICON_NAMES = Object.keys(ICONS) as (keyof typeof ICONS)[];
export type IconName = keyof typeof ICONS;

export interface IconOptions {
  readonly size?: IconSize;
  /** Extra class names, e.g. a colour modifier. Never a control's own name: see rule 2. */
  readonly className?: string;
}

/**
 * One icon as inline SVG. Decorative by construction: every call site in this layer puts
 * the icon beside a label, so the label carries the meaning and the drawing is
 * `aria-hidden` with `focusable="false"` (so it is not a tab stop in older Edge either).
 * There is deliberately **no** meaningful-icon option here: a meaningful graphic in this
 * layer is the map, and it is drawn by `schematicMap()`.
 */
export function icon(name: IconName, options: IconOptions = {}): string {
  const size: IconSize = options.size ?? 24;
  const classes = ["gfx-icon", `gfx-icon--${size}`, options.className].filter(Boolean).join(" ");
  return [
    `<svg class="${classes}" viewBox="0 0 ${ICON_GRID} ${ICON_GRID}" width="${size}" height="${size}"`,
    ` fill="none" stroke="currentColor" stroke-width="${ICON_STROKE}" stroke-linecap="round"`,
    ` stroke-linejoin="round" aria-hidden="true" focusable="false">`,
    ICONS[name].with,
    `</svg>`,
  ].join("");
}

/* ------------------------------------------------------------------- grounds */

/**
 * Section grounds: what a section carries when it has no photograph, and the wash a
 * section sits on when it needs to be read as a different surface. All five are **CSS
 * only** — a repeated hairline, no image file, no data URI — and every one draws with
 * `currentColor`, so a ground over the ink surface is white and the same ground on paper
 * is a warm hairline. The owner's rule for controls ("the outline follows the surface")
 * applies to a pattern for the same reason: a ground that cannot change surface is a
 * ground we cannot reuse.
 */
export const PATTERN_NAMES = ["rules", "grid", "arcs", "stripe", "no-photo"] as const;
export type PatternName = (typeof PATTERN_NAMES)[number];

export const PATTERNS: Record<PatternName, { className: string; note: string }> = {
  rules: { className: "gfx-ground--rules", note: "Ruled paper — a short list or an hours block" },
  grid: { className: "gfx-ground--grid", note: "A fine grid — a dense section without a photo" },
  arcs: { className: "gfx-ground--arcs", note: "Shallow arcs — the scallop the divider family repeats" },
  stripe: { className: "gfx-ground--stripe", note: "A 9px diagonal hairline — the quietest ground" },
  "no-photo": {
    className: "gfx-ground--no-photo",
    note: "The no-photograph fallback: ink ground, arcs at low contrast, accent hairline on top",
  },
};

/** The classes for a ground, in one string: `gfx-ground gfx-ground--rules`. */
export function ground(name: PatternName): string {
  return `gfx-ground ${PATTERNS[name].className}`;
}

/* ------------------------------------------------------------------ dividers */

/**
 * The divider family: one arc, the same arc doubled, a three-rule stripe and a hairline
 * broken by an accent mark. Each is a single inline SVG stretched across the container
 * with `preserveAspectRatio="none"` and `vector-effect="non-scaling-stroke"`, so the
 * stroke stays 1px at every width instead of thickening on a wide screen. Decorative
 * throughout — a divider carries no meaning, so it is `aria-hidden`.
 */
export const DIVIDER_NAMES = ["arc", "arc-pair", "stripe", "tick-rule"] as const;
export type DividerName = (typeof DIVIDER_NAMES)[number];

const DIVIDER_DRAWS: Record<DividerName, string> = {
  arc: `<path d="M0 24A600 24 0 0 1 1200 24"/>`,
  "arc-pair": `<path d="M0 24A600 24 0 0 1 1200 24"/><path d="M0 15A600 24 0 0 1 1200 15"/>`,
  stripe: `<path d="M0 4h1200"/><path class="gfx-accent-stroke" d="M0 12h1200"/><path d="M0 20h1200"/>`,
  "tick-rule": `<path d="M0 12h556"/><path d="M644 12h556"/><path class="gfx-accent-stroke" d="M608 6l16 6-16 6-16-6Z"/>`,
};

export const DIVIDERS: Record<DividerName, { note: string }> = {
  arc: { note: "One shallow arc, 24px — the section break for a photograph-heavy page" },
  "arc-pair": { note: "The same arc doubled — a slower break, for the end of a long section" },
  stripe: { note: "Three hairlines, the middle one accent — the loudest divider we ship" },
  "tick-rule": { note: "A hairline broken by an accent mark — the page's own eyebrow tick, wider" },
};

export function divider(name: DividerName, className = ""): string {
  const classes = ["gfx-divider", `gfx-divider--${name}`, className].filter(Boolean).join(" ");
  return [
    `<svg class="${classes}" viewBox="0 0 1200 24" preserveAspectRatio="none"`,
    ` aria-hidden="true" focusable="false" fill="none" stroke="currentColor"`,
    ` stroke-width="1" stroke-linecap="round" vector-effect="non-scaling-stroke">`,
    DIVIDER_DRAWS[name],
    `</svg>`,
  ].join("");
}

/* ----------------------------------------------------------------------- map */

/**
 * The schematic map: a stand-in for the map a visitor would open, **not** a map. It shows
 * a street grid, blocks and a marker, with nothing geographic in it: no street name, no
 * compass, no scale, no "you are here" — because the marker cannot honestly be placed on
 * a real map (a fictional fixture's address is invented, and a real record's coordinates
 * are not something the record carries). The visible caption is part of the component and
 * carries the meaning: the drawing itself is `aria-hidden`, so a screen reader hears the
 * caption and never a decorative street plan.
 *
 * `MAP_CAPTION` is not a frozen string: it is this layer's own sentence and moves with the
 * layer. It is written to be true of every demo, in both families.
 */
export const MAP_CAPTION = "Schematic illustration — not a map of the area, and not to scale.";

export interface MapOptions {
  readonly className?: string;
  /**
   * The marker's label. A demo passes nothing: an unlabelled marker is the honest one for
   * a stand-in. Quoted in the specimen only.
   */
  readonly title?: string;
}

export function schematicMap(options: MapOptions = {}): string {
  const classes = ["gfx-map", options.className].filter(Boolean).join(" ");
  const label = options.title ? `<text class="gfx-map-label" x="286" y="128">${esc(options.title)}</text>` : "";
  return [
    `<svg class="${classes}" viewBox="0 0 480 280" width="480" height="280" aria-hidden="true"`,
    ` focusable="false" fill="none" stroke="currentColor" stroke-width="1"`,
    ` stroke-linecap="round" stroke-linejoin="round">`,
    // A plan, plainly drawn: two streets with their own centrelines, parcels between
    // them, and nothing that could be read as geography.
    `<rect class="gfx-map-ground" x="0" y="0" width="480" height="280" rx="18"/>`,
    `<rect class="gfx-map-street" x="0" y="88" width="480" height="52"/>`,
    `<rect class="gfx-map-street" x="0" y="188" width="480" height="48"/>`,
    `<path class="gfx-map-hair" d="M0 88h480M0 140h480M0 188h480M0 236h480"/>`,
    `<path class="gfx-map-dash" stroke-dasharray="12 14" d="M0 114h480M0 212h480"/>`,
    `<rect class="gfx-map-block" x="26" y="18" width="118" height="52" rx="4"/>`,
    `<rect class="gfx-map-block" x="176" y="18" width="102" height="52" rx="4"/>`,
    `<rect class="gfx-map-block" x="312" y="18" width="142" height="52" rx="4"/>`,
    `<rect class="gfx-map-block" x="26" y="156" width="92" height="14" rx="4"/>`,
    `<rect class="gfx-map-block" x="150" y="156" width="128" height="14" rx="4"/>`,
    `<rect class="gfx-map-block" x="310" y="156" width="144" height="14" rx="4"/>`,
    `<rect class="gfx-map-block" x="26" y="252" width="118" height="18" rx="4"/>`,
    `<rect class="gfx-map-block" x="176" y="252" width="102" height="18" rx="4"/>`,
    `<rect class="gfx-map-block" x="312" y="252" width="142" height="18" rx="4"/>`,
    // The marker: an accent halo and a dot, on the parcel that stands in for the address.
    `<circle class="gfx-map-halo" cx="150" cy="44" r="24"/>`,
    `<circle class="gfx-map-dot" cx="150" cy="44" r="6.5"/>`,
    label,
    // The one thing that stops it pretending: its own label, inside the drawing.
    `<text class="gfx-map-note" x="26" y="270">SCHEMATIC — NOT TO SCALE</text>`,
    `<path class="gfx-map-hair" d="M172 266h282"/>`,
  ].join("");
}

/* ------------------------------------------------------------------ wordmark */

/**
 * The wordmark treatment. There is **no logo** and there never will be one for a demo: the
 * business's own mark is the one thing we may never draw. What we can do is set the name
 * properly and give it a mark of our own that is plainly derived from the initials — the
 * same construction as the favicon (`renderFavicon()` in `render.ts`: initials on the
 * category accent), so the tab and the header carry the same small mark instead of two
 * unrelated ones.
 *
 * The initials are derived from the record's own name; nothing is invented, and the mark
 * is `aria-hidden` because the name is written next to it in text.
 */
export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word));
  const letters = words.slice(0, 2).map((word) => word[0]!.toUpperCase());
  return letters.join("") || "SS";
}

export const WORDMARK_NOTE =
  "The name set in the display face, with a short accent rule under it — and, optionally, the initials mark on the category accent, the same mark the favicon uses.";

export interface MonogramOptions {
  /** Rendered size in px. 28 in a header, 40 where it stands alone. */
  readonly size?: number;
}

export function monogram(name: string, options: MonogramOptions = {}): string {
  const size = options.size ?? 28;
  const label = initialsOf(name);
  return [
    `<svg class="gfx-monogram" viewBox="0 0 64 64" width="${size}" height="${size}"`,
    ` aria-hidden="true" focusable="false">`,
    `<rect class="gfx-mono-face" x="2" y="2" width="60" height="60" rx="15"/>`,
    `<text class="gfx-mono-letters" x="32" y="42" text-anchor="middle">${esc(label)}</text>`,
    `</svg>`,
  ].join("");
}

export interface WordmarkOptions extends MonogramOptions {
  /** Draw the initials mark beside the name. */
  readonly mark?: boolean;
  /** `rule` puts the 24×2px accent rule under the name. */
  readonly rule?: boolean;
  readonly className?: string;
}

/**
 * The wordmark as one component. It is written to be *inside* the existing
 * `<a class="wordmark">` rather than to replace it: the header's own link behaviour,
 * `aria-current` on the nav and `wordmarkLinkProblems` are untouched by a treatment, and
 * the name stays real text so a page still works with the fonts blocked.
 */
export function wordmark(name: string, options: WordmarkOptions = {}): string {
  const classes = [
    "gfx-wordmark",
    options.rule === false ? "" : "gfx-wordmark--rule",
    options.className,
  ]
    .filter(Boolean)
    .join(" ");
  const mark = options.mark ? monogram(name, options) : "";
  return [
    `<span class="${classes}">`,
    mark,
    `<span class="gfx-wordmark-name">${esc(name)}</span>`,
    `</span>`,
  ].join("");
}

/* ----------------------------------------------------------------------- css */

/**
 * The layer's stylesheet. Token-only (no literal colour anywhere — clause 3), scoped to
 * `.gfx-` (clause 5), and it writes **no** `url()`: the grounds are gradients, the
 * dividers and the map are inline SVG, so the layer costs a bundle zero bytes of assets
 * and a page zero requests.
 */
export function graphicsCss(): string {
  return `/* ------------------------------------------------------- graphics layer (S3)
   Hand-drawn marks, CSS grounds, dividers, the schematic map and the wordmark.
   Inline SVG and gradients only: no icon font, no sprite file, no external asset, and
   every rule is scoped to a .gfx- class so this block cannot restyle an existing page.
   Strokes are currentColor and fills are tokens, so a mark follows the surface it is
   drawn on (ink on paper, paper on ink) instead of carrying its own colour. Source:
   src/demo/graphics.ts — see docs/graphics-layer.md for the measured table. */

.gfx-icon {
  display: inline-block;
  flex: none;
  vertical-align: -0.18em;
  stroke: currentColor;
}
.gfx-icon--20 { width: 20px; height: 20px; }
.gfx-icon--24 { width: 24px; height: 24px; }

/* A mark beside a label: the gap is the smallest step in the spacing scale. */
.gfx-marked {
  display: inline-flex;
  align-items: center;
  gap: var(--s-1);
}
.gfx-marked--row {
  display: flex;
  align-items: center;
  gap: var(--s-2);
}

.gfx-ground { position: relative; }
.gfx-ground--rules {
  /* A 28px pitch: the same rhythm as a 17px line at 1.65, so ruled text sits on the rules
     instead of struck through by them. */
  background-image: repeating-linear-gradient(to bottom, currentColor 0 1px, transparent 1px 28px);
}
.gfx-ground--grid {
  background-image:
    repeating-linear-gradient(to right, currentColor 0 1px, transparent 1px 16px),
    repeating-linear-gradient(to bottom, currentColor 0 1px, transparent 1px 16px);
}
.gfx-ground--arcs {
  background-image: radial-gradient(circle at 50% 100%, transparent 0 27px, currentColor 27px 28px, transparent 28px);
  background-size: 56px 28px;
}
.gfx-ground--stripe {
  background-image: repeating-linear-gradient(115deg, currentColor 0 1px, transparent 1px 9px);
}
.gfx-ground--no-photo {
  color: var(--paper);
  background-color: var(--ink);
  background-image: radial-gradient(circle at 50% 100%, transparent 0 27px, currentColor 27px 28px, transparent 28px);
  background-size: 56px 28px;
  border-top: 3px solid var(--accent);
}
.gfx-ground--on-ink { color: var(--footer-ink); }
.gfx-ground--on-paper { color: var(--line); }

.gfx-divider {
  display: block;
  width: 100%;
  height: 24px;
  color: var(--line);
}
.gfx-divider--stripe { color: var(--line); }
.gfx-accent-stroke { stroke: var(--accent); }

.gfx-map {
  display: block;
  width: 100%;
  height: auto;
  max-width: 30rem;
  color: var(--line);
}
.gfx-map-ground { fill: var(--paper-2); stroke: none; }
.gfx-map-street { fill: var(--paper); stroke: none; }
.gfx-map .gfx-map-block { fill: var(--paper); }
.gfx-map-block { fill: none; stroke: var(--line); }
.gfx-map-hair { stroke: var(--line); }
.gfx-map-dash { stroke: var(--line); }
.gfx-map-halo { fill: var(--accent-soft); stroke: none; }
.gfx-map-dot { fill: var(--accent); stroke: none; }
.gfx-map-label { fill: var(--body-text); font-family: var(--font-body); font-size: 15px; stroke: none; }
.gfx-map-note {
  fill: var(--muted);
  font-family: var(--font-label, var(--font-body));
  font-size: 11px;
  letter-spacing: 0.12em;
  stroke: none;
}

.gfx-wordmark { display: inline-flex; align-items: center; gap: var(--s-2); }
.gfx-wordmark-name {
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: -0.01em;
}
.gfx-wordmark--rule .gfx-wordmark-name {
  display: inline-block;
  padding-bottom: 3px;
  border-bottom: 2px solid var(--accent);
}
.gfx-monogram { display: block; flex: none; }
.gfx-mono-face { fill: var(--accent); }
.gfx-mono-letters {
  fill: var(--paper);
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 600;
}
`;
}

/* --------------------------------------------------------------- the check */

/**
 * Byte caps. The whole layer is an addition to the stylesheet the demos already ship, and
 * §13 of the design system is explicit that the family layer added no token, no font and
 * no file; the same holds here. These caps are the numbers the layer may never exceed,
 * and `graphicsProblems()` fails a build that writes more — so "small" is a rule, not a
 * hope. The measured figures are in `docs/graphics-layer.md` and are well under each cap.
 */
export const GRAPHICS_BYTE_CAPS = {
  /** All 14 icons, as emitted markup (measured 5,057; the largest single icon is 446). */
  icons: 6 * 1024,
  /** One icon, so a redrawn mark cannot quietly cost three times the others (411 measured is typical). */
  oneIcon: 512,
  /** The stylesheet block, including its comment header (measured 3,427). */
  css: 4 * 1024,
  /** All four dividers (measured 1,298). */
  dividers: 1.5 * 1024,
  /** The schematic map (measured 1,372). */
  map: 2 * 1024,
  /** The wordmark component and its mark (measured 375). */
  wordmark: 0.75 * 1024,
  /** The whole layer, which is what the page budget actually feels (measured 11,529). */
  layer: 13 * 1024,
} as const;

export interface GraphicsPart {
  readonly name: keyof typeof GRAPHICS_BYTE_CAPS | "caption";
  readonly bytes: number;
  readonly text: string;
}

/** Every byte this layer can emit, named and counted — the report and the check share it. */
export function graphicsParts(): GraphicsPart[] {
  const parts: Omit<GraphicsPart, "bytes">[] = [
    { name: "icons", text: ICON_NAMES.map((name) => icon(name)).join("\n") },
    { name: "css", text: graphicsCss() },
    { name: "dividers", text: DIVIDER_NAMES.map((name) => divider(name)).join("\n") },
    { name: "map", text: schematicMap() },
    { name: "wordmark", text: wordmark("Maple Avenue Barber Shop", { mark: true }) },
    { name: "caption", text: MAP_CAPTION },
  ];
  return parts.map((part) => ({ ...part, bytes: Buffer.byteLength(part.text, "utf8") }));
}

export interface GraphicsByteReport {
  readonly version: string;
  readonly parts: { name: string; bytes: number; cap: number | null; ok: boolean }[];
  readonly layerBytes: number;
  readonly layerCap: number;
  readonly assets: number;
  readonly requests: number;
}

/**
 * The byte table `docs/graphics-layer.md` quotes. `assets: 0` and `requests: 0` are not
 * decoration: the layer emits markup and CSS only, so there is no file for a page to
 * fetch — which is the strongest available statement that it makes no third-party request.
 */
export function graphicsByteReport(): GraphicsByteReport {
  const parts = graphicsParts().filter((part) => part.name !== "caption");
  const layerBytes = parts.reduce((sum, part) => sum + part.bytes, 0);
  return {
    version: GRAPHICS_VERSION,
    parts: parts.map((part) => {
      const cap = GRAPHICS_BYTE_CAPS[part.name as keyof typeof GRAPHICS_BYTE_CAPS] ?? null;
      return { name: part.name, bytes: part.bytes, cap, ok: cap === null || part.bytes <= cap };
    }),
    layerBytes,
    layerCap: GRAPHICS_BYTE_CAPS.layer,
    assets: 0,
    requests: 0,
  };
}

/** Anything in the layer that reaches off the page, or off our own document. */
const REMOTE_PATTERNS: readonly [string, RegExp][] = [
  ["an absolute http(s) URL", /https?:\/\//i],
  ["a protocol-relative URL", /(?:^|["'(=\s])\/\//],
  ["an @import", /@import/i],
  ["a url() reference", /url\(/i],
  ["a <script> element", /<script[\s>]/i],
  ["an <image> element", /<image[\s>]/i],
  ["a <use> pointing outside this document", /<use[^>]*href="(?!\s*#)/i],
  ["an external resource attribute", /\b(?:src|xlink:href|data|poster)="/i],
];

/** Colour is the surface's, never the layer's: a literal colour cannot follow a surface. */
const LITERAL_COLOUR_PATTERNS: readonly [string, RegExp][] = [
  ["a hex colour", /#[0-9a-fA-F]{3,8}\b/],
  ["an rgb()/hsl() colour", /\b(?:rgba?|hsla?)\(/i],
  [
    "a named colour",
    /(?::|;|\s)(?:white|black|red|green|blue|grey|gray|silver|maroon|navy|teal|olive)\b(?![\w-])/i,
  ],
];

/** `<svg …>` opening tags in a part, as strings, without the body. */
function svgTags(text: string): string[] {
  return text
    .split(/<svg\b/i)
    .slice(1)
    .map((chunk) => chunk.slice(0, chunk.indexOf(">")))
    .filter((tag) => tag.length > 0);
}

/** The selectors a CSS block writes, for the scoping check. */
function cssSelectors(css: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors: string[] = [];
  for (const block of withoutComments.split("}")) {
    if (block.includes("{")) {
      const head = block.slice(0, block.indexOf("{")).trim();
      if (head.startsWith("@")) continue;
      for (const one of head.split(",")) {
        const selector = one.trim();
        if (selector && !selector.startsWith(".")) selectors.push(selector);
        else if (selector.includes(".") && !selector.includes(".gfx-")) selectors.push(selector);
      }
    }
  }
  return selectors;
}

/**
 * What this layer may never do, as a build check. Runs inside `complianceChecks()`, so a
 * layer that reaches the network, leaves a graphic unmarked, hard-codes a colour, outgrows
 * its cap or writes a rule outside `.gfx-` fails a demo build rather than a review.
 *
 * Takes its parts as an argument so a test can hand it a mutated layer and prove each
 * clause fires (`test/graphics.test.ts`, proofs in `docs/graphics-check-doctor-proofs.md`).
 */
export function graphicsProblems(parts: GraphicsPart[] = graphicsParts()): string[] {
  const problems: string[] = [];
  const named = parts.filter((part) => part.name !== "caption");

  // Clause 1 — nothing reaches the network. The artwork parts are checked as a whole
  // (the CSS is where a url() would hide), and the caption too: it is text we print.
  for (const part of parts) {
    for (const [what, pattern] of REMOTE_PATTERNS) {
      if (pattern.test(part.text)) {
        problems.push(
          `graphics layer: its ${part.name} part carries ${what}. The layer is inline SVG and CSS only — a demo page loads nothing from the network, and an icon set that needs a file is the first one this rule is here to stop.`,
        );
      }
    }
  }

  // Clause 2 — every graphic is marked, and marked one way.
  for (const part of parts) {
    for (const tag of svgTags(part.text)) {
      const decorative = /aria-hidden="true"/i.test(tag);
      const meaningful = /role="img"/i.test(tag);
      const named_ = /aria-label="[^"]+"/i.test(tag) || /aria-labelledby="/i.test(tag);
      if (decorative && meaningful) {
        problems.push(
          `graphics layer: an <svg> in its ${part.name} part is marked both decorative (aria-hidden) and meaningful (role="img"). One or the other: a graphic that claims both is read twice, and a graphic that claims neither is read as noise.`,
        );
      } else if (!decorative && !meaningful) {
        problems.push(
          `graphics layer: an <svg> in its ${part.name} part carries no marking. Add aria-hidden="true" where a label beside it carries the meaning, or role="img" with aria-label where the drawing is the only carrier — this layer draws decoration that always sits beside its label.`,
        );
      } else if (meaningful && !named_) {
        problems.push(
          `graphics layer: a meaningful <svg> in its ${part.name} part has no accessible name (role="img" with an empty or missing aria-label). A screen reader would announce "image" and nothing else.`,
        );
      }
    }
  }

  // Clause 3 — colour comes from the surface.
  for (const part of parts) {
    for (const [what, pattern] of LITERAL_COLOUR_PATTERNS) {
      if (pattern.test(part.text)) {
        problems.push(
          `graphics layer: its ${part.name} part hard-codes ${what}. Strokes are currentColor and fills are var(--) tokens so a mark follows the surface it is drawn on; a colour baked into the artwork is invisible on one of the two surfaces it will sit on.`,
        );
      }
    }
  }

  // Clause 4 — the bytes, per part and for the layer as a whole. The count is taken from
  // each part's own text, never from its `bytes` field: a part whose label disagrees with
  // its contents is exactly how a byte cap stops meaning anything.
  const size = (part: GraphicsPart): number => Buffer.byteLength(part.text, "utf8");
  for (const part of named) {
    const cap = GRAPHICS_BYTE_CAPS[part.name as keyof typeof GRAPHICS_BYTE_CAPS];
    if (cap !== undefined && size(part) > cap) {
      problems.push(
        `graphics layer: its ${part.name} part is ${size(part)} bytes, over the ${cap}-byte cap. The layer is an addition to a stylesheet a phone already waits for; the cap is what keeps it an addition.`,
      );
    }
  }
  for (const part of named) {
    if (part.name !== "icons") continue;
    const each = part.text
      .split(/<svg\b/i)
      .slice(1)
      .map((chunk) => Buffer.byteLength(`<svg${chunk}`, "utf8"));
    if (each.length !== ICON_NAMES.length) {
      problems.push(
        `graphics layer: its icons part emits ${each.length} <svg> elements for ${ICON_NAMES.length} named icons. The set and the sprite are one list — a drawing with no name is one no page can ask for by name.`,
      );
    }
    for (const [index, bytes] of each.entries()) {
      if (bytes > GRAPHICS_BYTE_CAPS.oneIcon) {
        problems.push(
          `graphics layer: ${ICON_NAMES[index] ?? `icon ${index + 1}`} is ${bytes} bytes, over the ${GRAPHICS_BYTE_CAPS.oneIcon}-byte per-icon cap. One redrawn mark may not cost three times what the rest of the set costs.`,
        );
      }
    }
  }
  const layerBytes = named.reduce((sum, part) => sum + size(part), 0);
  if (layerBytes > GRAPHICS_BYTE_CAPS.layer) {
    problems.push(
      `graphics layer: the whole layer is ${layerBytes} bytes, over the ${GRAPHICS_BYTE_CAPS.layer}-byte cap. It adds no file and no request, but it does add bytes to every page that carries it.`,
    );
  }

  // Clause 5 — additive only: every rule is scoped to a .gfx- class.
  for (const part of named) {
    if (part.name !== "css") continue;
    for (const selector of cssSelectors(part.text)) {
      problems.push(
        `graphics layer: its stylesheet writes the rule "${selector}", which is not scoped to a .gfx- class. The layer is additive: wiring it in may not restyle a page that did not ask for it.`,
      );
    }
  }

  return problems;
}
