#!/usr/bin/env bun
/**
 * **The business phase, as a real bundle.**
 *
 *   bun test test/business-phase.test.ts
 *
 * Every other rendering test in this repository builds a *demonstration*: the four
 * published fixtures are fictional, the synthetic records in `phase-gate.test.ts` are
 * never written to disk, and the business-phase header slot, the CTA band's downstep and
 * the business-phase README and footer were therefore **checked but never rendered**. The
 * E2 report named that gap (finding 3: "C3 is covered at check/test level but not by a
 * real bundle — no fixture is in business phase").
 *
 * `test/records/business-phase.json` closes it: a test-only record whose form delivers to
 * the business's own published address, so `delivery.mode` resolves to `business` and the
 * whole bundle renders in the delivered phase. It is deliberately **outside
 * `test/fixtures/`** — that directory is the published fixture set (`bun run demo:fixtures`
 * builds exactly four demos from it, and the set's count is an expectation of its own) —
 * so this record can never become a fifth published demo. Nothing here writes a file,
 * fetches anything or sends anything.
 *
 * What is pinned, in the order a reader meets it:
 *
 *   1. the delivered bundle renders and passes **every** build check (`complianceChecks`),
 *      which is what exercises the clauses by name rather than by reading their code;
 *   2. the README a client receives carries no demonstration paragraph and no sourcing
 *      claim (WORKFLOW.md rule 9: "the delivered README's demo-phase paragraph");
 *   3. every delivered page's footer carries the authorship line and nothing about search
 *      engines or "public listings" — and the About page carries no "where the details
 *      came from" sentence at all;
 *   4. the business-phase header slot and the CTA band's `link-quiet link-quiet--inline`
 *      downstep are rendered, not only asserted in `test/booking.test.ts`;
 *   5. the **demonstration** twin of the same record still prints all of it, so this is a
 *      derivation and not a deletion;
 *   6. every clause above is shown to **fire**, by doctoring the sentence it exists to
 *      catch into the rendered page or README and asserting the refusal's own words.
 */
import { expect, test } from "bun:test";
import { join } from "node:path";

import { complianceChecks, phaseFurnitureProblems, readmePageListProblems } from "../src/demo/build.ts";
import { composeCopy, composePrivacy, printedDetailClaimProblems, profileFor } from "../src/demo/copy.ts";
import { resolveDelivery, type FormDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import { provenanceProblems, type Provenance } from "../src/demo/provenance.ts";
import { inspectSuppliedImage, manifestForSupplied } from "../src/demo/supplied.ts";
import {
  renderCss,
  readmeScriptClaim,
  renderEditingReadme,
  scriptedPages,
  renderJs,
  renderPages,
  type RenderContext,
  type RenderedPage,
} from "../src/demo/render.ts";
import type { BusinessRecord, ManifestImage } from "../src/demo/types.ts";

/** The test-only delivered-phase record. Never in `test/fixtures/`, never published. */
const RECORD_PATH = join(import.meta.dir, "records", "business-phase.json");
const RECORD = JSON.parse(await Bun.file(RECORD_PATH).text()) as BusinessRecord;

/**
 * The record as this file renders it: the form id is a per-client value that lives in the
 * gitignored `.env.local` (`env:SS_FORMSPARK_FORM_ID`), so the record keeps the reference
 * and the test supplies its own — the same value every other rendering test passes. A test
 * must not need a secret to run, and nothing here asserts anything about that id.
 */
const RECORD_FOR_RENDER: BusinessRecord = { ...RECORD, form_access_key: "test-form-id" };

/** Site Sourced's own test inbox — the address that makes a record a *demonstration*. */
const OUR_INBOX = "site-sourced-311e0184@ctomail.io";

/** The authorship line, the one provenance sentence both phases carry. */
const AUTHORSHIP = "Copy, layout and imagery: Site Sourced. No logo, photograph or text was taken from any other website.";

/** The sentences that may only exist while the bundle is a proposal. */
const DEMO_ONLY = [
  "unsolicited design proposal",
  "marked noindex",
  "take it down",
  "public listings",
  "public mapping data",
];

interface Bundle {
  record: BusinessRecord;
  ctx: RenderContext;
  pages: RenderedPage[];
  readme: string;
  /** What `complianceChecks` says about the whole bundle, README included. */
  problems: string[];
}

/**
 * Render a record exactly the way `buildBundle` does, README and stylesheet included, and
 * run the same self-check on the result. The supplied hero is measured from the real file
 * (through the symlink in `test/records/images/`), exactly as the build measures it.
 */
async function render(record: BusinessRecord): Promise<Bundle> {
  const slug = record.slug ?? "business-phase-fixture";
  const profile = profileFor(record);
  const form = resolveForm(record);
  const delivery = resolveDelivery(record, form);
  const copy = composeCopy(record, slug, form, delivery);
  const privacy = composePrivacy(record, form, delivery);
  const images: ManifestImage[] = [];
  for (const image of record.images ?? []) {
    const inspected = await inspectSuppliedImage(image, join(import.meta.dir, "records"));
    images.push(manifestForSupplied(image, inspected.variants));
  }
  const ctx: RenderContext = {
    record,
    copy,
    profile,
    form,
    delivery,
    privacy,
    images,
    slug,
    generatedAt: "2026-10-08T00:00:00.000Z",
  };
  const pages = renderPages(ctx);
  const css = renderCss(profile, slug);
  const js = renderJs();
  const readme = renderEditingReadme(ctx, pages);
  return {
    record,
    ctx,
    pages,
    readme,
    problems: complianceChecks({ pages, record, copy, form, delivery, images, privacy, css, js, readme }),
  };
}

let cached: Promise<Bundle> | null = null;
/** The delivered bundle, rendered once for the whole file. */
const delivered = (): Promise<Bundle> => (cached ??= render(RECORD_FOR_RENDER));

const page = (b: Bundle, file: string): string => b.pages.find((p) => p.file === file)!.html;

/** One page's html, with a piece replaced — what a visitor would receive. */
const doctored = (b: Bundle, file: string, from: string, to: string): RenderedPage[] =>
  b.pages.map((p) => (p.file === file ? { ...p, html: p.html.replace(from, to) } : p));

/** The provenance clause's refusal messages for a doctored bundle. */
const sourcing = (b: Bundle, pages: RenderedPage[], readme = b.readme): string =>
  provenanceProblems({
    record: b.record,
    provenance: b.ctx.copy.provenance as Provenance,
    pages,
    deliveryMode: (b.ctx.delivery as FormDelivery).mode,
    readme,
  }).join(" | ");

/** The phase-furniture clause's refusal messages for a doctored bundle. */
const furniture = (b: Bundle, readme = b.readme, pages = b.pages): string =>
  phaseFurnitureProblems({ pages, record: b.record, copy: b.ctx.copy, delivery: b.ctx.delivery, readme }).join(" | ");

/* ------------------------------------------------------------------ the phase itself */

test("the test record really is the delivered phase, and the bundle passes every check", async () => {
  const b = await delivered();
  expect(b.ctx.delivery.mode).toBe("business");
  expect(b.ctx.copy.booking.mode).toBe("business");
  expect(b.ctx.copy.provenance.kind).toBe("public-listings");
  // Nine pages: the five named ones plus one per recorded service.
  expect(b.pages.map((p) => p.file)).toEqual([
    "index.html",
    "services.html",
    "about.html",
    "contact.html",
    "privacy.html",
    "contact-haircut.html",
    "contact-beard-trim.html",
    "contact-hot-shave.html",
  ]);
  // The whole self-check, over a real delivered bundle — the clauses below are exercised
  // through it, not only called directly.
  expect(b.problems).toEqual([]);
});

test("the delivered README is a client's README: no demonstration paragraph, no sourcing claim", async () => {
  const b = await delivered();
  for (const phrase of DEMO_ONLY) expect(`${phrase}: ${b.readme.includes(phrase)}`).toBe(`${phrase}: false`);
  expect(b.readme).not.toContain("Where the details came from");
  expect(b.readme).toContain("— your website files");
  expect(b.readme).toContain("These files were built by Site Sourced and are yours outright");
});

test("every delivered page's footer carries the authorship line, and nothing a proposal says", async () => {
  const b = await delivered();
  for (const p of b.pages) {
    const footer = p.html.slice(p.html.indexOf("<footer"), p.html.indexOf("</footer>"));
    expect(`${p.file}: ${footer.includes(AUTHORSHIP)}`).toBe(`${p.file}: true`);
    expect(`${p.file}: ${p.html.includes("noindex")}`).toBe(`${p.file}: false`);
    expect(`${p.file}: ${p.html.includes('name="robots"')}`).toBe(`${p.file}: false`);
    expect(`${p.file}: ${p.html.includes("public listings")}`).toBe(`${p.file}: false`);
    expect(`${p.file}: ${p.html.includes("public mapping data")}`).toBe(`${p.file}: false`);
  }
});

test("no delivered page prints a sentence about where the details came from", async () => {
  const b = await delivered();
  for (const p of b.pages) {
    expect(`${p.file}: ${p.html.includes("came from public listings")}`).toBe(`${p.file}: false`);
    expect(`${p.file}: ${p.html.includes("Every detail here")}`).toBe(`${p.file}: false`);
  }
  // Absent, not replaced: the About page ends on the sentence about its services.
  const about = page(b, "about.html");
  const last = about.slice(about.indexOf('<section class="section" id="about">'), about.indexOf("</section>"));
  expect(last).toContain("The services recorded for");
  expect(last.trimEnd().endsWith("</div>")).toBe(true);
});

/* -------------------------------------------- the shape that had never been rendered */

test("the delivered header slot and the CTA band's downstep are rendered, not just asserted", async () => {
  const b = await delivered();
  const booking = "https://bookings.delivered-fixture-barber.ca/";
  for (const file of ["index.html", "about.html"]) {
    const html = page(b, file);
    // The header's action slot takes the client's own booking page and says so.
    expect(html).toContain(`<a class="call-button header-action" href="${booking}">`);
    expect(html).toContain("Book on Delivered Fixture Barber Shop&#39;s own booking page</a>");
    // …so the band below it steps down to the quiet link (lead correction C3, 8 Oct):
    // one ink pill per page, and the two no longer compete at the same weight.
    expect(html).toContain('<p class="cta-actions"><a class="link-quiet link-quiet--inline" href="contact.html">Request an appointment</a></p>');
    expect(html).not.toContain('<p class="cta-actions"><a class="button"');
  }
});

test("the same record as a demonstration still prints every one of those sentences", async () => {
  const demo = await render({ ...RECORD_FOR_RENDER, form_recipient: OUR_INBOX, form_delivery: "demo", booking_url: "" });
  expect(demo.ctx.delivery.mode).toBe("demo");
  expect(demo.problems).toEqual([]);
  const index = page(demo, "index.html");
  expect(index).toContain("Business details come from public listings about this business.");
  expect(index).toContain("This page is marked noindex, so it does not appear in search results.");
  expect(page(demo, "about.html")).toContain("came from public listings");
  expect(demo.readme).toContain("DEMONSTRATION — not the business's website");
});

test("a delivered bundle from OpenStreetMap keeps the licence credit and drops the sourcing clause", async () => {
  const osm = await render({ ...RECORD_FOR_RENDER, source_kind: "openstreetmap" });
  expect(osm.problems).toEqual([]);
  const index = page(osm, "index.html");
  expect(index).toContain("© OpenStreetMap contributors");
  expect(index).toContain("odbl/1-0/");
  expect(index).not.toContain("public mapping data");
  expect(index).not.toContain("came from public listings");
});

/* --------------------------------------------------- can the clauses actually fire? */

test("the delivery's sourcing sentence typed back into a delivered page is refused", async () => {
  const b = await delivered();
  const injected = doctored(b, "about.html", "</section>", "Business details come from public listings about this business.</section>");
  const problems = sourcing(b, injected);
  expect(problems).toContain("about.html: carries the sentence that says the details came from public listings");
});

test("the \"as published in public listings\" caveat and the mapping-data credit are refused too", async () => {
  const b = await delivered();
  const caveat = doctored(
    b,
    "contact.html",
    "</footer>",
    "The address and email address for Delivered Fixture Barber Shop on this page are as published in public listings — please confirm them with the business before relying on them.</footer>",
  );
  expect(sourcing(b, caveat)).toContain('contact.html: carries the "as published in public listings" caveat');

  const mapping = doctored(b, "index.html", "</footer>", "Business details come from public mapping data.</footer>");
  expect(sourcing(b, mapping)).toContain('index.html: carries the "public mapping data" credit');
});

test("the sourcing sentences are refused in the README that ships beside the pages", async () => {
  const b = await delivered();
  const problems = sourcing(b, b.pages, `${b.readme}\nThe details came from public listings.\n`);
  expect(problems).toContain("README.txt: carries the sentence that says the details came from public listings");
});

test("the old demonstration paragraph added back to the delivered README is refused, in the check's own words", async () => {
  const b = await delivered();
  // The paragraph exactly as it printed before the phase gate existed (render.ts's
  // business branch is what keeps it off this README).
  const paragraph = `Built by Site Sourced
---------------------
This page is an unsolicited design proposal, not the business's official site, and
it is marked noindex, so it does not appear in search results. Ask and it comes down.
`;
  const problems = furniture(b, `${b.readme}\n${paragraph}`);
  expect(problems).toContain("the delivered README carries an unsolicited-proposal sentence");
  expect(problems).toContain("the delivered README carries the sentence about being marked noindex");
  expect(problems).toContain("the delivered README carries the takedown promise");
});

test("the noindex sentence re-typed onto a delivered page is refused", async () => {
  const b = await delivered();
  const withTail = doctored(
    b,
    "about.html",
    "</footer>",
    "<p>This page is marked noindex, so it does not appear in search results.</p></footer>",
  );
  const problems = furniture(b, b.readme, withTail);
  expect(problems).toContain("on about.html: carries the sentence about being marked noindex");
});

/* ------------------- what a DELIVERED bundle says about itself (9 Oct 2026 defects) */
/**
 * Four defects a paying client would have read on their own site, and the clause that now
 * catches each of them.
 *
 *   1. the hero's offering line said the client's own details were "as published …"
 *      (copy.ts) — true of a proposal, false on the client's own page. The delivered
 *      wording is "recorded for this …", and it keeps the sentence shape
 *      `DETAIL_CLAIM_SHAPES` reads so the class check still covers it;
 *   2. the delivered README's AI-image note told the client to replace the picture
 *      "before this page goes live as anyone's own site" — a step that has already
 *      happened on a delivered site (render.ts);
 *   3. the README glued `forms.ts`'s provider presets — answers, not phrases — into a
 *      sentence: "The form posts to Formspark. yes — a free account … creates the form
 *      id." Both phases now print each preset against the question it answers;
 *   4. the README listed five pages and called `contact.html` "the only page that uses
 *      site.js" while the folder held nine HTML files and five script pages. The list and
 *      the claim are derived from the bundle now, and `readmePageListProblems` refuses a
 *      typed one.
 */
test("the delivered offering line says the details are recorded, not published", async () => {
  // A record whose hero shows the offering line rather than service names: no services.
  const bare = { ...RECORD_FOR_RENDER, services: [] };
  const business = await delivered();
  const deliveredCopy = composeCopy(bare, "example-business", resolveForm(bare), business.ctx.delivery);
  const demoCopy = composeCopy(bare, "example-business", resolveForm(bare), {
    ...business.ctx.delivery,
    mode: "demo",
  } as FormDelivery);
  expect(deliveredCopy.heroLead).toContain("recorded for this barber shop.");
  expect(deliveredCopy.heroLead).not.toContain("as published");
  // The demonstration's twin is untouched: same list, the standing clause only.
  expect(demoCopy.heroLead).toBe(deliveredCopy.heroLead.replace("recorded for this", "as published for this"));
});

test("the delivered offering line is still covered by the detail-claim clause", () => {
  // The doctor: the delivered wording, naming one detail the record does not carry. If the
  // new standing clause had dropped out of `DETAIL_CLAIM_SHAPES`, this page would pass.
  const problems = printedDetailClaimProblems({
    record: {
      name: "Example Barber Shop",
      category: "Barber shop",
      form_recipient: OUR_INBOX,
      form_provider: "formspark",
      form_access_key: "test-form-id",
      source_kind: "public-listings",
      hours: [{ days: "Mon–Fri", hours: "9:00 am – 5:00 pm" }],
      address: { street: "1 Ladybug Lane", city: "Hamilton", province: "ON", postcode: "L8P 2A1" },
      phone: "+1 905-555-0142",
    } as BusinessRecord,
    pages: [
      {
        file: "index.html",
        html: "<p>Hours, address, phone number and email address recorded for this barber shop.</p>",
      },
    ],
  }).join(" | ");
  expect(problems).toContain('names "email address" in the hero\'s offering line');
});

test("the delivered README's page list and its site.js claim come from the bundle", async () => {
  const b = await delivered();
  for (const p of b.pages) expect(`${p.file}: ${b.readme.includes(p.file)}`).toBe(`${p.file}: true`);
  expect(b.readme).toContain(readmeScriptClaim(b.pages));
  expect(b.readme).not.toContain("the only page that uses site.js");
  // The claim is the bundle's own: contact.html plus one page per recorded service.
  expect(scriptedPages(b.pages).map((p) => p.file)).toEqual([
    "contact.html",
    "contact-haircut.html",
    "contact-beard-trim.html",
    "contact-hot-shave.html",
  ]);
  expect(b.readme).not.toContain("links in all five");
  expect(b.readme).toContain("links on every page that points at it");
});

test("the old five-page list, the one-page site.js claim and an invented page are all refused", async () => {
  const b = await delivered();
  const stale = b.readme
    .replace(readmeScriptClaim(b.pages), "contact.html is the only page that uses site.js.")
    .replace(/  contact-haircut\.html[^\n]*\n/, "");
  const problems = readmePageListProblems({ pages: b.pages, readme: stale }).join(" | ");
  expect(problems).toContain('the README does not name "contact-haircut.html"');
  expect(problems).toContain("does not state which pages load site.js");
  const invented = readmePageListProblems({
    pages: b.pages,
    readme: b.readme.replace("  privacy.html", "  contact-wax.html"),
  }).join(" | ");
  expect(invented).toContain('the README names "contact-wax.html" but this bundle ships no such page');
});

test("the delivered README's provider facts read as answers, not as a broken sentence", async () => {
  const b = await delivered();
  // The defect, verbatim, was "The form posts to Formspark. yes — a free account …".
  expect(b.readme).not.toMatch(/posts to Formspark\.\s+(?:yes|no)\b/);
  expect(b.readme).toContain("The form posts to Formspark. Notifications go to");
  expect(b.readme).toContain("  Does it need an account? yes — a free account");
  // The one fact that names a party answers for **this** phase: a client reading
  // their own README is not told what a demonstration page would say (`forms.ts`).
  expect(b.readme).toContain(
    "  Whose account is it? your own account — the form id belongs to it, so you can read, export or delete submissions yourself",
  );
  expect(b.readme).not.toContain("on a demonstration page");
  expect(b.readme).toContain("  Does the form service keep a copy? yes —");
  expect(b.readme).toContain("  What does it cost? free plan:");
});

/* ---------------------- the demonstration's own prose in a client's build (9 Oct 2026) */
/**
 * The leak class the phase gate did not cover.
 *
 * `PROPOSAL_FURNITURE` refuses the *unsolicited-proposal* family on a delivered site —
 * the offer, the noindex marker, the takedown promise. The demonstration's own sentences
 * were a different family, and nothing tested them:
 *
 *   - `MANIFEST_PHASE_REFUSED` has always listed "the demonstration paragraph in the
 *     delivered README", while no code line tested for it — the paragraph on its own
 *     matched no pattern, so the only thing keeping it out of a client's README was the
 *     phase ternary in `renderEditingReadme`;
 *   - "on a demonstration page …" reached a delivered build twice, in the comment above
 *     the form's qualifier line (in every contact page's source) and in the Formspark
 *     provider fact (`forms.ts`) printed in the client's README.
 *
 * Each test below injects the sentence its clause exists to catch and asserts the
 * refusal's own words, so the clauses are shown to fire rather than assumed to.
 */
test("the demonstration paragraph in a delivered README is refused, by name", async () => {
  const b = await delivered();
  const demo = await render({ ...RECORD_FOR_RENDER, form_recipient: OUR_INBOX, form_delivery: "demo", booking_url: "" });
  // Verbatim, from the demonstration's own README: the paragraph at the top, then the
  // contact-form section further down. Both belong to that phase and to no other.
  const problems = furniture(b, `${b.readme}\n${demo.readme}\n`);
  expect(problems).toContain("the delivered README carries the demonstration paragraph");
  expect(problems).toContain("the delivered README carries the demonstration bundle's contact-form paragraph");
  expect(problems).toContain("the delivered README carries the demonstration-page sentence");
});

test("the demonstration-page sentence is refused on a delivered page too", async () => {
  const b = await delivered();
  const injected = doctored(
    b,
    "about.html",
    "</footer>",
    "<p>Nothing is booked here: see the note on a demonstration page.</p></footer>",
  );
  expect(furniture(b, b.readme, injected)).toContain("on about.html: carries the demonstration-page sentence");
});

test("no delivered page or README says anything about a demonstration", async () => {
  const b = await delivered();
  for (const p of b.pages) {
    expect(`${p.file}: ${/on a demonstration page\b/i.test(p.html)}`).toBe(`${p.file}: false`);
    expect(`${p.file}: ${p.html.includes("demonstration")}`).toBe(`${p.file}: false`);
  }
  expect(/demonstration/i.test(b.readme)).toBe(false);
});

test("the demonstration keeps every one of those sentences — it is a derivation, not a deletion", async () => {
  const demo = await render({ ...RECORD_FOR_RENDER, form_recipient: OUR_INBOX, form_delivery: "demo", booking_url: "" });
  expect(demo.ctx.delivery.mode).toBe("demo");
  expect(demo.problems).toEqual([]);
  expect(demo.readme).toContain("DEMONSTRATION — not the business's website");
  expect(demo.readme).toContain("This is a demonstration bundle, not a delivered site.");
  expect(demo.readme).toContain(
    "  Whose account is it? whoever's account holds the form — the form id belongs to it, so they can read, export or delete submissions themselves. In a delivered site that is the client's own account; on a demonstration page it is Site Sourced's",
  );
  expect(page(demo, "contact.html")).toContain("on a demonstration page it says nothing here is booked");
  // The delivered twin of the same comment, which is the reason the comment follows the
  // phase: the demonstration's words above, and the client's words here.
  expect(page(await delivered(), "contact.html")).toContain(
    "on an enquiry page it says the business will get back to you",
  );
  expect(page(await delivered(), "contact.html")).not.toContain("demonstration page it says nothing here is booked");
});

test("the delivered AI-image note has no deadline the finished site cannot meet", async () => {
  const b = await delivered();
  expect(b.readme).toContain("The photograph");
  if (b.readme.includes("AI-generated illustration")) {
    expect(b.readme).not.toContain("before this page goes live as");
    expect(b.readme).toContain("nothing here waits on a photograph before it can go live");
  }
});
