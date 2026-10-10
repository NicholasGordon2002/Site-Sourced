# The service card's two shapes — how a demo author picks one

**Read this before touching a service card.** The card's shape is not a design decision a demo
author makes at the time: it is **passed in**, from one switch, and rendered. Inferring it from
the markup — or hand-editing a page into the shape you want — is the one thing that must not
happen, because every check in this repository reads the shape the *build says it rendered*.

Source of truth: `src/demo/service-card-action.ts` (the switch, both shape markups, the nested
shape's own CSS) and `cardShape` in `src/demo/family-render.ts` (`serviceCardProblems`).
Shape diagram and the switch's origin: `src/demo/render.ts`, `servicesBlock`.
Every claim here is asserted in `test/service-card-action.test.ts` and
`test/family-render.test.ts`, and each assertion is shown to be able to fail in
`docs/nested-cta-doctor-proofs.md`.

## The switch

| | |
|---|---|
| **variable** | `DEMO_SERVICE_CARD_ACTION_BAR` |
| **unset (the default, and every published build)** | the published card of 7 Oct 2026: one `<a class="card service-tile">` covering the whole card, its action line inside it. No variant class on any page, no variant block in `styles.css`. |
| **`1` · `true` · `on` · `yes` · `bar` · `whole-card`** | **whole-card** — the 9 Oct action bar at the card's foot |
| **`nested` · `nested-cta` · `cta`** | **nested-cta** — each card its own CTA button at its foot (10 Oct direction) |
| **anything else truthy** | **refused**, not guessed: the build records the value in `card_variant.basis` and reports it. A switch this build cannot read must never render one shape while a reviewer asked for the other. |
| **scope** | the `maple-avenue-barber-shop` slug only. Any other record, and **every** delivered build (`delivery.mode === "business"`), refuses it and says so. |
| **which pages** | `whole-card`: `services.html` alone (it was reviewed as one page). `nested-cta`: **every page of the bundle that renders a service card**, the home page included. |

The variable carries **no content** — it is a switch, not configuration. It names no address, no
label and no page, so nothing about the variant lives outside this repository, and it is unset in
the repository itself.

## Shape 1 — `whole-card` (Treatment 1, owner direction 9 Oct 2026)

```html
<li>
  <a class="card service-tile service-tile--bar" href="contact-hot-shave.html#form">
    <div class="service-tile-body"><h2>Hot shave</h2><p>Straight razor and hot towels…</p></div>
    <div class="service-action-bar"><p class="service-action">Request Hot shave</p><span class="service-action-chevron" aria-hidden="true">&nbsp;›</span></div>
  </a>
</li>
```

- **The card is still ONE link.** The bar is a styled `<div>`, not a control: one target, one tab
  stop, and the 6 Oct ruling ("no nested interactive elements") is untouched.
- The chevron is a **text** glyph after a non-breaking space (the grammar `BOOKING_ARROW` uses) —
  no icon file, no sprite, no request, survives the stylesheet not loading.
- `overflow: hidden` on the card clips the bar to the card's radius. That is why the nested shape
  must **not** inherit it (see below).
- The bar's own `min-height` is 44px and the card keeps its own 44px floor **and** its own 2px
  focus ring, both read off the shipped `styles.css`.
- Guarantee: the published card's markup and behaviour, with a visible action row added. Cheapest
  change, and the least risk to the signed-off copy.

## Shape 2 — `nested-cta` (owner direction 10 Oct 2026)

```html
<li>
  <div class="card service-tile service-tile--cta">
    <div class="service-tile-body"><h2>Hot shave</h2><p>Straight razor and hot towels…</p></div>
    <a class="service-cta" href="contact-hot-shave.html#form">Request Hot shave</a>
  </div>
</li>
```

- **The card is a container, not a link.** Its body — the record's name and note — is inert text;
  its **one** control is the anchor at its foot, drawn as the site's **ink ghost**: transparent,
  `var(--ink)` words and a `1px var(--ink)` outline that steps to a 2px line on hover and active
  without changing the box, 44px floor, `--r-md`, the same 2px `--accent` focus ring.
  *(Corrected 10 Oct 2026: this read "drawn as the site's own primary button (`--ink` on `#fff`,
  44px, `--r-md`, 2px `--accent` focus ring)" — an ink-filled button with white words. The owner's
  second direction of the same day is the transparent treatment with black words and a black
  outline, and the code followed it the same day: `SERVICE_CARD_ACTION_NESTED_CSS` in
  `src/demo/service-card-action.ts` declares `background: transparent`, `color: var(--ink)`,
  `border: 1px solid var(--ink)`, hover/active `box-shadow: inset 0 0 0 1px var(--ink)`. The colours
  are no longer written in that file at all — they are `GHOST_PAPER_INK`,
  `GHOST_PAPER_FILL_HOVER` and `GHOST_PAPER_FILL_ACTIVE` from `src/demo/ghost-controls.ts`, so the
  button and the paper header's action cannot drift apart.)*
- The CTA is an **`<a>`, never a `<button>`**: a button cannot navigate with JavaScript off, and
  every page here works with the scripts off.
- The label is the family's own composed one (`Request <service>` / `Ask about <service>`) and the
  destination is the derived `contact-<service-slug>.html#form`, exactly as in the whole-card
  shape. Neither shape adds a price, a duration, a booking promise or an urgency word.
- **The cost, stated plainly: the card body becomes inert.** A thumb that lands on the name or the
  note lands on nothing, and the card stops responding to hover or focus as a surface (its hover
  rule resets `border-color` and the resting shadow, because a card that cannot be pressed must
  not look pressable). What a visitor can act on is the button and only the button.
- `overflow: hidden` is **deliberately absent** on the variant card: the focus ring is drawn 2px
  outside the button's box, and a card that clips its overflow clips the ring. This is a clause in
  the build, not a comment — `nestedCtaActionProblems` clause 5 refuses a rule that reintroduces it.
- Two consequences worth knowing before choosing it: the visible action on each card is a **second
  boxed control** where the published card has an underlined text line — four boxes in one list of
  four — and the home page's cards change too, not just `services.html`. *(Corrected 10 Oct 2026:
  this read "the visible action on each card is a filled button (heavier than the current underlined
  line, and four of them in one list is a wall of buttons)". The weight is still the honest warning,
  but the fill is gone: the CTA is the outlined ink ghost above
  (`SERVICE_CARD_ACTION_NESTED_CSS`, `src/demo/service-card-action.ts`).)*

## What a future demo author must not do

**Do not infer the shape, and do not hand-edit it.** The shape is a **parameter**
(`ServiceCardShape`, `src/demo/family-render.ts`) that `build.ts` derives from the switch and hands
to the renderer *and* to every check. `render.ts` `servicesBlock` takes it as an argument (`null` =
the published card); `serviceCardProblems` reads it as `cardShape`; `nestedCtaActionProblems` runs
instead of `wholeCardActionProblems`, never beside it.

So: a card you type into a page by hand is a card no check has read, and a check that sniffed the
shape off the markup would accept a card whose renderer changed under it. If you want the nested
shape on another demo, the change is the decision's scope in `service-card-action.ts` — not the
markup.

## Where each piece lives

| piece | file |
|---|---|
| the switch, both card markups, both CSS blocks, both clause sets | `src/demo/service-card-action.ts` |
| the colours the nested CTA's ghost is drawn in (words, outline, the two washes) | `src/demo/ghost-controls.ts` — `GHOST_PAPER_INK`, `GHOST_PAPER_FILL_HOVER`, `GHOST_PAPER_FILL_ACTIVE` |
| the shape type and the 6 Oct card check that reads it | `src/demo/family-render.ts` |
| the renderer that takes the shape as an argument | `src/demo/render.ts` (`servicesBlock`, `cardShapeFor`, `renderCss`) |
| the build's decision, wiring and the manifest's `card_variant` record | `src/demo/build.ts` |
| the tests, and the proof each assertion can fail | `test/service-card-action.test.ts`, `test/family-render.test.ts`, `docs/nested-cta-doctor-proofs.md` |
| what the switch does and does not change, measured | `docs/nested-cta-scope-diff.md` |

**Status, and what it is not.** Both shapes are **template options behind a switch**, off in every
published build, and the nested shape is a **review treatment for one demonstration** — deliberately
outside the 6 Oct whole-card ruling, which stays in force for every other build. Neither shape is
part of the frozen template, and neither is a sign-off.
