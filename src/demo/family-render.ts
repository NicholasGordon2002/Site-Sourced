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

/**
 * The notification email's title, **stated here rather than asked of `forms.ts`** — and that
 * is the whole point of the clause that reads it back off the page.
 *
 * `forms.ts` (`notificationSubject`) writes the title the form carries. If this check called
 * that same function for its expectation, the two would agree even when the derivation is
 * wrong: doctoring `notificationSubject` to drop the demonstration suffix moved the page and
 * the expectation together, and the build passed — the check proved nothing (measured
 * 2026-10-09). These two literals are the page's contract; the function produces it. A
 * reword moves both in one change, and that friction is deliberate.
 */
export const NOTIFICATION_TITLE_FAMILY_TERM: Record<ConversionFamily, string> = {
  appointment: "Appointment request",
  inquiry: "Quote request",
};
/**
 * The demonstration phase names us: nobody at the business has seen the message, so the
 * notification that reaches us may not read as one they already have. A delivered bundle
 * carries the plain title, because there the message really does reach the business.
 */
export const NOTIFICATION_TITLE_DEMO_SUFFIX = " (Site Sourced demo)";
/** The title those two facts compose, for one business. */
function notificationTitle(business: string, family: ConversionFamily, phase: FormDeliveryMode): string {
  return `${NOTIFICATION_TITLE_FAMILY_TERM[family]} from ${business}${phase === "demo" ? NOTIFICATION_TITLE_DEMO_SUFFIX : ""}`;
}
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
  /**
   * The provider's own key for the notification email's title (`FormProvider.subjectField`):
   * `_email.template.title` on Formspark, `_subject` on FormSubmit. Passed in rather than
   * assumed, because a title under the wrong key is a title the provider never reads.
   */
  subjectField: string;
  /** The phase this bundle is in — the other half of the title (`delivery.mode`). */
  phase: FormDeliveryMode;
  fields: { name: string; id: string }[];
  openDays: string[];
  steps: string[];
  extras: ExtraLine[];
  order: Record<string, string[]>;
  pageKeys: Record<string, PageKey>;
}): string[] {
  const { pages, record, family, subjectField, phase, fields, openDays, steps, extras, order, pageKeys } = vars;
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
      // 8. The notification email's title, under the provider's own key — the same hidden
      // half as `request_type`, and the reason it is checked on the rendered page: the value
      // is written by the build *between* resolving the form and rendering it
      // (`build.ts` `resolveBuildParts`), because it needs the family and the phase, and
      // `resolveForm` knows neither. A page rendered from a bare `resolveForm` therefore
      // carries no title at all, and a check that ran against such a page would either fail
      // the harness or — worse — be written to tolerate the absence and prove nothing.
      // The expectation is composed here from the contract's own words, never by calling
      // `notificationSubject` — a check that asks the producer what it meant agrees with a
      // broken producer (see `NOTIFICATION_TITLE_FAMILY_TERM`).
      const printedTitle = hidden.get(esc(subjectField));
      const expectedTitle = esc(notificationTitle(record.name, family, phase));
      if (printedTitle === undefined) {
        problems.push(
          `${contact.file}: the form carries no hidden "${subjectField}" field, so the provider has no title for the notification it sends and a message from this page arrives looking like any other email. The title is set by the build once the family and the phase are known (build.ts \`resolveBuildParts\`); a page rendered from a bare \`resolveForm\` never has it.`,
        );
      } else if (printedTitle !== expectedTitle) {
        problems.push(
          `${contact.file}: the hidden "${subjectField}" says "${printedTitle}" while this bundle's own facts derive "${expectedTitle}" (${record.name}, the ${family} family, the ${phase} phase). The title is derived, never typed in — a notification announcing a family or a phase this page is not is a claim nobody who receives it can check against the form.`,
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
function actionMinHeightPx(css: string, classes: string[]): number | null {
  let px: number | null = null;
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
 * What the stylesheet the bundle ships says about the whole-card target, read **the same
 * way `serviceCardProblems` reads it** (`actionMinHeightPx`, `focusRingPx`) so the
 * manifest and the gate cannot describe two different bundles. `min_height_px` is `null`
 * when no rule naming one of the card's own classes declares a `min-height` at all;
 * `focus_ring_px` is `null` when no rule of the card's own matches `:focus` or
 * `:focus-visible`.
 */
export function serviceCardMeasure(css: string, classes: string[]): {
  class: string;
  min_height_px: number | null;
  focus_ring_px: number | null;
} {
  return {
    class: classes.join(" "),
    min_height_px: actionMinHeightPx(css, classes),
    focus_ring_px: focusRingPx(css, classes),
  };
}

/**
 * **Which of the two card shapes a build renders** — the one place both the renderer and
 * the gate name them, so a page cannot be checked for a shape it does not render.
 *
 *   - `whole-card` (the default, and every published build): the `<a>` *is* the card —
 *     surface, heading, note and action line inside one link, nothing interactive nested
 *     inside it (owner text, 6 Oct 2026);
 *   - `nested-cta` (owner direction, 10 Oct 2026): the card is an inert container — its
 *     body is text — and its **one** action is the anchor at its foot, labelled by the
 *     family's own composed label. An interactive element inside `<a>` is invalid HTML, so
 *     this shape cannot also be one wrapping link: the two shapes are alternatives, never a
 *     card wearing half of each.
 *
 * `serviceCardProblems` reads the shape the build says it rendered (it is passed in, never
 * guessed from the markup): a check that inferred the shape from the page would accept a
 * card whose renderer changed under it.
 */
export type ServiceCardShape = "whole-card" | "nested-cta";

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
 *
 * **The `nested-cta` shape reads the same card the other way round** (owner direction, 10
 * Oct 2026: "each service card gets its own CTA button nested at the bottom of the card,
 * rather than the whole card being the tap target"). Clause 1 becomes: the card carries
 * **exactly one** interactive element and it is the anchor at the card's foot — no second
 * control, no `<button>` (which cannot navigate with JavaScript off), no `tabindex`;
 * clause 2 inverts — the card's body (the heading and the note) is inert text **outside**
 * the anchor, so a thumb landing on the body lands on nothing and the card is not one
 * wrapping link; clause 4 moves onto the anchor — the CTA's own visible text is exactly
 * the family's composed label, so a typed "Book Now" is refused by the same clause that
 * refuses it on the bar; and clauses 6–7 measure the **anchor's** classes, because the
 * CTA is the target now, not the card. The shape is passed in (`cardShape`), never
 * inferred: a whole-card card that grows a button must fail, and a nested-CTA card with
 * no CTA, two controls, or a label the family did not compose must fail.
 */
export function serviceCardProblems(vars: {
  pages: { file: string; html: string }[];
  record: BusinessRecord;
  family: ConversionFamily;
  /** `servicePageFile` from `render.ts`: the file a recorded service's page is. */
  pageForService: (service: string) => string;
  /** The stylesheet this bundle ships, for clause 6. Absent means clause 6 is skipped. */
  css?: string;
  /**
   * Which shape this build renders the cards in (`ServiceCardShape`). Absent means
   * `whole-card` — the shape every published build renders, and the one this check
   * belonged to before the 10 Oct direction. A build that renders the other shape says
   * so, or its cards are read against the wrong clauses.
   */
  cardShape?: ServiceCardShape;
}): string[] {
  const { pages, record, family, pageForService, css } = vars;
  const cardShape: ServiceCardShape = vars.cardShape ?? "whole-card";
  const problems: string[] = [];
  const visible = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  // The recorded service names, escaped exactly as the page writes them, so the
  // comparison is between what the record says and what a visitor reads.
  const recorded = new Map<string, string>();
  /** The same services' recorded notes, escaped, so the nested-CTA clause can read them
   *  off the card's own body: the card keeps the record's note wherever the action sits. */
  const notes = new Map<string, string>();
  for (const service of Array.isArray(record.services) ? record.services : []) {
    const name = typeof service === "string" ? service.trim() : String((service as { name?: string })?.name ?? "").trim();
    if (!name) continue;
    recorded.set(esc(name), name);
    const note = typeof service === "string" ? "" : String((service as { note?: string })?.note ?? "").trim();
    if (note) notes.set(esc(name), esc(note));
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
    /* 1. the card carries exactly ONE interactive element, and it is the right one for the
          shape this build renders. Whole-card: that element is an `<a>` that IS the card.
          Nested-CTA: it is the `<a>` CTA at the card's foot, and the card itself is not a
          link — an interactive element nested inside `<a>` is invalid HTML, so a card
          cannot be one wrapping link and carry a button at the same time. */
    const links = card.html.match(/<a\b/gi) ?? [];
    const controls = card.html.match(/<\/?(a|button|input|select|textarea|details|summary|iframe|object|embed)\b/gi) ?? [];
    const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(card.html);
    if (!anchor) {
      problems.push(
        `${card.page}: a service card carries ${links.length} links, not one. ${
          cardShape === "whole-card"
            ? `The owner's words, 6 October 2026: make each entire service card one interactive target. A card with no link does nothing when a thumb lands on it.`
            : `The nested-CTA shape gives each card exactly one action, an anchor styled as a button at the card's foot. A card with no CTA is a card a visitor cannot act on, and one that carries inert text where the CTA belongs is a button a visitor can see and not press.`
        }`,
      );
      continue;
    }
    const [, attrs = "", inner = ""] = anchor;
    if (links.length !== 1) {
      problems.push(
        `${card.page}: a service card carries ${links.length} links, not one. ${
          cardShape === "whole-card"
            ? `The card and its link are the same thing — one thing to tap, one stop for a keyboard — so a second link on the card is a second promise about what happens next.`
            : `The nested-CTA shape gives the card one action and no other, so the card's own CTA is the only link on it: a second link is a second place the card asks a visitor to go, beside the button that says where it goes.`
        }`,
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
    /* 2. where the action sits. Whole-card: the link is the whole card, and nothing of the
          card is left outside it. Nested-CTA: the card is an inert container — the heading
          and the note are outside the CTA — and the CTA is the last thing on the card, so
          the card's foot is where the action is and nowhere else. */
    if (cardShape === "whole-card") {
      const outside = card.html.replace(anchor[0], "").trim();
      if (outside !== "") {
        problems.push(
          `${card.page}: the card carries content outside its own link (${outside.slice(0, 80)}). The link is the whole card — a heading or a note left beside it is a dead zone a thumb can land on with nothing happening, which is the half of the card the owner's "entire card" rules out.`,
        );
      }
    } else {
      const others = [
        ...new Set(controls.filter((tag) => !/^<\/?a\b/i.test(tag)).map((tag) => tag.replace(/[</>]/g, "").toLowerCase())),
      ];
      if (others.length > 0) {
        problems.push(
          `${card.page}: a service card with a CTA at its foot also carries <${others.join(">, <")}>. The nested-CTA shape gives the card exactly one control — the CTA — and nothing else a browser puts in the tab order. A second control is a second promise about what happens next, and a <button> cannot navigate at all with JavaScript off.`,
        );
      }
      const afterCta = card.html
        .slice(card.html.indexOf(anchor[0]) + anchor[0].length)
        .replace(/<\/?(?:div|li|p|span|ul|ol|section)\b[^>]*>/gi, "")
        .trim();
      if (afterCta !== "") {
        problems.push(
          `${card.page}: the CTA is not the card's foot — "${visible(afterCta).slice(0, 60)}" follows it. The nested-CTA shape puts the card's one action at the bottom of the card, under the heading and the note: content below the button is content the card's action does not cover.`,
        );
      }
      const body = card.html.replace(anchor[0], "");
      if (body.replace(/<[^>]*>/g, "").trim() === "") {
        problems.push(
          `${card.page}: the card the CTA sits in carries no body of its own — nothing but the CTA. A card that is only its own button is the whole card as the tap target again, with the record's own name and note dropped from it, which is the shape this variant exists to change.`,
        );
      }
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
    /* 3. the heading is the record's own name for the service at the level its page uses,
          and it sits where this shape puts it: inside the link when the link is the whole
          card, outside the CTA when the card is a container. */
    const headingMatch = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/i.exec(card.html);
    const headingTag = headingMatch?.[1]?.toLowerCase() ?? "";
    const heading = headingMatch?.[2]?.trim() ?? "";
    const headingInsideLink = headingTag ? new RegExp(`<${headingTag}\\b`, "i").test(inner) : false;
    if (cardShape === "whole-card") {
      if (headingTag && !headingInsideLink) {
        problems.push(
          `${card.page}: the card's heading (<${headingTag}>) sits outside its link. The link is the whole card, so the heading is part of what a thumb taps and part of what a screen reader reads out — a heading beside the link is a dead zone and a link whose name says nothing about which service it opens.`,
        );
      }
    } else if (headingInsideLink) {
      problems.push(
        `${card.page}: the card's heading (<${headingTag}>) sits inside the CTA. In the nested-CTA shape the card is not a link: the heading and the note are the card's inert body, and the CTA is one control at the card's foot. A heading inside the anchor makes the anchor wrap the card again — the shape this variant replaces — and an interactive element inside a link is invalid HTML.`,
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
    /* 4. the words on the card's action are the family's own, composed from the recorded
          name — the action line inside the whole-card link, or the CTA's own visible text
          in the nested-CTA shape, where the CTA is both the label a visitor reads and the
          name a screen reader announces. */
    const name = recorded.get(heading);
    const label = name ? serviceActionLabel(family, name) : "";
    if (cardShape === "whole-card") {
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
    } else {
      const ctaText = visible(inner);
      if (name && inner.trim() !== esc(label)) {
        problems.push(
          `${card.page}: the card's CTA reads "${ctaText}" while the ${family} family's label for "${name}" is "${label}". The nested-CTA shape carries the family's own words on the button itself — "${
            family === "appointment" ? "Request <service>" : "Ask about <service>"
          }", composed by copy.ts/family.ts — so a typed "Book Now", a price, a duration or a generic "Request this" is exactly what this clause refuses, and the button carries no markup of its own.`,
        );
      }
      const note = notes.get(heading);
      const body = card.html.replace(anchor[0], "");
      if (note && !body.includes(note)) {
        problems.push(
          `${card.page}: the card for "${name}" no longer carries the record's own note in its body ("${note}"). The nested-CTA shape changes where the action sits and nothing else: the record's name and note stay on the card as text, and a card that drops its note is a card a visitor has to open to find out what the service is.`,
        );
      }
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
    /* 6. the card's target — the whole card, or the CTA at its foot — is at least 44px,
          per the stylesheet the bundle ships — and 7. that target, not the site at large,
          is given a focus ring. `classes` are the classes the anchor wears: the card's own
          in the whole-card shape, the CTA's in the nested-CTA shape, because that is the
          element the shape makes the target. */
    const classes = (/\bclass="([^"]*)"/.exec(attrs)?.[1] ?? "").split(/\s+/).filter(Boolean);
    const ring = focusRingPx(css ?? "", classes);
    /* One name per message, because the whole-card shape's four messages are the ones the
       6 Oct check already carried and a test quotes: "the whole-card target" where the
       master text says that, "the card's" / "the card" where it says those. The nested
       shape's messages say "the CTA" — the element the shape makes the target. */
    const targetName = cardShape === "whole-card" ? "the whole-card target" : "the card's CTA (the card's only control)";
    const targetPossessive = cardShape === "whole-card" ? "the card's" : "the CTA's";
    const targetShort = cardShape === "whole-card" ? "the card" : "the CTA";
    const targetWhy =
      cardShape === "whole-card"
        ? "The card is the target now, so the class it wears has to declare the size — a card whose target is a bare text line is a 24px touch target."
        : "The CTA is the target now, so the class it wears has to declare the size — a button a thumb has to aim at is not the thumb-friendly control the owner asked for.";
    if (css) {
      const minHeight = actionMinHeightPx(css, classes);
      if (minHeight === null || minHeight < 44) {
        problems.push(
          `${card.page}: ${targetName} (class="${classes.join(" ")}") is ${minHeight === null ? "given no min-height by any rule naming its own classes" : `at most ${minHeight}px tall`} in the stylesheet this bundle ships; the owner asked for at least 44px (2.75rem). ${targetWhy}`,
        );
      }
      if (ring === null) {
        problems.push(
          `${card.page}: no rule naming ${targetPossessive} own classes (class="${classes.join(" ")}") matches :focus or :focus-visible. ${
            cardShape === "whole-card"
              ? "The whole card is the tab stop, so the ring the site draws for a link in running text says nothing about the card: a keyboard visitor moving through a grid of identical cards cannot see which one has focus."
              : "The CTA is the tab stop, so the ring the site draws for a link in running text says nothing about it: a keyboard visitor moving through a grid of identical buttons cannot see which one has focus."
          }`,
        );
      } else if (ring < 2) {
        problems.push(
          `${card.page}: the focus ring the stylesheet gives ${targetShort} (class="${classes.join(" ")}") is ${ring}px, which is not a ring a visitor can see. The owner asked for a visible keyboard focus state on ${cardShape === "whole-card" ? "the card that is now the target" : "the CTA that is now the target"}.`,
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
