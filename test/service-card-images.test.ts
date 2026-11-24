#!/usr/bin/env bun
/**
 * **A picture on a service card.**
 *
 *   bun test test/service-card-images.test.ts
 *
 * A record may illustrate one service's card (`images[].role: "service"`, naming the service
 * in `images[].service`). `serviceCardImageProblems` (build.ts) is every clause that picture
 * has to satisfy, and this file proves each one **can fail** by mutating the one condition
 * it guards — a check that cannot fail is not a check:
 *
 *   1. the honest build is silent, and all five Northshore cards carry their own labelled
 *      illustration (the pages are rendered here, from the fixture on disk);
 *   2. a licence that is not a labelled AI-generated illustration is refused by name
 *      (CC0/public domain and a client-supplied photograph are both the wrong kind of
 *      picture for a card);
 *   3. a card picture that names no service is refused — nothing guesses the card from the
 *      file name or the order of the list;
 *   4. a card that shows its picture with the label removed is refused, naming the service;
 *   5. a picture the record declares and the manifest does not record is refused.
 *
 * No network. The five sets are the real 400/600 JPEGs the fixture ships, measured from
 * their bytes, so the widths in the record are checked against the files rather than
 * assumed.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { resolveBuildParts, serviceCardImageProblems } from "../src/demo/build.ts";
import { composePrivacy, illustrationLabel, profileFor } from "../src/demo/copy.ts";
import { esc, renderPages, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
import { SERVICE_CARD_ACTION_VAR, serviceCardActionDecision } from "../src/demo/service-card-action.ts";
import { inspectSuppliedImage } from "../src/demo/supplied.ts";
import type { BusinessRecord, ManifestImage } from "../src/demo/types.ts";

const FIXTURES = join(import.meta.dir, "fixtures");
const SLUG = "northshore-garden-works";
const RECORD: BusinessRecord = JSON.parse(
  readFileSync(join(FIXTURES, `${SLUG}.json`), "utf8"),
) as BusinessRecord;

/** The manifest entries, measured from the files on disk — as the build measures them. */
async function manifestImages(record: BusinessRecord): Promise<ManifestImage[]> {
  const images: ManifestImage[] = [];
  for (const image of record.images ?? []) {
    const inspected = await inspectSuppliedImage(image, FIXTURES);
    expect(inspected.problems).toEqual([]);
    const widest = inspected.variants[inspected.variants.length - 1]!;
    images.push({
      role: image.role,
      ...(image.role === "service" ? { service: image.service } : {}),
      file: widest.file,
      source: "supplied: a labelled AI-generated illustration",
      source_url: image.source_url,
      license: image.license,
      author: image.author,
      retrieved_at: "2026-11-24T00:00:00.000Z",
      width: widest.width,
      height: widest.height,
      variants: inspected.variants.map((v) => ({ file: v.file, width: v.width })),
    });
  }
  return images;
}

/** Every file the bundle really holds, as far as this check reads it. */
const bundleFiles = (images: ManifestImage[]) =>
  images.flatMap((image) => (image.variants ?? []).map((v) => v.file).filter((f): f is string => Boolean(f)));

/** The pages as the Northshore bundle renders them: nested card CTAs, field guide, marks. */
function render(record: BusinessRecord, images: ManifestImage[]): RenderedPage[] {
  const { form, delivery, copy } = resolveBuildParts(record, SLUG);
  const ctx: RenderContext = {
    record,
    copy,
    profile: profileFor(record),
    form,
    delivery,
    privacy: composePrivacy(record, form, delivery),
    images,
    slug: SLUG,
    generatedAt: "2026-11-24T00:00:00.000Z",
    serviceCardAction: serviceCardActionDecision({
      slug: SLUG,
      phase: "demo",
      env: { [SERVICE_CARD_ACTION_VAR]: "nested-cta" },
    }),
    graphics: true,
    fieldGuide: true,
  };
  return renderPages(ctx);
}

const check = (record: BusinessRecord, images: ManifestImage[], pages: RenderedPage[]) =>
  serviceCardImageProblems({ record, images, pages, bundleFiles: bundleFiles(images) });

/** One page's html, with a piece replaced — what a visitor would receive. */
const doctored = (pages: RenderedPage[], file: string, edit: (html: string) => string): RenderedPage[] =>
  pages.map((p) => (p.file === file ? { ...p, html: edit(p.html) } : p));

const pageOf = (pages: RenderedPage[], file: string) => pages.find((p) => p.file === file)!.html;

/** The card blocks of a page, in the order the record lists the services. */
const cardsOf = (html: string) => {
  const list = /<ul class="services">([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? "";
  return list.split(/<li\b[^>]*>/).slice(1).map((chunk) => chunk.slice(0, chunk.indexOf("</li>")));
};

/* ------------------------------------------------------- 1. the honest build is silent */

test("all five service cards carry their own labelled illustration, and the gate is silent", async () => {
  const images = await manifestImages(RECORD);
  const pages = render(RECORD, images);
  const cards = images.filter((image) => image.role === "service");
  expect(cards).toHaveLength(5);

  const label = esc(illustrationLabel(RECORD.name));
  for (const file of ["index.html", "services.html"]) {
    const blocks = cardsOf(pageOf(pages, file));
    expect(blocks).toHaveLength(5);
    for (const card of cards) {
      const block = blocks.find((candidate) => candidate.includes(`src="${esc(card.file!)}"`));
      expect(block).toBeDefined();
      expect(block).toContain(label);
    }
  }

  expect(check(RECORD, images, pages)).toEqual([]);
});

test("a record with no card picture is silent — Maple Avenue and every client build", () => {
  const maple: BusinessRecord = JSON.parse(
    readFileSync(join(FIXTURES, "maple-avenue-barber-shop.json"), "utf8"),
  ) as BusinessRecord;
  const { form, delivery, copy } = resolveBuildParts(maple, "maple-avenue-barber-shop");
  const pages = renderPages({
    record: maple,
    copy,
    profile: profileFor(maple),
    form,
    delivery,
    privacy: composePrivacy(maple, form, delivery),
    images: [],
    slug: "maple-avenue-barber-shop",
    generatedAt: "2026-11-24T00:00:00.000Z",
  });

  expect(check(maple, [], pages)).toEqual([]);
});

/* --------------------------------------- 2. the licence is a labelled AI illustration */

test("a card picture that is not a labelled AI-generated illustration is refused", async () => {
  const images = await manifestImages(RECORD);
  const pages = render(RECORD, images);
  const target = images.find((image) => image.service === "Snow clearing")!;

  for (const license of [
    "CC0 1.0 Universal (public domain dedication)",
    "Client-supplied (the business's own photograph, permission to publish recorded)",
  ]) {
    const mutated = images.map((image) => (image === target ? { ...image, license } : image));
    const problems = check(RECORD, mutated, pages);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(target.file!);
    expect(problems[0]).toContain("labelled AI-generated illustration");
  }
});

/* ------------------------------------------------------ 3. the picture names a service */

test("a card picture that names no service is refused — nothing guesses the card", async () => {
  const images = await manifestImages(RECORD);
  const pages = render(RECORD, images);
  const name = "Hedge and shrub trimming";

  // The condition, and only the condition: the picture stops naming its service in the
  // record and in the manifest, and is otherwise the same picture on the same page.
  const record: BusinessRecord = {
    ...RECORD,
    images: (RECORD.images ?? []).map((image) =>
      image.role === "service" && image.service === name ? { ...image, service: undefined } : image,
    ),
  };
  const mutated = images.map((image) =>
    image.service === name ? { ...image, service: undefined } : image,
  );

  const problems = check(record, mutated, pages);
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("names no service");
  expect(problems[0]).toContain("images/hedge-trimming-600.jpg");
});

/* ------------------------------------------------- 4. the card prints the AI label */

test("a card that shows its picture with no label is refused, naming the service", async () => {
  const images = await manifestImages(RECORD);
  const pages = render(RECORD, images);
  const label = esc(illustrationLabel(RECORD.name));
  expect(pageOf(pages, "services.html").split(label)).toHaveLength(6); // five cards, one label each

  // The first card on the page loses its label; the picture stays.
  const mutated = doctored(pages, "services.html", (html) => html.replace(label, ""));

  const problems = check(RECORD, images, mutated);
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("on services.html");
  expect(problems[0]).toContain("Lawn cutting and edging");
  expect(problems[0]).toContain("no label saying so");
});

/* ------------------------------------------- 5. the manifest records what the record says */

test("a card picture the manifest does not record is refused", async () => {
  const images = await manifestImages(RECORD);
  const pages = render(RECORD, images);

  // The record still declares Snow clearing's picture; the manifest has lost it.
  const mutated = images.filter((image) => image.service !== "Snow clearing");

  const problems = check(RECORD, mutated, pages);
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("Snow clearing");
  expect(problems[0]).toContain("the manifest does not record it");
});
