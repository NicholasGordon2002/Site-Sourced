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

import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

import type { BundleResult, BusinessRecord, DemoManifest, ManifestImage } from "./types.ts";
import type { DemoCopy } from "./copy.ts";
import { composeCopy, guardCopy, illustrationLabel, isIllustrativeImage, normaliseServices, profileFor, slugify } from "./copy.ts";
import type { FormDelivery } from "./delivery.ts";
import { formDeliveryProblems, resolveDelivery } from "./delivery.ts";
import { KEY_PLACEHOLDER, resolveForm, type ResolvedForm } from "./forms.ts";
import { sourceImages } from "./images.ts";
import { esc, renderCss, renderEditingReadme, renderFavicon, renderIndex, renderJs, type RenderContext } from "./render.ts";

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

/**
 * Everything that must be true for a bundle to be publishable at all — one list,
 * one throw. It covers the page's compliance strings *and* the contact form: an
 * unconfigured endpoint, a recipient that cannot receive mail, or a form notice
 * that promises delivery to the business while the form routes somewhere else all
 * fail the build here, before any of it can reach a public path.
 */
export function complianceChecks(vars: {
  html: string;
  record: BusinessRecord;
  copy: DemoCopy;
  form: ResolvedForm;
  delivery: FormDelivery;
  /** The images this bundle will contain, as recorded in its manifest. */
  images: ManifestImage[];
}): string[] {
  const { html, record, copy, form, delivery, images } = vars;
  const problems: string[] = [];
  if (!/<meta\s+name="robots"\s+content="noindex,\s*nofollow">/.test(html)) {
    problems.push("missing or malformed <meta name=\"robots\" content=\"noindex, nofollow\">");
  }
  if (!html.includes(copy.banner)) problems.push("proposal banner text is not present in the page");
  if (!html.includes(copy.footerDisclaimer)) problems.push("footer disclaimer is not present next to the business details");
  if (html.indexOf(copy.banner) > html.indexOf("<header")) problems.push("the banner is not above the header");
  if (/©\s*<strong>?/.test(html) || html.includes(`© ${record.name}`)) problems.push("a copyright line naming the business is present");
  // Compared in its escaped form: that is how render.ts writes text into html.
  if (!html.includes(esc(copy.formNotice))) problems.push("the form notice is not present in the page, next to the form");
  if (delivery.mode === "demo" && !html.includes("demonstration site")) {
    problems.push("the bundle is in the demonstration phase but the page does not say so in words a visitor would recognise");
  }
  // The demonstration notice sends a visitor to the printed phone number and email
  // address to reach the business, so those details must carry the plan's caveat:
  // they are as published in public listings and were never confirmed with the
  // business. (On a delivered site the client has confirmed them, so it is empty.)
  if (copy.contactCaveat && !html.includes(esc(copy.contactCaveat))) {
    problems.push(
      "the page prints the business's contact details but not the \"as published in public listings — please confirm\" caveat that belongs with them, so an unconfirmed phone number or address reads as the business's own.",
    );
  }
  const banned = guardCopy(html, record);
  if (banned.length > 0) problems.push(`copy guard tripped: ${banned.join(", ")}`);
  // An AI-generated placeholder must be labelled on the page as an illustration, in
  // words a visitor reads — the manifest recording it is not enough. The label is
  // built by `illustrationLabel`, so the page and the manifest cannot disagree.
  const illustrative = images.filter(isIllustrativeImage);
  if (illustrative.length > 0) {
    const label = illustrationLabel(record.name);
    if (!html.includes(esc(label))) {
      problems.push(
        `the bundle's manifest records an AI-generated image (${illustrative.map((i) => i.file).join(", ")}) but the page carries no label saying so. ` +
          `An AI-generated placeholder must be labelled on the page as an illustration, not left looking like a photograph of ${record.name}; ` +
          `expected the page to contain: "${label}"`,
      );
    }
  }
  problems.push(...formDeliveryProblems({ record, form, noticeMode: copy.formNoticeDelivery, placeholder: KEY_PLACEHOLDER }));
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
  // Tracked so a failed build can leave no half-written bundle behind: a folder
  // that existed before this run (a previous, valid bundle) is left alone, but
  // one this run created is removed rather than left looking publishable.
  const existedBefore = await stat(dir).then(() => true).catch(() => false);
  await mkdir(join(dir, "img"), { recursive: true });
  const fail = async (message: string): Promise<never> => {
    if (!existedBefore) await rm(dir, { recursive: true, force: true });
    throw new Error(message);
  };

  const profile = profileFor(record);
  // The form is resolved first, then the delivery is derived from the record and
  // that form: the page's notice depends on both the provider and on whether the
  // message actually reaches the business.
  const form = resolveForm(record);
  const delivery = resolveDelivery(record, form);
  const copy = composeCopy(record, slug, form, delivery);
  const warnings: string[] = [];
  if (form.warning) warnings.push(form.warning);
  if (!record.phone) warnings.push("record has no phone number — the header call button and the contact fallback are weaker without one.");
  if (!record.email) warnings.push("record has no email address — the form fallback line has no address to print.");
  if (normaliseServices(record).length === 0) warnings.push("record lists no services — the services section says so plainly rather than inventing any.");
  if (delivery.mode === "demo") {
    warnings.push(`demonstration phase: ${delivery.basis} — so the page carries the demonstration notice and no message reaches ${record.name}.`);
  }

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
    delivery,
    images: sourced.images,
    slug,
    generatedAt: new Date().toISOString(),
  };

  const html = renderIndex(ctx);
  const css = renderCss(profile, slug);
  const js = renderJs();
  const favicon = renderFavicon(record, profile);
  const readme = renderEditingReadme(ctx);

  const problems = complianceChecks({ html, record, copy, form, delivery, images: sourced.images });
  if (problems.length > 0) await fail(`compliance self-check failed for ${slug}:\n  - ${problems.join("\n  - ")}`);

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
  if (missing.length > 0) await fail(`bundle ${slug} refers to files it does not contain: ${missing.join(", ")}`);

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
      /* Printed with the phone number and email address; null on a delivered site. */
      contact_details_caveat: copy.contactCaveat || null,
      external_requests_on_load: [],
      external_requests_note:
        "The page loads nothing from the network: styles, script, favicon and images are files in this folder. The only outbound request the site can make is the contact-form POST, which happens when a visitor submits the form.",
    },
    form: {
      provider: form.provider.label,
      endpoint: form.endpoint,
      recipient: form.recipient,
      // How the phase was decided, recorded so nobody has to remember it: the
      // comparison, its outcome, and the exact notice the page carries.
      delivery: {
        mode: delivery.mode,
        party: delivery.party,
        basis: delivery.basis,
        recipient: delivery.recipient,
        business_published_address: delivery.business_address || null,
        claimed_by_record: delivery.claimed_by_record,
        notice: copy.formNotice,
        success_message: copy.formSuccess,
      },
      needs_account: form.provider.needs_account,
      who_owns_the_account: form.provider.who_owns_the_account,
      stores_submissions: form.provider.stores_submissions,
      free_tier: form.provider.free_tier,
      if_it_lapses: form.provider.if_it_lapses,
      fields: ["name", "email", "phone (optional)", "message"],
      fallback_shown:
        delivery.mode === "business"
          ? `The form sits next to ${record.email ? `the business's email address (${record.email})` : "no recorded email address"} and phone number, so an enquiry still reaches the business if the relay is ever down.`
          : `The form sits next to the business's published email address ${record.email ? `(${record.email}) ` : ""}and phone number, so a visitor who wants the business itself rather than this demonstration can reach it directly.`,
    },
    handoff: {
      external_dependencies: [
        {
          name: form.provider.label,
          purpose:
            delivery.mode === "business"
              ? "delivers contact-form submissions to the business's own inbox"
              : `carries contact-form submissions to ${delivery.party} while this site is a demonstration — the business named on the page is not a recipient`,
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
