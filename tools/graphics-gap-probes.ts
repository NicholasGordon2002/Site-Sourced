#!/usr/bin/env bun
/**
 * The gaps the mutation sweep named, probed directly — and, after this session, the probes
 * that show each one closed.
 *
 *   bun run tools/graphics-gap-probes.ts
 *
 * The sweep (`tools/graphics-sweep.ts`) says which conditions of `graphicsProblems()` have
 * no test behind them. The 16 Oct run found three; this session closed all three. This
 * script shows what each one *means* — the behaviour, not the branch — so the doc beside it
 * can print the behaviour: the at-rule hole before and after, the cap branch with no cap
 * behind it, and the caption exemption with the bytes that made it invisible.
 *
 * No filesystem, no network.
 */
import {
  GRAPHICS_BYTE_CAPS,
  graphicsCss,
  graphicsParts,
  graphicsProblems,
  type GraphicsPart,
} from "../src/demo/graphics.ts";

const show = (label: string, value: unknown) => console.log(`${label}\n  ${JSON.stringify(value)}\n`);

// ---------------------------------------------------------------------------
// Gap 1 — clause 5's selector walk, at the top level and inside an at-rule
//
// On 16 Oct the walk split the stylesheet on "}" and took everything before the first "{"
// in each chunk as the head. In a chunk whose text began with an at-rule the head *was* the
// at-rule, so the whole chunk was skipped and a rule nested inside an `@media` block was
// invisible (1b reported `[]`). The walk is now a brace-depth stack: it looks inside
// at-rule blocks to any depth, checks each inner selector the same way, and names the
// at-rule in the refusal.
// ---------------------------------------------------------------------------
const leak = '.card { border-color: var(--accent); }';
const nestedLeak = `@media (min-width: 40rem) { ${leak} }`;
show("1a. an unscoped rule at the top level — refused, no at-rule to name:", graphicsProblems([{ name: "css", text: leak }]));
show("1b. the SAME rule nested in an @media block — refused, and the at-rule is named:", graphicsProblems([{ name: "css", text: nestedLeak }]));
show(
  "1c. a correctly scoped rule in the same @media block — accepted (the case that will arrive first):",
  graphicsProblems([{ name: "css", text: "@media (min-width: 40rem) { .gfx-icon--24 { width: 1.5rem; } }" }]),
);
show(
  "1d. two levels down (@supports inside @media) — both at-rules named, outermost first:",
  graphicsProblems([{ name: "css", text: `@media (min-width: 40rem) { @supports (display: grid) { ${leak} } }` }]),
);
console.log(`1e. at-rules in the real layer's own stylesheet: ${(graphicsCss().match(/@[a-z-]+/gi) ?? []).join(" ") || "none"}`);
console.log(
  "    (so the rule is enforced ahead of the layer's first media query rather than after it: the check has no at-rule of its own to test against)\n",
);
show(
  "1f. a rule after an at-rule block — back at the top level, no at-rule carried on:",
  graphicsProblems([{ name: "css", text: "@media (min-width: 40rem) { .gfx-icon { width: 1rem; } }\n" + leak }]),
);
show(
  "1g. a rule after a statement-terminated at-rule (@charset \"utf-8\";) — checked as a rule, not swallowed as a prelude:",
  graphicsProblems([{ name: "css", text: '@charset "utf-8";\n' + leak }]),
);
show(
  "1h. the stated limits: a @keyframes block is not walked into (its inner blocks are stops, not selectors):",
  graphicsProblems([{ name: "css", text: "@keyframes gfx-dash { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 2rem; } }" }]),
);
show(
  "1i. ...and a rule nested in a style rule's own block belongs to the selector around it, which is checked:",
  graphicsProblems([{ name: "css", text: ".gfx-icon { .card { border-color: var(--accent); } }" }]),
);

// ---------------------------------------------------------------------------
// Gap 2 — clause 4's per-part cap
//
// On 16 Oct the cap read `if (cap !== undefined && size(part) > cap)`. The false half could
// not be reached (the only uncapped part was filtered out), so deleting the guard changed
// nothing: 11 pass / 0 fail. The guard is now the rule — a part with no cap in the table is
// **refused by name** — so the branch is reachable from a doctored layer and has a test.
// ---------------------------------------------------------------------------
const names = graphicsParts().map((part) => part.name);
const uncapped = names.filter((name) => !(name in GRAPHICS_BYTE_CAPS));
show("2a. parts the layer emits:", names);
show("2b. parts with no entry in GRAPHICS_BYTE_CAPS:", uncapped);
show(
  "2c. a part with no cap, which the old guard passed silently — now refused by name:",
  graphicsProblems([
    ...graphicsParts(),
    { name: "sparkle", text: '<svg aria-hidden="true"></svg>' } as unknown as GraphicsPart,
  ]),
);

// ---------------------------------------------------------------------------
// Gap 3 — `named = parts.filter((part) => part.name !== "caption")`
//
// On 16 Oct deleting the exemption left every test green: the caption is 67 bytes against a
// 13,312-byte layer cap, so no test could tell the difference (the margin is 1,386 bytes).
// The exemption is not what keeps the cap passing, so it is not proved by the cap. It is
// proved by the rule in 2c instead: the caption is the one part with no cap, so a layer
// that stops exempting it fails clause 4 with exactly that refusal.
// ---------------------------------------------------------------------------
show("3a. the caption part, which the exemption keeps out of the byte clauses:", graphicsParts().filter((p) => p.name === "caption"));
show("3b. layer bytes counted WITH the caption in `named`:", graphicsParts().reduce((sum, part) => sum + part.bytes, 0));
show("3c. the layer cap it must stay under:", GRAPHICS_BYTE_CAPS.layer);
console.log(
  `3d. margin: ${GRAPHICS_BYTE_CAPS.layer - graphicsParts().reduce((sum, part) => sum + part.bytes, 0)} bytes — the cap cannot prove the exemption, so 2c does\n`,
);
console.log("3e. captions among the parts with no cap (the exemption's only client):");
console.log(`  ${JSON.stringify(uncapped)}\n`);

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
