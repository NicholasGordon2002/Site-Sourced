#!/usr/bin/env bun
/**
 * The mutation sweep for `graphicsProblems()` — every clause of the graphics layer's
 * build check, shown able to fail by mutating the condition it guards.
 *
 *   bun run tools/graphics-sweep.ts [--only <id>] [--out <dir>]
 *
 * For each row: record the sha256 of the file, apply one string replacement that
 * disables exactly one condition, run `test/graphics.test.ts`, restore the file from
 * the bytes read before the mutation, and print the sha256 again — equal hashes are
 * the proof the repository was not left mutated.
 *
 * A row whose mutation leaves **0 failures** is reported as UNGUARDED: the condition
 * is not covered by any test, so it is prose rather than a rule.
 *
 * Nothing here touches the network and nothing is written outside `--out`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const GRAPHICS = "src/demo/graphics.ts";
const BUILD = "src/demo/build.ts";

type Row = {
  id: string;
  clause: string;
  /** The condition the mutation disables, in the words of the code. */
  condition: string;
  file: string;
  from: string;
  to: string;
};

const ROWS: Row[] = [
  // ---- clause 1 — nothing reaches the network (eight patterns, eight conditions)
  { id: "c1-absolute-url", clause: "1", condition: `REMOTE_PATTERNS "an absolute http(s) URL" /https?:\\/\\//i`, file: GRAPHICS, from: `["an absolute http(s) URL", /https?:\\/\\//i],`, to: `["an absolute http(s) URL", /https?:\\/\\/NEVER-MATCHES/i],` },
  { id: "c1-protocol-relative", clause: "1", condition: `REMOTE_PATTERNS "a protocol-relative URL" /(?:^|["'(=\\s])\\/\\//`, file: GRAPHICS, from: `["a protocol-relative URL", /(?:^|["'(=\\s])\\/\\//],`, to: `["a protocol-relative URL", /(?:^|["'(=\\s])\\/\\/NEVER-MATCHES/],` },
  { id: "c1-import", clause: "1", condition: `REMOTE_PATTERNS "an @import" /@import/i`, file: GRAPHICS, from: `["an @import", /@import/i],`, to: `["an @import", /@import-NEVER/i],` },
  { id: "c1-url", clause: "1", condition: `REMOTE_PATTERNS "a url() reference" /url\\(/i`, file: GRAPHICS, from: `["a url() reference", /url\\(/i],`, to: `["a url() reference", /url-NEVER\\(/i],` },
  { id: "c1-script", clause: "1", condition: `REMOTE_PATTERNS "a <script> element"`, file: GRAPHICS, from: `["a <script> element", /<script[\\s>]/i],`, to: `["a <script> element", /<script-NEVER[\\s>]/i],` },
  { id: "c1-image", clause: "1", condition: `REMOTE_PATTERNS "an <image> element"`, file: GRAPHICS, from: `["an <image> element", /<image[\\s>]/i],`, to: `["an <image> element", /<image-NEVER[\\s>]/i],` },
  { id: "c1-use-outside", clause: "1", condition: `REMOTE_PATTERNS "a <use> pointing outside this document"`, file: GRAPHICS, from: `["a <use> pointing outside this document", /<use[^>]*href="(?!\\s*#)/i],`, to: `["a <use> pointing outside this document", /<use-NEVER[^>]*href="(?!\\s*#)/i],` },
  { id: "c1-external-attr", clause: "1", condition: `REMOTE_PATTERNS "an external resource attribute"`, file: GRAPHICS, from: `["an external resource attribute", /\\b(?:src|xlink:href|data|poster)="/i],`, to: `["an external resource attribute", /\\bNEVER(?:src|xlink:href|data|poster)="/i],` },

  // ---- clause 2 — every graphic marked, and marked one way
  { id: "c2-marked-both", clause: "2", condition: `if (decorative && meaningful)`, file: GRAPHICS, from: `      if (decorative && meaningful) {`, to: `      if (false && decorative && meaningful) {` },
  { id: "c2-no-marking", clause: "2", condition: `else if (!decorative && !meaningful)`, file: GRAPHICS, from: `      } else if (!decorative && !meaningful) {`, to: `      } else if (false && !decorative && !meaningful) {` },
  { id: "c2-no-accessible-name", clause: "2", condition: `else if (meaningful && !named_)`, file: GRAPHICS, from: `      } else if (meaningful && !named_) {`, to: `      } else if (false && meaningful && !named_) {` },

  // ---- clause 3 — colour comes from the surface
  { id: "c3-hex", clause: "3", condition: `LITERAL_COLOUR_PATTERNS "a hex colour"`, file: GRAPHICS, from: `["a hex colour", /#[0-9a-fA-F]{3,8}\\b/],`, to: `["a hex colour", /NEVER#[0-9a-fA-F]{3,8}\\b/],` },
  { id: "c3-rgb-hsl", clause: "3", condition: `LITERAL_COLOUR_PATTERNS "an rgb()/hsl() colour"`, file: GRAPHICS, from: `["an rgb()/hsl() colour", /\\b(?:rgba?|hsla?)\\(/i],`, to: `["an rgb()/hsl() colour", /\\bNEVER(?:rgba?|hsla?)\\(/i],` },
  { id: "c3-named", clause: "3", condition: `LITERAL_COLOUR_PATTERNS "a named colour"`, file: GRAPHICS, from: `    /(?::|;|\\s)(?:white|black|red|green|blue|grey|gray|silver|maroon|navy|teal|olive)\\b(?![\\w-])/i,`, to: `    /(?::|;|\\s)NEVER(?:white|black|red|green|blue|grey|gray|silver|maroon|navy|teal|olive)\\b(?![\\w-])/i,` },

  // ---- clause 4 — the bytes
  { id: "c4-per-part-cap", clause: "4", condition: `size(part) > cap`, file: GRAPHICS, from: `    if (cap !== undefined && size(part) > cap) {`, to: `    if (cap !== undefined && size(part) > cap + 1e9) {` },
  { id: "c4-icon-count", clause: "4", condition: `each.length !== ICON_NAMES.length`, file: GRAPHICS, from: `    if (each.length !== ICON_NAMES.length) {`, to: `    if (false && each.length !== ICON_NAMES.length) {` },
  { id: "c4-one-icon-cap", clause: "4", condition: `bytes > GRAPHICS_BYTE_CAPS.oneIcon`, file: GRAPHICS, from: `      if (bytes > GRAPHICS_BYTE_CAPS.oneIcon) {`, to: `      if (bytes > GRAPHICS_BYTE_CAPS.oneIcon + 1e9) {` },
  { id: "c4-layer-cap", clause: "4", condition: `layerBytes > GRAPHICS_BYTE_CAPS.layer`, file: GRAPHICS, from: `  if (layerBytes > GRAPHICS_BYTE_CAPS.layer) {`, to: `  if (layerBytes > GRAPHICS_BYTE_CAPS.layer + 1e9) {` },
  { id: "c4-size-from-text-not-bytes", clause: "4", condition: `const size = (part) => Buffer.byteLength(part.text, "utf8")`, file: GRAPHICS, from: `  const size = (part: GraphicsPart): number => Buffer.byteLength(part.text, "utf8");`, to: `  const size = (part: GraphicsPart): number => part.bytes ?? Buffer.byteLength(part.text, "utf8");` },

  // ---- clause 5 — additive only
  { id: "c5-not-a-class", clause: "5", condition: `selector && !selector.startsWith(".")`, file: GRAPHICS, from: `        if (selector && !selector.startsWith(".")) selectors.push(selector);`, to: `        if (false && selector && !selector.startsWith(".")) selectors.push(selector);` },
  { id: "c5-not-gfx", clause: "5", condition: `selector.includes(".") && !selector.includes(".gfx-")`, file: GRAPHICS, from: `        else if (selector.includes(".") && !selector.includes(".gfx-")) selectors.push(selector);`, to: `        else if (false && selector.includes(".") && !selector.includes(".gfx-")) selectors.push(selector);` },
  { id: "c5-at-rule-skip", clause: "5", condition: `if (head.startsWith("@")) continue;`, file: GRAPHICS, from: `      if (head.startsWith("@")) continue;`, to: `      if (false && head.startsWith("@")) continue;` },
  { id: "c5-css-part-only", clause: "5", condition: `if (part.name !== "css") continue;`, file: GRAPHICS, from: `    if (part.name !== "css") continue;`, to: `    if (true) continue;` },
  { id: "c4-icons-part-only", clause: "4", condition: `if (part.name !== "icons") continue;`, file: GRAPHICS, from: `    if (part.name !== "icons") continue;`, to: `    if (true) continue;` },

  // ---- the wiring — the check runs inside a real build
  { id: "wiring-compliance-checks", clause: "wiring", condition: `problems.push(...graphicsProblems(vars.graphics)) in build.ts`, file: BUILD, from: `  problems.push(...graphicsProblems(vars.graphics));`, to: `  // problems.push(...graphicsProblems(vars.graphics));` },

  // ---- rows expected UNGUARDED (no test may go red; the sweep says so out loud)
  { id: "c4-cap-undefined-guard", clause: "4", condition: `cap !== undefined && (the undefined-cap branch)`, file: GRAPHICS, from: `    if (cap !== undefined && size(part) > cap) {`, to: `    if (size(part) > cap!) {` },
  { id: "c4-caption-in-named", clause: "4", condition: `parts.filter((part) => part.name !== "caption")`, file: GRAPHICS, from: `  const named = parts.filter((part) => part.name !== "caption");`, to: `  const named = parts.filter(() => true);` },
];

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const outDir = args.includes("--out") ? args[args.indexOf("--out") + 1] : "docs/graphics/evidence/sweep";

const sha = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const original = new Map<string, string>();
for (const file of new Set(ROWS.map((row) => row.file))) {
  original.set(file, readFileSync(file, "utf8"));
}

mkdirSync(outDir, { recursive: true });
const rows = ROWS.filter((row) => !only || row.id === only);
console.log(`# graphicsProblems() mutation sweep — ${rows.length} rows`);
for (const [file, text] of original) {
  console.log(`# ${file} at the start of the sweep: sha256 ${sha(text)}`);
}
console.log(`# git rev-parse HEAD: ${Bun.spawnSync(["git", "rev-parse", "HEAD"]).stdout.toString().trim()}`);
const baseline = Bun.spawnSync(["bun", "test", "test/graphics.test.ts"], { stdout: "pipe", stderr: "pipe" });
const baselineText = `${baseline.stdout.toString()}${baseline.stderr.toString()}`;
console.log(`# bun test test/graphics.test.ts (unmutated): ${/^\s*(\d+) pass\b/m.exec(baselineText)?.[1] ?? "?"} pass / ${/^\s*(\d+) fail\b/m.exec(baselineText)?.[1] ?? "?"} fail\n`);

let unguarded = 0;
let missed = 0;
for (const row of rows) {
  const before = original.get(row.file)!;
  const beforeSha = sha(before);
  if (!before.includes(row.from)) {
    console.log(`!! ${row.id}: the text to mutate was not found — row skipped (file changed?)`);
    missed += 1;
    continue;
  }
  const mutated = before.replace(row.from, row.to);
  writeFileSync(row.file, mutated);
  const proc = Bun.spawnSync(["bun", "test", "test/graphics.test.ts"], {
    env: { ...process.env },
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = `${proc.stdout.toString()}${proc.stderr.toString()}`;
  writeFileSync(row.file, before); // restore
  const after = readFileSync(row.file, "utf8");
  const afterSha = sha(after);
  writeFileSync(join(outDir, `${row.id}.txt`), output);

  const failed = [...output.matchAll(/^\(fail\)\s+(.+?)\s*(?:\[|$)/gm)].map((m) => m[1]!.trim());
  const firstError = /^error: .+$/m.exec(output)?.[0] ?? "";
  const at = /^\s+at <anonymous> \((.+)\)$/m.exec(output)?.[1] ?? "";
  const counts = /^\s*(\d+) pass\b/m.exec(output);
  const fails = /^\s*(\d+) fail\b/m.exec(output);
  if (failed.length === 0) unguarded += 1;
  console.log(`\n## ${row.id}  (clause ${row.clause})`);
  console.log(`condition: ${row.condition}`);
  console.log(`mutation (${row.file}): ${row.from.trim()}`);
  console.log(`                     → ${row.to.trim()}`);
  console.log(`sha256 before: ${beforeSha}`);
  console.log(`sha256 after : ${afterSha}   ${afterSha === beforeSha ? "RESTORED byte-exact" : "**NOT RESTORED**"}`);
  console.log(`result: ${counts?.[1] ?? "?"} pass / ${fails?.[1] ?? "?"} fail`);
  console.log(failed.length ? `tests red: ${failed.join(" | ")}` : "tests red: NONE — UNGUARDED (this condition has no test behind it)");
  if (firstError) console.log(`first failure: ${firstError}${at ? ` at ${at}` : ""}`);
}
console.log(`\n# ${rows.length} rows: ${unguarded} with no test going red (unguarded), ${missed} skipped, ${rows.length - unguarded - missed} guarded`);
