/**
 * Site Sourced — copy, categories and the guards that keep a demo honest.
 *
 * Everything a demo says is composed here, from the record's category and services.
 * Three hard rules are enforced in code, not by good intentions:
 *
 *   1. `guardCopy` refuses to build a page containing a claim we are not allowed to
 *      make (awards, testimonials, customer counts, founding years, performance
 *      promises) unless the same words are in the record itself.
 *   2. Every word about the contact form is chosen from the delivery the record
 *      actually describes (`delivery.ts`): while a bundle delivers anywhere but the
 *      business's own published address, the page says it is a demonstration whose
 *      message comes to Site Sourced, and that the named business is not involved.
 *   3. Nothing is ever read from the business's own website — there is no code path
 *      in this package that fetches a business URL.
 */

import { createHash } from "node:crypto";

import { DEMO_OPERATOR, type FormDelivery, type FormDeliveryMode } from "./delivery.ts";
import {
  familyRules,
  resolveFamily,
  resolvePrimaryLabel,
  SERVICE_ACTION_LABELS,
  wholeWordPattern,
  type FamilyResolution,
  type PrimaryLabel,
} from "./family.ts";
import {
  collectionSentence,
  formFieldSets,
  openDays,
  type FamilyFields,
  type FieldSpec,
  type FormLabels,
} from "./fields.ts";
import { inquirySteps, type ExtraLabels } from "./family-render.ts";
import type { ResolvedForm } from "./forms.ts";
import { resolveProvenance, type Provenance } from "./provenance.ts";
import { resolvePhone, type ResolvedPhone } from "./addresses.ts";
import {
  currentRetentionPractice,
  practiceSentence,
  replyLine,
  retentionProblems,
  routeFor,
  type RetentionCadence,
  type RetentionPractice,
} from "./retention.ts";
import type { BusinessRecord, HoursRow, ManifestImage, ServiceItem } from "./types.ts";

export interface CategoryProfile {
  key: string;
  /**
   * The page's one accent, as the three values the stylesheet needs. Plain hex, no
   * framework, no theme file. See docs/design-system.md §3 for the table these come
   * from, and why each one carries white text at 4.5:1 or better.
   */
  accent: string;
  /** Accent as text on a light surface — links and hover states. */
  accentInk: string;
  /** Accent as a wash behind a notice or a card. */
  accentSoft: string;
  /** Words used to describe the kind of work, e.g. "services", "treatments". */
  offeringPlural: string;
  /** Wikimedia Commons search phrases for the hero / about photos. */
  imageQueries: string[];
}

export const PROFILES: CategoryProfile[] = [
  {
    key: "salon",
    accent: "#9E2B23",
    accentInk: "#7A1F19",
    accentSoft: "#FBEDEA",
    offeringPlural: "services",
    imageQueries: ["barber shop interior", "hair salon interior", "barber tools scissors"],
  },
  {
    key: "landscaping",
    accent: "#4C7A23",
    accentInk: "#35561A",
    accentSoft: "#EEF5E4",
    offeringPlural: "services",
    imageQueries: ["garden landscaping", "lawn mowing", "hedge trimming garden"],
  },
  {
    key: "dental",
    accent: "#1B7A94",
    accentInk: "#125B70",
    accentSoft: "#E7F3F6",
    offeringPlural: "treatments",
    imageQueries: ["dental clinic chair", "dentist office interior", "dental instruments"],
  },
  {
    key: "trades",
    accent: "#A06410",
    accentInk: "#6F4508",
    accentSoft: "#FBF1DF",
    offeringPlural: "services",
    imageQueries: ["plumber tools workbench", "carpenter workshop", "electrician tools"],
  },
  {
    key: "food",
    accent: "#7B2D4E",
    accentInk: "#591E38",
    accentSoft: "#F9ECF1",
    offeringPlural: "menu",
    imageQueries: ["small bakery interior", "restaurant table interior", "coffee shop counter"],
  },
  {
    key: "retail",
    accent: "#5346A0",
    accentInk: "#3A3072",
    accentSoft: "#EFEDFA",
    offeringPlural: "products and services",
    imageQueries: ["small shop interior", "store shelves retail", "florist shop flowers"],
  },
  {
    key: "fitness",
    accent: "#1B5FA8",
    accentInk: "#12417A",
    accentSoft: "#E9F0FA",
    offeringPlural: "classes and services",
    imageQueries: ["gym equipment", "yoga studio interior", "fitness studio"],
  },
  {
    key: "health",
    accent: "#2A6B6B",
    accentInk: "#1C4A4A",
    accentSoft: "#E8F2F2",
    offeringPlural: "services",
    imageQueries: ["physiotherapy clinic", "medical clinic interior", "clinic waiting room"],
  },
  {
    key: "professional",
    accent: "#3A4763",
    accentInk: "#28324A",
    accentSoft: "#ECEFF4",
    offeringPlural: "services",
    imageQueries: ["office desk documents", "law office books", "modern office interior"],
  },
  {
    key: "general",
    accent: "#3D4A63",
    accentInk: "#2A3346",
    accentSoft: "#EDEFF3",
    offeringPlural: "services",
    imageQueries: ["storefront small business", "workshop tools bench", "local shop counter"],
  },
];

const KEYWORDS: [string, string[]][] = [
  ["salon", ["barber", "hair", "salon", "beauty", "nail", "spa", "tattoo", "piercing"]],
  ["landscaping", ["landscap", "garden", "lawn", "tree", "arborist", "nursery", "snow removal"]],
  ["dental", ["dent", "orthodont", "oral"]],
  ["trades", ["plumb", "electric", "hvac", "heating", "carpent", "roof", "contractor", "handyman", "paint", "locksmith", "welding", "mechanic", "auto"]],
  ["food", ["restaurant", "cafe", "café", "bakery", "food", "pizza", "deli", "butcher", "bistro", "coffee", "ice cream"]],
  ["retail", ["shop", "store", "retail", "florist", "boutique", "market", "hardware", "pharmacy"]],
  ["fitness", ["gym", "fitness", "yoga", "pilates", "martial", "dance"]],
  ["health", ["clinic", "physio", "chiro", "medical", "massage", "therapy", "counsel", "vet", "optic", "doctor"]],
  ["professional", ["law", "legal", "account", "bookkeep", "insurance", "real estate", "realty", "office", "consult", "notary", "tax"]],
];

/** Pick the page profile from the record's category words. Never throws. */
export function profileFor(record: BusinessRecord): CategoryProfile {
  return profileMatch(record).profile;
}

/**
 * The profile the record's category selects, **and the word that selected it**.
 *
 * The word is what makes the family derivation auditable: `family.ts` records in the
 * manifest which table row fired and why, and "category X contains Y" is a fact a
 * reviewer can check, where "we matched the salon profile" is not. The returned object is
 * what `resolveFamily` takes — it carries the profile under `key` as well, so the two
 * cannot be passed to each other in the wrong shape.
 */
export function profileMatch(record: BusinessRecord): { profile: CategoryProfile; key: string; matched: string | null } {
  const hay = `${record.category} ${record.category_group ?? ""}`.toLowerCase();
  for (const [key, words] of KEYWORDS) {
    const matched = words.find((w) => hay.includes(w));
    if (matched) {
      const profile = PROFILES.find((p) => p.key === key)!;
      return { profile, key, matched };
    }
  }
  const profile = PROFILES[PROFILES.length - 1]!;
  return { profile, key: profile.key, matched: null };
}

/** Lower-cased category for use inside a sentence, e.g. "barber shop". */
export function categoryLower(record: BusinessRecord): string {
  const c = (record.category || "local business").trim();
  // Keep acronyms and proper nouns as written; only lower a leading capital run
  // when it is a plain common noun ("Barber shop" -> "barber shop", "HVAC" stays).
  if (/^[A-Z][a-z]/.test(c)) return c.charAt(0).toLowerCase() + c.slice(1);
  return c;
}

/**
 * An image whose recorded licence says it was generated by AI, i.e. a placeholder
 * illustration rather than a photograph. Only such an image needs a label on the
 * page; a CC0 photograph is generic artwork and is not claiming to be the place.
 */
export function isIllustrativeImage(image: ManifestImage): boolean {
  return Boolean(image.file) && /^ai-generated/i.test((image.license ?? "").trim());
}

/**
 * The label a page carries for an AI-generated placeholder image.
 *
 * The plan's rule is that an AI-generated placeholder is labelled **on the page**
 * as an illustration and not a photograph of the business; the manifest records the
 * same fact under `images[].notes`. Both come from this one sentence, so the page
 * and the audit trail cannot drift apart, and the compliance self-check in
 * build.ts refuses a bundle whose manifest records an AI-generated image while the
 * page carries no such label.
 */
export function illustrationLabel(businessName: string): string {
  return `Illustration: this picture was generated by AI as a placeholder — it is not a photograph of ${businessName} or of its premises.`;
}

export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 60) || "demo";
}

export function normaliseServices(record: BusinessRecord): ServiceItem[] {
  const raw = record.services ?? [];
  return raw
    .map((s) => (typeof s === "string" ? { name: s.trim(), note: "" } : { name: String(s.name ?? "").trim(), note: String(s.note ?? "").trim() }))
    .filter((s) => s.name.length > 0);
}

/**
 * The record's About narrative paragraphs, trimmed and empty-filtered, in the order they
 * are printed. One array element is one paragraph; the trim/filter is done here once so
 * the copy, the manifest count and the fictional-narrative guard all read the same list
 * instead of each re-deriving it.
 */
export function narrativeParagraphs(record: BusinessRecord): string[] {
  return (record.about_paragraphs ?? []).map((p) => p.trim()).filter(Boolean);
}

export function normaliseHours(record: BusinessRecord): { rows: HoursRow[]; note: string } {
  const h = record.hours;
  if (Array.isArray(h)) {
    const rows = h
      .map((r) => ({ days: String(r.days ?? "").trim(), hours: String(r.hours ?? "").trim() }))
      .filter((r) => r.days && r.hours);
    return { rows, note: "" };
  }
  if (typeof h === "string" && h.trim()) return { rows: expandOsmHours(h.trim()), note: "" };
  return { rows: [], note: "no hours recorded" };
}

const DAY_NAMES: Record<string, string> = {
  Mo: "Mon",
  Tu: "Tue",
  We: "Wed",
  Th: "Thu",
  Fr: "Fri",
  Sa: "Sat",
  Su: "Sun",
};

const DAY_ORDER = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/**
 * Expand the common shapes of an OSM `opening_hours` string into one row per rule.
 * Anything we do not fully understand is printed verbatim rather than guessed at.
 */
export function expandOsmHours(raw: string): HoursRow[] {
  if (/^24\/7$/i.test(raw)) return [{ days: "Every day", hours: "Open 24 hours" }];
  const rows: HoursRow[] = [];
  for (const part of raw.split(";")) {
    const rule = part.trim();
    if (!rule) continue;
    const m = /^([A-Za-z,\-]+)\s+(.*)$/.exec(rule);
    if (!m) {
      rows.push({ days: "Hours", hours: rule });
      continue;
    }
    const days = expandDayTokens(m[1]);
    const times = m[2].trim();
    if (!days || !/^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(times)) {
      rows.push({ days: "Hours", hours: rule });
      continue;
    }
    const [from, to] = times.split("-").map((t) => t.trim());
    rows.push({ days, hours: `${to12h(from)} – ${to12h(to)}` });
  }
  return rows;
}

function expandDayTokens(spec: string): string {
  const out: string[] = [];
  for (const token of spec.split(",")) {
    const t = token.trim();
    const range = /^([A-Za-z]{2})\s*-\s*([A-Za-z]{2})$/.exec(t);
    if (range) {
      const a = DAY_ORDER.indexOf(cap(range[1]));
      const b = DAY_ORDER.indexOf(cap(range[2]));
      if (a < 0 || b < 0 || b < a) return "";
      out.push(`${DAY_NAMES[DAY_ORDER[a]]}–${DAY_NAMES[DAY_ORDER[b]]}`);
      continue;
    }
    const cap2 = cap(t);
    if (!cap2) return "";
    out.push(DAY_NAMES[cap2]);
  }
  return out.join(", ");
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function to12h(hhmm: string): string {
  const [hRaw, m] = hhmm.split(":");
  const h = Number(hRaw);
  if (!Number.isFinite(h)) return hhmm;
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m} ${suffix}`;
}

/* --------------------------------------------------------------- our identity */

/**
 * What a visitor can use to reach us about a page we built.
 *
 * **This is the one place the owner's identity lives.** The privacy notice's "who we
 * are" line is the only page that needs a legal name and a mailing address, and neither
 * has been supplied yet (both are open items for the owner: they are also required for
 * CASL-compliant outreach). Until they are filled in the privacy notice prints our
 * working inbox as the privacy contact and says nothing about a postal address, and
 * `privacyOpenItems()` records the gap in the bundle manifest instead of putting a
 * bracket on a public page. `build.ts` fails any page carrying a bracketed or
 * template-shaped value, so an unfilled field here cannot leak onto a demo.
 *
 * **To complete it:** replace `legalName` and `postalAddress` below with the owner's
 * legal name and mailing address. Nothing else changes — the notice, the manifest and
 * the open-item list all follow from this one object.
 */
export const PRIVACY_IDENTITY = {
  /** Our legal name, as it should be printed on a privacy notice. Empty = not supplied. */
  legalName: "",
  /** Our mailing address, as it should be printed on a privacy notice. Empty = not supplied. */
  postalAddress: "",
  /**
   * The address a privacy request should reach us at. While the owner has no
   * dedicated privacy inbox this is the working inbox that already receives the
   * demos' form submissions, and it is a real, monitored address.
   */
  privacyEmail: "site-sourced-311e0184@ctomail.io",
  /**
   * Where *we* are, as our own notice states it. This is a fact about us rather than
   * about a business, so it is declared here with the rest of our identity — it is never
   * borrowed for a client's page, whose place comes from the record's own address and is
   * dropped when the record has none (`composePrivacy`).
   */
  region: "Ontario, Canada",
} as const;

/**
 * The date the privacy notice's wording was last changed. A page claiming to be
 * updated on a date nobody touched it is a false statement, so this is a constant a
 * human moves when the copy changes — never the build time.
 *
 * The date and the wording are sealed together by `PRIVACY_NOTICE_SEAL` below.
 */
export const PRIVACY_LAST_UPDATED = "4 October 2026";

/**
 * The notice's text, as a reader meets it: title, lead, then every heading and
 * paragraph. The date is deliberately *not* part of it — the seal is over the wording
 * the date belongs to, and folding the date in would make the two impossible to compare.
 */
export function privacyNoticeText(notice: PrivacyNotice): string {
  return [notice.title, notice.lead, ...notice.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join("\n");
}

/**
 * A digest over a set of composed notices, one line per notice so the set cannot be
 * reordered or a notice dropped without changing it.
 */
export function privacyNoticeDigest(notices: PrivacyNotice[]): string {
  const hash = createHash("sha256");
  for (const notice of notices) hash.update(`${notice.mode}\n${privacyNoticeText(notice)}\n---\n`);
  return hash.digest("hex").slice(0, 16);
}

/**
 * The seal: the wording `PRIVACY_LAST_UPDATED` belongs to (audit §B6).
 *
 * `test/privacy-notice.test.ts` composes the notice for a fixed record in both phases
 * and compares the digest with this value. If the sentences change and the date does
 * not, the test fails and says which two things to move together; if the date changes
 * without the wording changing, it fails too. The digest is taken over a fixed fixture
 * rather than over the build's own record because the notice carries the business's own
 * name — only a fixed composition is comparable.
 */
export const PRIVACY_NOTICE_SEAL = "94cb76ec07ab3614";

/**
 * The provider's label as a visitor should read it. The relay preset's own label is
 * the internal phrase "self-hosted / test relay", which means nothing to a visitor and
 * must never be printed.
 */
export function providerLabel(form: ResolvedForm): string {
  return form.provider.key === "relay" ? `${DEMO_OPERATOR}'s own test relay` : form.provider.label;
}

/** What the owner has not supplied yet, named as an open item rather than printed. */
export function privacyOpenItems(): string[] {
  const items: string[] = [];
  if (!PRIVACY_IDENTITY.legalName.trim()) {
    items.push("our legal name — the privacy notice prints our trading name, Site Sourced, until the owner supplies it");
  }
  if (!PRIVACY_IDENTITY.postalAddress.trim()) {
    items.push("our mailing address — the privacy notice omits it until the owner supplies one (CASL also requires it for outreach)");
  }
  return items;
}

/** Everything the page will say, composed only from the record. */
export interface DemoCopy {
  /** Category and place, e.g. "Barber shop · Hamilton, ON" — the hero's first line. */
  heroEyebrow: string;
  /** What the record says the business offers, as one line. */
  heroLead: string;
  about: string[];
  /**
   * On `DemoCopy`, per record: how many of `about[]` the home page shows — the identity
   * line, plus the record's own opening paragraph when it has one. The rest is the About
   * page's.
   */
  aboutExcerptLength: number;
  servicesIntro: string;
  /** Shown in place of the services list when the record carries no services at all. */
  servicesEmpty: string;
  hoursIntro: string;
  /** Shown in place of the hours table when the record carries no hours at all. */
  hoursEmpty: string;
  locationIntro: string;
  /** The heading over the address block. */
  locationHeading: string;
  /** Shown in place of the address when the record carries no street address. */
  locationEmpty: string;
  contactIntro: string;
  formNotice: string;
  /** Which case the notice above was written for (carried into the manifest). */
  formNoticeDelivery: FormDeliveryMode;
  /**
   * The caveat printed with the business's phone number and email address, or "" in
   * the business phase. It is **derived from the record's declared source**
   * (`provenance.ts`), because the claim it makes — that these details were published
   * in public listings — is only true of some records. A fictional example business
   * gets its own line in the same place, and the build refuses a page that carries the
   * wrong one of the two.
   */
  contactCaveat: string;
  /**
   * Which of the owner's three phone versions this build is in, the number it prints and
   * the label in front of it (WORKFLOW.md rule 9, `addresses.ts`). Composed once here so
   * the page, the manifest and the build check read the same object — a client's own
   * number, a real business's published number on a demonstration page, or a clearly
   * fictional one inside the reserved range, and never anything else.
   */
  phone: ResolvedPhone;
  /**
   * Where the record says its details came from, and the lines derived from it. The
   * footer's provenance sentence is `provenance.attribution`; the manifest carries the
   * same object so a bundle records what it claimed and why.
   */
  provenance: Provenance;
  /** What the form's own success message may claim. */
  formSuccess: string;
  /**
   * What the form shows when the submission fails, as a `data-failure` attribute.
   * Derived: it names a printed contact detail only where the page prints one, so a
   * record with neither a phone number nor an email address still tells the truth.
   */
  formFailure: string;
  /**
   * The sentence under the submit button, derived by **delivery mode and family**
   * (design spec §2, lead ruling 1). It is the qualifier the button needs: on an
   * appointment page "this is a request, not a confirmed booking"; on a demonstration
   * page, that nothing here is booked or reaches the business. It is never a promise,
   * and it is data rather than markup, so both modes render the same paragraph.
   */
  formNote: string;
  /**
   * Family B's "How an inquiry works", three lines, **derived from `delivery.mode`**
   * (design spec §3, lead ruling 2). Empty for Family A, whose page carries no such
   * block. The heading is here too, because the section is the family's own.
   */
  stepsHeading: string;
  steps: string[];
  banner: string;
  footerDisclaimer: string;
  offeringPlural: string;

  /* ---------------------------------------------------------------- furniture
     Everything the four-page shell prints around the record's own content: the
     navigation labels, the page titles and leads, the call-to-action block, the
     printed-details fallback and the footer's small print. None of it is
     build-asserted, so all of it is ours to change — and it lives here, with the
     rest of the prose, so a copy pass is one edit. */

  /** Navigation labels, keyed by page id. Short: they sit in a phone's header. */
  nav: Record<"index" | "services" | "about" | "contact" | "privacy", string>;
  /** Each non-home page's `<h1>` and the one-line lead under it. */
  pages: Record<"services" | "about" | "contact" | "privacy", { title: string; lead: string }>;
  /** The heading over the link to the contact page, on every page but contact. */
  contactCtaHeading: string;
  contactCtaIntro: string;
  /**
   * The primary contact label the call to action carries, and the rule that chose it.
   * The label itself is `contactLabel.label` — one place, so the hero button, the CTA
   * band, the manifest and the honesty guard cannot disagree about what the page asks a
   * visitor to do (WORKFLOW.md rule 8, owner decision 4 October).
   */
  contactLabel: PrimaryLabel;
  /**
   * Which conversion family this build is for, and how that was derived from the record.
   * Carried into the manifest, and the family whose honesty rules `complianceChecks`
   * enforces on every page.
   */
  conversion: FamilyResolution;
  /** The printed phone number and email, next to the form or the contact link. */
  fallback: {
    heading: string;
    emailIntro: string;
    phoneIntro: string;
    noEmail: string;
    noPhone: string;
  };
  /** Footer small print (the provenance and take-down lines). */
  footer: {
    provenance: string;
    takedown: string;
  provenanceHtml: string;
  };
  /** Labels and buttons: shell furniture a visitor reads but that is not a claim. */
  ui: UiCopy;
}

/**
 * The words the form and the family furniture print, in one place, so a copy pass is
 * one edit — and so `fields.ts` can name the labels each control uses without holding
 * any prose of its own (`FormLabels`) and `family-render.ts` can label the extras card
 * (`ExtraLabels`).
 *
 * Every one of these is a label, not a claim: the sentences that *are* claims — the
 * delivery notice, the privacy notice, the banner — are derived elsewhere and are
 * frozen or composed, never listed here.
 */
export interface UiCopy extends FormLabels, ExtraLabels {
  skip: string;
  callLabel: string;
  directions: string;
  osm: string;
  honeypot: string;
  privacyLink: string;
  /**
   * The service-card action, per family, as a template with `SERVICE_NAME_SLOT` where
   * the recorded service's own name goes. It asks for the thing and never promises a
   * price; the words themselves are `SERVICE_ACTION_LABELS` in `family.ts`.
   */
  serviceActionRequest: string;
  serviceActionAsk: string;
}

export const UI: UiCopy = {
  skip: "Skip to content",
  callLabel: "Call",
  directions: "Get directions",
  osm: "See it on OpenStreetMap",
  honeypot: "Leave this field empty",
  privacyLink: "Privacy notice",

  /* The two families' fields (fields.ts decides which of these a build uses). */
  fieldName: "Your name",
  fieldEmail: "Your email",
  fieldPhone: "Your phone",
  fieldService: "What do you need?",
  fieldPreferredDays: "Preferred day(s)",
  fieldPreferredTime: "Preferred time",
  fieldBeenBefore: "Have you been here before?",
  fieldExtra: "Anything to add?",
  fieldJobType: "Type of job",
  fieldJobLocation: "Where is the job?",
  fieldJobDescription: "Describe what you need",
  fieldHowSoon: "How soon?",
  fieldReachYou: "How should they reach you?",
  fieldOptional: "(optional)",

  legendYourDetails: "Your details",
  legendTheAppointment: "The appointment",
  legendAboutTheJob: "About the job",

  optionNotSure: "Not sure",
  optionSomethingElse: "Something else",
  optionNoPreference: "No preference",
  optionMorning: "Morning",
  optionAfternoon: "Afternoon",
  optionFlexible: "Flexible",
  optionNextFewWeeks: "In the next few weeks",
  optionAsSoonAsPossible: "As soon as possible",
  optionEmergency: "Emergency",
  optionYes: "Yes",
  optionNo: "No",
  optionEmail: "Email",
  optionPhone: "Phone",

  /* The extras card: the record's own facts, or nothing (design spec §4). */
  extrasHeading: "Good to know",
  extraServiceArea: "Service area",
  extraLicensing: "Licensing",
  extraPricing: "Pricing",
  extraNewClients: "New clients",
  extraCancellations: "Cancellations",
  extraWalkIns: "Walk-ins",
  extraDirectBilling: "Direct billing",
  walkInsWelcome: "Walk-ins welcome.",

  /* The service-card action (§6). Family-aware; never a price. The label is a template
     from `family.ts`: `{service}` is where the recorded service's own name goes, so a
     card reads "Request Hot shave" and not a generic "Request this" (owner text, 6 Oct
     2026). */
  serviceActionRequest: SERVICE_ACTION_LABELS.appointment,
  serviceActionAsk: SERVICE_ACTION_LABELS.inquiry,
};

/**
 * The field set this build carries: the family's own, minus everything the record
 * cannot support, with the omission and its reason recorded.
 *
 * `familyFields` is the **one** place the record is read for the form, so the form the
 * page renders, the list the manifest prints and the collection sentence the privacy
 * notice carries are all composed from the same object — which is what makes those
 * three impossible to drift apart (`collectionProblems` checks the rendered page
 * against the notice anyway, because a shared function is not a proof).
 */
export function familyFields(record: BusinessRecord): FamilyFields {
  const matched = profileMatch(record);
  const family = resolveFamily(record, matched).family;
  return formFieldSets({
    family,
    profileKey: matched.key,
    services: normaliseServices(record).map((s) => s.name),
    days: openDays(normaliseHours(record).rows),
    emergencyService: record.emergency_service === true,
    labels: UI,
  });
}

export function composeCopy(record: BusinessRecord, slug: string, form: ResolvedForm, delivery: FormDelivery): DemoCopy {
  const matched = profileMatch(record);
  const profile = matched.profile;
  // Which of the two families this page is for, from the category or the record's own
  // override, with the rule that decided it recorded for the manifest (family.ts).
  const conversion = resolveFamily(record, matched);
  // The primary contact label: neutral on our own fictional fixture, the family's own on
  // anything derived from a real business's record (WORKFLOW.md rule 8).
  const contactLabel = resolvePrimaryLabel(record, conversion.family, profile.key);
  const cat = categoryLower(record);
  // Where the details came from, and every line that depends on it. Derived from the
  // record's `source_kind` — never typed here — so a page cannot credit a source the
  // record does not name, or pin unconfirmed details to a listing they never appeared in.
  const provenance = resolveProvenance(record, delivery.mode);
  // The phone version: the same phase and source the page's other claims are derived
  // from, never a flag. A delivered site prints the client's own number, a demonstration
  // prints the record's own published one, and a fictional fixture prints a reserved
  // "example" number or none at all.
  const phone = resolvePhone({ record, phase: delivery.mode, fictional: provenance.kind === "fictional" });
  const city = (record.address?.city || "").trim();
  const province = (record.address?.province || "ON").trim();
  const place = city ? `${city}, ${province}` : province;
  const services = normaliseServices(record);
  const serviceNames = services.map((s) => s.name);
  const serviceSentence =
    serviceNames.length === 0
      ? ""
      : serviceNames.length === 1
        ? serviceNames[0]
        : `${serviceNames.slice(0, -1).join(", ")} and ${serviceNames[serviceNames.length - 1]}`;

  // The hero says three things and no more: what this is and where (the eyebrow),
  // whose name is on the door (the h1, in render.ts), and what is recorded for it
  // (the offering line). The identity sentence — "X is a barber shop in Hamilton" —
  // is written once, in About: the hero used to open by repeating the business's own
  // name back at the visitor, which is the one thing they already know.
  const heroEyebrow = [record.category, city ? `${city}, ${province}` : province].filter(Boolean).join(" · ");
  // "As published" is a claim about where the details came from, so it follows the
  // record's declared source like the footer line does: a fictional example business
  // gets the wording that belongs to it rather than one the record cannot support.
  const heroLead = serviceNames.length > 0
    ? serviceNames.join(" · ")
    : provenance.published
      ? `Hours, address and phone number as published for this ${cat}.`
      : `Hours, address and phone number invented for this example ${cat}.`;

  // The record's own narrative, spliced between the identity line and the services
  // sentence. Built as an array rather than indexed: the narrative moves the positions
  // the old code relied on, so the services sentence and the provenance line are no
  // longer `about[1]` / `about[2]` on a record that carries one.
  const narrative = narrativeParagraphs(record);
  const offeringTitle = profile.offeringPlural.charAt(0).toUpperCase() + profile.offeringPlural.slice(1);
  const about: string[] = [
    `${record.name} is a ${cat}${city ? ` in ${place}` : ""}.`,
    ...narrative,
    serviceSentence
      ? `The ${profile.offeringPlural} recorded for ${record.name} are on the ${offeringTitle} page: ${serviceSentence}.`
      : `This is a starting point for a page of the business's own.`,
    provenance.aboutLine,
  ];

  // The intro names the list the page actually shows, and stops short of claiming it is
  // complete. With no services recorded there is no intro at all (P4): the list's own
  // position carries the empty line instead, so the sentence never repeats as a lead and
  // a block line on the same page.
  const servicesIntro = serviceSentence
    ? `These are the ${profile.offeringPlural} recorded for ${record.name}. The list may be incomplete.`
    : "";
  const servicesEmpty = `Nothing is recorded for this business yet. This is where ${record.name}'s own list would go.`;

  const hoursIntro =
    "Hours as recorded for this business. They can change without notice, so it is worth checking with the business before relying on them.";
  const hoursEmpty = "No opening hours are recorded for this business.";
  const locationHeading = `Where ${record.name} is`;
  const locationEmpty = "No street address is recorded for this business.";

  // No sentence here: the heading says where the business is, and the address block
  // (or its one honest line) says the rest. Render omits the empty <p>.
  const locationIntro = "";

  // Everything about the form is chosen from the delivery the record actually
  // describes (delivery.ts) — never from a flag someone set by hand. In the
  // demonstration phase the page must not claim the message reaches the business:
  // it comes to us, and the business named on the page has not seen it.
  const businessPhase = delivery.mode === "business";

  // The contact page's lead is only the clause that points at the printed details, and
  // only when the page prints one (P6): the frozen form notice F5 already says the
  // demonstration message comes to us, so the lead's first sentence repeated it, and a
  // record that prints neither a phone number nor an email address must not promise a
  // detail the page does not show (lead ruling R4).
  const printedDetails = [record.phone?.trim() ? "phone number" : "", record.email?.trim() ? "email address" : ""].filter(Boolean);
  // The phrase that names the details this record prints — "the phone number", "the email
  // address", or both — and nothing when it prints neither. **Two** sentences point a
  // visitor at a printed detail (the contact page's lead and the contact call to action on
  // the other three pages), so both read this one phrase: the call to action used to name
  // "the phone number or email address" from the phase alone, and was therefore wrong on
  // every page that printed only one of the two — a page claiming a detail it does not
  // show, which is the rule the build exists to keep.
  const printedDetailPhrase = printedDetails.length === 0 ? "" : `the ${printedDetails.join(" or ")}`;
  const contactIntro = businessPhase
    ? printedDetailPhrase
      ? `Send a message to ${record.name} using the form below, or use ${printedDetailPhrase} printed with it.`
      : `Send a message to ${record.name} using the form below.`
    : printedDetailPhrase
      ? `To reach ${record.name} itself, use ${printedDetailPhrase} printed with it.`
      : "";

  const formSuccess = businessPhase
    ? `Thanks — your message is on its way to ${record.name}.`
    : `Thanks — your message has gone to ${DEMO_OPERATOR}, who built this demonstration. ${record.name} is not involved and will not see it.`;

  // The failure line names a printed contact detail only where one prints with the
  // form; a record with neither a phone number nor an email address must not be told
  // to use a detail it does not show (four-page audit finding 9(b)).
  const formFailure =
    record.phone?.trim() || record.email?.trim()
      ? "Sorry, that didn't send. Please use the contact details printed with this form."
      : "Sorry, that didn't send. Please try again.";

  // The storage half of the notice is a privacy claim about a third party, so it is
  // built from the provider preset rather than written once here. Formspark's own
  // privacy policy says submissions are stored in the account that owns the form
  // until that account's holder deletes them, so "we pass it along and keep nothing"
  // would have been false. `party` is whoever that account holder is: the business
  // in the delivery phase, Site Sourced while the page is still a demonstration.
  const formNotice = businessPhase
    ? [
        `This form sends your message to ${record.name} through ${form.provider.label}, the form service set up in ${record.name}'s own account.`,
        form.provider.visitor_storage({ party: record.name }),
        "Site Sourced never receives a copy of it and never uses your details for anything else.",
      ].join(" ")
    : [
        `This is a demonstration site: the form below sends your message to ${DEMO_OPERATOR}, the company that built it — not to ${record.name}.`,
        `${record.name} has not seen this page, is not involved in it and will not receive your message.`,
        form.provider.visitor_storage({ party: DEMO_OPERATOR }),
        `${DEMO_OPERATOR} uses it only to reply to you; there is no mailing list, and it is not passed on to ${record.name}.`,
      ].join(" ");

  // The proposal furniture — the banner and the matching footer line — belongs to the
  // demonstration phase alone. On a delivered site there is nothing to propose and nobody
  // to disclaim: the client's own pages must not introduce themselves as somebody's
  // unsolicited proposal, so both lines are empty in the business phase and the build
  // refuses either one appearing there (WORKFLOW.md rule 9, `phaseFurnitureProblems`).
  // Two frozen strings, byte-identical to what they have always been: the banner opens
  // "This is an unsolicited design proposal…" and the footer line begins "This page is
  // …". Only their presence in the phase is derived here — never their wording.
  const banner = businessPhase
    ? ""
    : `This is an unsolicited design proposal from Site Sourced. It is not affiliated with, endorsed by, or operated by ${record.name}.`;
  const footerDisclaimer = businessPhase
    ? ""
    : `This page is an unsolicited design proposal from Site Sourced. It is not affiliated with, endorsed by, or operated by ${record.name}.`;

  // The printed phone number and email address came from a public source and were
  // never confirmed with the business — while this page is a demonstration the notice
  // above the form sends a visitor to exactly those details, so the caveat belongs with
  // them rather than only in the banner. Which caveat, and whether there is one at all,
  // is derived from the record's declared source: the frozen "as published in public
  // listings" line is only true of records whose details really were published, and a
  // fictional example business gets the line that belongs to it instead. On a delivered
  // site the client has confirmed their own details, so it is not printed.
  const contactCaveat = businessPhase ? "" : provenance.caveat;

  // The four-page shell: nav labels, page titles and leads, the contact call to
  // action, the printed-details fallback and the footer's small print. Rendered in
  // render.ts; the words live here so a copy pass is one edit.
  //
  // The call to action is the one piece here that follows the delivery phase: on
  // every page but the contact page it links to the form, and whether that form
  // reaches the business decides the sentence. Its closing clause is the same one
  // `contactIntro` ends with — the route a visitor takes to the business itself.
  const contactCtaIntro = businessPhase
    ? `Send a message to ${record.name} using the contact page${printedDetailPhrase ? `, or use ${printedDetailPhrase} printed with it` : ""}.`
    : `This is a demonstration site, so the message form comes to ${DEMO_OPERATOR} rather than to ${record.name}.${printedDetailPhrase ? ` To reach ${record.name} itself, use ${printedDetailPhrase} printed with it.` : ""}`;

  // The sentence under the submit button. Derived from the delivery the record
  // describes and the family it is for — never typed into the template — because it is
  // the one line that keeps the button honest: a request is not a booking, and on a
  // demonstration page the message does not reach the business named above it.
  const formNote = businessPhase
    ? conversion.family === "appointment"
      ? `This is a request, not a confirmed booking. ${record.name} will contact you to agree a time.`
      : `Describe the job and ${record.name} will get back to you.`
    : conversion.family === "appointment"
      ? "Nothing here is booked."
      : `Nothing here reaches ${record.name}.`;

  // Family B's opening move, as data: the same three <li>s render in both phases, and
  // two of them follow the delivery mode (design spec §3). Empty for Family A.
  const steps = conversion.family === "inquiry" ? inquirySteps(delivery.mode, { business: record.name, us: DEMO_OPERATOR }) : [];

  void slug;
  return {
    heroEyebrow,
    heroLead,
    about,
    aboutExcerptLength: narrative.length > 0 ? 2 : 1,
    servicesIntro,
    servicesEmpty,
    hoursIntro,
    hoursEmpty,
    locationIntro,
    locationHeading,
    locationEmpty,
    contactIntro,
    formNotice,
    formNote,
    stepsHeading: "How an inquiry works",
    steps,
    formNoticeDelivery: delivery.mode,
    contactCaveat,
    phone,
    provenance,
    formSuccess,
    formFailure,
    banner,
    footerDisclaimer,
    offeringPlural: profile.offeringPlural,
    nav: {
      index: "Home",
      services: offeringTitle,
      about: "About",
      contact: "Contact",
      privacy: "Privacy",
    },
    pages: {
      services: { title: offeringTitle, lead: servicesIntro },
      about: {
        title: `About ${record.name}`,
        lead: provenance.published
          ? `The details published for ${record.name}, and where they came from.`
          : `An invented example business, shown to demonstrate the layout of a demo page.`,
      },
      contact: {
        title: businessPhase ? `Contact ${record.name}` : "Contact",
        lead: contactIntro,
      },
      privacy: {
        title: businessPhase ? `Privacy — ${record.name}` : "Privacy — a Site Sourced design proposal",
        lead: businessPhase
          ? `How ${record.name} handles a message sent from this website.`
          : `How we handle a message sent from this page.`,
      },
    },
    contactCtaHeading: businessPhase ? `Contact ${record.name}` : "Contact",
    contactCtaIntro,
    contactLabel,
    conversion,
    fallback: {
      heading: "Email and phone",
      emailIntro: "Email:",
      // The phone label is the wording WORKFLOW.md rule 9 needs: a fictional fixture's
      // invented number is an example and is never described as published, while a real
      // business's own number (on a personalised demo or a client's own site) carries the
      // plain label. The three-way split is decided by the record's source, not typed here.
      phoneIntro: phone.label,
      noEmail: "No email address is recorded for this business.",
      noPhone: "No phone number is recorded for this business.",
    },
    footer: {
      /* Derived from the record's declared source — see provenance.ts. It used to be
         hard-coded to an OpenStreetMap/ODbL credit, which was false on every record
         that never touched OSM. */
      provenance: provenance.attribution,
      provenanceHtml: provenance.attributionHtml,
      takedown: businessPhase
        ? `Have something to correct? Contact ${record.name}.`
        : "This page is an unsolicited proposal, not the business's own site. Ask and we will take it down.",
    },
    ui: UI,
  };
}

/* -------------------------------------------------------------- privacy notice */

/** One heading and its paragraphs, as the privacy page prints them. */
export interface PrivacySection {
  heading: string;
  paragraphs: string[];
}

/**
 * The privacy notice, as the page will print it.
 *
 * It has **two variants and one spine**, and which variant is composed is decided by
 * `delivery.mode` — the same derivation the form-delivery notice uses, never a human's
 * judgement (`delivery.ts`).
 *
 *   demo      Site Sourced is the accountable party, the recipient and the holder of
 *             the form account: the visitor's message comes to us and the business
 *             named on the page is not involved.
 *   business  the client is the accountable party and the account holder, so the
 *             demonstration sentences become false ("we do not run a website for
 *             them") and must not be printed. What ships is the client's own notice.
 *
 * Shared and tokenised once: the collection / why / retention / access / complaints
 * spine, and the processor's storage behaviour, which comes from the provider preset
 * rather than from this file, so the page cannot drift from what the provider states.
 */
export interface PrivacyNotice {
  /** The phase this notice was composed for, carried into the manifest. */
  mode: FormDeliveryMode;
  title: string;
  lead: string;
  sections: PrivacySection[];
  /** The address the notice tells a visitor to write to. */
  contactEmail: string;
  /** Facts the owner has not supplied, so the page does not state them. */
  openItems: string[];
  lastUpdated: string;
  /**
   * What the retention section was composed from — the declared operator practice and
   * the provider's own facts. Carried so the build (and a reviewer) can check the
   * printed sentences against the facts that are supposed to back them, and so the
   * manifest records the basis rather than the reader having to infer it.
   */
  retention: PrivacyRetentionBasis;
}

/** The heading the retention section prints, and the key the guard looks it up by. */
export const RETENTION_HEADING = "How long it is kept";

export interface PrivacyRetentionBasis {
  /** The declared routine, or null when no practice could be read. */
  cadence: RetentionCadence | null;
  /** The window the notice prints — "" when the declared routine supports no number. */
  window: string;
  /** The sentence printed about our own routine, or "" on a client's own site. */
  practiceSentence: string;
  /** The provider's own facts, as printed. */
  providerFacts: string[];
  /** Where the declaration was read from (the team file, or an override). */
  source: string;
}

/**
 * The privacy notice, composed from recorded facts and nothing else.
 *
 * `practice` is the declared operator practice (`retention.ts` reads it from
 * `ops/retention-log.md`). It is a parameter rather than a hidden read so the build reads
 * it once and can fail loudly when it is missing, and so a test can compose the notice
 * for any routine the log might declare.
 */
export function composePrivacy(
  record: BusinessRecord,
  form: ResolvedForm,
  delivery: FormDelivery,
  practice: RetentionPractice | null = currentRetentionPractice(),
): PrivacyNotice {
  const businessPhase = delivery.mode === "business";
  const label = providerLabel(form);
  const provider = form.provider;
  const publishedEmail = (record.email ?? "").trim();
  const businessName = record.name;
  const postal = PRIVACY_IDENTITY.postalAddress.trim();
  /** Our name as the notice prints it: the legal name when we have it, else the trading name. */
  const operatorName = PRIVACY_IDENTITY.legalName.trim() || DEMO_OPERATOR;
  const operatorPlace = [operatorName, postal, PRIVACY_IDENTITY.region.trim()].filter(Boolean).join(", ");
  /** The party whose account holds the message: the client, or us while this is a demo. */
  const party = businessPhase ? businessName : DEMO_OPERATOR;

  const contactEmail = businessPhase ? publishedEmail : PRIVACY_IDENTITY.privacyEmail;
  const route = routeFor(contactEmail);

  // Composed from the fields the form renders (fields.ts), so the notice can never name
  // fewer of them than the page asks for, and never one it does not ask for.
  const collect: PrivacySection = {
    heading: "What is collected",
    paragraphs: [
      collectionSentence(familyFields(record).fields),
      ...provider.collection_extra,
      "There are no cookies, no analytics and no tracking on this page.",
    ],
  };

  const why: PrivacySection = {
    heading: "Why it is collected",
    paragraphs: [
      "To read your message and reply to you once. Your details are not used for anything else and are not added to a mailing list.",
      "Sending the form is not consent to any marketing.",
    ],
  };

  // The provider's behaviour is not ours to change, so it is quoted into the provider
  // preset from docs/formspark.md and printed as its **own sentences** — never appended
  // mid-sentence, which is how a lower-case brand name and a missing full stop shipped.
  const providerFacts = provider.retention_facts({ service: label, party });
  const providerFactsText = providerFacts.join(" ");
  // Our half of the retention section comes from the one declared practice. With no
  // declared cadence the sentence is left out entirely and the build fails (a claim with
  // no recorded fact behind it), rather than printing a routine nobody agreed to run.
  const practiceLine =
    !businessPhase && practice ? practiceSentence(practice, route) : "";
  // On a client's own site the account is theirs, so we may not print a timetable on
  // their behalf (WORKFLOW.md rule 8): the notice states the provider's facts, names the
  // client as the one who deletes, and gives the visitor the route to ask.
  const clientLine = businessPhase
    ? `The account this form sends to is ${businessName}'s own, and ${businessName} deletes messages from it. We do not run that account and cannot promise a timetable for it. ${route.lead} to ask for yours to be deleted.`
    : "";

  const retentionSection: PrivacySection = {
    heading: RETENTION_HEADING,
    paragraphs: [providerFactsText, practiceLine || clientLine].filter((p) => p.length > 0),
  };

  // The one deletion promise the provider makes impossible, when it makes one: it is
  // provider-derived, so a provider that holds nothing back prints nothing.
  const deletionException = provider.deletion_exception({ service: label });
  const reply = practice ? replyLine(practice) : "";
  const choices: PrivacySection = {
    heading: "Your choices",
    paragraphs: [
      [
        `${route.lead} to ask what is held about you, to correct it, or to have it deleted.`,
        businessPhase ? "" : reply,
        deletionException,
      ]
        .filter(Boolean)
        .join(" "),
    ],
  };

  const complaints: PrivacySection = {
    heading: "Complaints",
    paragraphs: [
      `${route.lead} first. If we do not resolve it, you can complain to the Office of the Privacy Commissioner of Canada.`,
    ],
  };

  const retention: PrivacyRetentionBasis = {
    cadence: practice?.cadence ?? null,
    window: practice?.window ?? "",
    practiceSentence: practiceLine,
    providerFacts,
    source: practice?.source ?? "no retention practice declared",
  };

  // The client's notice names the client and no place we did not derive: a province or
  // country we were never told is a claim about them, not about our record.
  const businessPlace = [businessName, (record.address?.city ?? "").trim(), (record.address?.province ?? "").trim()]
    .filter(Boolean)
    .join(", ");

  if (businessPhase) {
    return {
      mode: delivery.mode,
      title: `Privacy — ${businessName}`,
      lead: `How ${businessName} handles a message sent from this website.`,
      contactEmail,
      openItems: [],
      lastUpdated: PRIVACY_LAST_UPDATED,
      retention,
      sections: [
        {
          heading: "Who we are",
          paragraphs: [
            businessPlace && publishedEmail
              ? `${businessPlace}. Privacy contact: ${publishedEmail}.`
              : `${businessPlace}. Privacy contact: the details printed on this page.`,
          ],
        },
        {
          heading: "What this page is",
          paragraphs: [
            `This is ${businessName}'s own website. The contact form is set up in ${businessName}'s own account, so the message comes straight to ${businessName}. Site Sourced does not receive a copy of anything you send and does not run this website.`,
          ],
        },
        collect,
        why,
        {
          heading: "Where it goes",
          paragraphs: [
            `The form is handled by ${label}, ${provider.service_descriptor}. ${provider.visitor_storage({ party: businessName })}`,
            `${label} operates internationally, so the message may be handled under the laws of the places where its servers sit.`,
          ],
        },
        retentionSection,
        choices,
        complaints,
      ],
    };
  }

  return {
    mode: delivery.mode,
    title: "Privacy — a Site Sourced design proposal",
    lead: "How we handle a message sent from this page.",
    contactEmail,
    openItems: privacyOpenItems(),
    lastUpdated: PRIVACY_LAST_UPDATED,
    retention,
    sections: [
      {
        heading: "Who we are",
        paragraphs: [`${operatorPlace}. Privacy contact: ${PRIVACY_IDENTITY.privacyEmail}.`],
      },
      {
        heading: "What this page is",
        paragraphs: [
          `An unsolicited design proposal from ${DEMO_OPERATOR}, made for a local business that has not asked for it. It is not ${businessName}'s website, and we do not run a website for them. ${businessName} has not seen this page and does not receive anything you send from it.`,
        ],
      },
      collect,
      why,
      {
        heading: "Where it goes",
        paragraphs: [
          `The form is handled by ${label}, ${provider.service_descriptor}. ${provider.visitor_storage({ party: DEMO_OPERATOR })}`,
          `${label} operates internationally, so the message may be handled under the laws of the places where its servers sit. Our responsibility for it continues while ${label} holds it.`,
        ],
      },
      retentionSection,
      choices,
      complaints,
    ],
  };
}

/**
 * The privacy notice's own guard-rail problems, as sentences a build can print.
 *
 * Called from the single compliance self-check in `build.ts`. Every case below is one
 * where the page would tell a visitor something untrue about their own message:
 *
 *   - the notice was composed for the other phase than the record describes (the
 *     demonstration sentences are false on a delivered site, and vice versa),
 *   - a demonstration notice that fails to say the business is not involved, or that
 *     says the business receives the message,
 *   - a demonstration notice naming anyone but the working inbox as the privacy
 *     contact,
 *   - a delivered notice that still names Site Sourced as the accountable party,
 *   - a notice that leaves out a fact the provider's own record states (what the service
 *     logs besides the typed fields, what it keeps and for how long, the one message it
 *     will not release early),
 *   - a retention section that prints a window the declared operator routine does not
 *     support, or names nobody as the party who deletes.
 *
 * The last two groups are the owner's rule (WORKFLOW.md rule 7): the notice may only
 * state what is backed by a recorded fact, and both variants are checked.
 */

/**
 * A message the provider is holding back — its spam filter's copy. Named in the words a
 * notice would reach for, so the check below catches the promise wherever it is made.
 */
const HELD_MESSAGE = /\b(?:spam|junk|quarantin\w*|filter\w*|held\s+back|holding|sets?\s+(?:it\s+)?aside)\b/i;

/** A promise that *we* will delete it. */
const DELETE_PROMISE = /\b(?:we|us|Site Sourced)\b[^.]*\bdelet\w+|\bdelet(?:e|es|ing)\b\s+(?:it|them|yours|the message)\b/i;

/** Anything in the same sentence that says we cannot — which is the honest version. */
const HELD_MESSAGE_CAVEAT = /\b(?:cannot|can not|can't|unable|only\b[^.]*\bcan\b|not\s+be\s+deleted|no one can|releases?\s+it|removes?\s+it)\b/i;

export function privacyNoticeProblems(vars: {
  privacy: PrivacyNotice;
  record: BusinessRecord;
  delivery: FormDelivery;
  form: ResolvedForm;
  /** The declared operator practice, as read from `ops/retention-log.md`. */
  practice: RetentionPractice | null;
}): string[] {
  const { privacy, record, delivery, form, practice } = vars;
  const problems: string[] = [];
  const text = [privacy.lead, ...privacy.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join(" ");
  const lower = text.toLowerCase();
  const service = providerLabel(form);
  const party = privacy.mode === "business" ? record.name : DEMO_OPERATOR;

  if (privacy.mode !== delivery.mode) {
    problems.push(
      `the privacy notice is written for the ${privacy.mode} phase but the record describes the ${delivery.mode} phase (${delivery.basis}) — the wrong variant is the one place a visitor's own message is described untruthfully.`,
    );
  }

  if (privacy.mode === "demo") {
    if (!lower.includes(`${record.name.toLowerCase()} has not seen this page`)) {
      problems.push(
        `the demonstration privacy notice does not say that ${record.name} has not seen this page — that sentence is what stops the rest of the page reading as a claim about the business.`,
      );
    }
    if (/receive your message|receives your message|is notified|will get your message/i.test(text)) {
      problems.push(
        `the demonstration privacy notice says or implies that ${record.name} receives the visitor's message, which is false while the form delivers to ${delivery.party}.`,
      );
    }
    if (privacy.contactEmail.toLowerCase() !== PRIVACY_IDENTITY.privacyEmail.toLowerCase()) {
      problems.push(
        `the demonstration privacy notice tells a visitor to write to "${privacy.contactEmail}" rather than to our own working inbox (${PRIVACY_IDENTITY.privacyEmail}), which is the address a privacy request actually reaches.`,
      );
    }
    if (/site sourced does not receive/.test(lower)) {
      problems.push(
        "the demonstration privacy notice says Site Sourced does not receive a copy of the message, which is the opposite of the truth while the form delivers to us.",
      );
    }
  } else {
    const who = privacy.sections[0];
    const whoText = who ? [who.heading, ...who.paragraphs].join(" ") : "";
    if (/site sourced/i.test(whoText)) {
      problems.push(
        "the delivered privacy notice names Site Sourced as the accountable party. Once the form delivers to the client, the client is the accountable party and the account holder, so the notice must name them and their own contact route.",
      );
    }
    const published = (record.email ?? "").trim().toLowerCase();
    if (!published || privacy.contactEmail.toLowerCase() !== published) {
      problems.push(
        `the delivered privacy notice points a privacy request at "${privacy.contactEmail}" rather than at the client's own published address (${record.email || "none recorded"}) — a request sent to us on a delivered site reaches the wrong party.`,
      );
    }
    if (!lower.includes("site sourced does not receive")) {
      problems.push(
        "the delivered privacy notice does not say that Site Sourced does not receive a copy of the message, which is the one thing that changes when a demo becomes a client's own site.",
      );
    }
    // The client's notice may not state a place we were never given: a province or
    // country invented on their behalf is a claim about them, not about our record.
    // Checked on the "Who we are" section alone, which is where a place would appear —
    // the complaints section names the Office of the Privacy Commissioner of Canada,
    // and that is a fact about the regulator, not a claim about the client.
    const whoParagraph = (privacy.sections.find((s) => s.heading === "Who we are")?.paragraphs.join(" ") ?? "").toLowerCase();
    const address = `${record.address?.city ?? ""} ${record.address?.province ?? ""}`.toLowerCase();
    for (const place of ["ontario", "canada"]) {
      if (whoParagraph.includes(place) && !address.includes(place)) {
        problems.push(
          `the client's privacy notice prints "${place}" although the record carries no such place — a place we did not derive is a claim about the client that our record cannot support. Derive it from the record's address or leave it out.`,
        );
      }
    }
  }

  // The demonstration notice must say the page was not asked for: that framing is the
  // one thing that stops the whole notice reading as if the business commissioned it.
  if (privacy.mode === "demo" && !/unsolicited/i.test(text)) {
    problems.push(
      `the demonstration privacy notice does not say the page is unsolicited, which is the one framing that stops the notice reading as something ${record.name} asked us to write. Expected the words "unsolicited" on the page.`,
    );
  }

  // Every fact the provider's own record states must be on the page. The provider's
  // behaviour is not ours to soften, and this is the check that keeps `docs/formspark.md`
  // and the printed notice coupled: drop a fact from the preset or from the notice and
  // the build fails.
  for (const fact of form.provider.retention_facts({ service, party })) {
    if (fact && !text.includes(fact)) {
      problems.push(
        `the privacy notice does not state a retention fact the provider's own record carries, so a visitor is told less than the service actually does: "${fact}". The facts are quoted from docs/formspark.md into the provider preset in forms.ts; change the record and the preset together.`,
      );
    }
  }
  for (const fact of form.provider.collection_extra) {
    if (fact && !text.includes(fact)) {
      problems.push(
        `the privacy notice's collection section does not state what the form service records besides the fields the visitor types: "${fact}". Omitting it understates what is captured, which is the class of claim this rule forbids.`,
      );
    }
  }
  if (!text.includes(form.provider.service_descriptor)) {
    problems.push(
      `the privacy notice does not describe the form service with its own recorded descriptor ("${form.provider.service_descriptor}"), so a page served by our own test relay could still call it a third-party service. The descriptor is provider-derived, never hard-coded.`,
    );
  }

  // The one deletion promise the provider makes impossible — a message its spam filter
  // is holding, which it keeps for 12 months and will not release early
  // (`docs/formspark.md`). A sentence that names a held-back message and promises *we*
  // will delete it, with nothing in the sentence saying we cannot, is the offer
  // `research/privacy-wording.md` §4.2 says we can never keep. It is checked across the
  // whole notice because that promise does not sit in one section: the retention
  // section states the provider's limit and "Your choices" is where the promise would be
  // made.
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (!HELD_MESSAGE.test(sentence) || !DELETE_PROMISE.test(sentence) || HELD_MESSAGE_CAVEAT.test(sentence)) continue;
    problems.push(
      `the privacy notice promises a deletion we cannot perform: "${sentence.trim()}". ${service} holds a message its spam filter sets aside for 12 months and will not release it early, so an offer to delete one is a promise nothing can keep. Say who can remove it and when, and offer the visitor no more than that.`,
    );
  }

  // The retention section, against the declared practice and the provider's facts.
  const retentionSection = privacy.sections.find((s) => s.heading === RETENTION_HEADING);
  const retentionText = retentionSection ? retentionSection.paragraphs.join(" ") : "";
  if (!retentionSection) {
    problems.push(
      `the privacy notice carries no "${RETENTION_HEADING}" section, so it says nothing about how long a message is kept — the one place a visitor looks for it.`,
    );
  } else {
    problems.push(
      ...retentionProblems({
        text: retentionText,
        providerFacts: privacy.retention.providerFacts,
        practiceSentence: privacy.retention.practiceSentence,
        practice,
        mode: privacy.mode,
        party,
      }),
    );
  }

  return problems;
}

/**
 * The collection list, against the fields the page actually renders.
 *
 * The privacy notice may name every field the form asks for and no other, and it must
 * name all of them: the published page listed name, email and message while the form
 * also asked for a phone number, which is exactly the understatement this rule forbids.
 *
 * The check runs on the rendered contact page rather than on the composer's own output,
 * so it is the page and the notice that are compared — a future edit to the form in
 * `render.ts` that forgets the notice fails the build.
 */
export function collectionProblems(vars: {
  pages: { file: string; html: string }[];
  privacy: PrivacyNotice;
  form: ResolvedForm;
  /**
   * The fields this family's set carries — the same list the form is rendered from and
   * the notice is composed from (`familyFields`). Passed in rather than re-derived so
   * the check is comparing the notice with the build's own decision, not with a second
   * derivation that could make the same mistake twice.
   */
  fields: FieldSpec[];
}): string[] {
  const { pages, privacy, form, fields } = vars;
  const problems: string[] = [];
  // Every page that carries the form — including each per-service contact page a
  // service card links to, which is the same form with one option chosen. The notice is
  // one notice for the bundle, and it must be true on all of them.
  const contacts = pages.filter((p) => p.html.includes('id="contact-form"'));
  if (contacts.length === 0) {
    problems.push(
      "no rendered page carries the contact form, so the privacy notice's collection list cannot be checked against the fields a visitor is actually asked for.",
    );
    return problems;
  }
  // The field names across every form page, so the failure message below names what a
  // visitor is asked for wherever they open the form.
  const renderedEverywhere = new Set<string>();

  for (const contact of contacts) {
    const formHtml = contact.html.slice(contact.html.indexOf("<form"), contact.html.indexOf("</form>"));
    const rendered = new Set<string>();
    // `select` is in the list as well as `input` and `textarea`: a field the visitor
    // answers from a menu is still a field the notice has to name.
    for (const m of formHtml.matchAll(/<(?:input|textarea|select)[^>]*\bname="([^"]+)"/g)) {
      const name = m[1]!;
      // The honeypot and the provider's hidden instructions are not fields a visitor
      // fills in, so they are not part of what the notice says is collected.
      if (name.startsWith("_") || name === "botcheck" || /type="hidden"/.test(m[0]!)) continue;
      rendered.add(name);
    }
    for (const m of formHtml.matchAll(/<input[^>]*type="hidden"[^>]*\bname="([^"]+)"/g)) rendered.delete(m[1]!);

    for (const name of rendered) renderedEverywhere.add(name);

    const known = new Map(fields.map((f) => [f.name, f]));
    for (const name of rendered) {
      if (!known.has(name)) {
        problems.push(
          `the contact form on ${contact.file} asks for a "${name}" field that the privacy notice has no phrase for, so the notice cannot say it is collected. Add it to FORM_FIELDS in fields.ts (and to the notice's list) or stop asking for it.`,
        );
      }
    }
  }

  const collectionSection = privacy.sections.find((s) => s.heading === "What is collected");
  const collectionText = collectionSection ? collectionSection.paragraphs.join(" ") : "";
  const expected = collectionSentence(fields);
  if (!collectionText.includes(expected)) {
    problems.push(
      `the privacy notice's collection sentence does not match the fields the form renders. The form asks for ${[...renderedEverywhere].join(", ")}, so the notice must say: "${expected}" (got: "${collectionText}"). A visitor must be told everything the form collects.`,
    );
  }
  // A provider whose record states it logs more than the typed fields must say so.
  for (const fact of form.provider.collection_extra) {
    if (!collectionText.includes(fact)) {
      problems.push(
        `the privacy notice's collection section omits what ${providerLabel(form)} records besides the typed fields: "${fact}"`,
      );
    }
  }

  return problems;
}

/**
 * Phrases a demo is never allowed to contain. Checked against the rendered HTML;
 * a hit that is not also present in the record itself fails the build.
 */
const BANNED = [
  "award",
  "award-winning",
  "testimonial",
  "review",
  "rated",
  "5-star",
  "five star",
  "years of experience",
  "founded in",
  "established in",
  "family-owned",
  "satisfied customers",
  "happy customers",
  "customers served",
  "trusted by",
  "best in",
  "#1",
  "number one",
  "leading ",
  "most trusted",
  "guarantee",
  "guaranteed",
  "money-back",
  "satisfaction",
  "affordable",
  "cheapest",
  "lowest price",
  "more customers",
  "more leads",
  "more clients",
  "get found",
  "rank higher",
  "ranking",
  "rankings",
  "seo",
  "google search",
  "grow your business",
  "increase your revenue",
  "qualified leads",
  "conversion rate",
];

/**
 * Whole-word matcher for a banned phrase, so "generated" does not trip "rated".
 *
 * The implementation lives in `family.ts` (`wholeWordPattern`) because the family honesty
 * guard asks the same question — does the page say this word, and does the record already
 * say it — and one matcher is enough for both.
 */
function bannedPattern(phrase: string): RegExp {
  return wholeWordPattern(phrase);
}

/**
 * Returns the banned phrases found in `html` that the record itself does not use.
 * A phrase the business's own record already contains is allowed through — the
 * guard is there to stop us inventing claims, not to edit the client's words.
 */
export function guardCopy(html: string, record: BusinessRecord): string[] {
  const hay = html.toLowerCase();
  const own = JSON.stringify(record).toLowerCase();
  const hits: string[] = [];
  for (const phrase of BANNED) {
    const pattern = bannedPattern(phrase);
    if (pattern.test(hay) && !pattern.test(own)) hits.push(phrase);
  }
  return hits;
}

/**
 * The fictional-narrative guard (design spec F1, lead-ratified).
 *
 * `guardCopy` and the family honesty guard both allow a phrase that also appears in the
 * record itself, because a real client's own words are not ours to edit. On a fictional
 * fixture there is no client: the record is our own invention, so that exemption would let
 * an invented narrative smuggle a banned or family-rule-breaking word past both guards
 * simply by sitting in the record. So when `source_kind` is `"fictional"`, the
 * `about_paragraphs` strings must clear `BANNED` and the family word rules on their own,
 * with no record exemption.
 *
 * The designer's fixture content passes this stricter version (it was authored against
 * exactly this check), so it lands green; the check exists to keep a future invented
 * narrative from slipping a claim past the guards it would otherwise exempt.
 */
export function fictionalNarrativeProblems(record: BusinessRecord): string[] {
  if (record.source_kind !== "fictional") return [];
  const narrative = narrativeParagraphs(record);
  if (narrative.length === 0) return [];
  const problems: string[] = [];
  const text = narrative.join(" ");
  const lower = text.toLowerCase();

  for (const phrase of BANNED) {
    if (bannedPattern(phrase).test(lower)) {
      problems.push(
        `the fictional record's about_paragraphs contain the banned phrase "${phrase}", which an invented narrative may not carry — a real client's own words are exempt, but a fictional narrative must clear the guard on its own.`,
      );
    }
  }

  // The family word rules, on their own: no record exemption, no booking-page allowance,
  // and no denial allowance. An invented narrative must not say what its family may not.
  const family = resolveFamily(record, profileMatch(record)).family;
  for (const rule of familyRules(family)) {
    const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
    const pattern = new RegExp(rule.pattern.source, flags);
    const hit = pattern.exec(lower);
    if (hit) {
      problems.push(
        `the fictional record's about_paragraphs say "${hit[0]}" — a page in the ${family} family ${rule.claim} (${rule.allowed}). On a fictional fixture the narrative must clear the family word rules on its own.`,
      );
    }
  }

  return problems;
}
