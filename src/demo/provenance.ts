/**
 * Site Sourced — where a record's business details came from, and what a page is
 * therefore allowed to say about them.
 *
 * The plan's rule is that a page may not claim what it does not do, and "where the
 * business's details came from" is one of those claims. It used to be hard-coded in
 * the template: every page credited OpenStreetMap and told the visitor its details came
 * from *public listings*, whatever `record.source` said. On a fixture for a business
 * that never touched OpenStreetMap and was never published anywhere, both sentences
 * were false — and the four-page build would have enshrined them five times over.
 *
 * So the source is now **explicit in the record** (`source_kind`) and everything a page
 * says about it is derived here — the wording is chosen, the record is not:
 *
 *   openstreetmap    real business details pulled from OpenStreetMap via Overpass. The
 *                    page must carry the "© OpenStreetMap contributors" / ODbL credit,
 *                    and the details are published publicly, so the printed caveat that
 *                    pins them to public listings applies unchanged.
 *   public-listings  details read off a listing the business itself published
 *                    (a directory entry, a social page, its own consent-evidence page).
 *                    No mapping data is credited, because none was used.
 *   fictional        a made-up example business, built to prove the engine and to show
 *                    a prospect the layout. Nothing about it was ever published, so the
 *                    page must say the details are invented — crediting OpenStreetMap
 *                    or "public listings" here is exactly the false claim this module
 *                    exists to prevent.
 *
 * A record that declares nothing gets no page: `provenanceProblems` refuses the bundle,
 * because we cannot choose an attribution on the record's behalf and printing none
 * while printing the details would leave them reading as the business's own.
 *
 * The frozen strings are untouched. The banner, the footer disclaimer, the `noindex`
 * meta, the illustration label, the contact-details caveat (for the sources it is true
 * of) and the delivery notice are byte-identical; what changes is **which** of the
 * derived lines applies, and each is asserted by the build and by tests.
 */

import type { BusinessRecord } from "./types.ts";

/**
 * Where a record's business details came from. Explicit, because the attribution and
 * the caveat are derived from it and neither can be guessed.
 */
export type RecordSourceKind = "openstreetmap" | "public-listings" | "fictional";

export const RECORD_SOURCE_KINDS: RecordSourceKind[] = ["openstreetmap", "public-listings", "fictional"];

export function isRecordSourceKind(value: unknown): value is RecordSourceKind {
  return typeof value === "string" && (RECORD_SOURCE_KINDS as string[]).includes(value);
}

/**
 * Wording a page may only carry when the record's details really came from
 * OpenStreetMap. Checked in the build, so the OSM credit cannot survive on a page whose
 * record never touched OSM — that is how the credit ended up on a fictional fixture.
 */
export const OSM_ONLY_FRAGMENTS = ["© OpenStreetMap contributors", "public mapping data"] as const;

/** The frozen contact-details caveat, for sources whose details really are published. */
export function listingsCaveat(businessName: string): string {
  return `The contact details for ${businessName} on this page are as published in public listings — please confirm them with the business before relying on them.`;
}

/**
 * The caveat for a fictional example business, where the frozen line would be a lie:
 * its details appear in no listing anywhere. Same shape and same place on the page as
 * the frozen line, and it claims nothing about deliverability — it asks, instead of
 * asserting, so it cannot be false if a fixture's invented address happens to look
 * real.
 */
export function fictionalCaveat(businessName: string): string {
  return `The contact details for ${businessName} on this page are invented for a fictional example business — this page is a demonstration, not a real business's site, so please do not use them to contact anyone.`;
}

export interface Provenance {
  /** The record's declared source, or `null` when it declares none we recognise. */
  kind: RecordSourceKind | null;
  /** The footer's provenance sentence: what a visitor reads about where the details came from. */
  attribution: string;
  /**
   * The same sentence as HTML for the footer, where the one credit that carries a
   * licence — "ODbL 1.0" for OpenStreetMap — is a link rather than plain text. For the
   * other sources this equals `attribution` (no markup). The footer renders it without
   * `esc()`, so it may only carry our own constant text and the ODbL link — no record
   * field reaches it (the provenance tail no longer names the business).
   */
  attributionHtml: string;
  /** What qualifies the printed contact details. `""` only on a delivered site. */
  caveat: string;
  /** The About paragraph's sentence about where the details came from. */
  aboutLine: string;
  /**
   * Whether a visitor could have read these details somewhere public — true for
   * OpenStreetMap and for a public listing, false for a fictional example business.
   * Page copy that describes the *standing* of the details ("as published for this
   * barber shop", "the details published for X") is written from this, so the class of
   * claim that produced the hard-coded footer cannot survive anywhere else on the page.
   */
  published: boolean;
  /** Plain-English reason for the determination, carried into the bundle manifest. */
  basis: string;
}

/** One page's worth of copy, derived from the record's declared source. */
export function resolveProvenance(record: BusinessRecord): Provenance {
  const kind = isRecordSourceKind(record.source_kind) ? record.source_kind : null;
  const name = record.name;

  // The tail, shared by the two published variants. It states what the page does about
  // search engines (noindex) without asserting that the business has a site of its own
  // (finding 10): a lead with no website must not be told the page competes with a site
  // it lacks. The business name no longer appears in this sentence, so the plain and
  // HTML forms are the same string — nothing in the tail needs escaping any more.
  const TAIL =
    "Copy, layout and imagery: Site Sourced. No logo, photograph or text was taken from any other website. This page is marked noindex, so it does not appear in search results.";

  // The licence text travels as a link to the licence, not as bare words (ruling R12).
  const ODBL_LINK = `<a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL 1.0</a>`;

  switch (kind) {
    case "openstreetmap":
      return {
        kind,
        attribution: `Business details come from public mapping data (© OpenStreetMap contributors, ODbL 1.0). ${TAIL}`,
        attributionHtml: `Business details come from public mapping data (© OpenStreetMap contributors, ${ODBL_LINK}). ${TAIL}`,
        caveat: listingsCaveat(name),
        aboutLine: `Every detail here — hours, address, contact details — came from public listings. Nothing on this page was copied from another website, and anything wrong or missing can be corrected in minutes.`,
        published: true,
        basis: `the record's details came from OpenStreetMap (source_kind "openstreetmap"), so the page credits OpenStreetMap and the ODbL and pins the printed details to public listings`,
      };
    case "public-listings":
      return {
        kind,
        attribution: `Business details come from public listings about this business. ${TAIL}`,
        attributionHtml: `Business details come from public listings about this business. ${TAIL}`,
        caveat: listingsCaveat(name),
        aboutLine: `Every detail here — hours, address, contact details — came from public listings. Nothing on this page was copied from another website, and anything wrong or missing can be corrected in minutes.`,
        published: true,
        basis: `the record's details came from public listings (source_kind "public-listings"), so the page credits public listings and credits no mapping data`,
      };
    case "fictional":
      return {
        kind,
        attribution: `Fictional example business: the name, address, phone number, hours and services on this page were invented by Site Sourced to show the layout, and nothing here was taken from a real business, a public listing or a website. Copy, layout and imagery: Site Sourced. This page is marked noindex.`,
        attributionHtml: `Fictional example business: the name, address, phone number, hours and services on this page were invented by Site Sourced to show the layout, and nothing here was taken from a real business, a public listing or a website. Copy, layout and imagery: Site Sourced. This page is marked noindex.`,
        caveat: fictionalCaveat(name),
        aboutLine: `Every detail here — hours, address, contact details — is invented for this fictional example business. Nothing on this page was copied from another website, and anything wrong or missing can be corrected in minutes.`,
        published: false,
        basis: `the record's source_kind is "fictional", so the page says the business is a made-up example invented by Site Sourced and credits no listing and no mapping data`,
      };
    default:
      return {
        kind: null,
        attribution: "",
        attributionHtml: "",
        caveat: "",
        aboutLine: "",
        published: false,
        basis: `the record declares no source_kind, so no attribution and no caveat can be derived for it`,
      };
  }
}

/**
 * A rendered page reduced to the text a visitor reads: markup tags stripped, then the
 * entities `render.ts`'s `esc()` writes decoded again. The provenance gate compares
 * this text against `Provenance.attribution` (plain text) — never against
 * `attributionHtml`'s link markup, because a pin on `<a href>` would break the next time
 * the link is touched, and never against an escaped form, because an escaped name would
 * never equal its own page text.
 */
export function pageText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * The provenance guard, as sentences a build can print.
 *
 * Called from the single compliance self-check in `build.ts`. Every case below is a
 * bundle that would print something about where its details came from that the record
 * does not support:
 *
 *   - a record that declares no source at all, so no honest attribution can be chosen,
 *   - a `source_kind` that is not one of the three kinds,
 *   - a page that credits OpenStreetMap while the details came from somewhere else,
 *   - a page whose printed details are qualified by a caveat belonging to another
 *     source (the "public listings" line on a fictional business, or the fictional line
 *     on a record whose details really were published),
 *   - a page that has lost the attribution line altogether,
 *   - a fictional example business presented as anyone's own website.
 */
export function provenanceProblems(vars: {
  record: BusinessRecord;
  /** The provenance the bundle's copy was actually composed from. */
  provenance: Provenance;
  pages: { file: string; html: string }[];
  /** The delivery phase — a fictional business can never be anyone's own site. */
  deliveryMode: "business" | "demo";
}): string[] {
  const { record, provenance, pages, deliveryMode } = vars;
  const problems: string[] = [];
  const declared = record.source_kind;

  if (provenance.kind === null) {
    problems.push(
      `the record does not say where its details came from (source_kind is ${declared === undefined ? "missing" : JSON.stringify(declared)}), so no attribution and no contact-details caveat can be derived for its pages. ` +
        `A page may not credit a source the record does not name, and printing unconfirmed details with no caveat is not an option either: set source_kind to one of ${RECORD_SOURCE_KINDS.map((k) => `"${k}"`).join(", ")} and rebuild.`,
    );
  }
  if (provenance.kind === "fictional" && deliveryMode === "business") {
    problems.push(
      `the record is a fictional example business (source_kind "fictional") but the form delivers to it as a client's own site. A made-up business cannot own a website: fix source_kind, or fix form_recipient.`,
    );
  }

  for (const page of pages) {
    const on = `on ${page.file}`;
    const text = pageText(page.html);
    if (provenance.attribution && !text.includes(provenance.attribution)) {
      problems.push(
        `${on}: the footer's provenance line for this record is not present. Every page states where the details came from, and it is derived from source_kind — ` +
          `expected: "${provenance.attribution}"`,
      );
    }
    if (provenance.kind !== "openstreetmap") {
      for (const fragment of OSM_ONLY_FRAGMENTS) {
        if (text.includes(fragment)) {
          problems.push(
            `${on}: credits OpenStreetMap ("${fragment}") although the record's details came from ${provenance.kind ?? "a source it does not name"} (${provenance.basis}). ` +
              `An attribution the record does not support is a false claim: fix source_kind to "openstreetmap", or drop the credit.`,
          );
        }
      }
    }
    const listingsLine = listingsCaveat(record.name);
    const fictionalLine = fictionalCaveat(record.name);
    if (text.includes(fictionalLine) && provenance.kind !== "fictional") {
      problems.push(
        `${on}: says the business is a fictional example although the record's source_kind is ${JSON.stringify(provenance.kind)} — the caveat belongs to the source the record declares.`,
      );
    }
    if (text.includes(listingsLine) && provenance.kind === "fictional") {
      problems.push(
        `${on}: prints the "as published in public listings" caveat although this is a fictional example business (${provenance.basis}). ` +
          `Nothing about it was published in any listing, so the frozen caveat is false here; the fictional caveat is what belongs on the page.`,
      );
    }
  }

  return problems;
}
