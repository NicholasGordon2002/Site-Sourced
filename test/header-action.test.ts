#!/usr/bin/env bun
/**
 * The header's action slot, and the two controls the 44px audit found short — the last
 * two pieces of the visible batch the owner approved by text on 6 Oct 2026.
 *
 *   bun test test/header-action.test.ts
 *
 * The header's second row used to be a hardcoded `call-button` Call link, and **nothing
 * pinned it**: `grep -rn call-button test/` matched no test, so it could have been
 * mislabelled, pointed anywhere or deleted without a single failure. These are the
 * refusals that replace that silence, one per clause of `headerActionProblems` (plus
 * `tapTargetProblems` for backlog `273f40d1`):
 *
 *   1. a page that should carry the action carrying none, or two;
 *   2. an action on the privacy notice or on the contact section (`contact.html` and
 *      every `contact-<service>.html`), where it would point at the page the visitor is
 *      already on and discard a per-service page's preselection;
 *   3. the wrong visible text, or an `aria-label`/`title` that disagrees with it;
 *   4. the wrong destination — including a destination that is not a page in the bundle;
 *   5. a class the shipped stylesheet cannot show is 44px tall;
 *   6. an inline handler;
 *   7. and the two controls that were 36px and 22px: `.button--small` and `.link-quiet`.
 *
 * No filesystem, no network. Every refusal has a positive control: the honest bundle
 * passes all of them, and the label is proved to be derived twice over — the neutral
 * `Contact Us` on a fictional fixture, the family's own words on a build from a real
 * record, and the booking page taking the slot when a record carries one.
 */
import { expect, test } from "bun:test";

import {
  complianceChecks,
  headerActionMeasure,
  headerActionProblems,
  tapTargetProblems,
} from "../src/demo/build.ts";
import { composeCopy, composePrivacy, profileFor } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { resolvePrimaryLabel } from "../src/demo/family.ts";
import {
  esc,
  headerActionBelongs,
  PAGE_IDS,
  PAGE_SPECS,
  primaryActionHref,
  primaryActionLabel,
  renderCss,
  renderPages,
  type RenderContext,
  type RenderedPage,
} from "../src/demo/render.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

/** A fictional fixture: the neutral label, an invented phone, invented services. */
const FICTIONAL: BusinessRecord = {
  name: "Example Barber Shop",
  category: "Barber shop",
  source_kind: "fictional",
  phone: "+1 905-555-0142",
  form_recipient: "site-sourced-311e0184@ctomail.io",
  form_delivery: "demo",
  form_provider: "formspark",
  form_access_key: "test-form-id",
  address: { street: "1 Example Street", city: "Hamilton", region: "ON" },
  services: [{ name: "Haircut" }, { name: "Hot shave" }],
};
/** The same shop as a build from a real record: the family's own label. */
const REAL: BusinessRecord = { ...FICTIONAL, source_kind: "public-listings" };
const SLUG = "example-barber-shop";

interface Rendered {
  pages: RenderedPage[];
  css: string;
  /** `copy.contactLabel.label` — the family-aware contact label (rule 8). */
  label: string;
  href: string;
  /**
   * What the header's action slot **actually** says and points at, from the same two
   * derivations the renderer used: the family-aware label, and the booking mode that hands
   * the slot to a client's own booking page (lead ruling, 8 Oct 2026). The two differ only
   * in `business` booking mode — on a demonstration the slot is deliberately unchanged.
   */
  actionLabel: string;
  actionHref: string;
}
function render(record: BusinessRecord = FICTIONAL): Rendered {
  const form = resolveForm(record);
  const delivery = resolveDelivery(record, form);
  // The configured demonstration booking page, exactly as the build boundary reads it —
  // the renderer never touches the environment, so a caller that passes nothing gets
  // booking mode `none`.
  const copy = composeCopy(record, SLUG, form, delivery, (process.env.DEMO_BOOKING_URL ?? "").trim());
  const ctx: RenderContext = {
    record,
    copy,
    profile: profileFor(record),
    form,
    delivery,
    privacy: composePrivacy(record, form, delivery),
    images: [],
    slug: SLUG,
    generatedAt: "2026-10-06T00:00:00.000Z",
  };
  return {
    pages: renderPages(ctx),
    css: renderCss(profileFor(record), SLUG),
    label: copy.contactLabel.label,
    href: primaryActionHref(record),
    actionLabel: primaryActionLabel(record, copy).label,
    actionHref: primaryActionHref(record, copy.booking),
  };
}

const edit = (pages: RenderedPage[], file: string, from: string | RegExp, to: string): RenderedPage[] =>
  pages.map((page) => (page.file === file ? { ...page, html: page.html.replace(from, to) } : page));
const editAll = (pages: RenderedPage[], from: string | RegExp, to: string): RenderedPage[] =>
  pages.map((page) => ({ ...page, html: page.html.replace(from, to) }));
const withoutStylesheet = (vars: { pages: RenderedPage[]; label: string; href: string; css?: string }) =>
  headerActionProblems({ pages: vars.pages, label: vars.label, href: vars.href }).join(" | ");
const problems = (vars: { pages: RenderedPage[]; label: string; href: string; css?: string }) =>
  headerActionProblems(vars).join(" | ");

/** The action's own tag, so a test can doctor exactly one thing about it. */
const ACTION = (label: string) => `<a class="call-button header-action" href="contact.html">${label}</a>`;

/* --------------------------------------------------------------- the honest bundle */

test("the honest bundle carries exactly one action, and it is the page's primary action", () => {
  const { pages, css, label, href } = render();
  expect(headerActionProblems({ pages, label, href, css })).toEqual([]);
  expect(tapTargetProblems(pages, css)).toEqual([]);
  // Positive controls, so a check that stops matching cannot pass by accident.
  expect(label).toBe("Contact Us"); // a fictional fixture (rule 8)
  const index = pages.find((page) => page.file === "index.html")!.html;
  expect(index).toContain(ACTION("Contact Us"));
  expect(pages.find((page) => page.file === "contact.html")!.html).not.toContain("header-action");
  expect(pages.find((page) => page.file === "privacy.html")!.html).not.toContain("header-action");
  // The per-service contact pages carry none either — five services would be five
  // destinations that discard their own preselection.
  for (const page of pages.filter((one) => one.file.startsWith("contact-"))) {
    expect(page.html).not.toContain("header-action");
  }
  // The pages that do carry it are exactly the ones the rule names.
  expect(pages.filter((page) => headerActionBelongs(page.id)).map((page) => page.file)).toEqual([
    "index.html",
    "services.html",
    "about.html",
  ]);
});

test("the label is the family's own on a build from a real record, never a template string", () => {
  const fictional = render();
  expect(fictional.label).toBe("Contact Us");
  const real = render(REAL);
  expect(real.label).toBe("Request an appointment");
  expect(headerActionProblems({ pages: real.pages, label: real.label, href: real.href, css: real.css })).toEqual([]);
  expect(real.pages[0]!.html).toContain(ACTION("Request an appointment"));
  // The check's expectation comes from the same resolver the renderer used, so a label
  // the template typed in by hand cannot agree with both.
  expect(resolvePrimaryLabel(REAL, "appointment", profileFor(REAL).key).label).toBe(real.label);
});

test("a record with its own booking page hands the slot to it, without a template edit", () => {
  const booking = { ...FICTIONAL, booking_url: "https://booking.example.com/example-barber-shop" };
  const { pages, css, label, actionLabel, actionHref } = render(booking);
  expect(primaryActionHref(booking)).toBe("https://booking.example.com/example-barber-shop");
  expect(headerActionProblems({ pages, label: actionLabel, href: actionHref, css })).toEqual([]);
  expect(pages[0]!.html).toContain(`href="https://booking.example.com/example-barber-shop"`);
  // **The label moves with the destination** (lead ruling, 8 Oct 2026): a fictional
  // fixture's slot would otherwise read the neutral `Contact Us` on an anchor that leaves
  // our site for someone else's booking page — the defect class the honesty rule exists to
  // prevent. The contact label is still `Contact Us`; the slot's words are not.
  expect(label).toBe("Contact Us");
  expect(actionLabel).toBe("Book on Example Barber Shop's own booking page");
  expect(pages[0]!.html).toContain(`>${esc(actionLabel)}</a>`);
  expect(headerActionProblems({ pages, label, href: actionHref, css }).join(" | ")).toContain("not \"Contact Us\"");
  // ...and the contact page there is not the slot's destination any more: a build that
  // still sent the header to contact.html fails.
  expect(problems({ pages, label: actionLabel, href: "contact.html", css })).toContain("primaryActionHref");
});

test("a demonstration booking link leaves the header slot exactly as signed off", () => {
  // The record names the demonstration page through the environment, and the mode is
  // resolved by comparing it with the configured URL — so with the demonstration page
  // configured this record is in `demo` mode, not `business`.
  const url = "https://calendar.app.google/example-demonstration";
  const demo = { ...FICTIONAL, booking_url: "env:DEMO_BOOKING_URL" };
  const previous = process.env.DEMO_BOOKING_URL;
  process.env.DEMO_BOOKING_URL = url;
  try {
    const { pages, css, label, href, actionLabel, actionHref } = render(demo);
    // The slot: same label, same destination, byte for byte what the owner approved.
    expect(actionLabel).toBe("Contact Us");
    expect(actionHref).toBe("contact.html");
    expect(href).toBe("contact.html");
    expect(pages[0]!.html).toContain(ACTION("Contact Us"));
    expect(headerActionProblems({ pages, label, href, css })).toEqual([]);
    // The link itself is in the body, above the form, on the contact section only.
    const contact = pages.find((page) => page.file === "contact.html")!.html;
    expect(contact).toContain(`href="${url}"`);
    expect(pages.find((page) => page.file === "index.html")!.html).not.toContain(url);
  } finally {
    if (previous === undefined) delete process.env.DEMO_BOOKING_URL;
    else process.env.DEMO_BOOKING_URL = previous;
  }
});

test("the manifest records what the slot says, where it points, and who omits it", () => {
  const booking = { ...FICTIONAL, booking_url: "https://booking.example.com/example" };
  const { pages, css, label } = render(booking);
  const record = headerActionMeasure({
    pages: render(booking).pages,
    label: render(booking).actionLabel,
    href: render(booking).actionHref,
    css: render(booking).css,
    bookingMode: "business",
  });
  // The label the manifest records is the one the page prints — the booking label, because
  // in `business` mode the slot points at the client's own booking page.
  expect(record.label).toBe("Book on Example Barber Shop's own booking page");
  expect(record.href).toBe("https://booking.example.com/example");
  expect(record.class).toBe("call-button header-action");
  expect(record.min_height_px).toBe(44);
  expect(record.carries).toEqual(["index.html", "services.html", "about.html"]);
  expect(record.omitted.map((one) => one.file)).toContain("contact.html");
  expect(record.omitted.map((one) => one.file)).toContain("contact-haircut.html");
  expect(record.omitted.find((one) => one.file === "privacy.html")!.why).toContain("none of the business's details");
  expect(record.touch_targets.map((one) => [one.class, one.min_height_px])).toEqual([
    ["button--small", 44],
    ["link-quiet", 44],
  ]);
});

/* ------------------------------------------------ 1. one action, and never two */

test("a page that loses its header action fails the build", () => {
  const { pages, css, label, href } = render();
  const stripped = edit(pages, "services.html", ACTION("Contact Us"), "");
  expect(problems({ pages: stripped, label, href, css })).toContain("services.html: the header carries no action");
});

test("a second header action fails the build", () => {
  const { pages, css, label, href } = render();
  const doubled = edit(
    pages,
    "index.html",
    ACTION("Contact Us"),
    `${ACTION("Contact Us")}\n          ${ACTION("Contact Us")}`,
  );
  expect(problems({ pages: doubled, label, href, css })).toContain("carries 2 actions, not one");
});

/* -------------------------------------- 2. the privacy notice and the contact section */

test("a header action on the privacy notice fails the build", () => {
  const { pages, css, label, href } = render();
  const injected = edit(
    pages,
    "privacy.html",
    '<a class="wordmark"',
    `${ACTION("Contact Us")}\n      <a class="wordmark"`,
  );
  expect(problems({ pages: injected, label, href, css })).toContain("privacy.html: the header carries an action");
});

test("a header action on the contact page, or on a per-service one, fails the build", () => {
  const { pages, css, label, href } = render();
  for (const file of ["contact.html", "contact-haircut.html"]) {
    const injected = edit(pages, file, '<a class="wordmark"', `${ACTION("Contact Us")}\n      <a class="wordmark"`);
    expect(problems({ pages: injected, label, href, css })).toContain(`${file}: the header carries an action`);
    // The reason the rule exists, in the refusal rather than only in a comment.
    expect(problems({ pages: injected, label, href, css })).toContain("already on");
  }
});

/* ------------------------------------------------------ 3. the label, and the name */

test("a header action carrying another label fails the build", () => {
  const { pages, css, label, href } = render();
  const relabelled = editAll(pages, ACTION("Contact Us"), ACTION("Book Now"));
  const reported = problems({ pages: relabelled, label, href, css });
  expect(reported).toContain("the header action reads \"Book Now\"");
  expect(reported).toContain('not "Contact Us"');
});

test("an aria-label or title that diverges from the visible text fails the build", () => {
  const { pages, css, label, href } = render();
  const renamed = editAll(
    pages,
    ACTION("Contact Us"),
    ACTION("Contact Us").replace('<a class="', '<a aria-label="Book an appointment" class="'),
  );
  expect(problems({ pages: renamed, label, href, css })).toContain("aria-label reads");
  // ...and one that agrees is not a defect.
  const agreeing = editAll(
    pages,
    ACTION("Contact Us"),
    ACTION("Contact Us").replace('<a class="', '<a aria-label="Contact Us" class="'),
  );
  expect(problems({ pages: agreeing, label, href, css })).toBe("");
});

/* ------------------------------------------------------------ 4. the destination */

test("a header action pointed somewhere else fails the build", () => {
  const { pages, css, label, href } = render();
  const misrouted = editAll(pages, 'header-action" href="contact.html"', 'header-action" href="about.html"');
  expect(problems({ pages: misrouted, label, href, css })).toContain("points at \"about.html\"");
});

test("a destination that is not a page in the bundle fails the build", () => {
  const { pages, css, label } = render();
  // The expectation is doctored with the page, so only the "does the bundle hold it"
  // clause can fire — which is the clause a page list edit would break.
  const broken = editAll(pages, 'header-action" href="contact.html"', 'header-action" href="contct.html"');
  expect(problems({ pages: broken, label, href: "contct.html", css })).toContain("not a page in this bundle");
  // An absolute URL is navigation, not a bundle page, and is not refused for it.
  const external = editAll(pages, 'header-action" href="contact.html"', 'header-action" href="https://example.com/book"');
  expect(problems({ pages: external, label, href: "https://example.com/book", css })).toBe("");
});

/* --------------------------------------------------------- 5. the 44px class */

test("an action whose class is not 44px tall in the shipped stylesheet fails the build", () => {
  const { pages, label, href, css } = render();
  // Appended last, so it wins the cascade exactly as a later rule does — and it cannot
  // pass by failing to match a string in the stylesheet.
  const small = `${css}\n.call-button { min-height: 2rem; }\n`;
  expect(problems({ pages, label, href, css: small })).toContain("at most 32px tall");
  // A class the stylesheet never names is refused too, not silently treated as 44px.
  const unknown = editAll(pages, 'class="call-button header-action"', 'class="header-action"');
  expect(problems({ pages: unknown, label, href, css })).toContain("given no min-height by any rule");
});

/* ------------------------------------------------------------- 6. the handler */

test("an inline handler on the header action fails the build", () => {
  const { pages, css, label, href } = render();
  const scripted = editAll(
    pages,
    ACTION("Contact Us"),
    ACTION("Contact Us").replace(">", ' onclick="location.href=\'contact.html\'">'),
  );
  expect(problems({ pages: scripted, label, href, css })).toContain("carries an inline handler (onclick=)");
});

/* --------------------------------------------- 7. the stylesheet is never assumed */

test("with no stylesheet the check still refuses the markup, and makes no height claim", () => {
  const { pages, label, href } = render();
  expect(withoutStylesheet({ pages, label, href })).toBe("");
  const stripped = edit(pages, "services.html", ACTION("Contact Us"), "");
  expect(withoutStylesheet({ pages: stripped, label, href })).toContain("carries no action");
  // The height clause cannot fire without a stylesheet — stated, not hidden.
  const small = pages.map((page) => ({ ...page, html: page.html.replace('class="call-button header-action"', 'class="header-action"') }));
  expect(withoutStylesheet({ pages: small, label, href })).toBe("");
});

/* ------------------------------------------------- 8. the check is wired in */

/** The whole self-check, as the build runs it, for one set of pages. */
function checks(pages: RenderedPage[]): string[] {
  const form = resolveForm(FICTIONAL);
  const delivery = resolveDelivery(FICTIONAL, form);
  return complianceChecks({
    pages,
    record: FICTIONAL,
    copy: composeCopy(FICTIONAL, SLUG, form, delivery),
    form,
    delivery,
    images: [],
    privacy: composePrivacy(FICTIONAL, form, delivery),
  });
}

test("the header check runs in the build's own self-check, not merely when called by name", () => {
  const { pages, label } = render();
  expect(checks(pages)).toEqual([]);
  const doctored = editAll(pages, ACTION(label), ACTION("Book Now"));
  expect(checks(doctored).join(" | ")).toContain("the header action reads");
});

test("the tap-target check runs in the build's own self-check too", () => {
  // The check reads the stylesheet the build passes it: a 36px control is refused
  // through `complianceChecks`, which is what the build throws on.
  const { pages } = render();
  const form = resolveForm(FICTIONAL);
  const delivery = resolveDelivery(FICTIONAL, form);
  const small = `${renderCss(profileFor(FICTIONAL), SLUG)}\n.button--small { min-height: 2.25rem; }\n`;
  const problems = complianceChecks({
    pages,
    record: FICTIONAL,
    copy: composeCopy(FICTIONAL, SLUG, form, delivery),
    form,
    delivery,
    images: [],
    privacy: composePrivacy(FICTIONAL, form, delivery),
    css: small,
  }).join(" | ");
  expect(problems).toContain("the control wearing \"button--small\"");
});

/* --------------------------------------------------- 9. the 44px tap targets */

test("the two controls the audit found short are 44px, and the pages that render them are named", () => {
  const { pages, css } = render();
  expect(tapTargetProblems(pages, css)).toEqual([]);
  // "Get directions" is on every page with the address block; the quiet link only on the
  // home page's About excerpt (the card rebuild left it there and nowhere else).
  const on = (name: string) => pages.filter((page) => new RegExp(`class="[^"]*\\b${name}\\b`).test(page.html)).length;
  expect(on("button--small")).toBeGreaterThan(1);
  expect(on("link-quiet")).toBe(1);
});

test("a control back under 44px fails the build, and a control no page renders is not demanded", () => {
  const { pages, css } = render();
  const directions = `${css}\n.button--small { min-height: 2.25rem; }\n`;
  expect(tapTargetProblems(pages, directions).join(" | ")).toContain('the control wearing "button--small" is at most 36px tall');
  const quiet = `${css}\n.link-quiet { min-height: initial; }\n`;
  expect(tapTargetProblems(pages, quiet).join(" | ")).toContain('the control wearing "link-quiet" is given no min-height');
  // A bundle whose pages render neither control has nothing to size.
  const bare = pages.map((page) => ({ ...page, html: page.html.replace(/class="[^"]*(button--small|link-quiet)[^"]*"/g, "") }));
  expect(tapTargetProblems(bare, css)).toEqual([]);
  // And with no stylesheet there is no size claim at all.
  expect(tapTargetProblems(pages)).toEqual([]);
});

/* ------------------------------------------------------- 10. the shape of the slot */

test("every page the rule names is one the contract builds, and the others are named too", () => {
  const carries = PAGE_IDS.filter((id) => headerActionBelongs(id));
  expect(carries).toEqual(["index", "services", "about"]);
  expect(PAGE_SPECS.privacy.printsDetails).toBe(false);
  expect(PAGE_SPECS.contact.carriesForm).toBe(true);
});
