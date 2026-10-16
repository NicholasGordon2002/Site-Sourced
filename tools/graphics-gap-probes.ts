#!/usr/bin/env bun
/**
 * The two gaps the mutation sweep names, probed directly.
 *
 *   bun run tools/graphics-gap-probes.ts
 *
 * The sweep (`tools/graphics-sweep.ts`) shows which conditions of `graphicsProblems()`
 * have no test behind them. Three came out unguarded; this script shows what each one
 * actually means, so the doc can say "here is the hole" rather than "here is a branch".
 *
 * No filesystem, no network.
 */
import {
  GRAPHICS_BYTE_CAPS,
  graphicsCss,
  graphicsParts,
  graphicsProblems,
} from "../src/demo/graphics.ts";

const show = (label: string, value: unknown) => console.log(`${label}\n  ${JSON.stringify(value)}\n`);

// ---------------------------------------------------------------------------
// Gap 1 — clause 5's `if (head.startsWith("@")) continue;`
//
// `cssSelectors()` splits the stylesheet on "}" and takes everything before the first
// "{" in each chunk as the head. In a block whose text begins with an at-rule, the head
// *is* the at-rule, so the whole block is skipped — and a rule nested inside an at-rule
// is never inspected at all.
// ---------------------------------------------------------------------------
const leak = '.card { border-color: var(--accent); }';
const nestedLeak = `@media (min-width: 40rem) { ${leak} }`;
show("1a. an unscoped rule at the top level — refused (guarded by clause 5's test):", graphicsProblems([{ name: "css", text: leak }]));
show("1b. the SAME rule nested in an @media block — nothing is reported:", graphicsProblems([{ name: "css", text: nestedLeak }]));
console.log(`1c. at-rules in the real layer's own stylesheet: ${(graphicsCss().match(/@[a-z-]+/gi) ?? []).join(" ") || "none"}`);
console.log("    (so the skip is not exercised by the shipped stylesheet either — the branch is untested, not merely unreached)\n");

// ---------------------------------------------------------------------------
// Gap 2 — clause 4's `if (cap !== undefined && size(part) > cap)`
//
// The guard can only matter for a part whose name is not a key of GRAPHICS_BYTE_CAPS.
// `named` excludes exactly one part, the caption — so with the real or a doctored layer
// the guard's false half is unreachable, and deleting it changes nothing (sweep row
// `c4-cap-undefined-guard`: 11 pass / 0 fail).
// ---------------------------------------------------------------------------
const names = graphicsParts().map((part) => part.name);
const uncapped = names.filter((name) => !(name in GRAPHICS_BYTE_CAPS));
show("2a. parts the layer emits:", names);
show("2b. parts with no entry in GRAPHICS_BYTE_CAPS (the only names the guard can catch):", uncapped);

// ---------------------------------------------------------------------------
// Gap 3 — `named = parts.filter((part) => part.name !== "caption")`
//
// Deleting the exemption leaves every test green (sweep row `c4-caption-in-named`),
// because the caption is 71 bytes against a 13,312-byte layer cap and has no cap key.
// ---------------------------------------------------------------------------
show("3a. the caption part, which the exemption removes from the byte counting:", graphicsParts().filter((p) => p.name === "caption"));
show("3b. layer bytes counted WITH the caption in `named`:", graphicsParts().reduce((sum, part) => sum + part.bytes, 0));
show("3c. the layer cap it must stay under:", GRAPHICS_BYTE_CAPS.layer);
console.log(`3d. margin: ${GRAPHICS_BYTE_CAPS.layer - graphicsParts().reduce((sum, part) => sum + part.bytes, 0)} bytes — the exemption is not what keeps the cap passing\n`);

// ---------------------------------------------------------------------------
// The positive half of "the cap measures each part's text, never its bytes field":
// a part whose label lies about its size is still measured, and a text-length
// (character) count would be the wrong figure on this layer's non-ASCII copy.
// ---------------------------------------------------------------------------
const icons = graphicsParts().find((part) => part.name === "icons")!;
show("4a. a part whose bytes field claims 999,999 with the real text behind it (the label cannot invent a problem):", graphicsProblems([{ name: "icons", text: icons.text, bytes: 999_999 }]));
show("4b. a part whose bytes field claims 1 byte with three times the text behind it (the label cannot hide one):", graphicsProblems([{ name: "icons", text: icons.text.repeat(3), bytes: 1 }]).filter((p) => p.includes("cap")));
const nonAscii = (icons.text.match(/[^\x00-\x7F]/g) ?? []).length;
console.log(`4c. non-ASCII characters in the icons part: ${nonAscii} — text length ${icons.text.length} vs utf8 bytes ${icons.bytes}`);
