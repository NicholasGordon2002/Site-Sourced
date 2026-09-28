#!/usr/bin/env bun
/**
 * Site Sourced — lead engine CLI.
 *
 *   bun run leads -- --area "Hamilton, ON" --radius 8km
 *
 * See README.md for every flag and every output field.
 */

import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { circleBBox, geocodeArea, haversineKm, parseRadius } from "./geo.ts";
import { buildOverpassQueries, fetchOverpass } from "./overpass.ts";
import { dedupeKey, elementToLead, mergeDuplicates, slugifyArea } from "./classify.ts";
import { checkSite } from "./health.ts";
import { writeOutputs } from "./output.ts";
import type { Lead, RunSummary } from "./types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, "..");
const GENERATOR = "sitesourced-lead-engine/0.1";

interface Args {
  area: string;
  radiusKm: number;
  center: string;
  outDir: string;
  cacheDir: string;
  maxChecks: number;
  concurrency: number;
  cacheTtlHours: number;
  refresh: boolean;
  noHealth: boolean;
  respectRobots: boolean;
  limit: number;
  queryMode: "auto" | "union" | "chunks";
  quiet: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    area: "Hamilton, ON",
    radiusKm: 8,
    center: "",
    outDir: join(PROJECT_ROOT, "out"),
    cacheDir: join(PROJECT_ROOT, "out", "cache"),
    maxChecks: 150,
    concurrency: 6,
    cacheTtlHours: 168,
    refresh: false,
    noHealth: false,
    respectRobots: true,
    limit: 0,
    queryMode: "auto",
    quiet: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "--area": case "-a": args.area = next(); break;
      case "--radius": case "-r": args.radiusKm = parseRadius(next()); break;
      case "--center": args.center = next(); break;
      case "--out": args.outDir = resolve(next()); break;
      case "--cache-dir": args.cacheDir = resolve(next()); break;
      case "--max-checks": args.maxChecks = Number(next()); break;
      case "--concurrency": args.concurrency = Math.max(1, Number(next())); break;
      case "--cache-ttl-hours": args.cacheTtlHours = Number(next()); break;
      case "--limit": args.limit = Number(next()); break;
      case "--query-mode": {
        const v = next();
        if (v !== "auto" && v !== "union" && v !== "chunks") throw new Error("--query-mode must be auto, union or chunks");
        args.queryMode = v;
        break;
      }
      case "--refresh": args.refresh = true; break;
      case "--no-health": args.noHealth = true; break;
      case "--respect-robots": args.respectRobots = true; break;
      case "--no-respect-robots": args.respectRobots = false; break;
      case "--quiet": case "-q": args.quiet = true; break;
      case "--help": case "-h": args.help = true; break;
      default:
        if (a.startsWith("--")) throw new Error(`Unknown flag ${a} (try --help)`);
    }
  }
  if (!Number.isFinite(args.radiusKm) || args.radiusKm <= 0) throw new Error("--radius must be > 0");
  if (!Number.isFinite(args.maxChecks) || args.maxChecks < 0) throw new Error("--max-checks must be >= 0");
  return args;
}

const HELP = `Site Sourced lead engine

  bun run leads -- --area "Hamilton, ON" --radius 8km

Flags
  --area <text>            Ontario area name (default "Hamilton, ON")
  --radius <8km|5000m|5mi> circle radius around the area centre (default 8km)
  --center <lat,lon>       skip geocoding and use this centre
  --out <dir>              output directory (default ./out)
  --cache-dir <dir>        HTTP cache directory (default ./out/cache)
  --cache-ttl-hours <n>    how long cached responses stay fresh (default 168h)
  --refresh                ignore the cache for this run
  --max-checks <n>         cap how many websites get a health check (default 150, 0 = no cap)
  --concurrency <n>        parallel site checks (default 6; one request per host at a time)
  --no-health              skip site health checks entirely
  --[no-]respect-robots    honour robots.txt before checking a site (default: honour)
  --query-mode <m>         auto (default: one union request, chunks on failure), union, chunks
  --limit <n>              cap the number of leads written (0 = no cap)
  --quiet                  less progress output
  --help
`;

function log(args: Args, msg: string, force = false) {
  if (!args.quiet || force) process.stderr.write(`${msg}\n`);
}

function parseCenter(raw: string): { lat: number; lon: number } | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(raw);
  if (!m) return null;
  return { lat: Number(m[1]), lon: Number(m[2]) };
}

/** Run an async mapper over items with a worker pool; never rejects. */
async function pool<T, R>(items: T[], size: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  await mkdir(args.outDir, { recursive: true });
  await mkdir(args.cacheDir, { recursive: true });
  const ttl = args.cacheTtlHours * 3600 * 1000;
  const slug = slugifyArea(args.area);

  // 1. Locate the area ------------------------------------------------------
  const override = parseCenter(args.center);
  let centre: { lat: number; lon: number; displayName: string };
  if (override) {
    centre = { ...override, displayName: `manual centre ${override.lat},${override.lon}` };
    log(args, `Centre: ${centre.displayName} (manual)`);
  } else {
    log(args, `Geocoding "${args.area}" …`);
    const geo = await geocodeArea(args.area, { cacheDir: args.cacheDir, refresh: args.refresh, onNote: (m) => log(args, m) });
    centre = { lat: geo.lat, lon: geo.lon, displayName: geo.displayName };
    log(args, `Centre: ${centre.displayName} (${centre.lat.toFixed(5)}, ${centre.lon.toFixed(5)})`);
  }

  // 2. Pull POIs from Overpass ---------------------------------------------
  const bbox = circleBBox(centre.lat, centre.lon, args.radiusKm);
  log(args, `Querying Overpass for business POIs within ${args.radiusKm}km (one request at a time) …`);
  const overpass = await fetchOverpass(bbox, {
    cacheDir: args.cacheDir,
    refresh: args.refresh,
    mode: args.queryMode,
    onNote: (m) => log(args, m),
  });
  const failedChunks = overpass.chunks.filter((c) => !c.ok);
  log(
    args,
    `Overpass (${overpass.strategy}) returned ${overpass.elements.length} elements` +
      `${overpass.fromCache ? ` (${overpass.fromCache} cached)` : ""}${failedChunks.length ? `, ${failedChunks.length} chunk(s) failed` : ""}.`,
  );
  for (const c of failedChunks) log(args, `  ! ${c.label}: ${c.error}`);

  // 3. Elements -> leads, filtered to the true circle -----------------------
  const seen = new Set<string>();
  const raw: Lead[] = [];
  for (const el of overpass.elements) {
    const elId = `${el.type}/${el.id}`;
    if (seen.has(elId)) continue; // an element tagged with two matching keys
    seen.add(elId);
    let lead: Lead | null = null;
    try {
      lead = elementToLead(el, centre);
    } catch {
      continue; // one malformed element must never kill the run
    }
    if (!lead) continue;
    if (lead.distance_km !== null && lead.distance_km > args.radiusKm) continue;
    raw.push(lead);
  }
  const { leads, merged } = mergeDuplicates(raw);
  log(args, `${raw.length} POIs parsed, ${merged} duplicates merged -> ${leads.length} leads.`);

  leads.sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9) || a.name.localeCompare(b.name));

  // 4. Site health checks ---------------------------------------------------
  const counts: Record<string, number> = {
    total: leads.length,
    no_website: 0,
    social_only: 0,
    has_website: 0,
  };
  for (const l of leads) counts[l.website_tier] = (counts[l.website_tier] ?? 0) + 1;

  const toCheck = leads.filter((l) => l.website_tier === "has_website");
  const checkList = args.noHealth ? [] : args.maxChecks > 0 ? toCheck.slice(0, args.maxChecks) : toCheck;

  if (checkList.length > 0) {
    log(args, `Checking ${checkList.length} websites (concurrency ${args.concurrency}, robots.txt ${args.respectRobots ? "honoured" : "ignored"}) …`);
    let done = 0;
    await pool(checkList, args.concurrency, async (lead) => {
      try {
        const res = await checkSite(lead.website, {
          cacheDir: args.cacheDir,
          refresh: args.refresh,
          respectRobots: args.respectRobots,
          onNote: (m) => log(args, m),
        });
        lead.site_checked = res.checked ? "yes" : "no";
        lead.site_verdict = res.verdict;
        lead.site_verdict_reason = res.reason;
        lead.http_status = res.http_status;
        lead.final_url = res.final_url;
        lead.https = res.https;
        lead.viewport_meta = res.viewport_meta;
        lead.page_weight_bytes = res.page_weight_bytes;
        lead.site_evidence = res.evidence.join(" | ");
      } catch (err) {
        // A failed site check is data, not a crash.
        lead.site_checked = "no";
        lead.site_verdict = "dead";
        lead.site_verdict_reason = `check failed: ${(err as Error).message}`;
        lead.site_evidence = String((err as Error).message).slice(0, 200);
      }
      done++;
      log(args, `  [${done}/${checkList.length}] ${lead.name} → ${lead.site_verdict} (${lead.site_verdict_reason.slice(0, 70)})`);
    });
  } else if (toCheck.length > 0) {
    log(args, `${toCheck.length} leads have a website; health checks skipped (${args.noHealth ? "--no-health" : "--max-checks 0"}).`);
  }
  for (const l of leads) {
    if (l.website_tier === "has_website" && l.site_verdict === "") {
      // Not checked is NOT the same as "ok". Say so.
      l.site_verdict_reason = l.site_verdict_reason || "not checked (beyond --max-checks, or --no-health)";
    }
  }

  let final = leads;
  if (args.limit > 0) final = leads.slice(0, args.limit);
  for (const l of final) {
    const bucket = l.site_verdict || "unchecked";
    counts[`verdict_${bucket}`] = (counts[`verdict_${bucket}`] ?? 0) + 1;
  }

  // 5. Write outputs --------------------------------------------------------
  const summary: RunSummary = {
    area: args.area,
    area_slug: slug,
    center: { lat: centre.lat, lon: centre.lon, display_name: centre.displayName },
    radius_km: args.radiusKm,
    generated_at: new Date().toISOString(),
    generator: GENERATOR,
    attribution:
      "Business data © OpenStreetMap contributors, available under the Open Database License (ODbL) 1.0 — https://www.openstreetmap.org/copyright",
    counts,
    leads: final,
  };
  const paths = await writeOutputs(args.outDir, slug, summary);

  const verdicts = Object.entries(counts)
    .filter(([k]) => k.startsWith("verdict_"))
    .map(([k, v]) => `${k.replace("verdict_", "")}=${v}`)
    .join(" ");

  process.stdout.write(
    [
      `Area        : ${args.area} (${centre.lat.toFixed(4)}, ${centre.lon.toFixed(4)}) ± ${args.radiusKm}km`,
      `Leads       : ${final.length}`,
      `Website tier: no_website=${counts.no_website ?? 0} social_only=${counts.social_only ?? 0} has_website=${counts.has_website ?? 0}`,
      `Site verdict: ${verdicts}`,
      `Rows written: ${paths.csv}`,
      `              ${paths.json}`,
      "",
    ].join("\n"),
  );
}

main().catch((err) => {
  process.stderr.write(`\nlead engine failed: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
