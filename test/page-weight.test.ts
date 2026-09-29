#!/usr/bin/env bun
/**
 * What a page weighs, and what the build refuses to ship.
 *
 *   bun test test/page-weight.test.ts
 *
 * This is the check behind the biggest single win in the demo generator: a 2.7 MB
 * phone page, of which 2.62 MB was one hand-supplied hero that was a PNG wearing a
 * `.jpg` name. Four things are asserted here, in the order they can go wrong:
 *
 *   1. `pageLoadout` counts the files a phone actually downloads — one hero variant,
 *      not the whole set — so the number the budget is compared against is real.
 *   2. A page over the ceiling fails, naming the page and the heaviest file.
 *   3. A supplied image is held to the same budget as a downloaded one, and a file
 *      whose bytes contradict its name fails rather than shipping.
 *   4. A real fixture still builds, and its hero markup describes the file that is
 *      really the largest candidate.
 *
 * No network. Fixtures are fictional.
 */
import { expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { buildBundle } from "../src/demo/build.ts";
import { extensionForFormat, sniffImageFormat } from "../src/demo/images.ts";
import { inspectSuppliedImage, manifestForSupplied } from "../src/demo/supplied.ts";
import { BUDGET, imageBudgetProblems, pageLoadout, phoneImageVariant, weightProblems } from "../src/demo/weight.ts";
import type { BusinessRecord, ManifestImage } from "../src/demo/types.ts";

const FIXTURES = resolve(import.meta.dir, "fixtures");
const TMP = "/tmp/ss-page-weight-test";

const HERO: ManifestImage = {
  role: "hero",
  file: "images/hero-1536.jpg",
  source: "supplied: AI-generated fallback",
  source_url: "",
  license: "AI-generated (labelled fallback - not a photograph of this business)",
  author: "test",
  retrieved_at: "2026-09-29T00:00:00.000Z",
  width: 1536,
  height: 1024,
  variants: [
    { file: "images/hero-600.jpg", width: 600 },
    { file: "images/hero-900.jpg", width: 900 },
    { file: "images/hero-1200.jpg", width: 1200 },
    { file: "images/hero-1536.jpg", width: 1536 },
  ],
};

/** A page that loads one hero variant, set for a 360px screen. */
const HTML = `<html><head><link rel="stylesheet" href="styles.css"><link rel="icon" href="favicon.svg" type="image/svg+xml"></head>
<body><img class="hero-img" src="images/hero-1536.jpg" srcset="images/hero-600.jpg 600w, images/hero-900.jpg 900w, images/hero-1200.jpg 1200w, images/hero-1536.jpg 1536w" sizes="100vw" width="1536" height="1024">
<script src="site.js"></script></body></html>`;
const CSS = `@font-face { src: url("fonts/body.woff2") }`;

function sizesFor(hero600: number, extra: Record<string, number> = {}): Map<string, number> {
  return new Map<string, number>(
    Object.entries({
      "index.html": 10 * 1024,
      "styles.css": 12 * 1024,
      "site.js": 3 * 1024,
      "favicon.svg": 322,
      "fonts/body.woff2": 46 * 1024,
      "images/hero-600.jpg": hero600,
      "images/hero-900.jpg": 95 * 1024,
      "images/hero-1200.jpg": 164 * 1024,
      "images/hero-1536.jpg": 170 * 1024,
      ...extra,
    }),
  );
}

test("a 360px screen is charged for one hero variant, not the whole set", () => {
  const sizes = sizesFor(44 * 1024);
  const load = pageLoadout({ page: "index.html", html: HTML, css: CSS, sizes, images: [HERO] });
  const files = load.map((f) => f.file);
  expect(files).toContain("images/hero-600.jpg");
  expect(files).not.toContain("images/hero-1536.jpg");
  expect(files).not.toContain("images/hero-1200.jpg");
  // The page itself, its stylesheet, script, font and favicon all count.
  expect(files.sort()).toEqual(["favicon.svg", "fonts/body.woff2", "images/hero-600.jpg", "index.html", "site.js", "styles.css"]);
  const total = load.reduce((sum, f) => sum + f.bytes, 0);
  expect(total).toBe(44 * 1024 + 10 * 1024 + 12 * 1024 + 3 * 1024 + 322 + 46 * 1024);
  expect(total).toBeLessThan(BUDGET.pageTarget);
});

test("a wider screen is charged for the variant it asks for, and a single file is charged as itself", () => {
  expect(phoneImageVariant(HERO, 800)).toBe("images/hero-900.jpg");
  expect(phoneImageVariant(HERO, 2000)).toBe("images/hero-1536.jpg");
  const single: ManifestImage = { ...HERO, file: "images/hero.jpg", variants: undefined };
  expect(phoneImageVariant(single)).toBe("images/hero.jpg");
});

test("a page over the ceiling fails, naming the page and the heaviest file it loads", () => {
  const problems = weightProblems({ page: "index.html", html: HTML, css: CSS, sizes: sizesFor(2.6 * 1024 * 1024), images: [HERO] });
  const heavy = problems.find((p) => p.includes("ceiling"));
  expect(heavy).toBeDefined();
  expect(heavy).toContain("index.html");
  expect(heavy).toContain("images/hero-600.jpg");
  expect(heavy).toContain("750 KB");
  expect(heavy).toContain("tools/prepare-images.py");
  // The same bundle also trips the single-file cap: two real problems, not one.
  expect(problems.some((p) => p.includes("700 KB cap"))).toBe(true);
});

test("a page under the ceiling passes, even when it is over the target", () => {
  const sizes = sizesFor(400 * 1024);
  const total = pageLoadout({ page: "index.html", html: HTML, css: CSS, sizes, images: [HERO] }).reduce((s, f) => s + f.bytes, 0);
  expect(total).toBeGreaterThan(BUDGET.pageTarget); // honest, and still shippable
  expect(total).toBeLessThan(BUDGET.pageCeiling);
  expect(weightProblems({ page: "index.html", html: HTML, css: CSS, sizes, images: [HERO] })).toEqual([]);
});

test("a supplied hero over the design system's budget is refused, at either end", () => {
  // Over the 180 KB hero budget for the widest file...
  const wide = imageBudgetProblems({ images: [HERO], sizes: sizesFor(44 * 1024, { "images/hero-1536.jpg": 250 * 1024 }) });
  expect(wide).toHaveLength(1);
  expect(wide[0]).toContain("images/hero-1536.jpg");
  expect(wide[0]).toContain("180 KB");
  expect(wide[0]).toContain("docs/design-system.md");
  // ...and over the 120 KB a 360px phone is allowed to download, even when every
  // file in the set is under the widest-width budget.
  const phone = imageBudgetProblems({ images: [HERO], sizes: sizesFor(130 * 1024) });
  const small = phone.find((p) => p.includes("images/hero-600.jpg"));
  expect(small).toBeDefined();
  expect(small).toContain("120 KB");
  expect(phone).toHaveLength(1);
});

test("a single un-prepared image file is charged to the hard cap, not quietly allowed by its role", () => {
  const single: ManifestImage = { ...HERO, file: "images/hero.jpg", width: 1536, variants: undefined };
  const problems = imageBudgetProblems({ images: [single], sizes: sizesFor(0, { "images/hero.jpg": 2.6 * 1024 * 1024 }) });
  expect(problems.some((p) => p.includes("images/hero.jpg") && p.includes("180 KB"))).toBe(true);
});

test("a `.jpg` whose bytes are a PNG is not a JPEG", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 0, 0, 0, 0, 0, 0, 0]);
  expect(sniffImageFormat(png)).toBe("png");
  expect(sniffImageFormat(jpeg)).toBe("jpeg");
  expect(extensionForFormat("png")).toBe(".png");
  expect(extensionForFormat(null)).toBeNull();
});

test("every variant of a real fixture is measured from the file, and a record that lies about one is refused", async () => {
  const record = JSON.parse(await readFile(join(FIXTURES, "maple-avenue-barber-shop.json"), "utf8")) as BusinessRecord;
  const declared = record.images![0]!.variants!;
  expect(declared.map((v) => v.width)).toEqual([600, 900, 1200, 1536]);

  // The declared widths are checked against the files, and the manifest is written
  // from the measurements — the page's srcset descriptor is never a typed number.
  const inspected = await inspectSuppliedImage(
    { ...HERO, variants: declared, file: declared[declared.length - 1]!.file },
    FIXTURES,
  );
  expect(inspected.problems).toEqual([]);
  expect(inspected.variants.map((v) => v.width)).toEqual([600, 900, 1200, 1536]);
  expect(inspected.variants.map((v) => v.height)).toEqual([400, 600, 800, 1024]);
  const measured = manifestForSupplied({ ...HERO }, inspected.variants);
  expect(measured.file).toBe("images/barber-hero-1536.jpg");
  expect(measured.width).toBe(1536);
  expect(measured.height).toBe(1024);

  const lying = await inspectSuppliedImage(
    {
      ...HERO,
      file: declared[3]!.file,
      variants: declared.map((v) => (v.width === 900 ? { ...v, width: 800 } : v)),
    },
    FIXTURES,
  );
  expect(lying.problems.some((p) => p.includes("900px") && p.includes("the record says"))).toBe(true);

  // A file the record names that is not on disk is reported, not thrown: the page
  // falls back to its CSS treatment and the manifest says so.
  const absent = await inspectSuppliedImage({ ...HERO, file: "images/nothing-here.jpg", variants: undefined }, FIXTURES);
  expect(absent.problems).toEqual([]);
  expect(absent.missing).toEqual(["images/nothing-here.jpg"]);
});

/**
 * A file with a real PNG signature and a real IHDR, so the header reader sees the
 * format and the dimensions. It is not a picture — nothing in this test decodes one,
 * and a 1.2 MB photograph would say no more about the cap than this does.
 */
function pngHeader(width: number, height: number, padding = 0): Uint8Array {
  const bytes = new Uint8Array(24 + padding);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // signature
  bytes.set([0, 0, 0, 13], 8); // IHDR length
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

test("a supplied image over the cap fails the build, and a mislabelled one too", async () => {
  await rm(TMP, { recursive: true, force: true });
  await mkdir(join(TMP, "images"), { recursive: true });
  // A real JPEG, correctly named: the one file in this record that is fine.
  await writeFile(join(TMP, "images", "hero-600.jpg"), await readFile(join(FIXTURES, "images", "barber-hero-600.jpg")));
  // PNG bytes wearing a `.jpg` name, at the width the record claims.
  await writeFile(join(TMP, "images", "hero-900.jpg"), pngHeader(900, 600));
  // And a 1.2 MB file, which no budget can accept at any role.
  await writeFile(join(TMP, "images", "hero-1200.png"), pngHeader(1536, 1024, 1200 * 1024));

  const record: BusinessRecord = {
    slug: "weight-test",
    name: "Weight Test Barber",
    category: "Barber shop",
    form_recipient: "site-sourced-311e0184@ctomail.io",
    form_delivery: "demo",
    form_provider: "formspark",
    form_access_key: "test-form-id",
    images: [
      {
        role: "hero",
        license: "AI-generated (labelled fallback - not a photograph of this business)",
        source_url: "",
        author: "test",
        variants: [
          { file: "images/hero-600.jpg", width: 600 },
          { file: "images/hero-900.jpg", width: 900 },
          { file: "images/hero-1200.png", width: 1536 },
        ],
      },
    ],
  };

  const error = await buildBundle(record, {
    outRoot: TMP,
    cacheDir: join(TMP, "cache"),
    recordDir: TMP,
    noImages: false,
    refresh: false,
    onNote: () => {},
  }).then(
    () => null,
    (err: Error) => err,
  );
  expect(error).not.toBeNull();
  const message = error!.message;
  // The PNG-in-a-.jpg name is caught, and so is the file that is simply too heavy.
  expect(message).toContain("images/hero-900.jpg is a PNG file with a \".jpg\" name");
  expect(message).toContain("images/hero-1200.png is 1.2 MB");
  expect(message).toContain("700 KB cap");
  expect(message).toContain("tools/prepare-images.py");
  await rm(TMP, { recursive: true, force: true });
});
