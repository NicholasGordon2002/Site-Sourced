/**
 * Site Sourced — **the licence file a bundle ships names the fonts that bundle ships.**
 *
 * Every face here is under the SIL Open Font License 1.1, which requires the copyright
 * notice and the licence text to travel with the font file. So each bundle carries a
 * `fonts/OFL*.txt` beside the `.woff2` files it loads — and until 25 Nov 2026 that file
 * was a fixed asset, copied in unchanged: it named Fraunces and Source Sans 3 and said
 * "both copyright notices … travel with the font files in every bundle" even in the
 * Northshore bundle, which ships Source Serif 4 instead of Fraunces and carries its own
 * separate licence. A licence file that names a font the folder does not contain is a
 * claim about the bundle that the bundle does not support.
 *
 * The fix is that the text is **written at build time from the files the bundle actually
 * ships**: `licenceText` composes it from `FONT_FACES` and the shipped list, and
 * `licenceTextProblems` reads the written files back and holds them to the folder.
 *
 * The licence text itself is not written by hand here: `assets/fonts/OFL-body.txt` is the
 * OFL 1.1 text verbatim, and it is appended to each generated file.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** What one face is, and what its licence obliges us to print beside it. */
export interface FontFace {
  /** The family name, as the stylesheet declares it. */
  family: string;
  /** What the face is for, in the bundle's own terms. */
  role: string;
  /** The file's own shape: weight, subset, static instance or variable. */
  shape: string;
  copyright: string;
  /** Where the file came from, or a plain statement that this bundle records no URL. */
  source: string;
}

/**
 * The three faces any build can ship. The facts are the ones the old fixed licence files
 * carried, kept verbatim where they were true, and corrected where they were not: a face
 * whose download URL was never recorded says so rather than borrowing another's.
 */
export const FONT_FACES: Readonly<Record<string, FontFace>> = {
  "fraunces-latin-600.woff2": {
    family: "Fraunces",
    role: "display face (headings, the business-name wordmark)",
    shape: "static instance, weight 600, latin subset",
    copyright: "Copyright 2018 The Fraunces Project Authors (https://github.com/undercasetype/Fraunces)",
    source:
      "https://github.com/undercasetype/Fraunces — downloaded from the Google Fonts API v2 CSS endpoint " +
      "(fonts.googleapis.com/css2), which serves the upstream release; the latin subset woff2 was fetched " +
      "from the URL that endpoint returned (fonts.gstatic.com).",
  },
  "source-sans-3-latin.woff2": {
    family: "Source Sans 3",
    role: "body face (paragraphs, labels, buttons, forms)",
    shape: "variable, weights 200-900, latin subset",
    copyright:
      "Copyright 2010-2024 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'. All Rights " +
      "Reserved. Source is a trademark of Adobe in the United States and/or other countries.",
    source:
      "https://github.com/adobe-fonts/source-sans — downloaded from the Google Fonts API v2 CSS endpoint, as above.",
  },
  "source-serif-4-latin-600.woff2": {
    family: "Source Serif 4",
    role: "display face on the Northshore field-guide theme",
    shape: "static instance, weight 600, latin subset",
    copyright: "Copyright 2014 The Source Serif 4 Project Authors (https://github.com/adobe-fonts/source-serif)",
    source:
      "https://github.com/adobe-fonts/source-serif — the file and its licence text came with the theme " +
      "(src/demo/theme-northshore.ts); this bundle records no download URL for the file itself.",
  },
};

/** The OFL 1.1 text, verbatim, appended to every licence file this build writes. */
export const OFL_BODY = readFileSync(join(import.meta.dir, "assets", "fonts", "OFL-body.txt"), "utf8");

/** The font file names a licence text mentions, wherever they appear in it. */
export function fontsNamedIn(text: string): string[] {
  const named = new Set<string>();
  for (const hit of text.matchAll(/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:woff2?|ttf|otf))/g)) named.add(hit[1]!);
  return [...named].sort();
}

/**
 * The licence file for one licence text, naming **only** the shipped faces that travel
 * under it. An unknown file is refused by name rather than described generically: a face
 * whose copyright notice we cannot print is a face we may not redistribute.
 */
export function licenceText(licenceFile: string, shippedFonts: readonly string[], licenceMap: Readonly<Record<string, string>>): string {
  const faces = shippedFonts.filter((file) => licenceMap[file] === licenceFile).sort();
  const unknown = faces.filter((file) => !FONT_FACES[file]);
  if (unknown.length > 0) {
    throw new Error(
      `${licenceFile} would name ${unknown.join(", ")}, which FONT_FACES does not describe — a font file with no copyright notice recorded is a file this build may not redistribute.`,
    );
  }
  const blocks = faces.map((file) => {
    const face = FONT_FACES[file]!;
    return (
      `${face.family} — ${face.role}\n` +
      `  file       ${file}   (${face.shape})\n` +
      `  copyright  ${face.copyright}\n` +
      `  source     ${face.source}\n` +
      `  licence    SIL Open Font License 1.1 — full text below.`
    );
  });
  const copyrights = faces.map((file) => FONT_FACES[file]!.copyright);
  return (
    `Site Sourced — the font files this bundle ships under the SIL Open Font License 1.1\n` +
    `=====================================================================================\n` +
    `\n` +
    `This file is written by the build from the font files the bundle actually ships: every\n` +
    `file named below is in this bundle's fonts/ folder, and every file in that folder that\n` +
    `travels under this licence is named below. A face this bundle does not ship is not named\n` +
    `here.\n` +
    `\n` +
    `${blocks.join("\n\n")}\n` +
    `\n` +
    `Nothing here is sold, renamed or sublicensed on its own, and no Reserved Font Name is\n` +
    `used as the name of anything Site Sourced offers. The copyright notices below and the\n` +
    `licence text that follows travel with these font files inside this bundle.\n` +
    `\n` +
    `Copyright notices\n` +
    `-----------------\n` +
    `${copyrights.join("\n")}\n` +
    `\n` +
    `This Font Software is licensed under the SIL Open Font License, Version 1.1.\n` +
    `\n` +
    `${OFL_BODY}`
  );
}

/**
 * Everything wrong with the licence files a bundle has just written, in the words a failure
 * message uses: a licence that names a font the folder does not hold, a font the folder
 * holds that no licence names, and a licence file with no font behind it at all.
 */
export function licenceTextProblems(vars: {
  /** The names in the bundle's `fonts/` folder, as written. */
  fontsInBundle: readonly string[];
  /** Each licence file's text, by the name it was written as. */
  licenceTexts: Readonly<Record<string, string>>;
  /** Which licence text travels with which font file. */
  licences: Readonly<Record<string, string>>;
}): string[] {
  const { fontsInBundle, licenceTexts, licences } = vars;
  const problems: string[] = [];
  const fontFiles = fontsInBundle.filter((name) => /\.(?:woff2?|ttf|otf)$/i.test(name));
  for (const [licenceFile, text] of Object.entries(licenceTexts)) {
    const named = fontsNamedIn(text);
    for (const file of named) {
      if (!fontFiles.includes(file)) {
        problems.push(
          `fonts/${licenceFile} names ${file}, which this bundle does not ship. A licence file describes the fonts in the folder it sits in: naming a face that is not there is a claim the bundle does not support (and the face that replaced it may be under a different licence).`,
        );
      }
    }
    const expected = fontFiles.filter((file) => licences[file] === licenceFile).sort();
    for (const file of expected) {
      if (!named.includes(file)) {
        problems.push(
          `fonts/${licenceFile} does not name ${file}, which travels under it in this bundle. Every face an OFL licence covers has to be named in the licence text that ships with it.`,
        );
      }
    }
    if (expected.length === 0 && named.length === 0) {
      problems.push(
        `fonts/${licenceFile} is in this bundle with no font file behind it — a licence text no shipped face belongs to.`,
      );
    }
  }
  return problems;
}
