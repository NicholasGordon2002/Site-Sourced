#!/usr/bin/env bun
/**
 * The family rendering layer — what each family's build actually renders, and the
 * checks that keep it honest (`/home/team/shared/WORKFLOW.md` rule 6; the family core's
 * own tests live in `family.test.ts`).
 *
 *   bun test test/family-render.test.ts
 *
 * Nine things, each one a way the layer could quietly start lying:
 *
 *   1. the form asks exactly the fields this family's set carries, and a field the
 *      record cannot support does not appear — the omission and its reason are recorded;
 *   2. the preferred-days control offers only days a `hours` row states as open, a
 *      `"Closed"` row contributes none, and with no days at all the group does not exist;
 *   3. the service-card action carries the family's own words and the recorded service
 *      verbatim, in the query string the form's own select matches;
 *   4. Family B's three steps are derived from the delivery mode — on a demo page nobody
 *      at the business reads the message, so "they contact you" is not said — and
 *      Family A carries no such block;
 *   5. the extras card is the record's own facts, and `Walk-ins welcome.` only where the
 *      record carries `accepts_walk_ins: true`;
 *   6. the submit button prints the label the family resolved;
 *   7. the pages are the sections this family's order table names, in that order;
 *   8. every refusal above has a positive control (the honest page still builds);
 *   9. the frozen strings are untouched by any of it.
 *
 * No network. Only the four fictional fixtures are read from disk.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { complianceChecks } from "../src/demo/build.ts";
import { composeCopy, composePrivacy, familyFields, profileFor, UI } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { extrasLines, SECTION_ORDER, inquirySteps } from "../src/demo/family-render.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { renderPages, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
import type { BusinessRecord, ManifestImage } from "../src/demo/types.ts";

const SLUG = "family-render-test";
const NO_IMAGES: ManifestImage[] = [];
const FIXTURES = join(import.meta.dir, "fixtures");

/** A record shaped like a real prospect's, in demonstration delivery. */
function record(overrides: Partial<BusinessRecord> & { name: string; category: string }): BusinessRecord {
  return {
    source_kind: "public-listings",
    email: "shop@example-barber.ca",
    form_recipient: "site-sourced-311e0184@ctomail.io",
    form_delivery: "demo",
    form_provider: "formspark",
    form_access_key: "test-form-id",
    ...overrides,
  };
}

const SERVICES = [{ name: "Haircut" }, { name: "Kids' cut" }];
const BARBER = record({
  name: "Example Barber Shop",
  category: "Barber shop",
  phone: "+1 905-555-0142",
  services: SERVICES,
  hours: [
    { days: "Mon–Fri", hours: "9:00 am – 6:00 pm" },
    { days: "Sun", hours: "Closed" },
    { days: "By appointment", hours: "varies" },
  ],
});
const GARDENER = record({
  name: "Example Garden Works",
  category: "Landscaping",
  phone: "+1 905-555-0177",
  services: [{ name: "Spring cleanup" }, { name: "Hedge trimming" }],
  hours: [{ days: "Mon–Fri", hours: "7:30 am – 5:00 pm" }],
});

interface Rendered {
  record: BusinessRecord;
  pages: RenderedPage[];
  ctx: RenderContext;
}

/** Render the five pages for a record exactly as the build does. */
function render(rec: BusinessRecord): Rendered {
  const form = resolveForm(rec);
  const delivery = resolveDelivery(rec, form);
  const copy = composeCopy(rec, SLUG, form, delivery);
  const ctx: RenderContext = {
    record: rec,
    copy,
    profile: profileFor(rec),
    form,
    delivery,
    privacy: composePrivacy(rec, form, delivery),
    images: NO_IMAGES,
    slug: SLUG,
    generatedAt: "2026-10-04T00:00:00.000Z",
  };
  return { record: rec, pages: renderPages(ctx), ctx };
}

const page = (rendered: Rendered, file: string): string => rendered.pages.find((p) => p.file === file)!.html;

/** The build's own self-check, over the pages as rendered (or as doctored). */
function checks(rendered: Rendered, overrides: RenderedPage[] = rendered.pages): string[] {
  return complianceChecks({
    pages: overrides,
    record: rendered.record,
    copy: rendered.ctx.copy,
    form: rendered.ctx.form,
    delivery: rendered.ctx.delivery,
    images: NO_IMAGES,
    privacy: rendered.ctx.privacy,
  });
}

/** One page with a string swapped or injected — the smallest simulation of a typo. */
function doctored(rendered: Rendered, file: string, from: string, to: string): RenderedPage[] {
  return rendered.pages.map((p) => (p.file === file ? { ...p, html: p.html.replace(from, to) } : p));
}

function fixture(name: string): BusinessRecord {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as BusinessRecord;
}

/* ---------------------------------------------- 1. the fields each family's form asks */

test("an appointment form asks the appointment questions, in two field sets", () => {
  const barber = render(BARBER);
  const contact = page(barber, "contact.html");
  // Your details, then the request itself (design spec §2).
  expect(contact).toContain("Your details");
  expect(contact).toContain("The appointment");
  // The phone is required here and the email is not — the opposite of Family B.
  expect(contact).toMatch(/id="cf-phone"[^>]*required/);
  expect(contact).not.toMatch(/id="cf-email"[^>]*required/);
  // The record lists services, so the select offers them and nothing else.
  expect(contact).toContain("<select ");
  expect(contact).toContain('<option value="Haircut"');
  expect(contact).toContain('<option value="Kids&#39; cut"');
  // The recorded options come from the record, so they are in its words.
  expect(contact).toContain("Preferred day(s)");
  expect(contact).toContain("Preferred time");
  // Family A's own question: how long since the last one (a clinical record asks it).
  expect(checks(barber)).toEqual([]);
});

test("an inquiry form asks the job questions, and only the ones the record supports", () => {
  const gardener = render(GARDENER);
  const contact = page(gardener, "contact.html");
  expect(contact).toContain("About the job");
  expect(contact).toMatch(/id="cf-email"[^>]*required/);
  expect(contact).not.toMatch(/id="cf-phone"[^>]*required/);
  expect(contact).toContain("Type of job");
  expect(contact).toContain("Describe what you need");
  expect(contact).toContain("How soon?");
  // Landscaping is a site-work category, so the location question is asked.
  expect(contact).toContain("Where is the job?");
  // ...and the appointment questions are not.
  expect(contact).not.toContain("Preferred time");
  expect(checks(gardener)).toEqual([]);
});

test("a field the record cannot support does not appear, and the omission is recorded", () => {
  const noServices = record({ name: "Example Barbers", category: "Barber shop", hours: [{ days: "Mon", hours: "9 am – 5 pm" }] });
  const fields = familyFields(noServices);
  const contact = page(render(noServices), "contact.html");

  expect(fields.omitted.map((o) => o.field)).toContain(UI.fieldService);
  expect(fields.omitted.map((o) => o.why).join(" ")).toContain("a gap is never filled with generic copy");
  expect(contact).not.toContain(UI.fieldService);
  expect(contact).not.toContain("<select ");
  // A gap is not filled with a generic extras line either.
  expect(page(render(noServices), "about.html")).not.toContain('class="extras-item"');
});

/* ---------------------------------------------------- 2. the preferred-days control */

test("preferred days come only from the days a hours row states as open", () => {
  const fields = familyFields(BARBER);
  expect(fields.preferredDays.days).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  // The negative half is the one that matters: "Closed" and an unreadable rule
  // contribute nothing, and each is accounted for in the recorded basis.
  expect(fields.preferredDays.basis).toContain('"Sun" (Closed) contributes no days');
  expect(fields.preferredDays.basis).toContain('"By appointment" (varies) is a rule we cannot read');
  const contact = page(render(BARBER), "contact.html");
  expect(contact).toContain('name="days" value="Sat"'.replace("Sat", "Mon"));
  expect(contact).not.toContain('name="days" value="Sun"');
});

test("with no day stated as open, the group does not exist — legend included", () => {
  const closed = record({ name: "Example Barbers", category: "Barber shop", hours: [{ days: "Mon–Sun", hours: "Closed" }] });
  const contact = page(render(closed), "contact.html");
  expect(contact).not.toContain('name="days"');
  expect(contact).not.toContain(UI.fieldPreferredDays);
  expect(familyFields(closed).preferredDays.days).toEqual([]);

  // ...and a chip for a day no row states as open is refused by name.
  const injected = doctored(render(BARBER), "contact.html", '<p class="form-actions">', '<input type="checkbox" name="days" value="Sun"><p class="form-actions">');
  expect(checks(render(BARBER), injected).join("\n")).toContain('offers "Sun", which no recorded hours row states as open');
});

/* --------------------------------------------------------- 3. the service-card action */

test("a service card asks for the recorded service, in the family's own words", () => {
  const barber = page(render(BARBER), "services.html");
  expect(barber).toContain("Request this");
  expect(barber).toContain("contact.html?service=Haircut#form");
  expect(barber).toContain("contact.html?service=Kids%27%20cut#form");
  // Family B may ask about the job; it may never promise a price.
  const gardener = page(render(GARDENER), "services.html");
  expect(gardener).toContain("Ask about this");
  expect(gardener).not.toContain("Get a quote");

  // The link must carry a service the record lists: a name nobody recorded would
  // preselect nothing at all.
  const wrong = doctored(render(BARBER), "services.html", "?service=Haircut", "?service=Shave");
  expect(checks(render(BARBER), wrong).join("\n")).toContain('preselects "Shave", which the record does not list');
});

test("the form's select matches the parameter the card carries, and nothing runs without JavaScript", () => {
  const rendered = render(BARBER);
  const contact = page(rendered, "contact.html");
  // The option values are the recorded names verbatim — that is what makes the
  // preselect possible at all — and the script is JSON-quote free, so it is safe to
  // load from a static host.
  expect(contact).toContain('<option value="Haircut"');
  expect(rendered.pages.filter((p) => p.html.includes("site.js")).length).toBe(1);
  expect(contact).toContain("contact-form");
  // Without JavaScript the select keeps its listed default and the form still posts.
  expect(contact).toContain('<option value="Not sure" selected>');
});

/* --------------------------------------------------------------- 4. the inquiry steps */

test("Family B's steps are derived from the delivery mode: nobody at the business reads a demo", () => {
  const demo = render(GARDENER); // the fixture recipient is our own inbox -> demo mode
  expect(demo.ctx.delivery.mode).toBe("demo");
  const index = page(demo, "index.html");
  expect(index).toContain('id="how"');
  expect(index).toContain("How an inquiry works");
  expect(demo.ctx.copy.steps).toEqual(["Describe the job", "Site Sourced receives this demonstration message", "Site Sourced replies to you"]);
  for (const step of demo.ctx.copy.steps) expect(index).toContain(step);
  // The block sits between the recorded services and the hours.
  expect(index.indexOf('id="services"')).toBeLessThan(index.indexOf('id="how"'));
  expect(index.indexOf('id="how"')).toBeLessThan(index.indexOf('id="hours"'));

  // A page in the business phase says the business receives it and answers it.
  const client = record({
    ...GARDENER,
    email: "garden@example-garden.ca",
    form_recipient: "garden@example-garden.ca",
    form_delivery: "business",
  });
  expect(inquirySteps("business", { business: GARDENER.name, us: "Site Sourced" })).toEqual([
    "Describe the job",
    "The business gets your message",
    "They contact you",
  ]);
  expect(render(client).ctx.delivery.mode).toBe("business");
});

test("an appointment page carries no such block, and one injected into it is refused", () => {
  const barber = render(BARBER);
  expect(page(barber, "index.html")).not.toContain('class="steps"');
  expect(barber.ctx.copy.steps).toEqual([]);
  const injected = doctored(barber, "index.html", 'id="services"', 'id="services"');
  expect(checks(barber, injected)).toEqual([]);
  const withSteps = doctored(barber, "index.html", "</main>", '<ol class="steps"><li>x</li></ol></main>');
  expect(checks(barber, withSteps).join("\n")).toContain("belongs to the inquiry family only");
});

/* ------------------------------------------------------------------ 5. the extras card */

test("the extras card prints the record's own facts, and the one boolean as it was approved", () => {
  const withExtras = record({
    ...BARBER,
    service_area: "Hamilton and the surrounding area",
    accepts_walk_ins: true,
    pricing_note: "Cuts are priced by length.",
  });
  const lines = extrasLines({ record: withExtras, profileKey: "salon", labels: UI });
  expect(lines.map((l) => l.value)).toEqual([
    "Hamilton and the surrounding area",
    "Cuts are priced by length.",
    "Walk-ins welcome.",
  ]);
  expect(lines.map((l) => l.source)).toEqual(["verbatim", "verbatim", "boolean-derived"]);
  const about = page(render(withExtras), "about.html");
  expect(about).toContain("Good to know");
  expect(about).toContain("Walk-ins welcome.");

  // false and absent both print nothing at all.
  expect(extrasLines({ record: record({ ...BARBER, accepts_walk_ins: false }), profileKey: "salon", labels: UI })).toEqual([]);
  expect(page(render(BARBER), "about.html")).not.toContain('class="extras-item"');

  // ...and a page printing the line without the record's own assertion is refused.
  const lying = doctored(render(BARBER), "about.html", "</main>", '<p class="extras-item">Walk-ins welcome.</p></main>');
  expect(checks(render(BARBER), lying).join("\n")).toContain("does not carry accepts_walk_ins: true");
});

/* ------------------------------------------------------------------ 6. the submit label */

test("the submit button prints the family's own call to action", () => {
  const barber = render(BARBER);
  expect(page(barber, "contact.html")).toContain('<button class="button" type="submit">Request an appointment</button>');
  expect(page(barber, "index.html")).toContain(">Request an appointment<");
  expect(page(render(GARDENER), "contact.html")).toContain('type="submit">Ask for a quote</button>');

  // Our own fictional fixture: the neutral call to action, and the plain submit label.
  const maple = fixture("maple-avenue-barber-shop");
  const simple = render(maple);
  expect(simple.ctx.copy.contactLabel.source).toBe("fictional fixture");
  expect(page(simple, "contact.html")).toContain('type="submit">Send message</button>');
  expect(page(simple, "index.html")).toContain(">Contact Us<");

  // A page whose button says something else fails, naming the file and the label.
  const doctoredLabel = doctored(barber, "contact.html", ">Request an appointment<", ">Book Now<");
  const problems = checks(barber, doctoredLabel).join("\n");
  expect(problems).toContain("the submit button prints");
  expect(problems).toContain("Request an appointment");
});

/* ------------------------------------------------------------------- 7. section order */

test("each page carries the sections its family's order table names", () => {
  expect(SECTION_ORDER.appointment.index).toEqual(["hero", "about-short", "services", "hours", "cta"]);
  expect(SECTION_ORDER.inquiry.index).toContain("how");
  for (const rec of [BARBER, GARDENER]) {
    const rendered = render(rec);
    for (const p of rendered.pages) expect(page(rendered, p.file).length).toBeGreaterThan(0);
    expect(checks(rendered)).toEqual([]);
  }
  // A page that loses a block is refused, so a page cannot quietly change shape.
  const lost = doctored(render(GARDENER), "about.html", 'id="about"', 'id="about-removed"');
  expect(checks(render(GARDENER), lost).join("\n")).toContain('missing its "about-full" block');
});

/* ------------------------------------------------------- 8. the other checks still run */

test("the extra form field is refused, so the notice and the page cannot drift apart", () => {
  const rendered = render(BARBER);
  const injected = doctored(rendered, "contact.html", '<p class="form-actions">', '<input name="budget"><p class="form-actions">');
  expect(checks(rendered, injected).join("\n")).toContain('asks for a "budget" field');
});

test("every fixture renders a button that is its own family's call to action", () => {
  // The build's own self-check runs over all four in `bun run demo:fixtures`; here the
  // point is the label, which no fixture may borrow from the other family.
  // Three of the four fixtures are our own invented businesses, so they carry the
  // neutral pair; red-hill-property-care declares a public listing, so it is a build from
  // a real record and keeps its family's own words.
  const expected: [string, string, "fictional fixture" | "family-aware"][] = [
    ["maple-avenue-barber-shop", "Send message", "fictional fixture"],
    ["king-west-dental", "Send message", "fictional fixture"],
    ["northshore-garden-works", "Send message", "fictional fixture"],
    ["red-hill-property-care", "Ask for a quote", "family-aware"],
  ];
  for (const [name, label, source] of expected) {
    const rendered = render(fixture(name));
    expect(page(rendered, "contact.html")).toContain(`type="submit">${label}</button>`);
    expect(rendered.ctx.copy.contactLabel.source).toBe(source);
  }
  expect(render(record({ name: "Example Dental", category: "Dental clinic", email: "x@example-dental.ca" })).ctx.copy.contactLabel.source).toBe(
    "family-aware",
  );
});
