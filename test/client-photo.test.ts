#!/usr/bin/env bun
/**
 * **A photograph the client supplied.**
 *
 *   bun test test/client-photo.test.ts
 *
 * `license` accepted two kinds of picture: a CC0/public-domain file we already hold, and a
 * labelled AI-generated fallback. Neither is the client's own photograph of their own
 * business, so a delivered build had no way to record one honestly — the build turned it
 * away. This file pins the third kind:
 *
 *   1. `license` starting "Client-supplied" is accepted, and the manifest records it as the
 *      client's own picture — not as stock, not as an illustration;
 *   2. a **delivered** build carries it and prints a credit line under it, built from the
 *      author the record names;
 *   3. a **demonstration** may not: `clientPhotoProblems` refuses the licence kind by name,
 *      because an unsolicited proposal has no client to have supplied anything;
 *   4. a client-supplied picture with no author recorded is refused — the credit line the
 *      page prints would name nobody;
 *   5. a page that shows the picture with no credit line is refused, and a page that prints
 *      the credit without showing the picture is refused too;
 *   6. the credit never calls the picture free-to-use, stock or public domain.
 *
 * No network. The one bundle built from files reads `test/records/images/` — the same real
 * JPEGs the delivered-phase fixture uses — so the picture is measured exactly as a build
 * measures one.
 */
import { expect, test } from "bun:test";
import { join } from "node:path";

import { clientPhotoProblems, complianceChecks, resolveBuildParts } from "../src/demo/build.ts";
import {
  clientPhotoCredit,
  composeCopy,
  composePrivacy,
  isClientSuppliedImage,
  isIllustrativeImage,
  profileFor,
} from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { sourceImages } from "../src/demo/images.ts";
import { esc, renderEditingReadme, renderPages, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
import { inspectSuppliedImage, manifestForSupplied } from "../src/demo/supplied.ts";
import type { BusinessRecord, ImageOverride, ManifestImage } from "../src/demo/types.ts";

const BUSINESS_NAME = "Example Barber Shop";
const AUTHOR = "Dana Whitfield";
const SLUG = "example-barber-shop";

/** A record that builds as a **demonstration**: the form delivers to our own test inbox. */
const DEMO_RECORD: BusinessRecord = {
  name: BUSINESS_NAME,
  category: "Barber shop",
  source_kind: "public-listings",
  email: "shop@example-barber.ca",
  form_recipient: "site-sourced-311e0184@ctomail.io",
  form_delivery: "demo",
  form_provider: "formspark",
  form_access_key: "test-form-id",
};

/** The same record in the **delivered** phase: the client's own address receives the form. */
const DELIVERED_RECORD: BusinessRecord = {
  ...DEMO_RECORD,
  phone: "+1 905-555-0188",
  form_recipient: "shop@example-barber.ca",
  form_delivery: "business",
};

/** The client's own photograph, as a record declares one. */
const CLIENT_PHOTO: ImageOverride = {
  role: "hero",
  file: "images/hero.jpg",
  license: "Client-supplied (the business's own photograph, permission to publish recorded)",
  source_url: "",
  author: AUTHOR,
};

/** The same picture, credited to a second author, for the about slot. */
const CLIENT_ABOUT_PHOTO: ImageOverride = { ...CLIENT_PHOTO, role: "about" };

/** The manifest images a record gets, through the real sourcing path (no network). */
async function manifestImages(record: BusinessRecord): Promise<ManifestImage[]> {
  const sourced = await sourceImages(record, {
    cacheDir: "/tmp/ss-not-used",
    noImages: false,
    refresh: false,
    onNote: () => {},
  });
  return sourced.images;
}

/** Render the pages for a record, exactly as the build does. */
async function pagesFor(record: BusinessRecord, images: ManifestImage[]) {
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
  };
  return { ctx, pages: renderPages(ctx) };
}

/** One page's html, with a piece replaced — what a visitor would receive. */
const doctored = (pages: RenderedPage[], file: string, edit: (html: string) => string): RenderedPage[] =>
  pages.map((p) => (p.file === file ? { ...p, html: edit(p.html) } : p));

const checks = (vars: {
  pages: RenderedPage[];
  record: BusinessRecord;
  ctx: RenderContext;
  images: ManifestImage[];
}) => complianceChecks({ ...vars, copy: vars.ctx.copy, form: vars.ctx.form, delivery: vars.ctx.delivery, privacy: vars.ctx.privacy });

/* ------------------------------------------------------------- the licence kind itself */

test("a client-supplied licence is accepted, and recorded as the client's own photograph", async () => {
  const images = await manifestImages({ ...DEMO_RECORD, images: [CLIENT_PHOTO] });

  expect(isClientSuppliedImage(images[0]!)).toBe(true);
  // Neither of the other two kinds: it is not an illustration and it is not stock.
  expect(isIllustrativeImage(images[0]!)).toBe(false);
  expect(images[0]!.source).toBe("supplied: the client's own photograph");
  expect(images[0]!.license).toBe(CLIENT_PHOTO.license);
  // The manifest keeps the author, because the page's credit is built from it.
  expect(images[0]!.author).toBe(AUTHOR);
  expect(images[0]!.notes).toContain("The client's own photograph");
  expect(images[0]!.notes).toContain("no free-to-use licence");
});

test("a licence the build cannot place is still refused", async () => {
  await expect(
    manifestImages({ ...DEMO_RECORD, images: [{ ...CLIENT_PHOTO, license: "All rights reserved by the photographer" }] }),
  ).rejects.toThrow("only CC0, public domain, a labelled AI-generated fallback, or a client-supplied photograph may be used");
});

test("the credit line names the author and the business, and claims nothing about a licence", () => {
  const credit = clientPhotoCredit(BUSINESS_NAME, AUTHOR);
  expect(credit).toBe(`Photograph: ${AUTHOR}. Supplied by ${BUSINESS_NAME}.`);
  expect(credit).not.toMatch(/free-to-use|public domain|stock/i);
});

/* ---------------------------------------------------------------- the delivered phase */

test("a delivered build prints the credit line under the client's own photograph", async () => {
  const images = await manifestImages({ ...DELIVERED_RECORD, images: [CLIENT_PHOTO] });
  const { ctx, pages } = await pagesFor(DELIVERED_RECORD, images);
  const credit = esc(clientPhotoCredit(BUSINESS_NAME, AUTHOR));

  const index = pages.find((p) => p.file === "index.html")!.html;
  expect(index).toContain(credit);
  expect(index).toContain(`<figcaption class="wrap muted hero-caption">${credit}</figcaption>`);
  // The caption is a real figcaption under the hero, not hidden from a reader.
  expect(index.indexOf("<figcaption")).toBeGreaterThan(index.indexOf('class="hero'));
  expect(index).not.toContain("generated by AI as a placeholder");

  // The delivered README tells the client the truth about their own picture: not stock, and
  // nothing waiting on a replacement photograph.
  const readme = renderEditingReadme(ctx, pages);
  expect(readme).toContain("supplied by you and is your own");
  expect(readme).not.toContain("free-to-use (CC0 / public-domain) stock photograph");
  expect(readme).not.toContain("AI-generated illustration");

  // And the whole self-check is clean: the delivered build accepts the picture.
  expect(checks({ pages, record: DELIVERED_RECORD, ctx, images })).toEqual([]);
});

test("a delivered build reads a real client photograph from files and credits it", async () => {
  // The same JPEGs the delivered-phase fixture carries, declared as the client's own. The
  // bytes stand in for a client's photograph; what is measured and rendered is real.
  const record: BusinessRecord = {
    ...DELIVERED_RECORD,
    images: [
      {
        role: "hero",
        license: "Client-supplied (the business's own photograph, permission to publish recorded)",
        source_url: "",
        author: AUTHOR,
        variants: [
          { file: "images/barber-hero-600.jpg", width: 600 },
          { file: "images/barber-hero-900.jpg", width: 900 },
          { file: "images/barber-hero-1200.jpg", width: 1200 },
        ],
      },
    ],
  };
  const images: ManifestImage[] = [];
  for (const image of record.images ?? []) {
    const inspected = await inspectSuppliedImage(image, join(import.meta.dir, "records"));
    expect(inspected.problems).toEqual([]);
    images.push(manifestForSupplied(image, inspected.variants));
  }

  expect(isClientSuppliedImage(images[0]!)).toBe(true);
  // The page's src is the widest file measured, and the manifest states its real size.
  expect(images[0]!.file).toBe("images/barber-hero-1200.jpg");
  expect(images[0]!.width).toBe(1200);

  const { ctx, pages } = await pagesFor(record, images);
  const index = pages.find((p) => p.file === "index.html")!.html;
  expect(index).toContain(esc(clientPhotoCredit(BUSINESS_NAME, AUTHOR)));
  expect(checks({ pages, record, ctx, images })).toEqual([]);
});

/* ------------------------------------------------------------ the demonstration refusal */

test("a demonstration may not declare a client-supplied photograph — refused by name", async () => {
  const images = await manifestImages({ ...DEMO_RECORD, images: [CLIENT_PHOTO] });
  const { ctx, pages } = await pagesFor(DEMO_RECORD, images);

  const problems = checks({ pages, record: DEMO_RECORD, ctx, images }).join(" | ");
  expect(problems).toContain('declares the licence "client-supplied"');
  expect(problems).toContain("only a delivered build may carry one");
  expect(problems).toContain("an unsolicited proposal has no client to have supplied anything");
  expect(problems).toContain("images/hero.jpg");

  // The clause is the one that refuses it, not a neighbour: called on its own, with the
  // same inputs and the phase a demonstration resolves to, it refuses; in the delivered
  // phase the same images are accepted.
  expect(clientPhotoProblems({ pages, record: DEMO_RECORD, images, phase: "demo" }).join(" | ")).toContain(
    'declares the licence "client-supplied"',
  );
  expect(clientPhotoProblems({ pages, record: DEMO_RECORD, images, phase: "business" })).toEqual([]);
});

/* ------------------------------------------------------------------- the credit checks */

test("a client-supplied photograph with no author recorded is refused", async () => {
  const images = await manifestImages({ ...DELIVERED_RECORD, images: [{ ...CLIENT_PHOTO, author: "  " }] });
  const { ctx, pages } = await pagesFor(DELIVERED_RECORD, images);

  const problems = checks({ pages, record: DELIVERED_RECORD, ctx, images }).join(" | ");
  expect(problems).toContain("is recorded as client-supplied but names no author");
  expect(problems).toContain("record who took it");
});

test("a page that shows the client's photograph with no credit line fails the build", async () => {
  const images = await manifestImages({ ...DELIVERED_RECORD, images: [CLIENT_PHOTO] });
  const { ctx, pages } = await pagesFor(DELIVERED_RECORD, images);

  // What a template edit would do: drop the caption, keep the picture.
  const stripped = doctored(pages, "index.html", (html) => html.replace(/<figcaption[\s\S]*?<\/figcaption>/g, ""));
  expect(stripped.find((p) => p.file === "index.html")!.html).not.toContain(clientPhotoCredit(BUSINESS_NAME, AUTHOR));

  const problems = checks({ pages: stripped, record: DELIVERED_RECORD, ctx, images }).join(" | ");
  expect(problems).toContain("on index.html: shows the client-supplied hero photograph (images/hero.jpg) with no credit line under it");
  expect(problems).toContain("the page must say whose it is");
});

test("a page that prints the credit without showing the picture fails the build", async () => {
  const images = await manifestImages({ ...DELIVERED_RECORD, images: [CLIENT_PHOTO] });
  const { ctx, pages } = await pagesFor(DELIVERED_RECORD, images);

  // The services page shows no image slot, so a credit on it names an author for a picture
  // the visitor cannot see.
  const credit = esc(clientPhotoCredit(BUSINESS_NAME, AUTHOR));
  const withCredit = doctored(pages, "services.html", (html) => html.replace("</main>", `<p class="muted">${credit}</p></main>`));
  expect(withCredit.find((p) => p.file === "services.html")!.html).toContain(credit);

  const problems = checks({ pages: withCredit, record: DELIVERED_RECORD, ctx, images }).join(" | ");
  expect(problems).toContain("on services.html: carries the client-photograph credit");
  expect(problems).toContain("although this page shows no client-supplied photograph");
});

test("two client photographs, one per slot, are each credited on the pages that show them", async () => {
  const images = await manifestImages({
    ...DELIVERED_RECORD,
    images: [CLIENT_PHOTO, { ...CLIENT_ABOUT_PHOTO, author: "Second Photographer" }],
  });
  const { ctx, pages } = await pagesFor(DELIVERED_RECORD, images);
  const heroCredit = esc(clientPhotoCredit(BUSINESS_NAME, AUTHOR));
  const aboutCredit = esc(clientPhotoCredit(BUSINESS_NAME, "Second Photographer"));

  const index = pages.find((p) => p.file === "index.html")!.html;
  const about = pages.find((p) => p.file === "about.html")!.html;
  expect(index).toContain(heroCredit);
  expect(index).toContain(aboutCredit);
  // The About page shows the about slot only, so it carries that picture's credit alone.
  expect(about).toContain(aboutCredit);
  expect(about).not.toContain(heroCredit);
  expect(checks({ pages, record: DELIVERED_RECORD, ctx, images })).toEqual([]);
});
