#!/usr/bin/env bun
/**
 * The owner's 1 Oct punch list, as rules the build enforces.
 *
 *   bun test test/punch-list.test.ts
 *
 * Each case here exists because a template edit made a page rule necessary
 * (WORKFLOW.md rule 6: a rule that lives only in prose or a comment is a rule that
 * will rot). The rules:
 *
 *   1. item 54 — the privacy notice is reachable from every page's footer and from
 *      beside the form, now that the footer carries no page list;
 *   2. §P6.0 — no page repeats its own `<h1>` as a section heading.
 *
 * No filesystem, no network. Fixtures are fictional.
 */
import { expect, test } from "bun:test";

import { complianceChecks, headingStackProblems, privacyLinkProblems } from "../src/demo/build.ts";
import { composeCopy, composePrivacy, profileFor } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { renderPages, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
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

function render(record: BusinessRecord = RECORD): { pages: RenderedPage[]; ctx: RenderContext } {
  const form = resolveForm(record);
  const delivery = resolveDelivery(record, form);
  const copy = composeCopy(record, SLUG, form, delivery);
  const ctx: RenderContext = {
    record,
    copy,
    profile: profileFor(record),
    form,
    delivery,
    privacy: composePrivacy(record, form, delivery),
    images: [],
    slug: SLUG,
    generatedAt: "2026-10-05T00:00:00.000Z",
  };
  return { pages: renderPages(ctx), ctx };
}

/* ------------------------------------------------------- item 54: the privacy link */

test("the privacy notice is linked from the footer of every page, and beside the form", () => {
  const { pages } = render();
  expect(privacyLinkProblems(pages)).toEqual([]);
  for (const page of pages) {
    const footer = page.html.slice(page.html.indexOf("<footer"));
    expect(footer).toContain('href="privacy.html"');
  }
});

/** Point every link to the privacy notice somewhere else — the edit item 54 could make. */
const unlinkPrivacy = (html: string): string => html.replaceAll('href="privacy.html"', 'href="about.html"');

test("a footer that loses the privacy link fails the build", () => {
  const { pages } = render();
  // What removing the footer navigation without replacing the link would have done:
  // the link is still reachable in the page body (the form's own link), but not from
  // the footer.
  // The body's link (the form's own) survives; the footer's is gone.
  const broken = pages.map((page) => ({
    ...page,
    html: page.html.replace(/<footer[\s\S]*$/, (footer) => unlinkPrivacy(footer)),
  }));
  const problems = privacyLinkProblems(broken);
  expect(problems.length).toBeGreaterThan(0);
  expect(problems.join(" ")).toContain("the footer carries no link to privacy.html");
});

test("a form page that loses the link beside the form fails the build", () => {
  const { pages } = render();
  // The footer link survives; only the link beside the form goes.
  const withFormLinkRemoved = pages.map((page) =>
    page.file === "contact.html"
      ? { ...page, html: page.html.replace(/<p class="form-privacy">[\s\S]*?<\/p>/, "").replaceAll('href="privacy.html"', 'href="about.html"') }
      : page,
  );
  const problems = privacyLinkProblems(withFormLinkRemoved);
  expect(problems.join(" ")).toContain("carries the form but the privacy notice is not linked next to it");
});

/* --------------------------------------------------- §P6.0: the heading stack */

test("no page repeats its own title as a section heading", () => {
  const { pages } = render();
  expect(headingStackProblems(pages)).toEqual([]);
});

test("the contact page's form section no longer repeats the page title", () => {
  const { pages } = render();
  const contact = pages.find((p) => p.file === "contact.html")!;
  const main = contact.html.slice(contact.html.indexOf("<main"), contact.html.indexOf("</main>"));
  expect(main).toContain("<h1>Contact</h1>");
  expect(main).not.toContain("<h2>Contact</h2>");
});

test("a heading stack that repeats the h1 fails the build", () => {
  const { pages } = render();
  const broken = pages.map((page) =>
    page.file === "contact.html" ? { ...page, html: page.html.replace("<h1>Contact</h1>", "<h1>Contact</h1>\n<h2>Contact</h2>") } : page,
  );
  const problems = headingStackProblems(broken);
  expect(problems.join(" ")).toContain("repeats the page's own heading");
});

test("the whole page set still passes the build's own self-check", () => {
  const { pages, ctx } = render();
  expect(
    complianceChecks({
      pages,
      record: RECORD,
      copy: ctx.copy,
      form: ctx.form,
      delivery: ctx.delivery,
      images: [],
      privacy: ctx.privacy,
    }),
  ).toEqual([]);
});
