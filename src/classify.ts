/**
 * Turning raw OSM elements into leads, plus website-tier classification.
 */

import { haversineKm } from "./geo.ts";
import { lookupCategory } from "./overpass.ts";
import type { OsmElement } from "./overpass.ts";
import type { Lead, WebsiteTier } from "./types.ts";

/**
 * Hosts that mean "this business only has a presence on someone else's platform":
 * social networks, link-in-bio pages, map/directory listings, and Google-hosted
 * profile pages. Everything else counts as a site the business controls.
 */
const PLATFORM_PATTERNS: Array<{ platform: string; re: RegExp }> = [
  { platform: "facebook", re: /(^|\.)(facebook\.com|fb\.com|fb\.me|m\.facebook\.com)$/i },
  { platform: "instagram", re: /(^|\.)instagram\.com$/i },
  { platform: "linktree", re: /(^|\.)(linktr\.ee|linktree\.com|linkin\.bio|lnk\.bio|beacons\.ai|taplink\.cc|milkshake\.app|bio\.link|solo\.to)$/i },
  { platform: "linkedin", re: /(^|\.)(linkedin\.com|lnkd\.in)$/i },
  { platform: "twitter/x", re: /(^|\.)(twitter\.com|x\.com|t\.co)$/i },
  { platform: "tiktok", re: /(^|\.)tiktok\.com$/i },
  { platform: "youtube", re: /(^|\.)(youtube\.com|youtu\.be)$/i },
  { platform: "pinterest", re: /(^|\.)pinterest\.[a-z.]+$/i },
  { platform: "snapchat", re: /(^|\.)snapchat\.com$/i },
  { platform: "whatsapp", re: /(^|\.)(wa\.me|whatsapp\.com)$/i },
  { platform: "google-maps-listing", re: /(^|\.)(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl|g\.page|business\.site)$/i },
  { platform: "yelp", re: /(^|\.)yelp\.[a-z.]+$/i },
  { platform: "tripadvisor", re: /(^|\.)tripadvisor\.[a-z.]+$/i },
  { platform: "marketplace", re: /(^|\.)(doordash\.com|ubereats\.com|skipthedishes\.com|opentable\.[a-z.]+|amazon\.[a-z.]+|etsy\.com|ebay\.[a-z.]+|kijiji\.ca)$/i },
  { platform: "directory", re: /(^|\.)(yellowpages\.ca|yell\.com|canpages\.ca|411\.ca|bbb\.org|homestars\.com|trustedpros\.ca|houzz\.[a-z.]+)$/i },
];

export function normaliseUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^(mailto|tel|fax):/i.test(v)) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^\/\//.test(v)) return `https:${v}`;
  return `https://${v}`;
}

export function hostOfUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function classifyWebsite(rawWebsite: string): { tier: WebsiteTier; platform: string } {
  const url = normaliseUrl(rawWebsite);
  if (!url) return { tier: "no_website", platform: "" };
  const host = hostOfUrl(url);
  if (!host) return { tier: "has_website", platform: "" };
  for (const { platform, re } of PLATFORM_PATTERNS) {
    if (re.test(host)) return { tier: "social_only", platform };
  }
  return { tier: "has_website", platform: "" };
}

// --- element -> lead --------------------------------------------------------

function pick(tags: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = tags[k]?.trim();
    if (v) return v;
  }
  return "";
}

/** First matching category wins; the CATEGORIES order is the priority order. */
function matchCategory(tags: Record<string, string>) {
  for (const key of ["shop", "craft", "healthcare", "amenity", "leisure", "office"]) {
    const value = tags[key]?.trim();
    if (!value) continue;
    const def = lookupCategory(key, value);
    if (def) return { key, value, def };
  }
  return null;
}

export function slugifyArea(area: string): string {
  return (
    area
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "area"
  );
}

export function elementToLead(
  el: OsmElement,
  center: { lat: number; lon: number },
): Lead | null {
  const tags = el.tags ?? {};
  const name = tags.name?.trim();
  if (!name) return null;
  if (el.type !== "node" && el.type !== "way") return null; // relations dropped by design

  const cat = matchCategory(tags);
  if (!cat) return null;

  const lat = el.type === "node" ? el.lat : el.center?.lat;
  const lon = el.type === "node" ? el.lon : el.center?.lon;

  const house = pick(tags, ["addr:housenumber"]);
  const street = pick(tags, ["addr:street"]);
  const unit = pick(tags, ["addr:unit", "addr:flats"]);
  const streetAddress = [[house, street].filter(Boolean).join(" "), unit ? `Unit ${unit}` : ""]
    .filter(Boolean)
    .join(", ");

  const website = pick(tags, ["website", "contact:website", "url", "website:en"]);
  const { tier, platform } = classifyWebsite(website);

  return {
    osm_id: `${el.type}/${el.id}`,
    osm_type: el.type,
    name,
    category: cat.value,
    category_key: cat.key,
    osm_tag: `${cat.key}=${cat.value}`,
    category_group: cat.def.group,
    street_address: streetAddress,
    city: pick(tags, ["addr:city", "addr:town", "addr:village", "addr:suburb", "addr:hamlet"]),
    province: pick(tags, ["addr:province", "addr:state"]),
    postcode: pick(tags, ["addr:postcode"]),
    phone: pick(tags, ["phone", "contact:phone", "contact:mobile"]),
    email: pick(tags, ["email", "contact:email"]),
    website,
    opening_hours: pick(tags, ["opening_hours"]),
    lat: typeof lat === "number" ? lat : null,
    lon: typeof lon === "number" ? lon : null,
    distance_km:
      typeof lat === "number" && typeof lon === "number"
        ? Number(haversineKm(center.lat, center.lon, lat, lon).toFixed(3))
        : null,
    website_tier: tier,
    social_platform: platform,
    site_checked: "no",
    site_verdict: "",
    site_verdict_reason: "",
    http_status: "",
    final_url: "",
    https: "",
    viewport_meta: "",
    page_weight_bytes: "",
    site_evidence: "",
  };
}

// --- dedupe -----------------------------------------------------------------

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function dedupeKey(lead: Lead): string {
  const addr = lead.street_address.replace(/\s+/g, " ").trim().toLowerCase();
  if (addr && lead.city) return `${normName(lead.name)}|${addr}|${lead.city.toLowerCase()}`;
  if (addr) return `${normName(lead.name)}|${addr}`;
  if (lead.lat !== null && lead.lon !== null) {
    return `${normName(lead.name)}|@${lead.lat.toFixed(4)},${lead.lon.toFixed(4)}`;
  }
  return `${normName(lead.name)}|${lead.city.toLowerCase()}`;
}

function richness(l: Lead): number {
  let n = 0;
  for (const v of [l.street_address, l.city, l.phone, l.email, l.website, l.opening_hours, l.postcode]) {
    if (v) n++;
  }
  if (l.osm_type === "node") n += 0.5; // nodes usually carry the addr tags
  return n;
}

/** Merge duplicates by name+address, keeping the richest record's values. */
export function mergeDuplicates(leads: Lead[]): { leads: Lead[]; merged: number } {
  const byKey = new Map<string, Lead>();
  let merged = 0;
  for (const lead of leads) {
    const key = dedupeKey(lead);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, lead);
      continue;
    }
    merged++;
    const [keep, drop] = richness(lead) > richness(existing) ? [lead, existing] : [existing, lead];
    const out: Lead = { ...keep };
    for (const field of [
      "street_address",
      "city",
      "province",
      "postcode",
      "phone",
      "email",
      "website",
      "opening_hours",
    ] as const) {
      if (!out[field] && drop[field]) (out as Record<string, unknown>)[field] = drop[field];
    }
    out.osm_id = `${keep.osm_id}+${drop.osm_id}`;
    out.osm_type = keep.osm_type;
    const recl = classifyWebsite(out.website);
    out.website_tier = recl.tier;
    out.social_platform = recl.platform;
    byKey.set(key, out);
  }
  return { leads: [...byKey.values()], merged };
}
