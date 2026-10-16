# The graphics check's doctor proofs — `graphicsProblems()`, one row per condition

**Designer session, 17 Oct 2026.** The check-fix session on top of `master` `5da49dc`.
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
3. run `bun test test/graphics.test.ts` and record which tests go red and the first `error:`
   line;
4. restore the file **from the bytes read in step 1** and print its sha256 again.

A row whose mutation leaves **0 failures** is recorded as **UNGUARDED**: nothing in the
suite covers that condition, so it is prose in a source file rather than a rule the build
enforces. Saying which ones those are is the point of the exercise.

- `test/graphics.test.ts` before any mutation: **13 pass / 0 fail** (11 on 16 Oct; +2 this session)
- files under mutation, unchanged in all 36 rows (sha256 equal before and after):
  - `src/demo/graphics.ts` — `89f99acd47a7d3e1aeeb6b9cdcc5f0447698259d6b40d8ce08574bd40d36c4b5`
  - `src/demo/build.ts` — `2d7a20d2f55b83f71fbfb8b2a84cb6696371e65145ee44699e769a0559969223`
- **36 rows: 36 guarded, 0 unguarded, 0 skipped.** The three rows that came out unguarded on
  16 Oct (`c5-at-rule-skip`, `c4-cap-undefined-guard`, `c4-caption-in-named`) are all guarded
  now — §3 says how, and what was changed to make them guardable.
- The suite end to end (`docs/graphics/evidence/suite-2026-10-17.txt`): **337 pass /
  0 fail**, 2,674 `expect()` calls, 25 files (335 / 2,657 on 16 Oct). The four fixtures
  rebuilt with the switches off are byte-identical across the change, and the layer's own
  emitted output is hash-for-hash identical: `docs/graphics/evidence/rebuild-diff-2026-10-17.txt`.

### How to read the "tests that went red" column

| Short form | Test in `test/graphics.test.ts` |
| --- | --- |
| T-layer | the real layer passes all five clauses, and fits its byte caps |
| c1 | clause 1 fires: a layer that reaches the network fails the build |
| c2 | clause 2 fires: an unmarked, doubly-marked or nameless graphic fails |
| c3 | clause 3 fires: a baked-in colour fails, because it cannot follow the surface |
| c4 | clause 4 fires: an icon, the set and the whole layer each have a cap |
| c5 | clause 5 fires: every rule is scoped to a .gfx- class, or it is refused |
| **c5-at-rule** | **clause 5 fires inside an at-rule, and the refusal says which at-rule** (new) |
| **c5-limits** | **clause 5's stated limits hold at the boundary: key frames, and CSS nesting** (new) |
| wiring | the clauses are wired into the build itself, not only callable |

## 2. The rows

| # | Clause | Condition in the code | The mutation | Tests that went red | sha256 before → after |
| --- | --- | --- | --- | --- | --- |
| 1 `c1-absolute-url` | 1 | `REMOTE_PATTERNS "an absolute http(s) URL" /https?:\/\//i` | `["an absolute http(s) URL", /https?:\/\//i],` → `["an absolute http(s) URL", /https?:\/\/NEVER-MATCHES/i],` | c1 | equal |
| 2 `c1-protocol-relative` | 1 | `REMOTE_PATTERNS "a protocol-relative URL" /(?:^\|["'(=\s])\/\//` | `["a protocol-relative URL", /(?:^\|["'(=\s])\/\//],` → `["a protocol-relative URL", /(?:^\|["'(=\s])\/\/NEVER-MATCHES/],` | c1 | equal |
| 3 `c1-import` | 1 | `REMOTE_PATTERNS "an @import" /@import/i` | `["an @import", /@import/i],` → `["an @import", /@import-NEVER/i],` | wiring | equal |
| 4 `c1-url` | 1 | `REMOTE_PATTERNS "a url() reference" /url\(/i` | `["a url() reference", /url\(/i],` → `["a url() reference", /url-NEVER\(/i],` | c1 | equal |
| 5 `c1-script` | 1 | `REMOTE_PATTERNS "a <script> element"` | `["a <script> element", /<script[\s>]/i],` → `["a <script> element", /<script-NEVER[\s>]/i],` | c1 | equal |
| 6 `c1-image` | 1 | `REMOTE_PATTERNS "an <image> element"` | `["an <image> element", /<image[\s>]/i],` → `["an <image> element", /<image-NEVER[\s>]/i],` | c1 | equal |
| 7 `c1-use-outside` | 1 | `REMOTE_PATTERNS "a <use> pointing outside this document"` | `["a <use> pointing outside this document", /<use[^>]*href="(?!\s*#)/i],` → `["a <use> pointing outside this document", /<use-NEVER[^>]*href="(?!\s*#)/i],` | c1 | equal |
| 8 `c1-external-attr` | 1 | `REMOTE_PATTERNS "an external resource attribute"` | `["an external resource attribute", /\b(?:src\|xlink:href\|data\|poster)="/i],` → `["an external resource attribute", /\bNEVER(?:src\|xlink:href\|data\|poster)="/i],` | c1 | equal |
| 9 `c2-marked-both` | 2 | `if (decorative && meaningful)` | `if (decorative && meaningful) {` → `if (false && decorative && meaningful) {` | c2 | equal |
| 10 `c2-no-marking` | 2 | `else if (!decorative && !meaningful)` | `} else if (!decorative && !meaningful) {` → `} else if (false && !decorative && !meaningful) {` | c2 | equal |
| 11 `c2-no-accessible-name` | 2 | `else if (meaningful && !named_)` | `} else if (meaningful && !named_) {` → `} else if (false && meaningful && !named_) {` | c2 | equal |
| 12 `c3-hex` | 3 | `LITERAL_COLOUR_PATTERNS "a hex colour"` | `["a hex colour", /#[0-9a-fA-F]{3,8}\b/],` → `["a hex colour", /NEVER#[0-9a-fA-F]{3,8}\b/],` | c3 | equal |
| 13 `c3-rgb-hsl` | 3 | `LITERAL_COLOUR_PATTERNS "an rgb()/hsl() colour"` | `["an rgb()/hsl() colour", /\b(?:rgba?\|hsla?)\(/i],` → `["an rgb()/hsl() colour", /\bNEVER(?:rgba?\|hsla?)\(/i],` | c3 | equal |
| 14 `c3-named` | 3 | `LITERAL_COLOUR_PATTERNS "a named colour"` | `/(?::\|;\|\s)(?:white\|black\|red\|…\|olive)\b(?![\w-])/i,` → `/(?::\|;\|\s)NEVER(?:white\|black\|red\|…\|olive)\b(?![\w-])/i,` | c3 | equal |
| 15 `c4-per-part-cap` | 4 | `if (size(part) > cap)` | `    if (size(part) > cap) {` → `    if (size(part) > cap + 1e9) {` | c4 | equal |
| 16 `c4-cap-declared` | 4 | `if (cap === undefined)` — a part with no byte cap | `    if (cap === undefined) {` → `    if (false && cap === undefined) {` | c4 | equal |
| 17 `c4-icon-count` | 4 | `each.length !== ICON_NAMES.length` | `if (each.length !== ICON_NAMES.length) {` → `if (false && …) {` | c4 | equal |
| 18 `c4-one-icon-cap` | 4 | `bytes > GRAPHICS_BYTE_CAPS.oneIcon` | `if (bytes > GRAPHICS_BYTE_CAPS.oneIcon) {` → `if (bytes > GRAPHICS_BYTE_CAPS.oneIcon + 1e9) {` | c4 | equal |
| 19 `c4-layer-cap` | 4 | `layerBytes > GRAPHICS_BYTE_CAPS.layer` | `if (layerBytes > GRAPHICS_BYTE_CAPS.layer) {` → `if (layerBytes > GRAPHICS_BYTE_CAPS.layer + 1e9) {` | c4 | equal |
| 20 `c4-size-from-text-not-bytes` | 4 | `const size = (part) => Buffer.byteLength(part.text, "utf8")` | `…Buffer.byteLength(part.text, "utf8");` → `…part.bytes ?? Buffer.byteLength(part.text, "utf8");` | c4 | equal |
| 21 `c5-not-a-class` | 5 | `selector && !selector.startsWith(".")` | `if (selector && !selector.startsWith(".")) found.push({ selector, atRules: [...atRules] });` → `if (false && selector && …)` | c5 | equal |
| 22 `c5-not-gfx` | 5 | `selector.includes(".") && !selector.includes(".gfx-")` | `else if (selector.includes(".") && !selector.includes(".gfx-")) found.push(…)` → `else if (false && …)` | c5, c5-at-rule, c5-limits | equal |
| 23 `c5-at-rule-container` | 5 | `prelude.startsWith("@")` — an at-rule head is a block header, not a selector | `      } else if (prelude.startsWith("@")) {` → `…startsWith("@NEVER")) {` | c5-at-rule, c5-limits | equal |
| 24 `c5-keyframes-limit` | 5 | `KEYFRAMES_AT_RULE.test(prelude)` — a key frames block is not walked into | `if (KEYFRAMES_AT_RULE.test(prelude)) open.push(false);` → `if (false && …)` | c5-limits | equal |
| 25 `c5-walk-into-at-rules` | 5 | `const nested = open.includes(false)` — the walk looks inside at-rule blocks | `const nested = open.includes(false);` → `const nested = open.length > 0;` | c5-at-rule | equal |
| 26 `c5-at-rule-pushed` | 5 | `atRules.push(prelude)` — the at-rule path a refusal names | the `else { open.push(true); atRules.push(prelude); }` arm loses its `atRules.push` | c5-at-rule | equal |
| 27 `c5-head-consumed` | 5 | `head = ""` — a prelude belongs to the block it opens | `const prelude = head.trim();\n      head = "";` → `const prelude = head.trim();` | c5-at-rule | equal |
| 28 `c5-statement-reset` | 5 | `token === ";"` — a statement ends the prelude it is not part of | `    } else if (token === ";") {` → `    } else if (false && token === ";") {` | T-layer, c1, c5, c5-at-rule, wiring | equal |
| 29 `c5-block-opens` | 5 | `token === "{"` — a block opens | `    } else if (token === "{") {` → `    } else if (false && token === "{") {` | c5, c5-at-rule, c5-limits | equal |
| 30 `c5-block-closes` | 5 | `token === "}"` — a block closes | `    if (token === "}") {` → `    if (false && token === "}") {` | c5, c5-at-rule | equal |
| 31 `c5-path-unwinds` | 5 | `if (open.pop()) atRules.pop()` — leaving an at-rule block unwinds the path | `      if (open.pop()) atRules.pop();` → `      open.pop();` | c5-at-rule | equal |
| 32 `c5-at-rule-named` | 5 | the `where` clause that names the at-rule in the refusal | `const where = atRules.length === 0 ? "" : \` inside the at-rule…\`;` → `const where = "";` | c5-at-rule | equal |
| 33 `c5-css-part-only` | 5 | `if (part.name !== "css") continue;` | `    if (part.name !== "css") continue;` → `    if (true) continue;` | c5, c5-at-rule, c5-limits | equal |
| 34 `c4-icons-part-only` | 4 | `if (part.name !== "icons") continue;` | `    if (part.name !== "icons") continue;` → `    if (true) continue;` | c4 | equal |
| 35 `wiring-compliance-checks` | wiring | `problems.push(...graphicsProblems(vars.graphics)) in build.ts` | `problems.push(...graphicsProblems(vars.graphics));` → `// problems.push(...);` | wiring | equal |
| 36 `c4-caption-in-named` | 4 | `parts.filter((part) => part.name !== "caption")` | `const named = parts.filter((part) => part.name !== "caption");` → `const named = parts.filter(() => true);` | T-layer, c1, c5, c5-at-rule, c5-limits, wiring | equal |

Verbatim, row by row (the message each mutation printed, the count of passing tests and the
sha256 pair) is in `docs/graphics/evidence/sweep-log.txt`; the full bun transcript for each
row is in `docs/graphics/evidence/sweep/<id>.txt`.

### Notes on individual rows

- **`c1-import`** is the one clause-1 condition whose own message is guarded by the **wiring**
  test rather than by the clause-1 test: the clause-1 doctor (`@import url("https://…")`)
  also trips the absolute-URL pattern, so it stays green when the `@import` pattern alone is
  disabled. The wiring test's doctor carries no other pattern and goes red.
- **`c4-size-from-text-not-bytes`** goes red, which is the point of the sentence in
  `graphics-layer.md` §5: the clause-4 doctor that grows a part leaves the part's `bytes`
  field behind, so a cap that read the field instead of the text would let it through.
- **`c4-caption-in-named`** was unguarded on 16 Oct and is a full six-test failure now — the
  measurement that changed it is in §3.3.

## 3. The three conditions that came out unguarded, and how each was closed

`bun run tools/graphics-gap-probes.ts` — raw output in
`docs/graphics/evidence/gap-probes.txt`, quoted here. The 16 Oct run of this script printed
the *holes*; the 17 Oct run prints the same probes against the fixed check, and the lines
that changed are marked below.

### 3.1 Clause 5's selector walk: the at-rule hole (row `c5-at-rule-skip` on 16 Oct)

**What was wrong.** `cssSelectors()` split the stylesheet on `}` and took the text before the
first `{` of each chunk as the selector. When a chunk began with an at-rule, that head *was*
the at-rule and `if (head.startsWith("@")) continue;` threw the whole chunk away — so a rule
nested inside an `@media` block was invisible to clause 5. Disabling the skip changed
nothing (11 pass / 0 fail on 16 Oct) because `graphicsCss()` contains no at-rule at all: the
branch was not merely unreached, it was untested. 16 Oct, probe `1b`:

```
1b. the SAME rule nested in an @media block — nothing is reported:
  []
```

**What it is now.** The walk is a brace-depth stack: it reads a block's prelude, and if the
prelude is an at-rule it descends into the block and carries the at-rule's own text with
every selector it finds inside — to any depth, so `@media` inside `@media` (or inside
`@supports`) is checked the same way. 17 Oct, probes `1a`–`1g`:

```
1a. an unscoped rule at the top level — refused, no at-rule to name:
  ["…writes the rule \".card\", which is not scoped to a .gfx- class. …"]
1b. the SAME rule nested in an @media block — refused, and the at-rule is named:
  ["…writes the rule \".card\" inside the at-rule \"@media (min-width: 40rem)\", which is not scoped to a .gfx- class. …"]
1c. a correctly scoped rule in the same @media block — accepted (the case that will arrive first):
  []
1d. two levels down (@supports inside @media) — both at-rules named, outermost first:
  ["…inside the at-rules \"@media (min-width: 40rem) > @supports (display: grid)\", …"]
1e. at-rules in the real layer's own stylesheet: none
1f. a rule after an at-rule block — back at the top level, no at-rule carried on:  […no at-rule named…]
1g. a rule after a statement-terminated at-rule (@charset "utf-8";) — checked as a rule, not swallowed as a prelude
```

**Guarded by:** `clause 5 fires inside an at-rule, and the refusal says which at-rule`
(the accept case, the refusal, the named at-rule, the two-level path, the path unwinding and
the statement reset) and `clause 5's stated limits hold at the boundary` (the two limits).
Eight new sweep rows (`c5-at-rule-container`, `c5-keyframes-limit`, `c5-walk-into-at-rules`,
`c5-at-rule-pushed`, `c5-head-consumed`, `c5-statement-reset`, `c5-block-opens`,
`c5-block-closes`) join the two rewritten ones (`c5-not-a-class`, `c5-not-gfx`) and
`c5-path-unwinds` / `c5-at-rule-named`: **13 rows for clause 5, all guarded.** The old row
`c5-at-rule-skip` is gone with the code it described, so its transcript
(`docs/graphics/evidence/sweep/c5-at-rule-skip.txt`) is deleted rather than left beside rows
that no longer exist.

**The limits, on the record.** The doc comment on `cssSelectors()` states three, each with a
boundary test:

1. a `@keyframes` block is **not** walked into — its inner blocks are stops (`from`, `to`,
   `50%`), not selectors, and checking them would refuse a legitimate animation. The cost is
   stated rather than hidden: the animation **name** is unchecked too, and CSS gives it no
   scope, so a key frames block colliding with one the page already has would override it.
   `graphicsCss()` writes no at-rule today; a session that adds one should decide whether the
   layer's animation names must be `gfx-`-prefixed;
2. a style rule's own declaration block is not walked into — a nested rule (CSS nesting) is
   composed with the selector around it, and that enclosing selector is what this walk
   checks, so nothing is hidden by the limit (probe `1i` accepts `.gfx-icon { .card { … } }`
   and refuses `.card { .gfx-icon { … } }`);
3. the walk reads braces, strings and all: a `{` or `}` inside a quoted value would be taken
   for structure. No part of this layer writes one (clause 1 already refuses `url()`, and the
   layer emits no pseudo-element).

There is no depth limit to state: the stack is iterative, so nesting is bounded by the CSS,
not by the check.

### 3.2 Clause 4's `if (cap !== undefined && …)`: the dead half made reachable (row `c4-cap-undefined-guard`)

**What was wrong.** The false half could not be reached: the only part with no cap key is the
caption, and `named` filters the caption out. Replacing the guard with `size(part) > cap!`
left 11 pass / 0 fail on 16 Oct, so the guard was defensive dead code.

**The choice, and why.** Both readings in the brief were possible — delete the dead half, or
make it reachable and test it. **I made it reachable**: a part with no byte cap in
`GRAPHICS_BYTE_CAPS` is now **refused by name** rather than silently free. Deleting the guard
would have left the hole the guard was pointing at (a part that lands in the layer with no
cap is a part the byte clause does not cover, and the layer total would then be checked
against parts that are not all checked on their own). Making it a rule costs one branch, and
clause 4's own test now holds it up — the mutation `c4-cap-declared` (12 pass / 1 fail) is the
proof. 17 Oct, probes `2a`–`2c`:

```
2a. parts the layer emits:  ["icons","css","dividers","map","wordmark","caption"]
2b. parts with no entry in GRAPHICS_BYTE_CAPS:  ["caption"]
2c. a part with no cap, which the old guard passed silently — now refused by name:
  ["graphics layer: its sparkle part has no byte cap in GRAPHICS_BYTE_CAPS. Every part this layer emits is capped, and the layer total is only as honest as the parts under it — a part with no cap is a part nobody bounded."]
```

The real layer is unaffected: every part `named` passes carries a cap (probe `2b`), so
`graphicsProblems()` is still `[]` on the shipped layer, and the four fixtures do not move.

### 3.3 The caption exemption: made load-bearing, and proved (row `c4-caption-in-named`)

**What was wrong, and the measurement.** Deleting the exemption left 11 pass / 0 fail on
16 Oct: the caption is 67 bytes against a 13,312-byte layer cap, so counting it in still
passes with **1,386 bytes** of margin (`docs/graphics/evidence/gap-probes.txt`, `3b`–`3d`).
The exemption is therefore *not* what keeps the cap passing, and the cap cannot prove it.

**The choice, and why.** The brief allowed testing the toggle or removing it. **Neither the
cap nor the count can witness the exemption, so the ruling was moved to the rule added in
§3.2:** the caption is the one part with no cap key, so a layer that stops exempting it
lands in the new refusal by name. The toggle is load-bearing now, and the row that was
unguarded is a six-test failure:

```
$ bun run tools/graphics-sweep.ts --only c4-caption-in-named
result: 7 pass / 6 fail
tests red: T-layer | c1 | c5 | c5-at-rule | c5-limits | wiring
```

The exemption stays in the code, with a comment saying what holds it up, and the byte
measurement stays beside it (67 bytes, 1,386-byte margin) so the next reader does not have to
rediscover why it cannot be proved by the total. The old `c4-cap-undefined-guard` row is gone
with the code it described (its transcript is deleted too); the caption row remains, now
guarded.

## 4. Remaining unguarded conditions: none

`bun run tools/graphics-sweep.ts` on 17 Oct: **36 rows, 36 guarded, 0 unguarded, 0 skipped.**
Counted clause by clause, so nothing is left unnamed:

| Clause | Conditions in `graphicsProblems()` | Rows | Unguarded |
| --- | --- | --- | --- |
| 1 — nothing remote | 8 patterns over every part (including the caption) | `c1-absolute-url`, `c1-protocol-relative`, `c1-import`, `c1-url`, `c1-script`, `c1-image`, `c1-use-outside`, `c1-external-attr` | 0 |
| 2 — marking | doubly-marked, unmarked, meaningful-without-name, over every `<svg>` in every part | `c2-marked-both`, `c2-no-marking`, `c2-no-accessible-name` | 0 |
| 3 — colour | hex, `rgb()`/`hsl()`, named colour, over every part | `c3-hex`, `c3-rgb-hsl`, `c3-named` | 0 |
| 4 — bytes | per-part cap, no-cap refusal, icon count, per-icon cap, layer cap, size measured from text, the `icons`-part filter, the `named` filter | `c4-per-part-cap`, `c4-cap-declared`, `c4-icon-count`, `c4-one-icon-cap`, `c4-layer-cap`, `c4-size-from-text-not-bytes`, `c4-icons-part-only`, `c4-caption-in-named` | 0 |
| 5 — scoping | both selector rules, at-rule heads, key frames, walking into at-rules, the at-rule path in the message, prelude consumption, statement reset, block open, block close, path unwind, the `css`-part filter | 13 rows, §2 #21–#33 | 0 |
| wiring | `graphicsProblems()` called from `complianceChecks()` | `wiring-compliance-checks` | 0 |

## 5. What this sweep does not prove

- It mutates the **check**, not a page. That each clause fires is proved here; that a wired
  page paints the mark it asked for is not, and cannot be until the layer is wired (a later
  session; nothing in this session touched a demo).
- It is bound to `test/graphics.test.ts`. A clause whose test is later deleted or weakened
  becomes unguarded again silently — the only defence is re-running this sweep.
- It says nothing about the two conditions the layer's own doc claims and no check covers
  (the `.gfx-` class namespace in the *markup*, which `test/graphics.test.ts` checks outside
  `graphicsProblems()`, and the visual states of any control built from these marks), nor
  about the key frames **name** limit stated in §3.1.
- Measured on the 17 Oct working tree (master `5da49dc` plus this session's change); the
  file sha256 under test is printed at the head of the sweep log. Re-run before quoting.
