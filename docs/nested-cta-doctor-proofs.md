# The nested-CTA card shape: every new assertion, doctored

**Why this file exists.** The 10 Oct nested-CTA card shape (`src/demo/service-card-action.ts`,
`cardShape: "nested-cta"`) was proven by six ad-hoc doctor-proofs run by hand against the CLI
and kept in a log outside CI
(`/home/team/shared/design/service-cards-nested-cta/DOCTOR-PROOFS.log`). A proof that lives in
a log is not a proof that stays true: nothing re-runs it. This file is the missing half — the
**suite** now asserts the shape, in `test/service-card-action.test.ts` and
`test/family-render.test.ts`, and below is the evidence that each new assertion **can fail**.

**The suite, before and after**

| | tests | result |
|---|---|---|
| `master` (`f01a985`, before this branch) | 299 | 299 pass / 0 fail |
| this branch (after the new tests) | 306 | 306 pass / 0 fail |

The seven new tests: six in `test/service-card-action.test.ts` (the switch's own subject) and one
in `test/family-render.test.ts` (where `serviceCardProblems` lives).

**Method.** Every doctor is the smallest edit to the renderer (`src/demo/render.ts`) or the
composer (`src/demo/service-card-action.ts`) that breaks the property an assertion asserts. The
doctored build is then run through the suite, and the file is restored with
`git checkout -- <file>` and checked **byte-exact** — `sha256` against `git show HEAD:<file>`,
plus an empty `git diff HEAD -- <file>`. A doctor whose suite stayed green would prove nothing
and is not listed; all nine below fail, and all nine restore clean.

**What each doctor proves** (the assertion group each new test covers):

1. one control, at the card's foot — doctors 1 and 2;
2. the card body is inert text and no control sits inside an anchor — doctor 5;
3. the bare `1`/`true` spellings still select `whole-card` and the whole-card link still
   refuses a nested control — doctors 6 and 9;
4. an unrecognised switch value is refused, never rendered as the published cards — doctor 7;
5. the CTA's own floor and ring, and the `overflow: hidden` clause that would clip the ring —
   doctors 3, 4 and 8 (doctors 3 and 4 cover the label and the destination the same test
   asserts).

**Outside CI.** These runs were made in the shared working tree; nothing was committed from a
doctored state. The counts above were taken with a clean tree.

---

### Doctor 1 — assertion group 1 — one control, at the card's foot

*Doctoring:* the CTA drawn above the card's body instead of at its foot · *file:* `src/demo/render.ts`

```diff
- `<div class="${SERVICE_CARD_ACTION_BODY_CLASS}">${head}</div>` +\n          serviceActionCtaMarkup(label, href) +
+ serviceActionCtaMarkup(label, href) +\n          `<div class="${SERVICE_CARD_ACTION_BODY_CLASS}">${head}</div>` +
```

`bun test test/service-card-action.test.ts test/family-render.test.ts` → exit 1; 34 pass, 4 fail

Failure, verbatim (the distinct expectation errors, clipped):

```
error: expect(received).toBe(expected)

Expected: "</div>"
error: expect(received).toEqual(expected)

- []
```

Failing tests:

```
(fail) the nested-CTA card is a container with exactly one control at its foot, labelled and pointing where the record says
(fail) in the nested shape the card's body is inert text and nothing interactive sits inside an anchor
(fail) the nested shape's control is 44px with a ring of its own, and no rule on the card clips it
(fail) the nested-CTA shape's clauses can fail too, and the shape is passed in rather than inferred
```

Restore: `git checkout -- src/demo/render.ts` · sha256 == HEAD's: **True** · `git diff HEAD` empty: **True**

### Doctor 2 — assertion group 1 — exactly one interactive element on the card

*Doctoring:* a second control on the card beside its CTA · *file:* `src/demo/render.ts`

```diff
- serviceActionCtaMarkup(label, href) +
+ serviceActionCtaMarkup(label, href) + `<button type="button">Book</button>` +
```

`bun test test/service-card-action.test.ts test/family-render.test.ts` → exit 1; 34 pass, 4 fail

Failure, verbatim (the distinct expectation errors, clipped):

```
error: expect(received).not.toMatch(expected)

Expected substring or pattern: not /<(button|input|select|textarea|details|summary|iframe|object|embed)\b/i
error: expect(received).toEqual(expected)

- []
```

Failing tests:

```
(fail) the nested-CTA card is a container with exactly one control at its foot, labelled and pointing where the record says
(fail) in the nested shape the card's body is inert text and nothing interactive sits inside an anchor
(fail) the nested shape's control is 44px with a ring of its own, and no rule on the card clips it
(fail) the nested-CTA shape's clauses can fail too, and the shape is passed in rather than inferred
```

Restore: `git checkout -- src/demo/render.ts` · sha256 == HEAD's: **True** · `git diff HEAD` empty: **True**

### Doctor 3 — assertion group 1 — the family's composed label

*Doctoring:* the CTA's words typed into the template instead of the family's composed label · *file:* `src/demo/service-card-action.ts`

```diff
- return `<a class="${SERVICE_CARD_ACTION_CTA_CLASS}" href="${escapedHref}">${escapedLabel}</a>`;
+ return `<a class="${SERVICE_CARD_ACTION_CTA_CLASS}" href="${escapedHref}">Book Now</a>`;
```

`bun test test/service-card-action.test.ts test/family-render.test.ts` → exit 1; 34 pass, 4 fail

Failure, verbatim (the distinct expectation errors, clipped):

```
error: expect(received).toEqual(expected)

  Set {
error: expect(received).toBe(expected)

Expected: "Request Haircut"
```

Failing tests:

```
(fail) the nested-CTA card is a container with exactly one control at its foot, labelled and pointing where the record says
(fail) in the nested shape the card's body is inert text and nothing interactive sits inside an anchor
(fail) the nested shape's control is 44px with a ring of its own, and no rule on the card clips it
(fail) the nested-CTA shape's clauses can fail too, and the shape is passed in rather than inferred
```

Restore: `git checkout -- src/demo/service-card-action.ts` · sha256 == HEAD's: **True** · `git diff HEAD` empty: **True**

### Doctor 4 — assertion group 1 — the derived contact-<service>.html#form destination

*Doctoring:* the CTA pointing somewhere other than the page built for that service · *file:* `src/demo/render.ts`

```diff
- serviceActionCtaMarkup(label, href) +
+ serviceActionCtaMarkup(label, "contact.html#form") +
```

`bun test test/service-card-action.test.ts test/family-render.test.ts` → exit 1; 34 pass, 4 fail

Failure, verbatim (the distinct expectation errors, clipped):

```
error: expect(received).toEqual(expected)

  Set {
```

Failing tests:

```
(fail) the nested-CTA card is a container with exactly one control at its foot, labelled and pointing where the record says
(fail) in the nested shape the card's body is inert text and nothing interactive sits inside an anchor
(fail) the nested shape's control is 44px with a ring of its own, and no rule on the card clips it
(fail) the nested-CTA shape's clauses can fail too, and the shape is passed in rather than inferred
```

Restore: `git checkout -- src/demo/render.ts` · sha256 == HEAD's: **True** · `git diff HEAD` empty: **True**

### Doctor 5 — assertion group 2 — the card body is not a link

*Doctoring:* the card drawn as one wrapping link with its CTA nested inside it · *file:* `src/demo/render.ts`

```diff
- `            <div class="card service-tile ${SERVICE_CARD_ACTION_NESTED_CARD_CLASS}">` +
+ `            <a class="card service-tile ${SERVICE_CARD_ACTION_NESTED_CARD_CLASS}" href="${href}">` +
```

`bun test test/service-card-action.test.ts test/family-render.test.ts` → exit 1; 33 pass, 5 fail

Failure, verbatim (the distinct expectation errors, clipped):

```
error: expect(received).toBe(expected)

Expected: true
error: expect(received).not.toMatch(expected)

Expected substring or pattern: not /[<>]/
error: expect(received).toContain(expected)

Expected to contain: "carries the CTA \"Book Now\""
```

Failing tests:

```
(fail) the nested-CTA card is a container with exactly one control at its foot, labelled and pointing where the record says
(fail) in the nested shape the card's body is inert text and nothing interactive sits inside an anchor
(fail) the nested shape covers every card this demonstration renders, or none of them
(fail) the nested shape's control is 44px with a ring of its own, and no rule on the card clips it
(fail) the nested-CTA shape's clauses can fail too, and the shape is passed in rather than inferred
```

Restore: `git checkout -- src/demo/render.ts` · sha256 == HEAD's: **True** · `git diff HEAD` empty: **True**

### Doctor 6 — assertion group 3 — the bare 1/true spellings still select whole-card

*Doctoring:* the bare 1/true spellings re-pointed at the nested shape · *file:* `src/demo/service-card-action.ts`

```diff
- "1": "whole-card",\n  "true": "whole-card",
+ "1": "nested-cta",\n  "true": "nested-cta",
```

`bun test test/service-card-action.test.ts test/family-render.test.ts` → exit 1; 30 pass, 8 fail

Failure, verbatim (the distinct expectation errors, clipped):

```
error: expect(received).toContain(expected)

Expected to contain: "<a class=\"card service-tile service-tile--bar\" href=\"contact-haircut.html#form\">"
error: expect(received).toEqual(expected)

- []
error: expect(received).toBe(expected)

Expected: "whole-card"
```

Failing tests:

```
(fail) with the opt-in on the card carries the bar, the derived label and the text glyph
(fail) a page that carries the variant without the opt-in is refused, and so is a second page
(fail) a service the page stops rendering a bar card for is refused
(fail) a bar that is not the card's foot, or holds anything but the label and the glyph, is refused
(fail) words the family did not compose are refused, on a bar that is otherwise the right shape
(fail) a bar the stylesheet does not size, or that loses its hairline, is refused
(fail) the card the variant renders is still one link with nothing interactive nested in it
(fail) the bare 1 and true still select the whole-card bar, and the bar's link still refuses a nested control
```

Restore: `git checkout -- src/demo/service-card-action.ts` · sha256 == HEAD's: **True** · `git diff HEAD` empty: **True**

### Doctor 7 — assertion group 4 — an unreadable switch value is refused, never guessed

*Doctoring:* a switch value naming no shape silently rendering the published cards · *file:* `src/demo/service-card-action.ts`

```diff
- if (!shape) {
+ if (false as boolean) {
```

`bun test test/service-card-action.test.ts test/family-render.test.ts` → exit 1; 37 pass, 1 fail

Failure, verbatim (the distinct expectation errors, clipped):

```
error: expect(received).toBe(expected)

Expected: false
```

Failing tests:

```
(fail) a switch value that names no shape is refused, never rendered as the published cards
```

Restore: `git checkout -- src/demo/service-card-action.ts` · sha256 == HEAD's: **True** · `git diff HEAD` empty: **True**

### Doctor 8 — assertion group 5 — the overflow: hidden clause that would clip the focus ring

*Doctoring:* the variant card declaring overflow: hidden · *file:* `src/demo/service-card-action.ts`

```diff
- .services .service-tile--cta { padding: 0; }
+ .services .service-tile--cta { padding: 0; overflow: hidden; }
```

`bun test test/service-card-action.test.ts test/family-render.test.ts` → exit 1; 36 pass, 2 fail

Failure, verbatim (the distinct expectation errors, clipped):

```
error: expect(received).toEqual(expected)

- []
error: expect(received).not.toMatch(expected)

Expected substring or pattern: not /\.service-tile--cta\b[^{}]*\{[^}]*overflow\s*:\s*hidden/i
```

Failing tests:

```
(fail) the nested-CTA card is a container with exactly one control at its foot, labelled and pointing where the record says
(fail) the nested shape's control is 44px with a ring of its own, and no rule on the card clips it
```

Restore: `git checkout -- src/demo/service-card-action.ts` · sha256 == HEAD's: **True** · `git diff HEAD` empty: **True**

### Doctor 9 — assertion group 3 — whole-card still refuses a control nested in its link

*Doctoring:* a whole-card bar whose link carries a <button> · *file:* `src/demo/render.ts`

```diff
- serviceActionBarMarkup(label) +
+ serviceActionBarMarkup(label) + `<button type="button">Book</button>` +
```

`bun test test/service-card-action.test.ts test/family-render.test.ts` → exit 1; 33 pass, 5 fail

Failure, verbatim (the distinct expectation errors, clipped):

```
error: expect(received).toContain(expected)

Expected to contain: "<span class=\"service-action-chevron\" aria-hidden=\"true\">&nbsp;›</span></div></a>"
error: expect(received).not.toMatch(expected)

Expected substring or pattern: not /<(button|input|select|textarea|details|summary|iframe|object|embed)\b/i
```

Failing tests:

```
(fail) with the opt-in on the card carries the bar, the derived label and the text glyph
(fail) a bar that is not the card's foot, or holds anything but the label and the glyph, is refused
(fail) words the family did not compose are refused, on a bar that is otherwise the right shape
(fail) the card the variant renders is still one link with nothing interactive nested in it
(fail) the bare 1 and true still select the whole-card bar, and the bar's link still refuses a nested control
```

Restore: `git checkout -- src/demo/render.ts` · sha256 == HEAD's: **True** · `git diff HEAD` empty: **True**
