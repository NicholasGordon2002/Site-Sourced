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

import { DEMO_OPERATOR, type FormDelivery, type FormDeliveryMode } from "./delivery.ts";
import type { ResolvedForm } from "./forms.ts";
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

const PROFILES: CategoryProfile[] = [
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
  const hay = `${record.category} ${record.category_group ?? ""}`.toLowerCase();
  for (const [key, words] of KEYWORDS) {
    if (words.some((w) => hay.includes(w))) return PROFILES.find((p) => p.key === key)!;
  }
  return PROFILES[PROFILES.length - 1];
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
} as const;

/**
 * The date the privacy notice's wording was last changed. A page claiming to be
 * updated on a date nobody touched it is a false statement, so this is a constant a
 * human moves when the copy changes — never the build time.
 */
export const PRIVACY_LAST_UPDATED = "29 September 2026";

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
  servicesIntro: string;
  hoursIntro: string;
  locationIntro: string;
  contactIntro: string;
  /** The heading over the contact section: the business's name, or the demo's. */
  contactHeading: string;
  formNotice: string;
  /** Which case the notice above was written for (carried into the manifest). */
  formNoticeDelivery: FormDeliveryMode;
  /**
   * The caveat printed with the business's phone number and email address, or "" in
   * the business phase. The plan requires it: those details come from public
   * listings, and the demonstration notice points a visitor at them as the way to
   * reach the business, so they must not read as confirmed.
   */
  contactCaveat: string;
  /** What the form's own success message may claim. */
  formSuccess: string;
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
  contactCtaButton: string;
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
  };
  /** Labels and buttons: shell furniture a visitor reads but that is not a claim. */
  ui: {
    skip: string;
    callLabel: string;
    noPhoneNote: string;
    directions: string;
    osm: string;
    submit: string;
    fieldName: string;
    fieldEmail: string;
    fieldPhone: string;
    fieldOptional: string;
    fieldMessage: string;
    honeypot: string;
    privacyLink: string;
  };
}

export function composeCopy(record: BusinessRecord, slug: string, form: ResolvedForm, delivery: FormDelivery): DemoCopy {
  const profile = profileFor(record);
  const cat = categoryLower(record);
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
  const heroLead = serviceNames.length > 0
    ? serviceNames.join(" · ")
    : `Hours, address and phone number as published for this ${cat}.`;

  const about: string[] = [
    `${record.name} is a ${cat}${city ? ` in ${place}` : ""}.`,
    serviceSentence
      ? `The ${profile.offeringPlural} set out below are the ones recorded for the business: ${serviceSentence}.`
      : `This is a starting point for a page of the business's own.`,
    `Every detail here — hours, address, contact details — came from public listings. Nothing on this page was copied from another website, and anything wrong or missing can be corrected in minutes.`,
  ];

  const servicesIntro = serviceSentence
    ? `What ${record.name} offers, as far as our records go. If what you need is not listed, call and ask.`
    : `No ${profile.offeringPlural} were recorded for this business yet — a page of its own is where they would go.`;

  const hoursIntro = "Hours as recorded publicly. These can change without notice, so a quick call before you set out is worth it.";

  const locationIntro = record.address?.street
    ? "Find the address below, or open directions in your maps app."
    : "No street address is recorded publicly for this business — the phone number above is the reliable way to find it.";

  // Everything about the form is chosen from the delivery the record actually
  // describes (delivery.ts) — never from a flag someone set by hand. In the
  // demonstration phase the page must not claim the message reaches the business:
  // it comes to us, and the business named on the page has not seen it.
  const businessPhase = delivery.mode === "business";

  const contactIntro = businessPhase
    ? `Send a message to ${record.name} using the form below, or use the phone number or email address printed with it.`
    : `This is a demonstration site, so the form below comes to ${DEMO_OPERATOR} rather than to ${record.name}. To reach ${record.name} itself, use the phone number or email address printed with it.`;

  const contactHeading = businessPhase ? `Contact ${record.name}` : "About this demo";

  const formSuccess = businessPhase
    ? `Thanks — your message is on its way to ${record.name}.`
    : `Thanks — your message has gone to ${DEMO_OPERATOR}, who built this demonstration. ${record.name} is not involved and will not see it.`;

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

  const banner = `This is an unsolicited design proposal from Site Sourced. It is not affiliated with, endorsed by, or operated by ${record.name}.`;
  const footerDisclaimer = `This page is an unsolicited design proposal from Site Sourced. It is not affiliated with, endorsed by, or operated by ${record.name}.`;

  // The printed phone number and email address came from public listings and were
  // never confirmed with the business — while this page is a demonstration the
  // notice above the form sends a visitor to exactly those details, so the caveat
  // belongs with them rather than only in the banner. On a delivered site the client
  // has confirmed their own details, so it is not printed.
  const contactCaveat = businessPhase
    ? ""
    : `The contact details for ${record.name} on this page are as published in public listings — please confirm them with the business before relying on them.`;

  // The four-page shell: nav labels, page titles and leads, the contact call to
  // action, the printed-details fallback and the footer's small print. Rendered in
  // render.ts; the words live here so a copy pass is one edit.
  //
  // The call to action is the one piece here that follows the delivery phase: on
  // every page but the contact page it links to the form, and whether that form
  // reaches the business decides the sentence. Its closing clause is the same one
  // `contactIntro` ends with — the route a visitor takes to the business itself.
  const contactCtaIntro = businessPhase
    ? `Send a message to ${record.name} using the contact page, or use the phone number or email address printed with it.`
    : `This is a demonstration site, so the message form comes to ${DEMO_OPERATOR} rather than to ${record.name}. To reach ${record.name} itself, use the phone number or email address printed with it.`;

  const offeringTitle = profile.offeringPlural.charAt(0).toUpperCase() + profile.offeringPlural.slice(1);

  void slug;
  return {
    heroEyebrow,
    heroLead,
    about,
    servicesIntro,
    hoursIntro,
    locationIntro,
    contactIntro,
    contactHeading,
    formNotice,
    formNoticeDelivery: delivery.mode,
    contactCaveat,
    formSuccess,
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
        lead: `The details published for ${record.name}, and where they came from.`,
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
    contactCtaButton: "Send a message",
    fallback: {
      heading: "Prefer email?",
      emailIntro: "Write to us directly:",
      phoneIntro: "Or call",
      noEmail: "No email address is recorded publicly for this business — please use the phone number.",
      noPhone: "No phone number is recorded publicly for this business.",
    },
    footer: {
      provenance: `Business details come from public mapping data (© OpenStreetMap contributors, ODbL 1.0). Copy, layout and imagery: Site Sourced. No logo, photograph or text was taken from any website belonging to ${record.name}. This page is marked noindex so it never competes with the business's own site.`,
      takedown: "This demo comes down on request — reply to the email that sent it and it will be removed within a day.",
    },
    ui: {
      skip: "Skip to content",
      callLabel: "Call",
      noPhoneNote: "Phone number not recorded",
      directions: "Get directions",
      osm: "See it on OpenStreetMap",
      submit: "Send message",
      fieldName: "Your name",
      fieldEmail: "Your email",
      fieldPhone: "Your phone",
      fieldOptional: "(optional)",
      fieldMessage: "Message",
      honeypot: "Leave this field empty",
      privacyLink: "Privacy notice",
    },
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
}

export function composePrivacy(record: BusinessRecord, form: ResolvedForm, delivery: FormDelivery): PrivacyNotice {
  const businessPhase = delivery.mode === "business";
  const label = providerLabel(form);
  const provider = form.provider;
  const publishedEmail = (record.email ?? "").trim();
  const businessName = record.name;
  const postal = PRIVACY_IDENTITY.postalAddress.trim();
  /** Our name as the notice prints it: the legal name when we have it, else the trading name. */
  const operatorName = PRIVACY_IDENTITY.legalName.trim() || DEMO_OPERATOR;
  const operatorPlace = [operatorName, postal, "Ontario, Canada"].filter(Boolean).join(", ");

  const contactEmail = businessPhase ? publishedEmail : PRIVACY_IDENTITY.privacyEmail;
  const contactRoute = contactEmail
    ? `Email ${contactEmail}`
    : "Use the phone number or email address printed on this page";

  const collect: PrivacySection = {
    heading: "What is collected",
    paragraphs: [
      "Only what you type into the contact form: your name, your email address and your message.",
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

  const retention: PrivacySection = {
    heading: "How long it is kept",
    paragraphs: [
      `It is deleted within 30 days of arriving, or sooner once it has been answered. ${provider.post_deletion}`,
    ],
  };

  const choices: PrivacySection = {
    heading: "Your choices",
    paragraphs: [
      `${contactRoute} to ask what is held about you, to correct it, or to have it deleted. We reply promptly.`,
    ],
  };

  const complaints: PrivacySection = {
    heading: "Complaints",
    paragraphs: [
      `${contactRoute} first. If we do not resolve it, you can complain to the Office of the Privacy Commissioner of Canada.`,
    ],
  };

  if (businessPhase) {
    return {
      mode: delivery.mode,
      title: `Privacy — ${businessName}`,
      lead: `How ${businessName} handles a message sent from this website.`,
      contactEmail,
      openItems: [],
      lastUpdated: PRIVACY_LAST_UPDATED,
      sections: [
        {
          heading: "Who we are",
          paragraphs: [
            businessName && publishedEmail
              ? `${businessName}, Ontario, Canada. Privacy contact: ${publishedEmail}.`
              : `${businessName}, Ontario, Canada. Privacy contact: the details printed on this page.`,
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
            `The form is handled by ${label}, a third-party form service. ${provider.visitor_storage({ party: businessName })}`,
            `${label} operates internationally, so the message may be handled under the laws of the places where its servers sit.`,
          ],
        },
        retention,
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
    sections: [
      {
        heading: "Who we are",
        paragraphs: [`${operatorPlace}. Privacy contact: ${PRIVACY_IDENTITY.privacyEmail}.`],
      },
      {
        heading: "What this page is",
        paragraphs: [
          `A design proposal we built for a local business. It is not ${businessName}'s website, and we do not run a website for them. ${businessName} has not seen this page and does not receive anything you send from it.`,
        ],
      },
      collect,
      why,
      {
        heading: "Where it goes",
        paragraphs: [
          `The form is handled by ${label}, a third-party form service. ${provider.visitor_storage({ party: DEMO_OPERATOR })}`,
          `${label} operates internationally, so the message may be handled under the laws of the places where its servers sit. Our responsibility for it continues while ${label} holds it.`,
        ],
      },
      retention,
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
 *   - a delivered notice that still names Site Sourced as the accountable party.
 */
export function privacyNoticeProblems(vars: {
  privacy: PrivacyNotice;
  record: BusinessRecord;
  delivery: FormDelivery;
}): string[] {
  const { privacy, record, delivery } = vars;
  const problems: string[] = [];
  const text = [privacy.lead, ...privacy.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join(" ");
  const lower = text.toLowerCase();

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
 */
function bannedPattern(phrase: string): RegExp {
  const escaped = phrase
    .split("")
    .map((ch) => ("\\^$.*+?()[]{}|".includes(ch) ? `\\${ch}` : ch))
    .join("");
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i");
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
