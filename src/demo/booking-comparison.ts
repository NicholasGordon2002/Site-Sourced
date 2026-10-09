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
import { bookingNoticeDemo } from "./copy.ts";
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
        <p class="muted">All three use the same address: ${esc(url)}</p>
      </div>
    </section>

${optionOne({ url, business })}

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
    body: comparisonBody(ctx, url),
  });
}
