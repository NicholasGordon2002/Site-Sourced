/**
 * Site Sourced — imagery.
 *
 * The rule is absolute: copyright-free only. Two sources are searched, in order,
 * and only images whose licence is **CC0 or public domain (no attribution,
 * commercial use)** are accepted — anything else is skipped, however good it is:
 *
 *   1. Openverse   (https://api.openverse.org) — aggregates CC0 / Public Domain
 *      Mark photographs, mostly modern; licence and creator come from the API.
 *   2. Wikimedia Commons — the licence is re-read from the file's own metadata
 *      (LicenseShortName / UsageTerms), never from the file name.
 *
 * The chosen file is downloaded once at generation time and stored in the bundle.
 * Nothing is hot-linked, and a business's own logo or photograph is never a
 * candidate — we search generic, category-level phrases ("barber shop interior").
 *
 * If nothing clean is found, the page falls back to a CSS/SVG treatment and the
 * manifest says so. A bad or doubtful photo is worse than none.
 */

import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { extname, join } from "node:path";

import type { BusinessRecord, ImageOverride, ManifestImage } from "./types.ts";
import { normaliseServices, profileFor } from "./copy.ts";

const OPENVERSE_API = "https://api.openverse.org/v1/images/";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT =
  process.env.SS_USER_AGENT ??
  "SiteSourced-DemoGenerator/0.1 (Ontario local-business demo sites; CC0/public-domain imagery only; contact: site-sourced-311e0184@ctomail.io)";

/**
 * The hard cap on a single image file in a bundle, whatever its source: a file over
 * this is not a demo hero, it is a mistake. Downloaded candidates are checked as they
 * are fetched; supplied files (see supplied.ts) are checked when the bundle is built,
 * because a hand-supplied 2.6 MB hero is exactly how a 2.7 MB page shipped once.
 */
export const MAX_IMAGE_BYTES = 700 * 1024;

const HISTORICAL = /histor|vintage|archiv|\b(18|19)\d\d\b|museum|military|servicemen|army|navy|prison|captive|guantanamo|nara\b|lccn|dvid|dod\b|second world war|wwii|war\b/i;


export interface ImageFile {
  path: string;
  bytes: Uint8Array;
}

/**
 * What a file's bytes actually are, whatever its name says.
 *
 * A `.jpg` whose bytes are a PNG is a bug on its own — a browser, a linter and a CDN
 * all disagree about what the file is — and it was how the first fixtures shipped.
 * The build compares this against the file extension and refuses a mismatch.
 */
export function sniffImageFormat(bytes: Uint8Array): "png" | "jpeg" | "webp" | null {
  if (bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes.length > 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  return null;
}

/** The extension a file of this format should carry, or null when we do not know it. */
export function extensionForFormat(format: "png" | "jpeg" | "webp" | null): string | null {
  return format === "png" ? ".png" : format === "jpeg" ? ".jpg" : format === "webp" ? ".webp" : null;
}

/**
 * The pixel dimensions of an image file, read from its own header.
 *
 * The hero and the about photograph are the two elements whose layout depends on
 * knowing how tall they are: `width`/`height` attributes are what stop a phone
 * reflowing the page as the picture arrives. A file the record supplies by hand
 * carries no dimensions, and a guessed number is worse than no number — so we read
 * the real ones. PNG, JPEG and WebP; anything else returns null and the caller
 * falls back to a sane default.
 */
export function imageSizeFromBytes(bytes: Uint8Array): { width: number; height: number } | null {
  const head = bytes.subarray(0, 65536);
  if (head.length < 24) return null;

  // PNG: the IHDR chunk always follows the 8-byte signature.
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
    const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  // JPEG: walk the markers to the frame header (SOF0–SOF15, skipping DHT/JPG/DAC).
  if (head[0] === 0xff && head[1] === 0xd8) {
    let i = 2;
    while (i + 9 < head.length) {
      if (head[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = head[i + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: (head[i + 7]! << 8) | head[i + 8]!, height: (head[i + 5]! << 8) | head[i + 6]! };
      }
      const length = (head[i + 2]! << 8) | head[i + 3]!;
      if (length <= 0) return null;
      i += 2 + length;
    }
    return null;
  }

  // WebP: RIFF container, then VP8 (lossy), VP8L (lossless) or VP8X (extended).
  if (head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) {
    const tag = String.fromCharCode(head[12]!, head[13]!, head[14]!, head[15]!);
    if (tag === "VP8X") {
      const w = 1 + (head[24]! | (head[25]! << 8) | (head[26]! << 16));
      const h = 1 + (head[27]! | (head[28]! << 8) | (head[29]! << 16));
      return { width: w, height: h };
    }
    if (tag === "VP8 ") {
      return { width: ((head[27]! << 8) | head[26]!) & 0x3fff, height: ((head[29]! << 8) | head[28]!) & 0x3fff };
    }
    if (tag === "VP8L") {
      const bits = head[21]! | (head[22]! << 8) | (head[23]! << 16) | (head[24]! << 24);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }

  return null;
}

/** The same, for a file on disk. */
export async function readImageSize(path: string): Promise<{ width: number; height: number } | null> {
  return imageSizeFromBytes(new Uint8Array(await Bun.file(path).slice(0, 65536).arrayBuffer()));
}

export interface SourcedImages {
  images: ManifestImage[];
  files: ImageFile[];
}

interface Candidate {
  source: "Openverse" | "Wikimedia Commons";
  title: string;
  /** Direct file URL we will fetch. */
  url: string;
  /** Where a human can go to check the licence. */
  landingUrl: string;
  license: string;
  licenseUrl: string;
  author: string;
  width: number;
  height: number;
  mime: string;
  score: number;
}

export interface SourcingOptions {
  cacheDir: string;
  noImages: boolean;
  refresh: boolean;
  onNote: (msg: string) => void;
}

async function cachedFetch(url: string, opts: SourcingOptions, timeoutMs = 25000): Promise<Response> {
  const hash = createHash("sha1").update(url).digest("hex");
  const bodyPath = join(opts.cacheDir, `${hash}.body`);
  const metaPath = join(opts.cacheDir, `${hash}.json`);
  const meta = Bun.file(metaPath);
  const body = Bun.file(bodyPath);

  if (!opts.refresh && (await meta.exists()) && (await body.exists())) {
    const m = (await meta.json()) as { status: number; content_type: string };
    return new Response(await body.arrayBuffer(), {
      status: m.status,
      headers: { "content-type": m.content_type },
    });
  }

  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow",
  });
  const buf = await res.arrayBuffer();
  await mkdir(opts.cacheDir, { recursive: true });
  await Bun.write(bodyPath, buf);
  await Bun.write(
    metaPath,
    JSON.stringify({ url, status: res.status, content_type: res.headers.get("content-type") ?? "" }),
  );
  return new Response(buf, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "" } });
}

/** Score a candidate: modern, big enough, landscape, and on-topic. */
function scoreCandidate(c: { title: string; width: number; height: number; mime: string; tags: string[] }, words: string[]): number {
  let score = 0;
  const text = `${c.title} ${c.tags.join(" ")}`.toLowerCase();
  if (HISTORICAL.test(text)) score -= 6;
  if (c.mime === "image/jpeg") score += 2;
  if (c.width >= 1600 && c.height >= 1000) score += 3;
  else if (c.width >= 1000) score += 1;
  if (c.height > 0 && c.width / c.height >= 1.2) score += 2; // landscape suits a hero
  if (c.height > 0 && c.width / c.height < 0.9) score -= 2;
  for (const w of words) if (w.length > 3 && text.includes(w.toLowerCase())) score += 1;
  return score;
}

/** Openverse: licence is stated per result; we accept only cc0 and pdm. */
async function searchOpenverse(query: string, opts: SourcingOptions, exclude: Set<string>, words: string[]): Promise<Candidate[]> {
  const url = `${OPENVERSE_API}?q=${encodeURIComponent(query)}&license=cc0,pdm&page_size=20&mature=false`;
  const res = await cachedFetch(url, opts);
  if (!res.ok) throw new Error(`Openverse search failed: HTTP ${res.status}`);
  const json = (await res.json()) as { results?: Record<string, any>[] };
  const out: Candidate[] = [];
  for (const r of json.results ?? []) {
    const license = String(r.license ?? "").toLowerCase();
    if (license !== "cc0" && license !== "pdm") continue;
    const fileUrl = String(r.url ?? "");
    if (!fileUrl || exclude.has(fileUrl)) continue;
    const width = Number(r.width ?? 0);
    const height = Number(r.height ?? 0);
    if (width > 0 && width < 900) continue;
    const title = String(r.title ?? "untitled");
    const tags: string[] = Array.isArray(r.tags) ? r.tags.map((t: any) => String(t?.name ?? "")) : [];
    out.push({
      source: "Openverse",
      title,
      url: fileUrl,
      landingUrl: String(r.foreign_landing_url ?? r.detail_url ?? ""),
      license: license === "cc0" ? "CC0 1.0 (public domain dedication)" : "Public Domain Mark 1.0",
      licenseUrl: String(r.license_url ?? ""),
      author: String(r.creator ?? "unknown"),
      width,
      height,
      mime: `image/${String(r.filetype ?? "jpeg").replace("jpg", "jpeg")}`,
      score: scoreCandidate({ title, width, height, mime: "image/jpeg", tags }, words),
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Commons: the licence is verified from the file's own metadata. */
async function searchCommons(query: string, opts: SourcingOptions, exclude: Set<string>, words: string[]): Promise<Candidate[]> {
  const url =
    `${COMMONS_API}?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=30` +
    `&gsrsearch=${encodeURIComponent(`filetype:bitmap ${query}`)}` +
    `&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1600`;
  const res = await cachedFetch(url, opts);
  if (!res.ok) throw new Error(`Commons search failed: HTTP ${res.status}`);
  const json = (await res.json()) as { query?: { pages?: Record<string, { title: string; imageinfo?: Record<string, any>[] }> } };
  const out: Candidate[] = [];
  for (const page of Object.values(json.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const fileUrl = String(info.thumburl ?? info.url ?? "");
    if (!fileUrl || exclude.has(fileUrl)) continue;
    const mime = String(info.mime ?? "");
    if (!/^image\/(jpeg|png)$/.test(mime)) continue;
    const meta = info.extmetadata ?? {};
    const licenceRaw = `${meta.LicenseShortName?.value ?? ""} ${meta.UsageTerms?.value ?? ""}`.trim();
    const low = licenceRaw.toLowerCase();
    if (!/cc0|cc-zero|public domain|pdm/.test(low)) continue;
    const width = Number(info.thumbwidth ?? info.width ?? 0);
    const height = Number(info.thumbheight ?? info.height ?? 0);
    if (Number(info.width ?? 0) < 1000) continue;
    const title = page.title.replace(/^File:/, "");
    out.push({
      source: "Wikimedia Commons",
      title,
      url: fileUrl,
      landingUrl: String(info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`),
      license: licenceRaw || "Public domain",
      licenseUrl: String(meta.LicenseUrl?.value ?? ""),
      author: String(meta.Artist?.value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "unknown",
      width,
      height,
      mime,
      score: scoreCandidate({ title, width, height, mime, tags: [] }, words),
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Every candidate passes a licence check before it is used. */
function candidateIsClean(c: Candidate): boolean {
  const low = `${c.license} ${c.licenseUrl}`.toLowerCase();
  if (c.source === "Openverse") return low.includes("cc0") || low.includes("publicdomain/mark") || low.includes("pdm");
  return /cc0|cc-zero|public domain|pdm/.test(low);
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function checkOverrideLicence(image: ImageOverride): boolean {
  const low = image.license.toLowerCase();
  const ok = /^cc0|cc-zero|public domain|\bpd\b|pd-|pdm/.test(low) || low.startsWith("ai-generated");
  if (!ok) {
    throw new Error(
      `image ${image.file} declares licence "${image.license}" — only CC0, public domain, or a labelled AI-generated fallback may be used.`,
    );
  }
  return low.startsWith("ai-generated");
}

function fallbackHero(retrievedAt: string, reason: string): ManifestImage {
  return {
    role: "hero",
    file: null,
    source: "css-gradient-fallback",
    source_url: "",
    license: "n/a — no photograph used",
    author: "n/a",
    retrieved_at: retrievedAt,
    notes: `No verified CC0/public-domain photograph was used (${reason}). The hero is a plain CSS gradient with an inline SVG pattern.`,
  };
}

/**
 * One hand-supplied image, as the manifest describes it.
 *
 * The record may list a single `file`, or a `variants` set (the same picture at
 * several widths, prepared by `tools/prepare-images.py`). When it lists variants the
 * page's `src` is the widest of them — the browser that understands `srcset` picks
 * from the set, and the one that does not gets the best file we hold rather than the
 * smallest. The widths the record states are re-measured from the files themselves
 * when the bundle is built (supplied.ts), so the page cannot describe a picture by a
 * number nobody checked.
 */
function suppliedImage(img: ImageOverride, retrievedAt: string): ManifestImage {
  const isAi = checkOverrideLicence(img);
  const variants = (img.variants ?? []).filter((v) => v.file);
  const file = (variants.length > 0 ? [...variants].sort((a, b) => b.width - a.width)[0]!.file : img.file) ?? null;
  if (!file) {
    throw new Error(
      `image for the ${img.role} slot lists neither "file" nor "variants" — a record may not point at an image it does not name.`,
    );
  }
  const sizes = variants.length > 0 ? ` Responsive sizes supplied: ${[...variants].sort((a, b) => a.width - b.width).map((v) => `${v.width}px`).join(", ")}.` : "";
  return {
    role: img.role,
    file,
    source: isAi ? "supplied: AI-generated fallback" : "supplied: CC0/public domain",
    source_url: img.source_url,
    license: img.license,
    author: img.author,
    retrieved_at: retrievedAt,
    variants: variants.length > 0 ? variants : undefined,
    notes: (isAi
      ? "AI-generated image used as a fallback, labelled on the page as an illustration and not a photograph of this business."
      : "Supplied from our own CC0/public-domain library.") + sizes,
  };
}

export async function sourceImages(record: BusinessRecord, opts: SourcingOptions): Promise<SourcedImages> {
  const retrievedAt = new Date().toISOString();

  if (record.images && record.images.length > 0) {
    return { images: record.images.map((img) => suppliedImage(img, retrievedAt)), files: [] };
  }

  if (opts.noImages) {
    opts.onNote("images: --no-images, so the CSS/SVG treatments are used and nothing is fetched.");
    return { images: [fallbackHero(retrievedAt, "--no-images was passed")], files: [] };
  }

  const profile = profileFor(record);
  const services = normaliseServices(record).map((s) => s.name);
  const queries = [...profile.imageQueries, ...(services.length > 0 ? [services[0]!] : [])];
  const words = queries.join(" ").split(/\s+/);
  const exclude = new Set<string>();
  const images: ManifestImage[] = [fallbackHero(retrievedAt, "no suitable photograph was found")];
  const files: ImageFile[] = [];

  for (const role of ["hero", "about"] as const) {
    let placed = false;
    for (const query of queries) {
      if (placed) break;
      const candidates: Candidate[] = [];
      for (const search of [searchOpenverse, searchCommons]) {
        try {
          candidates.push(...(await search(query, opts, exclude, words)));
        } catch (err) {
          opts.onNote(`images: ${search.name} "${query}" failed (${(err as Error).message})`);
        }
      }
      candidates.sort((a, b) => b.score - a.score);

      for (const candidate of candidates.slice(0, 6)) {
        if (!candidateIsClean(candidate)) continue;
        try {
          const res = await cachedFetch(candidate.url, opts, 30000);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const bytes = new Uint8Array(await res.arrayBuffer());
          if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error(`${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB is too heavy for a demo page`);
          if (bytes.byteLength < 20_000) throw new Error("file is too small to be a photograph");
          const fromMime = EXT_BY_MIME[candidate.mime];
          const fromUrl = extname(new URL(candidate.url).pathname).toLowerCase();
          const ext = fromMime ?? (/^\.(jpg|jpeg|png|webp)$/.test(fromUrl) ? fromUrl : ".jpg");
          const entry: ManifestImage = {
            role,
            file: `img/${role}${ext}`,
            source: candidate.source,
            source_url: candidate.landingUrl,
            license: candidate.license,
            license_url: candidate.licenseUrl,
            author: candidate.author,
            retrieved_at: retrievedAt,
            width: candidate.width,
            height: candidate.height,
            notes: `Search phrase: "${query}" · title: ${candidate.title} · ${(bytes.byteLength / 1024).toFixed(0)} KB`,
          };
          if (role === "hero") images[0] = entry;
          else images.push(entry);
          files.push({ path: entry.file!, bytes });
          exclude.add(candidate.url);
          opts.onNote(`images: ${role} ← ${candidate.title} (${candidate.source}, ${candidate.license}, ${(bytes.byteLength / 1024).toFixed(0)} KB)`);
          placed = true;
          break;
        } catch (err) {
          opts.onNote(`images: skipping "${candidate.title}" — ${(err as Error).message}`);
        }
      }
    }
    if (!placed) opts.onNote(`images: nothing clean for the ${role} slot; the CSS/SVG treatment is used.`);
  }

  return { images, files };
}
