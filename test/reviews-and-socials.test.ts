/**
 * Two answers that had nowhere to live, and that must stay records rather than links:
 * the business's own Google page (intake question 19, `reviews_url`) and the accounts the
 * client keeps up to date (question 20, `socials[]`).
 *
 * The rules, as `reviewsUrlProblems` and `socialsProblems` state them:
 *
 *   1. the shape — `reviews_url` one absolute `https` URL, `socials` a list of
 *      `{ network, url }` entries whose `url` is one absolute `https` URL;
 *   2. no page presents the address, as a link or as a booking or contact action;
 *   3. neither is ever the booking action, in the record or in the build that resolved it.
 *
 * The decoys matter as much as the refusals: a page whose address block links to Google Maps
 * must not be refused for carrying a reviews address on the same host.
 */
import { expect, test } from "bun:test";
import { reviewsUrlProblems, socialsProblems } from "../src/demo/build.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

const BASE: BusinessRecord = {
  name: "Example Barber Shop",
  category: "Barber shop",
  form_recipient: "site-sourced-311e0184@ctomail.io",
  source_kind: "public-listings",
};
const record = (over: Partial<BusinessRecord> = {}): BusinessRecord => ({ ...BASE, ...over });

const page = (html: string, file = "contact.html") => ({ file, html });
const reviews = (rec: BusinessRecord, pages: { file: string; html: string }[] = [], bookingUrl = "") =>
  reviewsUrlProblems({ record: rec, pages, bookingUrl });
const socials = (rec: BusinessRecord, pages: { file: string; html: string }[] = [], bookingUrl = "") =>
  socialsProblems({ record: rec, pages, bookingUrl });

const GOOGLE = "https://www.google.com/maps/place/Example+Barber+Shop";
const FACEBOOK = "https://www.facebook.com/example-barber";

/* =========================================================== reviews_url: absent, blank, well-formed */
test("reviews_url: no value, and a blank value, are both 'no Google page recorded'", () => {
  expect(reviews(record())).toEqual([]);
  expect(reviews(record({ reviews_url: "" }))).toEqual([]);
  expect(reviews(record({ reviews_url: "   " }))).toEqual([]);
});

test("reviews_url: one absolute https URL passes, and changes nothing on the page", () => {
  expect(reviews(record({ reviews_url: GOOGLE }), [page(`<p>Call us on +1 905-555-0142.</p>`)])).toEqual([]);
});

/* ==================================================================== reviews_url: the value's shape */
test("reviews_url: anything but one absolute https URL is refused, and says why", () => {
  for (const bad of ["www.google.com/maps/place/x", "http://www.google.com/maps/place/x", "mailto:shop@example.com", "https://", "https://two words.example.com"]) {
    const out = reviews(record({ reviews_url: bad }));
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("reviews_url");
    expect(out[0]).toContain("is not an absolute https URL");
    expect(out[0]).toContain(bad);
  }
});

test("reviews_url: a value that is not a string at all is refused rather than coerced", () => {
  const out = reviews({ ...BASE, reviews_url: 42 as unknown as string });
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("reviews_url is not a string");
});

/* =========================================================== reviews_url: never printed, never a booking */
test("reviews_url: a page that presents it as a link is refused, by file", () => {
  const out = reviews(record({ reviews_url: GOOGLE }), [
    page(`<p><a class="button" href="${GOOGLE}">See this business on Google</a></p>`),
  ]);
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("contact.html: prints the record's reviews_url");
  expect(out[0]).toContain("stored and never printed");
});

test("reviews_url: the same address without its scheme is refused too — printing it by name is the same act", () => {
  const out = reviews(record({ reviews_url: GOOGLE }), [
    page(`<p>Find our page at www.google.com/maps/place/Example+Barber+Shop</p>`, "about.html"),
  ]);
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("about.html: prints the record's reviews_url");
});

test("reviews_url: a booking link that points at it is refused: a reviews page does not book a time", () => {
  const out = reviews(record({ reviews_url: GOOGLE, booking_url: GOOGLE }));
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("booking_url is its reviews_url");
  const slash = reviews(record({ reviews_url: `${GOOGLE}/`, booking_url: GOOGLE }));
  expect(slash).toHaveLength(1);
  expect(slash[0]).toContain("booking_url is its reviews_url");
});

test("reviews_url: a build whose resolved booking link is the reviews page is refused the same way", () => {
  const out = reviews(record({ reviews_url: GOOGLE }), [], `${GOOGLE}/`);
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("this build's booking link points at the record's reviews_url");
});

/* =================================================================================== reviews_url: decoys */
test("reviews_url: the address block's own Google Maps link is not refused for sharing the host", () => {
  const maps = `<a href="https://www.google.com/maps/search/?api=1&amp;query=123+Ladybug+Lane">123 Ladybug Lane</a>`;
  expect(reviews(record({ reviews_url: GOOGLE }), [page(maps)])).toEqual([]);
  // A record that gives only the host has no page of its own, and its address is a prefix of
  // every link beneath that host — so it is refused wherever the site links there, which is
  // the conservative half of the same rule, stated in `printedFormsOf`.
  const rootOnly = reviews(record({ reviews_url: "https://www.google.com/" }), [page(maps)]);
  expect(rootOnly).toHaveLength(1);
  expect(rootOnly[0]).toContain("prints the record's reviews_url");
});

test("reviews_url: an unrelated link on the page is not refused", () => {
  const rec = record({ reviews_url: GOOGLE, booking_url: "https://calendar.example.com/example-barber" });
  expect(reviews(rec, [page(`<a href="https://calendar.example.com/example-barber">Book a time ↗</a>`)])).toEqual([]);
});

/* ============================================================ socials: absent, empty, well-formed */
test("socials: no value, an empty list, and well-formed entries all pass", () => {
  expect(socials(record())).toEqual([]);
  expect(socials(record({ socials: [] }))).toEqual([]);
  expect(
    socials(
      record({
        socials: [
          { network: "Facebook", url: FACEBOOK },
          { network: "Instagram", url: "https://www.instagram.com/example-barber" },
        ],
      }),
      [page(`<p>Call us on +1 905-555-0142.</p>`)],
    ),
  ).toEqual([]);
});

/* ======================================================================== socials: the value's shape */
test("socials: anything but a list is refused", () => {
  for (const bad of [{ network: "Facebook", url: FACEBOOK }, FACEBOOK, 7] as unknown as BusinessRecord["socials"][]) {
    const out = socials(record({ socials: bad }));
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("socials is not a list");
  }
});

test("socials: an entry that is not an object is refused — a bare address is not an account we can name", () => {
  const out = socials(record({ socials: [FACEBOOK as unknown as { network: string; url: string }] }));
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("socials[0] is not an entry");
  expect(out[0]).toContain(FACEBOOK);
});

test("socials: an entry with no network name is refused, and names its index", () => {
  const out = socials(
    record({ socials: [{ url: FACEBOOK }, { network: "   ", url: FACEBOOK }] as unknown as BusinessRecord["socials"] }),
  );
  expect(out).toHaveLength(2);
  expect(out[0]).toContain("socials[0] has no network name");
  expect(out[1]).toContain("socials[1] has no network name");
});

test("socials: an entry with no address, and one whose address is not a string, are both refused", () => {
  const missing = socials(record({ socials: [{ network: "Facebook" }] as unknown as BusinessRecord["socials"] }));
  expect(missing).toHaveLength(1);
  expect(missing[0]).toContain("socials[0].url is not a string");

  const blank = socials(record({ socials: [{ network: "Facebook", url: "  " }] }));
  expect(blank).toHaveLength(1);
  expect(blank[0]).toContain("socials[0].url is blank");
  expect(blank[0]).toContain("a link to nothing");
});

test("socials: an address that is not one absolute https URL is refused, by index", () => {
  const out = socials(
    record({
      socials: [
        { network: "Facebook", url: FACEBOOK },
        { network: "Instagram", url: "instagram.com/example-barber" },
      ],
    }),
  );
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("socials[1].url");
  expect(out[0]).toContain("is not an absolute https URL");
});

/* =================================================== socials: never printed, never a booking action */
test("socials: a page that presents one of the accounts is refused, by file and by index", () => {
  const out = socials(
    record({
      socials: [
        { network: "Facebook", url: FACEBOOK },
        { network: "Instagram", url: "https://www.instagram.com/example-barber" },
      ],
    }),
    [page(`<p>Follow us at https://www.instagram.com/example-barber</p>`, "about.html")],
  );
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("about.html: prints the record's socials[1].url");
  expect(out[0]).toContain("stored and never printed");
});

test("socials: a page that links to an account without its scheme is refused the same way", () => {
  const out = socials(record({ socials: [{ network: "Facebook", url: FACEBOOK }] }), [
    page(`<a href="${FACEBOOK}">Facebook</a>`),
  ]);
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("contact.html: prints the record's socials[0].url");
});

test("socials: a booking link that points at an account is refused: an account does not book a time", () => {
  const out = socials(record({ socials: [{ network: "Facebook", url: FACEBOOK }], booking_url: `${FACEBOOK}/` }));
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("booking_url is its socials[0].url");
});

test("socials: a build whose resolved booking link is an account is refused the same way", () => {
  const out = socials(record({ socials: [{ network: "Facebook", url: FACEBOOK }] }), [], FACEBOOK);
  expect(out).toHaveLength(1);
  expect(out[0]).toContain("this build's booking link points at the record's socials[0].url");
});

/* =================================================================================== socials: decoys */
test("socials: a page naming the network in its own words is not refused — the address is what is refused", () => {
  expect(
    socials(record({ socials: [{ network: "Facebook", url: FACEBOOK }] }), [
      page(`<p>We answer messages on Facebook.</p>`),
    ]),
  ).toEqual([]);
});
