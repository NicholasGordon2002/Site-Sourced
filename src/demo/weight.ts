/**
 * Site Sourced — what a page weighs, and what the build refuses to ship.
 *
 * A demo is judged on a phone, on mobile data, with a cold cache. That makes weight
 * part of the design, not an afterthought: `docs/design-system.md` §8 sets the budget,
 * and this file is that budget written as code so a build fails instead of trusting
 * whoever last looked at the page.
 *
 * The measurement is deliberately literal: it sums the files a page **actually
 * loads**. The hero contributes one file — the variant a 360px-wide screen asks for —
 * not every variant that sits in the folder, because a folder full of well-cut
 * variants is not a heavy page. Everything on the page is a relative file in the same
 * bundle, so there is nothing here that a third-party request could hide.
 */

import type { ManifestImage } from "./types.ts";

export const KB = 1024;

/**
 * `docs/design-system.md` §8. The page budget is a target with a ceiling: a bundle
 * over the ceiling does not ship at all, and the target is what we aim at.
 */
export const BUDGET = {
  html: 20 * KB,
  css: 16 * KB,
  js: 4 * KB,
  fonts: 60 * KB,
  /** The hero at its widest. */
  heroLargest: 180 * KB,
  /** The hero file a 360px-wide phone actually downloads. */
  heroAt360: 120 * KB,
  about: 200 * KB,
  other: 30 * KB,
  /** First-view page total: aim, then ceiling. */
  pageTarget: 400 * KB,
  pageCeiling: 750 * KB,
  /** No single image file may exceed this, whatever its role or source. */
  singleImageCap: 700 * KB,
} as const;

/** The viewport whose hero file the budget is written against. */
export const PHONE_WIDTH = 360;

/** `184 KB`, or `2.6 MB` once the number is big enough to read that way. */
export function kb(bytes: number): string {
  if (bytes >= 1024 * KB) return `${(bytes / 1024 / KB).toFixed(1)} MB`;
  return `${(bytes / KB).toFixed(bytes < 10 * KB ? 1 : 0)} KB`;
}

/** Bundle-relative files a page refers to: `src`, `href`, `srcset` and CSS `url()`. */
export function referencedPaths(html: string, css = ""): string[] {
  const refs = new Set<string>();
  const add = (ref: string) => {
    const path = ref.trim().split(/[?#]/)[0]!.trim();
    if (!path) return;
    if (/^(https?:|mailto:|tel:|data:|#|\/\/)/.test(path)) return;
    // A link to another page of the same site is navigation, not a file this page
    // loads: counting four sibling pages into every page's weight would make the
    // per-page budget meaningless. The build checks separately that every nav target
    // is a file the bundle actually contains.
    if (/\.html?$/i.test(path)) return;
    refs.add(path.replace(/^\.\//, ""));
  };
  for (const m of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)) add(m[1]!);
  for (const m of html.matchAll(/srcset="([^"]*)"/g)) for (const candidate of m[1]!.split(",")) add(candidate.trim().split(/\s+/)[0] ?? "");
  for (const m of css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) add(m[1]!);
  return [...refs];
}

/** One file a page loads, and what it costs. */
export interface LoadedFile {
  file: string;
  bytes: number;
}

/**
 * The image file a 360px-wide screen downloads.
 *
 * With variants, that is the narrowest file that is at least as wide as the screen —
 * the browser's own choice, given `sizes="100vw"`. With a single file, it is that
 * file, however heavy it is: which is exactly how an un-prepared image ends up
 * costing a phone 2.6 MB, and why `weightProblems` reports it.
 */
export function phoneImageVariant(image: ManifestImage, screenWidth = PHONE_WIDTH): string | null {
  const variants = (image.variants ?? []).filter((v) => v.file && v.width > 0).sort((a, b) => a.width - b.width);
  if (variants.length === 0) return image.file;
  return (variants.find((v) => v.width >= screenWidth) ?? variants[variants.length - 1]!).file;
}

/**
 * What one page loads, in bytes: the page itself, its stylesheet, its script, its
 * fonts and favicon, and one file per image slot.
 */
export function pageLoadout(input: {
  page: string;
  html: string;
  css?: string;
  sizes: Map<string, number>;
  images?: ManifestImage[];
  screenWidth?: number;
}): LoadedFile[] {
  const { page, html, css = "", sizes, images = [], screenWidth = PHONE_WIDTH } = input;
  // The page itself is a load, even when nothing refers to it.
  const load: LoadedFile[] = sizes.has(page) ? [{ file: page, bytes: sizes.get(page)! }] : [];
  // One file per image slot: the rest of a variant set stays on disk.
  const imageFiles = new Set<string>();
  for (const image of images) {
    const chosen = phoneImageVariant(image, screenWidth);
    if (chosen) imageFiles.add(chosen);
  }
  const candidates = new Set<string>();
  for (const image of images) for (const v of image.variants ?? []) if (v.file) candidates.add(v.file);
  for (const ref of referencedPaths(html, css)) {
    if (candidates.has(ref) && !imageFiles.has(ref)) continue; // a variant nobody on this screen downloads
    if (ref === "manifest.json" || ref === "README.txt") continue; // our records, not the page
    const bytes = sizes.get(ref);
    if (bytes === undefined) continue; // missing files are another check's business
    if (load.some((l) => l.file === ref)) continue;
    load.push({ file: ref, bytes });
  }
  return load;
}

/**
 * Everything wrong with a page's weight, in the words a failure message uses.
 *
 * The ceiling is a refusal; the target is not. A page between the two is a page to
 * look at, not a build to stop — the manifest carries the number either way.
 */
export function weightProblems(input: {
  page: string;
  html: string;
  css?: string;
  sizes: Map<string, number>;
  images?: ManifestImage[];
  screenWidth?: number;
}): string[] {
  const load = pageLoadout(input);
  const total = load.reduce((sum, f) => sum + f.bytes, 0);
  const problems: string[] = [];
  if (total > BUDGET.pageCeiling) {
    const heaviest = [...load].sort((a, b) => b.bytes - a.bytes)[0]!;
    problems.push(
      `page ${input.page} weighs ${kb(total)} cold, over the ${kb(BUDGET.pageCeiling)} ceiling in docs/design-system.md §8. ` +
        `The single heaviest file it loads is ${heaviest.file} at ${kb(heaviest.bytes)}${heaviest.file.includes("images/") ? " — run tools/prepare-images.py on it" : ""}.`,
    );
  }
  for (const file of load) {
    if (file.file.includes("images/") && file.bytes > BUDGET.singleImageCap) {
      problems.push(
        `image ${file.file} is ${kb(file.bytes)}, over the ${kb(BUDGET.singleImageCap)} cap for a single image file — a file this size is a mistake, not a hero.`,
      );
    }
  }
  return problems;
}

/**
 * The per-image budget, whatever the image's source: a supplied file is measured
 * exactly like a downloaded one, because that is how a 2.6 MB hero slipped into a
 * published bundle — the cap only ever ran on files we fetched ourselves.
 *
 * The heaviest variant is held to the hero's widest-width budget, and the variant a
 * 360px phone downloads is held to the phone figure, because that is the file the
 * person holding the phone pays for.
 */
export function imageBudgetProblems(input: {
  images: ManifestImage[];
  sizes: Map<string, number>;
  screenWidth?: number;
}): string[] {
  const { images, sizes, screenWidth = PHONE_WIDTH } = input;
  const problems: string[] = [];
  for (const image of images) {
    const files = (image.variants ?? []).filter((v) => v.file).map((v) => ({ file: v.file, width: v.width }));
    if (files.length === 0 && image.file) files.push({ file: image.file, width: image.width ?? 0 });
    const budget = image.role === "hero" ? BUDGET.heroLargest : BUDGET.about;
    for (const { file, bytes, width } of files.map((f) => ({ ...f, bytes: sizes.get(f.file) ?? 0 }))) {
      if (bytes === 0) continue; // not in the bundle: a separate warning covers that
      if (bytes > budget) {
        problems.push(
          `the ${image.role} image ${file} is ${kb(bytes)}${width ? ` at ${width}px wide` : ""}, over the design system's ${kb(budget)} budget for it ` +
            `(docs/design-system.md §8). Prepare it with tools/prepare-images.py — a supplied image that breaks the budget must be normalised, not shipped.`,
        );
      }
    }
    const phoneFile = phoneImageVariant(image, screenWidth);
    if (image.role === "hero" && phoneFile && (image.variants?.length ?? 0) > 0) {
      const bytes = sizes.get(phoneFile) ?? 0;
      if (bytes > BUDGET.heroAt360) {
        problems.push(
          `the hero file a ${screenWidth}px phone downloads (${phoneFile}) is ${kb(bytes)}, over the ${kb(BUDGET.heroAt360)} the design system allows for it (docs/design-system.md §8).`,
        );
      }
    }
  }
  return problems;
}
