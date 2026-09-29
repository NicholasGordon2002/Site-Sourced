/**
 * Site Sourced — hand-supplied imagery, measured before it can ship.
 *
 * A record may point at an image file instead of letting the generator find one:
 * a CC0/public-domain photograph we already hold, or a labelled AI-generated
 * illustration. Those files are the ones nobody was checking, and a 2.7 MB page
 * shipped because of it — the 700 KB cap only ever ran on files we downloaded
 * ourselves.
 *
 * So every supplied file is inspected at build time, and this is where the bundle
 * refuses to be built:
 *
 *   - **the bytes must match the name.** A `.jpg` whose bytes are a PNG is a bug a
 *     browser, a linter and a CDN all disagree about, and it is how the first
 *     fixtures were made.
 *   - **the file must fit the budget.** Over the per-image budget for its role, or
 *     over the hard cap for any single file, and the build stops and says which
 *     command prepares it properly. It is never dropped or resized quietly.
 *   - **the record may not lie about a width.** Every variant's stated width is
 *     re-measured from the file; a mismatch fails, because that number goes into the
 *     page's `srcset` and its `width`/`height` attributes.
 *
 * Nothing here re-encodes anything: image encoding is build-time tooling that lives
 * outside this repo (`tools/prepare-images.py` + a venv), so a delivered bundle never
 * depends on it and this repository stays dependency-free.
 */

import { isAbsolute, resolve } from "node:path";
import { stat } from "node:fs/promises";

import { MAX_IMAGE_BYTES, extensionForFormat, imageSizeFromBytes, sniffImageFormat } from "./images.ts";
import type { ImageFile } from "./images.ts";
import type { ManifestImage } from "./types.ts";
import { BUDGET, kb } from "./weight.ts";

/** Where a supplied image actually lives, or an explanation of everywhere we looked. */
export async function locateSupplied(file: string, recordDir: string): Promise<string> {
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

/** One file of a supplied image, after it has been read and measured. */
export interface MeasuredVariant {
  /** Path inside the bundle. */
  file: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface SuppliedInspection {
  /** The files the record names that exist, narrowest first. */
  variants: MeasuredVariant[];
  /** Files the record names that are not on disk. The page falls back to its CSS treatment. */
  missing: string[];
  /** Reasons this bundle must not exist. */
  problems: string[];
}

/** Every file a manifest image names: a single `file`, or a variant set. */
function namedFiles(image: ManifestImage): { file: string; declaredWidth: number }[] {
  const named = (image.variants ?? []).filter((v) => v.file).map((v) => ({ file: v.file, declaredWidth: v.width }));
  if (named.length > 0) return named;
  return image.file ? [{ file: image.file, declaredWidth: image.width ?? 0 }] : [];
}

export async function inspectSuppliedImage(
  image: ManifestImage,
  recordDir: string,
  role: "hero" | "about" = image.role,
): Promise<SuppliedInspection> {
  const variants: MeasuredVariant[] = [];
  const missing: string[] = [];
  const problems: string[] = [];
  const budget = role === "hero" ? BUDGET.heroLargest : BUDGET.about;

  for (const { file, declaredWidth } of namedFiles(image)) {
    let path: string;
    try {
      path = await locateSupplied(file, recordDir);
    } catch (err) {
      missing.push(file);
      continue;
    }
    const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
    const format = sniffImageFormat(bytes);
    const expected = extensionForFormat(format);
    const extension = file.slice(file.lastIndexOf(".")).toLowerCase();
    if (format && expected && extension !== expected && !(extension === ".jpeg" && expected === ".jpg")) {
      problems.push(
        `image ${file} is a ${format.toUpperCase()} file with a "${extension}" name. Prepare it with tools/prepare-images.py so the bytes and the name agree.`,
      );
    }
    const size = imageSizeFromBytes(bytes);
    if (!size) {
      problems.push(`image ${file} is not a readable PNG, JPEG or WebP — nothing can describe it to a browser.`);
      continue;
    }
    if (declaredWidth > 0 && declaredWidth !== size.width) {
      problems.push(
        `the record says ${file} is ${declaredWidth}px wide, the file is ${size.width}px. The stated width goes into the page's srcset, so correct the record (or re-run tools/prepare-images.py) rather than shipping a descriptor that is untrue.`,
      );
    }
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      problems.push(
        `image ${file} is ${kb(bytes.byteLength)} (${size.width}×${size.height}), over the ${kb(MAX_IMAGE_BYTES)} cap for a single image file. Normalise it with tools/prepare-images.py — a supplied image is measured exactly like a downloaded one.`,
      );
    } else if (bytes.byteLength > budget) {
      problems.push(
        `the ${role} image ${file} is ${kb(bytes.byteLength)} (${size.width}×${size.height}), over the design system's ${kb(budget)} budget for the ${role} image (docs/design-system.md §8). Normalise it with tools/prepare-images.py rather than shipping it.`,
      );
    }
    variants.push({ file, bytes, width: size.width, height: size.height });
  }

  variants.sort((a, b) => a.width - b.width);
  return { variants, missing, problems };
}

/** The manifest entry for a supplied image, described by the files that are really there. */
export function manifestForSupplied(image: ManifestImage, variants: MeasuredVariant[]): ManifestImage {
  const widest = variants[variants.length - 1]!;
  return {
    ...image,
    file: widest.file,
    width: widest.width,
    height: widest.height,
    variants: variants.length > 1 ? variants.map((v) => ({ file: v.file, width: v.width })) : undefined,
  };
}

/** The bytes the bundle needs, one entry per file. */
export function filesForSupplied(variants: MeasuredVariant[]): ImageFile[] {
  return variants.map((v) => ({ path: v.file, bytes: v.bytes }));
}
