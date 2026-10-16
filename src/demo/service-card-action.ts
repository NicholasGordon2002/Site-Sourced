/**
 * **The service card's action, in the two shapes the owner has asked for** — one module,
 * one switch, one set of checks:
 *
 *   - `whole-card` — **Treatment 1: the action bar at the card's foot** (owner direction, 9
 *     Oct 2026: "investigate what it could look like again with modern, clean, and
 *     professional looking services cards that contain a booking button that could redirect
 *     on click to a booking service"). The card is still one link; the "button" is a styled
 *     element inside the anchor, not a control.
 *   - `nested-cta` — **a real CTA button nested at the bottom of each card** (owner
 *     direction, 10 Oct 2026: "each service card gets its own CTA button nested at the
 *     bottom of the card, rather than the whole card being the tap target"). The card is a
 *     container whose body is inert text, and its one control is the anchor at the foot.
 *
 * ## Why this is a module of its own, and why it is behind an opt-in
 *
 * The shape the owner asked for — a card that carries an **action** — was rejected once
 * already, on 6 Oct 2026: *"Remove the nested service action button. Make each entire
 * service card one accessible keyboard/touch-safe interactive target, with no nested
 * interactive elements"*. That ruling is enforced by `serviceCardProblems` clause 1
 * (`family-render.ts`), and the 10 Oct direction overrides it for this one demonstration.
 * Both shapes are therefore built as **template options** the build can render:
 *
 *   - **`whole-card`** keeps the 6 Oct ruling exactly: the card is ONE link wearing the same
 *     `card service-tile` classes, and nothing interactive is nested in it. No `<a>`,
 *     `<button>`, `<input>`, `<select>`, `<textarea>`, `<details>`, `<summary>`, `<iframe>`,
 *     `<object>` or `<embed>` and no `tabindex` joins the strip — one target, one tab stop
 *     per card, and `serviceCardProblems` runs over the page unchanged;
 *   - **`nested-cta`** is the shape the 6 Oct ruling refuses in the general case and the
 *     owner asked for on 10 Oct: the card is a `<div class="card service-tile
 *     service-tile--cta">`, its heading and note are inert text, and its **one** action is
 *     `<a class="service-cta" href="contact-<service-slug>.html#form">Request <service></a>`
 *     at the foot. `serviceCardProblems` reads this shape through its `cardShape` argument
 *     (one interactive element, at the card's foot, carrying the composed label and the
 *     recorded note left intact) — it is never inferred from the markup;
 *   - **the destination does not change in either shape.** The action points at the page
 *     built for that service, `contact-<service-slug>.html#form`, with that service already
 *     `selected` in the HTML the browser receives. Nothing here adds a booking address, a
 *     price or a duration: this record's booking mode is `none`, so the label stays the
 *     derived `Request <service>` / `Ask about <service>` and it can never say "Book Now" —
 *     a per-service booking link is a separate question this module deliberately does not
 *     answer.
 *
 * ## The opt-in
 *
 * Like the review-only booking-comparison page (`booking-comparison.ts`), the variant is
 * off unless the environment opts it in — `DEMO_SERVICE_CARD_ACTION_BAR`, whose **value
 * names the shape** (`nested` / `cta` for the nested CTA; `1` / `true` / `bar` /
 * `whole-card` for the bar, so a bare `1` keeps meaning what it meant on 9 Oct; anything
 * else truthy is refused, not guessed). With it unset:
 *
 *   1. **the variable names no address and carries no content**: it is a switch, so nothing
 *      about the variant lives outside this repository;
 *   2. **no page of any bundle changes**: `servicesBlock` renders the markup it renders
 *      today, `renderCss` writes the stylesheet it writes today, and every page of both
 *      published demonstrations is byte-identical;
 *   3. `serviceCardActionProblems` refuses the variant on any other record, in the
 *      **delivered phase**, and on a page that should not carry it — a client's site never
 *      carries a review treatment, and the bar's page scope (`services.html` alone) is
 *      unchanged by the nested shape's wider one.
 *
 * ## What the page renders with it on
 *
 * `whole-card` (`services.html` only):
 *
 * ```html
 * <li>
 *   <a class="card service-tile service-tile--bar" href="contact-hot-shave.html#form"><div class="service-tile-body"><h2>Hot shave</h2><p>Straight razor and hot towels…</p></div><div class="service-action-bar"><p class="service-action">Request Hot shave</p><span class="service-action-chevron" aria-hidden="true">&nbsp;›</span></div></a>
 * </li>
 * ```
 *
 * `nested-cta` (every page of the demonstration that lists services):
 *
 * ```html
 * <li>
 *   <div class="card service-tile service-tile--cta"><div class="service-tile-body"><h2>Hot shave</h2><p>Straight razor and hot towels…</p></div><a class="service-cta" href="contact-hot-shave.html#form">Request Hot shave</a></div>
 * </li>
 * ```
 *
 * In both shapes the heading is the **record's** name, the note is the **record's** note,
 * and the action's words are the **family's** derived label. The bar's chevron is a text
 * glyph after a non-breaking space (the grammar `BOOKING_ARROW` uses): 0 new assets, 0
 * requests on load, and it survives the stylesheet not loading at all. The nested CTA carries
 * no glyph at all — it is the label and an outline, and nothing else.
 */
import { serviceActionLabel, type ConversionFamily } from "./family.ts";
import { headingText, serviceCardMeasure, type ServiceCardShape } from "./family-render.ts";
import { GHOST_PAPER_FILL_ACTIVE, GHOST_PAPER_FILL_HOVER, GHOST_PAPER_INK } from "./ghost-controls.ts";
import type { BusinessRecord, FormDeliveryMode } from "./types.ts";

/** The configuration switch that opts this variant in. It carries no content. */
export const SERVICE_CARD_ACTION_VAR = "DEMO_SERVICE_CARD_ACTION_BAR";
/** The one page the variant may appear on. */
export const SERVICE_CARD_ACTION_PAGE = "services.html";
/**
 * The demonstration it is scoped to — the same appointment demo the owner's 8 Oct
 * comparison was scoped to. Any other record refuses the variant, and says why.
 */
export const SERVICE_CARD_ACTION_SLUG = "maple-avenue-barber-shop";
/** The card's modifier class, added to `card service-tile`. */
export const SERVICE_CARD_ACTION_CARD_CLASS = "service-tile--bar";
/** The block holding the heading and the note, so the bar can sit at the foot. */
export const SERVICE_CARD_ACTION_BODY_CLASS = "service-tile-body";
/** The full-width action bar at the card's foot — the "button", inside the one link. */
export const SERVICE_CARD_ACTION_BAR_CLASS = "service-action-bar";
/** The chevron's own element, hidden from assistive technology: the label is the name. */
export const SERVICE_CARD_ACTION_CHEVRON_CLASS = "service-action-chevron";
/**
 * **The nested-CTA shape's own names** (owner direction, 10 Oct 2026). The card keeps its
 * `card service-tile` surface and gains a modifier; the CTA is a real anchor at the card's
 * foot, styled as a button, carrying the family's composed label as its whole text.
 */
export const SERVICE_CARD_ACTION_NESTED_CARD_CLASS = "service-tile--cta";
/** The CTA anchor's own class — the element the gate measures for the 44px floor. */
export const SERVICE_CARD_ACTION_CTA_CLASS = "service-cta";
/**
 * The chevron, as the copy vocabulary already writes such glyphs: a **text** glyph after a
 * non-breaking space, never an icon file, a font or a sprite (`BOOKING_ARROW` in
 * `booking.ts`). The bundle's stylesheet may be off and the glyph is still there.
 */
export const SERVICE_CARD_ACTION_CHEVRON = "&nbsp;›";
/** The glyph alone, for the manifest and for the words a visitor reads. */
export const SERVICE_CARD_ACTION_GLYPH = "›";
/**
 * The source of the treatment, cited wherever it lives so a reader can check it rather
 * than take our word for it.
 */
export const SERVICE_CARD_ACTION_BASIS =
  "the owner's direction of 9 Oct 2026 (\"investigate what it could look like again with modern, clean, and professional looking services cards that contain a booking button that could redirect on click to a booking service\") and the lead's brief of 9 Oct 2026 (Treatment 1, \"action bar at the foot\")";

/** The bar paragraph, opened exactly as the gate reads it and as the card's CSS styles it. */
const BAR_LINE_OPEN = '<p class="service-action">';
/** The line's closing tag, so the bar's own text can be read off the markup. */
const BAR_LINE_CLOSE = "</p>";
/** The chevron element, byte for byte: one span, named as decoration, holding the glyph. */
const CHEVRON_ELEMENT = `<span class="${SERVICE_CARD_ACTION_CHEVRON_CLASS}" aria-hidden="true">${SERVICE_CARD_ACTION_CHEVRON}</span>`;

/**
 * The action bar as markup, for the card renderer (`render.ts` `servicesBlock`).
 *
 * The caller passes the label **already escaped** (`esc`, `render.ts`): this module renders
 * no record text of its own, and the label it is handed is the family's derived one —
 * `serviceActionLabel(copy.conversion.family, name)`.
 */
export function serviceActionBarMarkup(escapedLabel: string): string {
  return `<div class="${SERVICE_CARD_ACTION_BAR_CLASS}">${BAR_LINE_OPEN}${escapedLabel}${BAR_LINE_CLOSE}${CHEVRON_ELEMENT}</div>`;
}
/**
 * **The nested-CTA shape's action**, as markup (owner direction, 10 Oct 2026: "each service
 * card gets its own CTA button nested at the bottom of the card, rather than the whole card
 * being the tap target").
 *
 * It is a real `<a>` — an anchor styled as a button — and it carries the family's composed
 * label and **nothing else**: no chevron, no icon, no second word. A `<button>` is refused
 * on purpose: a button cannot navigate with JavaScript off, and every page here works with
 * the scripts off. The caller passes the label **already escaped** (`esc`, `render.ts`),
 * and the `href` it is handed is the same per-service page the whole-card shape links to
 * (`contact-<service-slug>.html#form`), so the tap lands on a form already set to the
 * service the card names.
 */
export function serviceActionCtaMarkup(escapedLabel: string, escapedHref: string): string {
  return `<a class="${SERVICE_CARD_ACTION_CTA_CLASS}" href="${escapedHref}">${escapedLabel}</a>`;
}
/** The two shapes this variant can take, and the spellings that select them. */
export const SERVICE_CARD_ACTION_SHAPES: Record<string, ServiceCardShape> = {
  "1": "whole-card",
  "true": "whole-card",
  on: "whole-card",
  yes: "whole-card",
  bar: "whole-card",
  "whole-card": "whole-card",
  nested: "nested-cta",
  "nested-cta": "nested-cta",
  cta: "nested-cta",
};

export interface ServiceCardActionDecision {
  /** Whether this build renders the variant. */
  enabled: boolean;
  /** Which shape it renders: the whole-card bar, or the nested CTA (`ServiceCardShape`). */
  shape: ServiceCardShape;
  /** The value the environment carried, verbatim, so a report can quote what was set. */
  raw: string;
  /**
   * The value when it names no shape this build knows (`null` otherwise). A build that
   * renders nothing because it could not read the switch says so here, and the checks
   * refuse it rather than quietly rendering the published cards under a switch someone
   * meant to change.
   */
  unrecognised: string | null;
  /** The one page the whole-card shape may appear on, whether or not this build enables it. */
  page: string;
  /** Why — recorded in the manifest and printed as a warning when it is on. */
  basis: string;
}

/** `DEMO_SERVICE_CARD_ACTION_BAR` switches the variant on; unset or `0`/`false`/`off` is off. */
export function serviceCardActionRequested(env: Record<string, string | undefined> = process.env): boolean {
  const raw = (env[SERVICE_CARD_ACTION_VAR] ?? "").trim().toLowerCase();
  return raw !== "" && raw !== "0" && raw !== "false" && raw !== "off";
}

/**
 * What this build does with the variant, and on what basis — the same shape as
 * `comparisonDecision` (`booking-comparison.ts`), so a reviewer reads one decision the
 * same way in both places. A refusal is a refusal, not a silent fallback: the basis names
 * which condition failed.
 */
export function serviceCardActionDecision(vars: {
  slug: string;
  phase: FormDeliveryMode;
  env?: Record<string, string | undefined>;
}): ServiceCardActionDecision {
  const page = SERVICE_CARD_ACTION_PAGE;
  const raw = vars.env?.[SERVICE_CARD_ACTION_VAR] ?? process.env[SERVICE_CARD_ACTION_VAR] ?? "";
  const off = { enabled: false, shape: "whole-card" as ServiceCardShape, page, raw, unrecognised: null as string | null };
  if (!serviceCardActionRequested(vars.env ?? process.env)) {
    return {
      ...off,
      basis: `${SERVICE_CARD_ACTION_VAR} is not set in this build, so no page carries the action-bar card: both bundles are the pages signed off on 7 Oct 2026, byte for byte (${SERVICE_CARD_ACTION_BASIS}).`,
    };
  }
  const value = raw.trim().toLowerCase();
  const shape = SERVICE_CARD_ACTION_SHAPES[value];
  if (!shape) {
    return {
      ...off,
      unrecognised: raw.trim(),
      basis: `refused: ${SERVICE_CARD_ACTION_VAR} is set to "${raw.trim()}", which names no shape this build knows. The accepted values are ${Object.keys(
        SERVICE_CARD_ACTION_SHAPES,
      )
        .map((key) => `"${key}"`)
        .join(", ")}. A switch this build cannot read is refused rather than guessed at, because rendering one shape while a reviewer asked for the other is a review copy that lies about what it shows (${SERVICE_CARD_ACTION_BASIS}).`,
    };
  }
  if (vars.phase === "business") {
    return {
      ...off,
      shape,
      basis: `refused: this bundle is in the delivered phase. The card variant is a review treatment for the owner — it is not part of the design a client has agreed to, and ${SERVICE_CARD_ACTION_VAR} carries no weight in a client build (${SERVICE_CARD_ACTION_BASIS}).`,
    };
  }
  if (vars.slug !== SERVICE_CARD_ACTION_SLUG) {
    return {
      ...off,
      shape,
      basis: `refused: the card variant is scoped to the ${SERVICE_CARD_ACTION_SLUG} appointment demonstration. ${SERVICE_CARD_ACTION_VAR} is set but this record is "${vars.slug}", so no page changes (${SERVICE_CARD_ACTION_BASIS}).`,
    };
  }
  return {
    enabled: true,
    shape,
    raw,
    unrecognised: null,
    page,
    basis: `${SERVICE_CARD_ACTION_VAR} is set to "${raw.trim()}" and this record is the ${SERVICE_CARD_ACTION_SLUG} demonstration, so its service cards render the ${shape} shape. ${
      shape === "whole-card"
        ? `The recorded name, the recorded note, the bundle's own hairline, and a full-width action bar at the card's foot carrying the family's derived label and a text chevron - the card is still one link to contact-<service>.html#form with no nested control, and only ${page} changes.`
        : `The card is a container: the recorded name and note stay on it as text, and its single action is a real anchor at the card's foot, styled as a button, carrying the family's derived label ("Request <service>") and pointing at contact-<service>.html#form. No card is a link in this shape, so each card has exactly one thing a thumb or a keyboard can act on.`
    } No other record and no client build is touched (${SERVICE_CARD_ACTION_BASIS}).`,
  };
}

/**
 * The shape's own rules. Every value is a token the published stylesheet already defines
 * (`--ink`, `--line`, `--r-md`, `--s-*`), and the button's own numbers are the site's own
 * `.button`: 2.75rem tall, 0.7rem/1.15rem of padding, 600 weight, 12px radius. Nothing here
 * is a second design system.
 *
 * Its colours are the **ghost treatment's** (owner direction, 10 Oct 2026): the CTA is
 * transparent with ink text and an ink outline — the same treatment the header action wears
 * on the paper-surfaced pages, from the same vocabulary (`ghost-controls.ts`), so the two
 * controls cannot drift apart. It was the site's filled primary button (ink fill, white
 * text, 17.79:1) until the owner asked to see the outlined version; the numbers for both are
 * in `docs/ghost-controls.md`.
 *
 * `outline: 2px solid var(--accent)` with a 2px offset is the site's `:focus-visible` ring,
 * drawn on the button because the button is the tab stop; the `:visited` state cannot
 * repaint it, because the button declares its own `color` rather than inheriting the
 * running-text link colour.
 */
const SERVICE_CARD_ACTION_NESTED_CSS = `
/* ------------------------------------------- nested-CTA service card (review variant)
   Owner direction, 10 Oct 2026: each service card gets its own CTA button nested at the
   bottom of the card, rather than the whole card being the tap target. The card is a
   container — its body is inert text — and the one control on it is a real anchor at the
   foot, drawn as a ghost button: transparent, ink text, ink outline (the owner's second
   instruction the same day: "the same transparent/outlined treatment with black text and a
   black outline"). DEMO_SERVICE_CARD_ACTION_BAR is unset in the repository, so this block is
   absent from the published stylesheet: it is written only for a build that opts in
   (src/demo/service-card-action.ts). */
.services .service-tile--cta { padding: 0; }
.services .service-tile--cta .${SERVICE_CARD_ACTION_BODY_CLASS} {
  display: flex; flex-direction: column; flex: 1;
  padding: var(--s-4) var(--s-5) var(--s-4);
}
/* The card is not a target in this shape, so it holds still: the lift the whole-card link
   had belongs to the button now. A thumb that lands on the body gets a card that does not
   look pressable, which is the honest reading of a card you cannot press. */
.services .service-tile--cta:hover,
.services .service-tile--cta:focus-visible {
  border-color: var(--line);
  box-shadow: 0 1px 2px rgba(16, 18, 20, .03);
}
.services .service-tile--cta .${SERVICE_CARD_ACTION_CTA_CLASS} {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  margin: 0 var(--s-5) var(--s-5);
  padding: 0.7rem 1.15rem;
  border: 1px solid ${GHOST_PAPER_INK};
  border-radius: var(--r-md);
  background: transparent;
  color: ${GHOST_PAPER_INK};
  font-family: var(--font-body);
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  text-decoration: none;
  transition: background-color .15s ease, box-shadow .15s ease, transform .05s ease;
}
/* The states deepen the ink rather than filling the button: the ghost's own outline doubles
   with an inset ring, which is 2px of line and no change to the control's box. */
.services .service-tile--cta .${SERVICE_CARD_ACTION_CTA_CLASS}:hover {
  background: ${GHOST_PAPER_FILL_HOVER};
  color: ${GHOST_PAPER_INK};
  box-shadow: inset 0 0 0 1px ${GHOST_PAPER_INK}, 0 2px 10px rgba(16, 18, 20, .10);
}
.services .service-tile--cta .${SERVICE_CARD_ACTION_CTA_CLASS}:active {
  background: ${GHOST_PAPER_FILL_ACTIVE};
  color: ${GHOST_PAPER_INK};
  transform: translateY(1px);
  box-shadow: inset 0 0 0 1px ${GHOST_PAPER_INK};
}
.services .service-tile--cta .${SERVICE_CARD_ACTION_CTA_CLASS}:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
`;
/**
 * The variant's CSS, appended to the stylesheet **only** when the opt-in is set, so the
 * off-state `styles.css` is the published one byte for byte.
 *
 * Every value is an existing token: `--accent-soft` for the strip, the `--line` hairline
 * (`--rule`) for the rule at its top, the `--s-*` spacing scale, and the card's own
 * `--r-lg` radius (clipped by `overflow: hidden`). No new colour, size, radius or
 * breakpoint — a treatment of the published design, not a second design system.
 *
 * The bar is **not** a control, so it carries no boundary-contrast obligation of its own:
 * the affordance a visitor acts on is the label (`--accent-ink` on the tinted strip) and
 * the whole card surface; the hairline is the same decorative separation the hours rows
 * and the section edges already use.
 *
 * **The nested-CTA shape's block** (owner direction, 10 Oct 2026) is written the same way:
 * the card keeps the design system's surface and tokens, and the CTA is the site's own
 * button geometry — `--r-md`, 2.75rem, 0.9375rem/600 — drawn as a **ghost**: transparent,
 * `var(--ink)` text, `var(--ink)` outline, with ink washes for its hover and active states
 * (the owner's second instruction the same day). It is the **only** control on the card, so
 * it carries the contrast obligation the whole-card shape put on the card surface:
 * `--ink` on `#fff` is 16.9:1 for the text and for the outline, and the hover/active washes
 * measure 15.6:1 and 14.3:1 (`docs/ghost-controls.md` carries the measured numbers, and
 * `ghostControlsProblems` clause 4 refuses a fill that would lighten the surface instead).
 * `overflow: hidden` is deliberately absent: the card must never clip the CTA's own focus
 * ring.
 */
export function serviceCardActionCss(shape: ServiceCardShape = "whole-card"): string {
  if (shape === "nested-cta") return SERVICE_CARD_ACTION_NESTED_CSS;
  return `
/* ------------------------------------------- service-card action bar (review variant)
   Treatment 1, from the owner's direction of 9 Oct 2026: the service card keeps its
   recorded name and note, and gains a full-width action bar at its foot — the "button"
   the owner asked for, drawn inside the card's single link (owner text, 6 Oct 2026: no
   nested interactive elements). DEMO_SERVICE_CARD_ACTION_BAR is unset in the repository,
   so this block is absent from the published stylesheet: it is written only for a build
   that opts in (src/demo/service-card-action.ts). */
.services .service-tile--bar { padding: 0; min-height: 2.75rem; overflow: hidden; }
.services .service-tile--bar .${SERVICE_CARD_ACTION_BODY_CLASS} {
  display: flex; flex-direction: column; flex: 1;
  padding: var(--s-4) var(--s-5) var(--s-5);
}
.services .service-tile--bar .${SERVICE_CARD_ACTION_BAR_CLASS} {
  display: flex; align-items: center; justify-content: space-between; gap: var(--s-3);
  min-height: 2.75rem;
  padding: var(--s-2) var(--s-5);
  background: var(--accent-soft);
  border-top: var(--rule);
}
/* The action line is no longer the card's only affordance — the bar is — so the underline
   it wears today gives way to the strip, and comes back as the hover/focus response, so
   the card still reacts to a pointer and to a keyboard the way the rest of the site does. */
.services .service-tile--bar .service-action { margin: 0; padding-top: 0; text-decoration: none; }
.services .service-tile--bar .${SERVICE_CARD_ACTION_CHEVRON_CLASS} { color: var(--accent-ink); font-size: 1.125rem; line-height: 1; }
.services .service-tile--bar:hover .service-action,
.services .service-tile--bar:focus-visible .service-action { text-decoration: underline; text-decoration-thickness: 2px; }
`;
}

/**
 * What a visitor reads, out of the markup the page carries: the five entities `esc`
 * (`render.ts`) writes, read back — the recorded service `Kids' cut` is on the page as
 * `Kids&#39; cut`, and the check compares the words, not the encoding.
 */
function unescapeText(html: string): string {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, "\u00A0")
    .replace(/&amp;/g, "&");
}

/** The `border-top` a rule naming the bar's own class declares, or `null` when none does. */
function barHairline(css: string): string | null {
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!new RegExp(`\\.${SERVICE_CARD_ACTION_BAR_CLASS}\\b`).test(match[1]!)) continue;
    const declaration = /border-top\s*:\s*([^;]+)/i.exec(match[2]!)?.[1]?.trim();
    if (declaration) return declaration;
  }
  return null;
}

/** The recorded service names, as the page writes them — the same reading `serviceCardProblems` takes. */
function recordedNames(record: BusinessRecord): Map<string, string> {
  const names = new Map<string, string>();
  for (const service of Array.isArray(record.services) ? record.services : []) {
    const raw = typeof service === "string" ? service : String((service as { name?: string })?.name ?? "");
    const name = raw.trim();
    if (name) names.set(name, name);
  }
  return names;
}

/** The `<li>` blocks of the first service list on a page, each as its own card. */
function cardsOf(html: string): string[] {
  const list = /<ul class="services">([\s\S]*?)<\/ul>/.exec(html);
  if (!list) return [];
  return list[1]!.split(/<li\b[^>]*>/).slice(1).map((chunk) => {
    const end = chunk.indexOf("</li>");
    return end >= 0 ? chunk.slice(0, end) : chunk;
  });
}

/**
 * **The action-bar card variant appears on exactly one page, only when the build opts in,
 * and it is the shape this module describes** (owner direction, 9 Oct 2026). Run from
 * `complianceChecks` on every page of the bundle.
 *
 * Six clauses, each one a way this could stop being true:
 *
 *   1. **one page, and only with the opt-in** — a page carrying half the variant, or any
 *      page at all while `DEMO_SERVICE_CARD_ACTION_BAR` is unset, or a page other than the
 *      one the decision names: all three are refused. This is the clause that keeps the
 *      published demonstrations byte-identical when nobody asked for the variant, and it
 *      fires in **both** directions — the renderer cannot quietly apply it, and the opt-in
 *      cannot quietly be ignored;
 *   2. **a card each, and the page really got them** — with the opt-in on, the named page
 *      carries exactly one bar card per recorded service, so the variant can neither drop a
 *      service nor leave an old-shaped card beside the new ones;
 *   3. **the bar is at the card's foot and holds nothing else** — the bar is the last thing
 *      inside the card's own link, it carries exactly one action line and exactly one
 *      chevron element, and the chevron is `aria-hidden` and holds just the glyph after a
 *      non-breaking space. A second control in the bar would be the nested-interactive
 *      defect `serviceCardProblems` refuses; a second glyph would be an icon;
 *   4. **the words are the derived ones** — the bar's action line reads exactly the label
 *      `serviceActionLabel` composes for that recorded service, and the bar's whole visible
 *      text is that label plus the glyph and nothing else. Nothing here may add a price, a
 *      duration, a booking promise or an urgency word of its own, however tempting a
 *      "button" makes it;
 *   5. **the bar measures up, off the stylesheet the bundle ships** — the bar's own
 *      `min-height` is 44px or more (read the way the gate reads the card's), the hairline
 *      above it is the bundle's `--rule` token rather than a colour of its own, and the card
 *      still declares 44px of its own and its own focus ring of at least 2px;
 *   6. **the glyph costs nothing** — the card adds no image, no frame, no script, no
 *      `url(…)`, no remote address and no inline handler: the chevron is text, so the bar
 *      is the same page with the stylesheet off and asks the network for nothing.
 */
/**
 * **The action-bar shape's own clauses** — see `serviceCardActionProblems` for the
 * dispatcher, the shared clauses and the nested-CTA shape's clauses. The doc comment above
 * describes these six, unchanged since 9 Oct 2026.
 */
function wholeCardActionProblems(vars: {
  pages: { file: string; html: string }[];
  record: BusinessRecord;
  family: ConversionFamily;
  /** The stylesheet this bundle ships, for clause 5's measuring half. */
  css?: string;
  /** What this build decided (`serviceCardActionDecision`). */
  decision: ServiceCardActionDecision;
  /** The bundle's slug, for the scope wording. */
  slug: string;
}): string[] {
  const { pages, record, family, css, decision } = vars;
  const problems: string[] = [];
  const visible = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const cardMarker = SERVICE_CARD_ACTION_CARD_CLASS;
  const barMarker = SERVICE_CARD_ACTION_BAR_CLASS;

  /* 1. one page, only with the opt-in — both directions. The "variant without the
        opt-in" half is clause 0 of `serviceCardActionProblems`, which runs for **both**
        shapes before either shape's own clauses: a page that smuggles in the nested CTA
        while the variable is unset has to be refused exactly as a smuggled bar is. */
  let carriers = 0;
  for (const page of pages) {
    const card = page.html.includes(cardMarker);
    const bar = page.html.includes(barMarker);
    if (!card && !bar) continue;
    carriers += 1;
    if (decision.enabled && page.file !== decision.page) {
      problems.push(
        `${page.file}: carries the action-bar card variant (${cardMarker}), but the variant is scoped to ${decision.page} of the ${SERVICE_CARD_ACTION_SLUG} demonstration alone. Every other page is the copy the owner signed off, and the home page's own cards are the shape the 6 Oct ruling produced. ${decision.basis}`,
      );
    }
    if (card !== bar) {
      problems.push(
        `${page.file}: carries half the action-bar variant (${
          card ? `the card's own class "${cardMarker}" without the bar element` : `the bar element without the card's own class "${cardMarker}"`
        }). The card's padding, its body wrapper and the bar are one shape: half of it is a bar drawn where the shape did not put it.`,
      );
    }
  }
  if (decision.enabled && carriers === 0) {
    problems.push(
      `no page carries the action-bar card variant while ${SERVICE_CARD_ACTION_VAR} is set and this record is the ${SERVICE_CARD_ACTION_SLUG} demonstration: ${decision.page} was asked for the variant and rendered the signed-off cards instead. ${decision.basis}`,
    );
  }

  /* 2. a card each, on the page the decision names. */
  const services = recordedNames(record);
  const target = pages.find((page) => page.file === decision.page);
  const cards = target ? cardsOf(target.html) : [];
  const barCards = cards.filter((html) => html.includes(cardMarker));
  if (decision.enabled && target && services.size > 0 && barCards.length !== services.size) {
    problems.push(
      `${decision.page}: carries ${barCards.length} action-bar card${barCards.length === 1 ? "" : "s"} for ${services.size} recorded service${services.size === 1 ? "" : "s"}. Every recorded service is one card and the variant applies to the whole list or to none of it — a service the page dropped is a service a visitor cannot ask about.`,
    );
  }

  /* 3 and 4. the bar is the card's foot, holding the derived words and the glyph alone. */
  for (const card of barCards) {
    const cardName = visible(card).slice(0, 60);
    const inner = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(card)?.[2] ?? "";
    if (inner === "") {
      problems.push(`${decision.page}: the card "${cardName}" wears the variant's own class but carries no link, so its bar is a bar in a dead card.`);
      continue;
    }
    const barMatch = new RegExp(`<div class="${barMarker}">([\\s\\S]*?)</div>`).exec(inner);
    if (!barMatch) {
      problems.push(
        `${decision.page}: the card "${cardName}" wears the variant's own class but carries no bar element (<div class="${barMarker}">). The class is what the stylesheet and this check key off, so a card with the class and no bar is a card whose foot is empty.`,
      );
      continue;
    }
    const afterBar = inner.slice(barMatch.index + barMatch[0].length).trim();
    if (afterBar !== "") {
      problems.push(
        `${decision.page}: the bar is not the last thing inside the card's link for "${cardName}" — "${visible(afterBar).slice(0, 60)}" follows it. The bar sits at the card's foot: a visitor reaches it after the note, and a card whose bar is not last has content below its own action.`,
      );
      continue;
    }
    const content = barMatch[1]!;
    const close = content.startsWith(BAR_LINE_OPEN) ? content.indexOf(BAR_LINE_CLOSE, BAR_LINE_OPEN.length) : -1;
    if (close < 0) {
      problems.push(
        `${decision.page}: the bar for "${cardName}" does not open with one action line (<p class="service-action">…</p>). The bar's words are the family's derived label, and the element the gate reads them from has to be there for them to be read.`,
      );
      continue;
    }
    const line = content.slice(BAR_LINE_OPEN.length, close);
    const tail = content.slice(close + BAR_LINE_CLOSE.length);
    const chevrons = (content.match(new RegExp(`class="${SERVICE_CARD_ACTION_CHEVRON_CLASS}"`, "g")) ?? []).length;
    if (tail !== CHEVRON_ELEMENT) {
      problems.push(
        `${decision.page}: the bar for "${cardName}" reads "${visible(content).slice(0, 80)}" — which is not one action line followed by the chevron. It holds exactly one <p class="service-action"> and one ${CHEVRON_ELEMENT} (found ${chevrons} chevron element${chevrons === 1 ? "" : "s"}). Anything else in the bar is a second control inside the card's single target, or an icon the bundle would have to ship.`,
      );
      continue;
    }
    if (/[<>]/.test(line)) {
      problems.push(
        `${decision.page}: the bar's action line for "${cardName}" wraps its words in markup ("${line.slice(0, 80)}"). The line is the derived label as plain text — the label the gate reads, and the words a visitor reads, are the same string.`,
      );
      continue;
    }
    const heading = unescapeText(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(inner)?.[1]?.trim() ?? "");
    const name = services.get(heading);
    if (!name) {
      problems.push(
        `${decision.page}: a card's action bar reads "${line}" under the heading "${visible(heading)}", which the record does not list as a service. The words in the bar are composed from the recorded name, so a bar over a name the record does not carry is a bar describing nothing.`,
      );
      continue;
    }
    const label = serviceActionLabel(family, name);
    const lineText = unescapeText(line).trim();
    if (lineText !== label) {
      problems.push(
        `${decision.page}: the card for "${name}" carries the action line "${lineText}" while the ${family} family's derived label for that service is "${label}". The bar's words come from copy.ts/family.ts, never from the template — a typed "Book now" or a generic "Request this" is exactly what this clause refuses.`,
      );
      continue;
    }
    // The glyph is written as the `&nbsp;›` entity (the grammar `BOOKING_ARROW` uses), so the
    // bar's text is read back the way a visitor reads it: the entity decoded, tags stripped.
    const barText = visible(unescapeText(content));
    if (barText !== `${label} ${SERVICE_CARD_ACTION_GLYPH}`) {
      problems.push(
        `${decision.page}: the bar's visible text for "${name}" is "${barText}" — not "${label} ${SERVICE_CARD_ACTION_GLYPH}". The bar adds no words of its own: no price, no duration, no booking promise and no urgency, on a card that asks a visitor to describe what they need.`,
      );
    }
  }

  /* 5. the numbers, read off the stylesheet the bundle ships the way the gate reads them.
        Only when the variant is on: with the opt-in unset the stylesheet rightly carries no
        bar rules at all, and clause 1 is the clause that says so. */
  if (css && decision.enabled) {
    const bar = serviceCardMeasure(css, [SERVICE_CARD_ACTION_BAR_CLASS]);
    if (bar.min_height_px === null || bar.min_height_px < 44) {
      problems.push(
        `the action bar (class="${SERVICE_CARD_ACTION_BAR_CLASS}") is ${
          bar.min_height_px === null ? "given no min-height by any rule naming its own class" : `at most ${bar.min_height_px}px tall`
        } in the stylesheet this bundle ships, so the card's "button" is not a row a thumb can hit. It is a full-width bar at the card's foot, and 44px is the floor the card's own target is held to (2.75rem).`,
      );
    }
    const hairline = barHairline(css);
    if (!hairline) {
      problems.push(
        `no rule naming the action bar (class="${SERVICE_CARD_ACTION_BAR_CLASS}") declares a border-top, so nothing separates the bar from the card's note in the stylesheet this bundle ships. The hairline is what makes the bar read as the card's foot rather than as one more line of the note.`,
      );
    } else if (!/^var\(--rule\)$/.test(hairline.replace(/\s+/g, " "))) {
      problems.push(
        `the action bar's hairline is declared as "border-top: ${hairline}", which is not the bundle's own --rule token. The treatment uses the design system's parts; a colour of its own inside a review variant is a second design system hidden in one page.`,
      );
    }
    const card = serviceCardMeasure(css, ["card", "service-tile", SERVICE_CARD_ACTION_CARD_CLASS]);
    if (card.min_height_px === null || card.min_height_px < 44) {
      problems.push(
        `the whole-card target (class="card service-tile ${SERVICE_CARD_ACTION_CARD_CLASS}") is ${
          card.min_height_px === null ? "given no min-height by any rule naming its own classes" : `at most ${card.min_height_px}px tall`
        } in the stylesheet this bundle ships. The variant changes the card's padding and the card is still the thing a thumb hits, so the 44px floor applies to it exactly as it did before.`,
      );
    }
    if (card.focus_ring_px === null || card.focus_ring_px < 2) {
      problems.push(
        `the card that wears the variant (class="card service-tile ${SERVICE_CARD_ACTION_CARD_CLASS}") is given ${
          card.focus_ring_px === null ? "no focus ring by any rule naming its own classes" : `a ${card.focus_ring_px}px focus ring`
        } in the stylesheet this bundle ships. The whole card is still the tab stop, so the ring is still drawn on the card — a keyboard visitor moving through a grid of identical cards has nothing else to go by.`,
      );
    }
  }

  /* 6. the glyph costs nothing: the bar is text, and it asks the network for nothing. */
  for (const card of barCards) {
    const requests = [
      ...new Set([
        ...(card.match(/<\/?(img|object|embed|iframe|script|picture|source|video|audio)\b/gi) ?? []).map((tag) =>
          tag.replace(/[</]/g, "").toLowerCase(),
        ),
        // An **inline** `<svg>` fetches nothing, so `svg` is out of the tag list above: the
        // graphics layer draws every mark inline (`graphics.ts`), from `currentColor` and the
        // bundle's own tokens, so there is no file to ship and none to license. What fetches
        // *inside* a drawing is named here instead, so the clause keeps exactly the teeth it
        // had — a card may not take a file from anywhere.
        ...(/<svg[^>]*\bsrc\s*=/i.test(card) ? ["an <svg src>"] : []),
        ...(/<image[\s>]/i.test(card) ? ["an <image>"] : []),
        ...(/<use[^>]*href="(?!#)/i.test(card) ? ["an external <use>"] : []),
        ...(/\bsrc\s*=/i.test(card) ? ["src="] : []),
        ...(/\bhttps?:\/\//i.test(card) ? ["a remote address"] : []),
        ...(/url\(/i.test(card) ? ["url(...)"] : []),
        ...(/\son[a-z]+\s*=/i.test(card) ? ["an inline event handler"] : []),
      ]),
    ];
    if (requests.length > 0) {
      problems.push(
        `${decision.page}: an action-bar card adds ${requests.join(", ")} — on a card whose whole action is one link and one text glyph. The chevron is a text glyph, the grammar booking.ts's BOOKING_ARROW uses, so the bar survives the stylesheet not loading, costs no request, and needs no file the bundle has to ship or license.`,
      );
    }
  }

  return problems;
}
/**
 * **The nested-CTA shape's own clauses** — owner direction, 10 Oct 2026: "each service card
 * gets its own CTA button nested at the bottom of the card, rather than the whole card being
 * the tap target". Read after the dispatcher's shared clauses (the opt-in, the value it
 * could not read), only when this build really renders the shape.
 *
 * Five clauses, each one a way this could stop being true:
 *
 *   1. **the shape covers every card the demonstration renders, or none of them** — the
 *      nested CTA renders on every page of this bundle that lists services (the owner asked
 *      for it on the cards, and the home page renders cards too), and on no page that does
 *      not. A page that renders a list without them, a page that wears them with no list, or
 *      a card wearing half the shape, is refused;
 *   2. **a card each, with the CTA at its foot** — one nested-CTA card per recorded service
 *      per page, each a container holding the record's name and note as text and one anchor
 *      at the card's foot. A second control, a control that is not the last thing on the
 *      card, or a card carrying no CTA, is refused;
 *   3. **the CTA is the label the family composed** — its visible text is exactly
 *      `serviceActionLabel(family, name)` ("Request <service>"), its `href` is the page built
 *      for that service with `#form` (`serviceCardProblems` clause 5 refuses the destination
 *      for both shapes, on the same anchor), and it carries no markup of its own — no
 *      chevron, no price, no duration, no "Book now";
 *   4. **the CTA measures up, off the stylesheet the bundle ships** — its own `min-height` is
 *      44px or more and its own `:focus-visible` ring is at least 2px, both read through
 *      `serviceCardMeasure` over the class the anchor wears. The card itself is inert and is
 *      not given a floor: the CTA is the target now;
 *   5. **the ring is never clipped** — no rule naming the variant's card class declares
 *      `overflow: hidden`, so the focus ring the button draws outside its own box is always
 *      visible on the card's surface. (The whole-card shape sets `overflow: hidden` to clip
 *      its bar to the card's radius; the nested shape must not inherit that habit.)
 *
 * The shape's own cost clause is shared with the bar: neither shape may add an image, a
 * frame, a script, a `url(…)`, a remote address or an inline handler.
 */
function nestedCtaActionProblems(vars: {
  pages: { file: string; html: string }[];
  record: BusinessRecord;
  family: ConversionFamily;
  css?: string;
  decision: ServiceCardActionDecision;
  slug: string;
}): string[] {
  const { pages, record, family, css, decision } = vars;
  const problems: string[] = [];
  const visible = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const cardMarker = SERVICE_CARD_ACTION_NESTED_CARD_CLASS;
  const ctaMarker = SERVICE_CARD_ACTION_CTA_CLASS;
  const services = recordedNames(record);
  const listPages = pages.filter((page) => /<ul class="services">/.test(page.html)).map((page) => page.file);
  /* 1. every page that renders a service list carries the shape, and no other page does. */
  for (const file of listPages) {
    const page = pages.find((p) => p.file === file)!;
    if (!page.html.includes(cardMarker)) {
      problems.push(
        `${file}: renders a service list with none of the nested-CTA cards on it while ${SERVICE_CARD_ACTION_VAR} is set to "${decision.raw.trim()}". The nested-CTA shape is the card itself, so it applies to every card this demonstration renders or to none of them — a page that kept the old shape beside the new one is two shapes in one demonstration. ${decision.basis}`,
      );
    }
  }
  for (const page of pages) {
    const card = page.html.includes(cardMarker);
    const cta = page.html.includes(ctaMarker);
    if (!card && !cta) continue;
    if (!listPages.includes(page.file)) {
      problems.push(
        `${page.file}: carries the nested-CTA card variant (${cardMarker}) but renders no service list. ${decision.basis}`,
      );
    }
    if (card !== cta) {
      problems.push(
        `${page.file}: carries half the nested-CTA variant (${
          card ? `the card's own class "${cardMarker}" without a ${ctaMarker} control` : `a ${ctaMarker} control with no card wearing "${cardMarker}"`
        }). The card's surface, its body wrapper and the CTA are one shape: half of it is a button drawn where the shape did not put it.`,
      );
    }
  }
  /* 2 and 3. a card each, with the derived label on one control at the card's foot. */
  for (const page of pages) {
    const cards = cardsOf(page.html).filter((html) => html.includes(cardMarker));
    if (cards.length === 0) continue;
    if (decision.enabled && services.size > 0 && cards.length !== services.size) {
      problems.push(
        `${page.file}: carries ${cards.length} nested-CTA card${cards.length === 1 ? "" : "s"} for ${services.size} recorded service${
          services.size === 1 ? "" : "s"
        }. Every recorded service is one card and the shape applies to the whole list or to none of it — a service the page dropped is a service a visitor cannot ask about.`,
      );
    }
    for (const card of cards) {
      const cardName = visible(card).slice(0, 60);
      const anchors = card.match(/<a\b/gi) ?? [];
      const controls = card.match(/<\/?(a|button|input|select|textarea|details|summary|iframe|object|embed)\b/gi) ?? [];
      const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(card);
      if (!anchor) {
        problems.push(
          `${page.file}: the card "${cardName}" wears the nested-CTA class but carries no CTA. The shape's whole point is the one control at the card's foot — a card with none is a card a visitor cannot act on.`,
        );
        continue;
      }
      const href = /\bhref="([^"]*)"/.exec(anchor[1] ?? "")?.[1]?.trim() ?? "";
      // The heading's **text** (`headingText`): a card may carry the graphics layer's mark
      // beside the recorded name, and a mark is not part of the name the record carries.
      const heading = headingText(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(card)?.[1] ?? "");
      const name = services.get(unescapeText(heading).replace(/&#39;/g, "'"));
      if (!name) {
        problems.push(
          `${page.file}: a nested-CTA card reads "${cardName}", whose heading the record does not list as a service. The label on the CTA is composed from the recorded name, so a card over a name the record does not carry is a button describing nothing.`,
        );
        continue;
      }
      const others = [...new Set(controls.filter((tag) => !/^<\/?a\b/i.test(tag)).map((tag) => tag.replace(/[</>]/g, "").toLowerCase()))];
      if (anchors.length !== 1 || others.length > 0) {
        problems.push(
          `${page.file}: the card for "${name}" carries ${anchors.length} links and ${others.length > 0 ? `<${others.join(">, <")}>` : "no other controls"}, not one control. The nested-CTA shape gives each card exactly one action, the anchor at its foot: a second link is a second promise, and a <button> cannot navigate with JavaScript off.`,
        );
      }
      const afterCta = card
        .slice(card.indexOf(anchor[0]) + anchor[0].length)
        .replace(/<\/?(?:div|li|p|span|ul|ol|section)\b[^>]*>/gi, "")
        .trim();
      if (afterCta !== "") {
        problems.push(
          `${page.file}: the CTA for "${name}" is not the card's foot — "${visible(afterCta).slice(0, 60)}" follows it. The shape puts the card's one action at the bottom of the card, under the name and the note.`,
        );
      }
      const label = serviceActionLabel(family, name);
      const ctaText = unescapeText(anchor[2] ?? "").trim();
      if (ctaText !== label) {
        problems.push(
          `${page.file}: the card for "${name}" carries the CTA "${ctaText}" while the ${family} family's derived label for that service is "${label}". The button's words come from copy.ts/family.ts, never from the template — a typed "Book now", a price or a generic "Request this" is exactly what this clause refuses.`,
        );
      }
      if (href === "") {
        problems.push(`${page.file}: the CTA for "${name}" carries no href, so the button goes nowhere.`);
      } else if (!/^contact-.+\.html#form$/.test(href)) {
        problems.push(
          `${page.file}: the CTA for "${name}" points at "${href}", not at the page built for that service with "#form". The destination is derived from the service's own recorded name, never typed, and the fragment is what lands the visitor on the form.`,
        );
      }
    }
  }
  /* 4. the numbers, read off the stylesheet the way the gate reads them. */
  if (css && decision.enabled) {
    const cta = serviceCardMeasure(css, [ctaMarker]);
    if (cta.min_height_px === null || cta.min_height_px < 44) {
      problems.push(
        `the CTA (class="${ctaMarker}") is ${
          cta.min_height_px === null ? "given no min-height by any rule naming its own class" : `at most ${cta.min_height_px}px tall`
        } in the stylesheet this bundle ships, so the card's button is not a row a thumb can hit. It is the card's only control, and 44px is the floor the demo's controls are held to (2.75rem).`,
      );
    }
    if (cta.focus_ring_px === null || cta.focus_ring_px < 2) {
      problems.push(
        `the CTA (class="${ctaMarker}") is given ${
          cta.focus_ring_px === null ? "no focus ring by any rule naming its own class" : `a ${cta.focus_ring_px}px focus ring`
        } in the stylesheet this bundle ships. The button is the tab stop in this shape, so the ring is drawn on the button — a keyboard visitor tabbing a grid of identical cards has nothing else to go by.`,
      );
    }
    /* 5. the ring is never clipped by the card's own overflow. */
    for (const match of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!new RegExp(`\\.${cardMarker}\\b`).test(match[1]!)) continue;
      if (/overflow\s*:\s*hidden/i.test(match[2]!)) {
        problems.push(
          `the variant's card (class="${cardMarker}") declares overflow: hidden in the stylesheet this bundle ships. The CTA's focus ring is drawn 2px outside its own box, so a card that clips its overflow clips the ring — the keyboard state the owner asked to be visible is the state that disappears.`,
        );
      }
    }
  }
  /* The shape's cost, the same scan the bar gets: a button may not fetch anything. */
  for (const page of pages) {
    const card = cardsOf(page.html).find((html) => html.includes(cardMarker));
    if (!card) continue;
    const requests = [
      ...new Set([
        ...(card.match(/<\/?(img|object|embed|iframe|script|picture|source|video|audio)\b/gi) ?? []).map((tag) =>
          tag.replace(/[</]/g, "").toLowerCase(),
        ),
        // An **inline** `<svg>` fetches nothing, so `svg` is out of the tag list above: the
        // graphics layer draws every mark inline (`graphics.ts`), from `currentColor` and the
        // bundle's own tokens, so there is no file to ship and none to license. What fetches
        // *inside* a drawing is named here instead, so the clause keeps exactly the teeth it
        // had — a card may not take a file from anywhere.
        ...(/<svg[^>]*\bsrc\s*=/i.test(card) ? ["an <svg src>"] : []),
        ...(/<image[\s>]/i.test(card) ? ["an <image>"] : []),
        ...(/<use[^>]*href="(?!#)/i.test(card) ? ["an external <use>"] : []),
        ...(/\bsrc\s*=/i.test(card) ? ["src="] : []),
        ...(/\bhttps?:\/\//i.test(card) ? ["a remote address"] : []),
        ...(/url\(/i.test(card) ? ["url(...)"] : []),
        ...(/\son[a-z]+\s*=/i.test(card) ? ["an inline event handler"] : []),
      ]),
    ];
    if (requests.length > 0) {
      problems.push(
        `${page.file}: a nested-CTA card adds ${requests.join(", ")} — on a card whose whole action is one anchor carrying one label. The button is text in the bundle's own stylesheet, so it survives the stylesheet not loading, costs no request, and needs no file the bundle has to ship or license.`,
      );
    }
  }
  return problems;
}
/**
 * **The card variant renders the shape this build asked for, on the pages it should, and
 * nothing else moves.** Run from `complianceChecks` on every page of the bundle.
 *
 * Two clauses run for **both** shapes, because a shape-blind clause is how one of them would
 * quietly slip through:
 *
 *   0a. **the switch names a shape this build can read** — `DEMO_SERVICE_CARD_ACTION_BAR`
 *       set to anything else is refused here, not silently rendered as the published cards
 *       (the decision records the value in `unrecognised`);
 *   0b. **the opt-in, in both directions** — a page carrying either shape's marker while the
 *       variable is unset is refused, whichever shape it is.
 *
 * Then the clauses of the shape this build actually renders: `wholeCardActionProblems` (the
 * 9 Oct bar) or `nestedCtaActionProblems` (the 10 Oct nested CTA). The two shapes never
 * share a page: each one's clauses refuse the other's markup.
 */
export function serviceCardActionProblems(vars: {
  pages: { file: string; html: string }[];
  record: BusinessRecord;
  family: ConversionFamily;
  css?: string;
  decision: ServiceCardActionDecision;
  slug: string;
}): string[] {
  const { pages, decision } = vars;
  const problems: string[] = [];
  /* 0a. the value names no shape: refused, never guessed at. */
  if (decision.unrecognised !== null) {
    problems.push(
      `${SERVICE_CARD_ACTION_VAR} is set to "${decision.unrecognised}", which names no card shape this build knows, so nothing was rendered for it. The accepted values are ${Object.keys(
        SERVICE_CARD_ACTION_SHAPES,
      )
        .map((key) => `"${key}"`)
        .join(", ")}. ${decision.basis}`,
    );
  }
  /* 0b. the variant is an opt-in, whichever shape it is. */
  for (const page of pages) {
    const markers = [SERVICE_CARD_ACTION_CARD_CLASS, SERVICE_CARD_ACTION_NESTED_CARD_CLASS].filter((marker) =>
      page.html.includes(marker),
    );
    if (markers.length === 0) continue;
    if (!decision.enabled) {
      problems.push(
        `${page.file}: carries the card variant (${markers.join(", ")}) while ${SERVICE_CARD_ACTION_VAR} is not set in this build. The variant is an opt-in: with the variable unset no page changes, and both bundles are the pages signed off on 7 Oct 2026, byte for byte. ${decision.basis}`,
      );
    }
  }
  if (decision.enabled && decision.shape === "nested-cta") {
    problems.push(...nestedCtaActionProblems(vars));
    return problems;
  }
  problems.push(...wholeCardActionProblems(vars));
  return problems;
}
