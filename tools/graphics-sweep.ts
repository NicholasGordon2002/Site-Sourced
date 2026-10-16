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
 * A row that **cannot be applied** is reported as INVALID and the sweep exits non-zero.
 * It is not a skip and it is not a pass: an unapplied row proves nothing about the
 * condition it names, and two of them sat in this table on 17 Oct looking like rows that
 * had been run. Two ways a row stops applying, both silent until this guard existed:
 *
 *   - **the escape trap.** A row's text lives in a template literal, where `\b` is the
 *     backspace character (U+0008) and `\s` is a plain `s`. A row quoting a regex must
 *     double its backslashes (`\\b`, `\\s`); one that does not can never match the file;
 *   - **the shadowing trap.** A mutation must **replace** the line carrying the condition.
 *     Adding a second property in front of one (`pages: [],` before `pages,`) is a no-op —
 *     JavaScript takes the last — so the file changes but the code does not, and the row
 *     reads as a condition with no test behind it.
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

// The files the wiring lives in, derived from the layer's own path so a move keeps every
// row pointing at the same tree.
const WIRING = GRAPHICS.replace("graphics.ts", "graphics-wiring.ts");
const ADDRESSES = GRAPHICS.replace("graphics.ts", "addresses.ts");
const FAMILY = GRAPHICS.replace("graphics.ts", "family-render.ts");
const SCA = GRAPHICS.replace("graphics.ts", "service-card-action.ts");

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
  { id: "c4-per-part-cap", clause: "4", condition: `size(part) > cap`, file: GRAPHICS, from: `    if (size(part) > cap) {`, to: `    if (size(part) > cap + 1e9) {` },
  { id: "c4-cap-declared", clause: "4", condition: `if (cap === undefined) — a part with no byte cap`, file: GRAPHICS, from: `    if (cap === undefined) {`, to: `    if (false && cap === undefined) {` },
  { id: "c4-icon-count", clause: "4", condition: `each.length !== ICON_NAMES.length`, file: GRAPHICS, from: `    if (each.length !== ICON_NAMES.length) {`, to: `    if (false && each.length !== ICON_NAMES.length) {` },
  { id: "c4-one-icon-cap", clause: "4", condition: `bytes > GRAPHICS_BYTE_CAPS.oneIcon`, file: GRAPHICS, from: `      if (bytes > GRAPHICS_BYTE_CAPS.oneIcon) {`, to: `      if (bytes > GRAPHICS_BYTE_CAPS.oneIcon + 1e9) {` },
  { id: "c4-layer-cap", clause: "4", condition: `layerBytes > GRAPHICS_BYTE_CAPS.layer`, file: GRAPHICS, from: `  if (layerBytes > GRAPHICS_BYTE_CAPS.layer) {`, to: `  if (layerBytes > GRAPHICS_BYTE_CAPS.layer + 1e9) {` },
  { id: "c4-size-from-text-not-bytes", clause: "4", condition: `const size = (part) => Buffer.byteLength(part.text, "utf8")`, file: GRAPHICS, from: `  const size = (part: GraphicsPart): number => Buffer.byteLength(part.text, "utf8");`, to: `  const size = (part: GraphicsPart): number => part.bytes ?? Buffer.byteLength(part.text, "utf8");` },

  // ---- clause 5 — additive only (the selector walk, at the top level and inside at-rules)
  { id: "c5-not-a-class", clause: "5", condition: `selector && !selector.startsWith(".")`, file: GRAPHICS, from: `          if (selector && !selector.startsWith(".")) found.push({ selector, atRules: [...atRules] });`, to: `          if (false && selector && !selector.startsWith(".")) found.push({ selector, atRules: [...atRules] });` },
  { id: "c5-not-gfx", clause: "5", condition: `selector.includes(".") && !selector.includes(".gfx-")`, file: GRAPHICS, from: `          else if (selector.includes(".") && !selector.includes(".gfx-")) found.push({ selector, atRules: [...atRules] });`, to: `          else if (false && selector.includes(".") && !selector.includes(".gfx-")) found.push({ selector, atRules: [...atRules] });` },
  { id: "c5-at-rule-container", clause: "5", condition: `prelude.startsWith("@") — an at-rule head is a block header, not a selector`, file: GRAPHICS, from: `      } else if (prelude.startsWith("@")) {`, to: `      } else if (prelude.startsWith("@NEVER")) {` },
  { id: "c5-keyframes-limit", clause: "5", condition: `KEYFRAMES_AT_RULE.test(prelude) — a key frames block is not walked into`, file: GRAPHICS, from: `        if (KEYFRAMES_AT_RULE.test(prelude)) open.push(false);`, to: `        if (false && KEYFRAMES_AT_RULE.test(prelude)) open.push(false);` },
  { id: "c5-walk-into-at-rules", clause: "5", condition: `const nested = open.includes(false) — the walk looks inside at-rule blocks`, file: GRAPHICS, from: `      const nested = open.includes(false);`, to: `      const nested = open.length > 0;` },
  { id: "c5-at-rule-pushed", clause: "5", condition: `atRules.push(prelude) — the at-rule path a refusal names`, file: GRAPHICS, from: `        else {\n          open.push(true);\n          atRules.push(prelude);\n        }`, to: `        else {\n          open.push(true);\n        }` },
  { id: "c5-head-consumed", clause: "5", condition: `head = "" — a prelude belongs to the block it opens`, file: GRAPHICS, from: `      const prelude = head.trim();\n      head = "";`, to: `      const prelude = head.trim();` },
  { id: "c5-statement-reset", clause: "5", condition: `token === ";" — a statement ends the prelude it is not part of`, file: GRAPHICS, from: `    } else if (token === ";") {`, to: `    } else if (false && token === ";") {` },
  { id: "c5-block-opens", clause: "5", condition: `token === "{" — a block opens`, file: GRAPHICS, from: `    } else if (token === "{") {`, to: `    } else if (false && token === "{") {` },
  { id: "c5-block-closes", clause: "5", condition: `token === "}" — a block closes`, file: GRAPHICS, from: `    if (token === "}") {`, to: `    if (false && token === "}") {` },
  { id: "c5-path-unwinds", clause: "5", condition: `if (open.pop()) atRules.pop() — leaving an at-rule block unwinds the path`, file: GRAPHICS, from: `      if (open.pop()) atRules.pop();`, to: `      open.pop();` },
  { id: "c5-at-rule-named", clause: "5", condition: `the where clause that names the at-rule in the refusal`, file: GRAPHICS, from: `      const where = atRules.length === 0 ? "" : \` inside the at-rule\${atRules.length > 1 ? "s" : ""} "\${atRules.join(" > ")}"\`;`, to: `      const where = "";` },
  { id: "c5-css-part-only", clause: "5", condition: `if (part.name !== "css") continue;`, file: GRAPHICS, from: `    if (part.name !== "css") continue;`, to: `    if (true) continue;` },
  { id: "c4-icons-part-only", clause: "4", condition: `if (part.name !== "icons") continue;`, file: GRAPHICS, from: `    if (part.name !== "icons") continue;`, to: `    if (true) continue;` },

  // ---- the wiring — the check runs inside a real build
  { id: "wiring-compliance-checks", clause: "wiring", condition: `problems.push(...graphicsProblems(vars.graphics)) in build.ts`, file: BUILD, from: `  problems.push(...graphicsProblems(vars.graphics));`, to: `  // problems.push(...graphicsProblems(vars.graphics));` },

  // ---- the wiring's own clauses (graphics-wiring.ts) and the three guards the layer's
  //      inline marks pushed back to reading text
  { id: "gw-requested", clause: "wiring", condition: "graphicsRequested: a truthy value", file: WIRING, from: `  return raw !== "" && raw !== "0" && raw !== "false" && raw !== "off";`, to: `  return false;` },
  { id: "gw-slug-scoped", clause: "wiring", condition: "if (vars.slug !== GRAPHICS_SLUG) — one demonstration only", file: WIRING, from: `  if (vars.slug !== GRAPHICS_SLUG) {`, to: `  if (false && vars.slug !== GRAPHICS_SLUG) {` },
  { id: "gw-business-refused", clause: "wiring", condition: "if (vars.phase === \"business\") — the delivered phase", file: WIRING, from: `  if (vars.phase === "business") {`, to: `  if (false && vars.phase === "business") {` },
  { id: "gw-unrecognised", clause: "wiring", condition: "if (decision.unrecognised !== null)", file: WIRING, from: `  if (decision.unrecognised !== null) {`, to: `  if (false && decision.unrecognised !== null) {` },
  { id: "gw-off-page-smuggled", clause: "wiring", condition: "for (const page of marked) — a mark while the switch is off", file: WIRING, from: `    for (const page of marked) {`, to: `    for (const page of []) {` },
  { id: "gw-off-css-smuggled", clause: "wiring", condition: "the stylesheet carries the layer while the switch is off", file: WIRING, from: `    if (css.includes(".gfx-icon {") || css.includes(GRAPHICS_MARKER)) {`, to: `    if (false && (css.includes(".gfx-icon {") || css.includes(GRAPHICS_MARKER))) {` },
  { id: "gw-on-page-unmarked", clause: "wiring", condition: "if (!marked.includes(page)) — a page with no mark", file: WIRING, from: `    if (!marked.includes(page)) {`, to: `    if (false && !marked.includes(page)) {` },
  { id: "gw-on-css-unmarked", clause: "wiring", condition: "if (!cssCarriesLayer) — the stylesheet with no layer", file: WIRING, from: `  if (!cssCarriesLayer) {`, to: `  if (false && !cssCarriesLayer) {` },
  { id: "gw-mark-unmarked", clause: "wiring", condition: "a gfx mark with no aria-hidden and no role", file: WIRING, from: `      if (!/aria-hidden="true"/i.test(tag) && !/role="img"/i.test(tag)) {`, to: `      if (false && !/aria-hidden="true"/i.test(tag) && !/role="img"/i.test(tag)) {` },
  { id: "gw-mark-unfocusable", clause: "wiring", condition: "focusable=\"false\" on a mark", file: WIRING, from: `      if (!/focusable="false"/i.test(tag)) {`, to: `      if (false && !/focusable="false"/i.test(tag)) {` },
  { id: "gw-map-caption", clause: "wiring", condition: "if (shows && !page.html.includes(MAP_CAPTION))", file: WIRING, from: `    if (shows && !page.html.includes(MAP_CAPTION)) {`, to: `    if (false && shows && !page.html.includes(MAP_CAPTION)) {` },
  { id: "gw-mark-in-control", clause: "wiring", condition: "a mark written inside a button-shaped anchor", file: WIRING, from: `      if (/\\bgfx-/.test(control.slice(control.indexOf(">")))) {`, to: `      if (false && /\\bgfx-/.test(control.slice(control.indexOf(">")))) {` },
  // A mutation must **replace** the line that carries the condition, never be added in front of
  // it. `pages: [],` prepended to an object literal that already carries `pages,` is a no-op —
  // JavaScript takes the last property — so the row read 0 failures and looked like a condition
  // with no test behind it. It has one (`test/graphics.test.ts`, "the clauses are wired into the
  // build itself"); what was wrong was the mutation.
  { id: "gw-wiring-in-build", clause: "wiring", condition: "graphicsWiringProblems(...) — the pages the build checks are the bundle's own", file: BUILD, from: `    ...graphicsWiringProblems({\n      pages,\n      css: vars.css,`, to: `    ...graphicsWiringProblems({\n      pages: [],\n      css: vars.css,` },
  { id: "gw-phone-geometry", clause: "guards", condition: "withoutGeometry: a drawing's path data is not a printed number", file: ADDRESSES, from: `  return html.replace(GEOMETRY_ELEMENTS, " ");`, to: `  return html;` },
  { id: "gw-heading-text", clause: "guards", condition: "headingText: a mark beside a name is not part of it", file: FAMILY, from: `  return inner.replace(/<[^>]*>/g, "").trim();`, to: `  return inner.trim();` },
  { id: "gw-fetch-image", clause: "guards", condition: "fetchedBy: a raster <image> in a drawing still fetches", file: SCA, from: `        ...(/<image[\\s>]/i.test(card) ? ["an <image>"] : []),`, to: `        ...((false) ? ["an <image>"] : []),` },

  // The caption exemption (clause 4 counts the layer's bytes over every part *except* the
  // caption, which has no cap of its own). Without it the caption lands in the no-cap branch,
  // and `the real layer passes all five clauses` is the test that says so.
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

// A row whose text carries a control character that no source file holds can never match: it was
// written in a template literal without doubling a backslash, so `\b` became U+0008 before this
// tool ever ran. Named here rather than discovered as a quiet skip. A newline (U+000A) and a tab
// (U+0009) are built by `\n` and `\t` on purpose — a row may span lines — so they are not flags.
const MANGLED = ROWS.filter((row) => /[\u0000-\u0008\u000b\u000c\u000d\u000e-\u001f\u007f]/.test(`${row.from}${row.to}`));

mkdirSync(outDir, { recursive: true });
const rows = ROWS.filter((row) => !only || row.id === only);
console.log(`# graphicsProblems() mutation sweep — ${rows.length} rows`);
for (const row of MANGLED) {
  console.log(
    `!! ${row.id}: INVALID ROW — its text carries a control character, so it can never match ${row.file}. ` +
      `A row in a template literal must double the backslashes of any regex it quotes (\\b, \\s, \\\\/).`,
  );
}
for (const [file, text] of original) {
  console.log(`# ${file} at the start of the sweep: sha256 ${sha(text)}`);
}
console.log(`# git rev-parse HEAD: ${Bun.spawnSync(["git", "rev-parse", "HEAD"]).stdout.toString().trim()}`);
const baseline = Bun.spawnSync(["bun", "test", "test/graphics.test.ts"], { stdout: "pipe", stderr: "pipe" });
const baselineText = `${baseline.stdout.toString()}${baseline.stderr.toString()}`;
console.log(`# bun test test/graphics.test.ts (unmutated): ${/^\s*(\d+) pass\b/m.exec(baselineText)?.[1] ?? "?"} pass / ${/^\s*(\d+) fail\b/m.exec(baselineText)?.[1] ?? "?"} fail\n`);

let unguarded = 0;
let invalid = 0;
for (const row of rows) {
  const before = original.get(row.file)!;
  const beforeSha = sha(before);
  if (!before.includes(row.from)) {
    invalid += 1;
    const mangled = MANGLED.includes(row);
    console.log(`\n## ${row.id}  (clause ${row.clause})`);
    console.log(`condition: ${row.condition}`);
    console.log(
      `!! INVALID ROW — the text to mutate is not in ${row.file}, so this row proves nothing about the condition it names.`,
    );
    console.log(
      mangled
        ? "   ...and its text carries a control character: a template literal ate an escape. Double the backslash (\\b → \\\\b)."
        : "   ...the enclosing condition has moved or gone: retarget the row at the code that carries it now, or retire the row in its own commit and say why.",
    );
    continue;
  }
  const mutated = before.replace(row.from, row.to);
  if (mutated === before) {
    invalid += 1;
    console.log(`\n## ${row.id}  (clause ${row.clause})`);
    console.log(`condition: ${row.condition}`);
    console.log(
      `!! INVALID ROW — the replacement leaves the file byte-identical, so there is nothing to run.`,
    );
    continue;
  }
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
console.log(
  `\n# ${rows.length} rows: ${unguarded} with no test going red (unguarded), ${invalid} invalid (the row did not apply), ${rows.length - unguarded - invalid} guarded`,
);
if (invalid > 0) {
  console.log(
    "# SWEEP INCOMPLETE — an invalid row proves nothing about the condition it names. Fix or retire it, then run the sweep again.",
  );
  process.exit(1);
}
