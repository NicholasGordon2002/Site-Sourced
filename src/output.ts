/**
 * CSV + JSON output. No dependencies: the CSV writer quotes/escapes by hand.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Lead, RunSummary } from "./types.ts";

export const COLUMNS: Array<[string, keyof Lead]> = [
  ["osm_id", "osm_id"],
  ["osm_type", "osm_type"],
  ["name", "name"],
  ["category", "category"],
  ["category_key", "category_key"],
  ["category_group", "category_group"],
  ["osm_tag", "osm_tag"],
  ["street_address", "street_address"],
  ["city", "city"],
  ["province", "province"],
  ["postcode", "postcode"],
  ["phone", "phone"],
  ["email", "email"],
  ["website", "website"],
  ["opening_hours", "opening_hours"],
  ["lat", "lat"],
  ["lon", "lon"],
  ["distance_km", "distance_km"],
  ["website_tier", "website_tier"],
  ["social_platform", "social_platform"],
  ["site_checked", "site_checked"],
  ["site_verdict", "site_verdict"],
  ["site_verdict_reason", "site_verdict_reason"],
  ["http_status", "http_status"],
  ["final_url", "final_url"],
  ["https", "https"],
  ["viewport_meta", "viewport_meta"],
  ["page_weight_bytes", "page_weight_bytes"],
  ["site_evidence", "site_evidence"],
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(leads: Lead[]): string {
  const head = COLUMNS.map(([h]) => h).join(",");
  const rows = leads.map((l) => COLUMNS.map(([, k]) => csvCell(l[k])).join(","));
  return [head, ...rows].join("\n") + "\n";
}

export interface OutputPaths {
  csv: string;
  json: string;
}

export async function writeOutputs(outDir: string, slug: string, summary: RunSummary): Promise<OutputPaths> {
  await mkdir(outDir, { recursive: true });
  const csv = join(outDir, `leads-${slug}.csv`);
  const json = join(outDir, `leads-${slug}.json`);
  const { leads, ...meta } = summary;
  await writeFile(csv, toCsv(leads), "utf8");
  await writeFile(json, JSON.stringify({ ...meta, leads }, null, 2), "utf8");
  return { csv, json };
}
