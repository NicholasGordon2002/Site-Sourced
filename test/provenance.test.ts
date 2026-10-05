#!/usr/bin/env bun
/**
 * Where a page says the business's details came from, and the build's refusal to print
 * an attribution the record does not support.
 *
 *   bun test test/provenance.test.ts
 *
 * The second defect the 29 Sept audit found: `render.ts` hard-coded the footer sentence
 * *"Business details come from public mapping data (© OpenStreetMap contributors, ODbL
 * 1.0)"* and the *"as published in public listings"* caveat, whatever `record.source`
 * said. On a fixture — a fictional business that never touched OpenStreetMap and was
 * never published anywhere — both were false claims, and the four-page build would have
 * enshrined them on five pages at once.
 *
 * What it pins down, for each of the three kinds a record may declare:
 *
 *   openstreetmap    credits "© OpenStreetMap contributors" and the ODbL, and prints the
 *                    frozen public-listings caveat,
 *   public-listings  credits public listings instead, and still prints that caveat,
 *   fictional        credits neither, says the business is invented, and prints the
 *                    fictional caveat in the same place — the frozen one would be a lie,
 *   undeclared       the build refuses the bundle: no attribution can be chosen for it.
 *
 * It also asserts the reverse direction: a page that keeps the OpenStreetMap credit (or
 * the wrong caveat) while the record declares another source fails the build.
 *
 * Nothing is sent anywhere, and no file is written. Fixtures are fictional.
 */
import { expect, test } from "bun:test";

import { complianceChecks } from "../src/demo/build.ts";
import { composeCopy, composePrivacy, profileFor } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { OSM_ONLY_FRAGMENTS, fictionalCaveat, listingsCaveat, pageText, resolveProvenance } from "../src/demo/provenance.ts";
import { esc, renderPages, type RenderContext } from "../src/demo/render.ts";
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
};

function record(over: Partial<BusinessRecord> = {}): BusinessRecord {
  return { ...BASE, ...over };
}

/** Render every page of a bundle exactly as the build does. */
function pages(rec: BusinessRecord) {
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
    generatedAt: "2026-09-29T00:00:00.000Z",
  };
  return { ctx, rendered: renderPages(ctx), copy };
}

function checked(rec: BusinessRecord) {
  const { ctx, rendered, copy } = pages(rec);
  return complianceChecks({
    pages: rendered,
    record: rec,
    copy,
    form: ctx.form,
    delivery: ctx.delivery,
    images: [],
    privacy: ctx.privacy,
  });
}

const HOME = (rec: BusinessRecord) => pages(rec).rendered.find((p) => p.file === "index.html")!.html;

/* ----------------------------------------------------------- the three kinds */

test("an OpenStreetMap-sourced record credits OpenStreetMap and the ODbL", () => {
  const rec = record({ source_kind: "openstreetmap" });
  const { copy } = pages(rec);
  expect(copy.footer.provenance).toContain("© OpenStreetMap contributors");
  expect(copy.footer.provenance).toContain("ODbL 1.0");
  expect(copy.footer.provenance).toContain("public mapping data");
  // The frozen caveat, byte-identical, because this record's details really were published.
  expect(copy.contactCaveat).toBe(
    `The contact details for ${rec.name} on this page are as published in public listings — please confirm them with the business before relying on them.`,
  );
  const html = HOME(rec);
  expect(html).toContain("© OpenStreetMap contributors");
  // The ODbL credit travels as a link to the licence, not as bare words (ruling R12).
  expect(html).toContain('href="https://opendatacommons.org/licenses/odbl/1-0/"');
  expect(html).toContain(">ODbL 1.0</a>");
  // The page's own text (tags stripped) carries the same sentence as the plain attribution.
  expect(pageText(html)).toContain(copy.footer.provenance);
  expect(html.split("as published in public listings — please confirm").length - 1).toBe(2);
  expect(checked(rec)).toEqual([]);
});

test("a public-listings record credits public listings and no mapping data", () => {
  const rec = record({ source_kind: "public-listings" });
  const { copy } = pages(rec);
  expect(copy.footer.provenance).toContain("public listings about this business");
  for (const fragment of OSM_ONLY_FRAGMENTS) expect(copy.footer.provenance).not.toContain(fragment);
  expect(copy.contactCaveat).toBe(listingsCaveat(rec.name));
  const html = HOME(rec);
  expect(pageText(html)).toContain(copy.footer.provenance);
  expect(html).not.toContain("opendatacommons.org/licenses/odbl");
  expect(html.split("as published in public listings — please confirm").length - 1).toBe(2);
  expect(checked(rec)).toEqual([]);
});

test("a fictional record credits neither, and says the business is invented", () => {
  const rec = record({ source_kind: "fictional" });
  const { copy } = pages(rec);
  const html = HOME(rec);

  // No OpenStreetMap credit anywhere on the page, and no promise about listings.
  for (const fragment of OSM_ONLY_FRAGMENTS) expect(html).not.toContain(fragment);
  expect(html).not.toContain("opendatacommons.org/licenses/odbl");
  expect(html).not.toContain("as published in public listings");
  expect(html).toContain("Fictional example business");
  // Compared through esc(), because that is how render.ts writes text into the page.
  expect(html).toContain(esc(fictionalCaveat(rec.name)));
  // The caveat still appears exactly where the frozen one would: with the details, twice.
  expect(html.split(esc(fictionalCaveat(rec.name))).length - 1).toBe(2);
  expect(checked(rec)).toEqual([]);
});

test("a record that declares no source at all is refused, not guessed at", () => {
  const problems = checked(record());
  expect(problems.join(" ")).toContain("does not say where its details came from");
  expect(problems.join(" ")).toContain("source_kind");
  // And a value that is not one of the three kinds is refused the same way.
  expect(checked(record({ source_kind: "yellow-pages" as never })).join(" ")).toContain("does not say where its details came from");
});

test("a fictional example business cannot be presented as anyone's own site", () => {
  const rec = record({ source_kind: "fictional", form_recipient: BASE.email!, form_delivery: "business" });
  expect(checked(rec).join(" ")).toContain("fictional example business");
});

/* ------------------------------------------------- the contradiction direction */

test("a page keeping the OpenStreetMap credit for a non-OSM record fails the build", () => {
  const rec = record({ source_kind: "fictional" });
  const { ctx, rendered } = pages(rec);
  const tampered = rendered.map((p) => ({
    ...p,
    html: p.html.replace(
      "Fictional example business:",
      "Business details come from public mapping data (© OpenStreetMap contributors, ODbL 1.0).",
    ),
  }));
  expect(tampered[0]!.html).toContain("public mapping data");
  const problems = complianceChecks({
    pages: tampered,
    record: rec,
    copy: ctx.copy,
    form: ctx.form,
    delivery: ctx.delivery,
    images: [],
    privacy: ctx.privacy,
  });
  expect(problems.join(" ")).toContain("credits OpenStreetMap");
  expect(problems.join(" ")).toContain("An attribution the record does not support is a false claim");
});

test("the public-listings caveat on a fictional record fails the build", () => {
  const rec = record({ source_kind: "fictional" });
  const { ctx, rendered } = pages(rec);
  const tampered = rendered.map((p) => ({ ...p, html: p.html.replaceAll(esc(fictionalCaveat(rec.name)), esc(listingsCaveat(rec.name))) }));
  const problems = complianceChecks({
    pages: tampered,
    record: rec,
    copy: ctx.copy,
    form: ctx.form,
    delivery: ctx.delivery,
    images: [],
    privacy: ctx.privacy,
  });
  const joined = problems.join(" ");
  expect(joined).toContain('prints the "as published in public listings" caveat');
  expect(joined).toContain("Nothing about it was published in any listing");
});

test("a page that loses its provenance line fails the build", () => {
  const rec = record({ source_kind: "public-listings" });
  const { ctx, rendered } = pages(rec);
  // Remove the line the way the footer actually writes it — the raw, unescaped
  // `provenanceHtml` — not its `esc()`ed plain form, which no longer matches the page
  // once the attribution carries markup/escaping. The gate compares stripped text, so a
  // markup change to the link must not re-break this pin either way.
  const tampered = rendered.map((p) => ({ ...p, html: p.html.replaceAll(ctx.copy.footer.provenanceHtml, "") }));
  expect(tampered[0]!.html).not.toContain("Business details come from public listings");
  const problems = complianceChecks({
    pages: tampered,
    record: rec,
    copy: ctx.copy,
    form: ctx.form,
    delivery: ctx.delivery,
    images: [],
    privacy: ctx.privacy,
  });
  expect(problems.join(" ")).toContain("the footer's provenance line for this record is not present");
});

/* ------------------------------------------------------------------ the fixtures */

/**
 * The fixtures that ship with the repo, rendered and checked like a real build. Each one
 * declares its own source, and none of them may print another source's line — that is
 * how the OpenStreetMap credit ended up on a fictional business in the first place.
 */
const FIXTURES: [string, string][] = [
  ["maple-avenue-barber-shop.json", "fictional"],
  ["king-west-dental.json", "fictional"],
  ["northshore-garden-works.json", "fictional"],
  ["red-hill-property-care.json", "public-listings"],
];

for (const [file, kind] of FIXTURES) {
  test(`fixture ${file} declares its source and prints only that line`, async () => {
    const parsed = JSON.parse(await Bun.file(`${import.meta.dir}/fixtures/${file}`).text()) as BusinessRecord;
    // The fixtures name their form key through the environment (`env:SS_FORMSPARK_FORM_ID`),
    // which a test run without the gitignored .env.local cannot resolve. A literal key keeps
    // this test about the provenance line and the caveat, not about the endpoint.
    const rec: BusinessRecord = { ...parsed, form_access_key: "test-form-id" };
    expect(rec.source_kind).toBe(kind);

    const provenance = resolveProvenance(rec);
    expect(provenance.kind).toBe(kind);
    expect(provenance.attribution.length).toBeGreaterThan(0);

    const html = HOME(rec);
    // The page's text (tags stripped) must carry the plain attribution — comparing the
    // link markup would break the next time the licence link is touched.
    expect(pageText(html)).toContain(provenance.attribution);
    for (const fragment of OSM_ONLY_FRAGMENTS) {
      if (kind !== "openstreetmap") expect(html).not.toContain(fragment);
    }
    // The ODbL licence link only belongs to an OpenStreetMap-sourced record.
    expect(html.includes("opendatacommons.org/licenses/odbl")).toBe(kind === "openstreetmap");
    expect(html.includes(esc(listingsCaveat(rec.name)))).toBe(kind !== "fictional");
    expect(html.includes(esc(fictionalCaveat(rec.name)))).toBe(kind === "fictional");

    expect(checked(rec)).toEqual([]);
  });
}
