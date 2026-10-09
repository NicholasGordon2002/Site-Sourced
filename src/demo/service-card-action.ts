/**
 * Treatment 1 — **the action bar at the service card's foot** (owner direction, 9 Oct 2026:
 * "investigate what it could look like again with modern, clean, and professional looking
 * services cards that contain a booking button that could redirect on click to a booking
 * service").
 *
 * ## Why this is a module of its own, and why it is behind an opt-in
 *
 * The shape the owner asked for — a card that carries an **action** — was rejected once
 * already, on 6 Oct 2026: *"Remove the nested service action button. Make each entire
 * service card one accessible keyboard/touch-safe interactive target, with no nested
 * interactive elements"*. That ruling is enforced today by `serviceCardProblems` clause 1
 * (`family-render.ts`), and whether the owner wants it kept is **still open** — the lead is
 * putting that question to the owner, not deciding it here.
 *
 * So this variant is built to survive **either** answer:
 *
 *   - **the card is still ONE link**, wearing the same `card service-tile` classes, and
 *     nothing interactive is nested in it. The "button" is a styled element *inside* the
 *     anchor — a `<div>` strip holding the action line as a `<p>` and a chevron as a
 *     `<span>`, neither of them a control. No `<a>`, `<button>`, `<input>`, `<select>`,
 *     `<textarea>`, `<details>`, `<summary>`, `<iframe>`, `<object>` or `<embed>` and no
 *     `tabindex` joins them — one target, one tab stop per card, exactly as clause 1
 *     requires (`serviceCardProblems` runs over the variant page too, unchanged);
 *   - **the destination does not change.** The card still points at the page built for that
 *     service, `contact-<service-slug>.html#form`, with that service already `selected` in
 *     the HTML the browser receives. Nothing here adds a booking address, a price, a
 *     duration or a second link: this record's booking mode is `none`, so the label stays
 *     the derived `Request <service>` / `Ask about <service>`, and a per-service booking
 *     link is a separate question this module deliberately does not answer.
 *
 * ## The opt-in
 *
 * Like the review-only booking-comparison page (`booking-comparison.ts`), the variant is
 * off unless the environment opts it in — `DEMO_SERVICE_CARD_ACTION_BAR` — and then it is
 * scoped to **one page of one demonstration**:
 *
 *   1. **the variable names no address and carries no content**: it is a switch, so nothing
 *      about the variant lives outside this repository;
 *   2. with it unset, **no page of any bundle changes**: `servicesBlock` renders the markup
 *      it renders today, `renderCss` writes the stylesheet it writes today, and every page
 *      of both published demonstrations is byte-identical. The tests assert the off-state
 *      markup, and the staging session diffed both bundles file by file;
 *   3. `serviceCardActionProblems` refuses the variant anywhere but the page it names, on
 *      any other record, and in the **delivered phase** — a client's site never carries a
 *      review treatment.
 *
 * ## What the page renders with it on
 *
 * ```html
 * <li>
 *   <a class="card service-tile service-tile--bar" href="contact-hot-shave.html#form"><div class="service-tile-body"><h2>Hot shave</h2><p>Straight razor and hot towels…</p></div><div class="service-action-bar"><p class="service-action">Request Hot shave</p><span class="service-action-chevron" aria-hidden="true">&nbsp;›</span></div></a>
 * </li>
 * ```
 *
 * The heading is the **record's** name, the note is the **record's** note, the rule above
 * the bar is the bundle's own `--rule` hairline token, and the bar's words are the
 * **family's** derived label. The chevron is a text glyph after a non-breaking space —
 * the same grammar `BOOKING_ARROW` uses (`booking.ts`): 0 new assets, 0 requests on load,
 * and it survives the stylesheet not loading at all.
 */
import { serviceActionLabel, type ConversionFamily } from "./family.ts";
import { serviceCardMeasure } from "./family-render.ts";
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

export interface ServiceCardActionDecision {
  /** Whether this build renders the variant. */
  enabled: boolean;
  /** The one page it may appear on, whether or not this build enables it. */
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
  if (!serviceCardActionRequested(vars.env ?? process.env)) {
    return {
      enabled: false,
      page,
      basis: `${SERVICE_CARD_ACTION_VAR} is not set in this build, so no page carries the action-bar card: both bundles are the pages signed off on 7 Oct 2026, byte for byte (${SERVICE_CARD_ACTION_BASIS}).`,
    };
  }
  if (vars.phase === "business") {
    return {
      enabled: false,
      page,
      basis: `refused: this bundle is in the delivered phase. The action-bar card is a review treatment for the owner — it is not part of the design a client has agreed to, and ${SERVICE_CARD_ACTION_VAR} carries no weight in a client build (${SERVICE_CARD_ACTION_BASIS}).`,
    };
  }
  if (vars.slug !== SERVICE_CARD_ACTION_SLUG) {
    return {
      enabled: false,
      page,
      basis: `refused: the action-bar card is scoped to the ${SERVICE_CARD_ACTION_SLUG} appointment demonstration. ${SERVICE_CARD_ACTION_VAR} is set but this record is "${vars.slug}", so no page changes (${SERVICE_CARD_ACTION_BASIS}).`,
    };
  }
  return {
    enabled: true,
    page,
    basis: `${SERVICE_CARD_ACTION_VAR} is set and this record is the ${SERVICE_CARD_ACTION_SLUG} demonstration, so ${page} renders its service cards as Treatment 1 — the recorded name, the recorded note, the bundle's own hairline, and a full-width action bar at the card's foot carrying the family's derived label and a text chevron. The card is still one link to contact-<service>.html#form with no nested control, and no other page of either bundle is touched (${SERVICE_CARD_ACTION_BASIS}).`,
  };
}

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
 */
export function serviceCardActionCss(): string {
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
export function serviceCardActionProblems(vars: {
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

  /* 1. one page, only with the opt-in — both directions. */
  let carriers = 0;
  for (const page of pages) {
    const card = page.html.includes(cardMarker);
    const bar = page.html.includes(barMarker);
    if (!card && !bar) continue;
    carriers += 1;
    if (!decision.enabled) {
      problems.push(
        `${page.file}: carries the action-bar card variant (${cardMarker}) while ${SERVICE_CARD_ACTION_VAR} is not set in this build. The variant is an opt-in: with the variable unset no page changes, and both bundles are the pages signed off on 7 Oct 2026, byte for byte. ${decision.basis}`,
      );
    } else if (page.file !== decision.page) {
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
    const heading = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(inner)?.[1]?.trim() ?? "";
    const name = services.get(heading);
    if (!name) {
      problems.push(
        `${decision.page}: a card's action bar reads "${line}" under the heading "${visible(heading)}", which the record does not list as a service. The words in the bar are composed from the recorded name, so a bar over a name the record does not carry is a bar describing nothing.`,
      );
      continue;
    }
    const label = serviceActionLabel(family, name);
    if (line.trim() !== label) {
      problems.push(
        `${decision.page}: the card for "${name}" carries the action line "${line.trim()}" while the ${family} family's derived label for that service is "${label}". The bar's words come from copy.ts/family.ts, never from the template — a typed "Book now" or a generic "Request this" is exactly what this clause refuses.`,
      );
      continue;
    }
    // The glyph is written as the `&nbsp;›` entity (the grammar `BOOKING_ARROW` uses); a
    // reader sees a non-breaking space, and `&nbsp;` is what the page's own text holds.
    const barText = visible(content.replace(/&nbsp;/g, " ")).replace(/\s+/g, " ").trim();
    if (barText !== `${label} ${SERVICE_CARD_ACTION_GLYPH}`) {
      problems.push(
        `${decision.page}: the bar's visible text for "${name}" is "${barText}" — not "${label} ${SERVICE_CARD_ACTION_GLYPH}". The bar adds no words of its own: no price, no duration, no booking promise and no urgency, on a card that asks a visitor to describe what they need.`,
      );
    }
  }

  /* 5. the numbers, read off the stylesheet the bundle ships the way the gate reads them. */
  if (css) {
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
        ...(card.match(/<\/?(img|svg|object|embed|iframe|script|picture|source|video|audio)\b/gi) ?? []).map((tag) =>
          tag.replace(/[</]/g, "").toLowerCase(),
        ),
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
