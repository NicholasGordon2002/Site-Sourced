/**
 * Site Sourced — bundle assembly and self-check.
 *
 * `buildBundle` writes one self-contained folder: five pages (index.html,
 * services.html, about.html, contact.html, privacy.html), styles.css, site.js,
 * favicon.svg, the images, the two self-hosted fonts with their OFL licence text
 * (fonts/), manifest.json and a plain-language README.txt. Every reference on every
 * page is a relative path to a file in the same folder, so the bundle opens straight
 * from disk (`file://`) and would also drop onto any host unchanged.
 *
 * The self-check is not decoration: if a compliance string is missing, if a local
 * file a page refers to does not exist, or if the copy guard finds a claim we are
 * not allowed to make, the build fails loudly instead of shipping.
 */

import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import type { BundleResult, BusinessRecord, DemoManifest, ManifestImage } from "./types.ts";
import type { DemoCopy, PrivacyNotice } from "./copy.ts";
import {
  composeCopy,
  composePrivacy,
  guardCopy,
  illustrationLabel,
  isIllustrativeImage,
  normaliseServices,
  privacyNoticeProblems,
  profileFor,
  slugify,
} from "./copy.ts";
import type { FormDelivery } from "./delivery.ts";
import { formDeliveryProblems, resolveDelivery } from "./delivery.ts";
import { undeliverableAddressProblems } from "./addresses.ts";
import { provenanceProblems } from "./provenance.ts";
import { KEY_PLACEHOLDER, resolveForm, type ResolvedForm } from "./forms.ts";
import { sourceImages } from "./images.ts";
import { filesForSupplied, inspectSuppliedImage, manifestForSupplied } from "./supplied.ts";
import { BUDGET, imageBudgetProblems, kb, pageLoadout, weightProblems } from "./weight.ts";
import {
  esc,
  PAGE_IDS,
  PAGE_SPECS,
  renderCss,
  renderEditingReadme,
  renderFavicon,
  renderJs,
  renderPages,
  type RenderContext,
  type RenderedPage,
} from "./render.ts";

export const GENERATOR = "sitesourced-demo-generator/0.1";

/**
 * The two typefaces every bundle ships, and the licence text that has to travel with
 * them under the SIL Open Font License. They are files inside the bundle — loaded by a
 * relative `url()` from styles.css — because the page must load nothing from the
 * network. See docs/design-system.md §2.
 */
const FONT_ASSETS = ["fraunces-latin-600.woff2", "source-sans-3-latin.woff2", "OFL.txt"] as const;
const FONT_SOURCE_DIR = join(import.meta.dir, "assets", "fonts");

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
 * Visitor-facing text that is still a working note rather than a sentence.
 *
 * The plan's rule is that nothing published carries placeholder data, and the privacy
 * notice is the first page with a value we do not have yet (the owner's legal name and
 * mailing address). The rule the owner set for it is stricter than "looks finished": a
 * bracket-shaped or invented value must never reach a public path, so the build refuses
 * a page containing a bracketed token, an unfilled `{Template}` token, or a working
 * note. Attributes, comments and scripts are stripped first: what is scanned is what a
 * visitor would read.
 */
export function placeholderProblems(pages: RenderedPage[]): string[] {
  const patterns: [RegExp, string][] = [
    [/\[[^\]\n]{2,60}\]/, "a bracketed placeholder"],
    [/\{[a-zA-Z][^}\n]{2,60}\}/, "an unfilled template token"],
    [/\b(TBD|TODO|FIXME)\b/, "a working note"],
    [/lorem ipsum/i, "filler text"],
  ];
  const problems: string[] = [];
  for (const page of pages) {
    const text = page.html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ");
    for (const [pattern, what] of patterns) {
      const hit = pattern.exec(text);
      if (hit) {
        problems.push(
          `${page.file} carries ${what} in visitor-facing text ("${hit[0].trim()}"). Nothing published carries placeholder data: ` +
            `fill the value in copy.ts (PRIVACY_IDENTITY for our own identity) or leave the sentence out, and rebuild.`,
        );
      }
    }
  }
  return problems;
}

/**
 * Everything that must be true for a bundle to be publishable at all — one list, one
 * throw — checked **on every page**, because the plan's compliance rules are per page
 * and never inherited. It covers the pages' compliance strings, the contact form, and
 * the privacy notice: an unconfigured endpoint, a recipient that cannot receive mail,
 * a notice that promises delivery to the business while the form routes somewhere else,
 * or a page whose printed details carry no caveat all fail the build here, before any
 * of it can reach a public path.
 *
 * `PAGE_SPECS` says which obligations belong to which page, so the check cannot drift
 * from the template: a page that prints the business's details must carry the caveat
 * exactly twice, a page that carries the form must carry the delivery notice and load
 * `site.js`, and every other page must do neither.
 */
export function complianceChecks(vars: {
  pages: RenderedPage[];
  record: BusinessRecord;
  copy: DemoCopy;
  form: ResolvedForm;
  delivery: FormDelivery;
  /** The images this bundle will contain, as recorded in its manifest. */
  images: ManifestImage[];
  /** The privacy notice this bundle carries, composed for the same phase. */
  privacy: PrivacyNotice;
}): string[] {
  const { pages, record, copy, form, delivery, images, privacy } = vars;
  const problems: string[] = [];
  const illustrative = images.filter(isIllustrativeImage);
  const label = illustrationLabel(record.name);
  const caveat = copy.contactCaveat;

  for (const page of pages) {
    const spec = PAGE_SPECS[page.id];
    const html = page.html;
    const on = `on ${page.file}`;

    if (!/<meta\s+name="robots"\s+content="noindex,\s*nofollow">/.test(html)) {
      problems.push(`${on}: missing or malformed <meta name="robots" content="noindex, nofollow">`);
    }
    if (!html.includes(copy.banner)) problems.push(`${on}: the proposal banner text is not present`);
    if (html.indexOf(copy.banner) > html.indexOf("<header")) problems.push(`${on}: the banner is not above the header`);
    // The banner has to be the first content element in the body. The skip link is
    // allowed in front of it: it is a keyboard affordance, not content, and it is
    // invisible until focused.
    const inBody = html.slice(html.indexOf("<body>") + 6).replace(/<!--[\s\S]*?-->/g, " ").trim();
    const afterSkip = inBody.startsWith('<a class="skip-link"')
      ? inBody.slice(inBody.indexOf("</a>") + 4).trim()
      : inBody;
    if (!afterSkip.startsWith('<div class="proposal-banner"')) {
      problems.push(`${on}: the proposal banner is not the first content element in <body>, so a visitor can meet the business's name before they learn the page is our proposal`);
    }
    if (!html.includes(copy.footerDisclaimer)) {
      problems.push(`${on}: the footer disclaimer is not present next to the business's name`);
    }
    if (/©\s*<strong>?/.test(html) || html.includes(`© ${record.name}`)) {
      problems.push(`${on}: a copyright line naming the business is present`);
    }

    if (spec.printsDetails) {
      // The demonstration notice sends a visitor to the printed phone number and
      // email address to reach the business, so those details must carry the plan's
      // caveat — twice, once with the details in the page body and once in the
      // footer. (On a delivered site the client has confirmed them, so it is empty.)
      const count = caveat ? html.split(esc(caveat)).length - 1 : 0;
      if (caveat && count !== 2) {
        problems.push(
          `${on}: the business's published contact details are printed with the caveat that belongs with them ${count} time(s), not twice (once beside the details in the page body, once in the footer). ` +
            `Unconfirmed details must never read as the business's own.`,
        );
      }
      if (delivery.mode === "demo" && !html.includes("demonstration site")) {
        problems.push(`${on}: this bundle is in the demonstration phase but the page does not say so in words a visitor would recognise`);
      }
    } else {
      // The privacy notice prints none of the business's details: a notice about our
      // own handling is not the place to repeat an unconfirmed phone number.
      if (caveat && html.includes(esc(caveat))) {
        problems.push(`${on}: carries the published-listings caveat although it prints none of the business's contact details — the caveat belongs only with the details it qualifies`);
      }
      for (const [what, value] of [["phone number", record.phone], ["email address", record.email]] as [string, string | undefined][]) {
        if (value && html.includes(value)) {
          problems.push(`${on}: prints the business's ${what} (${value}). The privacy notice is about our own handling, so it reprints none of the business's details.`);
        }
      }
    }

    if (spec.carriesForm) {
      if (!html.includes("site.js")) {
        problems.push(`${on}: the page carries the form but does not load site.js, so a submission cannot report its outcome`);
      }
      // Compared in its escaped form: that is how render.ts writes text into html.
      if (!html.includes(esc(copy.formNotice))) {
        problems.push(`${on}: the form-delivery notice is not present in the page, next to the form`);
      }
    } else {
      if (html.includes("site.js")) {
        problems.push(`${on}: loads site.js, but the contact form is only on ${PAGE_SPECS.contact.file}. Every other page must work unchanged with JavaScript off, and asks for one file less.`);
      }
      if (html.includes(esc(copy.formNotice))) {
        problems.push(`${on}: quotes the form-delivery notice without carrying the form, which tells a visitor where a message goes on a page that has no message field`);
      }
    }

    // An AI-generated placeholder must be labelled on the page that shows it, in words
    // a visitor reads — the manifest recording it is not enough. The label is built by
    // `illustrationLabel`, so the page and the manifest cannot disagree.
    for (const role of spec.slots) {
      const image = illustrative.find((i) => i.role === role);
      if (image && !html.includes(esc(label))) {
        problems.push(
          `${on}: shows the AI-generated ${role} image (${image.file}) with no label saying so. ` +
            `An AI-generated placeholder must be labelled as an illustration, not left looking like a photograph of ${record.name}; expected the page to contain: "${label}"`,
        );
      }
    }
    if (spec.slots.length === 0 && html.includes(esc(label))) {
      problems.push(`${on}: carries an AI-illustration label although it shows no image that needs one`);
    }

    const banned = guardCopy(html, record);
    if (banned.length > 0) problems.push(`${on}: copy guard tripped: ${banned.join(", ")}`);
  }

  problems.push(...formDeliveryProblems({ record, form, noticeMode: copy.formNoticeDelivery, placeholder: KEY_PLACEHOLDER }));
  // Two rules that were each missing a half. Both are checked here, on the rendered
  // pages — what a visitor can actually read:
  //
  //   - every address the bundle posts to *or prints* must be able to work, through one
  //     shared function, so the form's recipient and the printed "contact us here" line
  //     cannot drift apart (addresses.ts);
  //   - every claim about where the business's details came from is derived from the
  //     record's declared source, and a page carrying a credit the record does not
  //     support fails here (provenance.ts).
  problems.push(...undeliverableAddressProblems({ record, form, pages }));
  problems.push(...provenanceProblems({ record, provenance: copy.provenance, pages, deliveryMode: delivery.mode }));
  problems.push(...privacyNoticeProblems({ privacy, record, delivery }));
  problems.push(...placeholderProblems(pages));
  return problems;
}

/**
 * Every relative file the HTML/CSS/JS refers to must exist inside the bundle.
 *
 * `srcset` is read as well as `src`: a hero whose `src` exists but whose `srcset`
 * points at variants that were never copied in would 404 on a phone while looking
 * perfectly fine on the machine that built it.
 */
async function referencedFilesExist(dir: string, html: string, css: string): Promise<string[]> {
  const missing: string[] = [];
  const refs = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)) refs.add(m[1]!);
  for (const m of html.matchAll(/srcset="([^"]*)"/g)) {
    for (const candidate of m[1]!.split(",")) {
      const path = candidate.trim().split(/\s+/)[0];
      if (path) refs.add(path);
    }
  }
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
  // The privacy notice is composed for the same phase as the form notice, from the
  // same derivation — never a flag someone set. Anything the owner has not supplied
  // (today: our legal name and mailing address) is recorded as an open item rather
  // than printed as a placeholder.
  const privacy = composePrivacy(record, form, delivery);
  const warnings: string[] = [];
  if (form.warning) warnings.push(form.warning);
  if (!record.phone) warnings.push("record has no phone number — the header call button and the contact fallback are weaker without one.");
  if (!record.email) warnings.push("record has no email address — the form fallback line has no address to print.");
  if (normaliseServices(record).length === 0) warnings.push("record lists no services — the services section says so plainly rather than inventing any.");
  if (delivery.mode === "demo") {
    warnings.push(`demonstration phase: ${delivery.basis} — so the page carries the demonstration notice and no message reaches ${record.name}.`);
  }
  warnings.push(`provenance: ${copy.provenance.basis}.`);
  if (copy.provenance.kind === "fictional") {
    warnings.push(
      `this record is a fictional example business, so the page says so instead of crediting a real source — it must not be published as anyone's site, and its printed details are examples.`,
    );
  }
  for (const item of privacy.openItems) {
    warnings.push(`privacy notice incomplete: ${item}. The page states nothing it cannot support, but this must be filled before a real prospect sees a page.`);
  }

  const sourced = await sourceImages(record, {
    cacheDir: opts.cacheDir,
    noImages: opts.noImages,
    refresh: opts.refresh,
    onNote: opts.onNote,
  });

  // Everything that goes into the bundle, in memory, before anything is written:
  // the bytes we downloaded, and the supplied files we read and measured. A supplied
  // file is measured exactly like a fetched one — that check is how a 2.7 MB hero
  // shipped, because it only ever ran on files we had fetched ourselves.
  // Reasons to refuse the bundle that are known before a single file is written.
  // Merged with the page's compliance self-check below, and thrown as one list.
  const problemsBeforeWrite: string[] = [];
  const suppliedFiles: { path: string; bytes: Uint8Array }[] = [];
  const images: ManifestImage[] = [];
  for (const image of sourced.images) {
    const downloaded = sourced.files.find((f) => f.path === image.file);
    if (downloaded) {
      images.push(image);
      continue;
    }
    const inspected = await inspectSuppliedImage(image, opts.recordDir);
    problemsBeforeWrite.push(...inspected.problems);
    if (inspected.variants.length === 0) {
      // Missing where it was expected to be: the page falls back to its CSS treatment,
      // in the same words it always has.
      warnings.push(
        `image ${inspected.missing.join(", ") || image.file} could not be read (${inspected.missing.length > 0 ? "not found" : "unreadable"}) — the page falls back to its CSS treatment.`,
      );
      images.push({ ...image, file: null, source: "css-gradient-fallback", notes: "Supplied file was not found." });
      continue;
    }
    const measured = manifestForSupplied(image, inspected.variants);
    images.push(measured);
    suppliedFiles.push(...filesForSupplied(inspected.variants));
    opts.onNote(
      `images: ${image.role} ← ${measured.file} (${inspected.variants.length} size${inspected.variants.length === 1 ? "" : "s"}: ${inspected.variants
        .map((v) => `${v.width}px ${kb(v.bytes.byteLength)}`)
        .join(", ")})`,
    );
  }
  const bytesByPath = new Map<string, Uint8Array>();
  for (const file of [...sourced.files, ...suppliedFiles]) bytesByPath.set(file.path, file.bytes);

  const ctx: RenderContext = {
    record,
    copy,
    profile,
    form,
    delivery,
    privacy,
    images,
    slug,
    generatedAt: new Date().toISOString(),
  };

  const pages = renderPages(ctx);
  const css = renderCss(profile, slug);
  const js = renderJs();
  const favicon = renderFavicon(record, profile);
  const readme = renderEditingReadme(ctx);

  const problems = [...problemsBeforeWrite, ...complianceChecks({ pages, record, copy, form, delivery, images, privacy })];
  if (problems.length > 0) await fail(`compliance self-check failed for ${slug}:\n  - ${problems.join("\n  - ")}`);

  const files: string[] = [];
  const write = async (relPath: string, contents: string | Uint8Array) => {
    const abs = join(dir, relPath);
    await mkdir(dirname(abs), { recursive: true });
    await Bun.write(abs, contents);
    files.push(relPath);
  };

  for (const page of pages) await write(page.file, page.html);
  await write("styles.css", css);
  await write("site.js", js);
  await write("favicon.svg", favicon);
  await write("README.txt", readme);

  // The page's fonts, and the licence that must travel with them. A missing asset is a
  // build failure, not a warning: the stylesheet would be pointing at nothing.
  for (const name of FONT_ASSETS) {
    try {
      await mkdir(join(dir, "fonts"), { recursive: true });
      await copyFile(join(FONT_SOURCE_DIR, name), join(dir, "fonts", name));
      files.push(`fonts/${name}`);
    } catch (err) {
      await fail(`bundle ${slug} cannot include its font assets — ${name}: ${(err as Error).message}`);
    }
  }

  // Images: either the bytes we downloaded, or a supplied file in the record — both
  // are in `bytesByPath` by now, already measured, so the page and the manifest
  // describe the same picture with the same real dimensions. A variant set is written
  // in full: that is the point of it — the phone downloads one file, the folder holds
  // the set.
  for (const image of images) {
    const paths = (image.variants?.length ?? 0) > 0 ? image.variants!.map((v) => v.file) : image.file ? [image.file] : [];
    for (const path of paths) {
      const bytes = bytesByPath.get(path);
      if (!bytes) {
        warnings.push(`image ${path} has no bytes to write — the page would refer to a file it does not contain.`);
        continue;
      }
      await write(path, bytes);
    }
  }

  // A bundle contains what this build put in it and nothing else. Without this, a
  // file from an earlier build survives in the folder — which is how a re-encoded hero
  // could leave its 2.6 MB predecessor sitting in the published demo path, still
  // reachable at a guessable URL, long after the page stopped referring to it.
  const keep = new Set<string>([...files, "manifest.json"]);
  const present = await readdir(dir, { recursive: true, withFileTypes: true });
  for (const entry of present) {
    if (!entry.isFile()) continue;
    const rel = entry.parentPath ? relative(dir, join(entry.parentPath, entry.name)) : entry.name;
    if (keep.has(rel)) continue;
    await rm(join(dir, rel), { force: true });
    warnings.push(`removed ${rel}, a file inside this bundle that this build did not write (a leftover from an earlier run).`);
  }

  // Every page, not just the home page: a nav link to a file that was never written,
  // or a font a second page refers to, is a 404 on the published host — which serves
  // flat files and has no directory-index resolution, so `/demo/<slug>/` does not work
  // and only real paths do.
  const missing: string[] = [];
  for (const page of pages) {
    for (const ref of await referencedFilesExist(dir, page.html, css)) {
      missing.push(`${page.file} → ${ref}`);
    }
  }
  if (missing.length > 0) await fail(`bundle ${slug} refers to files it does not contain: ${missing.join(", ")}`);

  // What each page actually weighs, measured from the files on disk rather than
  // estimated from the record: the page itself, its stylesheet, its script if it has
  // one, its two fonts, and one file per image slot it shows — the hero variant a
  // 360px phone asks for. Over the ceiling the bundle does not ship; over the target it
  // still does, and the manifest carries the per-page number so a heavy-but-honest page
  // is visible, not hidden.
  const sizes = new Map<string, number>();
  for (const f of files) sizes.set(f, (await stat(join(dir, f))).size);
  const weight: string[] = [];
  const pageBytes: { file: string; bytes: number }[] = [];
  for (const page of pages) {
    const loadout = { page: page.file, html: page.html, css, sizes, images };
    weight.push(...weightProblems(loadout));
    pageBytes.push({ file: page.file, bytes: pageLoadout(loadout).reduce((sum, f) => sum + f.bytes, 0) });
  }
  const imageBudgets = imageBudgetProblems({ images, sizes });
  if (weight.length > 0 || imageBudgets.length > 0) {
    await fail(`bundle ${slug} breaks the weight budget in docs/design-system.md §8:\n  - ${[...weight, ...imageBudgets].join("\n  - ")}`);
  }
  const heaviest = [...pageBytes].sort((a, b) => b.bytes - a.bytes)[0]!;
  opts.onNote(
    `weight: heaviest page is ${heaviest.file} at ${kb(heaviest.bytes)} cold at 360px (target ${kb(BUDGET.pageTarget)}, ceiling ${kb(BUDGET.pageCeiling)})`,
  );
  for (const page of pageBytes) {
    if (page.bytes > BUDGET.pageTarget) {
      warnings.push(
        `${page.file} weighs ${kb(page.bytes)} cold, over the ${kb(BUDGET.pageTarget)} target in docs/design-system.md §8 (the ${kb(BUDGET.pageCeiling)} ceiling is what fails a build).`,
      );
    }
  }

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
      /* The declared source, and the exact lines derived from it — so a reviewer (or a
         later audit) can see what the page claimed about its own provenance and why. */
      source_kind: copy.provenance.kind,
      provenance_line: copy.provenance.attribution,
      provenance_basis: copy.provenance.basis,
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
      per_page: pages.map((page) => ({
        file: page.file,
        banner_above_the_fold: true,
        prints_business_details: PAGE_SPECS[page.id].printsDetails,
        caveat_instances: copy.contactCaveat ? page.html.split(esc(copy.contactCaveat)).length - 1 : 0,
        loads_site_js: page.html.includes("site.js"),
        illustration_labels: PAGE_SPECS[page.id].slots
          .flatMap((role) => images.filter((i) => i.role === role && isIllustrativeImage(i)))
          .map((i) => illustrationLabel(record.name)),
      })),
    },
    privacy: {
      file: PAGE_SPECS.privacy.file,
      mode: privacy.mode,
      contact_email: privacy.contactEmail,
      last_updated: privacy.lastUpdated,
      open_items: privacy.openItems,
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

/** Every bundle output file, in the order a human would read them. */
export const BUNDLE_FILES = [
  ...PAGE_IDS.map((id) => PAGE_SPECS[id].file),
  "styles.css",
  "site.js",
  "favicon.svg",
  "README.txt",
  "manifest.json",
] as const;
