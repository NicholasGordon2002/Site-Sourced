#!/usr/bin/env bun
/**
 * The privacy notice may only state what we actually do — WORKFLOW.md rule 7
 * (owner-directed 30 Sept, plan revision 13).
 *
 *   bun test test/privacy-notice.test.ts
 *
 * Every failure mode below is one the published page actually shipped, or one the
 * owner's rule names directly. Each is a regression test for a check that runs inside
 * the build's single self-check (`complianceChecks`), so a future edit that reintroduces
 * one fails here and at build time together:
 *
 *   1. the collection list understated what is captured — a phone field the notice never
 *      named, and the IP address / approximate location the provider records with no
 *      visitor typing anything;
 *   2. the retention sentence printed a 30-day window nothing operates, and promised a
 *      deletion we cannot perform for a message the provider's spam filter is holding;
 *   3. the provider's own fact was glued on mid-sentence, which is how a lower-case
 *      "formspark" with no full stop reached a published page;
 *   4. the client's own notice must print no window on the client's behalf — we do not
 *      operate their account, so a number there is a claim about their conduct.
 *
 * No filesystem writes, no network. The one file read is `ops/retention-log.md`, which is
 * the recorded practice the notice is composed from.
 */
import { expect, test } from "bun:test";

import {
  collectionProblems,
  composePrivacy,
  PRIVACY_LAST_UPDATED,
  PRIVACY_NOTICE_SEAL,
  privacyNoticeDigest,
  privacyNoticeProblems,
  privacyNoticeText,
  RETENTION_HEADING,
  type PrivacyNotice,
} from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { profileFor, composeCopy } from "../src/demo/copy.ts";
import { renderPages, type RenderContext } from "../src/demo/render.ts";
import { CADENCES, currentRetentionPractice, readRetentionPractice, type RetentionPractice } from "../src/demo/retention.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

const OUR_INBOX = "site-sourced-311e0184@ctomail.io";
const SLUG = "example-barber-shop";

const BASE: BusinessRecord = {
  name: "Example Barber Shop",
  category: "Barber shop",
  source_kind: "public-listings",
  email: "shop@example-barber.ca",
  form_recipient: OUR_INBOX,
  form_delivery: "demo",
  form_provider: "formspark",
  form_access_key: "test-form-id",
};

/** The same record in the phase a paying client's site is built in. */
const CLIENT: BusinessRecord = { ...BASE, form_recipient: BASE.email!, form_delivery: "business" };

/** The declared practice, as the build reads it. Every case below states it explicitly. */
function declaredPractice(): RetentionPractice {
  const read = readRetentionPractice();
  if (!read.practice) throw new Error(`no retention practice could be read: ${read.problems.join(" ")}`);
  return read.practice;
}

/** A practice the log might declare instead — used to prove the guard is not just "always fail". */
function synthetic(cadence: RetentionPractice["cadence"]): RetentionPractice {
  return { cadence, window: CADENCES[cadence].window, routine: CADENCES[cadence].routine, declaration: `Declared cadence: ${cadence}`, source: "test" };
}

function composed(record: BusinessRecord, practice: RetentionPractice | null = declaredPractice()) {
  const form = resolveForm(record);
  const delivery = resolveDelivery(record, form);
  return { form, delivery, privacy: composePrivacy(record, form, delivery, practice) };
}

/** The notice the build would throw on, as sentences — the same call build.ts makes. */
function problemsFor(privacy: PrivacyNotice, record: BusinessRecord, practice: RetentionPractice | null = declaredPractice()): string[] {
  const { form, delivery } = composed(record, practice);
  return privacyNoticeProblems({ privacy, record, delivery, form, practice });
}

/** The notice with one section's paragraphs edited — how a copy regression is simulated. */
function edit(privacy: PrivacyNotice, heading: string, change: (paragraphs: string[]) => string[]): PrivacyNotice {
  return {
    ...privacy,
    sections: privacy.sections.map((s) => (s.heading === heading ? { ...s, paragraphs: change(s.paragraphs) } : s)),
  };
}

const sectionText = (privacy: PrivacyNotice, heading: string): string =>
  privacy.sections.find((s) => s.heading === heading)?.paragraphs.join(" ") ?? "";

/* ------------------------------------------------------------ the notice as composed */

test("the composed notice passes its own checks, in both phases", () => {
  for (const record of [BASE, CLIENT]) {
    const { privacy } = composed(record);
    // The positive control: without this, every refusal below could be a check that
    // rejects everything.
    expect(privacyNoticeProblems({ privacy, record, delivery: composed(record).delivery, form: composed(record).form, practice: declaredPractice() })).toEqual([]);
  }
});

test("the declared practice is read from the retention log, and `none` supports no number", () => {
  const read = readRetentionPractice();
  expect(read.problems).toEqual([]);
  expect(read.practice?.cadence).toBe("none");
  // The one value the whole retention half turns on. Under `none` the notice prints no
  // window at all, so the window it is allowed to print is empty.
  expect(read.practice?.window).toBe("");
});

test("a missing or unreadable declaration is a build failure, not a softer sentence", () => {
  const missing = readRetentionPractice("/tmp/ss-no-such-retention-log.md");
  expect(missing.practice).toBeNull();
  expect(missing.problems.join(" ")).toContain("could not be read");

  const { privacy } = composed(BASE, null);
  expect(problemsFor(privacy, BASE, null).join("\n")).toContain("no retention cadence was declared");
});

/* ------------------------------------------------------- the collection list (§1) */

test("a Formspark notice that omits what the service records besides the typed fields fails", () => {
  const { privacy } = composed(BASE);
  // The published defect: the notice listed only what the visitor typed.
  const doctored = edit(privacy, "What is collected", (paras) => paras.filter((p) => !p.includes("IP address")));

  const problems = problemsFor(doctored, BASE).join("\n");
  expect(problems).toContain("IP address");
  expect(problems).toContain("does not state what the form service records besides the fields the visitor types");
});

test("the collection sentence names every field the page asks for, phone number included", () => {
  const record = BASE;
  const { privacy } = composed(record);
  expect(sectionText(privacy, "What is collected")).toContain("your phone number if you give one");

  // ...and the check compares the notice with the page the visitor is actually shown.
  const form = resolveForm(record);
  const delivery = resolveDelivery(record, form);
  const ctx: RenderContext = {
    record,
    copy: composeCopy(record, SLUG, form, delivery),
    profile: profileFor(record),
    form,
    delivery,
    privacy,
    images: [],
    slug: SLUG,
    generatedAt: "2026-10-04T00:00:00.000Z",
  };
  const rendered = renderPages(ctx);
  expect(collectionProblems({ pages: rendered, privacy, form })).toEqual([]);

  // The published sentence — name, email and message, with the phone number missing —
  // is refused, and the refusal names the field it left out.
  const doctored = edit(privacy, "What is collected", () => [
    "Only what you type into the contact form: your name, your email address and your message.",
  ]);
  const problems = collectionProblems({ pages: rendered, privacy: doctored, form }).join("\n");
  expect(problems).toContain("does not match the fields the form renders");
  expect(problems).toContain("The form asks for name, email, phone, message");
});

/* ------------------------------------------------------- retention and deletion (§2) */

test("a retention window under the declared `none` cadence fails the build", () => {
  const { privacy } = composed(BASE);
  // The sentence the published page carried. Nothing runs a sweep every second day.
  const doctored = edit(privacy, RETENTION_HEADING, (paras) => [...paras, "It is deleted within 30 days of arriving."]);

  const problems = problemsFor(doctored, BASE).join("\n");
  expect(problems).toContain("prints a retention window the declared cadence does not support");
  expect(problems).toContain("within 30 days");
  expect(problems).toContain("supports no number at all");
});

test("a window the declared routine does support is not refused", () => {
  // The guard is an allow-list, not a ban: with a monthly pass declared, "about two
  // months" is exactly the largest honest claim and must pass.
  const monthly = synthetic("monthly");
  const { privacy } = composed(BASE, monthly);
  expect(privacy.retention.window).toBe("about two months");
  expect(sectionText(privacy, RETENTION_HEADING)).toContain("nothing a visitor sends stays longer than about two months");
  expect(problemsFor(privacy, BASE, monthly)).toEqual([]);
});

test("an offer to delete a message the spam filter is holding fails the build", () => {
  const { privacy } = composed(BASE);
  // The exact promise research/privacy-wording.md §4.2 says we can never keep.
  const doctored = edit(privacy, "Your choices", (paras) => [
    ...paras,
    "If the spam filter is holding a message, we will delete it as soon as you ask.",
  ]);

  const problems = problemsFor(doctored, BASE).join("\n");
  expect(problems).toContain("promises a deletion we cannot perform");
  expect(problems).toContain("we will delete it as soon as you ask");
});

test("the honest version of the same sentence is what the composed notice prints", () => {
  const { privacy } = composed(BASE);
  const choices = sectionText(privacy, "Your choices");
  expect(choices).toContain("only Formspark can remove it");
  expect(choices).toContain("Formspark releases it after 12 months");
  // The provider's own limit is stated in its own words, not as our promise.
  expect(sectionText(privacy, RETENTION_HEADING)).toContain("cannot be deleted earlier");
});

/* ------------------------------------------------ the provider's facts are sentences (§3) */

test("the provider's facts print as their own sentences, never glued mid-sentence", () => {
  const { privacy } = composed(BASE);
  const text = privacyNoticeText(privacy);

  expect(privacy.retention.providerFacts.length).toBeGreaterThan(0);
  for (const fact of privacy.retention.providerFacts) {
    // Sentence case and a full stop: the shipped defect was a lower-case brand name
    // appended to one of our sentences, mid-sentence, with no full stop.
    expect(fact).toMatch(/^[A-Z]/);
    expect(fact).toMatch(/[.!?]$/);
    expect(text).toContain(fact);
  }
  expect(sectionText(privacy, RETENTION_HEADING)).toBe(privacy.retention.providerFacts.join(" ") + " " + privacy.retention.practiceSentence);

  // The brand name is never lowercase anywhere in the notice.
  expect(text).not.toMatch(/\bformspark\b/);
});

/* ---------------------------------------------------------- the client's own notice (§5) */

test("the client's notice prints no window, names the client as the one who deletes, and offers the route", () => {
  const { privacy } = composed(CLIENT);
  expect(privacy.mode).toBe("business");
  expect(privacy.retention.practiceSentence).toBe("");
  expect(privacy.retention.window).toBe("");

  const retention = sectionText(privacy, RETENTION_HEADING);
  const choices = sectionText(privacy, "Your choices");
  expect(retention).toContain(`${CLIENT.name} deletes messages from it`);
  expect(retention).toContain("cannot promise a timetable");
  expect(retention).toContain("to ask for yours to be deleted");
  // The client's own address is the route a visitor is given, not ours.
  expect(choices).toContain(BASE.email!);
  expect(choices).not.toContain(OUR_INBOX);
  expect(problemsFor(privacy, CLIENT)).toEqual([]);
});

test("a window printed on the client's behalf fails the build", () => {
  const { privacy } = composed(CLIENT);
  // Nothing on the client's page states a routine we do not run for them.
  const doctored = edit(privacy, RETENTION_HEADING, (paras) => [...paras, "Messages are deleted within 30 days."]);

  const problems = problemsFor(doctored, CLIENT).join("\n");
  expect(problems).toContain("the client's privacy notice prints a retention window");
  expect(problems).toContain("a claim about their conduct we cannot ground");
});

test("a client notice that names nobody as the one who deletes fails the build", () => {
  const { privacy } = composed(CLIENT);
  const doctored = edit(privacy, RETENTION_HEADING, (paras) => paras.filter((p) => !p.includes("deletes messages from it")));

  const problems = problemsFor(doctored, CLIENT).join("\n");
  expect(problems).toContain("does not name Example Barber Shop as the party who holds and deletes");
});

test("a place the record never carried is not printed on the client's behalf", () => {
  // The hard-coded "{Business}, Ontario, Canada" of the previous wording. This record
  // carries no address, so the notice must state no place.
  const { privacy } = composed(CLIENT);
  expect(sectionText(privacy, "Who we are")).toBe(`${CLIENT.name}. Privacy contact: ${BASE.email}.`);

  const withPlace = edit(privacy, "Who we are", () => [`${CLIENT.name}, Ontario, Canada. Privacy contact: ${BASE.email}.`]);
  expect(problemsFor(withPlace, CLIENT).join("\n")).toContain('prints "ontario" although the record carries no such place');

  // ...and a record that does carry one prints it, derived.
  const hamilton: BusinessRecord = { ...CLIENT, address: { city: "Hamilton", province: "ON" } };
  const derived = composed(hamilton);
  expect(sectionText(derived.privacy, "Who we are")).toContain(`${CLIENT.name}, Hamilton, ON`);
  expect(problemsFor(derived.privacy, hamilton)).toEqual([]);
});

/* ------------------------------------------------------------- the wording is sealed */

test("the notice's wording and its date are sealed together", () => {
  const digest = privacyNoticeDigest([composed(BASE).privacy, composed(CLIENT).privacy]);
  expect(
    digest === PRIVACY_NOTICE_SEAL,
    `the composed privacy notice has changed.\n  recorded seal: ${PRIVACY_NOTICE_SEAL}\n  composed now : ${digest}\n` +
      `If the change is intended, move PRIVACY_LAST_UPDATED (now "${PRIVACY_LAST_UPDATED}") to the date it ships and set PRIVACY_NOTICE_SEAL to the digest above — in the same commit. If it is not intended, revert the sentence.`,
  ).toBe(true);
});
