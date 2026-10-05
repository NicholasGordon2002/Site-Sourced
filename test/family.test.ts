#!/usr/bin/env bun
/**
 * The conversion family, and the honesty rules that bind each one.
 *
 *   bun test test/family.test.ts
 *
 * Three things are checked here, all of them enforced by `complianceChecks` in build.ts
 * (the single self-check the build throws on) except where a test calls a resolver
 * directly to show *how* the value was worked out:
 *
 *   1. the family is derived from what the record carries, and the basis — the table row,
 *      or the record's own override — is recorded rather than remembered;
 *   2. an appointment page may request a time and may never book one; an inquiry page may
 *      pass on a question and may never promise a price, a timeline, a visit or a service
 *      area — with positive controls proving the refusals are not vacuous (a business
 *      whose own record says "book", or quotes a price, still builds);
 *   3. the primary contact label is the one the owner decided: neutral on our own fictional
 *      fixture, family-aware on a real business's record.
 *
 * No filesystem beyond the fixtures, no network. Fixtures are fictional.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { complianceChecks } from "../src/demo/build.ts";
import { PROFILES, composeCopy, composePrivacy, profileFor, profileMatch } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import {
  FAMILY_BY_PROFILE,
  contactLabelProblems,
  familyHonestyProblems,
  familyProblems,
  resolveFamily,
  resolvePrimaryLabel,
  visibleSentences,
  type ConversionFamily,
} from "../src/demo/family.ts";
import { notificationSubject, resolveForm } from "../src/demo/forms.ts";
import { renderPages, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
import type { BusinessRecord, ManifestImage } from "../src/demo/types.ts";

const SLUG = "family-test";
const NO_IMAGES: ManifestImage[] = [];

/** The record shape both families are exercised with: a real record, in demo delivery. */
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

const BARBER = record({ name: "Example Barber Shop", category: "Barber shop" });
const GARDENER = record({ name: "Example Garden Works", category: "Landscaping" });

interface Rendered {
  record: BusinessRecord;
  pages: RenderedPage[];
  ctx: RenderContext;
}

/** Render the five pages for a record exactly as the build does, with no images. */
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

/** The build's own self-check, on the pages as rendered. */
function checks({ record: rec, pages, ctx }: Rendered, overrides: RenderedPage[] = pages): string[] {
  return complianceChecks({
    pages: overrides,
    record: rec,
    copy: ctx.copy,
    form: ctx.form,
    delivery: ctx.delivery,
    images: NO_IMAGES,
    privacy: ctx.privacy,
  });
}

/**
 * The page set with one extra sentence a visitor would read, on the home page — the
 * smallest honest simulation of somebody typing a claim into the template.
 */
function withSentence({ pages }: Rendered, sentence: string, file = "index.html"): RenderedPage[] {
  const target = pages.find((p) => p.file === file)!;
  const injected = target.html.replace("</body>", `      <p class="muted">${sentence}</p>\n</body>`);
  return [{ ...target, html: injected }, ...pages.filter((p) => p.file !== file)];
}

/* ------------------------------------------------------------------ 1. derivation */

test("the family is derived from the record's own category words", () => {
  const cases: [string, string, ConversionFamily][] = [
    ["Barber shop", "", "appointment"],
    ["Hair salon", "", "appointment"],
    ["Dental clinic", "Health & clinics", "appointment"],
    ["Physiotherapy clinic", "", "appointment"],
    ["Yoga studio", "", "appointment"],
    ["Plumber", "Trades", "inquiry"],
    ["Landscaping", "Garden & landscaping", "inquiry"],
    ["Law office", "Professional services", "inquiry"],
    ["Florist", "Retail", "inquiry"],
    ["Bakery", "Food & drink", "inquiry"],
    ["Pet sitting", "", "inquiry"],
  ];
  for (const [category, group, expected] of cases) {
    const rec = record({ name: "Example", category, category_group: group || undefined });
    const resolution = resolveFamily(rec, profileMatch(rec));
    expect(`${category} → ${resolution.family}`).toBe(`${category} → ${expected}`);
    expect(resolution.source).toBe("category table");
    // The manifest's basis names the rule, and never claims a table row that did not fire.
    expect(resolution.basis).toContain("classification table in src/demo/family.ts");
    if (resolution.matched_category_word) {
      expect(resolution.basis).toContain(resolution.matched_category_word);
    }
  }
});

test("the category table covers every category profile copy.ts can select", () => {
  // A new category profile cannot be added without deciding its family in the same change.
  expect(Object.keys(FAMILY_BY_PROFILE).sort()).toEqual(PROFILES.map((p) => p.key).sort());
  for (const profile of PROFILES) {
    expect(`${profile.key}: ${FAMILY_BY_PROFILE[profile.key] ?? "MISSING"}`).not.toContain("MISSING");
  }
});

test("a record may override the family, and the manifest says the override is what fired", () => {
  const rec = record({ name: "Example Barbers", category: "Barber shop", conversion_family: "inquiry" });
  const resolution = resolveFamily(rec, profileMatch(rec));
  expect(resolution.family).toBe("inquiry");
  expect(resolution.source).toBe("record override");
  expect(resolution.basis).toContain('conversion_family: "inquiry"');
  expect(familyProblems({ record: rec, family: resolution.family })).toEqual([]);
});

test("a conversion_family that is neither family fails the build", () => {
  const rec = record({ name: "Example Barbers", category: "Barber shop", conversion_family: "booking" as never });
  const resolution = resolveFamily(rec, profileMatch(rec));
  // The build still derives a usable family, so the failure is reported rather than thrown.
  expect(resolution.family).toBe("appointment");
  expect(resolution.source).toBe("category table");
  const problems = familyProblems({ record: rec, family: resolution.family });
  expect(problems.length).toBe(1);
  expect(problems[0]).toContain('conversion_family "booking"');
  expect(problems[0]).toContain("neither");
  // And the whole self-check reports it, on a record that is otherwise publishable.
  const rendered = render(rec);
  expect(checks(rendered).join(" ")).toContain('conversion_family "booking"');
});

/* --------------------------------------------------------------- 2. appointment */

test("an appointment page that offers to book fails the build, naming the sentence and the file", () => {
  const rendered = render(BARBER);
  expect(rendered.ctx.copy.conversion.family).toBe("appointment");
  expect(checks(rendered)).toEqual([]);

  const problems = checks(rendered, withSentence(rendered, "Book Now"));
  expect(problems.length).toBeGreaterThan(0);
  const joined = problems.join(" ");
  expect(joined).toContain("index.html");
  expect(joined).toContain('the page says "Book Now"');
  expect(joined).toContain('"Book"');
  expect(joined).toContain("appointment family must not book a time");
  expect(joined).toContain("WORKFLOW.md rule 3");
});

test("an appointment page may not offer availability, a slot, a confirmation or an instant appointment", () => {
  const rendered = render(BARBER);
  const refused: [string, string][] = [
    ["Same-day appointments are available today.", "availab"],
    ["We have slots free this afternoon.", "slot"],
    ["Your appointment is confirmed.", "confirm"],
    ["Instant booking.", "nstant"],
    ["Plenty of availability next week.", "availab"],
  ];
  for (const [sentence, word] of refused) {
    const problems = checks(rendered, withSentence(rendered, sentence));
    const joined = problems.join(" ");
    expect(`refused: ${sentence} → ${problems.length > 0}`).toBe(`refused: ${sentence} → true`);
    expect(joined).toContain("index.html");
    expect(joined).toContain(sentence);
    expect(joined.toLowerCase()).toContain(word.toLowerCase());
  }
});

test("an appointment page that denies booking is allowed to say so", () => {
  // The honest forms of the sentence: a guard that refused these would refuse the copy
  // the rules require ("This is a request, not a confirmed booking.").
  const rendered = render(BARBER);
  for (const sentence of [
    "This is a request, not a confirmed booking.",
    "Nothing here is booked.",
    "No appointment is booked until the business confirms it with you.",
  ]) {
    const problems = checks(rendered, withSentence(rendered, sentence));
    expect(`allowed: ${sentence} → ${problems.join(" | ")}`).toBe(`allowed: ${sentence} → `);
  }
});

test("a business whose own recorded service says \"book\" still builds", () => {
  // The positive control: the record's own words are the business's claim, never ours.
  const rec = record({
    name: "Example Barber Co",
    category: "Hair salon",
    services: [{ name: "Book a fitting", note: "Book online and pick a slot." }],
  });
  const rendered = render(rec);
  expect(rendered.ctx.copy.conversion.family).toBe("appointment");
  // The recorded words really are on the page...
  expect(rendered.pages[0]!.html).toContain("Book a fitting");
  expect(rendered.pages[0]!.html).toContain("Book online and pick a slot.");
  // ...and the guard lets them through, because the record says them.
  expect(checks(rendered)).toEqual([]);
  expect(familyHonestyProblems({ pages: rendered.pages, record: rec, family: "appointment" })).toEqual([]);
});

test("a record that carries a booking page may use the booking words", () => {
  const rec = record({
    name: "Example Barbers",
    category: "Barber shop",
    booking_url: "https://booking.example.com/example-barbers",
  });
  const rendered = render(rec);
  // The words are still refused while they would be a claim about *this* page and nothing
  // in the record makes them true; the booking page in the record is what makes them true.
  expect(familyHonestyProblems({ pages: withSentence(rendered, "Book an appointment online."), record: rec, family: "appointment" })).toEqual([]);
  expect(
    familyHonestyProblems({ pages: withSentence(rendered, "Book an appointment online."), record: BARBER, family: "appointment" }).length,
  ).toBeGreaterThan(0);
});

test("an attribute a visitor reads counts as a claim too", () => {
  const rendered = render(BARBER);
  const [index, ...rest] = rendered.pages;
  const injected = index!.html.replace("</body>", `      <img src="x.png" alt="Book now">\n</body>`);
  const problems = checks(rendered, [{ ...index!, html: injected }, ...rest]);
  expect(problems.join(" ")).toContain("Book now");
  // The attribute is read as its own sentence, so the report quotes what the visitor reads.
  expect(visibleSentences(`<img alt="Book now">`)).toEqual(["Book now"]);
});

/* ------------------------------------------------------------------- 3. inquiry */

test("an inquiry page that promises a price, a timeline, a visit or a service area fails", () => {
  const rendered = render(GARDENER);
  expect(rendered.ctx.copy.conversion.family).toBe("inquiry");
  expect(checks(rendered)).toEqual([]);

  const refused: [string, string][] = [
    ["We offer a free quote.", "free quote"],
    ["Our prices are the lowest in town.", "price"],
    ["We reply within an hour.", "within"],
    ["Same-day service.", "same-day"],
    ["We will visit your property to measure.", "visit"],
    ["Serving Hamilton and the surrounding area.", "serving"],
    ["Our service area covers the whole city.", "service area"],
  ];
  for (const [sentence, word] of refused) {
    const problems = checks(rendered, withSentence(rendered, sentence));
    const joined = problems.join(" ");
    expect(`refused: ${sentence} → ${problems.length > 0}`).toBe(`refused: ${sentence} → true`);
    expect(joined).toContain("index.html");
    expect(joined).toContain(sentence);
    expect(joined.toLowerCase()).toContain(word.toLowerCase());
  }
});

test("an inquiry page may print the record's own pricing note and service area", () => {
  // The positive control for Family B: the business's own recorded words are printed
  // verbatim, and the guard does not edit them.
  const rec = record({
    name: "Example Garden Works",
    category: "Landscaping",
    services: [
      { name: "Hedge trimming", note: "Free quotes on larger jobs. Serving Hamilton, Ancaster and Dundas." },
    ],
  });
  const rendered = render(rec);
  const html = rendered.pages[0]!.html;
  expect(html).toContain("Free quotes on larger jobs. Serving Hamilton, Ancaster and Dundas.");
  expect(checks(rendered)).toEqual([]);
  expect(familyHonestyProblems({ pages: rendered.pages, record: rec, family: "inquiry" })).toEqual([]);
});

/* ---------------------------------------------------------------- 4. the label */

test("the label is neutral on our own fictional fixture and family-aware on a real record", () => {
  const fictional = record({ name: "Maple Avenue Barber Shop", category: "Barber shop", source_kind: "fictional" });
  const neutral = resolvePrimaryLabel(fictional, "appointment", "salon");
  expect(neutral.label).toBe("Contact Us");
  expect(neutral.source).toBe("fictional fixture");
  expect(neutral.basis).toContain("4 October");

  // A build from a real business's record keeps the family's own label, and the inquiry
  // label follows the category: quote-shaped work asks for a quote.
  const appointment = resolvePrimaryLabel(BARBER, "appointment", "salon");
  expect(appointment.label).toBe("Request an appointment");
  expect(appointment.source).toBe("family-aware");
  const quote = resolvePrimaryLabel(GARDENER, "inquiry", "landscaping");
  expect(quote.label).toBe("Ask for a quote");
  const message = resolvePrimaryLabel(record({ name: "Example Law Office", category: "Law office" }), "inquiry", "professional");
  expect(message.label).toBe("Send a message");
});

test("the page prints the label the build resolved, and a different one fails the build", () => {
  const rendered = render(BARBER);
  expect(rendered.ctx.copy.contactLabel.label).toBe("Request an appointment");
  // The hero button and the CTA band both carry it.
  expect(rendered.pages[0]!.html).toContain(`>${rendered.ctx.copy.contactLabel.label}</a>`);
  expect(checks(rendered)).toEqual([]);

  const [index, ...rest] = rendered.pages;
  const substituted = index!.html.replace(
    `>${rendered.ctx.copy.contactLabel.label}</a>`,
    ">Book Now</a>",
  );
  const problems = checks(rendered, [{ ...index!, html: substituted }, ...rest]);
  const joined = problems.join(" ");
  expect(joined).toContain("Book Now");
  expect(joined).toContain("while the build resolved the label");
  expect(joined).toContain("Request an appointment");
});

test("contactLabelProblems compares only the call-to-action buttons, not the nav link", () => {
  const rendered = render(GARDENER);
  const label = rendered.ctx.copy.contactLabel;
  expect(label.label).toBe("Ask for a quote");
  expect(contactLabelProblems({ pages: rendered.pages, label })).toEqual([]);
  // The nav's plain link to the same file is labelled "Contact" and is not a defect.
  expect(rendered.pages[0]!.html).toContain('href="contact.html">Contact</a>');
});

/* -------------------------------------------------- 5. the fixtures, end to end */

test("each fixture derives the family and the label its own record decides", () => {
  const expected: [string, ConversionFamily, string][] = [
    ["maple-avenue-barber-shop", "appointment", "Contact Us"],
    ["king-west-dental", "appointment", "Contact Us"],
    ["northshore-garden-works", "inquiry", "Contact Us"],
    // A record whose details came from a public listing is a real business's record, so it
    // carries the family-aware label even though this particular one is a stand-in.
    ["red-hill-property-care", "inquiry", "Ask for a quote"],
  ];
  for (const [slug, family, label] of expected) {
    const rec: BusinessRecord = JSON.parse(readFileSync(join(import.meta.dir, "fixtures", `${slug}.json`), "utf8"));
    // The fixtures name their access key in the environment (`env:SS_FORMSPARK_FORM_ID`),
    // which the CLI reads from the gitignored .env.local and a test run does not have.
    // Everything else is the fixture as it stands.
    rec.form_access_key = "test-form-id";
    const resolution = resolveFamily(rec, profileMatch(rec));
    const primary = resolvePrimaryLabel(rec, resolution.family, resolution.category_profile);
    expect(`${slug}: ${resolution.family} / ${primary.label}`).toBe(`${slug}: ${family} / ${label}`);
    // Every fixture builds clean through the whole self-check, guards and label included.
    const rendered = render(rec);
    expect(`${slug}: ${checks(rendered).join(" | ")}`).toBe(`${slug}: `);
  }
});

/* ---------------------------------------------- 6. the notification title */
test("the notification title is family- and phase-derived, never hand-written per provider", () => {
  expect(notificationSubject("Example Barber Shop", "appointment", "demo")).toBe("Appointment request from Example Barber Shop (Site Sourced demo)");
  expect(notificationSubject("Example Barber Shop", "appointment", "business")).toBe("Appointment request from Example Barber Shop");
  expect(notificationSubject("Example Landscaping", "inquiry", "demo")).toBe("Quote request from Example Landscaping (Site Sourced demo)");
  expect(notificationSubject("Example Landscaping", "inquiry", "business")).toBe("Quote request from Example Landscaping");
});
