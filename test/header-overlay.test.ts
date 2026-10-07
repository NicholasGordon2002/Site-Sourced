#!/usr/bin/env bun
/**
 * The home header, sitting on the hero photograph (owner revisions, 6 Oct 2026) — the
 * check the change owed, because nothing asserted the header's own box before it.
 *
 *   bun test test/header-overlay.test.ts
 *
 * The owner has now rejected two header shapes in one day: the flat dark wash, and then
 * the bare box ruled off by a light hairline at each edge. Every refusal below is a way
 * the *third* shape — a scrim of the hero's own ink that eases out of the picture, with
 * no separator at either edge — could quietly stop being it:
 *
 *   1. the overlay class on a page that has no photograph, or missing from the one that
 *      has;
 *   2. an overlay declaration that is not scoped to that class — a background, a shadow or
 *      a stacking order reaching the header of an inner page, which has white paper behind
 *      it;
 *   3. a header and a body that are not in one definite grid cell — a row without a column
 *      starts a second, implicit column and the photograph runs beside the header (this was
 *      a real bug in the first cut of the change, and this is the assertion that catches it);
 *   4. **no scrim on the header's box**, a scrim in a colour that is not the hero's ink, or
 *      one too light in the band the type lands in — measured, not asserted, over the
 *      lightest pixel a photograph can hold (pure white), at the 5.6:1 this build requires;
 *   5. **a scrim that does not flow into the hero** — still painting at the header's bottom
 *      edge, deepening again as it descends, or starting below its own top edge;
 *   6. **a hairline back at any edge** — including the base rule's own
 *      `border-bottom: var(--rule)`, which the scoped `border: 0` is the only thing
 *      switching off, so removing that one declaration draws the rejected line back under
 *      the photograph;
 *   7. **a shadow, a blur or a filter standing in for an edge**;
 *   8. **the white type or the ink halo behind it** — a dark header colour, a missing
 *      `text-shadow`, a light halo, or a halo too weak (alpha, blur) to soften a stroke;
 *   9. the wordmark losing the inheritance the header's colour travels on;
 *  10. the action left as the ink pill, or the focus ring left on the accent colour;
 *  11. the phone menu's panel losing its own opaque surface, and the phone header's two
 *      rows flattened, in the marking or in the stylesheet.
 *
 * No filesystem, no network. The fixture is fictional.
 */
import { expect, test } from "bun:test";

import { headerOverlayMeasure, headerOverlayProblems } from "../src/demo/build.ts";
import { composeCopy, composePrivacy, profileFor } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { renderCss, renderPages, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
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
  services: [{ name: "Haircut" }],
};
const SLUG = "example-barber-shop";

function render(): { pages: RenderedPage[]; css: string } {
  const form = resolveForm(RECORD);
  const delivery = resolveDelivery(RECORD, form);
  const copy = composeCopy(RECORD, SLUG, form, delivery);
  const ctx: RenderContext = {
    record: RECORD,
    copy,
    profile: profileFor(RECORD),
    form,
    delivery,
    privacy: composePrivacy(RECORD, form, delivery),
    images: [],
    slug: SLUG,
    generatedAt: "2026-10-06T00:00:00.000Z",
  };
  return { pages: renderPages(ctx), css: renderCss(profileFor(RECORD), SLUG) };
}

const edit = (pages: RenderedPage[], file: string, from: string | RegExp, to: string): RenderedPage[] =>
  pages.map((page) => (page.file === file ? { ...page, html: page.html.replace(from, to) } : page));

const problems = (pages: RenderedPage[], css: string) => headerOverlayProblems(pages, css).join(" | ");

/**
 * The home page's own header rule — the box the separators, the background and the text
 * colour live on. It is found by `align-self: start`, because the same selector appears
 * once before it for `grid-area` alone, and a doctoring helper that grabbed that one
 * instead would silently test nothing.
 */
function headerRule(css: string): string {
  const block = /\.page--index \.site-header \{[^}]*align-self: start;[^}]*\}/.exec(css)?.[0];
  if (!block) throw new Error("the home header's own rule is not in the stylesheet");
  return block;
}

/** Replace text inside that rule alone, and fail loudly if the text is not there to replace. */
function inHeader(css: string, from: string | RegExp, to: string): string {
  const block = headerRule(css);
  const next = block.replace(from, to);
  if (next === block) throw new Error(`the home header's rule does not contain ${String(from)}`);
  return css.replace(block, next);
}

/** The wordmark's halo, replaced whole — the declaration the legibility clause reads. */
const HALO = ".page--index .site-header .wordmark { text-shadow: 0 1px 2px rgba(10, 12, 14, .55); }";
function wordmarkHalo(css: string, declaration: string | null): string {
  expect(css).toContain(HALO);
  return css.replace(HALO, declaration === null ? "" : `.page--index .site-header .wordmark { ${declaration} }`);
}

/** The scrim the home header paints, as the stylesheet spells it. */
const SCRIM =
  "background-image: linear-gradient(180deg, rgba(10, 12, 14, .66) 0%, rgba(10, 12, 14, .64) 70%, rgba(10, 12, 14, 0) 100%);";

/* --------------------------------------------------------------- the honest bundle */

test("the home header on the photograph passes every clause of the check", () => {
  const { pages, css } = render();
  expect(headerOverlayProblems(pages, css)).toEqual([]);
  // Positive controls for the clauses this file is about: a scrim of the hero's ink that
  // eases to nothing by the bottom edge, nothing painted under its transparent tail, no
  // rule at any edge, white type, and the ink halo behind the name.
  expect(headerRule(css)).toContain(SCRIM);
  expect(headerRule(css)).toContain("background-color: transparent;");
  expect(headerRule(css)).toContain("border: 0;");
  expect(headerRule(css)).not.toContain("border-top:");
  expect(headerRule(css)).not.toContain("border-bottom:");
  expect(headerRule(css)).toContain("color: #fff;");
  expect(css).toContain(HALO);
  // …and for the two halves the brief names: the marking and the stylesheet.
  expect(pages.find((page) => page.file === "index.html")!.html).toContain('class="page page--index"');
  expect(css).toContain(".page--index .site-header .call-button {");
});

test("with no stylesheet the check still refuses the marking half, and says no more", () => {
  // The honest limit: a caller that passes no stylesheet gets no stylesheet claims, so
  // the check could be silently softened by one. The build always passes one — the wiring
  // test below pins that — and the marking is still enforced without it.
  const { pages } = render();
  expect(problems(pages, "")).toBe("");
  const onAbout = edit(pages, "about.html", 'class="page page--about"', 'class="page page--about page--index"');
  expect(problems(onAbout, "")).toContain("is on a page with no hero");
});

/* ------------------------------------------------- 1. the class, on the right page only */

test("the overlay class on a page with no hero fails the build", () => {
  const { pages, css } = render();
  const onAbout = edit(pages, "about.html", 'class="page page--about"', 'class="page page--about page--index"');
  expect(problems(onAbout, css)).toContain("is on a page with no hero");
});

test("losing the overlay class on the home page fails the build", () => {
  const { pages, css } = render();
  const offHome = edit(pages, "index.html", 'class="page page--index"', 'class="page"');
  expect(problems(offHome, css)).toContain("does not carry class=");
});

/* --------------------------------------- 2. every overlay declaration is scoped to it */

test("a wash on the header at every width fails the build", () => {
  const { pages, css } = render();
  const hoisted = `${css}\n.site-header { background: linear-gradient(180deg, rgba(10, 12, 14, .72) 0%, rgba(10, 12, 14, .63) 100%); }\n`;
  expect(problems(pages, hoisted)).toContain("not scoped to .page--index");
  // ...and so do a stacking order or a shared cell that reaches the header globally.
  expect(problems(pages, `${css}\n.site-header { z-index: 4; }\n`)).toContain("not scoped to .page--index");
  expect(problems(pages, `${css}\nbody { display: grid; }\n`)).toContain("not scoped to .page--index");
});

/* --------------------------------------------- 3. the header and the body, one definite cell */

test("a row without a column fails the build — the implicit column that broke the first cut", () => {
  const { pages, css } = render();
  const noColumn = css.replace(".page--index main { grid-area: 2 / 1; }", ".page--index main { grid-row: 2; }");
  expect(noColumn).not.toBe(css);
  const reported = problems(pages, noColumn);
  expect(reported).toContain("not both placed in one definite row and column");
  expect(reported).toContain("implicit column");
});

test("the header and the body in different cells fails the build", () => {
  const { pages, css } = render();
  const apart = css.replace(".page--index main { grid-area: 2 / 1; }", ".page--index main { grid-area: 3 / 1; }");
  expect(problems(pages, apart)).toContain("are placed in different cells");
});

test("a body that is not a grid, or a header that does not stack, fails the build", () => {
  const { pages, css } = render();
  expect(problems(pages, css.replace(".page--index body { display: grid;", ".page--index body {"))).toContain("is not a grid");
  expect(problems(pages, css.replace("  z-index: 1;", "  z-index: 0;"))).toContain("does not stack above the photograph");
  expect(problems(pages, css.replace("  align-self: start;", "  align-self: stretch;"))).toContain("not pushed to the top of its cell");
});

/* ------------------------------------ 4-6. the scrim, and the hairlines it replaced */

test("a home header with no scrim at all fails the build", () => {
  // With the hairlines gone, the scrim is the only thing between white type and an
  // unknown photograph: the picture alone reaches 4.2:1 over the lightest one this build
  // has built, and 1.7:1 over a light patch of any of them.
  const { pages, css } = render();
  const bare = inHeader(css, SCRIM, "background-image: none;");
  const reported = problems(pages, bare);
  expect(reported).toContain("has no surface of its own");
  expect(reported).toContain("below AA");
});

test("the base paper surface showing through the scrim's transparent tail fails the build", () => {
  // The real regression: the base .site-header rule paints --paper, and the scrim's last
  // stop is transparent, so an opaque background colour under it is a white band along
  // the header's bottom edge — the band the owner rejected, in the one place the scrim
  // cannot cover.
  const { pages, css } = render();
  const paper = inHeader(css, "background-color: transparent;", "background-color: var(--paper);");
  expect(paper).not.toBe(css);
  const reported = problems(pages, paper);
  expect(reported).toContain("paints an opaque background colour under its scrim");
  expect(reported).toContain("--paper");
});

test("a scrim that is not the hero's own ink fails the build", () => {
  const { pages, css } = render();
  // A light veil, a mid grey, and a colour the build cannot read as ink at all.
  const veil = inHeader(css, "rgba(10, 12, 14, .66) 0%", "rgba(255, 255, 255, .4) 0%");
  expect(problems(pages, veil)).toContain("not mixed from the hero's own ink");
  const grey = inHeader(css, "rgba(10, 12, 14, .64) 70%", "rgba(120, 120, 120, .64) 70%");
  expect(problems(pages, grey)).toContain("not mixed from the hero's own ink");
});

test("a scrim too light where the type lands fails the build", () => {
  // The clause the whole treatment exists for: measured over pure white, the lightest
  // pixel a photograph can hold, at the band the wordmark, the wide row's links and the
  // action sit in.
  const { pages, css } = render();
  const weak = inHeader(css, "rgba(10, 12, 14, .66) 0%", "rgba(10, 12, 14, .4) 0%");
  const reported = problems(pages, weak);
  expect(reported).toContain("too light where the type lands");
  expect(reported).toContain("needs 5.6:1");
  // …and in the band itself: .64 is what the shipped scrim holds there, and .5 would be
  // the 4.1:1 the old halo treatment had to rescue.
  const band = inHeader(css, "rgba(10, 12, 14, .64) 70%", "rgba(10, 12, 14, .5) 70%");
  expect(problems(pages, band)).toContain("too light where the type lands");
});

test("a scrim that does not flow into the hero fails the build", () => {
  const { pages, css } = render();
  // Still painting at the bottom edge: the band the owner rejected, drawn by an alpha.
  const band = inHeader(css, "rgba(10, 12, 14, 0) 100%", "rgba(10, 12, 14, .5) 100%");
  const reported = problems(pages, band);
  expect(reported).toContain("does not reach the picture");
  expect(reported).toContain("draws that edge");
  // Deepening again after easing out: two surfaces with a seam.
  const rising = inHeader(css, "rgba(10, 12, 14, .64) 70%", "rgba(10, 12, 14, .8) 70%");
  expect(problems(pages, rising)).toContain("deepens as it goes down");
  // Starting below its own top edge: the top of the box painted by a stop nothing read.
  const late = inHeader(css, "rgba(10, 12, 14, .66) 0%", "rgba(10, 12, 14, .66) 8%");
  expect(problems(pages, late)).toContain("does not start at its top edge");
});

test("a hairline back at any edge fails the build", () => {
  // The shape the owner rejected outright on 6 Oct 2026, at both edges and in the
  // shorthand that would draw it on all four.
  const { pages, css } = render();
  const ruled = inHeader(css, "border: 0;", "border: 0;\n  border-bottom: 1px solid rgba(255, 255, 255, .55);");
  const reported = problems(pages, ruled);
  expect(reported).toContain("carries a hairline on its bottom edge");
  expect(reported).toContain("no separator at the header/hero or header/disclaimer edge");
  const topline = inHeader(css, "border: 0;", "border: 0;\n  border-top: 1px solid rgba(255, 255, 255, .55);");
  expect(problems(pages, topline)).toContain("carries a hairline on its top edge");
  const shorthand = inHeader(css, "border: 0;", "border: 1px solid rgba(255, 255, 255, .55);");
  expect(problems(pages, shorthand)).toContain("through its border shorthand");
});

test("the base header's own rule coming back on the home header fails the build", () => {
  // The regression this clause exists for, and the one the previous shape could not see:
  // the base .site-header rule ends in border-bottom: var(--rule) — a 1px #E6E2DA hairline
  // over the photograph — and only the scoped switch-off removes it. Delete the
  // switch-off alone and the rejected line is back with nothing else changed.
  const { pages, css } = render();
  const leaked = inHeader(css, "border: 0;\n", "");
  expect(leaked).not.toBe(css);
  const reported = problems(pages, leaked);
  expect(reported).toContain("not switched out of the base header's own rule");
  expect(reported).toContain("var(--rule)");
});

test("a shadow, a blur or a filter standing in for an edge fails the build", () => {
  const { pages, css } = render();
  const shadowed = inHeader(css, "border: 0;", "border: 0;\n  box-shadow: 0 2px 6px rgba(10, 12, 14, .5);");
  expect(problems(pages, shadowed)).toContain("carries a shadow around its box again");
  const blurred = inHeader(css, "border: 0;", "border: 0;\n  backdrop-filter: blur(4px);");
  expect(problems(pages, blurred)).toContain("carries a blur over the picture behind it again");
  const filtered = inHeader(css, "border: 0;", "border: 0;\n  filter: brightness(0.6);");
  expect(problems(pages, filtered)).toContain("carries a filter over the picture behind it again");
});

/* -------------------------------------- 6. white type, and the ink halo behind the name */

test("a header whose own type is not white fails the build", () => {
  const { pages, css } = render();
  const dark = inHeader(css, "  color: #fff;\n}", "  color: var(--body-text);\n}");
  const reported = problems(pages, dark);
  expect(reported).toContain("the home header's text colour is rgb(61, 68, 76)");
  expect(reported).toContain("of the luminance of white");
  // …and a header with no colour of its own at all is refused before that: the body
  // colour would be what a visitor reads on the photograph.
  const none = inHeader(css, "  color: #fff;\n}", "}");
  expect(problems(pages, none)).toContain("declares no readable text colour");
});

test("a wordmark with no halo fails the build", () => {
  const { pages, css } = render();
  const none = wordmarkHalo(css, null);
  const reported = problems(pages, none);
  expect(reported).toContain("the wordmark declares no text shadow");
  expect(reported).toContain("a soft ink halo behind the glyphs is the whole of the legibility device now");
});

test("a halo that is not ink, or too weak to be the legibility device, fails the build", () => {
  const { pages, css } = render();
  const light = wordmarkHalo(css, "text-shadow: 0 1px 2px rgba(255, 255, 255, .6);");
  expect(problems(pages, light)).toContain("is a light halo");
  // alpha .39 is under the .4 floor, 0px and 6px of blur are outside the 1–4px band.
  const faint = wordmarkHalo(css, "text-shadow: 0 1px 2px rgba(10, 12, 14, .39);");
  expect(problems(pages, faint)).toContain("too weak to be the legibility device (alpha 0.39, blur 2px)");
  const hard = wordmarkHalo(css, "text-shadow: 0 1px 0 rgba(10, 12, 14, .55);");
  expect(problems(pages, hard)).toContain("too weak to be the legibility device (alpha 0.55, blur 0px)");
  const smeared = wordmarkHalo(css, "text-shadow: 0 1px 6px rgba(10, 12, 14, .55);");
  expect(problems(pages, smeared)).toContain("too weak to be the legibility device (alpha 0.55, blur 6px)");
});

test("a wordmark that stops inheriting its colour fails the build", () => {
  const { pages, css } = render();
  const fixed = css.replace("  color: inherit;", "  color: var(--body-text);");
  expect(fixed).not.toBe(css);
  expect(problems(pages, fixed)).toContain("no longer inherits its colour");
});

/* ------------------------------------------- 7-8. the action, the focus ring, the panel */

test("the action left as the ink pill fails the build", () => {
  const { pages, css } = render();
  const inkPill = css
    .replace(".page--index .site-header .call-button { background: #fff; color: var(--ink); }", "")
    .replace(".page--index .site-header .call-button:hover { background: #F1EEE8; color: var(--ink); }", "");
  expect(problems(pages, inkPill)).toContain("not switched off the ink pill");
  // The "painted over a chip that is not an action" half of this clause left with the
  // chip: the header's action is the only element in the header wearing the button
  // treatment now, and `headerActionProblems` refuses a second one in the markup — the
  // place a dead chip would reappear — rather than exempting it in CSS.
});

test("the accent focus ring on the wash fails the build", () => {
  const { pages, css } = render();
  const faded = css.replace(".page--index .site-header :focus-visible { outline-color: #fff; }", "");
  expect(faded).not.toBe(css);
  expect(problems(pages, faded)).toContain("focus ring is not set for the wash");
});

/* ------------------------------------------------- 9. the panel, and the phone's two rows */

test("the narrow row's links left dark on the wash, and the panel losing its surface, fail the build", () => {
  const { pages, css } = render();
  const dark = css
    .replace("  .page--index .site-header .site-nav a { color: #fff; text-shadow: 0 1px 2px rgba(10, 12, 14, .55); }\n", "")
    .replace("  .page--index .site-header .site-nav a[aria-current=\"page\"] { color: #fff; border-bottom-color: #fff; }\n", "");
  expect(dark).not.toBe(css);
  expect(problems(pages, dark)).toContain("wide row's navigation keeps its own colour");
  expect(problems(pages, `${css}\n.site-nav { background: none; }\n`)).toContain("no longer has an opaque surface");
});

test("the phone header's two rows flattened fail the build", () => {
  const { pages, css } = render();
  expect(problems(pages, css.replace("flex: 1 1 50%;", "flex: 1 1 100%;"))).toContain("phone basis has changed");
  expect(problems(pages, css.replace("  height: 2.75rem;", "  height: 2rem;"))).toContain("no longer 44×44px");
  expect(problems(pages, css.replaceAll("  min-height: 2.75rem;", "  min-height: 2rem;"))).toContain("no longer at least 44px tall");
});

/* ------------------------------------- the manifest half: what a reviewer reads off it */

test("the manifest records the scrim and the absence of rules, and refuses a bundle without them", () => {
  const { css } = render();
  const measured = headerOverlayMeasure(css);
  expect(measured).not.toBeNull();
  expect(measured!.surface).toContain("rgba(10, 12, 14, .64) 70%");
  expect(measured!.surface).toContain("alpha 0 at 100%");
  expect(measured!.surface).toContain("the 5.6:1 this build requires");
  expect(measured!.surface).toContain("No rule at either edge");
  expect(measured!.text_shadow).toBe("0 1px 2px rgba(10, 12, 14, .55)");
  // A box with no scrim on it is not a bundle: the measure returns null and the manifest
  // records no treatment at all.
  const bare = inHeader(css, SCRIM, "background-image: none;");
  expect(headerOverlayMeasure(bare)).toBeNull();
});

/* ---------------------------------------- the check the read-only audit could not make */

test("the check is wired into the build's own self-check, not merely defined", async () => {
  const source = await Bun.file(new URL("../src/demo/build.ts", import.meta.url)).text();
  expect(source).toContain('...headerOverlayProblems(pages, vars.css ?? "")');
});
