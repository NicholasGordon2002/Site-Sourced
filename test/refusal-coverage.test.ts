#!/usr/bin/env bun
/**
 * **The meta-check: every named refusal must be able to fire.**
 *
 *   bun test test/refusal-coverage.test.ts
 *
 * The leak this closes (9 Oct 2026): `MANIFEST_PHASE_REFUSED` listed "the demonstration
 * paragraph in the delivered README" as refused while no pattern in the build matched that
 * paragraph. A manifest entry claiming a refusal, with no pattern that performs it, is
 * indistinguishable from a guard that passes — so it recurred, and only a human reading four
 * files found it.
 *
 * `refusal-coverage.ts` is the checker and `refusal-registry.ts` is the data (every list of
 * named refusals, with the prose each entry claims to refuse). This file:
 *
 *   1. runs the check over the registry, as the build does on every bundle;
 *   2. proves the check **can fire** — decoy entries (an unmatched pattern, a pattern that
 *      matches everything, an entry with no sample) are each refused by name, so a green run
 *      is not green because the check is asleep;
 *   3. fires the **real** guards with each registered sample, where the guard is cheaply
 *      callable, so a pattern is not merely self-consistent but is the one the build reads;
 *   4. reads `src/demo/*.ts` and refuses a list of named refusals that exists there and is
 *      not registered — the class, not the instance.
 */
import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { externalReferenceProblems, headerOverlayProblems, placeholderProblems, refusalCoverageChecks } from "../src/demo/build.ts";
import { guardCopy, printedDetailClaimProblems } from "../src/demo/copy.ts";
import { manifestClaimProblems, NEUTRAL_PROSE, refusalCoverageProblems, type RefusalList } from "../src/demo/refusal-coverage.ts";
import { REFUSAL_LISTS, REFUSAL_SAMPLES } from "../src/demo/refusal-registry.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

const entryNames = (): string[] => REFUSAL_LISTS.flatMap((list) => list.entries.map((e) => e.what));

/* ------------------------------------------- the check the build itself runs, and its data */

test("every registered refusal names prose its own pattern can refuse", () => {
  // The build check, called the way `complianceChecks` calls it: a failure here is a bundle
  // that cannot build, not only a failing test.
  expect(refusalCoverageChecks()).toEqual([]);
});

test("the registry is what the guards read: every entry has a pattern and its samples", () => {
  expect(REFUSAL_LISTS.length).toBeGreaterThanOrEqual(12);
  let entries = 0;
  const seen = new Map<string, string>();
  for (const list of REFUSAL_LISTS) {
    for (const entry of list.entries) {
      entries += 1;
      // The manifest is a flat list of names, so two entries sharing one name would make
      // `manifestClaimProblems` prove the wrong thing. Names are unique across the registry.
      expect(`${entry.what} is named once (${seen.get(entry.what) ?? "nowhere else"})`).toBe(`${entry.what} is named once (nowhere else)`);
      seen.set(entry.what, list.source);
      expect(`${list.source}/${entry.what}: ${entry.pattern instanceof RegExp} ${entry.samples.length > 0}`).toBe(
        `${list.source}/${entry.what}: true true`,
      );
    }
  }
  expect(entries).toBeGreaterThanOrEqual(80);
  // Every sample the registry holds is attached to a registered entry: a sample for an
  // entry nobody has is a sample nobody checks.
  const named = new Set(entryNames());
  const orphans = Object.keys(REFUSAL_SAMPLES).filter((what) => !named.has(what));
  expect(orphans).toEqual([]);
});

/* ------------------------------------------------------------------ can the check fire? */

/** A decoy list, so the checker is proved to refuse rather than merely to run. */
const decoy = (entries: RefusalList["entries"]): RefusalList[] => [
  { source: "DECOY_LIST", refuses: "a decoy, in a test that must not trust a green run", entries },
];

test("a registered entry whose pattern cannot match its prose fails, naming the entry", () => {
  const problems = refusalCoverageProblems(
    decoy([{ what: "a refusal nothing can find", pattern: /words that are in no sample at all/i, samples: ["ordinary prose"] }]),
  ).join(" | ");
  expect(problems).toContain('DECOY_LIST names "a refusal nothing can find"');
  expect(problems).toContain("cannot refuse it");
});

test("an entry with no sample fails: nothing proves it, so it is refused", () => {
  const problems = refusalCoverageProblems(decoy([{ what: "an entry with no prose", pattern: /book/, samples: [] }])).join(" | ");
  expect(problems).toContain('DECOY_LIST names "an entry with no prose"');
  expect(problems).toContain("records no sample");
});

test("a pattern that matches everything fails: it would make an unmatched entry look covered", () => {
  const problems = refusalCoverageProblems(
    decoy([{ what: "a catch-all", pattern: /.*/, samples: ["anything at all"] }]),
  ).join(" | ");
  expect(problems).toContain('DECOY_LIST names "a catch-all"');
  expect(problems).toContain("matches ordinary page prose");
});

test("an empty registry fails, rather than passing because it has nothing to check", () => {
  expect(refusalCoverageProblems([]).join(" | ")).toContain("no list of named refusals is registered");
});

test("the neutral control really is neutral: no registered pattern fires on ordinary prose", () => {
  for (const control of NEUTRAL_PROSE) {
    for (const list of REFUSAL_LISTS) {
      for (const entry of list.entries) {
        const fired = new RegExp(entry.pattern.source, entry.pattern.flags.replace(/g/g, "")).test(control);
        expect(`${list.source}/${entry.what}: ${fired ? "fires on ordinary prose" : "silent"}`).toBe(
          `${list.source}/${entry.what}: silent`,
        );
      }
    }
  }
});

/* --------------------------- the manifest's own claim, and a manifest entry with no pattern */

test("MANIFEST_PHASE_REFUSED is backed by the phase lists, both directions", () => {
  expect(refusalCoverageChecks().filter((p) => p.includes("MANIFEST_PHASE_REFUSED"))).toEqual([]);
});

test("a manifest entry no pattern refuses is refused by the coverage check", () => {
  const problems = refusalCoverageProblems(REFUSAL_LISTS).length === 0;
  expect(problems).toBe(true);
  const claimed = [
    ...REFUSAL_LISTS[0]!.entries.map((e) => e.what),
    "the demonstration paragraph in a client's firmware", // the 9 Oct shape: claimed, unenforced
  ];
  const found = manifestClaimProblems({
    claim: "MANIFEST_PHASE_REFUSED",
    manifest: claimed,
    lists: [REFUSAL_LISTS[0]!],
  }).join(" | ");
  expect(found).toContain("the demonstration paragraph in a client's firmware");
  expect(found).toContain("no pattern that refuses it");
});

/* --------------------------------------- the real guards, fired with the registered prose */

const page = (html: string) => [{ file: "index.html", id: "index" as const, html }];

test("the placeholder guard refuses each pattern's own sample", () => {
  for (const [what, pattern] of listNamed("PLACEHOLDER_PATTERNS")) {
    const sample = sampleFor(what);
    expect(`${what}: ${pattern instanceof RegExp && placeholderProblems(page(sample)).join(" | ").includes(what)}`).toBe(
      `${what}: true`,
    );
  }
});

test("the self-containment guard refuses each origin pattern's own sample", () => {
  const css = externalReferenceProblems({ pages: [], css: sampleFor("an @import"), js: "" }).join(" | ");
  expect(css).toContain("an @import");
  const url = externalReferenceProblems({ pages: [], css: `body { background-image: ${sampleFor("a url()")} }`, js: "" }).join(" | ");
  expect(url).toContain("a url()");
  for (const [what] of listNamed("FORBIDDEN_SCRIPT_PATTERNS")) {
    const found = externalReferenceProblems({ pages: [], css: "body {}", js: sampleFor(what) }).join(" | ");
    expect(`${what}: ${found.includes(what)}`).toBe(`${what}: true`);
  }
});

test("the overlay guard refuses each mark's own declaration", () => {
  for (const [what] of listNamed("OVERLAY_MARKS")) {
    const found = headerOverlayProblems([], `.site-header { ${sampleFor(what)} }`).join(" | ");
    expect(`${what}: ${found.includes(what)}`).toBe(`${what}: true`);
  }
});

test("the banned-phrase guard refuses each banned phrase, from its own word", () => {
  for (const [what] of listNamed("BANNED")) {
    const hits = guardCopy(`<p>${what}</p>`, {} as BusinessRecord);
    expect(`${what}: ${hits.includes(what)}`).toBe(`${what}: true`);
  }
});

test("the detail-claim guard refuses each shape's own sentence, on a record that lacks the detail", () => {
  const record = {
    name: "Example Barber Shop",
    category: "Barber shop",
    hours: [{ days: "Mon-Fri", hours: "9:00 am - 5:00 pm" }],
  } as BusinessRecord;
  const shape1 = printedDetailClaimProblems({ record, pages: [{ file: "index.html", html: `<p>${sampleFor("the hero's offering line")}</p>` }] }).join(" | ");
  expect(shape1).toContain("in the hero's offering line");
  const shape2 = printedDetailClaimProblems({
    record,
    pages: [{ file: "index.html", html: `<p>${sampleFor("the sentence that sends a visitor to a printed detail")}</p>` }],
  }).join(" | ");
  expect(shape2).toContain("in the sentence that sends a visitor to a printed detail");
});

/* ------------------------------------------------------------------------ closing the class */

/** The declarations in the demo generator that name a refusal and hold a pattern. */
const PATTERN_LIST = /\bconst\s+([A-Z][A-Z0-9_]*)\s*:\s*((?:[^\n=]*RegExp[^\n=]*)|FamilyWordRule\[\]|RefusalList\[\])\s*=/g;

/** Registered, or exempted with the reason the exemption is allowed to have. */
const EXEMPT: Record<string, string> = {
  REFUSAL_LISTS: "the registry itself: it holds the lists rather than being one",
  PHASE_REFUSAL_LISTS: "the registry's phase half; the entries live in the two lists above it",
  NAMED_DETAILS: "recognisers, not refusals: it names the four details as pages write them, and the refusal is a claim shape (DETAIL_CLAIM_SHAPES, registered)",
  ENTITIES: "HTML entities decoded before a sentence is reported: it replaces text and refuses nothing",
};

test("no list of named refusals exists in the demo generator without being registered", async () => {
  const dir = join(import.meta.dir, "..", "src", "demo");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".ts")).sort();
  const registered = new Set(REFUSAL_LISTS.map((l) => l.source.split(/\s|\//).find((t) => /^[A-Z][A-Z0-9_]*$/.test(t))!));
  const found: string[] = [];
  for (const file of files) {
    const text = await Bun.file(join(dir, file)).text();
    for (const match of text.matchAll(PATTERN_LIST)) {
      const name = match[1]!;
      found.push(`${file}:${name}`);
    }
  }
  // The scan has to be finding the real thing: if it matched nothing, every list could slip
  // past it and this test would pass for the wrong reason.
  expect(found.length).toBeGreaterThanOrEqual(10);
  const unregistered = found.filter((hit) => {
    const name = hit.split(":")[1]!;
    return !registered.has(name) && !(name in EXEMPT);
  });
  expect(unregistered).toEqual([]);
  // …and the exemptions are real names the scan sees, not a wish list.
  const exempted = found.filter((hit) => hit.split(":")[1]! in EXEMPT).map((hit) => hit.split(":")[1]!);
  expect([...new Set(exempted)].sort()).toEqual(Object.keys(EXEMPT).sort());
});

/* ------------------------------------------------------------------------------ helpers */

function listNamed(source: string): [string, RegExp][] {
  const list = REFUSAL_LISTS.find((l) => l.source.includes(source));
  expect(`${source} is registered`).toBe(list ? `${source} is registered` : `${source} is MISSING`);
  return list!.entries.map((e) => [e.what, e.pattern]);
}

function sampleFor(what: string): string {
  const samples = REFUSAL_SAMPLES[what];
  expect(`${what}: ${samples && samples.length > 0 ? "has a sample" : "has NO sample"}`).toBe(`${what}: has a sample`);
  return samples![0]!;
}
