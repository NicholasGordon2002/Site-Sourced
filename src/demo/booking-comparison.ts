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
 * Option 3 — the booking page in a frame.
 *
 * Three deliberate details, all of them the lead's rulings: **no `loading="lazy"`**, because
 * the page's own words say the frame asks Google for the page when the page opens and a
 * lazy attribute would make that false; the frame is **600 px tall and borderless**, as the
 * wording states, through an inline style rather than a stylesheet rule, because
 * `styles.css` is shared by all ten pages and a shared file may not change for this page;
 * and it carries a **`title`**, which is the frame's accessible name — an untitled frame is
 * a nameless region to a screen reader.
 *
 * The caption above the frame and the paragraph below it do not promise that anything
 * loads: a blank box is one of the outcomes the page already describes.
 */
function optionThree(vars: { url: string }): string {
  const { url } = vars;
  return `    <section class="section section--alt" id="option-3">
      <div class="wrap">
        <h2>Option 3 — the booking page in a frame</h2>
        <p>The booking page itself, loaded inside this page in a box 600 pixels tall, with no border.</p>
        <p>This option loads Google's booking page inside this page when the page opens, so the browser contacts Google before anything is tapped, and what appears in the box is Google's own page.</p>
        <p class="muted">The demonstration booking page, shown inside this page:</p>
        <iframe src="${esc(url)}" title="${esc(FRAME_TITLE)}" style="display:block;width:100%;height:600px;border:0"></iframe>
        <p>If it loads, Google's booking page appears in that box. Google can change or withdraw that page at any time and Site Sourced would not know; what the box holds is Google's page, not a page Site Sourced draws. If the box stays empty, or the page or the browser refuses to be shown inside another page, use option 1.</p>
        <p>With JavaScript turned off, the frame still asks Google for the page, and what it then shows has not been tested and is not claimed here.</p>
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

${optionThree({ url })}

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
    if (/\bloading\s*=/i.test(frame)) {
      problems.push(
        `${on}: the frame carries a loading attribute. The page's own words say the browser contacts Google when the page opens; a lazy frame would make that sentence false (lead ruling D, design/booking-comparison-copy.md).`,
      );
    }
    if (!/height:\s*600px/.test(frame)) {
      problems.push(`${on}: the frame is not the 600-pixel-tall box the page's own sentence describes.`);
    }
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
