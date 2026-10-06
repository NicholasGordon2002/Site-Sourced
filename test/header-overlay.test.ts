#!/usr/bin/env bun
/**
 * The home header, sitting on the hero photograph (owner retouch, 6 Oct 2026) — the check
 * the change owed, because nothing asserted the header's own box before it.
 *
 *   bun test test/header-overlay.test.ts
 *
 * Every refusal below is a way the change could quietly stop doing what it was asked for:
 *
 *   1. the overlay class on a page that has no photograph, or missing from the one that has;
 *   2. an overlay declaration that is not scoped to that class — the header of an inner page
 *      would go dark over white paper;
 *   3. a header and a body that are not in one definite grid cell — a row without a column
 *      starts a second, implicit column and the photograph runs beside the header (this was
 *      a real bug in the first cut of the change, and this is the assertion that catches it);
 *   4. a wash too light to be legible, the action left as the ink pill, or the accent focus
 *      ring on the wash — all three measured, not asserted;
 *   5. the wordmark losing the inheritance the header's colour travels on;
 *   6. the phone menu's panel losing its own opaque surface;
 *   7. the phone header's two rows flattened, in the marking or in the stylesheet.
 *
 * No filesystem, no network. The fixture is fictional.
 */
import { expect, test } from "bun:test";

import { headerOverlayProblems } from "../src/demo/build.ts";
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

/* --------------------------------------------------------------- the honest bundle */

test("the home header on the photograph passes every clause of the check", () => {
  const { pages, css } = render();
  expect(headerOverlayProblems(pages, css)).toEqual([]);
  // Positive controls for the two halves the brief names: the marking and the stylesheet.
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
  // ...and so does a stacking order or a shared cell that reaches the header globally.
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

/* ------------------------------------------------------- 4. the wash, measured, not asserted */

test("a wash too light for white text fails the build, with the ratio it measured", () => {
  const { pages, css } = render();
  const faint = css.replace(
    "rgba(10, 12, 14, .72) 0%, rgba(10, 12, 14, .63) 100%",
    "rgba(10, 12, 14, .50) 0%, rgba(10, 12, 14, .35) 100%",
  );
  expect(faint).not.toBe(css);
  const reported = problems(pages, faint);
  expect(reported).toContain("too light for white text");
  expect(reported).toContain("under the 5.6:1");
});

test("a header with no wash, or one whose alphas cannot be read, fails the build", () => {
  const { pages, css } = render();
  const bare = css.replace(
    "  background: linear-gradient(180deg, rgba(10, 12, 14, .72) 0%, rgba(10, 12, 14, .63) 100%);",
    "  background: transparent;",
  );
  expect(bare).not.toBe(css);
  expect(problems(pages, bare)).toContain("carries no wash of its own");
  const opaque = css.replace(
    "background: linear-gradient(180deg, rgba(10, 12, 14, .72) 0%, rgba(10, 12, 14, .63) 100%)",
    "background: linear-gradient(180deg, #0A0C0E 0%, #0A0C0E 100%)",
  );
  expect(problems(pages, opaque)).toContain("no rgba() stop this build can read");
});

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

/* ----------------------------------------------- 5-8. the chain, the panel, the two rows */

test("a wordmark that stops inheriting its colour fails the build", () => {
  const { pages, css } = render();
  const fixed = css.replace("  color: inherit;", "  color: var(--body-text);");
  expect(fixed).not.toBe(css);
  expect(problems(pages, fixed)).toContain("no longer inherits its colour");
});

test("the narrow row's links left dark on the wash, and the panel losing its surface, fail the build", () => {
  const { pages, css } = render();
  const dark = css
    .replace("  .page--index .site-header .site-nav a { color: #fff; }", "")
    .replace("  .page--index .site-header .site-nav a[aria-current=\"page\"] { color: #fff; border-bottom-color: #fff; }", "");
  expect(problems(pages, dark)).toContain("wide row's navigation keeps its own colour");
  expect(problems(pages, `${css}\n.site-nav { background: none; }\n`)).toContain("no longer has an opaque surface");
});

test("the phone header's two rows flattened fail the build", () => {
  const { pages, css } = render();
  expect(problems(pages, css.replace("flex: 1 1 50%;", "flex: 1 1 100%;"))).toContain("phone basis has changed");
  expect(problems(pages, css.replace("  height: 2.75rem;", "  height: 2rem;"))).toContain("no longer 44×44px");
  expect(problems(pages, css.replaceAll("  min-height: 2.75rem;", "  min-height: 2rem;"))).toContain("no longer at least 44px tall");
});

/* ---------------------------------------- the check the read-only audit could not make */

test("the check is wired into the build's own self-check, not merely defined", async () => {
  const source = await Bun.file(new URL("../src/demo/build.ts", import.meta.url)).text();
  expect(source).toContain('...headerOverlayProblems(pages, vars.css ?? "")');
});
