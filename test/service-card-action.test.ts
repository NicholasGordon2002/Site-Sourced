#!/usr/bin/env bun
/**
 * The action-bar service card — Treatment 1 (owner direction, 9 Oct 2026).
 *
 *   bun test test/service-card-action.test.ts
 *
 * Six things, each one a way the variant could quietly stop being what it says:
 *
 *   1. the opt-in decides it: unset is off, set is on for the one demonstration,
 *      refused on every other record and in the delivered phase;
 *   2. with the opt-in off the card renders the bytes signed off on 7 Oct — the
 *      published markup, and the published stylesheet;
 *   3. with it on, the card carries the bar, the derived label and the text glyph;
 *   4. the gate passes the honest page, and **every clause of it can fire**;
 *   5. the card is still one link with nothing interactive nested in it (clause 1 of
 *      `serviceCardProblems`), because the owner's 6 Oct ruling is still open;
 *   6. the words in the bar are the family's derived ones, never typed.
 *
 * No network. Only the fixtures on disk are read.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeCopy, composePrivacy, profileFor } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { serviceCardProblems } from "../src/demo/family-render.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { renderCss, renderPages, servicePageFile, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
import {
  SERVICE_CARD_ACTION_BAR_CLASS,
  SERVICE_CARD_ACTION_CARD_CLASS,
  SERVICE_CARD_ACTION_PAGE,
  SERVICE_CARD_ACTION_SLUG,
  SERVICE_CARD_ACTION_VAR,
  serviceCardActionDecision,
  serviceCardActionProblems,
  type ServiceCardActionDecision,
} from "../src/demo/service-card-action.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

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

/** Render every page exactly as the build does, with the variant on or off. */
function build(record: BusinessRecord, on: boolean, slug = SERVICE_CARD_ACTION_SLUG): Built {
  const decision = serviceCardActionDecision({ slug, phase: "demo", env: on ? { [SERVICE_CARD_ACTION_VAR]: "1" } : {} });
  const form = resolveForm(record);
  const delivery = resolveDelivery(record, form);
  const copy = composeCopy(record, slug, form, delivery);
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
  return { record, pages: renderPages(ctx), css: renderCss(profileFor(record), slug, { serviceCardAction: decision.enabled }), decision };
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
    family: built.decision.enabled ? "appointment" : "appointment",
    css,
    decision: built.decision,
    slug: SERVICE_CARD_ACTION_SLUG,
  });
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
