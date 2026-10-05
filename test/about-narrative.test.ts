#!/usr/bin/env bun
/**
 * The About-section narrative (design spec `about-content-spec.md` §1.5), and the
 * fictional-narrative guard the lead ratified with it (spec flag F1).
 *
 *   bun test test/about-narrative.test.ts
 *
 * Two things are checked:
 *
 *   1. how the record's own paragraphs are composed and rendered — a record that carries
 *      `about_paragraphs` prints every one verbatim (escaped), in order, on the About
 *      page, while the home page shows only the identity line plus the first paragraph;
 *      a record without them keeps the three composed paragraphs it has today (identity,
 *      services sentence, provenance) and a one-paragraph home excerpt;
 *   2. the fictional-narrative guard — because `guardCopy` and the family honesty guard
 *      exempt any phrase that also sits in the record, a fictional fixture could smuggle
 *      a banned or family-rule-breaking word past both simply by being the record. On a
 *      `fictional` record the narrative must clear both on its own, with no exemption.
 *
 * No filesystem beyond the fixtures, no network.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { complianceChecks } from "../src/demo/build.ts";
import { composeCopy, composePrivacy, fictionalNarrativeProblems, narrativeParagraphs, profileFor } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { esc, renderPages, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
import type { BusinessRecord, ManifestImage } from "../src/demo/types.ts";

const SLUG = "about-narrative-test";
const NO_IMAGES: ManifestImage[] = [];
const FIXTURES = join(import.meta.dir, "fixtures");

/** A record shaped like the fixtures', in demonstration delivery. */
function record(overrides: Partial<BusinessRecord> & { name: string; category: string }): BusinessRecord {
  return {
    source_kind: "public-listings",
    email: "shop@example-barber.ca",
    form_recipient: "site-sourced-311e0184@ctomail.io",
    form_delivery: "demo",
    form_provider: "formspark",
    form_access_key: "test-form-id",
    ...overrides,
  };
}

/** A fictional example business — the case the guard binds. */
function fictional(overrides: Partial<BusinessRecord> & { name: string; category: string }): BusinessRecord {
  return record({ ...overrides, source_kind: "fictional", email: undefined });
}

interface Rendered {
  record: BusinessRecord;
  pages: RenderedPage[];
  ctx: RenderContext;
}

function render(rec: BusinessRecord): Rendered {
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
    images: NO_IMAGES,
    slug: SLUG,
    generatedAt: "2026-10-04T00:00:00.000Z",
  };
  return { record: rec, pages: renderPages(ctx), ctx };
}

const page = (rendered: Rendered, file: string): string => rendered.pages.find((p) => p.file === file)!.html;

function checks(rendered: Rendered, overrides: RenderedPage[] = rendered.pages): string[] {
  return complianceChecks({
    pages: overrides,
    record: rendered.record,
    copy: rendered.ctx.copy,
    form: rendered.ctx.form,
    delivery: rendered.ctx.delivery,
    images: NO_IMAGES,
    privacy: rendered.ctx.privacy,
  });
}

function fixture(name: string): BusinessRecord {
  const rec = JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")) as BusinessRecord;
  rec.form_access_key = "test-form-id";
  return rec;
}

/** The `<section id="about">` block, so a count is over the section, not the whole page. */
function aboutSectionHtml(html: string): string {
  const start = html.indexOf('id="about"');
  const end = html.indexOf("</section>", start);
  return html.slice(start, end);
}

/** The number of narrative `<p>` elements in the About section (the "More about" link excluded). */
function aboutParagraphCount(html: string): number {
  const section = aboutSectionHtml(html);
  const paragraphs = (section.match(/<p>/g) ?? []).length;
  const moreLinks = (section.match(/link-quiet--inline/g) ?? []).length;
  return paragraphs - moreLinks;
}

/* -------------------------------------------------------------------- 1. compose */

test("a record with a narrative splices it between identity and services, verbatim and in order", () => {
  const narrative = [
    "The first paragraph, which stands on its own.",
    "The second paragraph, which may assume the first was read.",
    "The third paragraph, which rounds the account off.",
  ];
  const rec = fictional({ name: "Example Barbers", category: "Barber shop", services: ["Haircut"], about_paragraphs: narrative });
  const rendered = render(rec);
  const copy = rendered.ctx.copy;

  // The composed list is identity + three narrative + services + provenance, in order.
  expect(copy.about.length).toBe(6);
  expect(copy.about[0]).toBe("Example Barbers is a barber shop.");
  expect(copy.about.slice(1, 4)).toEqual(narrative);
  // The services sentence is P5(a)'s wording, pointing at the page that holds them.
  expect(copy.about[4]).toContain("The services recorded for Example Barbers are on the Services page:");
  // The home page shows the identity line plus the one opening paragraph.
  expect(copy.aboutExcerptLength).toBe(2);

  const aboutHtml = page(rendered, "about.html");
  const indexHtml = page(rendered, "index.html");

  // Every paragraph appears verbatim (escaped) on the About page, in order.
  let last = -1;
  for (const paragraph of narrative) {
    const escaped = esc(paragraph);
    expect(aboutHtml).toContain(escaped);
    const at = aboutHtml.indexOf(escaped);
    expect(at).toBeGreaterThan(last);
    last = at;
  }
  expect(aboutParagraphCount(aboutHtml)).toBe(6);

  // The home page carries paragraph 1 and none of the others.
  expect(indexHtml).toContain(esc(narrative[0]!));
  expect(indexHtml).not.toContain(esc(narrative[1]!));
  expect(indexHtml).not.toContain(esc(narrative[2]!));
  expect(aboutParagraphCount(indexHtml)).toBe(2);

  expect(checks(rendered)).toEqual([]);
});

test("a record without a narrative keeps the three composed paragraphs and a one-paragraph home excerpt", () => {
  const rec = fictional({ name: "Example Barbers", category: "Barber shop", services: ["Haircut"] });
  const rendered = render(rec);
  const copy = rendered.ctx.copy;

  // The composed list is exactly the three paragraphs it has today.
  expect(copy.about.length).toBe(3);
  expect(copy.about[0]).toBe("Example Barbers is a barber shop.");
  expect(copy.about[1]).toContain("The services recorded for Example Barbers are on the Services page:");
  expect(copy.about[2]).toContain("fictional example business invented to show the layout");
  expect(copy.aboutExcerptLength).toBe(1);

  const aboutHtml = page(rendered, "about.html");
  const indexHtml = page(rendered, "index.html");
  expect(aboutParagraphCount(aboutHtml)).toBe(3);
  // No "More about" link on the About page itself: it is the full page, not an excerpt.
  expect(aboutSectionHtml(aboutHtml)).not.toContain("More about");
  // The home page shows exactly one paragraph, then the link into the fuller page.
  expect(aboutParagraphCount(indexHtml)).toBe(1);
  expect(aboutSectionHtml(indexHtml)).toContain("More about");

  expect(checks(rendered)).toEqual([]);
});

/* ------------------------------------------------------ 2. the fictional guard */

test("a fictional narrative must clear BANNED on its own, with no record exemption", () => {
  // "award-winning" is on BANNED. Because it sits in the record, guardCopy would let it
  // through on a page — but a fictional record has no client whose words are exempt.
  const rec = fictional({ name: "Example Barbers", category: "Barber shop", about_paragraphs: ["An award-winning barber shop."] });
  expect(fictionalNarrativeProblems(rec).join(" ")).toContain("award-winning");
  // The whole self-check refuses the bundle, not just the unit.
  expect(checks(render(rec)).join(" ")).toContain("award-winning");
});

test("a fictional narrative must clear the family word rules on its own", () => {
  const rec = fictional({ name: "Example Barbers", category: "Barber shop", about_paragraphs: ["Book your visit online."] });
  const problems = fictionalNarrativeProblems(rec).join(" ");
  expect(problems).toContain('say "book"');
  expect(problems).toContain("appointment family must not book a time");
  expect(checks(render(rec)).join(" ")).toContain("must not book a time");
});

test("a non-fictional record keeps the exemption — its own words are not ours to edit", () => {
  // The same banned phrase on a real record is allowed: the guard only binds fiction.
  const rec = record({ name: "Example Barbers", category: "Barber shop", about_paragraphs: ["An award-winning barber shop."] });
  expect(fictionalNarrativeProblems(rec)).toEqual([]);
  // And the rendered page passes the existing record-exemption path.
  expect(checks(render(rec))).toEqual([]);
});

/* ----------------------------------------------------- 3. the fixtures, end to end */

test("the fixtures' narratives pass the stricter guard and record the right counts", () => {
  // Three fictional fixtures carry narratives; Red Hill does not, on purpose.
  const expected: [string, number][] = [
    ["maple-avenue-barber-shop", 3],
    ["king-west-dental", 3],
    ["northshore-garden-works", 3],
    ["red-hill-property-care", 0],
  ];
  for (const [slug, count] of expected) {
    const rec = fixture(slug);
    expect(`${slug}: ${narrativeParagraphs(rec).length}`).toBe(`${slug}: ${count}`);
    expect(`${slug}: ${fictionalNarrativeProblems(rec).join(" | ")}`).toBe(`${slug}: `);
    expect(`${slug}: ${checks(render(rec)).join(" | ")}`).toBe(`${slug}: `);
    expect(render(rec).ctx.copy.aboutExcerptLength).toBe(count > 0 ? 2 : 1);
  }
});
