#!/usr/bin/env bun
/**
 * The home header, sitting on the hero photograph (owner revisions, 6 Oct 2026) — the
 * check the change owed, because nothing asserted the header's own box before it.
 *
 *   bun test test/header-overlay.test.ts
 *
 * The owner's second revision the same day removed the dark wash from the header and put
 * a light rule at each edge instead, with an ink halo behind the white type. Every
 * refusal below is a way *that* change could quietly stop doing what it was asked for:
 *
 *   1. the overlay class on a page that has no photograph, or missing from the one that
 *      has;
 *   2. an overlay declaration that is not scoped to that class — a background, a shadow or
 *      a stacking order reaching the header of an inner page, which has white paper behind
 *      it;
 *   3. a header and a body that are not in one definite grid cell — a row without a column
 *      starts a second, implicit column and the photograph runs beside the header (this was
 *      a real bug in the first cut of the change, and this is the assertion that catches it);
 *   4. **the header's box painted again** — the wash the owner had taken off, a tint, a
 *      filter, a blur or a shadow: the picture is meant to show through the box;
 *   5. **a separator missing or wrong at either edge** — the two light rules are the whole
 *      of the delimitation now, so one of them being absent, thick, dark, opaque or
 *      dashed is the header losing its edge;
 *   6. **the white type or the ink halo that keeps it legible** — a dark header colour,
 *      a missing `text-shadow`, a light halo, or a halo too weak (alpha, blur) to be the
 *      legibility device;
 *   7. the wordmark losing the inheritance the header's colour travels on;
 *   8. the action left as the ink pill, or the focus ring left on the accent colour;
 *   9. the phone menu's panel losing its own opaque surface, and the phone header's two
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

/* --------------------------------------------------------------- the honest bundle */

test("the home header on the photograph passes every clause of the check", () => {
  const { pages, css } = render();
  expect(headerOverlayProblems(pages, css)).toEqual([]);
  // Positive controls for the clauses this file is about: bare box, two light 1px rules a
  // shade under opaque white at each edge, white type, and the ink halo behind the name.
  expect(headerRule(css)).toContain("background: none;");
  expect(headerRule(css)).toContain("border-top: 1px solid rgba(255, 255, 255, .55);");
  expect(headerRule(css)).toContain("border-bottom: 1px solid rgba(255, 255, 255, .55);");
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

/* --------------------------------- 4. the header's box is bare — nothing painted on it */

test("the base paper fill coming back on the home header fails the build", () => {
  // The real regression: with the scoped `background: none` gone, the base
  // `.site-header { background: var(--paper) }` is what the header paints again, and the
  // white band the owner asked to be rid of is back over the photograph.
  const { pages, css } = render();
  const paper = inHeader(css, "  background: none;\n", "");
  expect(problems(pages, paper)).toContain("carries a background again");
  expect(problems(pages, paper)).toContain("background: var(--paper)");
});

test("a background at any strength on the home header fails the build", () => {
  const { pages, css } = render();
  const washed = inHeader(css, "  background: none;", "  background: linear-gradient(180deg, rgba(10, 12, 14, .72) 0%, rgba(10, 12, 14, .63) 100%);");
  expect(problems(pages, washed)).toContain("carries a background again");
  const tinted = inHeader(css, "  background: none;", "  background-color: rgba(10, 12, 14, .2);");
  expect(problems(pages, tinted)).toContain("carries a background colour again");
  const image = inHeader(css, "  background: none;", "  background-image: url(images/hero.jpg);");
  expect(problems(pages, image)).toContain("carries a wash again");
});

test("a filter, a blur or a shadow standing in for the surface fails the build", () => {
  // The wash is off the box, so the picture shows through it — and every other way of
  // putting something between the type and the photograph has to be refused too, or the
  // owner's "no background band" is undone one property at a time.
  const { pages, css } = render();
  const shadowed = inHeader(css, "  background: none;", "  background: none;\n  box-shadow: 0 2px 6px rgba(10, 12, 14, .5);");
  expect(problems(pages, shadowed)).toContain("carries a shadow around its box again");
  const blurred = inHeader(css, "  background: none;", "  background: none;\n  backdrop-filter: blur(4px);");
  expect(problems(pages, blurred)).toContain("carries a blur over the picture behind it again");
  const filtered = inHeader(css, "  background: none;", "  background: none;\n  filter: brightness(0.6);");
  expect(problems(pages, filtered)).toContain("carries a filter over the picture behind it again");
});

/* --------------------------- 5. one light rule at each edge — the whole delimitation now */

test("a separator missing at either edge fails the build", () => {
  const { pages, css } = render();
  const noTop = inHeader(css, "  border-top: 1px solid rgba(255, 255, 255, .55);\n", "");
  const top = problems(pages, noTop);
  expect(top).toContain("has no separator at its top edge");
  expect(top).toContain("between the header and the proposal banner");
  const noBottom = inHeader(css, "  border-bottom: 1px solid rgba(255, 255, 255, .55);", "  border-bottom: 0;");
  const bottom = problems(pages, noBottom);
  expect(bottom).toContain("has no separator at its bottom edge");
  expect(bottom).toContain("between the header and the hero content");
});

test("a separator thicker than a hairline fails the build", () => {
  const { pages, css } = render();
  const thick = inHeader(css, "  border-top: 1px solid", "  border-top: 3px solid");
  expect(problems(pages, thick)).toContain("top separator is 3px thick");
});

test("a separator that is not a solid rule fails the build", () => {
  const { pages, css } = render();
  const dashed = inHeader(css, "  border-top: 1px solid", "  border-top: 1px dashed");
  expect(problems(pages, dashed)).toContain("is not a solid rule");
  // A width and a colour with no style at all is a border that does not paint in CSS.
  const unstyled = inHeader(css, "  border-top: 1px solid rgba(255, 255, 255, .55);", "  border-top-width: 1px;");
  expect(problems(pages, unstyled)).toContain("is not a solid rule");
});

test("a separator that is not a light, partly transparent white fails the build", () => {
  const { pages, css } = render();
  // A dark rule, an opaque one and one this build cannot read as a colour: each of the
  // three ways the light hairline can stop being the light hairline.
  const dark = inHeader(css, "border-top: 1px solid rgba(255, 255, 255, .55)", "border-top: 1px solid rgba(10, 12, 14, .55)");
  expect(problems(pages, dark)).toContain("top separator is not a light rule this build can read as one");
  const opaque = inHeader(css, "border-bottom: 1px solid rgba(255, 255, 255, .55)", "border-bottom: 1px solid #fff");
  expect(problems(pages, opaque)).toContain("bottom separator is not a light rule this build can read as one");
  const faded = inHeader(css, "border-bottom: 1px solid rgba(255, 255, 255, .55)", "border-bottom: 1px solid rgba(255, 255, 255, .1)");
  expect(problems(pages, faded)).toContain("bottom separator is not a light rule this build can read as one");
  const unreadable = inHeader(css, "border-top: 1px solid rgba(255, 255, 255, .55)", "border-top: 1px solid currentColor");
  expect(problems(pages, unreadable)).toContain("top separator is not a light rule this build can read as one");
});

test("the edges the clause allows still pass: 2px, and a shade under opaque white", () => {
  // The other side of the refusals above: the clause must not be so tight that the
  // treatment it is protecting cannot exist. 1px is the rule the owner asked for; 2px is
  // the top of the range, and .55 through .9 is the alpha range a light rule may use.
  const { pages, css } = render();
  const allowed = css
    .replaceAll("border-top: 1px solid rgba(255, 255, 255, .55)", "border-top: 2px solid rgba(255, 255, 255, .9)")
    .replaceAll("border-bottom: 1px solid rgba(255, 255, 255, .55)", "border-bottom: 2px solid rgba(230, 230, 230, .25)");
  expect(allowed).not.toBe(css);
  expect(headerOverlayProblems(pages, allowed)).toEqual([]);
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

test("the manifest records the two separators and the halo, and refuses a bundle without them", () => {
  const { css } = render();
  const measured = headerOverlayMeasure(css);
  expect(measured).not.toBeNull();
  expect(measured!.separators).toContain("border-top: 1px solid rgba(255, 255, 255, .55)");
  expect(measured!.separators).toContain("border-bottom: 1px solid rgba(255, 255, 255, .55)");
  expect(measured!.separators).toContain("none background");
  expect(measured!.text_shadow).toBe("0 1px 2px rgba(10, 12, 14, .55)");
  // A wash back on the box, or a header box the reader cannot make sense of, is not a
  // bundle: the measure returns null and the manifest records no treatment at all.
  const washed = inHeader(css, "  background: none;", "  background: rgba(10, 12, 14, .55);");
  expect(headerOverlayMeasure(washed)).toBeNull();
});

/* ---------------------------------------- the check the read-only audit could not make */

test("the check is wired into the build's own self-check, not merely defined", async () => {
  const source = await Bun.file(new URL("../src/demo/build.ts", import.meta.url)).text();
  expect(source).toContain('...headerOverlayProblems(pages, vars.css ?? "")');
});
