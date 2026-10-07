#!/usr/bin/env bun
/**
 * The three-version phone model, pinned (WORKFLOW.md rule 9).
 *
 *   bun test test/phone-model.test.ts
 *
 * Rule 9 says a demo's phone number is the business's own published one or a clearly
 * fictional one — never anything else. `addresses.ts` carries the whole model: the
 * reserved fictional range and its predicate (`isExamplePhoneNumber`), the four ways a
 * build resolves a number (`resolvePhone`), and the one guard that reads every number a
 * bundle would print or dial (`phoneProblems`). None of it had a regression test; this is
 * that test, in the style of `test/phase-gate.test.ts`.
 *
 * Two halves, both needed:
 *
 *   1. a unit table for the predicate and the four modes — the arithmetic of "inside the
 *      reserved range" is where an off-by-one would silently mislabel a real business's
 *      line as fiction, or the reverse;
 *   2. one doctored-page test per refusal, each asserting **the exact sentence the check
 *      emits** — a clause nobody can provoke is a clause that rots unnoticed. The
 *      doctoring is on the rendered HTML, never the renderer's intent: the check reads
 *      pages because that is what a visitor can read.
 *
 * The fifth clause is the one that was blind until this session: an over-broad sentence
 * pointing a visitor at "the phone number **or email address** printed with it" on a page
 * that prints no phone. Both directions are pinned below — the old sentence caught, and the
 * corrected page passing.
 *
 * Nothing is sent anywhere and no file is written.
 */
import { expect, test } from "bun:test";
import { isExamplePhoneNumber, phoneProblems, resolvePhone } from "../src/demo/addresses.ts";
import { composeCopy, composePrivacy, profileFor } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { renderEditingReadme, renderPages, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

const OUR_INBOX = "site-sourced-311e0184@ctomail.io";
const SLUG = "example-business";
const BASE: BusinessRecord = {
  name: "Example Barber Shop",
  category: "Barber shop",
  email: "shop@example-barber.ca",
  form_recipient: OUR_INBOX,
  form_delivery: "demo",
  form_provider: "formspark",
  form_access_key: "test-form-id",
  phone: "+1 905-555-0142",
  source_kind: "public-listings",
};
/** A demonstration record: the form delivers to us, so the pages are our proposal. */
const demonstration = (over: Partial<BusinessRecord> = {}): BusinessRecord => ({ ...BASE, ...over });
/** A delivered client's own site: the form recipient is the business's own address. */
const delivered = (over: Partial<BusinessRecord> = {}): BusinessRecord => ({
  ...BASE,
  phone: "+1 905-555-0188",
  form_recipient: BASE.email!,
  form_delivery: "business",
  ...over,
});
interface Bundle {
  record: BusinessRecord;
  ctx: RenderContext;
  pages: RenderedPage[];
  readme: string;
}
/** Render the bundle exactly as the build does, README included. */
function bundle(rec: BusinessRecord): Bundle {
  const form = resolveForm(rec);
  const delivery = resolveDelivery(rec, form);
  const copy = composeCopy(rec, SLUG, form, delivery);
  const privacy = composePrivacy(rec, form, delivery);
  const ctx: RenderContext = {
    record: rec,
    copy,
    profile: profileFor(rec),
    form,
    delivery,
    privacy,
    images: [],
    slug: SLUG,
    generatedAt: "2026-10-07T00:00:00.000Z",
  };
  return { record: rec, ctx, pages: renderPages(ctx), readme: renderEditingReadme(ctx) };
}
/** One page's html, with a piece replaced — what a visitor would receive. */
const doctored = (b: Bundle, file: string, from: string | RegExp, to: string): RenderedPage[] =>
  b.pages.map((p) => (p.file === file ? { ...p, html: p.html.replace(from, to) } : p));
/** The clause list, as the build calls it. */
const guard = (b: Bundle, pages: RenderedPage[] = b.pages, fictional = b.ctx.copy.provenance.kind === "fictional"): string[] =>
  phoneProblems({
    record: b.record,
    phone: resolvePhone({ record: b.record, phase: b.ctx.delivery.mode, fictional }),
    phase: b.ctx.delivery.mode,
    fictional,
    pages,
    readme: b.readme,
  });

/* ------------------------------------------------------------- isExamplePhoneNumber */
/**
 * The reserved fictional range, `555-0100…0199`. Every case is one the model turns on:
 * both ends are inside, one either side is outside, and the shapes that are *not* a
 * number in the range must not be mistaken for one — a local seven-digit number is the
 * dangerous one, because its last seven digits look exactly like a reserved one.
 */
test("isExamplePhoneNumber: inside the reserved range, and the shapes that are not", () => {
  const table: [string, boolean][] = [
    // inside — the same number written every way a record may carry it
    ["+1 905-555-0142", true],
    ["(905) 555-0142", true],
    ["905 555 0142", true],
    ["905-555-0142", true],
    ["9055550142", true],
    ["1-905-555-0142", true],
    ["+1 (905) 555-0142", true],
    // both ends of 555-0100…0199 are inside
    ["+1 905-555-0100", true],
    ["+1 905-555-0199", true],
    // one either side is outside
    ["+1 905-555-0099", false],
    ["+1 905-555-0200", false],
    // the right exchange, the wrong subscriber block
    ["+1 905-555-0000", false],
    ["+1 905-555-0500", false],
    // the 555 exchange is only reserved *with an area code*: a local seven-digit number
    // must never pass, or a real business's line could be labelled "Phone (example):"
    ["555-0142", false],
    ["555-0100", false],
    // a different exchange, however close it looks
    ["+1 905-554-0142", false],
    ["+1 905-556-0142", false],
    ["+1 905-505-0142", false],
    // an extension makes it a different number, not a number in the range
    ["+1 905-555-0142 x22", false],
    ["+1 905-555-0142, ext. 22", false],
    // not a number at all
    ["905-555-142", false],
    ["905-555-01422", false],
    ["", false],
    ["Phone (example):", false],
  ];
  const wrong = table.filter(([value, expected]) => isExamplePhoneNumber(value) !== expected);
  expect(wrong.map(([value]) => value)).toEqual([]);
});

/* ----------------------------------------------------------------------- resolvePhone */
/**
 * The four modes of rule 9, and the basis each one carries into the manifest. A unit
 * table rather than a render, because the mode is decided from the phase and the record's
 * declared source — and it must never guess a number.
 */
test("resolvePhone: the client's own number, a published one, an example, or none", () => {
  const clientRec = delivered();
  expect(resolvePhone({ record: clientRec, phase: "business", fictional: false })).toEqual({
    mode: "client",
    number: "+1 905-555-0188",
    label: "Phone:",
    basis:
      "the record for Example Barber Shop is a delivered site (the form delivers to the business), so the page prints the client's own recorded number",
  });

  const publishedRec = demonstration();
  expect(resolvePhone({ record: publishedRec, phase: "demo", fictional: false })).toEqual({
    mode: "published",
    number: "+1 905-555-0142",
    label: "Phone:",
    basis:
      "the record for Example Barber Shop is a real business's own published number on a demonstration page, so it prints with the caveat that asks the visitor to confirm it with the business",
  });

  const fictionRec = demonstration({ source_kind: "fictional" });
  expect(resolvePhone({ record: fictionRec, phase: "demo", fictional: true })).toEqual({
    mode: "example",
    number: "+1 905-555-0142",
    label: "Phone (example):",
    basis:
      "the record for Example Barber Shop is a fictional example business, so the only honest number is one inside the reserved range 555-0100…0199, labelled as an example and never as published",
  });

  // A demonstration carrying no number: nothing is invented for the page.
  const silentRec = demonstration({ phone: "" });
  expect(resolvePhone({ record: silentRec, phase: "demo", fictional: false })).toEqual({
    mode: "none",
    number: "",
    label: "Phone:",
    basis:
      "the record for Example Barber Shop is a demonstration and carries no phone number, so no number is printed — no number is ever invented for a page",
  });

  // A delivered site carrying none resolves to `none` too — and the guard below refuses it
  // rather than printing a page with no way to be called.
  const brokenClient = delivered({ phone: "" });
  const broken = resolvePhone({ record: brokenClient, phase: "business", fictional: false });
  expect(broken.mode).toBe("none");
  expect(broken.number).toBe("");
  expect(broken.basis).toBe(
    "the record for Example Barber Shop is a delivered site but carries no phone number, so the client's page would have no way to be called",
  );
});

/* ----------------------------------------------- clause 1: a number that is not its own */
test("a page printing a number the record does not carry is refused, with the page's own words", () => {
  const b = bundle(demonstration());
  const pages = doctored(b, "index.html", "</body>", "<p>Call 905-555-0188 today.</p>\n</body>");
  expect(guard(b, pages)).toContain(
    "the text of index.html print the phone number 905-555-0188, which is not the number recorded for Example Barber Shop (+1 905-555-0142). " +
      `A page may print only the business's own number (mode "published"): the record for Example Barber Shop is a real business's own published number on a demonstration page, so it prints with the caveat that asks the visitor to confirm it with the business.`,
  );
});

/* ------------------------------------- clause 2: a fiction outside the reserved range */
test("a fictional business whose number is outside 555-0100…0199 is refused", () => {
  // A real business's number, or a 555 number outside the reserved subscriber block: either
  // way the "Phone (example):" label would be a lie, which is what the clause exists for.
  for (const number of ["+1 905-555-0300", "+1 905-555-0099"]) {
    const b = bundle(demonstration({ phone: number, source_kind: "fictional" }));
    expect(guard(b)).toContain(
      `the record's phone number (${number}) is outside the reserved range 555-0100…0199, and Example Barber Shop is a fictional example business. ` +
        `An invented number may only come from the range reserved for fiction, because any other number could be a real business's line — and the label "Phone (example):" would then be false. ` +
        `Move the number inside 555-0100…0199 and rebuild.`,
    );
  }
});

/* ------------------------------------------- clause 3: "published" on an invented number */
test("the word \"published\" describing an invented number is refused, wherever it is printed", () => {
  // Doctor the label the way the live proof does: the renderer's example label becomes a
  // "published" one. The quoted context in the message is a slice of the page around the
  // number, so this pins the sentence's opening, the pages it fires on, and its close.
  const b = bundle(demonstration({ source_kind: "fictional" }));
  const pages = b.pages.map((p) => ({ ...p, html: p.html.replace(/Phone \(example\):/g, "Phone (published):") }));
  const problems = guard(b, pages, true);
  expect(problems.map((p) => p.slice(0, p.indexOf(" as published")))).toEqual([
    "services.html prints the invented number +19055550142",
    "about.html prints the invented number +19055550142",
    "contact.html prints the invented number +19055550142",
  ]);
  for (const problem of problems) {
    expect(problem).toContain('("');
    expect(problem).toContain("Phone (published):");
    expect(problem).toEndWith(
      'The word "published" may never describe a number invented for a fictional example business: no listing anywhere carries it. Label it as an example instead.',
    );
  }
});

/* ------------------------------------------------ clause 4: a client build with no phone */
test("a delivered site whose record carries no phone is refused as broken, not cautious", () => {
  const b = bundle(delivered({ phone: "" }));
  expect(guard(b)).toEqual([
    "Example Barber Shop is a delivered site but the record carries no phone number, so the client's own pages would print none. " +
      "A client build with no phone is broken rather than cautious: add the number confirmed at hand-off to the record and rebuild.",
  ]);
});

/* ------------------- clause 5: pointing a visitor at a printed number the page lacks */
test("a page that points at \"the phone number or email address printed with it\" with no phone recorded is refused", () => {
  // The exact sentence the model shipped until this session, doctored back into a page
  // whose record carries an email address and no phone number — the combination that made
  // it a lie. The clause could not see it: the old pattern was
  // `/phone number printed with/i`.
  const b = bundle(demonstration({ phone: "" }));
  const pages = doctored(b, "index.html", "the email address printed with it", "the phone number or email address printed with it");
  expect(guard(b, pages)).toEqual([
    'index.html tells a visitor to use "the phone number or email address printed with it", but no phone number is recorded for Example Barber Shop, so no page prints one. ' +
      "A page may not send a visitor to a detail it does not show: drop the clause, and say what the page does offer.",
  ]);
});

test("both sentences that point at a printed detail read the details the record actually prints", () => {
  // The corrected page, and the other half of the proof: with no phone recorded and an
  // email address recorded, neither sentence promises a phone number — so the guard above
  // has nothing to fire on, and the page says only what it shows.
  const index = (b: Bundle): string => b.pages.find((p) => p.file === "index.html")!.html;

  // (a) no phone, an email address: both sentences name the email address alone.
  const noPhone = bundle(demonstration({ phone: "" }));
  expect(guard(noPhone)).toEqual([]);
  expect(index(noPhone)).toContain("To reach Example Barber Shop itself, use the email address printed with it.");
  expect(index(noPhone)).not.toContain("phone number or email address printed with it");

  // (b) a phone and no email address — the shape of all four fixtures: both sentences name
  // the phone number alone, which is the correction the fixture diff shows.
  const noEmail = bundle(demonstration({ email: undefined }));
  expect(guard(noEmail)).toEqual([]);
  expect(index(noEmail)).toContain("To reach Example Barber Shop itself, use the phone number printed with it.");
  expect(index(noEmail)).not.toContain("phone number or email address printed with it");

  // (c) neither detail: the clause is dropped rather than promised.
  const silent = bundle(demonstration({ phone: "", email: undefined }));
  expect(guard(silent)).toEqual([]);
  expect(index(silent)).toContain(
    "This is a demonstration site, so the message form comes to Site Sourced rather than to Example Barber Shop.</p>",
  );
  expect(index(silent)).not.toContain("printed with it");
});
