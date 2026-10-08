#!/usr/bin/env bun
/**
 * The booking link, and the three modes it exists in — the per-clause file the E1 session
 * owed (`design/booking-build-notes.md` §7.2).
 *
 *   bun test test/booking.test.ts
 *
 * `bookingProblems` is the only thing standing between a remark in a record and a page that
 * books into someone else's calendar, so **every clause is asserted twice over**: the honest
 * bundle passes all of them, and a doctored bundle makes each one fire by name. A refusal
 * nobody can trigger is prose, not a check (WORKFLOW.md, "Proving a build check can fire").
 *
 * Nothing here touches the filesystem or the network. The demonstration page is a literal
 * `https://example.invalid/…` URL in this file, never in a record: the fixtures name
 * `env:DEMO_BOOKING_URL` precisely so no demonstration URL is ever committed.
 */
import { expect, test } from "bun:test";

import { BOOKING_ANCHOR_CLASS, BOOKING_ANCHOR_SIZE_CLASS } from "../src/demo/booking.ts";
import {
  bookingAnchorSizeProblems,
  bookingProblems,
  complianceChecks,
  type RenderedPage,
} from "../src/demo/build.ts";
import {
  BOOKING_LABEL_DEMO,
  bookingNoticeDemo,
  composeCopy,
  composePrivacy,
  profileFor,
  type BookingCopy,
  type DemoCopy,
} from "../src/demo/copy.ts";
import { resolveDelivery, type FormDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { renderCss, renderPages, type RenderContext } from "../src/demo/render.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

const DEMO_URL = "https://example.invalid/demo-booking";
const SLUG = "example-barber-shop";

/** A fictional Family A fixture, the shape the published barber fixture has — including
 *  the `env:` indirection, so the tests read the environment the way the build does. */
const BARBER: BusinessRecord = {
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
  booking_url: "env:DEMO_BOOKING_URL",
};

/** A Family B fixture: an inquiry page asks for a described need and never for a time. */
const GARDENER: BusinessRecord = {
  ...BARBER,
  name: "Example Garden Works",
  category: "Landscaping",
  services: [{ name: "Spring cleanup" }],
};

/** A delivered build: the form reaches the business's own recorded address. */
const CLIENT: BusinessRecord = {
  ...BARBER,
  source_kind: "public-listings",
  email: "hello@example-barber-shop.ca",
  form_recipient: "hello@example-barber-shop.ca",
  form_delivery: "business",
  booking_url: "https://calendar.example.com/example-barber-shop",
};

interface Rendered {
  record: BusinessRecord;
  pages: RenderedPage[];
  css: string;
  copy: DemoCopy;
  delivery: FormDelivery;
}

/** The build's own boundary: the demonstration page comes from the environment. */
function withDemoUrl<T>(demoUrl: string, run: () => T): T {
  const previous = process.env.DEMO_BOOKING_URL;
  process.env.DEMO_BOOKING_URL = demoUrl;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.DEMO_BOOKING_URL;
    else process.env.DEMO_BOOKING_URL = previous;
  }
}

function render(record: BusinessRecord = BARBER, demoUrl = DEMO_URL): Rendered {
  return withDemoUrl(demoUrl, () => {
    const form = resolveForm(record);
    const delivery = resolveDelivery(record, form);
    const copy = composeCopy(record, SLUG, form, delivery, demoUrl);
    const ctx: RenderContext = {
      record,
      copy,
      profile: profileFor(record),
      form,
      delivery,
      privacy: composePrivacy(record, form, delivery, undefined, copy.booking),
      images: [],
      slug: SLUG,
      generatedAt: "2026-10-08T00:00:00.000Z",
    };
    return { record, pages: renderPages(ctx), css: renderCss(profileFor(record), SLUG), copy, delivery };
  });
}

/** The check's own report for one bundle, as the build reads it. */
function report(
  set: Rendered,
  extra: { pages?: RenderedPage[]; booking?: BookingCopy; phase?: "demo" | "business"; demoUrl?: string } = {},
): string {
  return bookingProblems({
    pages: extra.pages ?? set.pages,
    record: set.record,
    booking: extra.booking ?? set.copy.booking,
    phase: extra.phase ?? set.delivery.mode,
    contactLabel: set.copy.contactLabel.label,
    demoUrl: extra.demoUrl ?? DEMO_URL,
  }).join(" | ");
}

const edit = (pages: RenderedPage[], file: string, from: string | RegExp, to: string): RenderedPage[] =>
  pages.map((page) => (page.file === file ? { ...page, html: page.html.replace(from, to) } : page));
const editAll = (pages: RenderedPage[], from: string | RegExp, to: string): RenderedPage[] =>
  pages.map((page) => ({ ...page, html: page.html.replace(from, to) }));
const without = (set: Rendered, file: string, from: string | RegExp): RenderedPage[] =>
  edit(set.pages, file, from, "");
const pageOf = (set: Rendered, file: string): string => set.pages.find((page) => page.file === file)!.html;

/** The anchor as the page prints it — one place, so a test can doctor exactly one thing. */
const ANCHOR = (): string =>
  `<a class="${BOOKING_ANCHOR_CLASS}" href="${DEMO_URL}" target="_blank" rel="noopener noreferrer">${BOOKING_LABEL_DEMO}&nbsp;↗</a>`;
const NOTICE_P = (text = bookingNoticeDemo(BARBER.name)): string => `<p class="form-note">${text}</p>`;
/** The contact pages: the ones where a visitor is already asking for a time. */
const CONTACT_PAGES = ["contact.html", "contact-haircut.html", "contact-hot-shave.html"];

/* ---------------------------------------------------------------- the honest bundle */

test("the honest demonstration bundle passes every clause", () => {
  const set = render();
  expect(report(set)).toBe("");
  // Positive controls: a check that stops matching cannot pass by accident.
  expect(set.copy.booking.mode).toBe("demo");
  expect(set.copy.booking.href).toBe(DEMO_URL);
  expect(set.copy.booking.label).toBe(BOOKING_LABEL_DEMO);
  expect(set.copy.booking.external).toBe(true);
  expect(pageOf(set, "contact.html")).toContain(ANCHOR());
  expect(pageOf(set, "contact.html")).toContain(NOTICE_P());
});

test("the link and its notice are on the contact pages only, and each page checks clean alone", () => {
  const set = render();
  expect(set.pages.filter((page) => page.html.includes(ANCHOR())).map((page) => page.file)).toEqual(CONTACT_PAGES);
  // No page is refused on its own either — a per-page rule that needed a neighbour would
  // be a rule about the bundle, not about the page.
  for (const page of set.pages) {
    expect(report(set, { pages: [page] })).toBe("");
  }
  // The demonstration URL is nowhere but those pages — the header's slot included.
  for (const file of ["index.html", "services.html", "about.html", "privacy.html"]) {
    expect(pageOf(set, file)).not.toContain(DEMO_URL);
  }
});

test("the notice is small print beside the link, and the page still has exactly one boxed notice", () => {
  const contact = pageOf(render(), "contact.html");
  // C2: the demonstration notice is `.form-note`…
  expect(contact).toContain(NOTICE_P());
  // …no page carries the boxed `.notice` class any more, and the delivery notice above the
  // form (`.form-notice`) is the contact page's single boxed compliance notice.
  expect(contact).not.toContain('class="notice"');
  expect(contact.split('class="form-notice"').length - 1).toBe(1);
  // Immediately after the anchor's paragraph, before the form opens.
  expect(contact.indexOf(ANCHOR())).toBeLessThan(contact.indexOf(NOTICE_P()));
  expect(contact.indexOf(NOTICE_P())).toBeLessThan(contact.indexOf('<form class="contact-form"'));
  expect(contact.slice(contact.indexOf(ANCHOR()), contact.indexOf(NOTICE_P()))).toContain("</p>");
});

test("the anchor's class is the quiet one on paper, and it is a class the 44px audit measures", () => {
  const set = render();
  expect(BOOKING_ANCHOR_CLASS.split(" ")).toContain(BOOKING_ANCHOR_SIZE_CLASS);
  expect(BOOKING_ANCHOR_SIZE_CLASS).toBe("link-quiet");
  expect(pageOf(set, "contact.html")).toContain(`class="${BOOKING_ANCHOR_SIZE_CLASS} link-quiet--inline"`);
  // The class the audit reads out of the shipped stylesheet is 44px tall there, and the
  // `--inline` modifier is the existing rule that keeps the control left-aligned with the
  // form's 34rem measure instead of indented from it.
  expect(set.css).toContain("min-height: 2.75rem");
  expect(set.css).toContain(".link-quiet--inline { margin-left: 0; }");
  expect(report(set)).toBe("");
});

/* -------------------------------------------------------- 1. the phase / mode matrix */

test("a demonstration build pointing at a business's own booking page fails", () => {
  const set = render();
  const business = { ...set.copy.booking, mode: "business" as const, notice: "", href: "https://calendar.example.com/x" };
  expect(report(set, { booking: business, phase: "demo" })).toContain(
    "in the demonstration phase but its booking link points at a business's own booking page",
  );
});

test("a client's own site pointing at our demonstration page fails", () => {
  // A delivered build (the form reaches the business) whose record carries the page we
  // configured as the demonstration one: the cell gbp §5.3 rule 2 refuses.
  const set = render(CLIENT, "https://calendar.example.com/example-barber-shop");
  expect(set.delivery.mode).toBe("business");
  expect(set.copy.booking.mode).toBe("demo");
  expect(report(set)).toContain("a client's own site but its booking link points at our demonstration page");
});

test("the honest client build passes: a business link on a delivered site", () => {
  const set = render(CLIENT, "https://example.invalid/not-the-demo-page");
  expect(set.delivery.mode).toBe("business");
  expect(set.copy.booking.mode).toBe("business");
  expect(set.copy.booking.notice).toBe("");
  expect(report(set)).toBe("");
  // C3: one loud action per page — the header slot is the client's booking link, so the CTA
  // band's request control steps down and is not a second ink pill with another destination.
  expect(pageOf(set, "index.html")).toContain(
    `<p class="cta-actions"><a class="link-quiet link-quiet--inline" href="contact.html">`,
  );
  expect(pageOf(set, "index.html")).toContain(
    `<a class="call-button header-action" href="https://calendar.example.com/example-barber-shop">`,
  );
});

test("in none and demo mode the CTA band keeps its button", () => {
  expect(pageOf(render(), "index.html")).toContain(`<p class="cta-actions"><a class="button" href="contact.html">`);
  const none = render({ ...BARBER, booking_url: "" });
  expect(none.copy.booking.mode).toBe("none");
  expect(pageOf(none, "index.html")).toContain(`<p class="cta-actions"><a class="button" href="contact.html">`);
});

/* ---------------------------------------------------------------- 2. https only */

test("a booking link that is not https fails", () => {
  const set = render();
  for (const href of ["http://example.invalid/book", "booking.html", ""]) {
    expect(report(set, { booking: { ...set.copy.booking, href }, pages: [] })).toContain("which is not an https URL");
  }
});

test("demonstration mode whose link is not the configured page fails", () => {
  expect(report(render(), { demoUrl: "https://example.invalid/other-page" })).toContain(
    "not at the configured demonstration page (https://example.invalid/other-page)",
  );
});

/* ------------------------------------------- 2b. the class the audit measures (C1) */

test("a booking control whose class no audit measures fails — the ghost class cannot come back", () => {
  // The class the first draft shipped: the hero's white-on-photograph treatment, invisible
  // on the contact pages' paper surface, and not one of TAP_TARGET_CLASSES.
  expect(bookingAnchorSizeProblems("button button--ghost").join(" | ")).toContain(
    'the booking control wears "button button--ghost", and none of those classes is measured by the 44px audit',
  );
  expect(bookingAnchorSizeProblems("button--ghost").join(" | ")).toContain("none of those classes is measured");
  // The class this build ships passes the clause, and so does any superset of an audited one.
  expect(bookingAnchorSizeProblems(BOOKING_ANCHOR_CLASS)).toEqual([]);
  expect(bookingAnchorSizeProblems("link-quiet")).toEqual([]);
  expect(bookingAnchorSizeProblems("button--small")).toEqual([]);
  // And on a real page: swapping the rendered class back to the ghost loses the control the
  // page must carry, so a regression fails the build either way.
  const set = render();
  const ghost = editAll(set.pages, ANCHOR(), ANCHOR().replace(`class="${BOOKING_ANCHOR_CLASS}"`, 'class="button button--ghost"'));
  expect(report(set, { pages: ghost })).toContain("carries 0 booking links, not one");
});

/* ------------------------------------------------- 3. none mode renders nothing at all */

test("a none-mode bundle that composes a label or a notice fails", () => {
  const set = render({ ...BARBER, booking_url: "" });
  const leaked = { ...set.copy.booking, label: BOOKING_LABEL_DEMO };
  expect(report(set, { booking: leaked })).toContain("booking mode is none but the build composed a label or a notice");
});

test("an anchor, or even the arrow, on a none-mode page fails", () => {
  const set = render({ ...BARBER, booking_url: "" });
  const injected = edit(set.pages, "contact.html", '<form class="contact-form"', `${ANCHOR()}\n        <form class="contact-form"`);
  expect(report(set, { pages: injected })).toContain("carries a booking link although booking mode is none");
  const arrow = edit(set.pages, "contact.html", "<h1>", "<h1>↗ ");
  expect(report(set, { pages: arrow })).toContain("carries the booking arrow");
});

test("a none-mode bundle is otherwise untouched, and says which of the two reasons it is", () => {
  const off = render({ ...BARBER, booking_url: "" });
  const unset = render(BARBER, "");
  expect(off.copy.booking.mode).toBe("none");
  expect(unset.copy.booking.mode).toBe("none");
  expect(off.copy.booking.href).toBe("");
  expect(off.copy.booking.label).toBe("");
  expect(off.copy.booking.notice).toBe("");
  // "the record carries no booking_url" and "it names a variable this build has not got"
  // are different facts and the manifest says which one it was.
  expect(off.copy.booking.basis).toContain("carries no booking_url");
  expect(unset.copy.booking.basis).toContain("which is not set in this build");
  expect(report(off)).toBe("");
  expect(report(unset)).toBe("");
});

/* --------------------------------------------------------------- 4. the right pages */

test("a booking link on a page that must not carry one fails", () => {
  const set = render();
  const injected = edit(set.pages, "index.html", "<h1>", `${ANCHOR()}<h1>`);
  expect(report(set, { pages: injected })).toContain("the link belongs on the contact pages only");
  // ...and the notice cannot be smuggled onto such a page either: a notice about a link
  // belongs beside that link.
  const notice = edit(set.pages, "about.html", "<h1>", `${NOTICE_P()}<h1>`);
  expect(report(set, { pages: notice })).toContain("carries the demonstration notice 1 time(s) but no booking link");
});

test("a contact page that loses its booking link fails, and so does one that gains a second", () => {
  const set = render();
  const stripped = without(set, "contact-haircut.html", ANCHOR());
  expect(report(set, { pages: stripped })).toContain("contact-haircut.html: carries 0 booking links, not one");
  const doubled = edit(set.pages, "contact.html", ANCHOR(), `${ANCHOR()}${ANCHOR()}`);
  expect(report(set, { pages: doubled })).toContain("carries 2 booking links, not one");
});

/* --------------------------------------------------------------- 5. the right words */

test("the anchor's text is the derived label, not a string typed into the template", () => {
  const set = render();
  // (a) the data moves and the page does not.
  expect(report(set, { booking: { ...set.copy.booking, label: "Book Now" } })).toContain(
    'the label "Book Now" for booking mode demo',
  );
  // (b) the page moves and the data does not.
  const typed = editAll(set.pages, ANCHOR(), ANCHOR().replace(BOOKING_LABEL_DEMO, "Book Now"));
  const reported = report(set, { pages: typed });
  expect(reported).toContain('the booking link reads "Book Now&nbsp;↗"');
  expect(reported).toContain(`not "${BOOKING_LABEL_DEMO}&nbsp;↗"`);
});

test("a booking link pointed somewhere else fails", () => {
  const set = render();
  const misrouted = editAll(set.pages, `href="${DEMO_URL}"`, 'href="https://example.invalid/other"');
  // The anchor is identified by its class and its new-tab target, never by its href — so a
  // page whose link has moved is found, and refused for pointing at the wrong place.
  expect(report(set, { pages: misrouted })).toContain(
    'the booking link points at "https://example.invalid/other", not at https://example.invalid/demo-booking',
  );
  // …and a bundle whose data no longer names the page its link shows is refused as well.
  expect(report(set, { booking: { ...set.copy.booking, href: "https://example.invalid/other" } })).toContain(
    "not at the configured demonstration page",
  );
});

/* --------------------------------------------------------------- 6. tab and handler */

test("a booking link opening a new tab without noopener noreferrer fails", () => {
  const set = render();
  const bare = editAll(set.pages, ' target="_blank" rel="noopener noreferrer"', ' target="_blank" rel="noreferrer"');
  expect(report(set, { pages: bare })).toContain('without rel="noopener noreferrer"');
  // A link that loses its target completely is caught as the missing link rather than
  // silently accepted — which is why there is no separate "carries no target" clause here
  // to be unreachable (the anchor is identified BY that target).
  const targetless = editAll(set.pages, ' target="_blank" rel="noopener noreferrer"', "");
  expect(report(set, { pages: targetless })).toContain("carries 0 booking links, not one");
});

test("an inline handler on the booking link fails", () => {
  const set = render();
  const scripted = editAll(set.pages, 'rel="noopener noreferrer">', 'rel="noopener noreferrer" onclick="book()">');
  expect(report(set, { pages: scripted })).toContain("carries an inline handler (onclick=)");
});

/* ---------------------------------------------------------------- 7. the notice */

test("a demonstration link with no notice fails", () => {
  const set = render();
  expect(report(set, { booking: { ...set.copy.booking, notice: "" } })).toContain(
    "carries a demonstration booking link with no notice",
  );
});

test("a doubled notice fails", () => {
  const set = render();
  const doubled = edit(set.pages, "contact.html", NOTICE_P(), `${NOTICE_P()}${NOTICE_P()}`);
  expect(report(set, { pages: doubled })).toContain("the demonstration notice appears 2 time(s), not once");
});

test("a notice moved away from the link fails", () => {
  const set = render();
  const moved = edit(set.pages, "contact.html", `${NOTICE_P()}\n`, "");
  const above = edit(moved, "contact.html", '<p class="booking">', `${NOTICE_P()}\n        <p class="booking">`);
  expect(report(set, { pages: above })).toContain("the demonstration notice is not directly below the booking link");
  // ...and one removed from the page altogether is refused by the same clause.
  expect(report(set, { pages: moved })).toContain("the demonstration notice is not directly below the booking link");
});

test("a notice that names another business fails", () => {
  const set = render();
  const other = { ...set.copy.booking, notice: bookingNoticeDemo("Another Business") };
  expect(report(set, { booking: other })).toContain(
    "does not name the business this page is about (Example Barber Shop)",
  );
});

/* ----------------------------------------------------- 8. a business link says nothing */

test("a demonstration notice on a client's own booking link fails", () => {
  const set = render(CLIENT, "https://example.invalid/not-the-demo-page");
  const withNotice = { ...set.copy.booking, notice: bookingNoticeDemo(CLIENT.name) };
  expect(report(set, { booking: withNotice })).toContain(
    "booking mode is business but the build composed a demonstration notice",
  );
});

/* ----------------------------------------------- 9. the header slot on a demonstration */

test("a demonstration that changes the header action's label or destination fails", () => {
  const set = render();
  const relabelled = edit(
    set.pages,
    "index.html",
    '<a class="call-button header-action" href="contact.html">Contact Us</a>',
    '<a class="call-button header-action" href="contact.html">Book Now</a>',
  );
  expect(report(set, { pages: relabelled })).toContain(
    'in demonstration booking mode the header action reads "Book Now", not "Contact Us"',
  );
  const misrouted = editAll(set.pages, 'header-action" href="contact.html"', `header-action" href="${DEMO_URL}"`);
  const reported = report(set, { pages: misrouted });
  expect(reported).toContain("in demonstration booking mode the header action points at");
  expect(reported).toContain("the demonstration booking URL appears in the header");
});

test("the header slot is byte-unchanged in demo mode: same label, same destination", () => {
  const set = render();
  expect(set.copy.contactLabel.label).toBe("Contact Us"); // rule 8: the neutral label on a fixture
  expect(pageOf(set, "index.html")).toContain('<a class="call-button header-action" href="contact.html">Contact Us</a>');
  // The slot the owner signed off on 7 Oct is exactly the build's own primary action here.
  expect(pageOf(set, "index.html")).toContain('<a class="call-button header-action" href="contact.html">Contact Us</a>');
  expect(report(set)).toBe("");
});

/* ------------------------------------------------------------------- 10. no embeds */

test("an iframe, embed or object anywhere in the bundle fails", () => {
  const set = render();
  for (const tag of ["iframe", "embed", "object"]) {
    const injected = edit(set.pages, "privacy.html", "<h1>", `<${tag} src="${DEMO_URL}"></${tag}><h1>`);
    expect(report(set, { pages: injected })).toContain(`carries a <${tag}>`);
  }
});

/* ------------------------------------------------------- 11. the family that may not ask */

test("an inquiry fixture renders no booking link at all, whatever the record carries", () => {
  const set = render(GARDENER);
  expect(set.copy.booking.mode).toBe("none");
  expect(set.copy.booking.href).toBe("");
  expect(set.copy.booking.label).toBe("");
  expect(set.copy.booking.notice).toBe("");
  expect(set.copy.booking.basis).toContain("Family B (inquiry)");
  expect(report(set)).toBe("");
  for (const page of set.pages) expect(page.html).not.toContain(DEMO_URL);
});

/* ------------------------------------------------------------ 12. the check is wired in */

test("the booking check runs in the build's own self-check, not merely when called by name", () => {
  const set = render();
  const form = resolveForm(BARBER);
  const delivery = resolveDelivery(BARBER, form);
  const checks = (pages: RenderedPage[], css = set.css) =>
    complianceChecks({
      pages,
      record: BARBER,
      copy: set.copy,
      form,
      delivery,
      images: [],
      privacy: composePrivacy(BARBER, form, delivery, undefined, set.copy.booking),
      css,
      demoBookingUrl: DEMO_URL,
    }).join(" | ");
  expect(checks(set.pages)).toBe("");
  const stripped = without(set, "contact.html", ANCHOR());
  expect(checks(stripped)).toContain("carries 0 booking links, not one");
  // The style half of C1 is wired in too: a stylesheet that stops giving `.link-quiet` its
  // 44px fails the build through the same self-check.
  const short = `${set.css}\n.link-quiet { min-height: 1.5rem; }\n`;
  expect(checks(set.pages, short)).toContain('the control wearing "link-quiet" is at most 24px tall');
});
