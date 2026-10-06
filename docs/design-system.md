# Site Sourced — design system v1

**Status:** working document, written by the designer. Applied to the home page shell and the
hero (session S1). The four-page build, the icon set, the schematic map, the patterns and the
remaining category variants are S2/S3. This document is the source of truth for those sessions:
if the code and this file disagree, one of them is a bug.

**The standard, in one line:** on a phone, a barber would hold this up to a customer without
apologising for it.

Every demo is judged by the same test, so the system is deliberately narrow: one type pairing,
one accent per business, one layout rhythm, and no decoration that a visitor would have to
explain. A small business owner is usually seeing our work for the first time on a phone, next
to a link we emailed them cold. The page has one job — to look like something they would be
proud to show — and a second, non-negotiable job — to tell the truth about what it is.

---

## 1. Art direction

Warm editorial, not corporate template. A single display serif carries the personality on a
plain, quiet page: generous white space, a warm off-white secondary surface, hairline rules,
and one saturated accent used only as a small mark. Buttons are ink (near-black), not accent
colour, so the accent stays a detail rather than a theme.

What that buys us: a page that looks hand-set for one business rather than generated in bulk,
without needing photography we cannot legally use. A barber shop, a dentist and a landscaper
get the same bones and clearly different characters.

Three rules that follow from it:

1. **The photo is support, not the design.** The layout must still hold together with the
   CSS-and-SVG fallback a bundle uses when no image is clean enough to use.
2. **No trend that will date the page in a year.** No glassmorphism, no gradient meshes, no
   parallax, no scroll-jacking. The page has to still look current when nobody is maintaining it.
3. **Quiet, then one loud thing.** The hero and the primary action are loud. Everything else is
   quiet: 17px body text at a comfortable measure, muted secondary text, one accent mark.

---

## 2. Type

### Pairing

| Role | Face | File | Weight used |
| --- | --- | --- | --- |
| Display — headings, wordmark, figures | **Fraunces** | `fonts/fraunces-latin-600.woff2` (static, latin subset) | 600 only |
| Body — everything else | **Source Sans 3** | `fonts/source-sans-3-latin.woff2` (variable, latin subset) | 400, 600, 700 |

**This replaces the original v1 proposal of Inter + Source Serif.** Inter is a fine UI face but
reads as software, and Source Serif is too even and too dense to carry a shop's name at 40px on
a phone. Fraunces is a soft-serif display face with real warmth at large sizes and stays legible
at small ones; Source Sans 3 is a neutral, high-legibility humanist sans with a tall x-height —
exactly what a 17px paragraph and a form label need on a 360px screen. The pairing is also cheap:
the variable font gives us every weight from one 28 KB file.

- Fraunces: SIL Open Font License 1.1 · https://github.com/undercasetype/Fraunces
- Source Sans 3: SIL Open Font License 1.1 · https://github.com/adobe-fonts/source-sans
- Licence text ships with the fonts: `src/demo/assets/fonts/OFL.txt`, copied into every bundle
  as `fonts/OFL.txt`. The OFL permits embedding and redistribution with a website provided the
  copyright notice and licence travel with the file, which is exactly what the bundle does.

### Loading

```css
@font-face {
  font-family: "Fraunces";
  src: url("fonts/fraunces-latin-600.woff2") format("woff2");
  font-weight: 600; font-style: normal; font-display: swap;
}
@font-face {
  font-family: "Source Sans 3";
  src: url("fonts/source-sans-3-latin.woff2") format("woff2");
  font-weight: 200 900; font-style: normal; font-display: swap;
}
```

Both files are **inside the bundle**, referenced by a relative path. No Google Fonts, no CDN, no
`@import`, no preconnect to anybody: the page makes zero network requests while loading. Fallback
stack if a font ever fails to load is `system-ui, -apple-system, "Segoe UI", Roboto, Arial,
sans-serif` for both, so the layout is never waiting on a font to be readable.

### Scale

Mobile-first; sizes that grow use `clamp()`, so there is no layout jump between breakpoints.

| Token | Size | Face / weight | Line height | Used for |
| --- | --- | --- | --- | --- |
| `--fs-display` | `clamp(2.1rem, 8.5vw, 3.4rem)` | Fraunces 600 | 1.05 | Hero `h1` only |
| `--fs-h2` | `clamp(1.5rem, 5vw, 2.05rem)` | Fraunces 600 | 1.15 | Section headings |
| `--fs-h3` | `1.2rem` | Fraunces 600 | 1.25 | Service names, sub-headings |
| `--fs-lead` | `clamp(1.0625rem, 2.4vw, 1.1875rem)` | Source Sans 400 | 1.5 | Hero line, section intros |
| `--fs-body` | `1.0625rem` (17px) | Source Sans 400 | 1.6 | Paragraphs, form values |
| `--fs-small` | `0.875rem` | Source Sans 400 | 1.5 | Footer small print, captions |
| `--fs-label` | `0.75rem`, `letter-spacing: .1em`, uppercase | Source Sans 600 | 1.4 | Eyebrows, table headers |

Rules: display face for `h1`–`h3` and the wordmark, body face for everything else — including
buttons and labels, which is what makes the buttons look like a considered choice rather than a
default. Body text is never below 15px anywhere. Paragraph measure is capped at `34em`; a
paragraph wider than that is a defect, not a preference. Text is not justified, and hyphenation
is off.

---

## 3. Colour

One accent per business, chosen by category. Everything else is ink, paper and warm grey.

### Base tokens

| Token | Value | Notes |
| --- | --- | --- |
| `--ink` | `#16181B` | Headings, buttons, footer surface |
| `--body` | `#3D444C` | Paragraph text |
| `--muted` | `#5E6672` | Secondary text, captions, meta |
| `--paper` | `#FFFFFF` | Page |
| `--paper-2` | `#FAF7F2` | Warm secondary surface (alternating sections) |
| `--line` | `#E6E2DA` | Hairline rules and card borders (warm, never blue-grey) |
| `--footer-ink` | `#C3C9D1` | Small print on the ink footer |

### Accent tokens (per category)

Four values per category, so the accent is a small system rather than one hex used everywhere:

- `--accent` — the mark: rules, the eyebrow tick, list bullets, links.
- `--accent-ink` — accent as text on a light background (hover, links in body copy), dark enough
  for AA at 15px.
- `--accent-soft` — accent as a wash behind notices, service cards, the contact fallback.
- `--on-accent` — text on a filled accent surface; `#fff` for every colour in the table.

| Category | Name | `--accent` | `--accent-ink` | `--accent-soft` |
| --- | --- | --- | --- | --- |
| salon (barber, hair, nails, spa, tattoo) | Oxblood | `#9E2B23` | `#7A1F19` | `#FBEDEA` |
| landscaping | Grass | `#4C7A23` | `#35561A` | `#EEF5E4` |
| dental | Cyan | `#1B7A94` | `#125B70` | `#E7F3F6` |
| trades | Ochre | `#A06410` | `#6F4508` | `#FBF1DF` |
| food | Plum | `#7B2D4E` | `#591E38` | `#F9ECF1` |
| retail | Violet | `#5346A0` | `#3A3072` | `#EFEDFA` |
| fitness | Cobalt | `#1B5FA8` | `#12417A` | `#E9F0FA` |
| health | Sea | `#2A6B6B` | `#1C4A4A` | `#E8F2F2` |
| professional | Slate | `#3A4763` | `#28324A` | `#ECEFF4` |
| general (fallback) | Graphite | `#3D4A63` | `#2A3346` | `#EDEFF3` |

These replace the earlier muddy set (`#8c4a2f`, `#2f6b3a`, …), which were dark enough to look
dirty and too low in chroma to read as a choice. Each hue above is either separated from its
neighbours by 20°+ on the wheel or by a clear lightness/saturation step, and every one carries
white text at 4.5:1 or better, so the same tokens work for a filled button, a notice wash and
a link without re-tuning per category.

**The whole table is wired into the code** — the ten `PROFILES` entries in
`src/demo/copy.ts` carry these values, and the stylesheet reads them as tokens. What S3
adds is the per-category *variant* work (patterns, imagery treatment, heading wording),
not the palette.

### Contrast (measured, sRGB, WCAG 2.1)

| Pair | Ratio | Needs |
| --- | --- | --- |
| `--ink` on `--paper` | 17.8:1 | AA/AAA |
| `--body` on `--paper` | 9.9:1 | AA/AAA |
| `--muted` on `--paper` | 5.8:1 | AA |
| `--muted` on `--paper-2` | 5.4:1 | AA |
| salon accent on `--paper` | 7.4:1 | AA/AAA |
| salon `--accent-ink` on `--accent-soft` | 9.0:1 | AA/AAA |
| white on `--ink` | 17.8:1 | AA/AAA |
| `--footer-ink` on `--ink` | 10.7:1 | AA/AAA |
| white on the hero scrim (lightest part) | 11.4:1 | AA/AAA |
| `--line` on `--paper` | 1.3:1 | decorative only — never carries meaning |

Every pairing a visitor reads or clicks meets 4.5:1. White-on-photo text is protected by a scrim,
not left to the photograph's mercy (see §6, hero).

---

## 4. Space, shape, layout

### Spacing scale

A 4px base, named by what it is for. Nothing in the template uses an arbitrary value.

| Token | Value | Use |
| --- | --- | --- |
| `--s-1` | `0.25rem` | Icon-to-label gaps |
| `--s-2` | `0.5rem` | Inside a label, between lines of a list |
| `--s-3` | `0.75rem` | Between form fields, card padding (mobile) |
| `--s-4` | `1rem` | Paragraph spacing, default gap |
| `--s-5` | `1.5rem` | Between blocks inside a section |
| `--s-6` | `2rem` | Heading to content |
| `--s-7` | `3rem` | Section padding (mobile) |
| `--s-8` | `4rem` | Section padding (desktop, via `--section-y`) |
| `--s-9` | `6rem` | Hero breathing room (desktop) |

`--section-y: clamp(3rem, 8vw, 5rem)` is the one knob for vertical rhythm; sections use it
top and bottom, so the page never develops a lumpy middle. Sections never stack two full-height
padding blocks without content between them.

### Shape and depth

| Token | Value | Use |
| --- | --- | --- |
| `--r-sm` | `8px` | Inputs, small tags |
| `--r-md` | `12px` | Buttons, notice boxes |
| `--r-lg` | `18px` | Cards, figures, images |
| `--rule` | `1px solid var(--line)` | The only border in the template |

One soft shadow exists (`0 1px 2px rgba(16,18,20,.05), 0 8px 24px -16px rgba(16,18,20,.25)`) and
is used only where an element floats over something — the hero CTA row, the mobile form card, and
the phone menu panel. Depth is not used for decoration.

### Layout

- Container: `--wrap: 68rem`, gutters `1.25rem` mobile / `2rem` desktop
  (`width: min(var(--wrap), 100% - var(--gutter) * 2)`).
- Single column below `48rem`. Above it: a two-column split (`.two-col`, `1.05fr .95fr`) for
  hours/address and for any text-plus-image block, collapsing to one column below `48rem`.
- Services are a one-column list of cards on a phone and a two-column grid at `48rem` and up,
  where `grid-auto-rows: 1fr` levels the rows so a card with a note and one without end at the
  same height. On a phone unequal heights are honest: nothing is written to fill the gap.
- The hero is sized by `min-height: min(78svh, 34rem)` (`22rem` as the fallback line for a
  browser without `svh`), so it fills the first screen on a phone and is capped on a tall
  desktop monitor; cards size to content. There are exactly two breakpoints, `48rem` and
  `64rem`; a third would mean the layout was fighting the content.
- The home page's header is surface-less (`background: transparent; border-bottom: 0`) and the
  photograph starts directly under it, so the home page reads as one surface. Inner pages keep
  the header's own surface and hairline, which is what gives `.page-head` a top edge. The page
  id is carried on `<html class="page page--{id}">`.
- Tap targets are at least 44×44px. The call button in the header and the submit button in the
  form are the two that matter most and both are taller than that.

---

## 5. Components

The vocabulary a page is assembled from. Each is a named class in `renderCss()`, styled from
tokens only.

| Component | Class | What it is |
| --- | --- | --- |
| Skip link | `.skip-link` | First focusable thing; appears on focus only |
| Proposal banner | `.proposal-banner` | **Compliance. Frozen wording.** Ink strip above everything, accent hairline beneath, in normal flow, never sticky, never dismissible |
| Header | `.site-header` | Wordmark left, call button right, five-link nav. On a phone a 44×44px hamburger summary opens the nav as a left-side panel (owner revision, 6 Oct — it was a labelled `Pages` pill); the home page's header is surface-less (`.page--index`) so the photograph starts directly under it |
| Wordmark | `.wordmark` | Business name in Fraunces 600. The header prints the name once, here |
| Call button | `.call-button` | Ink pill with the published phone number, `tel:` link. If no phone is recorded, a muted, non-interactive note instead — never a dead `tel:` link |
| Eyebrow | `.eyebrow` | Uppercase label line: category and city, with an accent tick (see §6) |
| Hero | `.hero`, `.hero-img`, `.hero-scrim`, `.hero-inner` | Full-bleed photograph with a scrim and the headline block |
| Caption | `.hero-caption` | **Compliance. Frozen wording.** The AI-illustration label, in normal flow under the hero. Always `.wrap .muted .hero-caption` — the build-enforced class string |
| Section | `.section`, `.section--alt` | Vertical rhythm; `--alt` swaps to `--paper-2` and adds hairline rules |
| Section head | `.section h2` | Fraunces h2 with a 36×3px accent rule above it |
| Card | `.card` | White, `--rule`, `--r-lg`, used for services and for the hours table |
| Services list | `.services` | List of `.card`s: service name (h3) + one line of detail |
| Hours table | `.hours`, `.hours-row` | Definition list, one row per rule, hairline separators, `max-width: 30rem` |
| Buttons | `.button` (ink), `.button--paper` (white on a photo), `.button--ghost` (outline on a photo), `.button--small` | Only three roles: do this, do this on a dark surface, a quieter second option |
| Quiet link | `.link-quiet` | Muted, underlined on hover, for secondary actions ("See it on OpenStreetMap") |
| Notice | `.form-notice` | `--accent-soft` wash, 4px accent bar on the left, `--r-md`. Used for the form-delivery notice and nothing else |
| Form | `.contact-form`, `.field`, `.hp` | Visible labels above inputs, 44px minimum height, `--r-sm`, focus ring in accent. Honeypot stays visually hidden and `aria-hidden` |
| Status line | `.form-status` | `role="status"`, live region, only ever shows what `site.js` puts there |
| Contact fallback | `.contact-fallback` | Printed phone and email next to the form, with the caveat |
| Footer | `.site-footer` | Ink surface, two columns from `48rem`: identity + contact + disclaimer left; small print right |
| Micro print | `.footer-small` | `--fs-small` (0.875rem) at `--footer-ink`. Never below 14px — this is the legal text and it must be readable, not merely present |
| Centred notice | `.proposal-banner p`, `.disclaimer`, `.hero-caption` | The three **standalone** compliance lines: `text-align: center` and `margin-inline: auto`, at both widths. Nothing decorative replaces the disclaimer's old left accent bar. The caveat and the form-delivery notice sit beside a control and stay left-aligned — the basis is placement, not length |

### The family layer's own components (built 4 Oct; `src/demo/family-render.ts` + `src/demo/render.ts`)

The form and the two family blocks use five components beyond the original list. Each is
built from the existing tokens above — **no new token, no new font, no new request** — and
each works with JavaScript off:

| Component | Classes | What it is for |
| --- | --- | --- |
| A group of fields | `.field-group`, `.field-group--second`, `.field-group-legend` | The form is two field sets ("Your details", then the request). The legend is the small-caps label; the second group carries the top rule that separates the visitor from the request. |
| A menu | `.field select` | The service/type-of-job/how-soon questions use the **native** picker: it is better on a phone than anything we would draw, it needs no script, and it is one rule on top of `.field input`. |
| Choice chips | `.choice-group`, `.choice-wrap`, `.chip`, `.chip-text`, `.choice-group--days` | One component for checkbox and radio answers. The input is visually hidden but focusable, so the group posts with JavaScript off, works by keyboard, and needs no `:has()` — the checked state is drawn from the sibling `<span>`. The days group alone becomes a grid of equal chips (52×44), because it is a date-picker strip rather than a form. |
| The action and its qualifier | `.form-actions`, `.form-note` | The submit button is the family's own call to action (below), and the sentence under it is the qualifier the button needs: on an appointment page "this is a request, not a confirmed booking", on a demonstration page "nothing here reaches {business}". |
| A process list and the extras card | `.steps`, `.step-num`, `.step-text`; `.extras`, `.extras-item` | Family B's three lines, and the record's own facts. Both use the same metric rhythm as `.hours-row` (padding `--s-3 --s-4`, one rule between rows), so the page has one list language rather than three. |
| The service-card action | `.service-action`, `.link-quiet--inline` | `Request this` / `Ask about this` on each service card — a quiet link, never a second button, and never a price. It carries the recorded service in `?service=`, which the form's own select matches. |

**Two notices, one selector.** `.notice` is now the base selector and `.form-notice` sits
beside it (`copy.ts`/`render.ts`): the **delivery notice keeps `.form-notice` exactly as it
was**, byte for byte, because that is the element the existing assertions and the privacy
tests measure, and the base selector exists so a second notice elsewhere can share the
style without sharing that name. Do not rename one to the other.

### Icons and graphics

No icon font, no sprite from a third party. Any icon is inline SVG with `stroke="currentColor"`
and `aria-hidden="true"`, drawn on a 24px grid with 1.75px strokes. S1 uses **no icons at all**
except the favicon, which is generated from the business's initials on the category accent —
no logo, and nothing that could be mistaken for the business's own mark. The icon set is S2's.

---

## 6. The home page

Order matters; this is the order a phone user meets it.

1. **Proposal banner** (frozen wording).
2. **Header** — business name, call button. One name, once.
3. **Hero** — full-bleed photograph, dark scrim, and three lines:
   - eyebrow: `Barber shop · Hamilton, ON` — the category and city, which is what a visitor
     wants to know first and what the header used to say badly;
   - `h1`: the business's name, and the only place it appears at display size;
   - lead: the recorded services as a single line (`Haircut · Beard trim · Hot shave · Kids' cut`),
     or, if none are recorded, a plain line saying the page lists the details published for the
     business. Never a sentence that restates the name.
   - actions: `Call …` (paper button) and the page's **primary contact label** (ghost button) —
     `Contact Us` on our own fictional fixture, the conversion family's own label
     (`Request an appointment` / `Ask for a quote` / `Send a message`) on a build from a real
     business's record. See "The primary contact action", below.
   - Hero copy is assembled in `composeCopy()`, from the record only. The words "On this page:"
     and the "X is a Y in Z" restatement are gone: the identity sentence lives once, in About.
4. **About** — three short paragraphs from the record, plus the about photograph when there is one.
5. **Services** (`--alt`) — what is recorded, in cards. When nothing is recorded it says so.
6. **Hours and address** (`two-col`) — the hours table, the address, directions.
7. **Contact** — the delivery notice (frozen, derived from the record), the form, then the printed
   phone and email with the published-listings caveat.
8. **Footer** — name, address, phone, email, the not-affiliated line next to the name, the caveat,
   the OpenStreetMap attribution, the noindex note, the take-down line.

### The hero image

A real `<img>`, not a CSS background, because that is what makes responsive sizes, a real
`aspect-ratio` and a priority hint possible:

```html
<img class="hero-img" src="images/barber-hero.jpg"
     srcset="images/hero-600.jpg 600w, images/hero-900.jpg 900w,
             images/hero-1200.jpg 1200w, images/hero-1600.jpg 1600w"
     sizes="100vw" width="1536" height="1024" alt=""
     fetchpriority="high" decoding="async">
```

- `width`/`height` are the real pixel dimensions of the file, always. They are what stops the
  page jumping as it loads, so a guessed number is worse than none — the generator reads them
  from the file header rather than a placeholder default.
- `fetchpriority="high"`, and **no** `loading="lazy"` — the hero is the first thing on screen.
- `sizes="100vw"`: the hero is full-bleed at every breakpoint.
- `alt=""` — the image is decoration on a proposal page, and the headline over it carries the
  meaning. The about photograph is `alt=""` for the same reason.
- The **AI-illustration caption** sits under the hero in normal flow, in the frozen wording from
  `illustrationLabel()`. It is never conditional on hover, never `aria-hidden`, never styled
  below 14px, and `build.ts` fails a bundle whose manifest records an AI-generated image without
  it.
- Until responsive variants exist the markup falls back to a single candidate and the browser
  downloads the one file; see §8.

### Voice on the page

The demo never speaks as the business. Every sentence is either data from the record ("Hours as
recorded publicly"), or a sentence that is plainly ours ("This is a demonstration site: the form
below sends your message to Site Sourced"). No "we", no "our team", no claim we cannot source.
Anything that reads as the business's own words is a defect.

### The primary contact action, and the two families

Every page carries one loud thing: the link to the contact page, labelled with the page's
**primary contact label**, and the notice under the form that names who receives the message.
Both are derived, never typed into a page (`src/demo/family.ts`; `composeCopy()` in `copy.ts`):

| The build is for | Label | Why |
| --- | --- | --- |
| Our own fictional fixture (`source_kind: "fictional"`) | `Contact Us` | The owner's decision of 4 October (WORKFLOW.md rule 8): our invented business is a sales piece about Site Sourced, not about a particular business. Its form submit button stays the plain `Send message` |
| A real business's record — a personalised demo, or a client's own site | `Request an appointment` (appointment) / `Ask for a quote` (inquiry, trades and landscaping) / `Send a message` (inquiry, everything else) | The family's own call to action: what the page actually asks for |

Which family a build is for is **derived from the record's category** (with the classification
table in `family.ts`, overridable by a `conversion_family` field on the record), and the rule
that fired is recorded in `manifest.json`. The honesty rule that goes with each family is a
build check, not a style guide: an **appointment** page may *request* a time and may never
*book* one — no "book", "available", "slot", "confirmed", "instant" or "same-day"; an
**inquiry** page may pass on a question and may never promise a price, a timeline, a visit or a
service area. A word is allowed only where the record itself carries it, where the record
carries a booking page, or where the sentence denies the claim ("This is a request, not a
confirmed booking."). The check is `familyHonestyProblems()`; its tests are in
`test/family.test.ts`.

No variant may print "Book Now" while the build has no booking page — a neutral label is not a
licence to claim a booking.

---

## 7. The five-page structure, ordered per family (S2)

One template, four pages, same header and footer on each. S1 builds the home page; S2 adds the
rest by reusing these sections rather than inventing new ones.

| Page | File | Carries |
| --- | --- | --- |
| Home | `index.html` | Hero, About (short), Services (top 4–6), Hours + address, contact CTA |
| Services | `services.html` | The full recorded list as cards, hours, contact CTA |
| About | `about.html` | The About paragraphs, the about photograph, hours + address, contact CTA |
| Contact | `contact.html` | The form, the delivery notice, printed phone/email with the caveat, directions, hours |

- Navigation lives in the header and nowhere else: **five** plain text links (the privacy notice
  included) on the wordmark's line from `48rem`, and on a phone behind a CSS-only `<details>`
  disclosure whose summary is a **hamburger** — three 18×2px lines, a 44×44px target, named by
  `aria-label` **and** a visually-hidden `Pages` so it is never icon-only to a screen reader —
  which opens the nav as a **left-side panel about a third of the viewport wide**, on the page's
  gutter, with a `min-content` floor and `nowrap` rows so no link wraps or clips. No
  JavaScript-driven nav, and the `<nav>` is the summary's **next sibling**, never its child: a nav
  inside a closed `<details>` cannot be revealed by CSS. The four page links the owner named are
  the phone menu; the privacy notice is reached from the footer's small print on every page (and
  from beside the form), which `privacyLinkProblems` enforces.
- The current page is marked with `aria-current="page"`: an accent underline in the desktop row,
  an accent wash on the phone's panel row.
- Each page repeats the banner, the footer disclaimer and the contact caveat in full. Compliance
  is per-page, never inherited.
- `noindex, nofollow` on every page, plus `rel="canonical"` to nothing — the demo never
  appears in search results.
- The contact page keeps the same form markup and the same delivery notice; the notice is derived
  per bundle, never copied by hand.

---

### The section order is data (`family-render.ts`)

Each page is a list of named blocks, and the list is per family — so the two families'
page shapes differ in one place today without a branch in the template, and any future
difference belongs in the same table:

| Page | Appointment (A) | Inquiry (B) |
| --- | --- | --- |
| `index.html` | hero, about (excerpt), services, hours, CTA | hero, about (excerpt), services, **how an inquiry works**, hours, CTA |
| `services.html` | page head, services, hours, CTA | same |
| `about.html` | page head, about, hours, extras, CTA | same |
| `contact.html` | page head, form, hours | same |
| `privacy.html` | page head, privacy notice | same |

The page count is **five**, not four: the privacy notice is a page of its own and every
bundle carries it. A block that renders nothing — the extras card on a record with no
extras, the steps on an appointment page — is dropped rather than left as an empty
section, and `familyRenderingProblems` fails the build if a page loses a block it should
have or renders its blocks in another order (a rule in prose would rot: `WORKFLOW.md` 6).

## 8. Weight budget

A demo is judged on a phone, often on mobile data, in a browser with a cold cache.

| Item | Budget | Today |
| --- | --- | --- |
| HTML | ≤ 20 KB | 10.2 KB |
| CSS | ≤ 16 KB | 12.3 KB |
| JS | ≤ 4 KB | 2.7 KB |
| Fonts (2 files) | ≤ 60 KB | 45.8 KB |
| Hero image, served at 360px | ≤ 120 KB | **2.62 MB — over budget** |
| About image | ≤ 200 KB | n/a on the current fixture |
| Everything else | ≤ 30 KB | 0.3 KB (favicon + manifest) |
| **Page at 360px, cold** | **≤ 400 KB** | **~2.7 MB, hero-dominated** |

Rules: no third-party requests at all on load (the form POST is the only network call the site
can ever make); images are re-encoded to at most 1600px on the long edge and served at the size
the screen needs; no image is fetched from a host at runtime.

**Known gap, and the reason the numbers above are honest:** the hero markup is written for the
multi-size case, but the generator does not emit variants yet, so it still points at one file.
Two things are needed, both engineering, in the next session:

1. Emit `hero-600/900/1200/1600.jpg` (or WebP) beside the source image and list them on the
   manifest image, so the `srcset` above becomes real and a phone downloads ~120 KB instead of
   2.6 MB.
2. **Re-encode the fixtures.** `test/fixtures/images/*.jpg` are PNGs named `.jpg`, 1536×1024, at
   2.2–3.6 MB each. The container, not the layout, is where the weight is.

---

## 9. Category variants

The bones are identical for every category; only these change. Which is what keeps the build one
template and the result one business's page.

| Changes per category | How |
| --- | --- |
| Accent set | The four accent tokens from §3 |
| Offering noun | `offeringPlural` in the category profile: `services`, `treatments`, `menu`, `classes and services`, `products and services` |
| Image search phrases | `imageQueries`, e.g. "barber shop interior" — generic and category-level only, never the business's own photo |
| Hero lead wording | Derived from the recorded services; no per-category copywriting beyond that |

| Never changes per category | Why |
| --- | --- |
| Layout, spacing, type scale | One template to maintain, debug and hand over |
| The compliance banner, footer line, caveat, illustration label, delivery notice | Build-enforced, and the same obligation for every prospect |
| Buttons, forms, hours table | Predictable, accessible, and identical for every visitor |
| No logo, no scraped photo, no copy from the business | The rule the whole product rests on |

A new category is a table row, not a design: pick an accent with white text at 4.5:1, an
offering noun, and three generic search phrases.

---

## 10. Accessibility

Held to WCAG 2.1 AA, and where the two disagree, the stricter one wins.

- **Contrast**: 4.5:1 for body and small text, 3:1 for large text, buttons and focus indicators.
  Measured pairs are in §3; any new colour is measured before it is added.
- **Focus**: `:focus-visible` only, `outline: 2px solid var(--accent)` with `2px` offset on light
  surfaces, `#fff` on the hero and footer. Never `outline: none` without a replacement.
- **Structure**: one `h1` per page; headings in order, no level skipped; `main`, `header`,
  `footer`, `nav`, `figure`/`figcaption`, `dl` for hours, `address` for the address.
- **Landmarks and skip link**: a skip link is the first focusable element on every page.
- **Forms**: every input has a visible `<label>` with a `for`; the honeypot is `aria-hidden` and
  labelled "leave this field empty"; the status message is a live region; nothing is required
  that a visitor cannot supply.
- **Images**: `alt=""` for the decorative photographs; the visible disclosure caption carries the
  meaning. A decorative image never gets a filename or a licence string as alt text.
- **Motion**: `prefers-reduced-motion: reduce` removes every transition and animation. Nothing is
  load-bearing for motion in the first place.
- **Zoom and text size**: layouts hold at 200% zoom and 320px width; no text is clipped, nothing
  scrolls horizontally, and `-webkit-text-size-adjust: 100%` is set so iOS does not inflate type.
- **Touch**: 44×44px minimum targets, and 8px of space between adjacent ones.

---

## 11. Frozen strings

These sentences are compliance, not copy. They are written in `copy.ts`, checked in `build.ts`,
covered by `bun test`, and may not be reworded by anyone doing layout work. Restyling is fine;
editing the wording is not, and `build.ts` refuses to publish a bundle that contradicts itself.

| String | Where it appears | Enforced by |
| --- | --- | --- |
| Proposal banner | Above the fold, above the header | Banner text must be in the HTML and before `<header>` |
| Footer disclaimer | In the footer, next to the business's name and contact details | Footer disclaimer must be present |
| Contact-details caveat | Printed with the phone number and email, twice | A page printing the details without the caveat fails |
| Illustration label | `<figcaption class="wrap muted hero-caption">` under the hero | A manifest recording an AI image with no page label fails |
| Form-delivery notice | `.notice`, next to the form | A notice claiming business delivery while the endpoint routes elsewhere fails |
| `noindex, nofollow` | `<head>` of every page | Missing or malformed robots meta fails the build |

`figcaption class="wrap muted hero-caption"` is asserted verbatim by a test, so the class string
is part of the interface: restyle those three classes in the stylesheet, do not rename them.

---

## 12. What is built, and what is not

**Built in S1 (this session):** the token block, the type scale, the colour table wired for all
ten categories, the spacing scale, the header, the footer, the hero rebuilt on a real `<img>`
(real dimensions measured from the file, the multi-size `srcset` shape, the frozen caption in
normal flow), and the copy hierarchy fix in `composeCopy()` — the eyebrow carries the category
and place, the name is printed once, and the hero line is the recorded offering. The two fonts
and their OFL text now ship inside every bundle.

**Not built yet, in the order it should happen:** responsive hero variants and the fixture
re-encoding (§8); the three remaining pages and the navigation (§7); the icon set and the
schematic map; the remaining category accents (§3); and the placeholder patterns for the
no-photograph fallback, which S1 leaves as the existing gradient treatment so that the fallback
still has somewhere to live.

## 13. Where the family layer's CSS lives (4 Oct)

The components in §5 are added to the same `styles.css` the template already emits — one
stylesheet, one request, no inlined critical path and no third-party origin. They add no
token (§3, §4 are unchanged), no font (§2) and no new file to the bundle; the measured
weight in §8 is unaffected (the fixtures build at 138–139 KB at 360px, against a 400 KB
target).
