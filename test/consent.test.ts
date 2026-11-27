#!/usr/bin/env bun
/**
 * Consent evidence per lead, or no send — and the durable suppression list.
 *
 *   bun test test/consent.test.ts
 *
 * The plan names four pieces of evidence (source URL, archived copy, relevance note,
 * capture date) and one hard block (a source page that says "no unsolicited email").
 * None of it existed in code. `src/consent.ts` is the send gate and
 * `src/suppression.ts` the list an address is never taken off again.
 *
 * Every refusal below is proved able to fire by mutating the one condition it
 * guards, and the decoys matter as much as the refusals: an ordinary page that
 * merely offers a contact form must still pass.
 */
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CONSENT_FIELDS,
  consentProblems,
  findUnsolicitedMarker,
  isSendable,
  sendableLeads,
} from "../src/consent.ts";
import { COLUMNS, toCsv } from "../src/output.ts";
import { SuppressionList, normaliseAddress } from "../src/suppression.ts";
import { elementToLead } from "../src/classify.ts";
import type { Lead } from "../src/types.ts";

const tmp = () => mkdtempSync(join(tmpdir(), "ss-consent-"));

const PAGE = `<html><body>
  <h1>Fern &amp; Fable Hair Studio</h1>
  <p>Book by phone, or write to us at hello@fernandfable.example.</p>
  <form action="/contact"><input name="message"></form>
</body></html>`;

function lead(over: Partial<Lead> = {}): Lead {
  return {
    osm_id: "node/1",
    osm_type: "node",
    name: "Fern & Fable Hair Studio",
    category: "hairdresser",
    category_key: "shop",
    osm_tag: "shop=hairdresser",
    category_group: "Salons & barbers",
    street_address: "12 Example Street",
    city: "Hamilton",
    province: "ON",
    postcode: "L8P 1A1",
    phone: "",
    email: "hello@fernandfable.example",
    website: "",
    opening_hours: "",
    lat: null,
    lon: null,
    distance_km: null,
    website_tier: "no_website",
    social_platform: "",
    site_checked: "no",
    site_verdict: "",
    site_verdict_reason: "",
    http_status: "",
    final_url: "",
    https: "",
    viewport_meta: "",
    page_weight_bytes: "",
    site_evidence: "",
    consent_source_url: "https://fernandfable.example/contact",
    consent_archive_path: "",
    consent_relevance_note: "No website of its own; only a booking-by-phone page on a directory.",
    consent_captured_at: "2026-11-20",
    ...over,
  };
}

/** A lead whose evidence is complete, with its saved page written to disk. */
function complete(dir: string, html = PAGE, over: Partial<Lead> = {}) {
  const archive = join(dir, "fern-and-fable-contact.html");
  writeFileSync(archive, html, "utf8");
  return lead({ consent_archive_path: archive, ...over });
}

const reasons = (l: Lead, dir: string) => consentProblems(l, { archiveRoot: dir }).join(" | ");

/* ------------------------------------------------------------ the complete case */
test("a lead with all four pieces of evidence and no marker passes the gate", () => {
  const dir = tmp();
  try {
    const l = complete(dir);
    expect(consentProblems(l, { archiveRoot: dir })).toEqual([]);
    expect(isSendable(l, { archiveRoot: dir })).toBe(true);
    const gate = sendableLeads([l], { archiveRoot: dir });
    expect(gate.refused).toEqual([]);
    expect(gate.sendable).toEqual([l]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------- each of the four, removed in turn */
test("each of the four pieces of evidence is refused by name when it is missing", () => {
  const dir = tmp();
  try {
    const full = complete(dir);
    expect(consentProblems(full, { archiveRoot: dir })).toEqual([]);
    for (const [field, label] of CONSENT_FIELDS) {
      // removed
      const missing = { ...full, [field]: "" };
      expect(reasons(missing, dir)).toContain(`no ${label} (${field})`);
      // and blank-but-present
      const blank = { ...full, [field]: "   " };
      expect(reasons(blank, dir)).toContain(`no ${label} (${field})`);
    }
    // the four names are the plan's four pieces, in its order
    expect(CONSENT_FIELDS.map(([f]) => f)).toEqual([
      "consent_source_url",
      "consent_archive_path",
      "consent_relevance_note",
      "consent_captured_at",
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* --------------------------------------------------------------- source URL shape */
test("a source URL that is not a plain http(s) page address is refused", () => {
  const dir = tmp();
  try {
    const full = complete(dir);
    for (const bad of ["fernandfable.example", "ftp://fernandfable.example/x", "mailto:hi@x.example", "javascript:1"]) {
      expect(reasons({ ...full, consent_source_url: bad }, dir)).toContain("not a plain http(s) page address");
    }
    expect(consentProblems({ ...full, consent_source_url: "http://fernandfable.example/contact" }, { archiveRoot: dir })).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------- archived copy shape */
test("an archived copy that cannot be read is refused, because a copy we cannot read cannot be checked", () => {
  const dir = tmp();
  try {
    const full = complete(dir);
    const gone = { ...full, consent_archive_path: join(dir, "never-saved.html") };
    expect(reasons(gone, dir)).toContain("cannot be read as a saved page");

    const emptyFile = join(dir, "empty.html");
    writeFileSync(emptyFile, "", "utf8");
    expect(reasons({ ...full, consent_archive_path: emptyFile }, dir)).toContain("the file is empty");

    const aDirectory = join(dir, "a-directory");
    mkdirSync(aDirectory);
    expect(reasons({ ...full, consent_archive_path: aDirectory }, dir)).toContain("not a file");

    // a relative path is resolved against the root it was given
    expect(consentProblems({ ...full, consent_archive_path: "fern-and-fable-contact.html" }, { archiveRoot: dir })).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* --------------------------------------------------- the "no unsolicited email" block */
test("a source page carrying a 'no unsolicited email' marker is a hard block, whatever else the page says", () => {
  const dir = tmp();
  try {
    const full = complete(dir);
    const marked = [
      "We accept no unsolicited email of any kind.",
      "Please do not send unsolicited messages to this address.",
      "Unsolicited emails are not welcome here.",
      "No cold emails, please.",
      "We do not accept unsolicited marketing.",
    ];
    for (const sentence of marked) {
      const archive = join(dir, "marked.html");
      writeFileSync(archive, `<html><body><p>${sentence}</p><p>Contact hello@fernandfable.example</p></body></html>`, "utf8");
      const text = reasons({ ...full, consent_archive_path: archive }, dir);
      expect(text).toContain("marker");
      expect(text).toContain("hard block");
      expect(isSendable({ ...full, consent_archive_path: archive }, { archiveRoot: dir })).toBe(false);
    }

    // the marker is found in the page's text, however the tags are arranged
    expect(findUnsolicitedMarker("<p>No <b>unsolicited</b>   email please</p>")).toBe("no unsolicited email");
    expect(findUnsolicitedMarker("<p>Contact us about a quote</p>")).toBeNull();
    // an ordinary page offering a contact form is not a block
    expect(findUnsolicitedMarker(PAGE)).toBeNull();
    // a phrase that only lives in the page's script is not a marker the page shows
    expect(findUnsolicitedMarker('<script>var warn = "no unsolicited email";</script><p>Hello</p>')).toBeNull();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------ relevance note, date */
test("a relevance note that says nothing, and a capture date that is not a real date, are refused", () => {
  const dir = tmp();
  try {
    const full = complete(dir);
    for (const note of ["n/a", "none", "todo", "  no site  "]) {
      expect(reasons({ ...full, consent_relevance_note: note }, dir)).toContain("says nothing about why this business is relevant");
    }
    for (const date of ["20 November 2026", "2026-13-45", "yesterday", "2026-11"]) {
      expect(reasons({ ...full, consent_captured_at: date }, dir)).toContain("not a real ISO 8601 date");
    }
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    expect(reasons({ ...full, consent_captured_at: future }, dir)).toContain("in the future");
    // a full timestamp is a capture date too
    expect(consentProblems({ ...full, consent_captured_at: "2026-11-20T09:14:00Z" }, { archiveRoot: dir })).toEqual([]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------------- suppression */
test("the suppression list is keyed on the address, survives a reload, and is never rewritten", async () => {
  const dir = tmp();
  try {
    const path = join(dir, "suppression.json");
    const list = await SuppressionList.load(path);
    expect(list.size).toBe(0);

    const first = await list.add("Hello@FernAndFable.Example", {
      reason: "unsubscribe",
      note: "asked on the phone",
      addedAt: "2026-11-01",
    });
    expect(first.added).toBe(true);
    expect(first.entry.address).toBe("hello@fernandfable.example");

    // a later, differently-spelled version of the same address is the same key
    for (const same of [" hello@fernandfable.example ", "mailto:HELLO@fernandfable.example"]) {
      expect(normaliseAddress(same)).toBe("hello@fernandfable.example");
      expect(list.has(same)?.reason).toBe("unsubscribe");
    }

    // a later lead cannot override the entry: adding again keeps the first evidence
    const again = await list.add("hello@fernandfable.example", { reason: "manual", note: "newer lead", addedAt: "2026-11-25" });
    expect(again.added).toBe(false);
    expect(again.entry.reason).toBe("unsubscribe");
    expect(again.entry.added_at).toBe("2026-11-01");
    expect(again.entry.note).toBe("asked on the phone");

    // durable: a fresh load of the same file still knows
    const reloaded = await SuppressionList.load(path);
    expect(reloaded.size).toBe(1);
    expect(reloaded.has("hello@fernandfable.example")?.added_at).toBe("2026-11-01");

    // the file itself is the record, and it says entries are only ever added
    const onDisk = JSON.parse(await Bun.file(path).text());
    expect(onDisk.version).toBe(1);
    expect(onDisk.entries).toHaveLength(1);
    expect(onDisk.note).toContain("only ever added");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a suppressed address is refused by the send gate even with perfect evidence, and dropped from any list", async () => {
  const dir = tmp();
  try {
    const list = await SuppressionList.load(join(dir, "suppression.json"));
    const l = complete(dir);
    // without the suppression entry the lead passes
    expect(sendableLeads([l], { archiveRoot: dir, suppression: list }).refused).toEqual([]);

    await list.add(l.email, { reason: "hard-block", addedAt: "2026-11-02" });
    const gate = sendableLeads([l], { archiveRoot: dir, suppression: list });
    expect(gate.sendable).toEqual([]);
    expect(gate.refused).toHaveLength(1);
    expect(gate.refused[0].reasons.join(" | ")).toContain("on the durable suppression list");
    expect(gate.refused[0].reasons.join(" | ")).toContain("can never override");

    // a later lead with the same address — new name, new consent evidence — is still refused
    const later = { ...l, name: "Renamed Studio", consent_captured_at: "2026-11-24" };
    expect(sendableLeads([later], { archiveRoot: dir, suppression: list }).refused).toHaveLength(1);

    // and the list filter drops it from anything about to be written
    const { kept, dropped } = list.filter([l, later]);
    expect(kept).toEqual([]);
    expect(dropped).toHaveLength(2);

    // a lead with no address cannot be keyed, so it is refused too
    const noAddress = { ...l, email: "" };
    expect(sendableLeads([noAddress], { archiveRoot: dir, suppression: list }).refused[0].reasons.join(" ")).toContain(
      "no email address",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a suppression file that cannot be read is an error, never an empty list", async () => {
  const dir = tmp();
  try {
    const broken = join(dir, "broken.json");
    writeFileSync(broken, "{ not json", "utf8");
    await expect(SuppressionList.load(broken)).rejects.toThrow(/not valid JSON/);

    const shapeless = join(dir, "shapeless.json");
    writeFileSync(shapeless, '{"version":1}', "utf8");
    await expect(SuppressionList.load(shapeless)).rejects.toThrow(/refusing to treat it as empty/);

    const addressless = join(dir, "addressless.json");
    writeFileSync(addressless, '{"version":1,"entries":[{"reason":"unsubscribe"}]}', "utf8");
    await expect(SuppressionList.load(addressless)).rejects.toThrow(/entry with no address/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ------------------------------------------------------------- the lead output */
test("the four consent fields are in the lead output, and a freshly pulled POI carries none of them", () => {
  const headers = COLUMNS.map(([h]) => h);
  for (const [field] of CONSENT_FIELDS) expect(headers).toContain(field);

  const fromOsm = elementToLead(
    {
      type: "node",
      id: 42,
      lat: 43.2557,
      lon: -79.8711,
      tags: { name: "Fern & Fable Hair Studio", shop: "hairdresser", email: "hello@fernandfable.example" },
    },
    { lat: 43.25, lon: -79.87 },
  );
  expect(fromOsm).not.toBeNull();
  for (const [field] of CONSENT_FIELDS) expect(fromOsm![field]).toBe("");
  // a POI with no evidence yet is refused by the gate, which is the point of the rule
  expect(sendableLeads([fromOsm!]).refused).toHaveLength(1);

  const csv = toCsv([lead({ consent_archive_path: "out/consent/fern.html" })]);
  const [head, row] = csv.trim().split("\n");
  const at = (name: string) => head.split(",").indexOf(name);
  expect(row.split(",")[at("consent_source_url")]).toBe("https://fernandfable.example/contact");
  expect(row.split(",")[at("consent_archive_path")]).toBe("out/consent/fern.html");
  expect(row.split(",")[at("consent_captured_at")]).toBe("2026-11-20");
});
