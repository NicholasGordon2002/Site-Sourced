/**
 * Site Sourced — demo generator types.
 *
 * A record is the only input: everything on the generated page comes from it.
 * Nothing is invented, and nothing is ever fetched from the business's own site.
 */

import type { RecordSourceKind } from "./provenance.ts";
import type { ConversionFamily } from "./family.ts";

/**
 * `business` — the form delivers to the business's own published address.
 * `demo` — it delivers anywhere else, so the page must say it is a demonstration.
 */
export type FormDeliveryClaim = "business" | "demo";

/** One opening-hours row, already in plain English ("Mon–Fri", "9:00 am – 6:00 pm"). */
export interface HoursRow {
  days: string;
  hours: string;
}

/** One service or treatment offered. `note` is optional and always the client's own words. */
export interface ServiceItem {
  name: string;
  note: string;
}

/** Where the business is. `street` may be empty — OSM often has no address. */
export interface RecordAddress {
  street: string;
  city: string;
  province: string;
  postcode: string;
}

/**
 * One responsive size of an image, as it sits inside the bundle: the file, and the
 * width in pixels that the `srcset` descriptor needs. A bundle that carries
 * `hero-600.jpg … hero-1536.jpg` lets a phone download the small one; a bundle with
 * no variants lists none and the page falls back to a single candidate.
 *
 * The width is the file's real pixel width, and `build.ts` re-measures every file
 * before it renders: a record whose stated width disagrees with the file fails the
 * build rather than putting a wrong descriptor in the `srcset`.
 */
export interface ImageVariant {
  /** Path inside the bundle, e.g. `images/hero-600.jpg`. */
  file: string;
  /** The file's real pixel width. */
  width: number;
}

/** An image supplied by hand (CC0/PD file we already hold, or a labelled AI fallback). */
export interface ImageOverride {
  role: "hero" | "about";
  /**
   * Absolute or repo-relative path to a local file. Copied into the bundle.
   *
   * Optional when `variants` is given: the widest variant becomes the page's `src`.
   * One of the two must be present.
   */
  file?: string;
  /** Exact licence wording. Must be CC0/public domain, or start with "AI-generated". */
  license: string;
  source_url: string;
  author: string;
  /**
   * The same picture at several widths, prepared with `tools/prepare-images.py`.
   * Listed narrowest first is conventional; the build sorts them by measured width
   * and the widest becomes the page's `src` and its `width`/`height` attributes.
   */
  variants?: ImageVariant[];
}

/**
 * The business record. Field names are deliberately plain so the JSON is readable
 * by a human editing it by hand.
 */
export interface BusinessRecord {
  /** Directory name under `out/demos/`. Derived from `name` when absent. */
  slug?: string;
  name: string;
  /** e.g. "Barber shop", "Landscaping", "Dental clinic". */
  category: string;
  /** Optional human grouping from the lead engine, e.g. "Salons & barbers". */
  category_group?: string;
  /**
   * Which of the two conversion families the page is built for. **Optional, and not a
   * switch**: when the record leaves it out the family is derived from `category` /
   * `category_group` by the classification table in `family.ts`, and either way the rule
   * that decided it is recorded in the manifest (`conversion.basis`). A value that is
   * neither `"appointment"` nor `"inquiry"` fails the build.
   */
  conversion_family?: ConversionFamily;
  /**
   * The business's own booking page, when one was recorded. The family honesty guard
   * reads it today: with a booking page in the record, "book" is a true word about a link
   * that really books, and without one the word is refused on an appointment page
   * (`family.ts`). Rendering it — the booking row, its derived notice and the three
   * modes (`none`/`demo`/`business`) — is the booking-link session's work; nothing here
   * invents a URL, and a record that carries none prints none.
   */
  booking_url?: string;
  address?: Partial<RecordAddress>;
  phone?: string;
  email?: string;
  /** Either pre-formatted rows, or the raw OSM `opening_hours` string. */
  hours?: HoursRow[] | string;
  services?: (string | ServiceItem)[];
  /** Any extra facts we hold and may print (never used to invent anything). */
  notes?: string;
  /** Where the contact form delivers. Required for a usable form. */
  form_recipient: string;
  /**
   * What this record asserts about the form's delivery. Optional, and **not a
   * switch**: the page's notice is derived by comparing `form_recipient` with
   * `email`, which is the business's own published address (see delivery.ts).
   * When present this must agree with that derivation or the build fails, so a
   * record cannot claim business delivery while routing somewhere else.
   */
  form_delivery?: FormDeliveryClaim;
  /** Provider preset name — see src/demo/forms.ts (`web3forms`, `formspark`, ...). */
  form_provider?: string;
  /** Provider access key / form id. `env:NAME` reads the value from the environment. */
  form_access_key?: string;
  /** Escape hatch for self-hosted or test relays: overrides the preset endpoint. */
  form_endpoint?: string;
  /** Hand-supplied imagery. When absent the generator sources CC0/PD images itself. */
  images?: ImageOverride[];
  /**
   * **What the page's provenance line and contact-details caveat are derived from, and
   * therefore required.** One of `openstreetmap`, `public-listings`, `fictional` — see
   * `provenance.ts` for what each one lets a page say. A record whose page prints the
   * business's details without declaring this cannot be built: no attribution can be
   * chosen on the record's behalf, and an attribution the record does not support is a
   * false claim.
   */
  source_kind?: RecordSourceKind;
  /** Kept out of the page; carried into the manifest for our own records. */
  source?: string;
}

/** A record loaded from disk, with the file it came from. */
export interface LoadedRecord {
  path: string;
  record: BusinessRecord;
}

/** One image that ended up inside the bundle (or a recorded fallback with no file). */
export interface ManifestImage {
  role: "hero" | "about";
  /** Path inside the bundle, `null` when we fell back to a CSS/SVG treatment. */
  file: string | null;
  /** Where it came from, e.g. "Wikimedia Commons", "css-gradient-fallback". */
  source: string;
  source_url: string;
  license: string;
  license_url?: string;
  author: string;
  retrieved_at: string;
  width?: number;
  height?: number;
  /** Responsive sizes inside the bundle, when they exist. See ImageVariant. */
  variants?: ImageVariant[];
  notes?: string;
}

/** The bundle manifest: our own audit trail, and the hand-over answer sheet. */
export interface DemoManifest {
  generator: string;
  generated_at: string;
  slug: string;
  business: {
    name: string;
    category: string;
    city: string;
    phone_printed: boolean;
    email_printed: boolean;
    source: string;
    /**
     * Where the page says its details came from — the record's declared `source_kind`,
     * the exact provenance line derived from it, and the plain-English reason. `null`
     * means the record declared nothing, which fails the build rather than publishing.
     */
    source_kind: RecordSourceKind | null;
    provenance_line: string;
    provenance_basis: string;
  };
  files: string[];
  images: ManifestImage[];
  /**
   * Which conversion family this bundle is for, how that was worked out, and the primary
   * contact label it carries with its own basis. Both are derived from the record — the
   * family from the classification table or the record's override, the label from where
   * the record came from — so a reviewer reads the result and the reason together instead
   * of inferring either from the page.
   */
  conversion: {
    family: ConversionFamily;
    /** "record override" when the record names the family, "category table" otherwise. */
    source: "record override" | "category table";
    /** The rule that fired, in plain English. */
    basis: string;
    /** The category profile the record's words selected, and the word that did it. */
    category_profile: string;
    matched_category_word: string | null;
    contact_label: string;
    contact_label_source: "fictional fixture" | "family-aware";
    contact_label_basis: string;
  };
  compliance: {
    robots_meta: string;
    banner_text: string;
    footer_disclaimer: string;
    banner_above_the_fold: boolean;
    business_own_assets_used: boolean;
    /** The caveat printed with the business's contact details, or null if none. */
    contact_details_caveat: string | null;
    external_requests_on_load: string[];
    /** Plain-language note on what the page does and does not fetch. */
    external_requests_note: string;
    /**
     * One row per page, because compliance is per page and never inherited: which
     * obligations that page carries, and what the build counted on it. A reviewer
     * (or a later audit) can see the five pages at a glance instead of trusting the
     * one page someone happened to open.
     */
    per_page: {
      file: string;
      banner_above_the_fold: boolean;
      prints_business_details: boolean;
      /** How many times the published-listings caveat appears on that page. */
      caveat_instances: number;
      loads_site_js: boolean;
      /** Which of that page's images are labelled AI-generated illustrations. */
      illustration_labels: string[];
    }[];
  };
  /** The privacy notice the bundle carries, and how it was chosen. */
  privacy: {
    file: string;
    mode: "business" | "demo";
    contact_email: string;
    last_updated: string;
    /**
     * Facts the owner has not supplied, so the notice does not state them. An empty
     * list means the notice is complete; anything in it is work the owner must do
     * before a real prospect sees a page.
     */
    open_items: string[];
    /**
     * What the retention section was composed from, so a reviewer can see the basis
     * rather than infer it: the declared operator practice (`ops/retention-log.md`),
     * the window it supports (null when it supports no number at all), and the
     * provider's own facts as printed.
     */
    retention: {
      declared_cadence: string | null;
      window_printed: string | null;
      practice_sentence: string | null;
      provider_facts: string[];
      source: string;
    };
    /** The fields the collection sentence names — the same list the form renders. */
    collection_fields: string[];
  };
  form: {
    provider: string;
    endpoint: string;
    recipient: string;
    /**
     * Who the form actually reaches, and how that was worked out. `mode` is
     * derived by comparing `recipient` with `business_published_address` — never
     * set by hand — and `notice` is the exact sentence the page shows a visitor.
     */
    delivery: {
      mode: "business" | "demo";
      party: string;
      basis: string;
      recipient: string;
      business_published_address: string | null;
      claimed_by_record: "business" | "demo" | null;
      notice: string;
      success_message: string;
    };
    needs_account: string;
    who_owns_the_account: string;
    stores_submissions: string;
    free_tier: string;
    if_it_lapses: string;
    fields: string[];
    fallback_shown: string;
  };
  handoff: {
    external_dependencies: { name: string; purpose: string; owner: string; cost: string; url: string }[];
    recurring_costs: string[];
    day_one_ownership: string[];
  };
  warnings: string[];
}

/** Result of generating one bundle. */
export interface BundleResult {
  slug: string;
  dir: string;
  files: string[];
  images: ManifestImage[];
  warnings: string[];
  bytes: number;
}
