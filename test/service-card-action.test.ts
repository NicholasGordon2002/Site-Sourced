#!/usr/bin/env bun
/**
 * The service card's action, in **both shapes the owner has asked for** — the action bar at
 * the card's foot (Treatment 1, owner direction, 9 Oct 2026) and the nested CTA button (owner
 * direction, 10 Oct 2026) — behind one switch, `DEMO_SERVICE_CARD_ACTION_BAR`, whose value
 * names the shape.
 *
 *   bun test test/service-card-action.test.ts
 *
 * Seven things, each one a way the variant could quietly stop being what it says:
 *
 *   1. the opt-in decides it: unset is off, set is on for the one demonstration,
 *      refused on every other record and in the delivered phase;
 *   2. with the opt-in off the card renders the bytes signed off on 7 Oct — the
 *      published markup, and the published stylesheet;
 *   3. with it on, the card carries the bar, the derived label and the text glyph;
 *   4. the gate passes the honest page, and **every clause of it can fire**;
 *   5. the card is still one link with nothing interactive nested in it (clause 1 of
 *      `serviceCardProblems`), because the owner's 6 Oct ruling is still open;
 *   6. the words in the bar are the family's derived ones, never typed;
 *   7. **the nested-CTA shape, asserted rather than assumed** (added 10 Oct 2026): one
 *      control per card at its foot, carrying the family's composed label and the derived
 *      `contact-<service>.html#form` destination; a card body that is inert text with no
 *      control inside an anchor; the gate silent when told `nested-cta` and not silent when
 *      the same pages are read as `whole-card` (the shape is passed in, never inferred); the
 *      old bare `1`/`true` spelling still selecting whole-card; a switch value naming no
 *      shape refused instead of quietly rendering the published cards; and the
 *      `overflow: hidden` clause that would clip the CTA's focus ring. Every one of those
 *      assertions is shown to be able to fail by doctoring the renderer or the composer —
 *      the proofs, each with its byte-exact restore, are in
 *      `docs/nested-cta-doctor-proofs.md`.
 *
 * No network. Only the fixtures on disk are read.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeCopy, composePrivacy, profileFor } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { serviceActionLabel } from "../src/demo/family.ts";
import {
  serviceCardMeasure,
  serviceCardProblems,
  type ServiceCardShape,
} from "../src/demo/family-render.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { renderCss, renderPages, servicePageFile, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
import {
  SERVICE_CARD_ACTION_BAR_CLASS,
  SERVICE_CARD_ACTION_BODY_CLASS,
  SERVICE_CARD_ACTION_CARD_CLASS,
  SERVICE_CARD_ACTION_CTA_CLASS,
  SERVICE_CARD_ACTION_NESTED_CARD_CLASS,
  SERVICE_CARD_ACTION_PAGE,
  SERVICE_CARD_ACTION_SHAPES,
  SERVICE_CARD_ACTION_SLUG,
  SERVICE_CARD_ACTION_VAR,
  serviceCardActionDecision,
  serviceCardActionProblems,
  type ServiceCardActionDecision,
} from "../src/demo/service-card-action.ts";
import type { BusinessRecord } from "../src/demo/types.ts";
import { resolveBuildParts } from "../src/demo/build.ts";

const FIXTURES = join(import.meta.dir, "fixtures");
const BARBER_RECORD: BusinessRecord = JSON.parse(
  readFileSync(join(FIXTURES, `${SERVICE_CARD_ACTION_SLUG}.json`), "utf8"),
) as BusinessRecord;

interface Built {
  record: BusinessRecord;
  pages: RenderedPage[];
  css: string;
  decision: ServiceCardActionDecision;
}

/**
 * Render every page exactly as the build does, with the switch off (`false`), on with the
 * spelling the test names (a string — `"1"`, `"true"`, `"bar"`, `"nested"`, `"cta"`,
 * `"bogus"`…), or on the way the 9 Oct tests asked for it (`true`, meaning the bare `1`).
 * The stylesheet follows the decision's own shape, so a nested build is measured against
 * the nested block rather than the bar's.
 */
function build(record: BusinessRecord, on: boolean | string, slug = SERVICE_CARD_ACTION_SLUG): Built {
  const env = on === false ? {} : { [SERVICE_CARD_ACTION_VAR]: on === true ? "1" : on };
  const decision = serviceCardActionDecision({ slug, phase: "demo", env });
  const { form: form, delivery: delivery, copy: copy } = resolveBuildParts(record, slug);
  const ctx: RenderContext = {
    record,
    copy,
    profile: profileFor(record),
    form,
    delivery,
    privacy: composePrivacy(record, form, delivery),
    images: [],
    slug,
    generatedAt: "2026-10-09T00:00:00.000Z",
    ...(decision.enabled ? { serviceCardAction: decision } : {}),
  };
  return {
    record,
    pages: renderPages(ctx),
    css: renderCss(profileFor(record), slug, decision.enabled ? { serviceCardAction: decision.shape } : {}),
    decision,
  };
}

const pageOf = (built: Built, file: string) => built.pages.find((p) => p.file === file)!.html;
const cardsOf = (html: string) => {
  const list = /<ul class="services">([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? "";
  return list.split(/<li\b[^>]*>/).slice(1).map((chunk) => chunk.slice(0, chunk.indexOf("</li>")));
};
/** The build's own clause, over the pages as rendered (or as doctored). */
const check = (built: Built, pages = built.pages, css = built.css) =>
  serviceCardActionProblems({
    pages,
    record: built.record,
    family: "appointment",
    css,
    decision: built.decision,
    slug: SERVICE_CARD_ACTION_SLUG,
  });
/**
 * `serviceCardProblems` — the 6 Oct card check — over these pages. The shape is passed in
 * (`ServiceCardShape`), which is the whole point of it being a parameter: a check that read
 * the shape off the markup would accept a card whose renderer changed under it.
 */
const cardCheck = (built: Built, shape: ServiceCardShape, pages = built.pages, css = built.css) =>
  serviceCardProblems({
    pages,
    record: built.record,
    family: "appointment",
    pageForService: servicePageFile,
    css,
    cardShape: shape,
  });
/** The recorded service names, in the order the record lists them. */
const serviceNames = (record: BusinessRecord) =>
  (record.services ?? []).map((s) => (typeof s === "string" ? s : String((s as { name?: string }).name ?? "")));
/** The five entities `esc` writes, read back the way a visitor reads them. */
const readable = (html: string) => html.replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
const swap = (built: Built, file: string, from: string, to: string, once = true): RenderedPage[] =>
  built.pages.map((p) => (p.file !== file ? p : { ...p, html: once ? p.html.replace(from, to) : p.html.split(from).join(to) }));

/* ------------------------------------------------------------------ 1. the opt-in */

test("the action-bar card is off unless the build opts in, and then only for one demonstration", () => {
  const off = serviceCardActionDecision({ slug: SERVICE_CARD_ACTION_SLUG, phase: "demo", env: {} });
  expect(off.enabled).toBe(false);
  expect(off.basis).toContain(`${SERVICE_CARD_ACTION_VAR} is not set`);

  const on = serviceCardActionDecision({ slug: SERVICE_CARD_ACTION_SLUG, phase: "demo", env: { [SERVICE_CARD_ACTION_VAR]: "1" } });
  expect(on.enabled).toBe(true);
  expect(on.page).toBe(SERVICE_CARD_ACTION_PAGE);

  // Every other record refuses it, and says why.
  const other = serviceCardActionDecision({ slug: "northshore-garden-works", phase: "demo", env: { [SERVICE_CARD_ACTION_VAR]: "1" } });
  expect(other.enabled).toBe(false);
  expect(other.basis).toContain("scoped to the");

  // A client's own site never carries a review treatment, whatever the variable says.
  const client = serviceCardActionDecision({ slug: SERVICE_CARD_ACTION_SLUG, phase: "business", env: { [SERVICE_CARD_ACTION_VAR]: "1" } });
  expect(client.enabled).toBe(false);
  expect(client.basis).toContain("delivered phase");

  // And the switch off is off for the spellings a person types.
  for (const value of ["", "0", "false", "off", "OFF"]) {
    expect(serviceCardActionDecision({ slug: SERVICE_CARD_ACTION_SLUG, phase: "demo", env: { [SERVICE_CARD_ACTION_VAR]: value } }).enabled).toBe(false);
  }
});

/* ------------------------------------------------- 2. the off state is the published one */

test("with the opt-in off the card and the stylesheet are the bytes signed off on 7 Oct", () => {
  const off = build(BARBER_RECORD, false);
  const services = pageOf(off, "services.html");
  expect(services).toContain('<a class="card service-tile" href="contact-haircut.html#form"><h2>Haircut</h2>');
  expect(services).not.toContain(SERVICE_CARD_ACTION_CARD_CLASS);
  expect(services).not.toContain(SERVICE_CARD_ACTION_BAR_CLASS);
  // The action line is the underlined text it has been since the 6 Oct ruling.
  expect(services).toContain('<p class="service-action">Request Haircut</p>');
  // The stylesheet is the published one, byte for byte: the variant's block is absent.
  expect(off.css).not.toContain(`.${SERVICE_CARD_ACTION_BAR_CLASS}`);
  expect(off.css).toBe(renderCss(profileFor(BARBER_RECORD), SERVICE_CARD_ACTION_SLUG));
  // And the gate has nothing to say about it.
  expect(check(off)).toEqual([]);
});

/* ------------------------------------------------------------ 3. what the card becomes */

test("with the opt-in on the card carries the bar, the derived label and the text glyph", () => {
  const on = build(BARBER_RECORD, true);
  const services = pageOf(on, "services.html");
  expect(services).toContain(`<a class="card service-tile ${SERVICE_CARD_ACTION_CARD_CLASS}" href="contact-haircut.html#form">`);
  expect(services).toContain('<div class="service-tile-body"><h2>Haircut</h2><p>Scissor or clipper cut, finished with a hot towel.</p></div>');
  expect(services).toContain(`<div class="${SERVICE_CARD_ACTION_BAR_CLASS}"><p class="service-action">Request Haircut</p>`);
  expect(services).toContain('<span class="service-action-chevron" aria-hidden="true">&nbsp;›</span></div></a>');
  // The name with an apostrophe is written the way the page escapes it, and the bar's
  // words are still composed from the record's own name.
  expect(services).toContain('<p class="service-action">Request Kids&#39; cut</p>');
  // One bar card per recorded service, on the page the opt-in names and nowhere else.
  expect(cardsOf(services).filter((c) => c.includes(SERVICE_CARD_ACTION_CARD_CLASS)).length).toBe(
    (BARBER_RECORD.services ?? []).length,
  );
  expect(pageOf(on, "index.html")).not.toContain(SERVICE_CARD_ACTION_CARD_CLASS);
  expect(pageOf(on, "contact.html")).not.toContain(SERVICE_CARD_ACTION_CARD_CLASS);
  // The stylesheet carries the block, and the bar's numbers come off it.
  expect(on.css).toContain(`.services .service-tile--bar .${SERVICE_CARD_ACTION_BAR_CLASS} {`);
  expect(check(on)).toEqual([]);
});

/* ------------------------------------------------------------------- 4. every clause can fire */

test("a page that carries the variant without the opt-in is refused, and so is a second page", () => {
  const on = build(BARBER_RECORD, true);
  const off = build(BARBER_RECORD, false);
  // The renderer applying the shape without the switch: the published bundle must not move.
  const smuggled = on.pages.map((p) => ({ ...p }));
  const problems = check(off, smuggled, on.css);
  expect(problems.join(" | ")).toContain(`${SERVICE_CARD_ACTION_VAR} is not set in this build`);

  // ...and the switch cannot put it on a second page: this is the home page, not the services page.
  const firstCard = cardsOf(pageOf(on, "services.html")).find((c) => c.includes(SERVICE_CARD_ACTION_CARD_CLASS))!;
  const widened = on.pages.map((p) =>
    p.file === "index.html" ? { ...p, html: p.html.replace("  </main>", `  <ul class="services"><li>${firstCard}</li></ul>\n  </main>`) } : p,
  );
  expect(check(on, widened).join(" | ")).toContain(`scoped to ${SERVICE_CARD_ACTION_PAGE}`);
});

test("a service the page stops rendering a bar card for is refused", () => {
  const on = build(BARBER_RECORD, true);
  const firstCard = cardsOf(pageOf(on, "services.html"))[0]!;
  const dropped = on.pages.map((p) =>
    p.file === SERVICE_CARD_ACTION_PAGE ? { ...p, html: p.html.replace(`<li>${firstCard}</li>`, "") } : p,
  );
  expect(check(on, dropped).join(" | ")).toContain("action-bar card");
});

test("a bar that is not the card's foot, or holds anything but the label and the glyph, is refused", () => {
  const on = build(BARBER_RECORD, true);
  const services = pageOf(on, SERVICE_CARD_ACTION_PAGE);
  const firstCard = cardsOf(services).find((c) => c.includes(SERVICE_CARD_ACTION_CARD_CLASS))!;
  /** One card, rewritten — the smallest simulation of a renderer that changed its mind. */
  const doctor = (from: string, to: string) =>
    on.pages.map((p) =>
      p.file === SERVICE_CARD_ACTION_PAGE ? { ...p, html: p.html.replace(firstCard, firstCard.replace(from, to)) } : p,
    );

  // (a) something follows the bar inside the card's link
  expect(check(on, doctor("</div></a>", "</div><p>extra</p></a>")).join(" | ")).toContain("not the last thing inside the card's link");

  // (b) a second control inside the bar — the nested-interactive defect the owner named.
  // A nested <a> also ends the card's own link early, so this one is refused by whichever
  // clause sees it first: the bar stops being the card's last element, or the bar is not
  // there at all under the link the card now has. Either way the build says no, and
  // `serviceCardProblems` refuses it too (asserted below).
  expect(check(on, doctor("</span></div>", `</span><a href="contact.html#form">Book</a></div>`)).join(" | ")).toMatch(
    /carries no bar element|not one action line followed by the chevron|not the last thing inside the card's link/,
  );

  // (c) the bar losing the action line the gate reads
  expect(check(on, doctor('<p class="service-action">Request Haircut</p>', "<i>Request Haircut</i>")).join(" | ")).toContain(
    "does not open with one action line",
  );

  // (d) a glyph dressed up as an icon the bundle would have to ship
  expect(
    check(on, doctor('<span class="service-action-chevron" aria-hidden="true">&nbsp;›</span>', '<img src="chevron.svg" alt="">')).join(" | "),
  ).toContain("not one action line followed by the chevron");

  // A bar with no card class on it is half a shape: the page then carries the bar's own
  // element with no card wearing the variant, and the card count no longer matches the
  // record. Either message is the build saying no.
  expect(check(on, doctor(SERVICE_CARD_ACTION_CARD_CLASS, "service-tile")).join(" | ")).toMatch(
    /half the action-bar variant|action-bar cards? for/,
  );
});

test("words the family did not compose are refused, on a bar that is otherwise the right shape", () => {
  const on = build(BARBER_RECORD, true);
  const typed = on.pages.map((p) =>
    p.file === SERVICE_CARD_ACTION_PAGE
      ? { ...p, html: p.html.replace(">Request Haircut</p>", ">Book now</p>") }
      : p,
  );
  const problems = check(on, typed).join(" | ");
  expect(problems).toContain('carries the action line "Book now"');
  expect(problems).toContain("never from the template");

  // ...and a bar under a heading the record does not carry is refused too.
  const invented = on.pages.map((p) =>
    p.file === SERVICE_CARD_ACTION_PAGE ? { ...p, html: p.html.replace("<h2>Haircut</h2>", "<h2>Shave and a haircut</h2>") } : p,
  );
  expect(check(on, invented).join(" | ")).toContain("which the record does not list as a service");
});

test("a bar the stylesheet does not size, or that loses its hairline, is refused", () => {
  const on = build(BARBER_RECORD, true);
  expect(check(on, on.pages, `.services .service-tile--bar .${SERVICE_CARD_ACTION_BAR_CLASS} { padding: 0; }\n`).join(" | ")).toContain(
    `the action bar (class="${SERVICE_CARD_ACTION_BAR_CLASS}") is given no min-height by any rule naming its own class`,
  );
  expect(
    check(on, on.pages, `.services .service-tile--bar .${SERVICE_CARD_ACTION_BAR_CLASS} { min-height: 2.75rem; }\n`).join(" | "),
  ).toContain("declares a border-top");
  expect(
    check(
      on,
      on.pages,
      `.services .service-tile--bar .${SERVICE_CARD_ACTION_BAR_CLASS} { min-height: 2.75rem; border-top: 1px solid #cccccc; }\n`,
    ).join(" | "),
  ).toContain("not the bundle's own --rule token");
  // The card keeps its own floor and its own ring: dropping the ring is refused by name.
  expect(check(on, on.pages, ".services .service-tile--bar { min-height: 2.75rem; }\n").join(" | ")).toContain("focus ring");
});

/* --------------------------------------------- 5. the card is still one link, one tab stop */

test("the card the variant renders is still one link with nothing interactive nested in it", () => {
  const on = build(BARBER_RECORD, true);
  const cards = cardsOf(pageOf(on, SERVICE_CARD_ACTION_PAGE));
  expect(cards.length).toBeGreaterThan(0);
  for (const card of cards) {
    expect((card.match(/<a\b/g) ?? []).length).toBe(1);
    expect(card).not.toMatch(/<(button|input|select|textarea|details|summary|iframe|object|embed)\b/i);
    expect(card).not.toContain("tabindex");
    expect(card).not.toContain("aria-label");
    expect(card).not.toMatch(/\son[a-z]+\s*=/i);
    // The whole card, bar included, is inside the one anchor.
    expect(card.indexOf(`<div class="${SERVICE_CARD_ACTION_BAR_CLASS}">`)).toBeLessThan(card.indexOf("</a>"));
  }
  // And the gate that enforces it, over the same page with the same stylesheet, is silent —
  // the variant does not need a single clause of the 6 Oct ruling relaxed.
  expect(
    serviceCardProblems({
      pages: on.pages,
      record: on.record,
      family: "appointment",
      pageForService: servicePageFile,
      css: on.css,
    }),
  ).toEqual([]);
});

/* ------------------------------- 7. the nested-CTA shape (owner direction, 10 Oct 2026) */

const NESTED: ServiceCardShape = "nested-cta";
const CTA_IN_CARD = new RegExp(`<a class="${SERVICE_CARD_ACTION_CTA_CLASS}" href="([^"]*)">([^<]*)</a>`);

test("the nested-CTA card is a container with exactly one control at its foot, labelled and pointing where the record says", () => {
  const on = build(BARBER_RECORD, "nested");
  const names = serviceNames(BARBER_RECORD);
  expect(names.length).toBeGreaterThan(0);
  expect(on.decision.shape).toBe(NESTED);

  // The shape is on every page of this bundle that renders a card — the home page included,
  // because the home page renders the same cards (owner direction, 10 Oct 2026).
  for (const file of ["index.html", SERVICE_CARD_ACTION_PAGE]) {
    const cards = cardsOf(pageOf(on, file));
    expect(cards.length).toBe(names.length);
    const carried: string[] = [];
    for (const card of cards) {
      // The card is a container, not a link.
      expect(card.trim().startsWith(`<div class="card service-tile ${SERVICE_CARD_ACTION_NESTED_CARD_CLASS}">`)).toBe(true);
      // Exactly one interactive element, and nothing a browser puts in the tab order beside it.
      expect((card.match(/<a\b/gi) ?? []).length).toBe(1);
      expect(card).not.toMatch(/<(button|input|select|textarea|details|summary|iframe|object|embed)\b/i);
      expect(card).not.toContain("tabindex");
      expect(card).not.toContain("aria-label");
      // It carries the CTA's own class, the family's composed label and nothing else, and it
      // is the card's foot: the container's own closing tag is all that follows it.
      const cta = CTA_IN_CARD.exec(card);
      expect(cta).not.toBeNull();
      expect(cta![2]).not.toContain("<");
      expect(card.slice(card.indexOf(cta![0]) + cta![0].length).trim()).toBe("</div>");
      const heading = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(card)?.[1] ?? "";
      carried.push(`${cta![1]}|${readable(cta![2])}|${readable(heading)}`);
    }
    // One card per recorded service, each carrying the derived destination
    // (`contact-<service-slug>.html#form`) and the derived appointment label.
    expect(new Set(carried)).toEqual(
      new Set(names.map((name) => `${servicePageFile(name)}#form|${serviceActionLabel("appointment", name)}|${name}`)),
    );
  }
  // No page without a service list carries the shape.
  for (const file of ["about.html", "contact.html", "privacy.html"]) {
    expect(pageOf(on, file)).not.toContain(SERVICE_CARD_ACTION_NESTED_CARD_CLASS);
    expect(pageOf(on, file)).not.toContain(SERVICE_CARD_ACTION_CTA_CLASS);
  }
  // The escaped name is still written the way the page escapes it.
  expect(pageOf(on, SERVICE_CARD_ACTION_PAGE)).toContain(`>Request Kids&#39; cut</a>`);
  // Both gates, told the shape this build renders, have nothing to say.
  expect(check(on)).toEqual([]);
  expect(cardCheck(on, NESTED)).toEqual([]);
});

test("in the nested shape the card's body is inert text and nothing interactive sits inside an anchor", () => {
  const on = build(BARBER_RECORD, "nested");
  const services = pageOf(on, SERVICE_CARD_ACTION_PAGE);
  const first = cardsOf(services).find((card) => card.includes(SERVICE_CARD_ACTION_NESTED_CARD_CLASS))!;
  const anchor = /<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(first)!;
  // The anchor holds the label and nothing else: no element, no markup, no heading, no note.
  expect(anchor[1]).not.toMatch(/[<>]/);
  expect(anchor[1]).toBe("Request Haircut");
  // The body — the record's own heading and note — sits outside the anchor, in the body block.
  const body = first.replace(anchor[0], "");
  expect(body).toContain(`<div class="${SERVICE_CARD_ACTION_BODY_CLASS}">`);
  expect(body).toContain("<h2>Haircut</h2>");
  expect(body).toContain("<p>Scissor or clipper cut, finished with a hot towel.</p>");
  // And the card itself is not a link, so nothing interactive is inside one.
  expect(first.trim()).not.toMatch(/^<a\b/);
  for (const card of cardsOf(services)) {
    expect(/<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(card)![1]).not.toMatch(
      /<(a|button|input|select|textarea|details|summary|iframe|object|embed)\b/i,
    );
  }
  // The 6 Oct check agrees while it is told the shape this build renders...
  expect(cardCheck(on, NESTED)).toEqual([]);
  // ...and disagrees when these same pages are read as the other shape, which is the proof
  // the shape is passed in rather than inferred from the markup.
  expect(cardCheck(on, "whole-card").join(" | ")).toContain("the card carries content outside its own link");
  // A card that wraps its own body in the anchor — the shape this variant replaces — is
  // refused by both gates: two links on one card, and the body inside the link.
  const wrapped = swap(
    on,
    SERVICE_CARD_ACTION_PAGE,
    `<div class="card service-tile ${SERVICE_CARD_ACTION_NESTED_CARD_CLASS}"><div class="${SERVICE_CARD_ACTION_BODY_CLASS}">`,
    `<a class="card service-tile ${SERVICE_CARD_ACTION_NESTED_CARD_CLASS}" href="contact-haircut.html#form"><div class="${SERVICE_CARD_ACTION_BODY_CLASS}">`,
  );
  expect(cardCheck(on, NESTED, wrapped).join(" | ")).toContain("a service card carries 2 links, not one");
  expect(check(on, wrapped).join(" | ")).toContain("carries 2 links and no other controls, not one control");
});

test("the bare 1 and true still select the whole-card bar, and the bar's link still refuses a nested control", () => {
  // The spelling a person typed before the second shape existed still means what it meant on
  // 9 Oct — so no existing build changes meaning.
  for (const value of ["1", "true", "on", "yes", "bar", "whole-card"]) {
    expect(SERVICE_CARD_ACTION_SHAPES[value]).toBe("whole-card");
    const decision = serviceCardActionDecision({ slug: SERVICE_CARD_ACTION_SLUG, phase: "demo", env: { [SERVICE_CARD_ACTION_VAR]: value } });
    expect(decision.enabled).toBe(true);
    expect(decision.shape).toBe("whole-card");
  }
  const bare = build(BARBER_RECORD, true);
  const one = build(BARBER_RECORD, "1");
  // Byte for byte the same build, pages and stylesheet alike.
  expect(one.pages).toEqual(bare.pages);
  expect(one.css).toBe(bare.css);
  expect(pageOf(one, "index.html")).not.toContain(SERVICE_CARD_ACTION_NESTED_CARD_CLASS);
  expect(pageOf(one, SERVICE_CARD_ACTION_PAGE)).not.toContain(SERVICE_CARD_ACTION_NESTED_CARD_CLASS);
  expect(pageOf(one, SERVICE_CARD_ACTION_PAGE)).not.toContain(SERVICE_CARD_ACTION_CTA_CLASS);
  expect(pageOf(one, SERVICE_CARD_ACTION_PAGE)).toContain(SERVICE_CARD_ACTION_BAR_CLASS);

  // The whole-card link still refuses a control nested inside it, whichever control it is.
  const barCard = cardsOf(pageOf(bare, SERVICE_CARD_ACTION_PAGE)).find((card) => card.includes(SERVICE_CARD_ACTION_CARD_CLASS))!;
  for (const [control, tag] of [
    ["<button>Book</button>", "button"],
    ['<input type="text" name="x">', "input"],
    [`<a href="contact.html#form">Book</a>`, "a"],
  ] as const) {
    const opened = swap(bare, SERVICE_CARD_ACTION_PAGE, barCard, barCard.replace("</div></a>", `${control}</div></a>`));
    expect(cardCheck(bare, "whole-card", opened).join(" | ")).toContain(`nests an interactive element (<${tag}>)`);
  }
});

test("a switch value that names no shape is refused, never rendered as the published cards", () => {
  const off = build(BARBER_RECORD, false);
  const bogus = build(BARBER_RECORD, "booking");
  // The switch is not silently ignored: the value is recorded verbatim and nothing is rendered.
  expect(bogus.decision.enabled).toBe(false);
  expect(bogus.decision.unrecognised).toBe("booking");
  expect(bogus.decision.raw).toBe("booking");
  expect(bogus.decision.basis).toContain("names no shape this build knows");
  // The pages in memory are the published ones — so the refusal is what stops them from
  // passing as the cards nobody asked to change.
  expect(bogus.pages).toEqual(off.pages);
  expect(bogus.css).toBe(off.css);
  const problems = check(bogus).join(" | ");
  expect(problems).toContain(`${SERVICE_CARD_ACTION_VAR} is set to "booking", which names no card shape this build knows`);
  expect(problems).toContain("so nothing was rendered for it");
  expect(problems).toContain('"nested"');
  // The honest off-state is still silent, so the clause refuses the typo and only the typo.
  expect(check(off)).toEqual([]);
  // Every spelling the map knows is a spelling the switch accepts, and the accepted set is
  // exactly these — a new one is a deliberate act, not a typo that happens to render.
  expect(Object.keys(SERVICE_CARD_ACTION_SHAPES).sort()).toEqual(
    ["1", "bar", "cta", "nested", "nested-cta", "on", "true", "whole-card", "yes"].sort(),
  );
});

test("the nested shape covers every card this demonstration renders, or none of them", () => {
  const on = build(BARBER_RECORD, "nested");
  const names = serviceNames(BARBER_RECORD);
  const firstCard = cardsOf(pageOf(on, SERVICE_CARD_ACTION_PAGE))[0]!;
  // A page that renders the list without the shape is two shapes in one demonstration.
  const unmarked = swap(on, SERVICE_CARD_ACTION_PAGE, ` ${SERVICE_CARD_ACTION_NESTED_CARD_CLASS}`, "", false);
  expect(check(on, unmarked).join(" | ")).toContain("renders a service list with none of the nested-CTA cards on it");
  // A page that wears the shape with no list at all.
  const elsewhere = on.pages.map((p) =>
    p.file === "contact.html"
      ? { ...p, html: p.html.replace("  </main>", `  <div class="card service-tile ${SERVICE_CARD_ACTION_NESTED_CARD_CLASS}">x</div>\n  </main>`) }
      : p,
  );
  expect(check(on, elsewhere).join(" | ")).toContain("carries the nested-CTA card variant (service-tile--cta) but renders no service list");
  // A service the page stops rendering a card for.
  const dropped = swap(on, SERVICE_CARD_ACTION_PAGE, `<li>${firstCard}</li>`, "");
  expect(check(on, dropped).join(" | ")).toContain(`for ${names.length} recorded services`);
  // Half the shape: the card without its CTA.
  const ctaless = on.pages.map((p) =>
    p.file === SERVICE_CARD_ACTION_PAGE
      ? { ...p, html: p.html.replaceAll(new RegExp(`<a class="${SERVICE_CARD_ACTION_CTA_CLASS}"[^>]*>[^<]*</a>`, "g"), "") }
      : p,
  );
  expect(check(on, ctaless).join(" | ")).toContain("carries half the nested-CTA variant");
  // The words and the destination are refused by the action gate too, not only by the 6 Oct
  // card gate: this module's own clauses read the same anchor.
  const typed = swap(on, SERVICE_CARD_ACTION_PAGE, ">Request Haircut</a>", ">Book Now</a>");
  expect(check(on, typed).join(" | ")).toContain('carries the CTA "Book Now"');
  const wrongWay = swap(on, SERVICE_CARD_ACTION_PAGE, 'href="contact-haircut.html#form"', 'href="contact.html#form"');
  expect(check(on, wrongWay).join(" | ")).toContain('not at the page built for that service with "#form"');
});

test("the nested shape's control is 44px with a ring of its own, and no rule on the card clips it", () => {
  const on = build(BARBER_RECORD, "nested");
  // The numbers, off the stylesheet the bundle ships: the CTA is the target in this shape.
  const cta = serviceCardMeasure(on.css, [SERVICE_CARD_ACTION_CTA_CLASS]);
  expect(cta.class).toBe(SERVICE_CARD_ACTION_CTA_CLASS);
  expect(cta.min_height_px).toBe(44);
  expect(cta.focus_ring_px).toBe(2);
  expect(on.css).toMatch(
    /\.services \.service-tile--cta \.service-cta:focus-visible \{\s*outline: 2px solid var\(--accent\);\s*outline-offset: 2px;\s*\}/,
  );
  // The ring is drawn 2px outside the button's own box, so the card must not clip it. This is
  // the clause the whole-card shape needs (`overflow: hidden` clips the bar to the radius) and
  // the nested shape must not inherit.
  expect(on.css).not.toMatch(new RegExp(`\\.${SERVICE_CARD_ACTION_NESTED_CARD_CLASS}\\b[^{}]*\\{[^}]*overflow\\s*:\\s*hidden`, "i"));
  expect(check(on)).toEqual([]);

  // A stylesheet that clips the ring is refused, by name.
  const clipped = `${on.css}\n.services .${SERVICE_CARD_ACTION_NESTED_CARD_CLASS} { overflow: hidden; }\n`;
  expect(check(on, on.pages, clipped).join(" | ")).toContain(
    `the variant's card (class="${SERVICE_CARD_ACTION_NESTED_CARD_CLASS}") declares overflow: hidden`,
  );
  // ...and so is a CTA that loses the 44px floor or the ring of its own.
  const flat = `${on.css}\n.services .service-tile--cta .${SERVICE_CARD_ACTION_CTA_CLASS} { min-height: 1rem; }\n`;
  expect(check(on, on.pages, flat).join(" | ")).toContain(
    `the CTA (class="${SERVICE_CARD_ACTION_CTA_CLASS}") is at most 16px tall`,
  );
  const ringless = `${on.css}\n.services .service-tile--cta .${SERVICE_CARD_ACTION_CTA_CLASS}:focus-visible { outline: none; }\n`;
  expect(check(on, on.pages, ringless).join(" | ")).toContain(
    `the CTA (class="${SERVICE_CARD_ACTION_CTA_CLASS}") is given a 0px focus ring`,
  );
});
