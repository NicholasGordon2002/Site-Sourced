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
 *      folder, rather than shipping it;
 *   7. our **own** record of a delivered build is written **beside** the folder
 *      (`<slug>.build-record.json` in the output root) — never inside it — carrying the
 *      slug, the phase, the file list, the bytes measured from disk, the warnings and the
 *      derivation bases the CLI's `--summary` omits, each copied from the build's own
 *      manifest; a demonstration writes none beside it and clears one an earlier delivered
 *      build left there, and a build that fails leaves none behind.
 */
import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BUILD_RECORD_SUFFIX, buildBundle, internalRecordProblems, readBundleTexts } from "../src/demo/build.ts";
import { GHOST_CONTROLS_VAR } from "../src/demo/ghost-controls.ts";
import { GRAPHICS_VAR } from "../src/demo/graphics-wiring.ts";
import { INTERNAL_RECORD_MARKERS, REFUSAL_SAMPLES } from "../src/demo/refusal-registry.ts";
import { SERVICE_CARD_ACTION_VAR } from "../src/demo/service-card-action.ts";
import type { BusinessRecord, DeliveredBuildRecord } from "../src/demo/types.ts";

/** The test-only delivered-phase record (`test/records/business-phase.json`). */
const RECORD = JSON.parse(await Bun.file(join(import.meta.dir, "records", "business-phase.json")).text()) as BusinessRecord;

/** Site Sourced's own test inbox — the address that turns the same record into a demonstration. */
const OUR_INBOX = "site-sourced-311e0184@ctomail.io";

/** The test's own form id: a test must not need a secret, and the id is a per-client value. */
const DELIVERED: BusinessRecord = { ...RECORD, form_access_key: "test-form-id" };
// The twin also declares a source a **demonstration** may claim: the record declares
// `client-supplied`, which is a delivered site's claim and is refused by name on a
// proposal (provenance.ts, test/provenance.test.ts), so the demo declares published
// details instead and the phase machinery below is what these tests measure.
const DEMONSTRATION: BusinessRecord = {
  ...DELIVERED,
  source_kind: "public-listings",
  form_recipient: OUR_INBOX,
  form_delivery: "demo",
  booking_url: "",
};

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
  slug: string;
  dir: string;
  files: string[];
  warnings: string[];
  bytes: number;
}

/**
 * The three review switches, by the name the build reads.
 *
 * The manifest records what this build did with each of them, and the samples the registry
 * holds for "a configuration variable of our own" are lines of a build with all three left
 * unset. Our normal build shell exports them, so a build here would otherwise write a
 * different record depending on the shell it was started from. This file therefore controls
 * its own environment: each build pins the three off, and the shell is put back exactly as it
 * was found, so the file's manifest is the same one whatever is exported around it.
 */
const REVIEW_SWITCHES = [SERVICE_CARD_ACTION_VAR, GHOST_CONTROLS_VAR, GRAPHICS_VAR] as const;

/** Build a record the way the CLI does, into a folder the test owns. */
async function build(record: BusinessRecord, into: string): Promise<Built> {
  const shell = new Map(REVIEW_SWITCHES.map((name) => [name, process.env[name]]));
  for (const name of REVIEW_SWITCHES) delete process.env[name];
  try {
    const result = await buildBundle(record, {
      outRoot: into,
      cacheDir: join(into, "cache"),
      recordDir: join(import.meta.dir, "records"),
      noImages: false,
      refresh: false,
      onNote: () => {},
    });
    return { slug: result.slug, dir: result.dir, files: result.files, warnings: result.warnings, bytes: result.bytes };
  } finally {
    for (const [name, value] of shell) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
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

/* ------------------------- our own record of a delivered build: beside the folder, never in it */

/** The name the build gives the record, typed once here so a rename cannot pass unnoticed. */
const RECORD_FILE = "business-phase-fixture.build-record.json";

/** Every file inside a folder, counted from disk rather than from what the build said it wrote. */
async function filesIn(dir: string): Promise<number> {
  return (await readdir(dir, { recursive: true, withFileTypes: true })).filter((e) => e.isFile()).length;
}

test("a delivered build writes our record of it beside the folder, never inside it", async () => {
  await temp(async (tmp) => {
    const b = await build(DELIVERED, tmp);
    expect(RECORD_FILE.endsWith(BUILD_RECORD_SUFFIX)).toBe(true);
    expect(b.slug).toBe("business-phase-fixture");
    expect(existsSync(join(tmp, RECORD_FILE))).toBe(true);
    // Nothing of ours went into the client's folder, and the folder is still eighteen files.
    expect(existsSync(join(b.dir, RECORD_FILE))).toBe(false);
    expect(b.files.some((f) => f.endsWith(BUILD_RECORD_SUFFIX))).toBe(false);
    expect(await filesIn(b.dir)).toBe(18);

    const record = JSON.parse(await Bun.file(join(tmp, RECORD_FILE)).text()) as DeliveredBuildRecord;
    expect(record.slug).toBe(b.slug);
    expect(record.phase).toBe("business");
    expect(record.dir).toBe(b.dir);
    expect(record.files).toEqual(b.files);
    expect(record.warnings).toEqual(b.warnings);
    // The bytes are the folder's own, added up from disk — not a number taken from the build.
    let sum = 0;
    for (const f of record.files) sum += (await stat(join(b.dir, f))).size;
    expect(record.bytes).toBe(sum);
    expect(record.bytes).toBe(b.bytes);
  });
});

test("the record carries the bases the CLI's --summary omits — the build's own, not a restatement", async () => {
  await temp(async (tmp) => {
    const b = await build(DELIVERED, tmp);
    const record = JSON.parse(await Bun.file(join(tmp, RECORD_FILE)).text()) as DeliveredBuildRecord;
    const bases = record.bases;
    // Why this folder is a delivered site and not a demonstration.
    expect(bases.phase.mode).toBe("business");
    expect(bases.phase.refused.length).toBeGreaterThan(0);
    expect(bases.delivery.mode).toBe("business");
    expect(bases.delivery.recipient).toBe(DELIVERED.form_recipient);
    // The family, the label it carries and the form the record supports.
    expect(bases.conversion.family).toBe("appointment");
    expect(bases.conversion.contact_label.length).toBeGreaterThan(0);
    expect(bases.conversion.basis.length).toBeGreaterThan(0);
    expect(Object.keys(bases.conversion.section_order).length).toBeGreaterThan(0);
    // The booking link the record carries, and which mode it resolved to.
    expect(bases.booking.mode).toBe("business");
    expect(bases.booking.url).toBe(DELIVERED.booking_url);
    // Which of the owner's three phone versions the pages print.
    expect(bases.phone.mode).toBe("client");
    // Where the details came from — and the line proved against the page this build wrote,
    // so the record is a description of THIS bundle rather than a shape that could describe any.
    // The record declares the details as supplied by the client themselves — the kind a
    // delivered site may claim, and which a demonstration is refused for declaring.
    expect(bases.provenance.source_kind).toBe("client-supplied");
    expect((await Bun.file(join(b.dir, "index.html")).text()).includes(bases.provenance.provenance_line)).toBe(true);
    // What the privacy notice's retention half was composed from.
    expect(bases.privacy.mode).toBe("business");
    expect(bases.privacy.retention.source).toContain("retention-log.md");
    // Every picture's source and licence, and what the client is told they own.
    expect(bases.images.length).toBeGreaterThan(0);
    for (const image of bases.images) expect(image.license.length).toBeGreaterThan(0);
    expect(bases.handoff.day_one_ownership.length).toBeGreaterThan(0);
  });
});

test("a demonstration writes no record beside the folder: its record is manifest.json inside it", async () => {
  await temp(async (tmp) => {
    const demo = await build(DEMONSTRATION, tmp);
    expect(existsSync(join(tmp, RECORD_FILE))).toBe(false);
    expect(demo.files.includes("manifest.json")).toBe(true);
    expect(demo.files.length).toBe(19);
    expect(demo.files.filter((f) => f !== "manifest.json").length).toBe(18);
    expect(await filesIn(demo.dir)).toBe(19);
    expect(internalRecordProblems({ mode: "demo", carried: await readBundleTexts(demo.dir) })).toEqual([]);
  });
});

test("a demonstration clears the record an earlier delivered build left beside the folder", async () => {
  await temp(async (tmp) => {
    const delivered = await build(DELIVERED, tmp);
    expect(existsSync(join(tmp, RECORD_FILE))).toBe(true);
    const demo = await build(DEMONSTRATION, tmp);
    expect(demo.dir).toBe(delivered.dir);
    expect(existsSync(join(tmp, RECORD_FILE))).toBe(false);
    expect(demo.warnings.join(" | ")).toContain(
      `removed ${RECORD_FILE}, our record of an earlier delivered build beside this folder`,
    );
    expect(internalRecordProblems({ mode: "demo", carried: await readBundleTexts(demo.dir) })).toEqual([]);
  });
});

test("a build that fails leaves no record beside a folder it did not create", async () => {
  await temp(async (tmp) => {
    // The demonstration twin of the delivered record, still carrying the business's own booking
    // link: refused by name (gbp §5.3 rule 1), so no folder — and no record of one.
    const refused: BusinessRecord = {
      ...DELIVERED,
      source_kind: "public-listings",
      form_recipient: OUR_INBOX,
      form_delivery: "demo",
    };
    await expect(build(refused, tmp)).rejects.toThrow(/booking link points at a business's own booking page/);
    expect(existsSync(join(tmp, RECORD_FILE))).toBe(false);
    expect(existsSync(join(tmp, "business-phase-fixture"))).toBe(false);
  });
});
