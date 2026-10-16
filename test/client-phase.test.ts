#!/usr/bin/env bun
/**
 * **The client phase, on the barbershop.**
 *
 *   bun test test/client-phase.test.ts
 *
 * Owner direction (30 Sept 2026): "Maple Avenue Barber Shop client-mode final development".
 * Until the booking hand-off facts landed (16–17 Oct 2026, `gbp-and-booking-handoff.md` §5.5)
 * the delivered phase could only be reasoned about; `test/records/business-phase.json` and
 * `test/business-phase.test.ts` had closed half of it — a delivered bundle renders, passes
 * every check and carries none of the proposal furniture. What was still missing is the half
 * this file adds:
 *
 *   1. **the barbershop itself, as a client's site.** `test/fixtures/client/` holds the same
 *      business built in the delivered phase: the form delivers to the business's own
 *      published address and the record carries the business's own `booking_url`, so
 *      `delivery.mode` and `booking.mode` both resolve to `business`;
 *   2. **the business's own booking page is the primary action.** It takes the header's
 *      primary-action slot and sits above the form on every contact page, under the label
 *      `Book on {business}'s own booking page` (§5.5 step 5, owner ruling 4 Oct 2026);
 *   3. **the demonstration half is refused, not assumed** — the same record with only its two
 *      phase fields flipped fails the build **by name**, on the booking rule that keeps a
 *      prospect's booking page out of a proposal (`bookingProblems` clause 1, §5.3 rule 1);
 *   4. **every check above is shown able to fail**, by injecting the thing it refuses.
 *
 * One honest limit, stated where it bites rather than in a report nobody reading this file
 * sees: **the phone label has no build check behind it.** A delivered site prints
 * `Phone:` and a fictional demonstration prints `Phone (example):`, both derived in
 * `resolvePhone` (`addresses.ts`) — but nothing in `complianceChecks` reads the label a page
 * printed, so the assertion below is guarded by this test alone. It was proved able to fail
 * by mutating `resolvePhone`'s business branch and watching it go red (the run is recorded in
 * `/home/team/shared/client-phase-proof-2026-10-17.md` §5).
 *
 * Nothing here publishes, stages or sends anything; the only files written are inside a
 * temporary directory the test removes, and no image is fetched (the hero comes from the
 * fixture directory's symlinks in `test/fixtures/images/`).
 */
import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  bookingProblems,
  buildBundle,
  complianceChecks,
  internalRecordProblems,
  phaseFurnitureProblems,
  readBundleTexts,
  resolveBuildParts,
} from "../src/demo/build.ts";
import {
  BOOKING_LABEL_DEMO,
  bookingLabelBusiness,
  bookingNoticeDemo,
  composePrivacy,
  profileFor,
} from "../src/demo/copy.ts";
import { provenanceProblems, type Provenance } from "../src/demo/provenance.ts";
import { inspectSuppliedImage, manifestForSupplied } from "../src/demo/supplied.ts";
import {
  esc,
  renderCss,
  renderEditingReadme,
  renderJs,
  renderPages,
  type RenderContext,
  type RenderedPage,
} from "../src/demo/render.ts";
import type { BusinessRecord, ManifestImage } from "../src/demo/types.ts";

/** The client-phase fixture: the barbershop, built as a delivered site. Never published. */
const RECORD_DIR = join(import.meta.dir, "fixtures", "client");
const RECORD_PATH = join(RECORD_DIR, "maple-avenue-barber-shop.json");
const RECORD = JSON.parse(await Bun.file(RECORD_PATH).text()) as BusinessRecord;

/**
 * The record as this file renders it: the form id is a per-client value living in the
 * gitignored `.env.local`, so the record keeps the `env:` reference and the test supplies
 * its own — a test must not need a secret to run, and nothing here asserts anything about it.
 */
const RECORD_FOR_RENDER: BusinessRecord = { ...RECORD, form_access_key: "test-form-id" };

/** Site Sourced's own test inbox — the address that makes the same record a *demonstration*. */
const OUR_INBOX = "site-sourced-311e0184@ctomail.io";

const NAME = RECORD.name;
const BOOKING_URL = "https://book.maple-avenue-barber-client-fixture.ca/";
const BUSINESS_LABEL = bookingLabelBusiness(NAME);

/** Every file a delivered bundle of this record ships: nine pages, and the site beside them. */
const CLIENT_FILES = [
  "README.txt",
  "about.html",
  "contact-beard-trim.html",
  "contact-haircut.html",
  "contact-hot-shave.html",
  "contact-kids-cut.html",
  "contact.html",
  "favicon.svg",
  "fonts/OFL.txt",
  "fonts/fraunces-latin-600.woff2",
  "fonts/source-sans-3-latin.woff2",
  "images/barber-hero-1200.jpg",
  "images/barber-hero-1536.jpg",
  "images/barber-hero-600.jpg",
  "images/barber-hero-900.jpg",
  "index.html",
  "privacy.html",
  "services.html",
  "site.js",
  "styles.css",
];

/** The pages that carry the header's primary-action slot (`headerActionBelongs`). */
const HEADER_ACTION_FILES = ["index.html", "services.html", "about.html"];

/** The five contact pages, which are the pages a booking link belongs on (`bookingBelongs`). */
const CONTACT_FILES = CLIENT_FILES.filter((f) => f === "contact.html" || f.startsWith("contact-"));

interface Bundle {
  record: BusinessRecord;
  ctx: RenderContext;
  pages: RenderedPage[];
  readme: string;
  /** What `complianceChecks` says about the whole bundle, README included. */
  problems: string[];
}

/** Render a record exactly the way `buildBundle` does, and self-check the result. */
async function render(record: BusinessRecord): Promise<Bundle> {
  const slug = record.slug ?? "client-phase-fixture";
  const profile = profileFor(record);
  const { form: form, delivery: delivery, copy: copy } = resolveBuildParts(record, slug);
  const privacy = composePrivacy(record, form, delivery);
  const images: ManifestImage[] = [];
  for (const image of record.images ?? []) {
    const inspected = await inspectSuppliedImage(image, RECORD_DIR);
    images.push(manifestForSupplied(image, inspected.variants));
  }
  const ctx: RenderContext = {
    record,
    profile,
    copy,
    form,
    delivery,
    privacy,
    images,
    slug,
    generatedAt: "2026-10-17T00:00:00.000Z",
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
/** The client bundle, rendered once for the whole file. */
const client = (): Promise<Bundle> => (cached ??= render(RECORD_FOR_RENDER));

const page = (b: Bundle, file: string): string => b.pages.find((p) => p.file === file)!.html;

/** One page's html, with a piece replaced or injected — what a visitor would receive. */
const doctored = (b: Bundle, file: string, from: string, to: string): RenderedPage[] =>
  b.pages.map((p) => (p.file === file ? { ...p, html: p.html.replace(from, to) } : p));

/** The phase-furniture clause's refusal messages for doctored pages. */
const furniture = (b: Bundle, pages: RenderedPage[], readme = b.readme): string =>
  phaseFurnitureProblems({ pages, record: b.record, copy: b.ctx.copy, delivery: b.ctx.delivery, readme }).join(" | ");

/** The provenance clause's refusal messages for doctored pages. */
const sourcing = (b: Bundle, pages: RenderedPage[], readme = b.readme): string =>
  provenanceProblems({
    record: b.record,
    provenance: b.ctx.copy.provenance as Provenance,
    pages,
    deliveryMode: b.ctx.delivery.mode,
    readme,
  }).join(" | ");

/** A folder the test owns, removed whatever the test does. */
async function temp<T>(body: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "client-phase-"));
  try {
    return await body(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/* -------------------------------------------------------- the phase, as the build resolves it */

test("the barbershop record really is the client phase, and the whole bundle passes every check", async () => {
  const b = await client();
  expect(b.ctx.delivery.mode).toBe("business");
  expect(b.ctx.copy.booking.mode).toBe("business");
  expect(b.ctx.copy.booking.label).toBe(BUSINESS_LABEL);
  expect(b.ctx.copy.booking.href).toBe(BOOKING_URL);
  expect(b.ctx.copy.provenance.kind).toBe("public-listings");
  expect(b.ctx.delivery.party).toBe(NAME);
  // The record asserts the phase it resolved to — `form_delivery` is an assertion, not a switch.
  expect(RECORD.form_delivery).toBe("business");
  expect(RECORD.form_recipient).toBe(RECORD.email);
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
    "contact-kids-cut.html",
  ]);
  // `complianceChecks` is the whole published gate, run on the rendered bundle.
  expect(b.problems).toEqual([]);
});

test("the delivered bundle is the site and the client's README, with no record of ours", async () => {
  await temp(async (tmp) => {
    const built = await buildBundle(RECORD_FOR_RENDER, {
      outRoot: tmp,
      cacheDir: join(tmp, "cache"),
      recordDir: RECORD_DIR,
      noImages: false,
      refresh: false,
      onNote: () => {},
    });
    expect(built.files).toEqual(CLIENT_FILES);
    expect(built.files.length).toBe(20);
    expect(built.files.includes("manifest.json")).toBe(false);
    expect(existsSync(join(built.dir, "manifest.json"))).toBe(false);
    // …and the folder, read back as the build reads it, carries nothing written for us.
    const carried = await readBundleTexts(built.dir);
    expect(internalRecordProblems({ mode: "business", carried })).toEqual([]);
  });
});

/* ------------------------------------------- the furniture the demonstration phase requires */

test("no page of the client bundle carries the proposal banner, the disclaimer, the takedown line or noindex", async () => {
  const b = await client();
  const forbidden = [
    "proposal-banner",
    "unsolicited",
    "not affiliated with, endorsed by, or operated by",
    'name="robots"',
    "noindex",
    "marked noindex",
    "take it down",
    "it comes down",
    "DEMONSTRATION",
  ];
  for (const p of b.pages) {
    for (const phrase of forbidden) {
      expect(`${p.file}: ${p.html.includes(phrase) ? "carries" : "clean"} ${phrase}`).toBe(`${p.file}: clean ${phrase}`);
    }
  }
});

test("the README that ships with a client's site is the client's own instruction sheet", async () => {
  const b = await client();
  expect(b.readme).toContain(`${NAME} — your website files`);
  expect(b.readme).toContain("Built by Site Sourced");
  for (const phrase of ["DEMONSTRATION", "unsolicited", "noindex", "public listings", "take it down"]) {
    expect(`${phrase}: ${b.readme.includes(phrase) ? "present" : "absent"}`).toBe(`${phrase}: absent`);
  }
});

/* ------------------------------------------------- the business's own booking page, as built */

test("the header's primary-action slot carries the client's booking page under the business label", async () => {
  const b = await client();
  const html = page(b, "index.html");
  const expected = `<a class="call-button header-action" href="${BOOKING_URL}">${esc(BUSINESS_LABEL)}</a>`;
  expect(html).toContain(expected);
  const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
  expect(header).toContain(expected);
  // …and it is the business's own page, quoted exactly: not our demonstration schedule, and
  // never the plain `Book a demonstration time` label.
  expect(header).not.toContain(BOOKING_LABEL_DEMO);
  expect(header).not.toContain("example.com");
});

test("every contact page carries the booking block once, directly above the form", async () => {
  const b = await client();
  expect(CONTACT_FILES.length).toBe(5);
  for (const file of CONTACT_FILES) {
    const html = page(b, file);
    const anchor = `<a class="link-quiet link-quiet--inline" href="${BOOKING_URL}" target="_blank" rel="noopener noreferrer">`;
    expect(`${file}: ${html.split(anchor).length - 1}`).toBe(`${file}: 1`);
    expect(`${file}: ${html.includes(`<p class="booking">`)}`).toBe(`${file}: true`);
    expect(`${file}: ${html.indexOf(anchor) < html.indexOf("<form ")}`).toBe(`${file}: true`);
  }
  // Every other page carries it exactly once, and only in the header's primary-action slot:
  // the client's own site has nothing to hide from the tap, so the slot is the client's
  // booking page on every page (ruling of 8 Oct, `bookingBelongs`'s business half).
  // The pages that carry the header's primary-action slot — index, services, about — take the
  // client's own booking page in it, and nowhere else on the page.
  for (const file of HEADER_ACTION_FILES) {
    const html = page(b, file);
    expect(`${file}: ${html.split(BOOKING_URL).length - 1}`).toBe(`${file}: 1`);
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(`${file}: in-header=${header.includes(BOOKING_URL)}`).toBe(`${file}: in-header=true`);
    expect(`${file}: below-header=${html.slice(html.indexOf("</header>")).includes(BOOKING_URL)}`).toBe(`${file}: below-header=false`);
  }
  // No other page carries it at all.
  for (const p of b.pages) {
    if (CONTACT_FILES.includes(p.file) || HEADER_ACTION_FILES.includes(p.file)) continue;
    expect(`${p.file}: ${p.html.includes(BOOKING_URL) ? "carries" : "clean"}`).toBe(`${p.file}: clean`);
  }
});

test("no page, and not the README, carries a demonstration notice or the demonstration label", async () => {
  const b = await client();
  const notice = bookingNoticeDemo(NAME);
  for (const p of b.pages) {
    expect(`${p.file}: notice=${p.html.includes(esc(notice))}`).toBe(`${p.file}: notice=false`);
    expect(`${p.file}: label=${p.html.includes(BOOKING_LABEL_DEMO)}`).toBe(`${p.file}: label=false`);
    expect(`${p.file}: 'booked there'=${/booked there/i.test(p.html)}`).toBe(`${p.file}: 'booked there'=false`);
  }
  expect(b.readme.includes(BOOKING_LABEL_DEMO)).toBe(false);
  expect(b.readme.includes(notice)).toBe(false);
});

/* --------------------------------------------------- the phone, the privacy notice, the form */

test("the client's phone prints as the client's own, never as an example", async () => {
  const b = await client();
  const number = RECORD.phone!;
  for (const p of b.pages) {
    // The number itself, in the client's own label. `resolvePhone` returns mode `client`
    // with the label `Phone:` whenever the phase is `business`, whatever the record's source.
    if (p.html.includes(number) || p.html.includes("555-0142")) {
      expect(`${p.file}: ${p.html.includes(number) ? "prints" : "missing"} the number`).toBe(`${p.file}: prints the number`);
    }
    expect(`${p.file}: example-label=${p.html.includes("Phone (example):")}`).toBe(`${p.file}: example-label=false`);
  }
  const html = page(b, "index.html");
  expect(html).toContain(number);
  expect(html).toContain(`Phone:`);
  // The label the demo fixture carries instead, for contrast (fictional record, demo phase).
  expect(html).not.toContain("Phone (example):");
});

test("the privacy notice is the client's variant, not the demonstration's", async () => {
  const b = await client();
  const html = page(b, "privacy.html");
  expect(html).toContain(`This is ${NAME}&#39;s own website`);
  expect(html).toContain("the message comes straight to");
  expect(html).not.toContain("has not seen this page");
  expect(html).not.toContain("unsolicited design proposal");
});

test("the form-delivery sentence tells the visitor the message goes to the business", async () => {
  const b = await client();
  for (const file of CONTACT_FILES) {
    const html = page(b, file);
    expect(`${file}: ${html.includes(`<p class="form-notice">This form sends your message to ${NAME} through Formspark`)}`).toBe(
      `${file}: true`,
    );
    expect(`${file}: ${html.includes("sends your message to Site Sourced")}`).toBe(`${file}: false`);
    expect(`${file}: ${html.includes("will not receive your message")}`).toBe(`${file}: false`);
  }
});

/* ------------------------------------------- the demonstration half, refused by name (item 4) */

/**
 * The same record, in the demonstration phase: **only** the two phase fields move. Everything
 * else — the barbershop's own content, and its own `booking_url` — is the client fixture's
 * byte for byte.
 */
const DEMO_TWIN: BusinessRecord = { ...RECORD_FOR_RENDER, form_recipient: OUR_INBOX, form_delivery: "demo" };

test("the same record in the demonstration phase is refused, by name, for its business booking link", async () => {
  expect(DEMO_TWIN.booking_url).toBe(RECORD.booking_url);
  await temp(async (tmp) => {
    const failure = await buildBundle(DEMO_TWIN, {
      outRoot: tmp,
      cacheDir: join(tmp, "cache"),
      recordDir: RECORD_DIR,
      noImages: false,
      refresh: false,
      onNote: () => {},
    }).then(
      () => "",
      (err: Error) => err.message,
    );
    expect(failure).toContain("this bundle is in the demonstration phase but its booking link points at a business's own booking page");
    expect(failure).toContain(BOOKING_URL);
    expect(failure).toContain("gbp §5.3 rule 1");
    // The refusal is a build failure, and the bundle is not left behind.
    expect(existsSync(join(tmp, "maple-avenue-barber-shop", "index.html"))).toBe(false);
  });
});

test("the booking rule fires at the check itself, in both phases", async () => {
  const b = await client();
  const common = { pages: b.pages, record: b.record, booking: b.ctx.copy.booking };
  // Phase `demo` with a business booking link — the half that was never exercised by a bundle.
  expect(
    bookingProblems({ ...common, phase: "demo", contactLabel: b.ctx.copy.contactLabel.label }).join(" | "),
  ).toContain("this bundle is in the demonstration phase but its booking link points at a business's own booking page");
  // Phase `business` with the demonstration link — the other direction of the same rule.
  const demoBooking = { ...b.ctx.copy.booking, mode: "demo" as const, href: "https://example.com/demonstration-appointment" };
  expect(
    bookingProblems({ ...common, booking: demoBooking, phase: "business", contactLabel: b.ctx.copy.contactLabel.label }).join(" | "),
  ).toContain("this bundle is a client's own site but its booking link points at our demonstration page");
});

/* --------------------------------------------------- can every check above actually go red */

test("the demonstration furniture is refused on this bundle's own pages, by name", async () => {
  const b = await client();
  const cases: [string, RenderedPage[], string][] = [
    [
      "the proposal banner",
      doctored(b, "index.html", "</body>", '<div class="proposal-banner" role="note"><p>This is an unsolicited design proposal from Site Sourced.</p></div></body>'),
      "on index.html: carries the proposal banner element",
    ],
    [
      "the noindex marker",
      doctored(b, "index.html", "</head>", '<meta name="robots" content="noindex, nofollow"></head>'),
      "on index.html: carries a noindex marker",
    ],
    [
      "the takedown promise",
      doctored(b, "index.html", "</body>", "<p>Ask and we will take it down.</p></body>"),
      "on index.html: carries the takedown promise",
    ],
    [
      "the demonstration form-delivery notice",
      doctored(b, "contact.html", '<p class="form-notice">', '<p class="form-notice">This is a demonstration site: '),
      "on contact.html: carries the demonstration form-delivery notice",
    ],
  ];
  for (const [what, pages, expected] of cases) {
    expect(`${what}: ${furniture(b, pages)}`).toContain(expected);
  }
  // The README half of the same rule, and the demonstration's own sourcing sentences.
  expect(furniture(b, b.pages, `${b.readme}\nDEMONSTRATION — not the business's website\n`)).toContain(
    "the delivered README carries the demonstration paragraph",
  );
  expect(sourcing(b, doctored(b, "services.html", "</body>", "<p>Business details come from public listings about this business.</p></body>"))).toContain(
    "although this bundle is a delivered site",
  );
  expect(furniture(b, doctored(b, "services.html", "</body>", "<p>This page is marked noindex.</p></body>"))).toContain(
    "on services.html: carries the sentence about being marked noindex",
  );
});

test("a record file left in a client's folder, and a mislabelled booking link, are refused", async () => {
  // The build's own record, in the folder a client receives.
  expect(
    internalRecordProblems({
      mode: "business",
      carried: [{ file: "manifest.json", contents: '{\n  "generator": "sitesourced-demo-generator/0.1"\n}\n' }],
    }).join(" | "),
  ).toContain("manifest.json: carries the build's own record");

  // The demonstration label on the client's own booking link.
  const b = await client();
  const swapped = doctored(b, "contact.html", esc(BUSINESS_LABEL), BOOKING_LABEL_DEMO);
  expect(
    bookingProblems({ pages: swapped, record: b.record, booking: b.ctx.copy.booking, phase: "business", contactLabel: b.ctx.copy.contactLabel.label }).join(" | "),
  ).toContain("the booking link reads");

  // The demonstration schedule under the business's name.
  const wrongUrl = doctored(b, "contact.html", BOOKING_URL, "https://example.com/demonstration-appointment");
  expect(
    bookingProblems({ pages: wrongUrl, record: b.record, booking: b.ctx.copy.booking, phase: "business", contactLabel: b.ctx.copy.contactLabel.label }).join(" | "),
  ).toContain("the booking link points at");
});
