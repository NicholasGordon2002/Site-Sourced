# Clause 7 — every condition, mutated

**Why this file exists.** Clause 7 of `ghostControlsProblems` (`src/demo/build.ts`, the button
family — owner direction by text, 16 Oct 2026) was written as prose: the gate refused seven
things and one test asserted one sentence of it in passing. This team's rule is that **a rule
with no test is treated as no rule**, so the clause was not a rule yet. `test/ghost-controls.test.ts`
now carries one test per condition, and this file is the evidence that each of those tests **can
fail** — every condition was mutated in the build, the suite was watched going red, and the file
was restored byte-exact.

**The suite, before and after**

| | tests | result |
|---|---|---|
| `master` (`94ab024`, the baseline this ran against) | 316 | 316 pass / 0 fail |
| this branch, after the new tests | 324 | 324 pass / 0 fail |

Eight new tests, all in `test/ghost-controls.test.ts`, one per condition:

| condition (build.ts line) | what it refuses |
|---|---|
| `1683` — the family must be marked | a treatment that marks the header's action and not the button family (both the one-selector and the no-selector case) |
| `1693` — a resolved text colour must be readable | a control whose cascade paints it in a colour no reader here can resolve, so its contrast and surface are unchecked |
| `1694` — a resolved outline colour must be readable | the same for the control's boundary |
| `1695` — the control must not resolve to a fill | a control the cascade still paints as the filled pill, though the treatment's own rule says `transparent` |
| `1707` — a photograph control's words must be white | a hero action the cascade paints in anything but white |
| `1712` — a photograph control's outline must be white | a hero action whose outline is not its words' white |
| `1718` — a paper control's words must be the bundle's ink | a paper control painted in words that are not the ink |
| `1727` — a paper control's outline must be its words' colour | two colours on one control |

**Method.** Each mutation is the smallest edit that removes the condition, applied **one at a
time** to `src/demo/build.ts` and run against `bun test test/ghost-controls.test.ts`. The file is
then restored and checked **byte-exact** — `sha256` before and after, printed below. A mutation
whose suite stayed green would mean the condition is not a rule; none did.

Two of the eight doctors change what the condition *tests* rather than short-circuiting the
guard (`?? ([22, 24, 27] as Rgb)` on the resolved colour): clause 7's guard `continue`s after
refusing an unreadable colour, precisely so the surface checks cannot dereference it, so
disabling the guard itself would turn the run into a crash rather than a red test. Defaulting the
resolved value to ink keeps the run honest — the gate no longer refuses the control, and the test
that expects the refusal goes red.

**The sweep log** (build.ts `sha256` before: `58cb5e411005cf17e5e59d1f2b0ac36cf4dfc4b6fa12ee4113d43f43e429897d`;
control run with no mutation: 0 failing):

| mutation | suite |
|---|---|
| `1683 if (unmarked.length > 0) {` → `if (false) {` | **2 red**, 1 of them clause 7 — *clause 7b: a treatment that marks the header's action and not the whole button family is refused, for one selector or for both* (the other is the clause-6 test, which counts the 7b sentence among the five problems the pre-fix stylesheet must trip) |
| `1693 const words = overlayColour(paint.get("color") ?? "", tokens);` → `… ?? ([22, 24, 27] as Rgb);` | **1 red** — *clause 7a: a control whose cascade resolves to no readable text colour is refused* |
| `1694 const outline = overlayColour(paint.get("border-color") ?? "", tokens);` → `… ?? ([22, 24, 27] as Rgb);` | **1 red** — *clause 7a: a paper control with no outline at all is refused — a transparent control's only edge* |
| `1695 if (!/^(transparent\|none)$/i.test(fill)) {` → `if (false) {` | **1 red** — *clause 7a: a control the cascade still fills with the pill is refused, though the treatment's own rule says transparent* |
| `1707 if (!/^255,255,255$/.test(words.join(","))) {` → `if (false) {` | **1 red** — *clause 7a: a hero action the cascade paints in anything but white is refused* |
| `1712 if (!outline \|\| !/^255,255,255$/.test(outline.join(","))) {` → `if (false) {` | **1 red** — *clause 7a: a hero action whose outline resolves to anything but its words' white is refused* |
| `1718 if (!isInk(words)) {` → `if (false) {` | **1 red** — *clause 7a: a paper control the cascade paints in words that are not the bundle's ink is refused* |
| `1727 } else if (outline.join(",") !== words.join(",")) {` → `} else if (false) {` | **1 red** — *clause 7a: a paper control whose outline is not its words' own colour is refused — two colours on one control* |

`build.ts sha256` after the sweep: `58cb5e411005cf17e5e59d1f2b0ac36cf4dfc4b6fa12ee4113d43f43e429897d` —
**byte-exact restore: true. Every condition guarded: true.**

**What each doctor proves about the doctors themselves.** Every 7a doctor appends a rule **after**
the treatment block, so the marked rule the gate also reads still declares `background:
transparent` / the surface's own ink or white. A check that read the treatment's rule instead of
the cascade would pass all seven stylesheets — which is the difference between clause 4 and
clause 7a, and the reason `restPaintOf` exists.

**The treatment's emitted CSS is untouched.** The only non-test edit on this branch is one word in
a refusal **message** (`"that control" → "that control still wears"`, a sentence a reviewer reads).
The stylesheet a switch-on build writes is byte-identical with and without it, proved the same way
as the restores here: the review copy built at the branch tip and again with the whole change
applied —

```
DEMO_GHOST_CONTROLS=surface DEMO_SERVICE_CARD_ACTION_BAR=nested \
  bun run src/demo/cli.ts -- --record test/fixtures --out /tmp/<dir>/demos
sha256sum <dir>/demos/maple-avenue-barber-shop/styles.css
```

both give `d4408213175541b136d633b7156e2ca0272aa561933dd2c73c93dae66762b3e6`. What the owner is
looking at on their phone right now is unchanged by this work.

**Outside CI.** These runs were made in the shared working tree; nothing was committed from a
mutated state, and the tree was left with only the two intended edits.
