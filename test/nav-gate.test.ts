#!/usr/bin/env bun
/**
 * The page contract and the navigation's own state — the half of checklist #15 that was
 * true by construction and checked by nothing (`template-system.md` #15; WORKFLOW.md
 * rule 6: "a rule that lives only in prose or a comment is a rule that will rot").
 *
 *   bun test test/nav-gate.test.ts
 *
 * Four refusals, each one a way a bundle could quietly stop being the five-page contract:
 *
 *   1. a named page missing from the bundle;
 *   2. a page that is neither a named page nor a per-service contact page — a sixth kind
 *      of page (the bundle is **nine** pages on the current fixtures, not five: the five
 *      named pages plus one `contact-<service>.html` per recorded service);
 *   3. `aria-current="page"` deleted, duplicated, moved outside the nav, or left on the
 *      wrong section's link (a per-service contact page is the Contact page);
 *   4. a nav link pointing at a file the bundle does not contain.
 *
 * No filesystem, no network. The fixture is fictional and the services are invented.
 * Every refusal has a positive control: the honest bundle passes all of them.
 */
import { expect, test } from "bun:test";

import { navProblems } from "../src/demo/build.ts";
import { composeCopy, composePrivacy, profileFor } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { PAGE_IDS, PAGE_SPECS, renderPages, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
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
  services: [{ name: "Haircut" }, { name: "Hot shave" }],
};
const SLUG = "example-barber-shop";
const NAMED = PAGE_IDS.map((id) => PAGE_SPECS[id].file);

function render(): RenderedPage[] {
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
  return renderPages(ctx);
}

/** One page, with a string swapped — the smallest simulation of a typo. */
const edit = (pages: RenderedPage[], file: string, from: string | RegExp, to: string): RenderedPage[] =>
  pages.map((page) => (page.file === file ? { ...page, html: page.html.replace(from, to) } : page));

/** Every page, with a string swapped. */
const editAll = (pages: RenderedPage[], from: string | RegExp, to: string): RenderedPage[] =>
  pages.map((page) => ({ ...page, html: page.html.replace(from, to) }));

const problems = (pages: RenderedPage[]) => navProblems(pages).join(" | ");

/* --------------------------------------------------------------- the honest bundle */

test("the five named pages ship, plus one contact page per recorded service and nothing else", () => {
  const pages = render();
  expect(navProblems(pages)).toEqual([]);
  const files = pages.map((p) => p.file);
  for (const named of NAMED) expect(files).toContain(named);
  // Nine pages, not five: the two recorded services get their own contact page each.
  expect(files).toEqual([...NAMED, "contact-haircut.html", "contact-hot-shave.html"]);
});

test("every page carries exactly one aria-current, on the nav entry for its own section", () => {
  for (const page of render()) {
    const marks = [...page.html.matchAll(/aria-current="page"/g)];
    expect(marks.length).toBe(1);
    const nav = page.html.slice(page.html.indexOf('<nav class="site-nav"'), page.html.indexOf("</nav>"));
    const markedLink = [...nav.matchAll(/<a\b[^>]*aria-current="page"[^>]*>/g)];
    expect(markedLink.length).toBe(1);
    // A per-service contact page is the Contact page: its mark sits on contact.html.
    const own = page.file === "index.html" || page.file === "services.html" || page.file === "about.html" || page.file === "privacy.html"
      ? page.file
      : "contact.html";
    expect(markedLink[0]![0]).toContain(`href="${own}"`);
  }
});

/* ---------------------------------------------------- 1. a named page stops shipping */

test("a named page missing from the bundle fails the build", () => {
  const pages = render().filter((page) => page.file !== "privacy.html");
  expect(problems(pages)).toContain("the bundle contains no privacy.html");
  // And every one of the five is guarded, not just the one with the loudest link.
  for (const missing of NAMED) {
    expect(problems(render().filter((page) => page.file !== missing))).toContain(`the bundle contains no ${missing}`);
  }
});

/* ------------------------------------------------- 2. a sixth kind of page in the bundle */

test("a page that is neither a named page nor a per-service contact page fails the build", () => {
  const pages = render();
  const extra: RenderedPage = { id: "contact", file: "team.html", html: pages[0]!.html };
  expect(problems([...pages, extra])).toContain("team.html: a page that is neither one of the five named pages");
});

/* ----------------------------------------------------------------- 3. aria-current */

test("deleting aria-current fails the build — the marker is the only thing it is checked for", () => {
  const pages = editAll(render(), ' aria-current="page"', "");
  expect(problems(pages)).toContain('no element carries aria-current="page"');
});

test("a second aria-current fails the build", () => {
  const pages = edit(render(), "index.html", "</nav>", '<li><a href="about.html" aria-current="page">About</a></li>\n      </nav>');
  expect(problems(pages)).toContain("2 elements carry aria-current=");
});

test("an aria-current outside the navigation fails the build", () => {
  // One marker in the whole page, and it is not a nav link: the count is right and the
  // markup is wrong, which the count alone cannot catch.
  const moved = editAll(render(), ' aria-current="page"', "");
  const pages = edit(moved, "index.html", "</footer>", '<p aria-current="page">Home</p>\n  </footer>');
  const reported = problems(pages);
  expect(reported).toContain('the aria-current="page" marker is outside the navigation');
  // index.html counts one marker, so the count sentence must not be what fires for it.
  const forHome = navProblems(pages).filter((p) => p.startsWith("index.html:")).join(" ");
  expect(forHome).not.toContain("no element carries");
  expect(forHome).not.toContain("elements carry aria-current");
});

test("the mark on the wrong section's link fails the build, including on a per-service page", () => {
  const wrongSection = edit(render(), "services.html", 'href="services.html" aria-current="page"', 'href="about.html" aria-current="page"');
  expect(problems(wrongSection)).toContain("points at about.html, not services.html");

  // A service page is the Contact page: pointing its mark at the home page is wrong even
  // though both are pages in the bundle.
  const wrongVariant = edit(render(), "contact-hot-shave.html", 'href="contact.html" aria-current="page"', 'href="index.html" aria-current="page"');
  expect(problems(wrongVariant)).toContain("points at index.html, not contact.html");
  // ...and the honest per-service page is fine (positive control).
  expect(navProblems(render())).toEqual([]);
});

/* -------------------------------------------------------------- 4. nav link targets */

test("a nav link to a page the bundle does not contain fails the build", () => {
  const pages = edit(render(), "index.html", '<a href="about.html">', '<a href="team.html">');
  expect(problems(pages)).toContain("the navigation links to team.html, which this bundle does not contain");
});

test("a nav link to a file that is not a page at all fails the build too", () => {
  const pages = edit(render(), "about.html", '<a href="services.html">', '<a href="styles.css">');
  expect(problems(pages)).toContain("the navigation links to styles.css");
});

/* ---------------------------------------- the check the read-only audit could not make */

test("the check is wired into the build's own self-check, not merely defined", async () => {
  const source = await Bun.file(new URL("../src/demo/build.ts", import.meta.url)).text();
  expect(source).toContain("...navProblems(pages)");
});
