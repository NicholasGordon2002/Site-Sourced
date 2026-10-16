#!/usr/bin/env bun
/**
 * **What a client receives: the site, and no record of ours.**
 *
 *   bun test test/delivered-record.test.ts
 *
 * A delivered bundle used to ship `manifest.json` beside the pages. The rule it answers to
 * is the plan's — **"A client's files never describe the demonstration phase"** — and the
 * record describes the demonstration phase on nearly every line: it lists the furniture a
 * proposal carries ("the takedown promise", "the sentence about being marked noindex"), it
 * quotes the owner's directions and the lead's rulings with their dates, it names our own
 * switches (`DEMO_GHOST_CONTROLS`, `DEMO_SERVICE_CARD_ACTION_BAR`), it calls other bundles
 * "the review copy", and it explains decisions in a register written for us — "…describe an
 * unconfirmed proposal whose details we had to find, and a client's own site is neither".
 * A folder is handed over whole, and the delivered README tells the client to upload it as
 * it is, so the record would not merely sit beside the site: it would land in the client's
 * public web root.
 *
 * So the record is a **phase item**, like the proposal banner: written while a bundle is a
 * demonstration, absent from a delivered one, and refused by name if a delivered folder
 * carries it — or a line of the prose we write for ourselves, in any file of the site.
 * `internalRecordProblems` is that refusal; `INTERNAL_RECORD_MARKERS` is the pattern half.
 *
 * What is pinned here:
 *
 *   1. the delivered fixture, built by the build's own path, ships the site, the client's
 *      README and **eighteen files and no record** — with every file's name listed;
 *   2. the demonstration twin still carries its record, and every registered marker is
 *      really in that record — a sample cannot drift away from the artifact;
 *   3. the refusal fires, by name, on a delivered folder carrying the record and on a page
 *      carrying a line of our own decision record;
 *   4. a demonstration that lost its record is refused too (the other direction);
 *   5. the markers never fire on a client's own copy — "under new ownership", "the lead
 *      time on a custom order" and "our lead stylist" are all clean, because a client's
 *      build must never fail on the client's own words;
 *   6. a delivered build **clears** a record an earlier demonstration run left in the
 *      folder, rather than shipping it.
 */
import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildBundle, internalRecordProblems, readBundleTexts } from "../src/demo/build.ts";
import { INTERNAL_RECORD_MARKERS, REFUSAL_SAMPLES } from "../src/demo/refusal-registry.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

/** The test-only delivered-phase record (`test/records/business-phase.json`). */
const RECORD = JSON.parse(await Bun.file(join(import.meta.dir, "records", "business-phase.json")).text()) as BusinessRecord;

/** Site Sourced's own test inbox — the address that turns the same record into a demonstration. */
const OUR_INBOX = "site-sourced-311e0184@ctomail.io";

/** The test's own form id: a test must not need a secret, and the id is a per-client value. */
const DELIVERED: BusinessRecord = { ...RECORD, form_access_key: "test-form-id" };
const DEMONSTRATION: BusinessRecord = { ...DELIVERED, form_recipient: OUR_INBOX, form_delivery: "demo", booking_url: "" };

/** Every text file of the delivered fixture, as `readBundleTexts` reads them back. */
const DELIVERED_TEXT_FILES = [
  "README.txt",
  "about.html",
  "contact-beard-trim.html",
  "contact-haircut.html",
  "contact-hot-shave.html",
  "contact.html",
  "favicon.svg",
  "fonts/OFL.txt",
  "index.html",
  "privacy.html",
  "services.html",
  "site.js",
  "styles.css",
];

interface Built {
  dir: string;
  files: string[];
  warnings: string[];
}

/** Build a record the way the CLI does, into a folder the test owns. */
async function build(record: BusinessRecord, into: string): Promise<Built> {
  const result = await buildBundle(record, {
    outRoot: into,
    cacheDir: join(into, "cache"),
    recordDir: join(import.meta.dir, "records"),
    noImages: false,
    refresh: false,
    onNote: () => {},
  });
  return { dir: result.dir, files: result.files, warnings: result.warnings };
}

/** A folder the test owns, removed whatever the test does. */
async function temp<T>(body: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "delivered-record-"));
  try {
    return await body(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/* -------------------------------------------------- what a client actually receives */

test("the delivered fixture ships the site, the client's README — and no record of ours", async () => {
  await temp(async (tmp) => {
    const b = await build(DELIVERED, tmp);
    expect(b.files.includes("manifest.json")).toBe(false);
    expect(existsSync(join(b.dir, "manifest.json"))).toBe(false);
    // Eighteen files: the nine pages, the client's README, the stylesheet, the one script,
    // the favicon, the licence beside the two fonts, three hero variants, two fonts.
    expect(b.files.length).toBe(18);
    expect(b.files).toEqual([
      "README.txt",
      "about.html",
      "contact-beard-trim.html",
      "contact-haircut.html",
      "contact-hot-shave.html",
      "contact.html",
      "favicon.svg",
      "fonts/OFL.txt",
      "fonts/fraunces-latin-600.woff2",
      "fonts/source-sans-3-latin.woff2",
      "images/barber-hero-1200.jpg",
      "images/barber-hero-600.jpg",
      "images/barber-hero-900.jpg",
      "index.html",
      "privacy.html",
      "services.html",
      "site.js",
      "styles.css",
    ]);
    // The check, run on the folder as it stands: nothing in it is written for us.
    const carried = await readBundleTexts(b.dir);
    expect(carried.map((f) => f.file)).toEqual(DELIVERED_TEXT_FILES);
    expect(internalRecordProblems({ mode: "business", carried })).toEqual([]);
  });
});

/* --------------------------------------- the demonstration keeps it, derivation not deletion */

test("the demonstration twin still carries its record, and every marker is really in it", async () => {
  await temp(async (tmp) => {
    const demo = await build(DEMONSTRATION, tmp);
    expect(demo.files.includes("manifest.json")).toBe(true);
    const carried = await readBundleTexts(demo.dir);
    // The other direction of the same rule: a demonstration without its record is refused.
    expect(internalRecordProblems({ mode: "demo", carried })).toEqual([]);

    const record = carried.find((f) => f.file === "manifest.json")?.contents ?? "";
    expect(record.length).toBeGreaterThan(1000);
    // Every sample the registry holds for these markers is a line of the record this build
    // writes — so a sample cannot quietly stop describing the artifact it stands for.
    for (const [what] of INTERNAL_RECORD_MARKERS) {
      const samples = REFUSAL_SAMPLES[what] ?? [];
      expect(`${what}: ${samples.length > 0}`).toBe(`${what}: true`);
      for (const sample of samples) expect(`${what}: ${record.includes(sample)}`).toBe(`${what}: true`);
    }
    // …and the same folder, judged as a delivered one, is refused by every one of them.
    const refused = internalRecordProblems({ mode: "business", carried });
    expect(refused.length).toBe(INTERNAL_RECORD_MARKERS.length);
    for (const [what] of INTERNAL_RECORD_MARKERS) expect(refused.join(" | ")).toContain(what);
    expect(refused.join(" | ")).toContain("manifest.json: carries the build's own record");
  });
});

/* ------------------------------------------------------------------- can it actually fire */

test("a delivered folder that carries the record, or a line of our own notes, is refused by name", async () => {
  const problems = internalRecordProblems({
    mode: "business",
    carried: [
      { file: "manifest.json", contents: '{"generator": "sitesourced-demo-generator/0.1"}' },
      { file: "contact.html", contents: "<p>The slot was settled by the owner-approved wording.</p>" },
      { file: "README.txt", contents: "Set DEMO_GHOST_CONTROLS and rebuild." },
    ],
  });
  expect(problems.length).toBe(3);
  expect(problems[0]).toContain("manifest.json: carries the build's own record");
  expect(problems[1]).toContain("contact.html: carries a line from our own decision record");
  expect(problems[2]).toContain("README.txt: carries a configuration variable of our own");
  const message = problems.join(" | ");
  expect(message).toContain("but this bundle is a delivered site");
  expect(message).toContain("A client's files never describe the demonstration phase");
});

test("a demonstration that has lost its record is refused, by name", async () => {
  const problems = internalRecordProblems({
    mode: "demo",
    carried: [{ file: "index.html", contents: "<p>A page of the site.</p>" }],
  });
  expect(problems.length).toBe(1);
  expect(problems[0]).toContain("this folder is a demonstration and carries no record of itself");
  expect(problems[0]).toContain("sitesourced-demo-generator");
});

test("the markers never fire on a client's own words: a build must not fail on the client's copy", () => {
  const prose = [
    "<p>Under new ownership since 2016, and the owner directs the shop himself.</p>",
    "<p>The lead time on a custom order is two weeks; ask at the counter.</p>",
    "<p>Our lead stylist takes walk-ins on Saturdays.</p>",
    "<p>Reviews, ratings and testimonials about the shop.</p>",
  ];
  expect(internalRecordProblems({ mode: "business", carried: prose.map((contents, i) => ({ file: `${i}.html`, contents })) })).toEqual([]);
});

/* ------------------------------------------------- and it clears one left by an earlier run */

test("a delivered build clears a record an earlier demonstration run left in the folder", async () => {
  await temp(async (tmp) => {
    const first = await build(DELIVERED, tmp);
    await Bun.write(join(first.dir, "manifest.json"), '{\n  "generator": "sitesourced-demo-generator/0.1"\n}\n');
    const second = await build(DELIVERED, tmp);
    expect(existsSync(join(second.dir, "manifest.json"))).toBe(false);
    expect(second.files.includes("manifest.json")).toBe(false);
    expect(second.warnings.join(" | ")).toContain("removed manifest.json, the build's own record, left in this folder by an earlier run");
    expect(internalRecordProblems({ mode: "business", carried: await readBundleTexts(second.dir) })).toEqual([]);
  });
});
