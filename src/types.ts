/**
 * Shared types for the Site Sourced lead engine.
 *
 * Every field that ends up in the CSV is a string (or a number for coordinates)
 * so that the CSV and the JSON hit exactly the same shape.
 */

export type WebsiteTier = "no_website" | "social_only" | "has_website";

/** Verdicts for leads whose website tag points at a site we own the check for. */
export type SiteVerdict = "ok" | "outdated" | "dead" | "parked";

export interface Lead {
  osm_id: string;
  osm_type: string;
  name: string;
  /** Human-readable category slug, e.g. `hairdresser`. */
  category: string;
  /** The OSM key the category came from: shop / amenity / craft / office / healthcare / leisure. */
  category_key: string;
  /** e.g. `shop=hairdresser` */
  osm_tag: string;
  category_group: string;
  street_address: string;
  city: string;
  province: string;
  postcode: string;
  phone: string;
  email: string;
  website: string;
  opening_hours: string;
  lat: number | null;
  lon: number | null;
  distance_km: number | null;

  website_tier: WebsiteTier;
  /** facebook / instagram / linktree / ... — only for website_tier === "social_only". */
  social_platform: string;

  /** Did we actually perform a network check of the site? */
  site_checked: string; // "yes" | "no"
  /** "" when the lead has no site to check (no_website / social_only). */
  site_verdict: SiteVerdict | "";
  site_verdict_reason: string;
  http_status: string;
  final_url: string;
  https: string; // "yes" | "no" | ""
  viewport_meta: string; // "yes" | "no" | ""
  page_weight_bytes: string;
  site_evidence: string;
}

export interface HttpRecord {
  url: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
  byteLength: number;
  byteLengthExact: boolean;
  truncated: boolean;
  redirected: boolean;
  error: string | null;
  errorKind: string;
  fetchedAt: string;
  fromCache?: boolean;
}

export interface RunSummary {
  area: string;
  area_slug: string;
  center: { lat: number; lon: number; display_name: string };
  radius_km: number;
  generated_at: string;
  generator: string;
  attribution: string;
  counts: Record<string, number>;
  leads: Lead[];
}
