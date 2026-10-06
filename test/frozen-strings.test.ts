#!/usr/bin/env bun
/**
 * The four frozen strings the build enforces and **no test pinned** — the gap the 6 Oct
 * gate audit named ("No test pins checks 1, 2, 3 or 11 … Every one of the four is a
 * frozen-string/self-containment rule, exactly the class WORKFLOW.md rule 6 says must have
 * a regression test").
 *
 *   bun test test/frozen-strings.test.ts
 *
 *   1. `noindex, nofollow` on every page;
 *   2. the proposal banner present on every page and **above the header** (and the first
 *      content element in `<body>`);
 *   3. the footer disclaimer **inside `<footer>`, beside the business's name** — presence
 *      was checked, adjacency was only true by construction;
 *   4. the leftover prune: a file an earlier run left behind is removed, and so is a
 *      directory the prune empties (the empty `img/` the audit found on every bundle).
 *
 * Every refusal is provoked, so no assertion here can pass for a check that cannot fail.
 * No network. The fixture is fictional.
 */
import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { complianceChecks, pruneLeftovers } from "../src/demo/build.ts";
import { composeCopy, composePrivacy, profileFor } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { PAGE_IDS, renderPages, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

const RECORD: BusinessRecord = {
  name: "Example Barber Shop",
  category: "Barber shop",
  source_kind: "fictional",
  phone: "+1 905-555-0142",
  form_recipient: "site-sourced-311e0184@ctomail.io",
  form_delivery: "demo",
  form_provider: "formspark",
  form_access_key: "test-form-id",
};
const SLUG = "example-barber-shop";
const FORM = resolveForm(RECORD);
const DELIVERY = resolveDelivery(RECORD, FORM);
const COPY = composeCopy(RECORD, SLUG, FORM, DELIVERY);
const PRIVACY = composePrivacy(RECORD, FORM, DELIVERY);

function render(): { pages: RenderedPage[]; banner: string; disclaimer: string } {
  const ctx: RenderContext = {
    record: RECORD,
    copy: COPY,
    profile: profileFor(RECORD),
    form: FORM,
    delivery: DELIVERY,
    privacy: PRIVACY,
    images: [],
    slug: SLUG,
    generatedAt: "2026-10-06T00:00:00.000Z",
  };
  return { pages: renderPages(ctx), banner: COPY.banner, disclaimer: COPY.footerDisclaimer };
}

/** One page with a string swapped — the smallest simulation of a typo. */
const edit = (pages: RenderedPage[], file: string, from: string | RegExp, to: string): RenderedPage[] =>
  pages.map((page) => (page.file === file ? { ...page, html: page.html.replace(from, to) } : page));

/** The build's own self-check, over the pages as rendered (or as doctored). */
const checks = (pages: RenderedPage[]) =>
  complianceChecks({ pages, record: RECORD, copy: COPY, form: FORM, delivery: DELIVERY, images: [], privacy: PRIVACY }).join(" | ");

/* --------------------------------------------------- 1. noindex, nofollow, per page */

test("every page carries noindex, nofollow — and removing it fails the build", () => {
  const { pages } = render();
  for (const page of pages) {
    expect(page.html).toMatch(/<meta\s+name="robots"\s+content="noindex,\s*nofollow">/);
  }
  expect(checks(pages)).toBe("");
  // A demo is an unsolicited proposal on our own domain: it may not be indexed. The
  // marker is per page, so one page losing it is enough to fail.
  for (const id of PAGE_IDS) {
    const file = `${id}.html`;
    const stripped = edit(pages, file, /<meta\s+name="robots"\s+content="noindex,\s*nofollow">/, "");
    expect(checks(stripped)).toContain(`on ${file}: missing or malformed`);
  }
});

/* ---------------------------------------------------------------- 2. the banner */

test("the proposal banner is on every page, above the header", () => {
  const { pages, banner } = render();
  for (const page of pages) {
    expect(page.html).toContain(banner);
    expect(page.html.indexOf(banner)).toBeLessThan(page.html.indexOf("<header"));
    // ...and it is the first content element in the body, after the skip link.
    expect(page.html.slice(page.html.indexOf("<body>") + 6).trim()).toMatch(/^<a class="skip-link"/);
  }
  expect(checks(pages)).toBe("");
});

test("a page without the banner fails the build", () => {
  const { pages, banner } = render();
  const stripped = edit(pages, "index.html", banner, "");
  expect(checks(stripped)).toContain("the proposal banner text is not present");
});

test("a banner below the header fails the build — a visitor must not meet the business's name first", () => {
  const { pages } = render();
  // Move the banner element itself to after </header>: the text is still present, in the
  // wrong place.
  const moved = pages.map((page) => {
    if (page.file !== "index.html") return page;
    const at = page.html.indexOf('<div class="proposal-banner"');
    const end = page.html.indexOf("</div>", at) + "</div>".length;
    const banner = page.html.slice(at, end);
    const rest = page.html.slice(0, at) + page.html.slice(end);
    return { ...page, html: rest.replace("</header>", `</header>\n${banner}`) };
  });
  const reported = checks(moved);
  expect(reported).toContain("the banner is not above the header");
  // The same page also fails the "first content element" half: both sentences describe it.
  expect(reported).toContain("is not the first content element in <body>");
});

test("content placed before the banner fails the build", () => {
  const { pages } = render();
  const preceded = edit(pages, "about.html", "<body>", "<body>\n  <p>Welcome.</p>");
  expect(checks(preceded)).toContain("is not the first content element in <body>");
});

/* ------------------------------------------------------- 3. the footer disclaimer */

test("the footer disclaimer sits inside <footer>, beside the business's name", () => {
  const { pages, disclaimer } = render();
  for (const page of pages) {
    const footer = page.html.slice(page.html.indexOf("<footer"), page.html.indexOf("</footer>"));
    expect(footer).toContain(disclaimer);
    expect(footer.indexOf(disclaimer)).toBeGreaterThan(footer.indexOf('class="footer-biz"'));
  }
  expect(checks(pages)).toBe("");
});

test("a disclaimer moved out of the footer fails the build", () => {
  const { pages, disclaimer } = render();
  const outOfFooter = pages.map((page) => {
    if (page.file !== "index.html") return page;
    const at = page.html.indexOf(`<p class="disclaimer">`);
    const end = page.html.indexOf("</p>", at) + 4;
    const line = page.html.slice(at, end);
    const rest = page.html.slice(0, at) + page.html.slice(end);
    return { ...page, html: rest.replace("</main>", `${line}\n  </main>`) };
  });
  const reported = checks(outOfFooter);
  // Present (so the old presence-only check passes) but no longer in the footer.
  expect(outOfFooter[0]!.html).toContain(disclaimer);
  expect(reported).toContain("the footer disclaimer is outside <footer>");
});

test("a disclaimer inside the footer but above the business's name fails the build", () => {
  const { pages } = render();
  const above = pages.map((page) => {
    if (page.file !== "privacy.html") return page;
    const at = page.html.indexOf(`<p class="disclaimer">`);
    const end = page.html.indexOf("</p>", at) + 4;
    const line = page.html.slice(at, end);
    const rest = page.html.slice(0, at) + page.html.slice(end);
    return { ...page, html: rest.replace('<footer class="site-footer">', `<footer class="site-footer">\n    ${line}`) };
  });
  expect(checks(above)).toContain("above the business's name rather than beside it");
});

/* ------------------------------------------------------------- 4. the leftover prune */

test("the prune removes a leftover file, and the directory it empties", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prune-test-"));
  try {
    await mkdir(join(dir, "fonts"), { recursive: true });
    await mkdir(join(dir, "img"), { recursive: true }); // the empty dir the audit found
    await mkdir(join(dir, "old"), { recursive: true });
    await mkdir(join(dir, "images"), { recursive: true });
    await writeFile(join(dir, "index.html"), "kept");
    await writeFile(join(dir, "fonts", "x.woff2"), "kept");
    await writeFile(join(dir, "images", "hero-600.jpg"), "kept");
    await writeFile(join(dir, "old", "hero-1536.jpg"), "left by an earlier run");
    await writeFile(join(dir, "hero-1536.jpg"), "left by an earlier run");

    const keep = new Set(["index.html", "manifest.json", "fonts/x.woff2", "images/hero-600.jpg"]);
    const pruned = await pruneLeftovers(dir, keep);

    expect(pruned.files.sort()).toEqual(["hero-1536.jpg", "old/hero-1536.jpg"]);
    // `old/` emptied, so it goes too — and `img/` was never used at all.
    expect(pruned.dirs.sort()).toEqual(["img", "old"]);
    expect((await readdir(dir)).sort()).toEqual(["fonts", "images", "index.html"]);
    expect(await readdir(join(dir, "fonts"))).toEqual(["x.woff2"]);
    expect(await readdir(join(dir, "images"))).toEqual(["hero-600.jpg"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a directory holding anything the bundle ships is left alone", async () => {
  const dir = await mkdtemp(join(tmpdir(), "prune-keep-"));
  try {
    await mkdir(join(dir, "fonts"), { recursive: true });
    await writeFile(join(dir, "fonts", "x.woff2"), "kept");
    await writeFile(join(dir, "index.html"), "kept");
    const pruned = await pruneLeftovers(dir, new Set(["index.html", "fonts/x.woff2"]));
    expect(pruned).toEqual({ files: [], dirs: [] });
    expect((await readdir(dir)).sort()).toEqual(["fonts", "index.html"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
