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
 *   the service-card action            "Request this" (A) / "Ask about this" (B) — a
 *                                     quiet link that preselects the recorded service
 *                                     on the contact form. Never "Get a quote": an
 *                                     inquiry page may not promise a price.
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
import { familyHonestyProblems, type ConversionFamily } from "./family.ts";

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
 *      a section that quietly drops off a page is a page that changed shape.
 */
export function familyRenderingProblems(vars: {
  pages: { file: string; html: string; id?: string }[];
  record: BusinessRecord;
  fields: { name: string; id: string }[];
  openDays: string[];
  steps: string[];
  extras: ExtraLine[];
  order: Record<string, string[]>;
  pageKeys: Record<string, PageKey>;
}): string[] {
  const { pages, record, fields, openDays, steps, extras, order, pageKeys } = vars;
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

  /* 5. every service card is one link, carrying its own recorded service to a page
        whose form already has that service chosen — `serviceCardProblems` below. */

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

/** One card as it is rendered: the `<li class="card">` block, and the page it is on. */
interface RenderedCard {
  page: string;
  html: string;
}

/**
 * **A service card is one link, one action, and the action carries that service**
 * (owner revision #4, 6 Oct 2026). Run from `complianceChecks` on every page.
 *
 * The owner's words: a visitor who taps "Hot shave" must land on the contact page with
 * "Hot shave" already chosen, not a blank form. The build's answer is a real page per
 * recorded service (`contact-hot-shave.html`), whose own select carries that service's
 * option with `selected` in the HTML — so the choice survives JavaScript being off, a
 * static host that ignores query strings, and a browser that never runs our script.
 *
 * Six refusals, each one a way this could stop being true:
 *
 *   1. **exactly one link per card** — the whole card is the target, and a card with a
 *      second link (or an action that is still a link inside a link) is two actions;
 *   2. **the card's heading is a recorded service** — the card carries the record's own
 *      name for the thing, never a category word or a rewritten one;
 *   3. **the destination is a page this bundle contains** — a card pointing at a page
 *      nobody built is a 404 on the published host;
 *   4. **the destination really has that service chosen** — exactly one `selected`
 *      option in its service select, and it is the card's own service. This is the rule
 *      the owner asked for: the page a tap lands on is already the answer;
 *   5. **every service page is reachable** — a per-service page nothing links to is a
 *      page a visitor can only reach by guessing a URL;
 *   6. **no card carries a booking word or a second action** — the card's own markup is
 *      run through the family honesty guard, the same one that binds the rest of the
 *      page, so "Book now" on a card fails here as it would anywhere else.
 */
export function serviceCardProblems(vars: {
  pages: { file: string; html: string }[];
  record: BusinessRecord;
  family: ConversionFamily;
}): string[] {
  const { pages, record, family } = vars;
  const problems: string[] = [];
  // The recorded service names, escaped exactly as the page writes them, so the
  // comparison is between what the record says and what a visitor reads.
  const recorded = new Map<string, string>();
  for (const service of Array.isArray(record.services) ? record.services : []) {
    const name = typeof service === "string" ? service.trim() : String((service as { name?: string })?.name ?? "").trim();
    if (name) recorded.set(esc(name), name);
  }

  const cards: RenderedCard[] = [];
  for (const page of pages) {
    // Only the service list's items: `.hours` is a card too (`dl.hours.card`), and it
    // is not an action.
    for (const chunk of page.html.split('<li class="card">').slice(1)) {
      const end = chunk.indexOf("</li>");
      const html = end >= 0 ? chunk.slice(0, end) : chunk;
      if (!html.includes("service-card")) continue;
      cards.push({ page: page.file, html });
    }
  }

  const destinations = new Set<string>();
  for (const card of cards) {
    const anchor = /<a\b[^>]*class="service-card"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(card.html);
    if (!anchor) {
      problems.push(
        `${card.page}: a service card carries no single link with class="service-card". The whole card is one link home to its own service — one element a visitor taps, wrapping the card's heading, note and action label.`,
      );
      continue;
    }
    const [, href = "", inner = ""] = anchor;

    if (/<a\b/i.test(inner) || (card.html.match(/<a\b/gi) ?? []).length !== 1) {
      problems.push(
        `${card.page}: a service card carries more than one link. A card is one action — the action label is text inside the card's own link, not a link of its own.`,
      );
    }
    if (/<button\b|<input\b[^>]*type="(?:submit|button)"/i.test(card.html)) {
      problems.push(
        `${card.page}: a service card carries a second control beside its link. One card, one action: a button here is a second thing to press and a second promise about what happens next.`,
      );
    }

    const text = inner.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const heading = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/.exec(inner)?.[1]?.trim() ?? "";
    if (!heading) {
      problems.push(`${card.page}: a service card's link has no heading naming the service it carries, so a visitor cannot tell which service they are asking for.`);
    } else if (!recorded.has(heading)) {
      problems.push(
        `${card.page}: a service card names "${heading}", which the record does not list as a service. The card's name for the thing is the record's own — a service card never invents a name, and its destination selects the recorded one.`,
      );
    }

    // The destination: the page this tap lands on, and the service its own form shows.
    const dest = href.split("#")[0]!.trim();
    const fragment = href.includes("#") ? href.slice(href.indexOf("#")) : "";
    const target = pages.find((p) => p.file === dest);
    if (!target) {
      problems.push(
        `${card.page}: a service card links to "${dest}", which this bundle does not contain. Every link on a page is a file beside it — the published host serves flat files and resolves no directory index.`,
      );
      continue;
    }
    destinations.add(dest);
    if (!target.html.includes('id="contact-form"')) {
      problems.push(`${card.page}: a service card links to ${dest}, which carries no form — the action would ask a visitor for nothing.`);
    }
    if (!fragment) {
      problems.push(
        `${card.page}: a service card links to ${dest} without the #form fragment, so the tap lands at the top of the page instead of on the form the card is asking the visitor to fill in.`,
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

    // The family honesty guard, on the card's own markup: a card may not say what its
    // family may not say, wherever on the page it sits.
    problems.push(
      ...familyHonestyProblems({
        pages: [{ file: `${card.page} (the service card "${text.slice(0, 60)}")`, html: card.html }],
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
