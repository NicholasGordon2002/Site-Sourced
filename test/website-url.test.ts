#!/usr/bin/env bun
/**
 * The business's current website is recorded and **never printed**.
 *
 *   bun test test/website-url.test.ts
 *
 * Intake question 14 asks a client for their current website, and until now the answer had
 * nowhere to live. `website_url` stores it; `websiteUrlProblems` (build.ts) keeps it honest
 * in two directions:
 *
 *   1. the value is one absolute `https` URL, or blank — a bare `example.com`, an `http://`
 *      address, a `mailto:` or a number fails the build;
 *   2. no page presents it, as a booking or a contact action or anywhere else, and a record
 *      that names its own website as its booking page is refused.
 *
 * The decoys matter as much as the refusals: a business at `example.com` whose printed
 * email is `shop@example.com` must not be refused for printing its own address.
 */
import { expect, test } from "bun:test";
import { websiteUrlProblems } from "../src/demo/build.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

const BASE: BusinessRecord = {
  name: "Example Barber Shop",
  category: "Barber shop",
  form_recipient: "site-sourced-311e0184@ctomail.io",
  source_kind: "public-listings",
};
const record = (over: Partial<BusinessRecord> = {}): BusinessRecord => ({ ...BASE, ...over });

const page = (html: string, file = "contact.html") => ({ file, html });
const problems = (rec: BusinessRecord, pages: { file: string; html: string }[] = [], bookingUrl = "") =>
  websiteUrlProblems({ record: rec, pages, bookingUrl });

const SITE = "https://old-site.example-barber.ca";

/* --------------------------------------------------------- absent, blank, well-formed */
test("no value, and a blank value, are both 'no website recorded'", () => {
  expect(problems(record())).toEqual([]);
  expect(problems(record({ website_url: "" }))).toEqual([]);
  expect(problems(record({ website_url: "   " }))).toEqual([]);
});

test("one absolute https URL passes, and changes nothing on the page", () => {
  const rec = record({ website_url: SITE });
  expect(problems(rec, [page(`<p>Call us on +1 905-555-0142.</p>`)])).toEqual([]);
  expect(problems(record({ website_url: "https://old-site.example-barber.ca/about" }))).toEqual([]);
});

/* ------------------------------------------------------------------ the value's shape */
test("a value that is not an absolute https URL is refused, and says why", () => {
  for (const bad of ["old-site.example-barber.ca", "http://old-site.example-barber.ca", "mailto:shop@example.com", "https://"]) {
    const out = problems(record({ website_url: bad }));
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("is not an absolute https URL");
    expect(out[0]).toContain(bad);
  }
});

test("a value that is not a string at all is refused rather than coerced", () => {
  const out = websiteUrlProblems({ record: { ...BASE, website_url: 42 as unknown as string }, pages: [] });
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("is not a string");
});

/* --------------------------------------------------- never printed, never an action */
test("a page that presents the website as a contact action is refused, by file", () => {
  const out = problems(record({ website_url: SITE }), [
    page(`<p><a class="button" href="${SITE}">Contact us</a></p>`),
  ]);
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("contact.html: prints the record's website_url");
  expect(out[0]).toContain("stored and never printed");
});

test("the same address without its scheme is refused too — printing it by name is the same act", () => {
  const out = problems(record({ website_url: SITE }), [
    page(`<p>Find us at old-site.example-barber.ca/about</p>`, "about.html"),
  ]);
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("about.html: prints the record's website_url");
});

test("a booking link that points at the website is refused: the website does not book a time", () => {
  const out = problems(record({ website_url: SITE, booking_url: SITE }));
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("booking_url is its website_url");
  // …and the same address written with a trailing slash is the same address.
  const slash = problems(record({ website_url: `${SITE}/`, booking_url: SITE }));
  expect(slash).toHaveLength(1);
  expect(slash[0]).toContain("booking_url is its website_url");
});

test("a build whose resolved booking link is the website is refused the same way", () => {
  const out = problems(record({ website_url: SITE }), [], `${SITE}/`);
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("this build's booking link points at the record's website_url");
});

/* ------------------------------------------------------------------------- decoys */
test("a business at the same host printing its own email is not refused", () => {
  const rec = record({
    website_url: "https://example.com",
    email: "shop@example.com",
    form_recipient: "shop@example.com",
  });
  expect(problems(rec, [page(`<p>Email <a href="mailto:shop@example.com">shop@example.com</a></p>`)])).toEqual([]);
});

test("an unrelated link on the page is not refused", () => {
  const rec = record({ website_url: SITE, booking_url: "https://calendar.example.com/example-barber" });
  expect(problems(rec, [page(`<a href="https://calendar.example.com/example-barber">Book a time ↗</a>`)])).toEqual([]);
});
