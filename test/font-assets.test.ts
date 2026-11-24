/**
 * The bundle's fonts: **exactly the faces its stylesheet declares, each with its licence**.
 *
 * `fontAssetProblems` (`src/demo/build.ts`) reads the stylesheet a bundle ships and the names
 * that ended up in its `fonts/` folder, and holds the two sets to each other in both directions,
 * with the licence text that has to travel with every face.
 *
 * The claims, each able to fail:
 *
 *   1. a normal build passes — Maple Avenue's stylesheet with the shared faces;
 *   2. the Northshore theme's bundle passes with the theme's own files, Source Serif 4 in and
 *      Fraunces out, and the theme's stylesheet really is the one that declares it;
 *   3. a declared face the bundle does not ship fails by name;
 *   4. a shipped face no `@font-face` declares fails by name — the theme's replaced face
 *      travelling along is this clause, in the build;
 *   5. a font with no licence named, a font whose licence did not travel, and a licence with no
 *      font to belong to, all fail.
 *
 * The expectations are written out as literals here rather than derived from `FONT_ASSETS` or
 * `NORTHSHORE_THEME_FONT_FILES`: an expectation computed by the producer agrees with a broken
 * producer (the lesson of `familyRenderingProblems`' notification title, 9 Oct 2026).
 *
 * Build-level proof, run by hand and reproducible from this header — the check refuses a real
 * build, not only a hand-made argument. Each doctor is one edit, reversed with `git checkout`:
 *
 *   cp src/demo/build.ts /tmp/build.bak
 *   # (a) the replaced face travels: drop the theme filter in the copy loop
 *   sed -i 's/!(NORTHSHORE_THEME_REPLACED_FONT_FILES as readonly string\[\]).includes(name)/true/' src/demo/build.ts
 *   DEMO_SERVICE_CARD_ACTION_BAR=nested-cta bun run src/demo/cli.ts \
 *     --record test/fixtures/northshore-garden-works.json --out /tmp/font-doctor \
 *     --cache-dir out/cache/demo      # expect FAILED: "the bundle ships fonts/fraunces-latin-600.woff2"
 *   cp /tmp/build.bak src/demo/build.ts
 *   # (b) the licence does not travel: drop the theme face's entry from FONT_LICENCE_FILES
 *   ...expect FAILED: "fonts/source-serif-4-latin-600.woff2 ships with no licence text named"
 *
 * (The Northshore fixture needs `DEMO_SERVICE_CARD_ACTION_BAR=nested-cta` to build at all — its
 * card shape is the owner's nested-CTA direction — so that switch is set in both runs.)
 *
 * Mutation sweep (every clause load-bearing, `if (false)` per condition, this file as the judge):
 * no-url face, url outside fonts/, empty folder, declared-but-not-shipped, shipped-but-not-declared,
 * no licence named, licence did not travel, stray licence — 8 of 8 turn at least one test red, and
 * the source was restored byte-exact after each.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FONT_LICENCE_FILES, fontAssetProblems } from "../src/demo/build.ts";
import { profileFor } from "../src/demo/copy.ts";
import { renderCss } from "../src/demo/render.ts";
import type { BusinessRecord } from "../src/demo/types.ts";

const record = (name: string): BusinessRecord =>
  JSON.parse(readFileSync(join(import.meta.dir, "fixtures", `${name}.json`), "utf8")) as BusinessRecord;

const maple = record("maple-avenue-barber-shop");
const northshore = record("northshore-garden-works");

/** The shared bundle's fonts, as the bundle ships them — stated here, not read from the build. */
const SHARED_FONTS = ["fraunces-latin-600.woff2", "source-sans-3-latin.woff2", "OFL.txt"];
/** The theme bundle's fonts: the shared text face, the theme's own display face and licence. */
const THEME_FONTS = ["source-sans-3-latin.woff2", "source-serif-4-latin-600.woff2", "OFL.txt", "OFL-source-serif-4.txt"];

const mapleCss = renderCss(profileFor(maple), "maple-avenue-barber-shop");
const themeCss = renderCss(profileFor(northshore), "northshore-garden-works", { theme: true });

const list = (vars: Parameters<typeof fontAssetProblems>[0]): string => fontAssetProblems(vars).join(" | ");

describe("the fonts a bundle ships", () => {
  test("a normal build passes: the shared faces and their licence", () => {
    expect(fontAssetProblems({ css: mapleCss, fontsInBundle: SHARED_FONTS })).toEqual([]);
  });

  test("the Northshore theme's bundle passes: Source Serif 4 in, Fraunces out", () => {
    expect(fontAssetProblems({ css: themeCss, fontsInBundle: THEME_FONTS })).toEqual([]);
  });

  test("the two stylesheets really do declare different display faces", () => {
    expect(mapleCss).toContain('url("fonts/fraunces-latin-600.woff2")');
    expect(mapleCss).not.toContain("source-serif-4-latin-600.woff2");
    expect(themeCss).toContain('url("fonts/source-serif-4-latin-600.woff2")');
    expect(themeCss).not.toContain("fraunces-latin-600.woff2");
    // Both declare the text face; a theme that dropped it would leave every page in Georgia.
    for (const css of [mapleCss, themeCss]) expect(css).toContain('url("fonts/source-sans-3-latin.woff2")');
  });
});

describe("a declared face the bundle does not ship", () => {
  test("fails by name, with the family the stylesheet asked for", () => {
    const problems = list({ css: mapleCss, fontsInBundle: THEME_FONTS });
    expect(problems).toContain('the stylesheet declares "Fraunces" from fonts/fraunces-latin-600.woff2');
    expect(problems).toContain("does not ship that file");
  });

  test("fails in the theme's direction too: its own face left out of the bundle", () => {
    const problems = list({ css: themeCss, fontsInBundle: SHARED_FONTS });
    expect(problems).toContain('the stylesheet declares "Source Serif 4" from fonts/source-serif-4-latin-600.woff2');
    // And the other direction at the same time: the shared face is still in that folder.
    expect(problems).toContain("the bundle ships fonts/fraunces-latin-600.woff2, but no @font-face");
    // OFL.txt stays legitimate — the shared text face is still shipped under it.
    expect(problems).not.toContain("a licence text no font in it belongs to");
  });

  test("a face declared from somewhere other than fonts/ is refused", () => {
    const css = themeCss.replace(
      'url("fonts/source-serif-4-latin-600.woff2")',
      'url("https://fonts.example.test/source-serif-4.woff2")',
    );
    const problems = list({ css, fontsInBundle: THEME_FONTS });
    expect(problems).toContain('from "https://fonts.example.test/source-serif-4.woff2"');
    expect(problems).toContain("points at a file this bundle does not carry");
  });

  test("a face declared with no url() at all is refused", () => {
    const css = `${themeCss}\n@font-face {\n  font-family: "Ghost Face";\n  font-weight: 400;\n}\n`;
    const problems = list({ css, fontsInBundle: THEME_FONTS });
    expect(problems).toContain('@font-face for "Ghost Face" with no url() source');
  });
});

describe("a shipped face no @font-face declares", () => {
  test("fails by name — the replaced face travelling along in the theme's bundle", () => {
    const problems = list({ css: themeCss, fontsInBundle: [...THEME_FONTS, "fraunces-latin-600.woff2"] });
    expect(problems).toContain(
      "the bundle ships fonts/fraunces-latin-600.woff2, but no @font-face in its stylesheet declares it",
    );
  });

  test("fails in a normal build too: an undeclared face is weight no page can load", () => {
    const problems = list({ css: mapleCss, fontsInBundle: [...SHARED_FONTS, "source-serif-4-latin-600.woff2"] });
    expect(problems).toContain("the bundle ships fonts/source-serif-4-latin-600.woff2");
  });

  test("a bundle with no font file at all fails rather than passing vacuously", () => {
    expect(list({ css: "", fontsInBundle: [] })).toContain("fonts/ folder holds no font file at all");
    expect(list({ css: mapleCss, fontsInBundle: ["OFL.txt"] })).toContain("holds no font file at all");
  });
});

describe("the licence that travels with each font", () => {
  test("the real table names a licence for every face this build can ship", () => {
    for (const font of ["fraunces-latin-600.woff2", "source-sans-3-latin.woff2", "source-serif-4-latin-600.woff2"]) {
      expect(FONT_LICENCE_FILES[font]).toBeTruthy();
    }
    expect(FONT_LICENCE_FILES["source-serif-4-latin-600.woff2"]).toBe("OFL-source-serif-4.txt");
  });

  test("a font whose licence did not travel fails by name", () => {
    const problems = list({
      css: themeCss,
      fontsInBundle: THEME_FONTS.filter((name) => name !== "OFL-source-serif-4.txt"),
    });
    expect(problems).toContain("fonts/source-serif-4-latin-600.woff2 ships without its licence");
    expect(problems).toContain("OFL-source-serif-4.txt is not in the bundle");
  });

  test("a font with no licence named for it fails", () => {
    const licences = { ...FONT_LICENCE_FILES };
    delete (licences as Record<string, string>)["source-serif-4-latin-600.woff2"];
    const problems = list({ css: themeCss, fontsInBundle: THEME_FONTS, licences });
    expect(problems).toContain("fonts/source-serif-4-latin-600.woff2 ships with no licence text named for it");
  });

  test("a licence with no font to belong to fails", () => {
    const problems = list({ css: mapleCss, fontsInBundle: [...SHARED_FONTS, "OFL-source-serif-4.txt"] });
    expect(problems).toContain("fonts/OFL-source-serif-4.txt, a licence text no font in it belongs to");
  });
});
