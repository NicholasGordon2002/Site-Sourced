/**
 * Area geocoding (Nominatim) + radius/bbox maths.
 *
 * Nominatim's usage policy: max 1 request/second, real User-Agent, cache results.
 * We make exactly one request per distinct area string and cache it on disk, so
 * a re-run makes zero.
 */

import { join } from "node:path";
import { politeFetch } from "./http.ts";

export interface GeoPoint {
  lat: number;
  lon: number;
  displayName: string;
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

const EARTH_KM_PER_DEG_LAT = 110.574;

export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371.0088;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Radius in km -> a lat/lon bounding box that fully contains the circle. */
export function circleBBox(lat: number, lon: number, radiusKm: number): BBox {
  const dLat = radiusKm / EARTH_KM_PER_DEG_LAT;
  const cos = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const dLon = radiusKm / (EARTH_KM_PER_DEG_LAT * cos);
  return {
    south: lat - dLat,
    west: lon - dLon,
    north: lat + dLat,
    east: lon + dLon,
  };
}

export function parseRadius(raw: string | undefined, fallbackKm = 8): number {
  if (!raw) return fallbackKm;
  const m = /^\s*([0-9]*\.?[0-9]+)\s*(km|mi|m)?\s*$/i.exec(raw);
  if (!m) throw new Error(`Cannot parse radius "${raw}" (try 8km, 5000m or 5mi)`);
  const n = Number(m[1]);
  const unit = (m[2] ?? "km").toLowerCase();
  if (unit === "mi") return n * 1.609344;
  if (unit === "m") return n / 1000;
  return n;
}

export async function geocodeArea(
  area: string,
  opts: { cacheDir: string; refresh?: boolean; onNote?: (m: string) => void },
): Promise<GeoPoint> {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q: area.includes("Canada") ? area : `${area}, Canada`,
      format: "jsonv2",
      limit: "1",
      countrycodes: "ca",
    }).toString();

  const rec = await politeFetch({
    url,
    cacheDir: opts.cacheDir,
    cacheTtlMs: 365 * 24 * 3600 * 1000,
    refresh: opts.refresh,
    timeoutMs: 25000,
    retries: 2,
    label: `geocode "${area}"`,
    onNote: opts.onNote,
  });

  if (rec.error) throw new Error(`Geocoding failed for "${area}": ${rec.error}`);
  if (rec.status !== 200) throw new Error(`Geocoding failed for "${area}": HTTP ${rec.status}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rec.body);
  } catch {
    throw new Error(`Geocoding returned non-JSON for "${area}"`);
  }
  const rows = Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  if (rows.length === 0) throw new Error(`No area matched "${area}" (Nominatim returned 0 results)`);

  const row = rows[0];
  return {
    lat: Number(row.lat),
    lon: Number(row.lon),
    displayName: String(row.display_name ?? area),
  };
}

export function cachePathFor(root: string, ...parts: string[]): string {
  return join(root, ...parts);
}
