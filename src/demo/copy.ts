/**
 * Site Sourced — copy, categories and the two guards that keep a demo honest.
 *
 * Everything a demo says is composed here, from the record's category and services.
 * Two hard rules are enforced in code, not by good intentions:
 *
 *   1. `guardCopy` refuses to build a page containing a claim we are not allowed to
 *      make (awards, testimonials, customer counts, founding years, performance
 *      promises) unless the same words are in the record itself.
 *   2. Nothing is ever read from the business's own website — there is no code path
 *      in this package that fetches a business URL.
 */

import type { BusinessRecord, HoursRow, ServiceItem } from "./types.ts";

export interface CategoryProfile {
  key: string;
  /** Accent colours for the whole page. Plain hex, no framework, no theme file. */
  accent: string;
  accentDark: string;
  accentSoft: string;
  /** Words used to describe the kind of work, e.g. "services", "treatments". */
  offeringPlural: string;
  /** Wikimedia Commons search phrases for the hero / about photos. */
  imageQueries: string[];
}

const PROFILES: CategoryProfile[] = [
  {
    key: "salon",
    accent: "#8c4a2f",
    accentDark: "#5f3220",
    accentSoft: "#f6ece6",
    offeringPlural: "services",
    imageQueries: ["barber shop interior", "hair salon interior", "barber tools scissors"],
  },
  {
    key: "landscaping",
    accent: "#2f6b3a",
    accentDark: "#1e4726",
    accentSoft: "#eaf3ec",
    offeringPlural: "services",
    imageQueries: ["garden landscaping", "lawn mowing", "hedge trimming garden"],
  },
  {
    key: "dental",
    accent: "#1f6f8b",
    accentDark: "#14505f",
    accentSoft: "#e8f3f7",
    offeringPlural: "treatments",
    imageQueries: ["dental clinic chair", "dentist office interior", "dental instruments"],
  },
  {
    key: "trades",
    accent: "#8a5a00",
    accentDark: "#5f3e00",
    accentSoft: "#fbf1e0",
    offeringPlural: "services",
    imageQueries: ["plumber tools workbench", "carpenter workshop", "electrician tools"],
  },
  {
    key: "food",
    accent: "#9c2b2b",
    accentDark: "#6d1c1c",
    accentSoft: "#fbebeb",
    offeringPlural: "menu",
    imageQueries: ["small bakery interior", "restaurant table interior", "coffee shop counter"],
  },
  {
    key: "retail",
    accent: "#4a3f8f",
    accentDark: "#332b66",
    accentSoft: "#efedfa",
    offeringPlural: "products and services",
    imageQueries: ["small shop interior", "store shelves retail", "florist shop flowers"],
  },
  {
    key: "fitness",
    accent: "#1f5f7a",
    accentDark: "#143f52",
    accentSoft: "#e9f2f7",
    offeringPlural: "classes and services",
    imageQueries: ["gym equipment", "yoga studio interior", "fitness studio"],
  },
  {
    key: "health",
    accent: "#2a6b6b",
    accentDark: "#1c4a4a",
    accentSoft: "#e8f2f2",
    offeringPlural: "services",
    imageQueries: ["physiotherapy clinic", "medical clinic interior", "clinic waiting room"],
  },
  {
    key: "professional",
    accent: "#33415c",
    accentDark: "#222c40",
    accentSoft: "#eceff4",
    offeringPlural: "services",
    imageQueries: ["office desk documents", "law office books", "modern office interior"],
  },
  {
    key: "general",
    accent: "#3b4a6b",
    accentDark: "#28324a",
    accentSoft: "#eceff4",
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

/** Everything the page will say, composed only from the record. */
export interface DemoCopy {
  heroLead: string;
  heroSecond: string;
  about: string[];
  servicesIntro: string;
  hoursIntro: string;
  locationIntro: string;
  contactIntro: string;
  formNotice: string;
  banner: string;
  footerDisclaimer: string;
  offeringPlural: string;
}

export function composeCopy(record: BusinessRecord, slug: string): DemoCopy {
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

  const heroLead = city ? `${record.name} is a ${cat} in ${place}.` : `${record.name} is a ${cat} in Ontario.`;
  const heroSecond = serviceSentence
    ? `On this page: ${serviceSentence}.`
    : "This page lists the details we were able to confirm about the business.";

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

  const contactIntro = `Send a message to ${record.name} using the form below, or use the phone number or email address printed with it.`;

  const formNotice = `This form sends your message directly to ${record.name}. Site Sourced only passes it along and doesn't keep or use it for anything else.`;

  const banner = `This is an unsolicited design proposal from Site Sourced. It is not affiliated with, endorsed by, or operated by ${record.name}.`;

  const footerDisclaimer = `This page is an unsolicited design proposal from Site Sourced. It is not affiliated with, endorsed by, or operated by ${record.name}.`;

  void slug;
  return {
    heroLead,
    heroSecond,
    about,
    servicesIntro,
    hoursIntro,
    locationIntro,
    contactIntro,
    formNotice,
    banner,
    footerDisclaimer,
    offeringPlural: profile.offeringPlural,
  };
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
