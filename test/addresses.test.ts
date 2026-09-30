#!/usr/bin/env bun
/**
 * Every address a bundle posts to *or prints*, and the build's refusal to publish one
 * that provably goes nowhere.
 *
 *   bun test test/addresses.test.ts
 *
 * This is the regression test for a defect the independent home-page audit found on
 * 29 Sept: the undeliverable-address guard ran over the form's **delivery recipient**
 * only, never over the address **printed on the page**. A demonstration page therefore
 * told visitors to write to `shop@mapleavenuebarber.example` — a domain reserved by
 * RFC 2606, which can never receive mail — while the build reported nothing wrong.
 *
 * What it pins down:
 *
 *   (a) the shared function covers both halves: the form's recipient, and every address
 *       the rendered pages print (a `mailto:` link or plain text),
 *   (b) a printed address that cannot work fails the build, naming the page and the
 *       address — even when the form's recipient is perfectly fine,
 *   (c) an address that is merely *unverified* passes: the build does no DNS, no MX and
 *       no SMTP, and the printed "please confirm" caveat is what covers that case,
 *   (d) the whole compliance self-check carries the rule, so a bundle cannot skip it.
 *
 * No network, no filesystem. Fixtures are fictional.
 */
import { expect, test } from "bun:test";

import { addressesPrintedIn, isUndeliverable, printedAddresses, undeliverableAddressProblems } from "../src/demo/addresses.ts";
import { complianceChecks } from "../src/demo/build.ts";
import { composeCopy, composePrivacy, profileFor } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { renderIndex, type RenderContext } from "../src/demo/render.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

const OUR_INBOX = "site-sourced-311e0184@ctomail.io";
const SLUG = "example-barber-shop";

function record(over: Partial<BusinessRecord> = {}): BusinessRecord {
  return {
    name: "Example Barber Shop",
    category: "Barber shop",
    email: "shop@example-barber.ca",
    form_recipient: OUR_INBOX,
    form_delivery: "demo",
    form_provider: "formspark",
    form_access_key: "test-form-id",
    source_kind: "public-listings",
    ...over,
  };
}

/** Render the home page exactly as the build does, and hand back html + context. */
function page(rec: BusinessRecord): { html: string; ctx: RenderContext } {
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
    images: [],
    slug: SLUG,
    generatedAt: "2026-09-29T00:00:00.000Z",
  };
  return { html: renderIndex(ctx), ctx };
}

/** The one shared guard, over a record and its rendered pages. */
function addressProblems(rec: BusinessRecord, html: string): string[] {
  const form = resolveForm(rec);
  return undeliverableAddressProblems({ record: rec, form, pages: [{ file: "index.html", html }] });
}

test("(a) every address a page prints is found, whether linked or plain text", () => {
  const html = `
    <a href="mailto:shop@mapleavenuebarber.example">shop@mapleavenuebarber.example</a>
    <p>Or write to us at hello@example-barber.ca.</p>
    <p>Privacy contact: ${OUR_INBOX}</p>`;
  const found = addressesPrintedIn({ file: "index.html", html });
  expect(found.map((u) => u.address).sort()).toEqual(
    ["hello@example-barber.ca", "shop@mapleavenuebarber.example", OUR_INBOX].sort(),
  );
  // Once per address, however many times the page repeats it.
  expect(printedAddresses([{ file: "index.html", html }])).toHaveLength(3);
});

test("(b) an address printed on the page that cannot work fails the build", () => {
  // The form's recipient is our own, working inbox: the dead address is only ever
  // *printed*, which is exactly the half the old guard could not see.
  const rec = record({ email: "shop@mapleavenuebarber.example" });
  const { html, ctx } = page(rec);
  expect(html).toContain("shop@mapleavenuebarber.example");

  const problems = addressProblems(rec, html);
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("shop@mapleavenuebarber.example");
  expect(problems[0]).toContain("cannot receive mail");
  expect(problems[0]).toContain("index.html");

  // ...and it reaches the one compliance self-check the build throws on.
  const checked = complianceChecks({
    pages: [{ id: "index", file: "index.html", html }],
    record: rec,
    copy: ctx.copy,
    form: ctx.form,
    delivery: ctx.delivery,
    images: [],
    privacy: ctx.privacy,
  });
  expect(checked.join(" ")).toContain("shop@mapleavenuebarber.example");
});

test("(b) the same rule covers the form's recipient", () => {
  const rec = record({ form_recipient: "someone@example.invalid" });
  const { html } = page(rec);
  expect(addressProblems(rec, html).join(" ")).toContain("the form's recipient");
  expect(addressProblems(rec, html).join(" ")).toContain("cannot receive mail");
});

test("(c) an address that is merely unverified passes — no DNS, no MX, no network", () => {
  // A well-formed address we have never checked. The build cannot verify a prospect's
  // mailbox and must not pretend to: this is what the printed caveat is for.
  const rec = record({ email: "shop@example-barber.ca" });
  const { html, ctx } = page(rec);
  expect(addressProblems(rec, html)).toEqual([]);
  expect(isUndeliverable("shop@example-barber.ca")).toBe(false);
  expect(isUndeliverable("info@mapleavenuebarber.ca")).toBe(false);

  const checked = complianceChecks({
    pages: [{ id: "index", file: "index.html", html }],
    record: rec,
    copy: ctx.copy,
    form: ctx.form,
    delivery: ctx.delivery,
    images: [],
    privacy: ctx.privacy,
  });
  expect(checked.join(" ")).not.toContain("cannot receive mail");
});

test("(c) reserved, malformed and empty addresses cannot work, wherever they appear", () => {
  for (const bad of ["shop@example.com", "shop@x.example", "shop@example.org", "shop@test", "shop@invalid", "shop@localhost", "not-an-address", "", "shop@nodot", "spaced out@example-barber.ca"]) {
    expect(isUndeliverable(bad)).toBe(true);
  }
  // Ours, and a plausible business address, are fine.
  expect(isUndeliverable(OUR_INBOX)).toBe(false);
  expect(isUndeliverable("mailto:Shop@Example-Barber.CA")).toBe(false);
});
