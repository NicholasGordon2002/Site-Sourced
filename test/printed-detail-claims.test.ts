#!/usr/bin/env bun
/**
 * A page may name only the printed details the record actually carries.
 *
 *   bun test test/printed-detail-claims.test.ts
 *
 * The defect this pins was found on 7 Oct: the hero's offering line named "Hours, address
 * and phone number" on every record with no services recorded, whatever the record held —
 * so a record with no phone number told a visitor, in the largest type on the page, that
 * the hero carried one, while the contact page said "No phone number is recorded for this
 * business." The same rule had already been broken by the contact call to action.
 *
 * Three halves, all needed:
 *
 *   1. the record-side derivation (`carriedDetails`) — what "the record carries X" means,
 *      including the fields that exist but the page does not show (an empty `hours`);
 *   2. the composer — the offering line named exactly what is carried, and no line at all
 *      when nothing is;
 *   3. the clause — one doctored page per claim shape, asserting **the exact sentence the
 *      check emits**, plus the sentences it deliberately does not cover.
 *
 * Nothing is sent anywhere and no file is written.
 */
import { expect, test } from "bun:test";
import { carriedDetails, composeCopy, printedDetailClaimProblems } from "../src/demo/copy.ts";
import { phoneProblems, resolvePhone } from "../src/demo/addresses.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

const OUR_INBOX = "site-sourced-311e0184@ctomail.io";
/** The minimal record: no address, no hours, no services, no phone, no email. */
const BASE: BusinessRecord = {
  name: "Example Barber Shop",
  category: "Barber shop",
  form_recipient: OUR_INBOX,
  form_delivery: "demo",
  form_provider: "formspark",
  form_access_key: "test-form-id",
  source_kind: "public-listings",
};
const record = (over: Partial<BusinessRecord> = {}): BusinessRecord => ({ ...BASE, ...over });
const ADDRESS = { street: "1 Ladybug Lane", city: "Hamilton", province: "ON", postcode: "L8P 2A1" };
const HOURS = [{ days: "Mon–Fri", hours: "9:00 am – 5:00 pm" }];
const PHONE = "+1 905-555-0142";
const EMAIL = "shop@example-barber.ca";
const everything = record({ address: ADDRESS, hours: HOURS, phone: PHONE, email: EMAIL });

/** The words a page carries, as a page carries them (the clause reads the rendered html). */
const claims = (rec: BusinessRecord, html: string, file = "index.html") =>
  printedDetailClaimProblems({ record: rec, pages: [{ file, html: `<p>${html}</p>` }] });

/* ------------------------------------------------- what "the record carries" means */
test("carriedDetails: the four details, and only the ones the pages show", () => {
  expect(carriedDetails(record())).toEqual([]);
  expect(carriedDetails(record({ phone: PHONE }))).toEqual(["phone number"]);
  expect(carriedDetails(record({ email: EMAIL }))).toEqual(["email address"]);
  expect(carriedDetails(record({ address: ADDRESS }))).toEqual(["address"]);
  expect(carriedDetails(record({ hours: HOURS }))).toEqual(["hours"]);
  expect(carriedDetails(everything)).toEqual(["hours", "address", "phone number", "email address"]);
  // Fields that exist but the page does not show are not details the page carries: an empty
  // hours list, a blank string, an address with no street, city or postcode.
  expect(carriedDetails(record({ hours: [], phone: " ", email: "\t" }))).toEqual([]);
  expect(carriedDetails(record({ address: { street: "  ", city: "", province: "", postcode: "" } }))).toEqual([]);
  // A street-less address still prints as a line ("Hamilton, ON L8P 2A1"), so it counts.
  expect(carriedDetails(record({ address: { street: "", city: "Hamilton", province: "ON", postcode: "L8P 2A1" } }))).toEqual(["address"]);
});

/* ------------------------------------------------------ the composer's offering line */
const heroLead = (rec: BusinessRecord): string => {
  const form = resolveForm(rec);
  return composeCopy(rec, "example-business", form, resolveDelivery(rec, form)).heroLead;
};

test("the offering line names the details the record carries — and nothing else", () => {
  // The four fixtures' shape: hours, address and a phone, and services recorded (a different
  // sentence entirely, which is why no fixture page moves when this rule lands).
  expect(heroLead(record({ address: ADDRESS, hours: HOURS, phone: PHONE }))).toBe("Hours, address and phone number as published for this barber shop.");
  expect(heroLead(everything)).toBe("Hours, address, phone number and email address as published for this barber shop.");
  // No phone number: the hero may not tell a visitor it carries one.
  expect(heroLead(record({ address: ADDRESS, hours: HOURS, email: EMAIL }))).toBe(
    "Hours, address and email address as published for this barber shop.",
  );
  // A phone and nothing else: one detail, named on its own.
  expect(heroLead(record({ phone: PHONE }))).toBe("Phone number as published for this barber shop.");
  // A fictional record keeps its own wording, on the same carried list.
  expect(heroLead(record({ phone: PHONE, source_kind: "fictional" }))).toBe("Phone number invented for this example barber shop.");
  // Nothing carried: no sentence at all, rather than a list of absences.
  expect(heroLead(record())).toBe("");
});

/* ------------------------------------------- the clause: the hero's offering line */
test("an offering line naming a detail the record does not carry is refused, with the page's own words", () => {
  // The sentence this session's change replaced, doctored back onto a page whose record
  // carries none of the three details it names. This is the class the clause exists for:
  // the check reads the page, so it fires whichever way the claim got there.
  const rec = record();
  expect(claims(rec, "Hours, address and phone number invented for this example barber shop.")).toEqual([
    'index.html names "hours" and "address" and "phone number" in the hero\'s offering line ("Hours, address and phone number invented for this"), ' +
      "but the record for Example Barber Shop carries no hours, no address and no phone number, so no page prints them. " +
      "A page may not name a printed detail it does not print: build the sentence from the record's own details, or drop the clause and say what the page does offer.",
  ]);
  // One missing detail, on a record that carries the others: the message names exactly it.
  const partly = record({ address: ADDRESS, hours: HOURS });
  expect(claims(partly, "Hours, address and phone number as published for this barber shop.")).toEqual([
    'index.html names "phone number" in the hero\'s offering line ("Hours, address and phone number as published for this"), ' +
      "but the record for Example Barber Shop carries no phone number, so no page prints one. " +
      "A page may not name a printed detail it does not print: build the sentence from the record's own details, or drop the clause and say what the page does offer.",
  ]);
});

/* ------------------------------------- the clause: the sentence that points at a detail */
test("a sentence sending a visitor to a detail the record does not carry is refused", () => {
  const rec = record({ phone: PHONE });
  expect(claims(rec, "To reach Example Barber Shop itself, use the phone number or email address printed with it.")).toEqual([
    'index.html names "email address" in the sentence that sends a visitor to a printed detail ("phone number or email address printed with it"), ' +
      "but the record for Example Barber Shop carries no email address, so no page prints one. " +
      "A page may not name a printed detail it does not print: build the sentence from the record's own details, or drop the clause and say what the page does offer.",
  ]);
  // The corrected sentence — the one every page carries today — is clean.
  expect(claims(rec, "To reach Example Barber Shop itself, use the phone number printed with it.")).toEqual([]);
});

/* ------------------------------------------------ the phone half belongs to phoneProblems */
test("the phone number in \"printed with it\" stays phoneProblems' clause, not this one's", () => {
  const rec = record({ email: EMAIL });
  const html = `<p>To reach Example Barber Shop itself, use the phone number printed with it.</p>`;
  // This clause is silent (the phone number is the phone model's own claim) …
  expect(claims(rec, "To reach Example Barber Shop itself, use the phone number printed with it.")).toEqual([]);
  // … and the page is still refused, once, by the clause that owns it.
  const phone = resolvePhone({ record: rec, phase: "demo", fictional: false });
  expect(phoneProblems({ record: rec, phone, phase: "demo", fictional: false, pages: [{ file: "index.html", html }] })).toEqual([
    'index.html tells a visitor to use "the phone number printed with it", but no phone number is recorded for Example Barber Shop, so no page prints one. ' +
      "A page may not send a visitor to a detail it does not show: drop the clause, and say what the page does offer.",
  ]);
});

/* ------------------------------------------------ what the clause deliberately leaves alone */
test("the sentences the clause does not cover are not refused", () => {
  const rec = record();
  for (const html of [
    // The provenance about line names the same three words, in a shape this clause does not
    // claim to read (its standing is source_kind's business).
    "Every detail here — hours, address, contact details — is invented for this fictional example business.",
    "Fictional example business: the name, address, phone number, hours and services on this page were invented by Site Sourced to show the layout.",
    // A statement of absence is the opposite of a claim that a detail is there.
    "No phone number is recorded for this business.",
    "No email address is recorded for this business.",
    // Generic: names no detail, so there is nothing to compare.
    "Sorry, that didn't send. Please use the contact details printed with this form.",
    // Not a claim about a detail at all, and a different preposition.
    "Use the phone number or email address printed on this page",
  ]) {
    expect(claims(rec, html)).toEqual([]);
  }
});
