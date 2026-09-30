#!/usr/bin/env bun
/**
 * Site Sourced — demo generator CLI.
 *
 *   bun run demo -- --record test/fixtures/hamilton-barber.json --out out/demos
 *   bun run demo -- --record test/fixtures --out out/demos
 *
 * One command, one business record, one complete static site. The output folder is
 * simultaneously the demo we send a prospect and the product we hand a client: it
 * opens from disk with no server, and it can be uploaded to any host as it is.
 *
 * See README.md for the record format and every flag.
 */

import { mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { BusinessRecord, LoadedRecord } from "./types.ts";
import { buildBundle, GENERATOR } from "./build.ts";
import { loadEnvFile } from "./env.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, "..", "..");

interface Args {
  records: string[];
  outDir: string;
  cacheDir: string;
  noImages: boolean;
  refresh: boolean;
  formEndpoint: string;
  quiet: boolean;
  summaryJson: string;
  /** Where per-client values such as a form id are read from (gitignored). */
  envFile: string;
  noEnvFile: boolean;
  help: boolean;
}

const HELP = `Site Sourced demo generator

  bun run demo -- --record <file-or-dir> [--record ...] --out out/demos

Flags
  --record <path>       a record JSON file, or a directory of them (repeatable)
  --out <dir>           where bundles are written (default ./out/demos)
  --cache-dir <dir>     image/HTTP cache (default ./out/cache/demo)
  --no-images           skip image sourcing; use the CSS/SVG treatment (no network)
  --refresh             ignore the image cache and re-fetch
  --form-endpoint <url> override every record's form endpoint (used for testing a
                        local relay; never for a real prospect)
  --summary <path>      also write the run summary as JSON
  --env-file <path>     where per-client values are read from (default .env.local)
  --no-env-file         do not read any env file (use the real environment only)
  --quiet
  --help

Record format (one JSON object, or an array, or {"records": [...]}):

  {
    "name": "Maple Avenue Barber Shop",     // required
    "category": "Barber shop",              // required
    "slug": "maple-avenue-barber-shop",     // optional; derived from the name
    "address": { "street": "123 Maple Ave", "city": "Hamilton",
                 "province": "ON", "postcode": "L8P 2A1" },
    "phone": "+1 905-555-0142",
    "email": "shop@example.com",
    "hours": [ { "days": "Mon–Fri", "hours": "9:00 am – 6:00 pm" } ],
    "services": [ { "name": "Haircut", "note": "optional client wording" } ],
    "form_recipient": "the-business@example.com",   // required for a working form
    "form_provider": "formspark",                   // see src/demo/forms.ts
    "form_access_key": "env:SS_FORMSPARK_FORM_ID",  // the id itself lives in
                                                    // gitignored .env.local, never here
    "source_kind": "openstreetmap"                  // REQUIRED before a page prints any
                                                    // detail: openstreetmap | public-listings
                                                    // | fictional. The footer's provenance
                                                    // line and the caveat on the printed
                                                    // contact details are derived from it,
                                                    // and a page may not credit a source the
                                                    // record does not declare.
  }
`;

function parseArgs(argv: string[]): Args {
  const args: Args = {
    records: [],
    outDir: join(PROJECT_ROOT, "out", "demos"),
    cacheDir: join(PROJECT_ROOT, "out", "cache", "demo"),
    noImages: false,
    refresh: false,
    formEndpoint: "",
    quiet: false,
    summaryJson: "",
    envFile: join(PROJECT_ROOT, ".env.local"),
    noEnvFile: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "--record": case "-r": args.records.push(resolve(next())); break;
      case "--out": case "-o": args.outDir = resolve(next()); break;
      case "--cache-dir": args.cacheDir = resolve(next()); break;
      case "--form-endpoint": args.formEndpoint = next(); break;
      case "--summary": args.summaryJson = resolve(next()); break;
      case "--env-file": args.envFile = resolve(next()); break;
      case "--no-env-file": args.noEnvFile = true; break;
      case "--no-images": args.noImages = true; break;
      case "--refresh": args.refresh = true; break;
      case "--quiet": case "-q": args.quiet = true; break;
      case "--help": case "-h": args.help = true; break;
      default:
        if (a.startsWith("--")) throw new Error(`Unknown flag ${a} (try --help)`);
    }
  }
  return args;
}

function log(args: Args, msg: string, force = false) {
  if (!args.quiet || force) process.stderr.write(`${msg}\n`);
}

/** Accepts a single record, an array, or {"records": [...]} — and a directory of them. */
async function loadRecords(paths: string[]): Promise<LoadedRecord[]> {
  const out: LoadedRecord[] = [];
  for (const path of paths) {
    const info = await stat(path);
    const files: string[] = [];
    if (info.isDirectory()) {
      for (const entry of (await readdir(path)).sort()) {
        if (entry.toLowerCase().endsWith(".json")) files.push(join(path, entry));
      }
      if (files.length === 0) throw new Error(`no *.json records in ${path}`);
    } else {
      files.push(path);
    }

    for (const file of files) {
      const parsed = JSON.parse(await Bun.file(file).text()) as unknown;
      const list = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown[] }).records)
          ? (parsed as { records: unknown[] }).records
          : [parsed];
      for (const item of list) {
        const record = item as BusinessRecord;
        if (!record || typeof record.name !== "string" || typeof record.category !== "string") {
          throw new Error(`${file}: every record needs at least a "name" and a "category" string`);
        }
        if (!record.form_recipient) throw new Error(`${file}: record "${record.name}" has no form_recipient — the form would have nowhere to deliver`);
        out.push({ path: file, record });
      }
    }
  }
  return out;
}

interface RunSummary {
  generator: string;
  generated_at: string;
  out_dir: string;
  count: number;
  bundles: { slug: string; dir: string; files: string[]; bytes: number; images: number; warnings: string[] }[];
  failures: { record: string; error: string }[];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  if (args.records.length === 0) {
    process.stdout.write(HELP);
    throw new Error("nothing to do — pass at least one --record");
  }

  await mkdir(args.outDir, { recursive: true });
  await mkdir(args.cacheDir, { recursive: true });

  const records = await loadRecords(args.records);
  log(args, `${records.length} record(s) to build.`);

  const summary: RunSummary = {
    generator: GENERATOR,
    generated_at: new Date().toISOString(),
    out_dir: args.outDir,
    count: 0,
    bundles: [],
    failures: [],
  };

  for (const { record, path } of records) {
    const effective: BusinessRecord = args.formEndpoint ? { ...record, form_endpoint: args.formEndpoint } : record;
    if (args.formEndpoint) {
      log(args, `note: overriding the form endpoint with ${args.formEndpoint} (test mode)`);
    }
    try {
      const result = await buildBundle(effective, {
        outRoot: args.outDir,
        cacheDir: args.cacheDir,
        recordDir: dirname(path),
        noImages: args.noImages,
        refresh: args.refresh,
        onNote: (m) => log(args, `  ${m}`),
      });
      for (const w of result.warnings) log(args, `  ! ${w}`);
      summary.bundles.push({
        slug: result.slug,
        dir: result.dir,
        files: result.files,
        bytes: result.bytes,
        images: result.images.filter((i) => i.file).length,
        warnings: result.warnings,
      });
      summary.count++;
      log(args, `built ${result.slug} (${result.files.length} files, ${(result.bytes / 1024).toFixed(0)} KB)`, true);
    } catch (err) {
      summary.failures.push({ record: path, error: (err as Error).message });
      log(args, `FAILED ${path}: ${(err as Error).message}`, true);
    }
  }

  if (args.summaryJson) await Bun.write(args.summaryJson, JSON.stringify(summary, null, 2) + "\n");

  process.stdout.write(
    [
      `Records : ${records.length}`,
      `Built   : ${summary.count}`,
      `Failed  : ${summary.failures.length}`,
      ...summary.bundles.map((b) => `  ${b.slug} → ${b.dir}  (${b.files.length} files, ${(b.bytes / 1024).toFixed(0)} KB)`),
      `Out dir : ${args.outDir}`,
      "",
    ].join("\n"),
  );
  if (summary.failures.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`\ndemo generator failed: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
