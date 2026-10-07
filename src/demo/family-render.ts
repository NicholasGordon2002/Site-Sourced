/**
 * Site Sourced — the family rendering layer: **what each family's build renders, in
 * what order, and the checks that keep the rendering honest.**
 *
 * The family core (`family.ts`) decides *which* family a build is for, which label its
 * primary action carries and which words are out of bounds. This file is the other
 * half: the per-family page furniture. It is all derived data — nothing here is typed
 * into a template — so the family layer is a table lookup rather than a second
 * template, and every piece of it is recorded in `manifest.json`.
 *
 *   section order (`SECTION_ORDER`)   Family B's home page carries "How an inquiry
 *                                     works" between the recorded services and the
 *                                     hours; Family A's does not, because a
 *                                     time-slot business's next question is the time,
 *                                     not a description of the job.
 *   the inquiry steps (`inquirySteps`)  three lines, two of them derived from
 *                                     `delivery.mode`: on a demonstration page nobody
 *                                     at the business reads the message, so "they
 *                                     contact you" would promise something nobody
 *                                     performs (lead ruling 2).
 *   the service-card action            `Request <service>` (A) / `Ask about <service>`
 *                                     (B) — the one 44px action on a plain card,
 *                                     opening the page built for that service. Never
 *                                     "Get a quote": an inquiry page may not promise a
 *                                     price.
 *   the extras card (`extrasLines`)   the record's own words, one per line, and
 *                                     nothing at all when the record carries none.
 *                                     `accepts_walk_ins: true` is the one line a
 *                                     boolean produces (lead ruling 4), and it is
 *                                     recorded as boolean-derived rather than verbatim.
 *
 * `familyRenderingProblems` is the build check for all of it. It reads the rendered
 * pages, because a rule that lives only in this comment is a rule that will rot
 * (WORKFLOW.md rule 6).
 */

import type { BusinessRecord, FormDeliveryMode } from "./types.ts";
import { familyHonestyProblems, serviceActionLabel, type ConversionFamily } from "./family.ts";

/** One block of a page. `render.ts` owns how each one is drawn. */
export type SectionId =
  | "head"
  | "hero"
  | "about-short"
  | "about-full"
  | "services"
  | "how"
  | "hours"
  | "extras"
  | "form"
  | "privacy"
  | "cta";

export type PageKey = "index" | "services" | "about" | "contact" | "privacy";

/**
 * The order a page's blocks are rendered in, **per family**. This is the table the
 * rendering session's section-order item is: the two families differ in exactly one
 * place today (Family B's `how`), and any further difference belongs here rather than
 * in a branch inside the template.
 */
export const SECTION_ORDER: Record<ConversionFamily, Record<PageKey, SectionId[]>> = {
  appointment: {
    index: ["hero", "about-short", "services", "hours", "cta"],
    services: ["head", "services", "hours", "cta"],
    about: ["head", "about-full", "hours", "extras", "cta"],
    contact: ["head", "form", "hours"],
    privacy: ["head", "privacy"],
  },
  inquiry: {
    index: ["hero", "about-short", "services", "how", "hours", "cta"],
    services: ["head", "services", "hours", "cta"],
    about: ["head", "about-full", "hours", "extras", "cta"],
    contact: ["head", "form", "hours"],
    privacy: ["head", "privacy"],
  },
};

/**
 * The opening move of an inquiry, as three lines: describe the job, who receives it,
 * who answers.
 *
 * Steps 2 and 3 are **derived from `delivery.mode`**, exactly like the form-delivery
 * notice, so the same three `<li>`s render in both phases with no conditional HTML.
 * On a demonstration page the message comes to us and the business never sees it, so
 * "they contact you" would be a promise nobody performs (lead ruling 2); "replies to
 * you once" is already what our privacy notice states, so step 3 derives from it
 * rather than inventing new copy.
 *
 * Family A has no such block: an appointment page's next step is the request form.
 */
export function inquirySteps(mode: FormDeliveryMode, vars: { business: string; us: string }): string[] {
  return mode === "business"
    ? ["Describe the job", `The business gets your message`, "They contact you"]
    : ["Describe the job", `${vars.us} receives this demonstration message`, `${vars.us} replies to you`];
}

/* ------------------------------------------------------------------ the extras card */

/**
 * One line of the extras card: the client's own fact, printed verbatim, or — for the
 * one boolean the record carries — the least-worded true rendering of it.
 *
 * `source` is what the manifest prints, so a reviewer can see which lines are the
 * record's words and which one the build derived from a flag (lead ruling 4).
 */
export interface ExtraLine {
  label: string;
  value: string;
  source: "verbatim" | "boolean-derived";
  /** The record field the line came from. */
  field: string;
}

/** The labels the extras card prints — `copy.ts` holds the prose, this file the order. */
export interface ExtraLabels {
  extrasHeading: string;
  extraServiceArea: string;
  extraLicensing: string;
  extraPricing: string;
  extraNewClients: string;
  extraCancellations: string;
  extraWalkIns: string;
  extraDirectBilling: string;
  /** The one sentence `accepts_walk_ins: true` produces (lead ruling 4). */
  walkInsWelcome: string;
}

/** The categories that bill an insurer directly — the only ones that print that line. */
const DIRECT_BILLING_PROFILES = ["dental", "health"];

/**
 * The extras card's lines, in the order the design spec lists them, from the record
 * and nothing else. **Present → printed verbatim; absent → the line does not exist**,
 * and a record with no lines at all renders no card (design spec §4; the same rule as
 * `familyHonestyProblems`: a gap is never filled with generic copy).
 */
export function extrasLines(vars: {
  record: BusinessRecord;
  profileKey: string;
  labels: ExtraLabels;
}): ExtraLine[] {
  const { record, profileKey, labels } = vars;
  const lines: ExtraLine[] = [];
  const verbatim = (field: keyof BusinessRecord, label: string) => {
    const value = record[field];
    if (typeof value === "string" && value.trim()) lines.push({ label, value: value.trim(), source: "verbatim", field: String(field) });
  };

  verbatim("service_area", labels.extraServiceArea);
  verbatim("licence_note", labels.extraLicensing);
  verbatim("pricing_note", labels.extraPricing);
  verbatim("new_client_note", labels.extraNewClients);
  verbatim("cancellation_note", labels.extraCancellations);

  // The one boolean. `true` is the record's own assertion, and this is its
  // least-worded true rendering; `false` and absent print nothing at all.
  if (record.accepts_walk_ins === true) {
    lines.push({ label: labels.extraWalkIns, value: labels.walkInsWelcome, source: "boolean-derived", field: "accepts_walk_ins" });
  }

  if (DIRECT_BILLING_PROFILES.includes(profileKey)) verbatim("direct_billing_note", labels.extraDirectBilling);

  return lines;
}

/* ------------------------------------------------------------------- the checks */

/** Every value a page prints for `field="…"`, escaped as `render.ts` escapes it. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The family rendering check: **the build refuses a page whose family furniture says
 * something the record does not support.** Run from `complianceChecks` on every page.
 *
 * Six rules, each one a way this layer could quietly start lying:
 *
 *   1. the form asks for exactly the fields this family's set carries — no field the
 *      record cannot support, and no field added to the template that the privacy
 *      notice's collection list does not know about;
 *   2. a preferred-days control offers only days a `hours` row states as open, and the
 *      control does not exist at all when no row states one (lead ruling 8);
 *   3. the extras card prints only the record's own facts, and `Walk-ins welcome.` only
 *      where the record carries `accepts_walk_ins: true` (lead ruling 4);
 *   4. Family B's three steps are the three the build derived for this delivery mode,
 *      and Family A carries no such block;
 *   5. every "Request this / Ask about this" link preselects a service the record
 *      actually lists;
 *   6. the pages are the sections this family's order table names, in that order —
 *      a section that quietly drops off a page is a page that changed shape;
 *   7. every form page's **hidden** `request_type` carries this bundle's family. Nothing
 *      checked it: both halves of rule 1 deliberately skip hidden inputs (they are not
 *      questions a visitor answers), so the one value that tells the provider which family
 *      a submission came from could have been anything, or absent.
 */
export function familyRenderingProblems(vars: {
  pages: { file: string; html: string; id?: string }[];
  record: BusinessRecord;
  /** The family this build resolved — the value every form page's `request_type` must carry. */
  family: ConversionFamily;
  fields: { name: string; id: string }[];
  openDays: string[];
  steps: string[];
  extras: ExtraLine[];
  order: Record<string, string[]>;
  pageKeys: Record<string, PageKey>;
}): string[] {
  const { pages, record, family, fields, openDays, steps, extras, order, pageKeys } = vars;
  const problems: string[] = [];
  // Every page that carries the form, not only the first: a per-service contact page
  // (the page a service card links to) is one of them, and it is rendered from the same
  // field set. Checking only `contact.html` would leave N copies of the form unchecked.
  const contacts = pages.filter((p) => p.html.includes('id="contact-form"'));
  const home = pages.find((p) => p.file === "index.html") ?? pages[0]!;
  const recordJson = JSON.stringify(record);

  /* 1. the fields on the form are the family's fields */
  if (contacts.length === 0) {
    problems.push("no rendered page carries the contact form, so the family's field set cannot be checked against what a visitor is asked for.");
  } else {
    const wanted = new Set(fields.map((f) => f.name));
    for (const contact of contacts) {
      const asked = new Set<string>();
      for (const m of contact.html.matchAll(/<(?:input|textarea|select)\b[^>]*\bname="([^"]+)"/g)) {
        const name = m[1]!;
        if (name.startsWith("_") || name === "botcheck" || /type="hidden"/.test(m[0]!)) continue;
        asked.add(name);
      }
      for (const name of asked) {
        if (!wanted.has(name)) {
          problems.push(
            `${contact.file}: the form asks for a "${name}" field that this ${record.conversion_family ?? "derived"} family's set does not carry. ` +
              `The set in src/demo/fields.ts is what the record supports — add the field there (with the record fact behind it) or stop asking for it.`,
          );
        }
      }
      for (const field of fields) {
        if (!asked.has(field.name)) {
          problems.push(
            `${contact.file}: the form is missing the "${field.name}" field this family's set carries, so the page and the privacy notice's collection sentence disagree.`,
          );
        }
      }
      // 7. The hidden half, on the same pages and for the same reason: `render.ts` writes
      // `<input type="hidden" name="request_type" value="{family}">` into the form, and it
      // was the one thing on the page nothing asserted — the field loop above skips hidden
      // inputs on purpose, and the collection list is about questions a visitor answers.
      // A submission that does not say which family's page it came from is a message the
      // provider's notification title describes wrongly.
      const hidden = new Map<string, string>();
      for (const m of contact.html.matchAll(/<input\b[^>]*>/g)) {
        const tag = m[0]!;
        if (!/\btype="hidden"/.test(tag)) continue;
        const name = /\bname="([^"]*)"/.exec(tag)?.[1];
        if (name) hidden.set(name, /\bvalue="([^"]*)"/.exec(tag)?.[1] ?? "");
      }
      const requestType = hidden.get("request_type");
      if (requestType === undefined) {
        problems.push(
          `${contact.file}: the form carries no hidden request_type field, so a submission does not say which family's page it came from. One form serves both families; this hidden value is what tells them apart at the provider.`,
        );
      } else if (requestType !== family) {
        problems.push(
          `${contact.file}: the hidden request_type says "${requestType}" while this bundle is the ${family} family. The value is derived (copy.conversion.family), never typed in — a form whose own claim about itself contradicts the page it sits on is the one field a visitor cannot check.`,
        );
      }
    }
  }

  /* 2. the preferred-days control offers only days the record states as open */
  for (const contact of contacts) {
    const offered: string[] = [];
    for (const m of contact.html.matchAll(/<input[^>]*name="days"[^>]*value="([^"]*)"/g)) offered.push(m[1]!);
    const allowed = new Set(openDays);
    for (const day of offered) {
      if (!allowed.has(day)) {
        problems.push(
          `${contact.file}: the preferred-days control offers "${day}", which no recorded hours row states as open (lead ruling 8). ` +
            `Only days a hours row shows as open may be offered, and the row's own value decides it.`,
        );
      }
    }
    if (openDays.length === 0 && offered.length > 0) {
      problems.push(`${contact.file}: renders a preferred-days control although no hours row states a day as open — the group must not exist, legend included.`);
    }
  }

  /* 3. the extras card prints the record's own facts, and the boolean only when true */
  for (const page of pages) {
    for (const line of extras) {
      if (!page.html.includes(esc(line.value))) continue;
      if (line.source === "verbatim" && !recordJson.includes(line.value)) {
        problems.push(
          `${page.file}: prints the extras line "${line.value}", which the record does not carry. An extras card is the record's own words or nothing (design spec §4).`,
        );
      }
    }
    if (page.html.includes(esc("Walk-ins welcome.")) && record.accepts_walk_ins !== true) {
      problems.push(
        `${page.file}: prints "Walk-ins welcome." while the record does not carry accepts_walk_ins: true. ` +
          `The boolean is the record's own assertion; false and absent print nothing (lead ruling 4).`,
      );
    }
  }

  /* 4. the inquiry steps, on the one page that carries them, and nowhere else */
  for (const page of pages) {
    const hasSteps = page.html.includes('class="steps"');
    if (steps.length === 0) {
      if (hasSteps) {
        problems.push(`${page.file}: carries a "How an inquiry works" block on a page whose family has no such step — the block belongs to the inquiry family only (design spec §3).`);
      }
      continue;
    }
    if (!hasSteps) continue;
    for (const step of steps) {
      if (!page.html.includes(esc(step))) {
        problems.push(`${page.file}: carries the inquiry-steps block without the step this build derived: "${step}". The three lines are data, derived from delivery.mode — never typed into the template.`);
      }
    }
  }
  if (steps.length > 0 && !pages.some((page) => page.html.includes('class="steps"'))) {
    problems.push("no page carries the inquiry-steps block whose three lines this build derived — the home page of an inquiry build carries it (design spec §3).");
  }

  /* 5. every service card is a plain panel with one named action, carrying its own
        recorded service to a page whose form already has that service chosen —
        `serviceCardProblems` below. */

  /* 6. the pages are the sections this family's order table names, in that order */
  for (const page of pages) {
    const key = pageKeys[page.id ?? ""] ?? (page.file.replace(/\.html$/, "") as PageKey);
    const expected = order[key];
    if (!expected) continue;
    let at = -1;
    for (const section of expected) {
      const marker = sectionMarker(section);
      const found = page.html.indexOf(marker);
      if (found < 0) {
        // A block that legitimately renders nothing for this record — the extras card
        // on a record that carries no extras — is dropped rather than left empty, so
        // its absence is not a defect. Every other block in the order must be there.
        if (!OPTIONAL_SECTIONS.has(section)) {
          problems.push(`${page.file}: the ${key} page is missing its "${section}" block, which this family's section order names (src/demo/family-render.ts).`);
        }
        continue;
      }
      if (found < at) {
        problems.push(`${page.file}: the "${section}" block renders before the block this family's order table puts in front of it. The order is data — change SECTION_ORDER, not the template.`);
      }
      at = found;
    }
  }

  return problems;
}

/**
 * A block that renders nothing when the record gives it nothing. Its absence is the
 * honest answer, not a missing section — so the order check skips it rather than
 * reporting a defect the record caused.
 */
const OPTIONAL_SECTIONS = new Set<SectionId>(["extras"]);

/* ------------------------------------------------- the service card, as one action */
/** One card as it is rendered: the `<li>` block that holds it, and the page it is on. */
interface RenderedCard {
  page: string;
  html: string;
}

/**
 * The heading level each page's service cards carry, so a card cannot skip a level:
 * `h3` under the home page's section heading, `h2` on the services page, whose `h1` is
 * the offering itself (the two `servicesBlock` calls in `render.ts`). A page that
 * renders the list without an entry here fails clause 3 rather than skipping it.
 */
const CARD_HEADING: Record<string, string> = { "index.html": "h3", "services.html": "h2" };

/**
 * The `min-height`, in px, that the stylesheet really gives an element carrying these
 * classes: the **last** declaration naming one of its own classes wins, which is how a
 * browser resolves `.button` followed by a modifier such as `.button--small`.
 *
 * Read from the stylesheet rather than asserted about the markup, because the build has
 * no browser to measure: clause 6's job is to prove a rule exists, and the browser audit
 * measures the box at 360px.
 */
function actionMinHeightPx(css: string, classes: string[]): number {
  let px = 0;
  for (const declaration of css.matchAll(/min-height:\s*([\d.]+)(rem|px)/g)) {
    const at = declaration.index ?? 0;
    const open = css.lastIndexOf("{", at);
    if (open < 0) continue;
    const boundary = Math.max(css.lastIndexOf("}", open), css.lastIndexOf("{", open - 1));
    const selector = css.slice(boundary + 1, open);
    const named = [...selector.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]!);
    if (!named.some((className) => classes.includes(className))) continue;
    px = declaration[2] === "rem" ? Number(declaration[1]) * 16 : Number(declaration[1]);
  }
  return px;
}

/**
 * The width, in px, of the focus ring the stylesheet puts on an element carrying these
 * classes: the **last** rule matching `:focus` or `:focus-visible` whose selector names
 * one of the element's own classes sets it, and a rule that says `none` or `0` is a ring
 * that is not there. `null` when no rule names the element at all.
 *
 * Read from the stylesheet, because the build has no browser. The whole card is one
 * target now, so the site's global `:focus-visible` ring is not a statement about the
 * card: the ring has to belong to the card itself for a keyboard visitor to see which of
 * a grid of identical cards they are on.
 */
function focusRingPx(css: string, classes: string[]): number | null {
  let px: number | null = null;
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1]!;
    const body = match[2]!;
    if (!/:focus(?:-visible)?\b/.test(selector)) continue;
    const named = selector.split(",").some((part) => classes.some((name) => new RegExp(`\\.${name}\\b`).test(part)));
    if (!named) continue;
    const outline = /outline(?:-width)?\s*:\s*([^;]+)/i.exec(body)?.[1] ?? "";
    const width = /(\d+(?:\.\d+)?)\s*px/.exec(outline);
    if (width) px = Number(width[1]);
    else if (/(^|[^a-z])(?:none|0)\b/i.test(outline)) px = 0;
  }
  return px;
}

/**
 * **A service card is one link covering the whole card, and nothing interactive is
 * nested inside it** (owner text, 6 October 2026: "Remove the nested service action
 * button. Make each entire service card one accessible keyboard/touch-safe interactive
 * target, with no nested interactive elements, navigating to the existing per-service
 * contact page where that service is already selected; preserve the truthful
 * no-JavaScript behavior and the nine-page structure"). Run from `complianceChecks` on
 * every page.
 *
 * The owner's words: a visitor who taps "Hot shave" must land on the contact page with
 * "Hot shave" already chosen, not a blank form. The build's answer is a real page per
 * recorded service (`contact-hot-shave.html`), whose own select carries that service's
 * option with `selected` in the HTML — so the choice survives JavaScript being off, a
 * static host that ignores query strings, and a browser that never runs our script.
 *
 * Nine clauses, each one a way this could stop being true:
 *
 *   1. **the card is exactly one link, and nothing interactive is nested inside it** —
 *      the `<a>` carries the heading, the note and the action line, and no second link,
 *      no `<button>`, `<input>`, `<select>`, `<textarea>`, `<details>`, `<summary>`,
 *      `<iframe>`, `<object>` or `<embed>` and no `tabindex` appears inside it. This is
 *      the clause the owner asked for in one sentence: one target, one tab stop;
 *   2. **nothing on the card sits outside the link** — the link is the whole card, so a
 *      heading or a note left beside it is a dead zone a thumb can land on with nothing
 *      happening;
 *   3. **the heading is a recorded service, escaped exactly, at the level its page
 *      uses** — the card carries the record's own name for the thing, and the heading is
 *      inside the link like everything else;
 *   4. **the card carries the family's own label for that same recorded name as its
 *      visible action line** ("Request Hot shave" / "Ask about Hot shave"), composed by
 *      `serviceActionLabel` from `copy.ts`/`family.ts`, so the words on the card and the
 *      heading cannot disagree — and four identical "Request this" lines could not pass
 *      as a list of links. The words stay; the control that used to carry them is gone;
 *   5. **the destination is the page built for that service** — `contact-<slug>.html`,
 *      derived from the recorded name and present in this bundle, carrying `#form`, and
 *      its service select already showing exactly one `selected` option equal to the
 *      card's heading. This is the rule the owner asked for, and it is enforceable only
 *      while the pages are pre-rendered;
 *   6. **the whole card is at least 44px**, read from the stylesheet the bundle ships:
 *      some rule naming one of the link's own classes must set a `min-height` of 44px or
 *      more. The stylesheet is the honest half — the build cannot measure a browser box;
 *   7. **the stylesheet gives the card itself a focus ring** of at least 2px, on a rule
 *      naming one of the card's own classes — the whole card is the tab stop, so the ring
 *      has to be drawn on the card;
 *   8. **no card carries a booking word or an inline event handler** — the card's own
 *      markup goes through the family honesty guard, and an `onclick` in a card is a card
 *      that does nothing with JavaScript off, in a bundle whose only script is `site.js`;
 *   9. **the registry holds** — every recorded service is one card on each page that
 *      lists them, every per-service page is some card's destination, and a page that
 *      starts rendering the list declares its cards' heading level.
 */
export function serviceCardProblems(vars: {
  pages: { file: string; html: string }[];
  record: BusinessRecord;
  family: ConversionFamily;
  /** `servicePageFile` from `render.ts`: the file a recorded service's page is. */
  pageForService: (service: string) => string;
  /** The stylesheet this bundle ships, for clause 6. Absent means clause 6 is skipped. */
  css?: string;
}): string[] {
  const { pages, record, family, pageForService, css } = vars;
  const problems: string[] = [];
  const visible = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  // The recorded service names, escaped exactly as the page writes them, so the
  // comparison is between what the record says and what a visitor reads.
  const recorded = new Map<string, string>();
  for (const service of Array.isArray(record.services) ? record.services : []) {
    const name = typeof service === "string" ? service.trim() : String((service as { name?: string })?.name ?? "").trim();
    if (name) recorded.set(esc(name), name);
  }
  const cards: RenderedCard[] = [];
  for (const page of pages) {
    // The service list itself: `.hours` is a `dl.card` too, and it is not an action.
    const list = /<ul class="services">([\s\S]*?)<\/ul>/.exec(page.html);
    if (!list) continue;
    if (!CARD_HEADING[page.file]) {
      problems.push(
        `${page.file}: renders the service list at a heading level this check does not know. The level a card's heading takes is derived from the page's own structure (${Object.entries(CARD_HEADING).map(([file, tag]) => `${file} → ${tag}`).join(", ")}), so a page that starts rendering the list must declare its level here — otherwise its cards are checked for everything except their heading level.`,
      );
    }
    // The list items, whatever they are called: a card's `<li>` is now just the grid
    // cell — the card itself is the link inside it — so the split cannot key off a class
    // the card no longer wears.
    for (const chunk of list[1]!.split(/<li\b[^>]*>/).slice(1)) {
      const end = chunk.indexOf("</li>");
      cards.push({ page: page.file, html: end >= 0 ? chunk.slice(0, end) : chunk });
    }
  }
  const destinations = new Set<string>();
  for (const card of cards) {
    /* 1. the whole card is one link, and nothing interactive is nested inside it */
    const links = card.html.match(/<a\b/gi) ?? [];
    const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(card.html);
    if (!anchor) {
      problems.push(
        `${card.page}: a service card carries ${links.length} links, not one. The owner's words, 6 October 2026: make each entire service card one interactive target. A card with no link does nothing when a thumb lands on it.`,
      );
      continue;
    }
    const [, attrs = "", inner = ""] = anchor;
    if (links.length !== 1) {
      problems.push(
        `${card.page}: a service card carries ${links.length} links, not one. The card and its link are the same thing — one thing to tap, one stop for a keyboard — so a second link on the card is a second promise about what happens next.`,
      );
    }
    // A nested interactive element — anything a browser puts in the tab order or that
    // does something on its own. The `<a>` that IS the card is the one exception, and it
    // is the anchor we are already inside: everything the regex finds here is a second
    // control, which is exactly what the owner asked to have removed.
    const nestedTags = [
      ...new Set(
        (inner.match(/<\/?(a|button|input|select|textarea|details|summary|iframe|object|embed)\b/gi) ?? []).map((tag) =>
          tag.replace(/[</]/g, "").toLowerCase(),
        ),
      ),
    ];
    if (nestedTags.length > 0) {
      problems.push(
        `${card.page}: a service card nests an interactive element (<${nestedTags.join(">, <")}>) inside its own link. The owner's words, 6 October 2026: "no nested interactive elements". The card is one target — a nested link or button is a second tab stop inside a single tap target, a nested control is a second promise about what happens next, and a real <button> cannot navigate at all with JavaScript off.`,
      );
    }
    if (/\btabindex\s*=/i.test(inner)) {
      problems.push(
        `${card.page}: a service card puts a tabindex inside its own link, so something inside one target takes a second stop in the tab order. The card is the tab stop; nothing inside it may be one.`,
      );
    }
    /* 2. the link is the whole card: nothing of the card is left outside it */
    const outside = card.html.replace(anchor[0], "").trim();
    if (outside !== "") {
      problems.push(
        `${card.page}: the card carries content outside its own link (${outside.slice(0, 80)}). The link is the whole card — a heading or a note left beside it is a dead zone a thumb can land on with nothing happening, which is the half of the card the owner's "entire card" rules out.`,
      );
    }
    const handlers = [
      ...new Set(
        [...card.html.matchAll(/<[a-z][^>]*>/gi)].flatMap((tag) =>
          [...tag[0]!.matchAll(/\son([a-z]+)\s*=/gi)].map((m) => `on${m[1]!.toLowerCase()}`),
        ),
      ),
    ];
    if (handlers.length > 0) {
      problems.push(
        `${card.page}: a service card carries an inline event handler (${handlers.join(", ")}). The bundle's only script is site.js and every page works unchanged with JavaScript off — a card that needs an ${handlers[0]} does nothing for a visitor whose browser does not run it, and nothing in the page says so.`,
      );
    }
    /* 3. the heading is inside the link — the whole card is the tap target — and is the
          record's own name for the service at the level its page uses */
    const headingMatch = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/i.exec(card.html);
    const headingTag = headingMatch?.[1]?.toLowerCase() ?? "";
    const heading = headingMatch?.[2]?.trim() ?? "";
    if (headingTag && !new RegExp(`<${headingTag}\\b`, "i").test(inner)) {
      problems.push(
        `${card.page}: the card's heading (<${headingTag}>) sits outside its link. The link is the whole card, so the heading is part of what a thumb taps and part of what a screen reader reads out — a heading beside the link is a dead zone and a link whose name says nothing about which service it opens.`,
      );
    }
    if (!heading) {
      problems.push(
        `${card.page}: a service card carries no heading naming the service it is for, so a visitor cannot tell which service the action underneath asks about.`,
      );
    } else if (!recorded.has(heading)) {
      problems.push(
        `${card.page}: a service card names "${heading}", which the record does not list as a service. The card's name for the thing is the record's own — a service card never invents a name, and its destination selects the recorded one.`,
      );
    }
    const wantTag = CARD_HEADING[card.page];
    if (wantTag && headingTag && headingTag !== wantTag) {
      problems.push(
        `${card.page}: a service card's heading is a <${headingTag}>; this page's service names are <${wantTag}>. A card heading at the wrong level is a page whose headings skip or repeat a level for a screen reader.`,
      );
    }
    /* 4. the card's visible action line names that same service, in the family's own
          words — the words the owner's rejected button used to carry, kept as text */
    const name = recorded.get(heading);
    const label = name ? serviceActionLabel(family, name) : "";
    const actionEl = /<p class="service-action"[^>]*>([\s\S]*?)<\/p>/i.exec(inner);
    if (!actionEl) {
      problems.push(
        `${card.page}: the card's link carries no action line ("Request <service>" / "Ask about <service>"). The whole card is the target, so the words inside it are the only thing that says what tapping it does — a card with a heading and a note and no action is a target whose promise a visitor has to guess.`,
      );
    } else if (name && actionEl[1]!.trim() !== esc(label)) {
      problems.push(
        `${card.page}: the card's action line reads "${visible(actionEl[1]!)}" while the ${family} family's label for "${name}" is "${label}". The line is named after the service the card opens ("${
          family === "appointment" ? "Request <service>" : "Ask about <service>"
        }"), and the words come from copy.ts/family.ts — so four identical labels cannot stand in for a list of services.`,
      );
    }
    if (/\baria-label(?:ledby)?\s*=/.test(attrs)) {
      problems.push(
        `${card.page}: the card's link carries an aria-label, so the name a screen reader announces and the words a visitor reads can drift apart. The visible text — the heading, the note and the action line — is the accessible name.`,
      );
    }
    /* 5. the destination: the page built for that service, with `#form` */
    const href = /\bhref="([^"]*)"/.exec(attrs)?.[1]?.trim() ?? "";
    const dest = href.split("#")[0]!.trim();
    const fragment = href.includes("#") ? href.slice(href.indexOf("#")) : "";
    const wantFile = name ? pageForService(name) : "";
    const target = pages.find((p) => p.file === dest);
    if (!target) {
      problems.push(
        `${card.page}: a service card links to "${dest}", which this bundle does not contain. Every link on a page is a file beside it — the published host serves flat files and resolves no directory index.`,
      );
      continue;
    }
    destinations.add(dest);
    if (wantFile && dest !== wantFile) {
      problems.push(
        `${card.page}: the card for "${name}" links to ${dest}; the page built for that recorded service is ${wantFile}. The destination is derived from the service's own recorded name, never typed — a page that merely happens to have the option selected is not the page the card promises.`,
      );
    }
    if (!target.html.includes('id="contact-form"')) {
      problems.push(`${card.page}: a service card links to ${dest}, which carries no form — the action would ask a visitor for nothing.`);
    }
    if (fragment !== "#form") {
      problems.push(
        `${card.page}: a service card links to ${dest} with "${fragment || "no fragment"}", not "#form", so the tap does not land on the form the card is asking the visitor to fill in.`,
      );
    }
    const select = /<select[^>]*\bname="service"[\s\S]*?<\/select>/.exec(target.html)?.[0];
    if (!select) {
      problems.push(
        `${card.page}: the page a service card links to (${dest}) carries no service select, so the service the card carried is not chosen there — the visitor lands on a form that asks nothing about the thing they tapped.`,
      );
    } else {
      const chosen = [...select.matchAll(/<option value="([^"]*)"\s+selected>/g)].map((m) => m[1]!);
      if (chosen.length !== 1) {
        problems.push(
          `${dest}: its service select carries ${chosen.length} options marked selected, not one. A page built for one service has exactly one answer already chosen, and the plain contact page's own default is one of them.`,
        );
      } else if (heading && chosen[0] !== heading) {
        problems.push(
          `${dest}: the service select has "${chosen[0]}" chosen while the card that links here carries "${heading}". A visitor who taps a card must land on a form already set to the service they tapped — the destination page is written from the same recorded name.`,
        );
      }
    }
    /* 6. the whole card is a target of at least 44px, per the stylesheet the bundle
          ships — and 7. the card itself, not the site at large, is given a focus ring */
    const classes = (/\bclass="([^"]*)"/.exec(attrs)?.[1] ?? "").split(/\s+/).filter(Boolean);
    const ring = focusRingPx(css ?? "", classes);
    if (css) {
      const minHeight = actionMinHeightPx(css, classes);
      if (minHeight < 44) {
        problems.push(
          `${card.page}: the whole-card target (class="${classes.join(" ")}") is ${minHeight === 0 ? "given no min-height by any rule naming its own classes" : `at most ${minHeight}px tall`} in the stylesheet this bundle ships; the owner asked for at least 44px (2.75rem). The card is the target now, so the class it wears has to declare the size — a card whose target is a bare text line is a 24px touch target.`,
        );
      }
      if (ring === null) {
        problems.push(
          `${card.page}: no rule naming the card's own classes (class="${classes.join(" ")}") matches :focus or :focus-visible. The whole card is the tab stop, so the ring the site draws for a link in running text says nothing about the card: a keyboard visitor moving through a grid of identical cards cannot see which one has focus.`,
        );
      } else if (ring < 2) {
        problems.push(
          `${card.page}: the focus ring the stylesheet gives the card (class="${classes.join(" ")}") is ${ring}px, which is not a ring a visitor can see. The owner asked for a visible keyboard focus state on the card that is now the target.`,
        );
      }
    }
    // The family honesty guard, on the card's own markup: a card may not say what its
    // family may not say, wherever on the page it sits.
    problems.push(
      ...familyHonestyProblems({
        pages: [{ file: `${card.page} (the service card "${visible(inner).slice(0, 60)}")`, html: card.html }],
        record,
        family,
      }),
    );
  }
  // 5. every per-service page is the destination of some card.
  for (const page of pages) {
    if (!/contact-.+\.html$/.test(page.file)) continue;
    if (!destinations.has(page.file)) {
      problems.push(
        `${page.file}: nothing links to this page. A contact page built for one recorded service exists only as a service card's destination — a visitor cannot reach it from the site, and the page contract does not list it.`,
      );
    }
  }
  // A record with services must show them, each with one card, on both pages that
  // render the list: a card that silently drops off a page is a service a visitor
  // cannot ask about.
  if (recorded.size > 0) {
    for (const file of ["index.html", "services.html"]) {
      const page = pages.find((p) => p.file === file);
      if (!page || !page.html.includes('id="services"')) continue;
      const onPage = cards.filter((card) => card.page === file);
      for (const [escaped, name] of recorded) {
        const matching = onPage.filter((card) => /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/.exec(card.html)?.[1]?.trim() === escaped);
        if (matching.length !== 1) {
          problems.push(
            `${file}: the recorded service "${name}" has ${matching.length} service cards, not one. Every recorded service is one card on each page that lists them, so a visitor can ask about it from wherever they are reading.`,
          );
        }
      }
    }
  }
  return problems;
}

/** The class or id that must be present, in order, for each block of a page. */
function sectionMarker(section: SectionId): string {
  switch (section) {
    case "head":
      return 'class="page-head"';
    case "hero":
      return 'class="hero';
    case "about-short":
    case "about-full":
      return 'id="about"';
    case "services":
      // The section's id, not the list's class: a record with no services recorded
      // renders no `<ul class="services">` at all, and that is not a missing section.
      return 'id="services"';
    case "how":
      return 'id="how"';
    case "hours":
      return 'id="hours"';
    case "extras":
      return 'class="extras-item"';
    case "form":
      return 'id="form"';
    case "privacy":
      return 'privacy-notice';
    case "cta":
      return 'id="contact"';
  }
}
