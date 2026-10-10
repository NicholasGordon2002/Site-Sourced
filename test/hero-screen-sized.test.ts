#!/usr/bin/env bun
/**
 * **The hero is sized to the screen the visitor is on** — the regression that keeps the
 * owner's direction of 9 Oct 2026 ("the home-page hero should fit the size of the screen the
 * visitor is on", with a phone equivalent of the same idea) from being quietly undone.
 *
 *   bun test test/hero-screen-sized.test.ts
 *
 * The layout is `render.ts`; the rule is `heroScreenSizeProblems` in `src/demo/build.ts`,
 * called from `complianceChecks`; this file is the test the branch that added the layout
 * asked for in its own words: *"a future edit could silently put a fixed band back and
 * nothing would refuse it."* Every clause of the rule has a test here that makes it fire,
 * and the sweep that weakens each clause in turn is recorded with the change — a regression
 * file that only ever runs green proves nothing about the clauses inside it.
 *
 * What is per clause:
 *
 *   1. the sized box: a base `.hero-figure` rule that is a two-row grid (picture, then label);
 *   2. the picture out of the flow, pinned to the box it fills;
 *   3. a height that comes from the viewport — and no `height` at all on the sized box;
 *   4. the banner's room subtracted from that height;
 *   5. the fixed-length **fallback** in front of the viewport declaration, for a browser that
 *      cannot parse the unit (and refused when it is missing or written the wrong way round);
 *   6. the room defaulting to zero on `.hero-figure` itself, every other declaration scoped to
 *      the banner's presence, and at least one of them raising it;
 *   7. the page the scoping is written against: the figure inside `<main>`, the banner a
 *      preceding sibling of `<main>`, the label in the figure's own second row, the picture
 *      inside the `.hero` box whose `position: relative` it measures against.
 *
 * Three habits this file keeps, each one a real defect in a sibling check:
 *
 *   - **every expectation is a literal written here**, never a value read off the module; the
 *     first test ties the two together, so moving a literal in the module without moving it
 *     here fails this file;
 *   - **every doctor asserts that it doctored** (`doctor`, `cssDoctor`, `move`), so a reword
 *     of the stylesheet or the markup cannot leave a test passing by measuring the untouched
 *     input;
 *   - **the harness renders with the build's own functions**, in the build's own order —
 *     `resolveBuildParts`, `sourceImages`, `renderPages`, `renderCss` — so the CSS the clauses
 *     read is the string `buildBundle` writes to `styles.css` and the pages are the pages it
 *     writes beside it.
 *
 * No filesystem writes, no network. The records read are this repository's own fixtures.
 */
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HERO_ABOVE_TOKEN,
  HERO_FIGURE_SELECTOR,
  HERO_PICTURE_SELECTOR,
  HERO_ROWS,
  HERO_VIEWPORT_UNITS,
  heroScreenSizeProblems,
  resolveBuildParts,
} from "../src/demo/build.ts";
import { composePrivacy, profileFor } from "../src/demo/copy.ts";
import { sourceImages } from "../src/demo/images.ts";
import { renderCss, renderPages, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
import type { BusinessRecord } from "../src/demo/types.ts";
const FIXTURES = join(import.meta.dir, "fixtures");
const DELIVERED_RECORD = join(import.meta.dir, "records", "business-phase.json");
const HOME = "index.html";
/** The four demonstration fixtures, by slug — named here, not counted off a directory. */
const DEMO_SLUGS = ["king-west-dental", "maple-avenue-barber-shop", "northshore-garden-works", "red-hill-property-care"];
const record = (file: string): BusinessRecord => JSON.parse(readFileSync(file, "utf8")) as BusinessRecord;
const recordFor = (slug: string): BusinessRecord => record(join(FIXTURES, `${slug}.json`));
interface Built {
  slug: string;
  record: BusinessRecord;
  pages: RenderedPage[];
  /** The stylesheet this build ships — `renderCss`, the one `buildBundle` writes. */
  css: string;
  home: string;
}
const built = new Map<string, Built>();
/**
 * Render one record the way `buildBundle` does: the resolved parts, the images the record's
 * own `images` list sources to (no network: `sourceImages` returns the supplied ones), the
 * pages, and the stylesheet `renderCss` writes for this profile.
 */
async function build(source: BusinessRecord, slug: string): Promise<Built> {
  const { form, delivery, copy } = resolveBuildParts(source, slug);
  const sourced = await sourceImages(source, { cacheDir: "/tmp/ss-hero-not-used", noImages: false, refresh: false, onNote: () => {} });
  const ctx: RenderContext = {
    record: source,
    copy,
    profile: profileFor(source),
    form,
    delivery,
    privacy: composePrivacy(source, form, delivery),
    images: sourced.images,
    slug,
    generatedAt: "2026-10-10T00:00:00.000Z",
  };
  const pages = renderPages(ctx);
  return { slug, record: source, pages, css: renderCss(profileFor(source), slug, {}), home: pages.find((page) => page.file === HOME)!.html };
}
async function of(slug: string): Promise<Built> {
  const hit = built.get(slug);
  if (hit) return hit;
  const source = slug === "business-phase-fixture" ? record(DELIVERED_RECORD) : recordFor(slug);
  const value = await build(source, source.slug ?? slug);
  built.set(slug, value);
  return value;
}
/** The problems the rule reports, as one string, for `toContain` on a sentence of its own. */
const fired = (pages: RenderedPage[], css: string): string => heroScreenSizeProblems({ pages, css }).join(" | ");
/** The same, as a list — `toEqual([])` on this is the whole "nothing is refused" claim. */
const problemsIn = (pages: RenderedPage[], css: string): string[] => heroScreenSizeProblems({ pages, css });
/** Replace one string in one page's markup, asserting the substitution matched exactly once. */
function doctor(pages: RenderedPage[], file: string, from: string, to: string): RenderedPage[] {
  let seen = 0;
  return pages.map((page) => {
    if (page.file !== file) return page;
    seen = page.html.split(from).length - 1;
    return { ...page, html: page.html.replace(from, to) };
  });
}
/** Replace one string in the stylesheet, asserting it matched exactly once. */
function cssDoctor(css: string, from: string, to: string): string {
  expect(css.split(from).length - 1, `the doctor found ${from}`).toBe(1);
  return css.replace(from, to);
}
/** Move one contiguous slice of a page's markup to just before another string in it. */
function move(html: string, slice: { from: string; to: string }, before: string): string {
  const start = html.indexOf(slice.from);
  expect(start, `the slice ${slice.from} is on the page`).toBeGreaterThan(-1);
  const end = html.indexOf(slice.to, start) + slice.to.length;
  const moved = html.slice(start, end);
  const rest = html.slice(0, start) + html.slice(end);
  const at = rest.indexOf(before);
  expect(at, `the anchor ${before} is on the page`).toBeGreaterThan(-1);
  return rest.slice(0, at) + moved + rest.slice(at);
}
/** One page of a bundle, doctored, so a clause can be shown firing on a real page. */
function pageWith(pages: RenderedPage[], html: string): RenderedPage[] {
  return pages.map((page) => (page.file === HOME ? { ...page, html } : page));
}
/* The exact strings the shipped stylesheet carries, stated here so a doctor that misses is a
   failure rather than a test measuring the untouched sheet. */
const FIGURE_RULE = ".hero-figure {\n  display: grid;\n  grid-template-rows: 1fr auto;";
const PICTURE_RULE = ".hero-img {\n  position: absolute;\n  inset: 0;";
const VIEWPORT_MIN_HEIGHT = "min-height: min(calc(100svh - var(--hero-above)), 60rem);";
const FALLBACK_MIN_HEIGHT = "min-height: 22rem;\n  " + VIEWPORT_MIN_HEIGHT;
const ROOM_WIDE = ".page--index .proposal-banner ~ main .hero-figure { --hero-above: 5rem; }";
const ROOM_TABLET = ".page--index .proposal-banner ~ main .hero-figure { --hero-above: 6.25rem; }";
const ROOM_DESKTOP = ".page--index .proposal-banner ~ main .hero-figure { --hero-above: 3.5rem; }";
const HERO_BOX = '<div class="hero hero--photo">';
const CAPTION = '<figcaption class="wrap muted hero-caption">';
const PICTURE = '<img class="hero-img"';
const ABOUT_SECTION = '<section class="section" id="about">';
test("the literals this file states are the module's, and the stylesheet is the shipped one", async () => {
  expect(HERO_FIGURE_SELECTOR).toBe(".hero-figure");
  expect(HERO_PICTURE_SELECTOR).toBe(".hero-img");
  expect(HERO_ABOVE_TOKEN).toBe("--hero-above");
  expect(HERO_ROWS).toEqual(["1fr", "auto"]);
  expect(HERO_VIEWPORT_UNITS).toEqual(["svh", "lvh", "dvh", "vh"]);
  const { css } = await of("maple-avenue-barber-shop");
  // The strings every doctor below anchors on are in the stylesheet the build writes.
  for (const shipped of [FIGURE_RULE, PICTURE_RULE, VIEWPORT_MIN_HEIGHT, FALLBACK_MIN_HEIGHT, ROOM_TABLET, ROOM_WIDE, ROOM_DESKTOP]) {
    expect(css).toContain(shipped);
  }
});
test("the four fixture home pages carry the sized box, the picture and the label in it", async () => {
  expect(DEMO_SLUGS).toHaveLength(4);
  for (const slug of DEMO_SLUGS) {
    const { home } = await of(slug);
    const figureAt = home.indexOf(`<figure class="${HERO_FIGURE_SELECTOR.slice(1)}">`);
    const figureEnd = home.indexOf("</figure>", figureAt);
    expect(figureAt, slug).toBeGreaterThan(-1);
    expect(home.indexOf(HERO_BOX), slug).toBeGreaterThan(figureAt);
    expect(home.indexOf(PICTURE), slug).toBeGreaterThan(home.indexOf(HERO_BOX));
    const captionAt = home.indexOf(CAPTION);
    expect(captionAt, slug).toBeGreaterThan(figureAt);
    expect(captionAt, slug).toBeLessThan(figureEnd);
    expect(home.indexOf("<main"), slug).toBeLessThan(figureAt);
  }
});
test("all four fixtures and the delivered build pass every hero clause", async () => {
  for (const slug of DEMO_SLUGS) {
    const { pages, css } = await of(slug);
    expect(problemsIn(pages, css), slug).toEqual([]);
  }
  const delivered = await of("business-phase-fixture");
  expect(problemsIn(delivered.pages, delivered.css)).toEqual([]);
});
test("the delivered build has no banner, ships the same sized box, and is not refused", async () => {
  const demo = await of("maple-avenue-barber-shop");
  const delivered = await of("business-phase-fixture");
  expect(delivered.home).not.toContain("proposal-banner");
  expect(delivered.home).not.toContain("proposal-banner ~");
  // Nothing in the stylesheet branches by phase: the same sized box ships to a client, whose
  // page simply has no banner above the hero for the scoped rule to match.
  const block = (css: string) => css.slice(css.indexOf(FIGURE_RULE), css.indexOf("}", css.indexOf(FIGURE_RULE)) + 1);
  expect(block(delivered.css)).toBe(block(demo.css));
  expect(delivered.css).toContain(ROOM_TABLET);
  expect(problemsIn(delivered.pages, delivered.css)).toEqual([]);
});
test("a stylesheet with no base .hero-figure rule is refused", async () => {
  const { pages, css } = await of("maple-avenue-barber-shop");
  // The class taken out of both base rules that name it — the sizing rule and the margin
  // one — so the stylesheet the check reads really has no `.hero-figure` rule at all.
  let doctored = cssDoctor(css, FIGURE_RULE, ".hero-box {\n  display: grid;\n  grid-template-rows: 1fr auto;");
  doctored = cssDoctor(doctored, ".hero-figure, .about-figure { margin: 0; }", ".hero-box, .about-figure { margin: 0; }");
  expect(fired(pages, doctored)).toContain("the stylesheet ships no base `.hero-figure` rule");
});
test("a sized box that is not a grid is refused", async () => {
  const { pages, css } = await of("maple-avenue-barber-shop");
  const doctored = cssDoctor(css, FIGURE_RULE, FIGURE_RULE.replace("display: grid;", "display: block;"));
  expect(fired(pages, doctored)).toContain("is not a grid in the stylesheet the bundle ships (display: block)");
});
test("a sized box without the label's own auto row is refused", async () => {
  const { pages, css } = await of("maple-avenue-barber-shop");
  const doctored = cssDoctor(css, FIGURE_RULE, FIGURE_RULE.replace("grid-template-rows: 1fr auto;", "grid-template-rows: 1fr;"));
  expect(fired(pages, doctored)).toContain("not the two rows the sized box needs: 1fr auto");
});
test("a picture back in the flow is refused, and one not pinned to its box is refused", async () => {
  const { pages, css } = await of("maple-avenue-barber-shop");
  const inFlow = cssDoctor(css, PICTURE_RULE, PICTURE_RULE.replace("position: absolute;", "position: static;"));
  expect(fired(pages, inFlow)).toContain("is not taken out of the flow in the stylesheet the bundle ships (position: static)");
  const unpinned = cssDoctor(css, PICTURE_RULE, PICTURE_RULE.replace("inset: 0;", "inset: auto;"));
  expect(fired(pages, unpinned)).toContain("is out of the flow but not pinned to the box it fills (inset: auto;");
});
test("a hero whose height is a fixed band is refused, and so is a fixed height", async () => {
  const { pages, css } = await of("maple-avenue-barber-shop");
  const band = cssDoctor(css, VIEWPORT_MIN_HEIGHT, "min-height: 34rem;");
  expect(fired(pages, band)).toContain('the winning `min-height` on `.hero-figure` is "34rem", which names no viewport unit');
  const fixed = cssDoctor(css, VIEWPORT_MIN_HEIGHT, `height: 34rem;\n  ${VIEWPORT_MIN_HEIGHT}`);
  expect(fired(pages, fixed)).toContain("declares height: 34rem — a fixed height on the box that is meant to be the visitor's screen");
});
test("a hero that ignores the banner's room is refused", async () => {
  const { pages, css } = await of("maple-avenue-barber-shop");
  const doctored = cssDoctor(css, VIEWPORT_MIN_HEIGHT, VIEWPORT_MIN_HEIGHT.replace("calc(100svh - var(--hero-above))", "calc(100svh)"));
  expect(fired(pages, doctored)).toContain("does not subtract `var(--hero-above)`, the room the proposal banner takes above the hero");
});
test("a hero with no fallback for a browser without svh is refused", async () => {
  const { pages, css } = await of("maple-avenue-barber-shop");
  const doctored = cssDoctor(css, FALLBACK_MIN_HEIGHT, VIEWPORT_MIN_HEIGHT);
  expect(fired(pages, doctored)).toContain("with no fixed-length declaration in front of it");
});
test("a fallback written after the viewport declaration is refused", async () => {
  const { pages, css } = await of("maple-avenue-barber-shop");
  const doctored = cssDoctor(css, FALLBACK_MIN_HEIGHT, `${VIEWPORT_MIN_HEIGHT}\n  min-height: 22rem;`);
  expect(fired(pages, doctored)).toContain("writes its fallback (min-height: 22rem) after the viewport declaration");
});
test("reserving the banner's room by default is refused — the delivered build has no banner", async () => {
  const { pages, css } = await of("maple-avenue-barber-shop");
  const doctored = cssDoctor(css, "  --hero-above: 0rem;", "  --hero-above: 6.25rem;");
  expect(fired(pages, doctored)).toContain("declares --hero-above: 6.25rem, not zero");
});
test("an unscoped raise of the room is refused, and so is a stylesheet that never raises it", async () => {
  const { pages, css } = await of("maple-avenue-barber-shop");
  const unscoped = cssDoctor(css, ROOM_TABLET, ".hero-figure > .hero { --hero-above: 6.25rem; }");
  expect(fired(pages, unscoped)).toContain('the stylesheet sets --hero-above on ".hero-figure > .hero", which is not scoped to the banner\'s own presence');
  // Every rule that raises the room taken out: the subtraction then always subtracts nothing.
  let stunted = cssDoctor(css, ROOM_TABLET, "");
  stunted = cssDoctor(stunted, ROOM_WIDE, "");
  stunted = cssDoctor(stunted, ROOM_DESKTOP, "");
  expect(fired(pages, stunted)).toContain("the stylesheet never raises `--hero-above` above its default");
});
test("a label moved out of the sized box is refused", async () => {
  const { pages, css, home } = await of("maple-avenue-barber-shop");
  const moved = move(home, { from: CAPTION, to: "</figcaption>" }, ABOUT_SECTION);
  expect(pageWith(pages, moved).find((page) => page.file === HOME)!.html).not.toBe(home);
  expect(fired(pageWith(pages, moved), css)).toContain("the illustration label is outside the hero figure");
});
test("a label nested in the picture's row instead of the figure's own row is refused", async () => {
  const { pages, css, home } = await of("maple-avenue-barber-shop");
  const nested = doctor(pageWith(pages, home), HOME, CAPTION, `<div class="hero-caption-box">\n      ${CAPTION}`);
  expect(fired(nested, css)).toContain("the illustration label is nested inside the hero box rather than sitting in the figure's own second row");
});
test("a label before the picture's row is refused", async () => {
  const { pages, css, home } = await of("maple-avenue-barber-shop");
  const caption = home.slice(home.indexOf(CAPTION), home.indexOf("</figcaption>", home.indexOf(CAPTION)) + "</figcaption>".length);
  const open = `<figure class="${HERO_FIGURE_SELECTOR.slice(1)}">`;
  const at = home.indexOf(open) + open.length;
  const swapped = home.replace(caption, "").slice(0, at) + `\n      ${caption}` + home.replace(caption, "").slice(at);
  expect(fired(pageWith(pages, swapped), css)).toContain("the illustration label comes before the hero box in the sized figure");
});
test("a picture outside the .hero box it is measured against is refused", async () => {
  const { pages, css, home } = await of("maple-avenue-barber-shop");
  const picture = home.slice(home.indexOf(PICTURE), home.indexOf('decoding="async">', home.indexOf(PICTURE)) + 'decoding="async">'.length);
  const withoutPicture = home.replace(picture, "");
  const at = withoutPicture.indexOf(CAPTION);
  const moved = withoutPicture.slice(0, at) + picture + `\n      ` + withoutPicture.slice(at);
  expect(fired(pageWith(pages, moved), css)).toContain("is not inside the `.hero` box whose `position: relative` it is measured against");
});
test("a banner that is not a preceding sibling of <main> is refused — the scoping silently stops matching", async () => {
  const { pages, css, home } = await of("maple-avenue-barber-shop");
  const wrapped = doctor(pageWith(pages, home), HOME, '  <main id="main">', '  <div class="page-wrap">\n  <main id="main">');
  const closed = doctor(wrapped, HOME, "  </main>", "  </main>\n  </div>");
  expect(fired(closed, css)).toContain("the proposal banner and `<main>` are not siblings with the banner first");
});
test("a bundle with no illustration label is not refused for the label it does not carry", async () => {
  // The honest limit: the label clause is about the label the page has, so a licensed
  // photograph (no caption at all) is a different build, not a failure.
  const photo: BusinessRecord = {
    ...recordFor("maple-avenue-barber-shop"),
    images: [
      {
        role: "hero",
        license: "CC0 1.0 Universal (public domain dedication)",
        source_url: "https://example.org/photo",
        author: "Example Photographer",
        variants: [{ file: "images/barber-hero-600.jpg", width: 600 }],
      },
    ],
  };
  const { pages, css, home } = await build(photo, photo.slug!);
  expect(home).not.toContain("<figcaption");
  expect(home).toContain('class="hero-img"');
  expect(problemsIn(pages, css)).toEqual([]);
});
test("a page with no home page at all is refused", async () => {
  const { pages, css } = await of("maple-avenue-barber-shop");
  const withoutHome = pages.filter((page) => page.file !== HOME);
  expect(fired(withoutHome, css)).toContain(`the bundle carries no ${HOME}`);
});
test("a caller with no stylesheet gets the markup clause and no stylesheet claim", async () => {
  const broken = await of("maple-avenue-barber-shop");
  const moved = move(broken.home, { from: CAPTION, to: "</figcaption>" }, ABOUT_SECTION);
  expect(fired(pageWith(broken.pages, moved), "")).toContain("the illustration label is outside the hero figure");
  expect(fired(broken.pages, "")).toBe("");
});

test("a sized box with no min-height of its own is refused", async () => {
  const { pages, css } = await of("maple-avenue-barber-shop");
  const doctored = cssDoctor(css, FALLBACK_MIN_HEIGHT, "");
  expect(fired(pages, doctored)).toContain("declares no `min-height` at all");
});
test("a stylesheet that gives the room no value on the figure is refused", async () => {
  const { pages, css } = await of("maple-avenue-barber-shop");
  const doctored = cssDoctor(css, "  --hero-above: 0rem;\n", "");
  expect(fired(pages, doctored)).toContain("nothing in the stylesheet gives `--hero-above` a value on `.hero-figure` itself");
});
test("a home page without exactly one <main> is refused", async () => {
  const { pages, css, home } = await of("maple-avenue-barber-shop");
  expect(home.split('  <main id="main">').length - 1).toBe(1);
  const doctored = doctor(pageWith(pages, home), HOME, '  <main id="main">', '  <mainx id="main">');
  expect(fired(doctored, css)).toContain("carries 1 `<figure class=\"hero-figure\">` elements and 0 `<main>` elements");
});
test("a figure outside <main> is refused — the scoping loses the room it subtracts", async () => {
  const { pages, css, home } = await of("maple-avenue-barber-shop");
  const open = '  <main id="main">\n';
  const withoutOpen = home.replace(open, "");
  const at = withoutOpen.indexOf("</figure>") + "</figure>".length;
  const moved = withoutOpen.slice(0, at) + `\n${open}` + withoutOpen.slice(at);
  expect(fired(pageWith(pages, moved), css)).toContain("the hero figure is not inside `<main>`");
});
test("a picture outside the sized figure is refused", async () => {
  const { pages, css, home } = await of("maple-avenue-barber-shop");
  const picture = home.slice(home.indexOf(PICTURE), home.indexOf('decoding="async">', home.indexOf(PICTURE)) + 'decoding="async">'.length);
  const figure = `<figure class="${HERO_FIGURE_SELECTOR.slice(1)}">`;
  const withoutPicture = home.replace(picture, "");
  const at = withoutPicture.indexOf(figure);
  const moved = withoutPicture.slice(0, at) + picture + `\n    ` + withoutPicture.slice(at);
  expect(fired(pageWith(pages, moved), css)).toContain("the hero picture is outside the figure that is sized to the screen");
});
