/**
 * Site Sourced — the **review-only booking comparison page**, and the exception it needs.
 *
 * ## What this page is, and who asked for it
 *
 * The owner asked, by text on 8 Oct 2026, for one extra page on the Maple Avenue Barber
 * Shop demonstration only: three ways to reach the same Google booking page — a plain
 * link, Google's scheduling button, and the booking page shown inside a frame — so they
 * can judge the live flow on a phone. Their words, kept here because the exception below
 * exists only because of them and a later reader must be able to weigh it:
 *
 *   "create a review-only comparison on the Maple Avenue Barbershop appointment demo
 *    only; do not change Northshore, do not release a client/final site, and keep the
 *    existing approved demo otherwise unchanged. Use the owner's three supplied Google
 *    Calendar options so they can judge the live flow … Build them as clearly labelled,
 *    separable demo variants/sections with truthful disclosure that this is an
 *    experimental comparison and that the Google page is a demonstration booking page …
 *    measure/report load impact and verify phone behavior, keyboard/accessibility, layout,
 *    and failure behavior; do not silently retain third-party embed/script if it violates
 *    the comparison structure. Run the full gate and Maple fixture checks, commit/push
 *    resumable increments, publish a review-only build, and return the exact
 *    phone-openable review link plus a concise description of where each option appears
 *    and any limitations. No sign-off is implied by this request; wait for the owner's
 *    review."
 *
 * The page's approved wording, with the lead's rulings, is
 * `design/booking-comparison-copy.md`; the strings below are that document's, verbatim.
 * The page order it fixes is: furniture (unchanged, from `render.ts`) → h1 → disclosure →
 * order line → shared address → option 1 → option 2 → option 3 → limits → footer.
 *
 * ## Why this needed a carve-out at all
 *
 * The plan's rule for a booking link is "a plain anchor … never an embed, script or
 * iframe", and `template-system.md` §2.5 forbids a booking iframe outright. Options 2 and
 * 3 are therefore **knowingly refused on every other page of every bundle**, and this
 * module is the only place that asks for the exception. Three things keep it to one file:
 *
 *   1. the page is rendered **outside** `renderPages`, so it is not one of the nine, is
 *      not in the nav, and every existing check that walks `pages` — the self-containment
 *      check, the booking scoping rules, the phase furniture rules — still refuses a
 *      remote `script`, `iframe` or `embed` on any other page of the bundle;
 *   2. it is enabled only when `DEMO_BOOKING_COMPARISON_URL` is set, and only for the
 *      record this page is scoped to; with the variable unset the bundle is byte-identical
 *      to a build from `master`;
 *   3. `bookingComparisonProblems` refuses the page in the delivered phase, refuses it on
 *      every other record, and refuses it if any other page in the bundle has grown a
 *      remote script or frame.
 *
 * `DEMO_BOOKING_URL` is deliberately **not** used here: setting it would switch the whole
 * bundle's derived booking mode to `demo` and change the five contact pages signed off on
 * 7 Oct, which the owner's "keep the existing approved demo otherwise unchanged" rules out.
 *
 * The page is a review artifact. It is never linked from the nine pages, never delivered
 * to a client, and no sign-off is implied by its existence.
 */
import { BOOKING_ANCHOR_CLASS, BOOKING_ARROW } from "./booking.ts";
import { familyHonestyProblems } from "./family.ts";
import { bookingNoticeDemo, guardCopy } from "./copy.ts";
import { esc, renderComparisonHead, renderComparisonPage, type RenderContext } from "./render.ts";
import type { BusinessRecord } from "./types.ts";

/** The configuration key that opts this page in. No address is ever committed. */
export const BOOKING_COMPARISON_VAR = "DEMO_BOOKING_COMPARISON_URL";
/** The one file this page is. The carve-outs name it by name. */
export const BOOKING_COMPARISON_FILE = "booking-comparison.html";
/**
 * The demonstration this page is scoped to: the Maple Avenue Barber Shop appointment
 * demonstration, from the owner's own words ("the Maple Avenue Barbershop appointment
 * demo only"). Any other record refuses the page, and says why.
 */
export const BOOKING_COMPARISON_SLUG = "maple-avenue-barber-shop";
/** The page's h1, which is also its `<title>`. */
export const BOOKING_COMPARISON_TITLE = "Three ways to reach the same booking page";
/**
 * The source of the exception, cited wherever the carve-out lives so a reader can check
 * it rather than take our word for it.
 */
export const BOOKING_COMPARISON_BASIS =
  "owner's own instruction of 8 Oct 2026 (\"create a review-only comparison on the Maple Avenue Barbershop appointment demo only … do not silently retain third-party embed/script if it violates the comparison structure\"), the wording and the lead's rulings in `design/booking-comparison-copy.md`, and the lead's brief of 8 Oct 2026 (\u00a73 of the booking-options task)";

/** The option-1 control's label: the demonstration link's own words, plus the arrow. */
export const OPTION1_LABEL = "Book a demonstration time";
/** Option 2's control label. Google's own wording, fixed by the owner, byte-exact. */
export const OPTION2_LABEL = "Book an appointment";
/**
 * The wrap rule on the shared-address small print, as an **inline** style: the paragraph
 * prints the booking address as visible text, and an address is one long unbreakable token
 * (`https://calendar.app.google/q6s7CqbW1HJGp8BQ6` is 45 characters). Measured on the built
 * page at a 360 px viewport: the text run ended at x=384, so `documentElement.scrollWidth`
 * was 384 against a `clientWidth` of 360, and the whole page scrolled sideways on the phone
 * the owner judges it on. `overflow-wrap: anywhere` lets the address break when it must and
 * — unlike `break-word` — also lowers the paragraph's min-content width, which is what
 * removes the scroll. It is inline because `styles.css` is shared by all ten pages and may
 * not change for this one.
 */
export const SHARED_ADDRESS_WRAP_STYLE = "overflow-wrap:anywhere";
/** The small print's opening tag, wrap rule included. */
export const SHARED_ADDRESS_OPEN = `<p class="muted" style="${SHARED_ADDRESS_WRAP_STYLE}">`;
/**
 * Option 3's frame's accessible name (the `title` attribute). The lead fixed this string:
 * a frame with no name is a nameless region to a screen reader, and this one says both
 * what it holds and whose page it is.
 */
export const FRAME_TITLE = "Demonstration booking page — a Google page shown inside this page";
/**
 * The frame's **visible container** (owner, 9 Oct 2026: on a desktop the frame "can't be
 * seen at all", and a third-party frame that a browser blocks fails silently, so the block
 * has to be visible even when nothing loads inside it).
 *
 * The box is the bundle's own card surface: the hairline `--rule`, the `--paper` surface
 * the cards use inside a `.section--alt`, the `--r-md` corner and a little `--s-2` padding.
 * Those are the bundle's tokens rather than new ones — this page invents no design of its
 * own. The frame inside keeps `border:0`, so the only edge a visitor sees is this box.
 */
export const FRAME_BOX_CLASS = "booking-comparison-frame";
/**
 * The frame's inline style: the three declarations that never vary with the screen size.
 * The height deliberately is **not** here — an inline style cannot carry a breakpoint, and
 * the height has to answer to the screen in both views (see `comparisonStyleBlock`).
 */
export const FRAME_INLINE_STYLE = "display:block;width:100%;border:0";
/**
 * The frame's height, measured out in the brief of 9 Oct 2026 after the page was looked at
 * on a phone and on a desktop. The frame now sits in an uninterrupted block, so it can
 * afford to be most of the screen instead of a fixed height that clipped Google's wide
 * desktop layout inside its own inner scrollbar. The phone view and the desktop view get
 * different answers, and both are relative to the screen rather than a guess about a device.
 *
 * No `100vh` and nothing `svh`-only: `vh` inside `min()`/`max()` with a pixel bound keeps
 * the box usable when a phone's own chrome or an on-screen keyboard changes the viewport.
 */
export const FRAME_PHONE_HEIGHT = "max(520px, 72vh)";
export const FRAME_DESKTOP_HEIGHT = "min(760px, 78vh)";
/**
 * The bundle's own breakpoint, read off its stylesheet: `styles.css` is mobile-first and
 * switches at 48rem (the phone menu, the privacy footer link and the two-column sections
 * all turn there), so this page turns there too.
 */
export const FRAME_BREAKPOINT = "48rem";
/**
 * The plain fallback anchor directly under the box (owner, 9 Oct 2026), so a blocked frame
 * is never a dead end: the same address, a new tab, `rel="noopener noreferrer"`. The label
 * is a **proposal** in the page's own vocabulary — the demonstration's other control reads
 * `Book a demonstration time`, and the notice under that link says what the address is, so
 * this one only has to say that it opens the same page away from the frame.
 */
export const FRAME_FALLBACK_LABEL = "Open the booking page on its own";
/**
 * The `id` of the block that gathers what is left of option 3's prose after the
 * explanation. One block, not loose paragraphs, so the option cannot drift back into "our
 * text between the heading and the frame".
 */
export const FRAME_NOTES_ID = "option-3-notes";
/**
 * The one option-3 sentence a taller frame made false. The page used to say the box was
 * "a box 600 pixels tall" and it is no longer that size, so the measurement is replaced by
 * the idea of most of the screen (the lead's wording, 9 Oct 2026). Every other word of the
 * sentence is the copy document's, byte for byte.
 */
export const OPTION3_BOX_SENTENCE =
  "The booking page itself, loaded inside this page in a box that takes up most of your screen, with no border.";
/** The stale measurement, in the words the page used to print, so a check can refuse it. */
export const OPTION3_STALE_MEASUREMENT = "600 pixels";
/**
 * The frame's caption. It was the visible caption **above** the frame; the owner's 9 Oct
 * reading ("split between your text") and the brief's "nothing of ours may sit between the
 * heading and the frame" moved it below the fallback anchor. Re-ordered, never re-worded:
 * the string is the copy document's, byte for byte, colon and all.
 */
export const FRAME_CAPTION = "The demonstration booking page, shown inside this page:";
/**
 * Option 3's explanation: what this option does, in the copy document's words. It sits
 * **after** the box and the fallback anchor now, not above the frame.
 */
export const OPTION3_LOAD_EXPLANATION =
  "This option loads Google's booking page inside this page when the page opens, so the browser contacts Google before anything is tapped, and what appears in the box is Google's own page.";
/** The first of the two notes: what the box holds, and what to do if it stays empty. */
export const OPTION3_NOTES_IF_LOADS =
  "If it loads, Google's booking page appears in that box. Google can change or withdraw that page at any time and Site Sourced would not know; what the box holds is Google's page, not a page Site Sourced draws. If the box stays empty, or the page or the browser refuses to be shown inside another page, use option 1.";
/** The second note: what happens with JavaScript turned off. */
export const OPTION3_NOTES_NO_JS =
  "With JavaScript turned off, the frame still asks Google for the page, and what it then shows has not been tested and is not claimed here.";
/**
 * Every option-3 sentence the copy document fixes, so a re-ordering that drops one is a
 * build failure rather than a quiet loss. The measurements the document fixes for the page
 * as a whole (the disclosure, the notice, the two labels, the frame's title) are checked
 * separately above.
 */
export const OPTION3_MANDATED_STRINGS: readonly string[] = [
  FRAME_CAPTION,
  OPTION3_BOX_SENTENCE,
  OPTION3_LOAD_EXPLANATION,
  OPTION3_NOTES_IF_LOADS,
  OPTION3_NOTES_NO_JS,
];
/**
 * The fallback anchor under the box, as the page writes it. A blocked third-party frame
 * fails silently, so the way out has to be a plain anchor beside it — the same address, a
 * new tab, `rel="noopener noreferrer"`, and the same class the other control wears (the
 * one the 44 px audit measures).
 */
export function frameFallbackAnchor(url: string): string {
  return `<a class="${BOOKING_ANCHOR_CLASS}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(FRAME_FALLBACK_LABEL)}&nbsp;${BOOKING_ARROW}</a>`;
}
/**
 * The comparison page's own CSS, inline in the page, because `styles.css` is shared by all
 * ten pages of the bundle and may not change for one of them. Two rules and a breakpoint:
 *
 *   1. the box that makes the frame visible even when nothing loads inside it;
 *   2. the frame's height — most of the screen, measured separately for the phone view and
 *      the desktop view, since the frame is now an uninterrupted block with room to be big.
 */
export function comparisonStyleBlock(): string {
  return `  <style>
    /* The comparison page's own rules. They are here, inline, because styles.css serves
       all ten pages of this bundle and may not change for one of them. */
    .${FRAME_BOX_CLASS} {
      border: var(--rule);
      background: var(--paper);
      border-radius: var(--r-md);
      padding: var(--s-2);
    }
    .${FRAME_BOX_CLASS} iframe { height: ${FRAME_PHONE_HEIGHT}; }
    @media (min-width: ${FRAME_BREAKPOINT}) {
      .${FRAME_BOX_CLASS} iframe { height: ${FRAME_DESKTOP_HEIGHT}; }
    }
  </style>`;
}

export interface ComparisonRenderVars {
  record: BusinessRecord;
  /** The record's slug, as `build.ts` derived it. */
  slug: string;
  /** The configured address (`DEMO_BOOKING_COMPARISON_URL`), or `""`. */
  url: string;
  /** The phase this bundle is in — `delivery.mode`. */
  phase: string;
}

export interface ComparisonDecision {
  /** Whether the page is written into the bundle. */
  enabled: boolean;
  /** Plain-English reason, carried into the manifest. */
  basis: string;
}

/**
 * Whether this build carries the comparison page — derived from the record, the phase and
 * the configuration, never from a flag someone set.
 *
 * Fail-safe direction, as everywhere else in this package: anything unresolved means **no
 * page**, so an incomplete configuration can only ever make a bundle say less.
 */
export function comparisonDecision(vars: ComparisonRenderVars): ComparisonDecision {
  const { record, slug, url, phase } = vars;
  if (phase === "business") {
    return {
      enabled: false,
      basis: `refused: this bundle is in the delivered phase. The comparison page carries Google's code and Google's frame; it is a review artifact for the owner, is never delivered to a client, and ${BOOKING_COMPARISON_VAR} carries no weight in a client build (${BOOKING_COMPARISON_BASIS}).`,
    };
  }
  if (url === "") {
    return {
      enabled: false,
      basis: `${BOOKING_COMPARISON_VAR} is not set in this build, so no comparison page is written and the bundle is the nine approved pages, byte for byte.`,
    };
  }
  if (slug !== BOOKING_COMPARISON_SLUG || !record.booking_url) {
    return {
      enabled: false,
      basis: `refused: this page is scoped to the ${BOOKING_COMPARISON_SLUG} appointment demonstration and to a record that carries a booking page. ${BOOKING_COMPARISON_VAR} is set but this record is "${slug}"${record.booking_url ? "" : " and carries no booking_url"}, so nothing is written (${BOOKING_COMPARISON_BASIS}).`,
    };
  }
  return {
    enabled: true,
    basis: `${BOOKING_COMPARISON_VAR} is set and this record is the ${BOOKING_COMPARISON_SLUG} appointment demonstration, so one extra page is written: ${BOOKING_COMPARISON_FILE}, requested by the owner as a comparison of three ways to reach the same booking page. It is not one of the nine; the nine are unchanged (${BOOKING_COMPARISON_BASIS}).`,
  };
}

/** The disclosure paragraph: what this page is, before any control on it. */
function disclosure(business: string): string {
  return `This page is an experiment. The nine pages of this demonstration site are the design Site Sourced proposed; this page is not one of them, and it was added at the request of Site Sourced's own owner so the three options below can be judged on a phone. All three reach the same page — a demonstration booking page made with Google Calendar and run by Site Sourced. Nothing booked there is an appointment with ${business}, and ${business} has not seen it.`;
}

/**
 * Option 1 — a plain link. The shape is the one the plan and `design/booking-link-spec.md`
 * §2 fix for a booking anchor: `https` only, a new tab with `rel="noopener noreferrer"`,
 * the arrow as a text glyph after a non-breaking space, and the demonstration notice
 * immediately under the link, in the same block.
 */
function optionOne(vars: { url: string; business: string }): string {
  const { url, business } = vars;
  return `    <section class="section section--alt" id="option-1">
      <div class="wrap">
        <h2>Option 1 — a plain link</h2>
        <p>One ordinary text link to the booking page.</p>
        <p>This option loads nothing from Google when this page opens — the browser contacts Google only if the link is tapped — and it works with JavaScript turned off.</p>
        <p><a class="${BOOKING_ANCHOR_CLASS}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(OPTION1_LABEL)}&nbsp;${BOOKING_ARROW}</a></p>
        <p class="muted">${esc(bookingNoticeDemo(business))}</p>
      </div>
    </section>`;
}

/**
 * Option 2 — Google's scheduling button.
 *
 * The button is **Google's own**: a script from Google's domain draws it here, and the
 * wording and the colour are set in the load call below (the owner's `Book an appointment`
 * and their `#039BE5`). Two consequences the page states outright rather than hiding: the
 * browser contacts Google as soon as the page opens, and with JavaScript off nothing is
 * drawn at all — which is why the fallback paragraph points at option 1.
 *
 * The label in the load call is `OPTION2_LABEL` — the owner's fixed string, byte-exact —
 * so the button a visitor sees carries exactly the words the comparison is about.
 */
function optionTwo(vars: { url: string }): string {
  const { url } = vars;
  return `    <section class="section" id="option-2">
      <div class="wrap">
        <h2>Option 2 — Google's scheduling button</h2>
        <p>Google's own scheduling button: a short piece of Google's code draws a button on this page, with the wording and the colour set in that code.</p>
        <p>This option loads Google's code when this page opens, so the browser contacts Google before any button is tapped — and with JavaScript turned off that code does not run, so no button appears.</p>
        <p class="muted">That wording is Google's, not Site Sourced's, and it does not say whose booking page the button opens.</p>
        <div class="booking-comparison-button" id="scheduling-button"></div>
        <script src="https://calendar.google.com/calendar/scheduling-button-script.js" async></script>
        <script>
          (function () {
            var target = document.getElementById("scheduling-button");
            window.addEventListener("load", function () {
              if (!window.calendar || !window.calendar.schedulingButton || !target) return;
              window.calendar.schedulingButton.load({
                url: ${JSON.stringify(url)},
                color: "#039BE5",
                label: ${JSON.stringify(OPTION2_LABEL)},
                target: target,
              });
            });
          })();
        </script>
        <p>If JavaScript is turned off, Google's code does not run and no button appears here at all; the same happens if a browser setting or an extension blocks Google's code. Either way the booking page can still be reached: use option 1, which is an ordinary link and needs no JavaScript.</p>
      </div>
    </section>`;
}
/**
 * Option 3 — the booking page in a frame, as **one uninterrupted block** (owner, 9 Oct
 * 2026: the look was liked, but the frame was "coded poorly … split between your text" and
 * on a desktop it "can't be seen at all").
 *
 * The order below is the brief's, and every part of it is checked: the heading; the frame
 * inside a visible container, with **nothing of ours between the heading and the frame**;
 * the plain fallback anchor, so a blocked frame is never a dead end; the caption; the
 * explanation; and then everything left over gathered into one block. Nothing here was
 * re-worded — the caption and the two notes moved, and one measurement sentence changed
 * (see `OPTION3_BOX_SENTENCE`).
 *
 * Three deliberate details, all of them the lead's rulings: **`loading="eager"`**, never
 * lazy, because the page's own words say the frame asks Google for the page when the page
 * opens and a lazy attribute would make that false; the frame keeps **`border:0`**, so the
 * edge a visitor sees is the container's hairline and not the frame's; and it carries a
 * **`title`**, which is the frame's accessible name — an untitled frame is a nameless
 * region to a screen reader. Its height comes from the page's own `<style>` block, because
 * a height that answers to the screen needs a breakpoint and an inline style cannot carry
 * one.
 *
 * The explanation and the notes do not promise that anything loads: a blank box is one of
 * the outcomes the page already describes.
 *
 * Exported for `test/booking-comparison.test.ts`, which reads the rendered section: the
 * order this function composes is the thing the owner asked for, and it is worth a test
 * rather than a comment.
 */
export function optionThreeSection(vars: { url: string }): string {
  const { url } = vars;
  return `    <section class="section section--alt" id="option-3">
      <div class="wrap">
        <h2>Option 3 — the booking page in a frame</h2>
        <div class="${FRAME_BOX_CLASS}">
          <iframe src="${esc(url)}" title="${esc(FRAME_TITLE)}" loading="eager" style="${FRAME_INLINE_STYLE}"></iframe>
        </div>
        <p>${frameFallbackAnchor(url)}</p>
        <p class="muted">${FRAME_CAPTION}</p>
        <p>${OPTION3_BOX_SENTENCE}</p>
        <p>${OPTION3_LOAD_EXPLANATION}</p>
        <div id="${FRAME_NOTES_ID}">
          <p>${OPTION3_NOTES_IF_LOADS}</p>
          <p>${OPTION3_NOTES_NO_JS}</p>
        </div>
      </div>
    </section>`;
}

/** The limits block: what this comparison is not, in the words the document fixes. */
function limits(vars: { business: string }): string {
  const { business } = vars;
  return `    <section class="section" id="limits">
      <div class="wrap">
        <h2>The limits of this comparison</h2>
        <p>This page is an experiment, and none of the three options has been decided on. Site Sourced's own rule for a booking link is a plain link like option 1 — no script and no frame, so that opening a page sends no request to anyone else. Options 2 and 3 break that rule because Site Sourced's owner asked to see them; this is the only page of this demonstration where either appears, and neither is offered to a client yet.</p>
        <p>The box in option 3 holds Google's own page. Site Sourced does not vouch for it, cannot audit it for accessibility, and cannot state what it does with a visitor's request.</p>
        <p>In options 2 and 3 the visitor's browser contacts Google as soon as this page opens, before anything is tapped. If either option were ever adopted for a client's site, that client's privacy notice would have to disclose it.</p>
        <p>Site Sourced adds no analytics and no tracking of its own to this page. What Google's code and Google's page do with the request is Google's own behaviour, under Google's own terms, and Site Sourced cannot state it. No assistive-technology testing has been done on any of the three, and nothing on this page claims how any of them behaves with a screen reader or a keyboard.</p>
        <p>Nothing booked on the demonstration page is an appointment with ${business}, and no time booked there reaches the business. It is reached by a direct link only, it is not linked from the rest of the demonstration, and it is not a client's site.</p>
      </div>
    </section>`;
}

/** The page's body, in the order `design/booking-comparison-copy.md` fixes. */
export function comparisonBody(ctx: RenderContext, url: string): string {
  const business = ctx.record.name;
  return `${renderComparisonHead(ctx, BOOKING_COMPARISON_TITLE)}

    <section class="section" id="about-this-page">
      <div class="wrap">
        <p>${esc(disclosure(business))}</p>
        <p>The three options are shown in the order they were asked for. That order says nothing about which one is better, and nothing on this page recommends one over the others.</p>
        ${SHARED_ADDRESS_OPEN}All three use the same address: ${esc(url)}</p>
      </div>
    </section>

${optionOne({ url, business })}

${optionTwo({ url })}

${optionThreeSection({ url })}

${limits({ business })}`;
}

/**
 * The comparison page, complete: the bundle's own furniture around the body above.
 *
 * Callers decide *whether* to render it (`comparisonDecision`); this function only
 * composes, so there is one place where the page's words live.
 */
export function renderBookingComparison(ctx: RenderContext, url: string): string {
  return renderComparisonPage(ctx, {
    title: `${BOOKING_COMPARISON_TITLE} — ${ctx.record.name}`,
    description:
      "A demonstration-page-only comparison of three ways to reach the same booking page, added at the request of Site Sourced's own owner.",
    // The page's own CSS, in the page: the frame's visible box and its height, which needs
    // a breakpoint and so cannot be an inline style. `styles.css` is shared by all ten
    // pages and stays byte-identical for this one.
    style: comparisonStyleBlock(),
    body: comparisonBody(ctx, url),
  });
}

/** Google's own scheduling-button script, as the button option loads it. */
export const GOOGLE_BUTTON_SCRIPT =
  "https://calendar.google.com/calendar/scheduling-button-script.js";

/**
 * **The checks that keep the exception to one file** (WORKFLOW.md rule 6: a rule that lives
 * only in prose is a rule that rots).
 *
 * Five clauses, each one something the owner's own instruction or a measurement requires,
 * and each one able to fail:
 *
 *   1. **Any other page stays clean.** No page of the bundle except `booking-comparison.html`
 *      may load a remote `script`, `iframe`, `embed` or `object`, and no page may link to
 *      the comparison page. The owner's words for the exception — "create a review-only
 *      comparison on the Maple Avenue Barbershop appointment demo only; do not change
 *      Northshore, do not release a client/final site, and keep the existing approved demo
 *      otherwise unchanged … do not silently retain third-party embed/script if it violates
 *      the comparison structure" — are the whole basis, and they are quoted here because a
 *      later reader has to be able to weigh the exception, not just see it.
 *   2. **Never in a delivered bundle.** A `business`-phase build may not carry this page at
 *      all: it is a review artifact for the owner, and Google's code and Google's frame do
 *      not belong on a client's site ("do not release a client/final site").
 *   3. **Never on another demonstration.** It is scoped to the one record the owner named.
 *   4. **The page's own obligations**, so the page cannot drift: the disclosure, the notice,
 *      the anchor's shape, the two fixed labels, the frame's `title`, no `loading="lazy"`,
 *      the bundle's phase furniture, and the copy guards (`guardCopy`, the family honesty
 *      rules) run over this page too — it is not exempt from the honesty rules just because
 *      it is exempt from the self-containment one.
 */
export function bookingComparisonProblems(vars: {
  /** The nine pages of this bundle (the comparison page is deliberately not among them). */
  pages: { file: string; html: string }[];
  record: BusinessRecord;
  /** The slug this build is for. */
  slug: string;
  /** The phase this bundle is in — `delivery.mode`. */
  phase: string;
  /** The rendered comparison page, or `""` when this build has none. */
  html: string;
  /** The configured address (`DEMO_BOOKING_COMPARISON_URL`), or `""`. */
  url: string;
}): string[] {
  const { pages, record, slug, phase, html, url } = vars;
  const problems: string[] = [];
  const remote = /<(?:script|iframe|embed|object)\b[^>]*\b(?:src|data)\s*=\s*"(?:https?:)?\/\//i;

  /* 1. every other page stays clean, and nothing links to the comparison page. */
  for (const page of pages) {
    if (page.file === BOOKING_COMPARISON_FILE) continue;
    const hit = remote.exec(page.html);
    if (hit) {
      problems.push(
        `${page.file}: loads ${hit[0].replace(/\s+/g, " ").slice(0, 120)} — a remote script or frame on a page of the demonstration. The one page in this bundle allowed to load Google's code or a Google frame is ${BOOKING_COMPARISON_FILE}, and only because the owner asked for it in writing on 8 Oct 2026 ("create a review-only comparison on the Maple Avenue Barbershop appointment demo only … do not silently retain third-party embed/script if it violates the comparison structure"). On every other page the plan's rule holds unchanged: a booking link is a plain anchor, never an embed, script or iframe. Basis: ${BOOKING_COMPARISON_BASIS}.`,
      );
    }
    if (page.html.includes(BOOKING_COMPARISON_FILE)) {
      problems.push(
        `${page.file}: links to ${BOOKING_COMPARISON_FILE}. The comparison page is reachable by direct link only — it is not linked from the rest of the demonstration, because it is not part of the design Site Sourced proposed and it must not read as one of the nine pages (owner's words: "keep the existing approved demo otherwise unchanged").`,
      );
    }
  }

  /* 2. never in a delivered bundle. */
  if (html !== "" && phase === "business") {
    problems.push(
      `${BOOKING_COMPARISON_FILE}: present in a bundle built in the delivered phase. This page loads Google's code and Google's frame; it is a review artifact for Site Sourced's owner, and a client's site may not carry it (owner's words: "do not release a client/final site"). ${BOOKING_COMPARISON_VAR} carries no weight in a client build — the page is refused outright, whatever the variable says.`,
    );
  }

  /* 3. never on another demonstration. */
  if (html !== "" && (slug !== BOOKING_COMPARISON_SLUG || !record.booking_url)) {
    problems.push(
      `${BOOKING_COMPARISON_FILE}: written into the bundle for "${slug}"${record.booking_url ? "" : ", a record with no booking_url,"} — but this page is scoped to the ${BOOKING_COMPARISON_SLUG} appointment demonstration and to a record that carries a booking page (owner's words: "create a review-only comparison on the Maple Avenue Barbershop appointment demo only; do not change Northshore"). Nothing is written for any other record.`,
    );
  }

  if (html === "") return problems;

  /* 4. the page's own obligations, read off the page rather than trusted. */
  const on = `on ${BOOKING_COMPARISON_FILE}`;
  if (!html.includes(`<h1>${BOOKING_COMPARISON_TITLE}</h1>`)) {
    problems.push(`${on}: the h1 is not ${JSON.stringify(BOOKING_COMPARISON_TITLE)}. The page's heading is what a visitor reads first about what this page is.`);
  }
  if (!html.includes(esc(disclosure(record.name)))) {
    problems.push(
      `${on}: the level disclosure is missing. Every control on the page sits under a paragraph that says the page is an experiment, that it is not one of the nine, and that nothing booked on the demonstration page is an appointment with ${record.name} (design/booking-comparison-copy.md §1).`,
    );
  }
  // The page prints these strings escaped (`esc`), so the check reads them the way the
  // page writes them rather than comparing against source text that never reaches the HTML.
  const notice = esc(bookingNoticeDemo(record.name));
  const noticeCount = html.split(notice).length - 1;
  if (noticeCount !== 1) {
    problems.push(
      `${on}: the demonstration notice appears ${noticeCount} time(s), not once. It belongs immediately under option 1's link, which is the link it describes; a notice repeated around the page stops reading as a notice about that link.`,
    );
  }
  const anchor = new RegExp(
    `<a class="${BOOKING_ANCHOR_CLASS}" href="([^"]*)" target="_blank" rel="noopener noreferrer">${esc(OPTION1_LABEL)}&nbsp;${BOOKING_ARROW}</a>`,
  );
  const anchorHit = anchor.exec(html);
  if (!anchorHit) {
    problems.push(
      `${on}: option 1's control is not the booking anchor this build composes — one <a> wearing ${JSON.stringify(BOOKING_ANCHOR_CLASS)} (the class the 44px audit measures), pointing at the configured address, opening in a new tab with rel="noopener noreferrer", reading ${JSON.stringify(`${OPTION1_LABEL} ${BOOKING_ARROW}`)} with the arrow as a text glyph after a non-breaking space (design/booking-link-spec.md §2).`,
    );
  } else if (anchorHit[1] !== url) {
    problems.push(
      `${on}: option 1's link points at "${anchorHit[1]}", not at the configured address "${url}". All three options must reach the same address, which is what the page's own small print says.`,
    );
  }
  if (!/^https:\/\//.test(url)) {
    problems.push(
      `${on}: the configured address ${JSON.stringify(url)} is not an https URL. The page hands a visitor to Google, so the address must be a plain https one (gbp §5.3 rule 4).`,
    );
  }
  if (!html.includes(`<script src="${GOOGLE_BUTTON_SCRIPT}" async></script>`)) {
    problems.push(
      `${on}: option 2 does not load Google's own scheduling-button script (${GOOGLE_BUTTON_SCRIPT}). The option is "Google's scheduling button", and the only honest way to show it is Google's own code.`,
    );
  }
  if (!html.includes(`label: ${JSON.stringify(OPTION2_LABEL)}`)) {
    problems.push(
      `${on}: option 2's load call does not set the label ${JSON.stringify(OPTION2_LABEL)}. That wording is fixed by the owner, byte-exact, and it is one of the three things being compared.`,
    );
  }
  const frameBoxOpen = `<div class="${FRAME_BOX_CLASS}">`;
  const frames = [...html.matchAll(/<iframe\b[^>]*>/gi)].map((m) => m[0]!);
  if (frames.length !== 1) {
    problems.push(`${on}: carries ${frames.length} frames, not one. One booking page is being compared inside a frame, and a second frame would be a second third-party load nobody asked to measure.`);
  } else {
    const frame = frames[0]!;
    if (!frame.includes(`title="${esc(FRAME_TITLE)}"`)) {
      problems.push(
        `${on}: the frame's title is not ${JSON.stringify(FRAME_TITLE)}. A frame's title is its accessible name; without it a screen reader announces an unnamed region, and the name is also what tells a visitor whose page they are looking at (design/booking-comparison-copy.md §2, option 3).`,
      );
    }
    if (!frame.includes(`src="${esc(url)}"`)) {
      problems.push(`${on}: the frame does not point at the configured address ("${url}"). Option 3 is the same booking page the other two options reach.`);
    }
    // `loading="eager"` outright, not merely the absence of `lazy`: the page's own words
    // say the browser contacts Google as soon as this page opens, and the owner's brief of
    // 9 Oct 2026 asks for the attribute so a later edit cannot flip it to lazy and quietly
    // make that sentence false.
    if (!frame.includes('loading="eager"')) {
      problems.push(
        `${on}: the frame does not carry loading="eager". The page's own words say the browser contacts Google as soon as this page opens, and a brief of 9 Oct 2026 fixes the frame as eager so a later edit cannot make it lazy — and so make the page's own sentence false (lead ruling D, design/booking-comparison-copy.md).`,
      );
    }
    if (!frame.includes(`style="${FRAME_INLINE_STYLE}"`)) {
      problems.push(
        `${on}: the frame's inline style is not ${JSON.stringify(FRAME_INLINE_STYLE)}. display:block stops the frame being an inline box with a baseline gap under it, width:100% makes it the box's width on every screen, and border:0 keeps the only visible edge the container's hairline. The height is deliberately not here: it needs a breakpoint, and an inline style cannot carry one.`,
      );
    }
  }

  /*
   * 4c. **option 3 is one uninterrupted block, and nothing of ours sits between the heading
   * and the frame.** The owner looked at the page on a phone and on a desktop and reported
   * the frame "coded poorly … split between your text" and, at 1440×900, "can't be seen at
   * all". The brief of 9 Oct 2026 fixes the order — heading, frame in its visible box,
   * fallback anchor, caption, explanation, notes — and this reads that order off the page.
   */
  const optionThree = /<section class="section section--alt" id="option-3">([\s\S]*?)<\/section>/.exec(html)?.[1];
  if (optionThree === undefined) {
    problems.push(
      `${on}: there is no option-3 section. Option 3 is the frame, and the page is a comparison of three options; without this section two of the three are missing.`,
    );
  } else {
    const heading = `<h2>Option 3 — the booking page in a frame</h2>`;
    const headingAt = optionThree.indexOf(heading);
    const boxAt = optionThree.indexOf(frameBoxOpen);
    const frameAt = optionThree.indexOf("<iframe");
    const anchorAt = optionThree.indexOf(frameFallbackAnchor(url));
    const captionAt = optionThree.indexOf(`<p class="muted">${FRAME_CAPTION}</p>`);
    const boxSentenceAt = optionThree.indexOf(`<p>${OPTION3_BOX_SENTENCE}</p>`);
    const explanationAt = optionThree.indexOf(`<p>${OPTION3_LOAD_EXPLANATION}</p>`);
    const notesAt = optionThree.indexOf(`<div id="${FRAME_NOTES_ID}">`);
    for (const [what, at] of [
      ["the option-3 heading", headingAt],
      ["the frame's visible box", boxAt],
      ["the frame", frameAt],
      ["the fallback anchor under the box", anchorAt],
      ["the frame's caption", captionAt],
      ["the sentence that describes the box", boxSentenceAt],
      ["the explanation of what the option loads", explanationAt],
      ["the notes block", notesAt],
    ] as const) {
      if (at < 0) {
        problems.push(
          `${on}: option 3 is missing ${what}. Re-ordering may move a mandated sentence, never drop it (design/booking-comparison-copy.md §2, option 3; owner's brief, 9 Oct 2026).`,
        );
      }
    }
    if (headingAt >= 0 && boxAt > headingAt) {
      const between = optionThree.slice(headingAt + heading.length, boxAt).trim();
      if (between !== "") {
        problems.push(
          `${on}: ${JSON.stringify(between.slice(0, 90))} sits between option 3's heading and the frame. "Nothing of ours may sit between the heading and the frame" (owner's brief, 9 Oct 2026 — the frame was "split between your text"); the heading is followed by the box, and everything else comes below it.`,
        );
      }
    }
    if (boxAt >= 0 && frameAt > boxAt) {
      const inBox = optionThree.slice(boxAt + frameBoxOpen.length, frameAt).trim();
      if (inBox !== "") {
        problems.push(
          `${on}: ${JSON.stringify(inBox.slice(0, 90))} sits inside the frame's box, before the frame. The box holds the frame and nothing else; the container exists so the block is visible even when a browser blocks the frame and nothing loads inside it (owner's brief, 9 Oct 2026).`,
        );
      }
    }
    const order: [string, number][] = [
      ["the frame", frameAt],
      ["the fallback anchor", anchorAt],
      ["the caption", captionAt],
      ["the box sentence", boxSentenceAt],
      ["the explanation", explanationAt],
      ["the notes", notesAt],
    ];
    if (order.every(([, at]) => at >= 0)) {
      for (let i = 1; i < order.length; i += 1) {
        const [beforeName, beforeAt] = order[i - 1]!;
        const [afterName, afterAt] = order[i]!;
        if (!(beforeAt < afterAt)) {
          problems.push(
            `${on}: option 3's ${afterName} comes before its ${beforeName}. The order the owner asked for is: the frame in its box, the fallback anchor directly under it, then the caption, the sentence about the box, the explanation, and the notes in one block (owner's brief, 9 Oct 2026).`,
          );
        }
      }
    }
    if (frameAt >= 0 && anchorAt >= 0) {
      // The anchor may follow the box's closing tag and nothing else.
      const boxThenAnchor = optionThree.slice(frameAt, anchorAt);
      if (!/^<iframe[\s\S]*?<\/iframe>\s*<\/div>\s*<p>\s*$/.test(boxThenAnchor)) {
        problems.push(
          `${on}: something sits between the frame's box and the fallback anchor. The anchor comes directly under the container, so the way out is the next thing a visitor reads when the frame stays empty (owner's brief, 9 Oct 2026).`,
        );
      }
    }
  }
  /* The one measurement a taller frame made false, and the sentences that must survive. */
  if (html.includes(OPTION3_STALE_MEASUREMENT)) {
    problems.push(
      `${on}: the page still says ${JSON.stringify(OPTION3_STALE_MEASUREMENT)}. The frame is no longer that height — it is ${JSON.stringify(FRAME_PHONE_HEIGHT)} on a phone and ${JSON.stringify(FRAME_DESKTOP_HEIGHT)} on a desktop — so the sentence would be describing a box that is not there (owner's brief, 9 Oct 2026).`,
    );
  }
  for (const sentence of OPTION3_MANDATED_STRINGS) {
    if (!html.includes(sentence)) {
      problems.push(
        `${on}: the option-3 wording ${JSON.stringify(sentence.slice(0, 70))}… is missing from the page. Every sentence design/booking-comparison-copy.md fixes for option 3 must stay on the page, whatever its position (owner's brief, 9 Oct 2026).`,
      );
    }
  }
  /*
   * 4d. **the frame's visible box, and its height.** The box is what makes the block
   * visible when a browser blocks a third-party frame; the height has to answer to the
   * screen in both views, which is why it lives in the page's own `<style>` block rather
   * than in an inline style or in the shared stylesheet. Measured brief (9 Oct 2026):
   * desktop about min(760px, 78vh), phones about max(520px, 72vh).
   */
  if (!html.includes(frameBoxOpen)) {
    problems.push(
      `${on}: the frame is not inside a visible container (${JSON.stringify(frameBoxOpen)}). A third-party frame that a browser blocks fails silently, so the block has to be visible even when nothing loads inside it (owner's brief, 9 Oct 2026).`,
    );
  }
  const boxRule = new RegExp(`\\.${FRAME_BOX_CLASS} \\{[^}]*\\}`).exec(html)?.[0] ?? "";
  for (const declaration of ["border: var(--rule)", "background: var(--paper)", "padding: var(--s-2)"]) {
    if (!boxRule.includes(declaration)) {
      problems.push(
        `${on}: the frame's container does not carry ${JSON.stringify(declaration)}. The box is the bundle's own card surface — a hairline edge, the paper background and a little padding — so it is visible with nothing loaded inside it (owner's brief, 9 Oct 2026).`,
      );
    }
  }
  for (const [view, height] of [
    ["a phone", FRAME_PHONE_HEIGHT],
    ["a desktop", FRAME_DESKTOP_HEIGHT],
  ] as const) {
    if (!html.includes(`.${FRAME_BOX_CLASS} iframe { height: ${height}; }`)) {
      problems.push(
        `${on}: the frame's height on ${view} is not ${JSON.stringify(height)}. The frame now sits in an uninterrupted block, so it is measured against the screen instead of a fixed height that clipped Google's wide desktop layout inside its own inner scrollbar (owner's brief, 9 Oct 2026).`,
      );
    }
  }
  if (!html.includes(`@media (min-width: ${FRAME_BREAKPOINT})`)) {
    problems.push(
      `${on}: the page carries no ${FRAME_BREAKPOINT} breakpoint, so the phone height and the desktop height cannot both be in force. ${FRAME_BREAKPOINT} is the bundle's own turn — styles.css is mobile-first and switches there — and the breakpoint has to live in the page because an inline style cannot carry one.`,
    );
  }
  if (/\b100(?:vh|svh|dvh)\b/i.test(html)) {
    problems.push(
      `${on}: the page sizes something at the whole viewport (a 100vh-style unit). A frame at the full viewport height is unusable on a phone, where the browser's own chrome and the on-screen keyboard change the height as it opens (owner's brief, 9 Oct 2026: no 100vh, nothing svh-only).`,
    );
  }
  /*
   * 4b. **the address must be able to wrap.** A narrow phone must not have to scroll
   * sideways to read this page, and the only thing that ever made it do so was this
   * paragraph: the address is one 45-character token, and measured on the built page at
   * 360 px its line box ended at x=384 (clientWidth 360 / scrollWidth 384 before the rule;
   * 360/360 after). A build that loses the rule loses the fix.
   */
  if (!html.includes(`${SHARED_ADDRESS_OPEN}All three use the same address: `)) {
    problems.push(
      `${on}: the shared-address small print does not carry ${JSON.stringify(SHARED_ADDRESS_WRAP_STYLE)}. It prints the booking address as visible text, and that address is one long unbreakable token — measured at a 360 px viewport the paragraph reached x=384 and the whole page scrolled sideways (clientWidth 360). Without the rule the page cannot be judged on a phone, which is what it exists for.`,
    );
  }
  if (!/name="robots" content="noindex, nofollow"/.test(html)) {
    problems.push(`${on}: no noindex meta. Every page of a demonstration carries it, including this one.`);
  }
  if (!html.includes("proposal-banner")) {
    problems.push(`${on}: the proposal banner is missing. This page is part of a demonstration that is an unsolicited proposal, and it says so above everything else.`);
  }
  for (const banned of guardCopy(html, record)) {
    problems.push(
      `${on}: the page says ${JSON.stringify(banned)}, which is a claim a demonstration may not make. The comparison page is exempt from the self-containment rule, not from the honesty rules.`,
    );
  }
  for (const problem of familyHonestyProblems({ pages: [{ file: BOOKING_COMPARISON_FILE, html }], record, family: "appointment" })) {
    problems.push(`${on}: ${problem}`);
  }
  return problems;
}
