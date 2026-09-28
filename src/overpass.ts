/**
 * OpenStreetMap Overpass API: business POIs for one Ontario area.
 *
 * Only OSM/Overpass is queried in this phase. Google Maps and any other site
 * whose terms forbid automated access is deliberately out of scope.
 *
 * Overpass etiquette implemented here:
 *  - exactly ONE request per run (plus retries), never in parallel,
 *  - descriptive User-Agent,
 *  - every response cached on disk, so a re-run makes zero requests,
 *  - retry with exponential backoff on 429/5xx and network errors.
 */

import { politeFetch, sleep } from "./http.ts";
import type { BBox } from "./geo.ts";

export interface CategoryDef {
  /** `shop`, `amenity`, `craft`, `office`, `healthcare`, `leisure` */
  key: string;
  /** sorted-ish list of OSM values under that key */
  values: string[];
  /** human grouping used in reports */
  group: string;
}

/**
 * Categories likely to need a website. Kept as a curated allow-list rather than
 * `["shop"]` wildcards so the lead list stays explainable and the Overpass query
 * stays cheap.
 */
export const CATEGORIES: CategoryDef[] = [
  {
    key: "amenity",
    group: "Food & drink",
    values: [
      "restaurant",
      "cafe",
      "fast_food",
      "bar",
      "pub",
      "ice_cream",
      "biergarten",
      "food_court",
    ],
  },
  {
    key: "amenity",
    group: "Services",
    values: [
      "veterinary",
      "car_wash",
      "driving_school",
      "childcare",
      "kindergarten",
      "music_school",
      "language_school",
      "photo_booth",
      "funeral_hall",
      "events_venue",
    ],
  },
  {
    key: "shop",
    group: "Salons & barbers",
    values: ["hairdresser", "barber", "beauty", "nail_salon", "spa", "massage", "tattoo", "cosmetics"],
  },
  {
    key: "shop",
    group: "Auto services",
    values: ["car_repair", "tyres", "car_parts", "car", "motorcycle_repair", "truck_repair", "motorcycle"],
  },
  {
    key: "shop",
    group: "Pet services",
    values: ["pet", "pet_grooming", "veterinary"],
  },
  {
    key: "shop",
    group: "Retail shops",
    values: [
      "bakery",
      "butcher",
      "florist",
      "clothes",
      "shoes",
      "hardware",
      "doityourself",
      "furniture",
      "jewelry",
      "optician",
      "bicycle",
      "electronics",
      "mobile_phone",
      "computer",
      "dry_cleaning",
      "laundry",
      "tailor",
      "shoe_repair",
      "paint",
      "carpet",
      "appliance",
      "garden_centre",
      "toys",
      "gift",
      "sports",
      "musical_instrument",
      "fabric",
      "hearing_aids",
      "travel_agency",
      "variety_store",
      "convenience",
      "greengrocer",
      "books",
      "stationery",
      "photo",
    ],
  },
  {
    key: "craft",
    group: "Trades & contractors",
    values: [
      "plumber",
      "electrician",
      "hvac",
      "carpenter",
      "joiner",
      "roofer",
      "painter",
      "gardener",
      "builder",
      "welder",
      "locksmith",
      "glaziery",
      "metal_construction",
      "window_construction",
      "tiler",
      "plasterer",
      "insulation",
      "floorer",
      "stonemason",
      "scaffolder",
      "sign_maker",
      "electronics_repair",
      "cleaning",
    ],
  },
  {
    key: "healthcare",
    group: "Health & clinics",
    values: [
      "dentist",
      "clinic",
      "doctor",
      "physiotherapist",
      "optometrist",
      "podiatrist",
      "chiropractor",
      "psychotherapist",
      "psychologist",
      "speech_therapist",
      "audiologist",
      "midwife",
      "alternative",
      "veterinary",
      "pharmacy",
      "laboratory",
    ],
  },
  {
    key: "leisure",
    group: "Fitness & leisure",
    values: ["fitness_centre", "sports_centre", "dance", "horse_riding", "ice_rink", "bowling_alley"],
  },
  {
    key: "office",
    group: "Professional services",
    values: [
      "accountant",
      "tax_advisor",
      "insurance",
      "financial",
      "lawyer",
      "notary",
      "estate_agent",
      "architect",
      "engineer",
      "surveyor",
      "property_management",
      "employment_agency",
      "travel_agent",
      "it",
      "advertising_agency",
      "consulting",
    ],
  },
];

/** Reverse lookup: `shop=hairdresser` -> the definition it belongs to. */
const LOOKUP = new Map<string, CategoryDef>();
for (const def of CATEGORIES) {
  for (const v of def.values) {
    const k = `${def.key}=${v}`;
    if (!LOOKUP.has(k)) LOOKUP.set(k, def);
  }
}

export function lookupCategory(key: string, value: string): CategoryDef | undefined {
  return LOOKUP.get(`${key}=${value}`);
}

/** Very light escaping — our value lists are plain lowercase identifiers. */
function alternatives(values: string[]): string {
  return `^(${values.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`;
}

export function bboxString(bbox: BBox): string {
  return `(${bbox.south.toFixed(6)},${bbox.west.toFixed(6)},${bbox.north.toFixed(6)},${bbox.east.toFixed(6)})`;
}

export interface QueryChunk {
  /** OSM tag key this chunk covers (amenity, shop, …), or `union` for the all-in-one query */
  key: string;
  label: string;
  values: string[];
  query: string;
}

/** One key -> one value list, in CATEGORIES order. */
function valuesByKey(): Map<string, string[]> {
  const byKey = new Map<string, string[]>();
  for (const def of CATEGORIES) {
    const list = byKey.get(def.key) ?? [];
    byKey.set(def.key, list);
    for (const v of def.values) if (!list.includes(v)) list.push(v);
  }
  return byKey;
}

/**
 * The single-request form: one union over every tag key. Cheapest possible for
 * the public endpoints (one request per run) — used first.
 */
export function buildUnionQuery(bbox: BBox, timeoutSec = 180): QueryChunk {
  const b = bboxString(bbox);
  const parts: string[] = [];
  let values = 0;
  for (const [key, vals] of valuesByKey()) {
    values += vals.length;
    parts.push(`  nw["${key}"~"${alternatives(vals)}"]["name"]${b};`);
  }
  return {
    key: "union",
    label: `union (${parts.length} keys, ${values} values)`,
    values: [],
    query: [`[out:json][timeout:${timeoutSec}];`, "(", ...parts, ");", "out center tags;", ""].join("\n"),
  };
}

/**
 * One request per tag key. Used as the fallback when the union 504s: each chunk
 * is small, so a slow endpoint still answers most of them, and a chunk that
 * fails only costs us that one category.
 */
export function buildOverpassQueries(bbox: BBox, timeoutSec = 90): QueryChunk[] {
  const b = bboxString(bbox);
  const chunks: QueryChunk[] = [];
  for (const [key, values] of valuesByKey()) {
    const query = [
      `[out:json][timeout:${timeoutSec}];`,
      `nw["${key}"~"${alternatives(values)}"]["name"]${b};`,
      "out center tags;",
      "",
    ].join("\n");
    chunks.push({ key, label: `${key} (${values.length} values)`, values, query });
  }
  return chunks;
}

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassResult {
  elements: OsmElement[];
  fromCache: number;
  chunks: Array<{ label: string; ok: boolean; elements: number; error: string; fromCache: boolean }>;
  generator: string;
}

/**
 * Public Overpass instances, tried in order. A single endpoint having a bad day
 * (504s under load) must not take the run down with it.
 */
export const DEFAULT_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export async function fetchChunk(
  chunk: QueryChunk,
  opts: {
    cacheDir: string;
    refresh?: boolean;
    onNote?: (m: string) => void;
    endpoints?: string[];
    timeoutMs?: number;
    retries?: number;
  },
): Promise<{ elements: OsmElement[]; generator: string; fromCache: boolean; endpoint: string }> {
  const endpoints = (opts.endpoints ?? DEFAULT_ENDPOINTS).filter(Boolean);
  const errors: string[] = [];

  for (const endpoint of endpoints) {
    const rec = await politeFetch({
      url: endpoint,
      method: "POST",
      body: `data=${encodeURIComponent(chunk.query)}`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      cacheDir: opts.cacheDir,
      cacheTtlMs: 7 * 24 * 3600 * 1000,
      // A 504 from a busy mirror must never be replayed from cache as if it
      // were the truth — always re-ask.
      errorCacheTtlMs: 0,
      refresh: opts.refresh,
      timeoutMs: opts.timeoutMs ?? 90_000,
      maxBytes: 128 * 1024 * 1024,
      retries: opts.retries ?? 1,
      backoffMs: 3000,
      label: `overpass ${chunk.key}`,
      onNote: opts.onNote,
    });

    if (rec.error) {
      errors.push(`${new URL(endpoint).host}: ${rec.error}`);
      continue;
    }
    if (rec.status !== 200) {
      const snippet = rec.body
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      errors.push(`${new URL(endpoint).host}: HTTP ${rec.status}${snippet ? ` (${snippet})` : ""}`);
      continue;
    }
    try {
      const parsed = JSON.parse(rec.body) as { elements?: OsmElement[]; generator?: string };
      return {
        elements: parsed.elements ?? [],
        generator: parsed.generator ?? "",
        fromCache: Boolean(rec.fromCache),
        endpoint,
      };
    } catch {
      errors.push(`${new URL(endpoint).host}: non-JSON response`);
    }
  }
  throw new Error(errors.join("; ") || "no Overpass endpoint configured");
}

export interface FetchAllResult {
  elements: OsmElement[];
  fromCache: number;
  strategy: string;
  chunks: Array<{ label: string; ok: boolean; elements: number; error: string; fromCache: boolean }>;
  generator: string;
}

function dedupeElements(elements: OsmElement[]): OsmElement[] {
  const seen = new Set<string>();
  const out: OsmElement[] = [];
  for (const el of elements) {
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(el);
  }
  return out;
}

/**
 * Get the POIs.
 *
 * Public Overpass instances answer a big union query with an Apache 504 when they
 * are busy, so we try the cheap one-request union first and only fall back to
 * per-tag-key chunks if that fails. Either way the run continues with whatever
 * we got: a dead Overpass degrades the lead list, it does not crash the run.
 */
export async function fetchOverpass(
  bbox: BBox,
  opts: {
    cacheDir: string;
    refresh?: boolean;
    onNote?: (m: string) => void;
    endpoints?: string[];
    pauseMs?: number;
    mode?: "auto" | "union" | "chunks";
  },
): Promise<FetchAllResult> {
  const report: FetchAllResult["chunks"] = [];
  let fromCache = 0;
  let generator = "";
  const mode = opts.mode ?? "auto";

  if (mode !== "chunks") {
    const union = buildUnionQuery(bbox);
    opts.onNote?.(`  trying ${union.label} in one request …`);
    try {
      const res = await fetchChunk(union, { ...opts, timeoutMs: 120_000, retries: 0 });
      if (res.fromCache) fromCache++;
      generator = res.generator;
      report.push({ label: union.label, ok: true, elements: res.elements.length, error: "", fromCache: res.fromCache });
      opts.onNote?.(`  ${union.label}: ${res.elements.length} elements${res.fromCache ? " (cached)" : ""}`);
      return { elements: dedupeElements(res.elements), fromCache, strategy: "union", chunks: report, generator };
    } catch (err) {
      report.push({ label: union.label, ok: false, elements: 0, error: (err as Error).message, fromCache: false });
      opts.onNote?.(`  ${union.label}: FAILED — ${(err as Error).message}`);
      if (mode === "union") {
        return { elements: [], fromCache, strategy: "union", chunks: report, generator };
      }
      opts.onNote?.("  falling back to one request per tag key …");
    }
  }

  const chunks = buildOverpassQueries(bbox);
  const elements: OsmElement[] = [];
  let consecutiveFailures = 0;

  for (const chunk of chunks) {
    // Two dead chunks in a row means the endpoint itself is down; stop early
    // rather than burning ten minutes of retries nobody will read.
    if (consecutiveFailures >= 2) {
      report.push({ label: chunk.label, ok: false, elements: 0, error: "skipped — endpoint unavailable", fromCache: false });
      continue;
    }
    if (!opts.refresh) await sleep(opts.pauseMs ?? 1500); // one request at a time, politely
    try {
      const res = await fetchChunk(chunk, { ...opts, timeoutMs: 60_000, retries: 1 });
      elements.push(...res.elements);
      if (res.fromCache) fromCache++;
      generator = generator || res.generator;
      consecutiveFailures = 0;
      report.push({ label: chunk.label, ok: true, elements: res.elements.length, error: "", fromCache: res.fromCache });
      opts.onNote?.(`  ${chunk.label}: ${res.elements.length} elements${res.fromCache ? " (cached)" : ""}`);
    } catch (err) {
      // A failed chunk degrades coverage; it must not kill the run.
      consecutiveFailures++;
      report.push({ label: chunk.label, ok: false, elements: 0, error: (err as Error).message, fromCache: false });
      opts.onNote?.(`  ${chunk.label}: FAILED — ${(err as Error).message}`);
    }
  }

  return { elements: dedupeElements(elements), fromCache, strategy: "chunks", chunks: report, generator };
}
