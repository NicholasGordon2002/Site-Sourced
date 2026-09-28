/**
 * Site Sourced — bundle assembly and self-check.
 *
 * `buildBundle` writes one self-contained folder: index.html, styles.css, site.js,
 * favicon.svg, the images, manifest.json and a plain-language README.txt. Every
 * reference on the page is a relative path to a file in the same folder, so the
 * bundle opens straight from disk (`file://`) and would also drop onto any host
 * unchanged.
 *
 * The self-check is not decoration: if a compliance string is missing, if a local
 * file a page refers to does not exist, or if the copy guard finds a claim we are
 * not allowed to make, the build fails loudly instead of shipping.
 */

import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

import type { BundleResult, BusinessRecord, DemoManifest, ManifestImage } from "./types.ts";
import { composeCopy, guardCopy, normaliseServices, profileFor, slugify } from "./copy.ts";
import { resolveForm } from "./forms.ts";
import { sourceImages } from "./images.ts";
import { renderCss, renderEditingReadme, renderFavicon, renderIndex, renderJs, type RenderContext } from "./render.ts";

export const GENERATOR = "sitesourced-demo-generator/0.1";

export interface BuildOptions {
  outRoot: string;
  /** HTTP/image cache directory (gitignored). */
  cacheDir: string;
  /** Directory the record was loaded from, used to resolve relative image paths. */
  recordDir: string;
  noImages: boolean;
  refresh: boolean;
  onNote: (msg: string) => void;
}

/** The strings that must be present for a bundle to be publishable at all. */
export function complianceChecks(html: string, record: BusinessRecord, copy: { banner: string; footerDisclaimer: string }): string[] {
  const problems: string[] = [];
  if (!/<meta\s+name="robots"\s+content="noindex,\s*nofollow">/.test(html)) {
    problems.push("missing or malformed <meta name=\"robots\" content=\"noindex, nofollow\">");
  }
  if (!html.includes(copy.banner)) problems.push("proposal banner text is not present in the page");
  if (!html.includes(copy.footerDisclaimer)) problems.push("footer disclaimer is not present next to the business details");
  if (html.indexOf(copy.banner) > html.indexOf("<header")) problems.push("the banner is not above the header");
  if (/©\s*<strong>?/.test(html) || html.includes(`© ${record.name}`)) problems.push("a copyright line naming the business is present");
  const banned = guardCopy(html, record);
  if (banned.length > 0) problems.push(`copy guard tripped: ${banned.join(", ")}`);
  return problems;
}

/** Every relative file the HTML/CSS/JS refers to must exist inside the bundle. */
async function referencedFilesExist(dir: string, html: string, css: string): Promise<string[]> {
  const missing: string[] = [];
  const refs = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)) refs.add(m[1]!);
  for (const m of css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) refs.add(m[1]!);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:)/.test(ref)) continue;
    if (ref.startsWith("#")) continue;
    try {
      await stat(join(dir, ref.split("?")[0]!));
    } catch {
      missing.push(ref);
    }
  }
  return missing;
}

export async function buildBundle(record: BusinessRecord, opts: BuildOptions): Promise<BundleResult> {
  const slug = (record.slug ?? "").trim() || slugify(record.name);
  const dir = join(opts.outRoot, slug);
  await mkdir(join(dir, "img"), { recursive: true });

  const profile = profileFor(record);
  const copy = composeCopy(record, slug);
  const form = resolveForm(record);
  const warnings: string[] = [];
  if (form.warning) warnings.push(form.warning);
  if (!record.phone) warnings.push("record has no phone number — the header call button and the contact fallback are weaker without one.");
  if (!record.email) warnings.push("record has no email address — the form fallback line has no address to print.");
  if (normaliseServices(record).length === 0) warnings.push("record lists no services — the services section says so plainly rather than inventing any.");

  const sourced = await sourceImages(record, {
    cacheDir: opts.cacheDir,
    noImages: opts.noImages,
    refresh: opts.refresh,
    onNote: opts.onNote,
  });

  const ctx: RenderContext = {
    record,
    copy,
    profile,
    form,
    images: sourced.images,
    slug,
    generatedAt: new Date().toISOString(),
  };

  const html = renderIndex(ctx);
  const css = renderCss(profile, slug);
  const js = renderJs();
  const favicon = renderFavicon(record, profile);
  const readme = renderEditingReadme(ctx);

  const problems = complianceChecks(html, record, copy);
  if (problems.length > 0) throw new Error(`compliance self-check failed for ${slug}:\n  - ${problems.join("\n  - ")}`);

  const bytesByPath = new Map<string, Uint8Array>();
  for (const file of sourced.files) bytesByPath.set(file.path, file.bytes);

  const files: string[] = [];
  const write = async (relPath: string, contents: string | Uint8Array) => {
    const abs = join(dir, relPath);
    await mkdir(dirname(abs), { recursive: true });
    await Bun.write(abs, contents);
    files.push(relPath);
  };

  await write("index.html", html);
  await write("styles.css", css);
  await write("site.js", js);
  await write("favicon.svg", favicon);
  await write("README.txt", readme);

  // Images: either the bytes we just downloaded, or a file supplied in the record.
  const images: ManifestImage[] = [];
  for (const image of sourced.images) {
    if (!image.file) {
      images.push(image);
      continue;
    }
    const downloaded = bytesByPath.get(image.file);
    if (downloaded) {
      await write(image.file, downloaded);
      images.push(image);
      continue;
    }
    try {
      const source = await locateSupplied(image.file, opts.recordDir);
      await mkdir(dirname(join(dir, image.file)), { recursive: true });
      await copyFile(source, join(dir, image.file));
      files.push(image.file);
      images.push(image);
    } catch (err) {
      warnings.push(`image ${image.file} could not be copied in (${(err as Error).message}) — the page falls back to its CSS treatment.`);
      images.push({ ...image, file: null, source: "css-gradient-fallback", notes: "Supplied file was not found." });
    }
  }

  const missing = await referencedFilesExist(dir, html, css);
  if (missing.length > 0) throw new Error(`bundle ${slug} refers to files it does not contain: ${missing.join(", ")}`);

  const manifest: DemoManifest = {
    generator: GENERATOR,
    generated_at: ctx.generatedAt,
    slug,
    business: {
      name: record.name,
      category: record.category,
      city: record.address?.city ?? "",
      phone_printed: Boolean(record.phone),
      email_printed: Boolean(record.email),
      source: record.source ?? "test fixture (fictional business)",
    },
    files: [...files, "manifest.json"].sort(),
    images,
    compliance: {
      robots_meta: "noindex, nofollow",
      banner_text: copy.banner,
      footer_disclaimer: copy.footerDisclaimer,
      banner_above_the_fold: true,
      business_own_assets_used: false,
      external_requests_on_load: [],
      external_requests_note:
        "The page loads nothing from the network: styles, script, favicon and images are files in this folder. The only outbound request the site can make is the contact-form POST, which happens when a visitor submits the form.",
    },
    form: {
      provider: form.provider.label,
      endpoint: form.endpoint,
      recipient: form.recipient,
      needs_account: form.provider.needs_account,
      who_owns_the_account: form.provider.who_owns_the_account,
      stores_submissions: form.provider.stores_submissions,
      free_tier: form.provider.free_tier,
      if_it_lapses: form.provider.if_it_lapses,
      fields: ["name", "email", "phone (optional)", "message"],
      fallback_shown: `The form sits next to ${record.email ? `the business's email address (${record.email})` : "no recorded email address"} and phone number, so an enquiry still reaches the business if the relay is ever down.`,
    },
    handoff: {
      external_dependencies: [
        {
          name: form.provider.label,
          purpose: "delivers contact-form submissions to the business's own inbox",
          owner: form.provider.who_owns_the_account,
          cost: form.provider.free_tier,
          url: form.provider.url || "(the endpoint configured in this record)",
        },
        {
          name: "domain registrar",
          purpose: "the address the site is published at",
          owner: "the client, as registrant from day one (Site Sourced only as technical contact)",
          cost: "the client's annual domain renewal — the single recurring item",
          url: "",
        },
        {
          name: "static hosting",
          purpose: "serves this folder",
          owner: "the client",
          cost: "free tiers exist; no server runtime, database or build step is required to keep this page up",
          url: "",
        },
      ],
      recurring_costs: [
        "annual domain renewal (the client's, set to auto-renew)",
        "everything else in this bundle is static files with no runtime cost",
      ],
      day_one_ownership: [
        "the domain registration (client is registrant)",
        "the hosting account",
        "the contact-form account and access key",
        "these files, unencumbered",
      ],
    },
    warnings,
  };

  await write("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

  let total = 0;
  for (const f of files) total += (await stat(join(dir, f))).size;

  return { slug, dir, files: manifest.files, images, warnings, bytes: total };
}

async function locateSupplied(file: string, recordDir: string): Promise<string> {
  const candidates = isAbsolute(file) ? [file] : [resolve(recordDir, file), resolve(process.cwd(), file)];
  for (const candidate of candidates) {
    try {
      await stat(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error(`not found: ${candidates.join(", ")}`);
}

/** Every bundle output file, in the order a human would read them. */
export const BUNDLE_FILES = ["index.html", "styles.css", "site.js", "favicon.svg", "README.txt", "manifest.json"] as const;
