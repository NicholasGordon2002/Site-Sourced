#!/usr/bin/env bun
/**
 * The phase gate: the unsolicited-proposal furniture is **required in the demonstration
 * phase and refused in the business phase** (WORKFLOW.md rule 9, cross-check finding 8).
 *
 *   bun test test/phase-gate.test.ts
 *
 * Both directions are the same rule, so both are pinned here, per page and in the README
 * that ships beside them:
 *
 *   demo      the banner (first content element in `<body>`, above the header), the same
 *             disclaimer in the footer beside the business's name, the takedown line and
 *             `<meta name="robots" content="noindex, nofollow">`; the README carries the
 *             demonstration paragraph. A page that lost one of them is refused.
 *   business  none of it appears anywhere — on a client's own site our banner, disclaimer,
 *             takedown line and `noindex` marker are a claim about somebody else's website.
 *
 * The refusals are **furniture detection** rather than "is this string missing": in the
 * business phase the banner and the disclaimer are empty strings, so a search for them
 * would prove nothing. Each test below doctor's one piece of furniture and asserts the
 * exact sentence the check emits.
 *
 * Nothing is sent anywhere and no file is written.
 */
import { expect, test } from "bun:test";

import { phaseFurnitureProblems } from "../src/demo/build.ts";
import { composeCopy, composePrivacy, profileFor } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { esc, renderEditingReadme, renderPages, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

const OUR_INBOX = "site-sourced-311e0184@ctomail.io";
const SLUG = "example-business";

const BASE: BusinessRecord = {
  name: "Example Barber Shop",
  category: "Barber shop",
  email: "shop@example-barber.ca",
  form_recipient: OUR_INBOX,
  form_delivery: "demo",
  form_provider: "formspark",
  form_access_key: "test-form-id",
  phone: "+1 905-555-0142",
  source_kind: "public-listings",
};

/** A demonstration record: the form delivers to us, so the pages are our proposal. */
const demonstration = (over: Partial<BusinessRecord> = {}): BusinessRecord => ({ ...BASE, ...over });

/** A delivered client's own site: the form recipient is the business's own address. */
const delivered = (over: Partial<BusinessRecord> = {}): BusinessRecord => ({
  ...BASE,
  // The client's own number, recorded at hand-off; a client build with none is refused elsewhere.
  phone: "+1 905-555-0188",
  form_recipient: BASE.email!,
  form_delivery: "business",
  ...over,
});

interface Bundle {
  record: BusinessRecord;
  ctx: RenderContext;
  pages: RenderedPage[];
  readme: string;
}

/** Render the bundle exactly as the build does, README included. */
function bundle(rec: BusinessRecord): Bundle {
  const form = resolveForm(rec);
  const delivery = resolveDelivery(rec, form);
  const copy = composeCopy(rec, SLUG, form, delivery);
  const privacy = composePrivacy(rec, form, delivery);
  const ctx: RenderContext = {
    record: rec,
    copy,
    profile: profileFor(rec),
    form,
    delivery,
    privacy,
    images: [],
    slug: SLUG,
    generatedAt: "2026-10-07T00:00:00.000Z",
  };
  return { record: rec, ctx, pages: renderPages(ctx), readme: renderEditingReadme(ctx) };
}

const fence = (b: Bundle, page: RenderedPage[] = b.pages): string =>
  phaseFurnitureProblems({ pages: page, record: b.record, copy: b.ctx.copy, delivery: b.ctx.delivery, readme: b.readme }).join(" | ");

/** One page's html, with a piece replaced — what a visitor would receive. */
const doctored = (b: Bundle, file: string, from: string | RegExp, to: string): RenderedPage[] =>
  b.pages.map((p) => (p.file === file ? { ...p, html: p.html.replace(from, to) } : p));

/* --------------------------------------------------- the demonstration phase */

test("a demonstration page carries the whole furniture set, and the README says what it is", () => {
  const b = bundle(demonstration());
  expect(fence(b)).toBe("");

  for (const page of b.pages) {
    // The banner is the first content element in <body>: the skip link may precede it.
    // The same thing the check reads: comments are not content, and the skip link is a
    // keyboard affordance rather than content, so it may precede the banner.
    const inBody = page.html
      .slice(page.html.indexOf("<body>") + 6)
      .replace(/<!--[\s\S]*?-->/g, " ")
      .trim();
    const afterSkip = inBody.startsWith('<a class="skip-link"') ? inBody.slice(inBody.indexOf("</a>") + 4).trim() : inBody;
    expect(`${page.file}: ${afterSkip.startsWith('<div class="proposal-banner"')}`).toBe(`${page.file}: true`);
    expect(page.html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(page.html).toContain(esc(b.ctx.copy.banner));
    expect(page.html).toContain(esc(b.ctx.copy.footerDisclaimer));
    expect(page.html).toContain(esc(b.ctx.copy.footer.takedown));
    // Beside the business's name, not merely somewhere in the page.
    const footer = page.html.slice(page.html.indexOf("<footer"), page.html.indexOf("</footer>"));
    expect(footer.indexOf(esc(b.ctx.copy.footerDisclaimer))).toBeGreaterThan(footer.indexOf('class="footer-biz"'));
  }
  expect(b.readme).toContain("DEMONSTRATION — not the business's website");
});

test("a demonstration page that lost the banner is refused, twice over", () => {
  const b = bundle(demonstration());
  const banner = /<div class="proposal-banner"[\s\S]*?<\/div>\n/;
  const problems = fence(b, doctored(b, "index.html", banner, ""));
  expect(problems).toContain("on index.html: the proposal banner text is not present");
  expect(problems).toContain("on index.html: the proposal banner is not the first content element in <body>");
});

test("a demonstration page that lost the footer disclaimer is refused", () => {
  const b = bundle(demonstration());
  const disclaimer = / *<!-- Compliance: the same disclaimer[\s\S]*?<p class="disclaimer">[\s\S]*?<\/p>\n/;
  const problems = fence(b, doctored(b, "index.html", disclaimer, ""));
  expect(problems).toContain("on index.html: the footer disclaimer is not present next to the business's name");
});

test("a disclaimer in the footer but above the business's name is refused", () => {
  const b = bundle(demonstration());
  const html = b.pages.find((p) => p.file === "index.html")!.html;
  const disclaimer = `<p class="disclaimer">${esc(b.ctx.copy.footerDisclaimer)}</p>`;
  const name = html.indexOf('class="footer-biz"');
  // The same sentence, moved above the name it qualifies.
  const moved = { ...b.pages.find((p) => p.file === "index.html")!, html: html.replace(disclaimer, "") };
  const withItAbove = { ...moved, html: moved.html.slice(0, name) + disclaimer + moved.html.slice(name) };
  expect(fence(b, b.pages.map((p) => (p.file === "index.html" ? withItAbove : p)))).toContain(
    "the footer disclaimer sits inside <footer> but above the business's name",
  );
});

test("a disclaimer outside the footer is refused, even though the page carries the words", () => {
  const b = bundle(demonstration());
  const html = b.pages.find((p) => p.file === "index.html")!.html;
  const disclaimer = `<p class="disclaimer">${esc(b.ctx.copy.footerDisclaimer)}</p>`;
  const loose = { ...b.pages.find((p) => p.file === "index.html")!, html: html.replace(disclaimer, "").replace("</body>", `${disclaimer}</body>`) };
  expect(fence(b, b.pages.map((p) => (p.file === "index.html" ? loose : p)))).toContain(
    "the footer disclaimer is outside <footer>",
  );
});

test("a demonstration page without the noindex marker is refused", () => {
  const b = bundle(demonstration());
  const meta = / *<!-- Compliance: this page must never appear[\s\S]*?<meta name="robots" content="noindex, nofollow">\n/;
  expect(fence(b, doctored(b, "index.html", meta, ""))).toContain(
    'on index.html: missing or malformed <meta name="robots" content="noindex, nofollow">',
  );
});

test("a demonstration page without the takedown line is refused", () => {
  const b = bundle(demonstration());
  const takedown = `<p class="footer-small">\n          ${esc(b.ctx.copy.footer.takedown)}\n        </p>`;
  const problems = fence(b, doctored(b, "index.html", takedown, ""));
  expect(problems).toContain("on index.html: the takedown line is not present");
});

test("a demonstration README that lost its demonstration paragraph is refused", () => {
  const b = bundle(demonstration());
  const problems = phaseFurnitureProblems({
    pages: b.pages,
    record: b.record,
    copy: b.ctx.copy,
    delivery: b.ctx.delivery,
    readme: b.readme.replace("DEMONSTRATION — not the business's website", "Files"),
  }).join(" | ");
  expect(problems).toContain("the delivered README does not say the bundle is a demonstration");
});

/* ------------------------------------------------------ the business phase */

test("a delivered site carries none of the furniture", () => {
  const b = bundle(delivered());
  expect(fence(b)).toBe("");
  for (const page of b.pages) {
    expect(page.html).not.toContain("proposal-banner");
    expect(page.html).not.toContain("unsolicited");
    expect(page.html).not.toContain('name="robots"');
    expect(page.html).not.toContain("noindex");
    expect(page.html).not.toContain("taken down");
  }
  expect(b.readme).not.toContain("DEMONSTRATION");
});

const FURNITURE: [string, string][] = [
  // [what the test injects, the sentence the check must emit]
  [
    '<div class="proposal-banner" role="note"><p>This is an unsolicited design proposal from Site Sourced.</p></div>',
    "on index.html: carries the proposal banner element",
  ],
  ["<p>It is not affiliated with, endorsed by, or operated by anyone.</p>", "on index.html: carries the footer disclaimer"],
  ['<meta name="robots" content="noindex, nofollow">', "on index.html: carries a noindex marker"],
  ["<p>This page is marked noindex.</p>", "on index.html: carries the sentence about being marked noindex"],
  ["<p>Ask and we will take it down.</p>", "on index.html: carries the takedown promise"],
];

test("each piece of furniture is refused on a delivered page", () => {
  for (const [injected, expected] of FURNITURE) {
    const b = bundle(delivered());
    const problems = fence(b, doctored(b, "index.html", "</body>", `${injected}</body>`));
    expect(`${injected.slice(0, 24)}: ${problems}`).toContain(expected);
  }
});

test("an unsolicited-proposal sentence alone is refused, in whatever words it is written", () => {
  const b = bundle(delivered());
  const problems = fence(b, doctored(b, "index.html", "</body>", "<p>We built this unsolicited proposal for you.</p></body>"));
  expect(problems).toContain("on index.html: carries an unsolicited-proposal sentence");
});

test("a delivered README carrying the demonstration paragraph is refused", () => {
  const b = bundle(delivered());
  const problems = phaseFurnitureProblems({
    pages: b.pages,
    record: b.record,
    copy: b.ctx.copy,
    delivery: b.ctx.delivery,
    readme: `${b.readme}\nThis page is an unsolicited design proposal and it is marked noindex.\n`,
  }).join(" | ");
  expect(problems).toContain("the delivered README carries an unsolicited-proposal sentence");
  expect(problems).toContain("the delivered README carries the sentence about being marked noindex");
});
