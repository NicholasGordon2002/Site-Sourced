# The graphics check's doctor proofs — `graphicsProblems()`, one row per condition

**Designer session, 16 Oct 2026.** Branch `design/graphics-layer` @ `0b31e2e`.
Companion to `docs/graphics-layer.md` (§5). The check is `graphicsProblems()` in
`src/demo/graphics.ts`, called from `complianceChecks()` in `src/demo/build.ts`.

**Re-run:** `bun run tools/graphics-sweep.ts --out docs/graphics/evidence/sweep`
(writes `docs/graphics/evidence/sweep-log.txt` and one raw transcript per row in
`docs/graphics/evidence/sweep/<id>.txt`). The gap probes in §3 are
`bun run tools/graphics-gap-probes.ts`, output in `docs/graphics/evidence/gap-probes.txt`.

## 1. What the sweep does

A build check that has never been seen to fail is a style guide, so each **condition**
inside `graphicsProblems()` gets its own row:

1. read the file, print its sha256;
2. replace exactly one condition with a form that can no longer fire (a regex that cannot
   match, a comparison that can never be true, a call removed) — one condition per row, so
   the row says which clause died, not that the file broke;
3. run `bun test test/graphics.test.ts` (11 tests, 236 assertions) and record which tests
   go red and the first `error:` line;
4. restore the file **from the bytes read in step 1** and print its sha256 again.

A row whose mutation leaves **0 failures** is recorded as **UNGUARDED**: nothing in the
suite covers that condition, so it is prose in a source file rather than a rule the build
enforces. Saying which ones those are is the point of the exercise.

- `test/graphics.test.ts` before any mutation: **11 pass / 0 fail**
- files under mutation, unchanged in all 27 rows (sha256 equal before and after):
  - `src/demo/graphics.ts` — `e795158641038dc2c031645aaf09ec7b2a6884b577196fba4bbf7e84e975b57a`
  - `src/demo/build.ts` — `2d7a20d2f55b83f71fbfb8b2a84cb6696371e65145ee44699e769a0559969223`
- 3 rows came out unguarded, 0 skipped, 24 guarded.

## 2. The rows

| # | Clause | Condition in the code | The mutation | Tests that went red | sha256 before → after |
| --- | --- | --- | --- | --- | --- |
| 1 `c1-absolute-url` | 1 | `REMOTE_PATTERNS "an absolute http(s) URL" /https?:\/\//i` | `["an absolute http(s) URL", /https?:\/\//i],` → `["an absolute http(s) URL", /https?:\/\/NEVER-MATCHES/i],` | clause 1 fires: a layer that reaches the network fails the build | equal |
| 2 `c1-protocol-relative` | 1 | `REMOTE_PATTERNS "a protocol-relative URL" /(?:^\|["'(=\s])\/\//` | `["a protocol-relative URL", /(?:^\|["'(=\s])\/\//],` → `["a protocol-relative URL", /(?:^\|["'(=\s])\/\/NEVER-MATCHES/],` | clause 1 fires: a layer that reaches the network fails the build | equal |
| 3 `c1-import` | 1 | `REMOTE_PATTERNS "an @import" /@import/i` | `["an @import", /@import/i],` → `["an @import", /@import-NEVER/i],` | the clauses are wired into the build itself, not only callable | equal |
| 4 `c1-url` | 1 | `REMOTE_PATTERNS "a url() reference" /url\(/i` | `["a url() reference", /url\(/i],` → `["a url() reference", /url-NEVER\(/i],` | clause 1 fires: a layer that reaches the network fails the build | equal |
| 5 `c1-script` | 1 | `REMOTE_PATTERNS "a <script> element"` | `["a <script> element", /<script[\s>]/i],` → `["a <script> element", /<script-NEVER[\s>]/i],` | clause 1 fires: a layer that reaches the network fails the build | equal |
| 6 `c1-image` | 1 | `REMOTE_PATTERNS "an <image> element"` | `["an <image> element", /<image[\s>]/i],` → `["an <image> element", /<image-NEVER[\s>]/i],` | clause 1 fires: a layer that reaches the network fails the build | equal |
| 7 `c1-use-outside` | 1 | `REMOTE_PATTERNS "a <use> pointing outside this document"` | `["a <use> pointing outside this document", /<use[^>]*href="(?!\s*#)/i],` → `["a <use> pointing outside this document", /<use-NEVER[^>]*href="(?!\s*#)/i],` | clause 1 fires: a layer that reaches the network fails the build | equal |
| 8 `c1-external-attr` | 1 | `REMOTE_PATTERNS "an external resource attribute"` | `["an external resource attribute", /\b(?:src\|xlink:href\|data\|poster)="/i],` → `["an external resource attribute", /\bNEVER(?:src\|xlink:href\|data\|poster)="/i],` | clause 1 fires: a layer that reaches the network fails the build | equal |
| 9 `c2-marked-both` | 2 | `if (decorative && meaningful)` | `if (decorative && meaningful) {` → `if (false && decorative && meaningful) {` | clause 2 fires: an unmarked, doubly-marked or nameless graphic fails | equal |
| 10 `c2-no-marking` | 2 | `else if (!decorative && !meaningful)` | `} else if (!decorative && !meaningful) {` → `} else if (false && !decorative && !meaningful) {` | clause 2 fires: an unmarked, doubly-marked or nameless graphic fails | equal |
| 11 `c2-no-accessible-name` | 2 | `else if (meaningful && !named_)` | `} else if (meaningful && !named_) {` → `} else if (false && meaningful && !named_) {` | clause 2 fires: an unmarked, doubly-marked or nameless graphic fails | equal |
| 12 `c3-hex` | 3 | `LITERAL_COLOUR_PATTERNS "a hex colour"` | `["a hex colour", /#[0-9a-fA-F]{3,8}\b/],` → `["a hex colour", /NEVER#[0-9a-fA-F]{3,8}\b/],` | clause 3 fires: a baked-in colour fails, because it cannot follow the surface | equal |
| 13 `c3-rgb-hsl` | 3 | `LITERAL_COLOUR_PATTERNS "an rgb()/hsl() colour"` | `["an rgb()/hsl() colour", /\b(?:rgba?\|hsla?)\(/i],` → `["an rgb()/hsl() colour", /\bNEVER(?:rgba?\|hsla?)\(/i],` | clause 3 fires: a baked-in colour fails, because it cannot follow the surface | equal |
| 14 `c3-named` | 3 | `LITERAL_COLOUR_PATTERNS "a named colour"` | `/(?::\|;\|\s)(?:white\|black\|red\|green\|blue\|grey\|gray\|silver\|maroon\|navy\|teal\|olive)\b(?![\w-])/i,` → `/(?::\|;\|\s)NEVER(?:white\|black\|red\|green\|blue\|grey\|gray\|silver\|maroon\|navy\|teal\|olive)\b(?![\w-])/i,` | clause 3 fires: a baked-in colour fails, because it cannot follow the surface | equal |
| 15 `c4-per-part-cap` | 4 | `size(part) > cap` | `if (cap !== undefined && size(part) > cap) {` → `if (cap !== undefined && size(part) > cap + 1e9) {` | clause 4 fires: an icon, the set and the whole layer each have a cap | equal |
| 16 `c4-icon-count` | 4 | `each.length !== ICON_NAMES.length` | `if (each.length !== ICON_NAMES.length) {` → `if (false && each.length !== ICON_NAMES.length) {` | clause 4 fires: an icon, the set and the whole layer each have a cap | equal |
| 17 `c4-one-icon-cap` | 4 | `bytes > GRAPHICS_BYTE_CAPS.oneIcon` | `if (bytes > GRAPHICS_BYTE_CAPS.oneIcon) {` → `if (bytes > GRAPHICS_BYTE_CAPS.oneIcon + 1e9) {` | clause 4 fires: an icon, the set and the whole layer each have a cap | equal |
| 18 `c4-layer-cap` | 4 | `layerBytes > GRAPHICS_BYTE_CAPS.layer` | `if (layerBytes > GRAPHICS_BYTE_CAPS.layer) {` → `if (layerBytes > GRAPHICS_BYTE_CAPS.layer + 1e9) {` | clause 4 fires: an icon, the set and the whole layer each have a cap | equal |
| 19 `c4-size-from-text-not-bytes` | 4 | `const size = (part) => Buffer.byteLength(part.text, "utf8")` | `const size = (part: GraphicsPart): number => Buffer.byteLength(part.text, "utf8");` → `const size = (part: GraphicsPart): number => part.bytes ?? Buffer.byteLength(part.text, "utf8");` | clause 4 fires: an icon, the set and the whole layer each have a cap | equal |
| 20 `c5-not-a-class` | 5 | `selector && !selector.startsWith(".")` | `if (selector && !selector.startsWith(".")) selectors.push(selector);` → `if (false && selector && !selector.startsWith(".")) selectors.push(selector);` | clause 5 fires: every rule is scoped to a .gfx- class, or it is refused | equal |
| 21 `c5-not-gfx` | 5 | `selector.includes(".") && !selector.includes(".gfx-")` | `else if (selector.includes(".") && !selector.includes(".gfx-")) selectors.push(selector);` → `else if (false && selector.includes(".") && !selector.includes(".gfx-")) selectors.push(selector);` | clause 5 fires: every rule is scoped to a .gfx- class, or it is refused | equal |
| 22 `c5-at-rule-skip` | 5 | `if (head.startsWith("@")) continue;` | `if (head.startsWith("@")) continue;` → `if (false && head.startsWith("@")) continue;` | **NONE — UNGUARDED** | equal |
| 23 `c5-css-part-only` | 5 | `if (part.name !== "css") continue;` | `if (part.name !== "css") continue;` → `if (true) continue;` | clause 5 fires: every rule is scoped to a .gfx- class, or it is refused | equal |
| 24 `c4-icons-part-only` | 4 | `if (part.name !== "icons") continue;` | `if (part.name !== "icons") continue;` → `if (true) continue;` | clause 4 fires: an icon, the set and the whole layer each have a cap | equal |
| 25 `wiring-compliance-checks` | wiring | `problems.push(...graphicsProblems(vars.graphics)) in build.ts` | `problems.push(...graphicsProblems(vars.graphics));` → `// problems.push(...graphicsProblems(vars.graphics));` | the clauses are wired into the build itself, not only callable | equal |
| 26 `c4-cap-undefined-guard` | 4 | `cap !== undefined && (the undefined-cap branch)` | `if (cap !== undefined && size(part) > cap) {` → `if (size(part) > cap!) {` | **NONE — UNGUARDED** | equal |
| 27 `c4-caption-in-named` | 4 | `parts.filter((part) => part.name !== "caption")` | `const named = parts.filter((part) => part.name !== "caption");` → `const named = parts.filter(() => true);` | **NONE — UNGUARDED** | equal |

Verbatim, row by row (the message each mutation printed, the count of passing tests and
the sha256 pair) is in `docs/graphics/evidence/sweep-log.txt`; the full bun transcript for
each row is in `docs/graphics/evidence/sweep/<id>.txt`.

### Notes on individual rows

- `c1-import` is the one clause-1 condition whose own message is guarded by the **wiring**
  test rather than by the clause-1 test: the clause-1 doctor (`@import url("https://…")`)
  also trips the absolute-URL pattern, so it stays green when the `@import` pattern alone is
  disabled. The wiring test's doctor carries no other pattern and goes red.
- `c4-size-from-text-not-bytes` goes red, which is the point of the sentence in
  `graphics-layer.md` §5: the clause-4 doctor that grows a part leaves the part's `bytes`
  field behind, so a cap that read the field instead of the text would let it through.
- `c5-at-rule-skip`, `c4-cap-undefined-guard` and `c4-caption-in-named` are the three
  unguarded rows — see §3.

## 3. The three conditions that came out unguarded

`bun run tools/graphics-gap-probes.ts` — raw output in
`docs/graphics/evidence/gap-probes.txt`, quoted here:

### 3.1 `if (head.startsWith("@")) continue;` in `cssSelectors()` — and the hole it hides

`cssSelectors()` takes the text before the first `{` of each `}`-delimited chunk as the
selector. When a block begins with an at-rule, that head *is* the at-rule, so the skip
throws the whole block away. Disabling the skip changes nothing (11 pass / 0 fail) because
the shipped stylesheet contains no at-rule at all — so the branch is not merely unreached,
it is untested, and a rule nested inside an `@media` block is invisible to clause 5:

```
1a. an unscoped rule at the top level — refused (guarded by clause 5's test):
  ["graphics layer: its stylesheet writes the rule \".card\", which is not scoped to a .gfx- class. The layer is additive: wiring it in may not restyle a page that did not ask for it."]

1b. the SAME rule nested in an @media block — nothing is reported:
  []

1c. at-rules in the real layer's own stylesheet: none
    (so the skip is not exercised by the shipped stylesheet either — the branch is untested, not merely unreached)

```

**This is a real hole, not a hypothetical one:** the moment the layer needs a media query,
or the stylesheet is assembled with one in front of it, an unscoped rule can ride in
unchecked. Nothing in this session's scope wires the layer into a page, so the hole is
latent — the next session that adds a media query to `graphicsCss()` should close it and
add a doctor for it.

### 3.2 `if (cap !== undefined && …)` in the per-part byte cap

Its false half can never be reached: the only part with no cap key is the caption, and
`named` filters the caption out. Replacing the guard with `size(part) > cap!` leaves 11
pass / 0 fail, so the guard is defensive dead code — the cap is enforced by the `named`
filter, not by this test.

```
2a. parts the layer emits:
  ["icons","css","dividers","map","wordmark","caption"]

2b. parts with no entry in GRAPHICS_BYTE_CAPS (the only names the guard can catch):
  ["caption"]

```

### 3.3 `const named = parts.filter((part) => part.name !== "caption")`

Deleting the exemption (counting the caption among the capped parts and in the layer total)
leaves 11 pass / 0 fail: the caption is small against a large margin, so no test can tell
the difference.

```
3a. the caption part, which the exemption removes from the byte counting:
  [{"name":"caption","text":"Schematic illustration — not a map of the area, and not to scale.","bytes":67}]

3b. layer bytes counted WITH the caption in `named`:
  11926

3c. the layer cap it must stay under:
  13312

3d. margin: 1386 bytes — the exemption is not what keeps the cap passing

```

### Not unguarded, but worth recording

The caption **is** audited by clauses 1–3 (those loops run over `parts`, not `named`) — only
the byte clauses exempt it. And the sentence "the cap measures each part's text, never its
`bytes` field" is now proved from both sides with a lying label:

```
4a. a part whose bytes field claims 999,999 with the real text behind it (the label cannot invent a problem):
  []

4b. a part whose bytes field claims 1 byte with three times the text behind it (the label cannot hide one):
  ["graphics layer: its icons part is 15210 bytes, over the 6144-byte cap. The layer is an addition to a stylesheet a phone already waits for; the cap is what keeps it an addition.","graphics layer: the whole layer is 15210 bytes, over the 13312-byte cap. It adds no file and no request, but it does add bytes to every page that carries it."]

4c. non-ASCII characters in the icons part: 0 — text length 5070 vs utf8 bytes 5070
```

## 4. What this sweep does not prove

- It mutates the **check**, not a page. That each clause fires is proved here; that a wired
  page paints the mark it asked for is not, and cannot be until the layer is wired (next
  session).
- It is bound to `test/graphics.test.ts`. A clause whose test is later deleted or weakened
  becomes unguarded again silently — the only defence is re-running this sweep.
- It says nothing about the two conditions the layer's own doc claims and no check covers
  (the `.gfx-` class namespace in the *markup*, which `test/graphics.test.ts` checks outside
  `graphicsProblems()`, and the visual states of any control built from these marks).
- Measured on `0b31e2e`. Re-run before quoting.
