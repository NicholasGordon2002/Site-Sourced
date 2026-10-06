#!/usr/bin/env bun
/**
 * The phone menu, as rules the build enforces (WORKFLOW.md rule 11; the owner's
 * revision of 6 Oct 2026, which the session that wired the menu handed on without).
 *
 *   bun test test/phone-menu.test.ts
 *
 * Three refusals, each one a way the menu could quietly stop being the one the owner
 * asked for:
 *
 *   1. a fifth link (or a missing or reordered one) in the phone panel;
 *   2. a control with no accessible name — an icon-only hamburger;
 *   3. the privacy link un-hidden in the phone menu, in the markup or in the stylesheet.
 *
 * No filesystem, no network. The fixture is fictional.
 */
import { expect, test } from "bun:test";

import { phoneMenuProblems } from "../src/demo/build.ts";
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

const edit = (pages: RenderedPage[], from: string | RegExp, to: string): RenderedPage[] =>
  pages.map((page) => ({ ...page, html: page.html.replace(from, to) }));

test("the phone menu is the four named page links behind a named control, privacy phone-hidden", () => {
  const { pages, css } = render();
  expect(phoneMenuProblems(pages, css)).toEqual([]);
  for (const page of pages) {
    const nav = page.html.slice(page.html.indexOf('<nav class="site-nav"'), page.html.indexOf("</nav>"));
    const phoneRows = [...nav.matchAll(/<li([^>]*)>\s*<a\s[^>]*href="([^"]*)"/g)].filter((m) => !/nav-item--desktop/.test(m[1] ?? ""));
    expect(phoneRows.map((m) => m[2])).toEqual(["index.html", "services.html", "about.html", "contact.html"]);
  }
});

test("a fifth link in the phone menu fails the build", () => {
  const { pages, css } = render();
  const five = edit(pages, "</ul>\n      </nav>", '<li><a href="privacy.html">Privacy</a></li>\n        </ul>\n      </nav>');
  const problems = phoneMenuProblems(five, css).join(" ");
  expect(problems).toContain("not the four links the owner named");
});

test("an icon-only control with no accessible name fails the build", () => {
  const { pages, css } = render();
  const unnamed = edit(pages, '<summary class="site-menu-summary" aria-label="Pages"><span class="visually-hidden">Pages</span>', '<summary class="site-menu-summary"><span class="visually-hidden"></span>');
  expect(phoneMenuProblems(unnamed, css).join(" ")).toContain("no accessible name");
});

test("un-hiding the privacy link in the phone menu fails the build, in markup or in the stylesheet", () => {
  const { pages, css } = render();
  const unHidden = edit(pages, '<li class="nav-item--desktop"><a href="privacy.html"', '<li><a href="privacy.html"');
  const problems = phoneMenuProblems(unHidden, css).join(" ");
  expect(problems).toContain("no longer marked phone-hidden");
  expect(problems).toContain("not the four links the owner named");
  // The stylesheet half: the class means nothing if the phone rule goes.
  expect(phoneMenuProblems(pages, css.replace(".site-nav li.nav-item--desktop { display: none; }", "")).join(" ")).toContain("no longer hides");
  expect(phoneMenuProblems(pages, css.replace(".site-nav li.nav-item--desktop { display: block; }", "")).join(" ")).toContain("hides the privacy link at every width");
});
