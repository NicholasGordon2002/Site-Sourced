#!/usr/bin/env bun
/**
 * The form-delivery guard, exercised on its own.
 *
 *   bun test test/delivery.test.ts
 *
 * No filesystem, no network, and nothing is sent anywhere. This is the regression
 * test for the mistake that put a false claim on our own published demo: the page
 * told visitors their message went straight to the business and that we only
 * passed it along, when in fact it landed in Site Sourced's Formspark inbox, which
 * emails us and keeps a copy.
 *
 * What it pins down:
 *
 *   (a) `form_recipient` equal to the business's own published address  -> `business`
 *   (b) `form_recipient` pointing at our own inbox                      -> `demo`
 *   (c) a `form_delivery` claim the endpoint contradicts                -> refused
 *   (d) a recipient that cannot receive mail (a reserved domain)        -> refused
 *
 * (a) and (b) are the derivation; (c) and (d) are the cases where the derivation
 * and the record could disagree, and the guard's answer there is to fail the build
 * rather than publish either wording. Fixtures are fictional.
 */
import { expect, test } from "bun:test";

import { composeCopy, guardCopy } from "../src/demo/copy.ts";
import { isUndeliverable, resolveDelivery } from "../src/demo/delivery.ts";
import { formDeliveryProblems } from "../src/demo/delivery.ts";
import { KEY_PLACEHOLDER, resolveForm } from "../src/demo/forms.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

const BUSINESS_EMAIL = "shop@example-barber.ca";
const BUSINESS_NAME = "Example Barber Shop";
const OUR_INBOX = "site-sourced-311e0184@ctomail.io";

function record(over: Partial<BusinessRecord> = {}): BusinessRecord {
  return {
    name: BUSINESS_NAME,
    category: "Barber shop",
    email: BUSINESS_EMAIL,
    form_recipient: OUR_INBOX,
    form_provider: "formspark",
    form_access_key: "test-form-id",
    ...over,
  } as BusinessRecord;
}

/** Everything the single build self-check would refuse, for one record. */
function problemsFor(rec: BusinessRecord): string[] {
  const form = resolveForm(rec);
  const delivery = resolveDelivery(rec, form);
  const copy = composeCopy(rec, "example-barber-shop", form, delivery);
  return formDeliveryProblems({ record: rec, form, noticeMode: copy.formNoticeDelivery, placeholder: KEY_PLACEHOLDER });
}

// (a) The real-prospect case: the endpoint posts to the business's own published
// address, so the page may say the message reaches the business.
test("(a) recipient is the business's published address -> the business phase", () => {
  const rec = record({ form_recipient: BUSINESS_EMAIL, form_delivery: "business" });
  const form = resolveForm(rec);
  const delivery = resolveDelivery(rec, form);

  expect(delivery.mode).toBe("business");
  expect(delivery.party).toBe(BUSINESS_NAME);
  expect(delivery.claimed_by_record).toBe("business");
  expect(delivery.basis).toContain("is the business's own published contact address");

  const copy = composeCopy(rec, "example-barber-shop", form, delivery);
  expect(copy.formNoticeDelivery).toBe("business");
  expect(copy.formNotice).toContain(`This form sends your message to ${BUSINESS_NAME}`);
  expect(copy.formNotice).toContain(`${BUSINESS_NAME}'s own Formspark account`);
  expect(copy.formNotice).toContain("Site Sourced never receives a copy");
  expect(copy.formNotice).not.toContain("demonstration site");
  expect(problemsFor(rec)).toEqual([]);
});

// (b) Our own demo: the recipient is Site Sourced's inbox, so the page must say so
// and must not read as the business's own site.
test("(b) recipient is our own inbox -> the demonstration phase", () => {
  const rec = record({ form_delivery: "demo" });
  const form = resolveForm(rec);
  const delivery = resolveDelivery(rec, form);

  expect(delivery.mode).toBe("demo");
  expect(delivery.party).toBe("Site Sourced");
  expect(delivery.basis).toContain("is not the business's published contact address");

  const copy = composeCopy(rec, "example-barber-shop", form, delivery);
  expect(copy.formNoticeDelivery).toBe("demo");
  expect(copy.formNotice).toContain("This is a demonstration site");
  expect(copy.formNotice).toContain(`not to ${BUSINESS_NAME}`);
  expect(copy.formNotice).toContain("has not seen this page");
  expect(copy.formNotice).toContain("will not receive your message");
  // The storage half must describe the provider truthfully: Formspark keeps a copy.
  expect(copy.formNotice).toContain("Formspark emails it to Site Sourced");
  expect(copy.formNotice).toContain("also keeps a copy");
  // Nothing in the notice may read as the business's own site.
  expect(copy.formNotice).not.toContain(`${BUSINESS_NAME}'s own Formspark account`);
  expect(guardCopy(copy.formNotice, rec)).toEqual([]);
  expect(problemsFor(rec)).toEqual([]);
});

// (c) The exact mistake: a record claiming business delivery while the endpoint
// posts somewhere else. The guard must refuse it, not pick a wording.
test("(c) a form_delivery claim the endpoint contradicts is refused", () => {
  const rec = record({ form_delivery: "business" }); // claims business, routes to our inbox
  const problems = problemsFor(rec);

  expect(problems.length).toBeGreaterThan(0);
  expect(problems.join(" ")).toContain("asserts delivery to the business itself");
  expect(problems.join(" ")).toContain("A record must not be able to claim business delivery while routing to an address that is not the business's");
});

test("(c) a notice claiming the business while the form routes elsewhere is refused", () => {
  const rec = record({ form_delivery: "demo" });
  const form = resolveForm(rec);
  const problems = formDeliveryProblems({ record: rec, form, noticeMode: "business", placeholder: KEY_PLACEHOLDER });
  expect(problems.join(" ")).toContain("A page must not claim business delivery while routing somewhere else");
});

test("(c) a form_delivery value that is neither claim is refused", () => {
  const rec = record({ form_delivery: "maybe" as never });
  expect(problemsFor(rec).join(" ")).toContain('form_delivery must be "business" or "demo"');
});

// (d) A recipient that cannot receive mail: reserved domains per RFC 2606 / 6761,
// and malformed or empty addresses. A page promising delivery to one of these lies.
test("(d) a recipient on a reserved domain or otherwise undeliverable is refused", () => {
  expect(isUndeliverable("someone@example.com")).toBe(true);
  expect(isUndeliverable("someone@sub.example")).toBe(true);
  expect(isUndeliverable("shop@example.org")).toBe(true);
  expect(isUndeliverable("shop@mail.example.com")).toBe(true);
  expect(isUndeliverable("shop@test")).toBe(true);
  expect(isUndeliverable("shop@invalid")).toBe(true);
  expect(isUndeliverable("")).toBe(true);
  expect(isUndeliverable("not-an-address")).toBe(true);
  expect(isUndeliverable(OUR_INBOX)).toBe(false);
  expect(isUndeliverable("shop@mapleavenuebarber.ca")).toBe(false);
  expect(isUndeliverable("info@examplebarber.ca")).toBe(false);

  const rec = record({
    form_recipient: "shop@example-barber.example",
    email: "shop@example-barber.example", // matches, so only the dead address is wrong
    form_delivery: "business",
  });
  expect(problemsFor(rec).join(" ")).toContain("cannot receive mail");
});

// Supporting cases, so a record cannot reach the delivery phase without one.
test("an unconfigured endpoint fails the build", () => {
  const rec = record({ form_access_key: undefined });
  const problems = problemsFor(rec);
  expect(problems.join(" ")).toContain("form endpoint is not configured");
  expect(problems.join(" ")).toContain(KEY_PLACEHOLDER);
});

test("a record with no published address cannot be in the delivery phase", () => {
  const rec = record({ email: undefined, form_delivery: "business" });
  expect(problemsFor(rec).join(" ")).toContain("no published contact address");
});

test("a recipient of `mailto:` and mixed case is still compared as the same address", () => {
  const rec = record({ form_recipient: `MAILTO:${BUSINESS_EMAIL.toUpperCase()}`, form_delivery: "business" });
  expect(resolveDelivery(rec, resolveForm(rec)).mode).toBe("business");
  expect(problemsFor(rec)).toEqual([]);
});
