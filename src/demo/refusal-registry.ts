/**
 * Site Sourced — every list of named refusals, in one place, with the prose it refuses.
 *
 * A refusal in the demo generator is a pair: **what it is** ("the demonstration paragraph",
 * "a cookie", "must not promise a price") and **the pattern that finds it**. The pattern is
 * the half that can quietly stop working, and nothing used to check it: on 9 Oct the
 * manifest listed "the demonstration paragraph in the delivered README" as refused while no
 * pattern in the build matched that paragraph, and the leak it named was real.
 *
 * So the lists moved here, declared once each, and each entry carries **samples of the prose
 * or construct it claims to refuse**. `refusal-coverage.ts` checks that every entry's own
 * pattern can match its samples and that no pattern matches ordinary page prose; the guards
 * in `build.ts`, `provenance.ts`, `copy.ts`, `family.ts` and `retention.ts` read the same
 * declarations, so a guard and its coverage check can never be looking at two lists.
 *
 * Where the prose is the build's own composition, the sample is that sentence and
 * `test/refusal-coverage.test.ts` asserts it is really on a page (or in the README) the
 * build writes — so the sample cannot drift away from the thing it is supposed to be.
 *
 * **Not registered here, and why** (each one is a list of *recognisers*, not of refusals, so
 * "can this pattern refuse the thing it names" is not the question it answers):
 *
 *   - `copy.ts` `NAMED_DETAILS` — the four detail names ("hours", "address", "phone number",
 *     "email address") as pages write them. Matching ordinary prose is the point: the
 *     refusal is a *claim shape* naming a detail the record does not carry, which
 *     `DETAIL_CLAIM_SHAPES` (registered) is where it lives;
 *   - `family.ts` `ENTITIES` — HTML entities decoded before a sentence is reported. It
 *     replaces text and refuses nothing.
 *
 * `test/refusal-coverage.test.ts` reads the source and refuses any *other* list of named
 * refusals that exists there without being registered here, so the boundary is enforced
 * rather than trusted.
 */
import { BANNED, DETAIL_CLAIM_SHAPES } from "./copy.ts";
import { APPOINTMENT_RULES, INQUIRY_RULES, wholeWordPattern } from "./family.ts";
import { DEMO_SOURCING_CLAIMS } from "./provenance.ts";
import { WINDOW_SHAPES } from "./retention.ts";
import type { NamedPattern, RefusalList } from "./refusal-coverage.ts";

/* ------------------------------------------------ the demonstration phase, both directions */

/**
 * The furniture that belongs to the demonstration phase, in the words a page writes it.
 *
 * Read by `phaseFurnitureProblems` in both directions: required while a bundle is a
 * demonstration, refused once it is a delivered site.
 */
export const PROPOSAL_FURNITURE: [string, RegExp][] = [
  ["the proposal banner element", /<div class="proposal-banner"/i],
  ["an unsolicited-proposal sentence", /unsolicited (?:design )?proposal/i],
  ["the footer disclaimer", /not affiliated with, endorsed by, or operated by/i],
  ["a noindex marker", /<meta\s+name="robots"[^>]*noindex/i],
  ["the sentence about being marked noindex", /marked noindex/i],
  ["the takedown promise", /ask and (?:we will take it down|it comes down)/i],
];

/** The line the demonstration's README opens with, and the delivered README must not carry. */
export const DEMO_README_MARKER = "DEMONSTRATION — not the business's website";

/**
 * The prose **only a demonstration may carry**, in the words this build writes it.
 *
 * `PROPOSAL_FURNITURE` above catches the *unsolicited-proposal* family: the offer, the
 * noindex marker, the takedown promise. It does not catch the demonstration's *own*
 * sentences, and three of them did reach a delivered bundle:
 *
 *   1. the README's demonstration paragraph — "DEMONSTRATION — not the business's
 *      website, and never sent to the business. The contact form's submissions come to
 *      Site Sourced." The manifest already **claimed** this was refused ("the
 *      demonstration paragraph in the delivered README", `MANIFEST_PHASE_REFUSED`) while
 *      no line of code tested it: the paragraph on its own matched no pattern, so the
 *      only thing keeping it out of a client's README was the phase ternary in
 *      `renderEditingReadme` — a promise about the phase, checked by nothing;
 *   2. the README's demonstration contact-form section — "This is a demonstration bundle,
 *      not a delivered site.", the block that follows the same ternary;
 *   3. "on a demonstration page …" — our own template's, in the comment above the form's
 *      qualifier line and in a provider fact, both of which ship inside the folder.
 *
 * Three of the delivered bundle's files are the client's to read and edit — the README
 * and the pages — and on a delivered site none of them may describe the work as a
 * demonstration. Each pattern names the sentence itself rather than a keyword: "this
 * demonstration" is not refused, because a record's own recorded wording is allowed to
 * contain the word and a client build must never fail on the client's own copy.
 */
export const DEMO_ONLY_PROSE: [string, RegExp][] = [
  ["the demonstration paragraph", /DEMONSTRATION — not the business's website/],
  ["the demonstration bundle's contact-form paragraph", /This is a demonstration bundle, not a delivered site/],
  ["the demonstration-page sentence", /on a demonstration page\b/i],
];

/** Every sentence the demonstration phase prints, as the prose it is written as. */
const PHASE_SAMPLES: Record<string, readonly string[]> = {
  "the proposal banner element": ['<div class="proposal-banner" role="note">'],
  "an unsolicited-proposal sentence": ["This page is an unsolicited design proposal from Site Sourced."],
  "the footer disclaimer": ["It is not affiliated with, endorsed by, or operated by"],
  "a noindex marker": ['<meta name="robots" content="noindex, nofollow">'],
  "the sentence about being marked noindex": [
    "This page is marked noindex, so it does not appear in search results.",
  ],
  "the takedown promise": ["Ask and we will take it down."],
  "the demonstration paragraph": [DEMO_README_MARKER],
  "the demonstration bundle's contact-form paragraph": ["This is a demonstration bundle, not a delivered site."],
  "the demonstration-page sentence": ["on a demonstration page it says nothing here is booked"],
};

/* --------------------------------------------------------------- what a visitor reads */

/**
 * Visitor-facing text that is still a working note rather than a sentence.
 *
 * The plan's rule is that nothing published carries placeholder data, and the privacy
 * notice is the first page with a value we do not have yet (the owner's legal name and
 * mailing address). The rule the owner set for it is stricter than "looks finished": a
 * bracketed or invented value must never reach a public path.
 */
export const PLACEHOLDER_PATTERNS: [string, RegExp][] = [
  ["a bracketed placeholder", /\[[^\]\n]{2,60}\]/],
  ["an unfilled template token", /\{[a-zA-Z][^}\n]{2,60}\}/],
  ["a working note", /\b(TBD|TODO|FIXME)\b/],
  ["filler text", /lorem ipsum/i],
];

/** One instance of each thing a placeholder pattern names. */
const PLACEHOLDER_SAMPLES: Record<string, readonly string[]> = {
  "a bracketed placeholder": ["Call [your name here] to book a haircut."],
  "an unfilled template token": ["Welcome to {business_name} on Maple Avenue."],
  "a working note": ["TODO: replace the photograph with the shop's own."],
  "filler text": ["Lorem ipsum dolor sit amet, consectetur adipiscing elit."],
};

/**
 * The sentences that may only appear while a bundle is a **demonstration**, as the words a
 * visitor would read. The sourcing half of the phase gate (WORKFLOW.md rule 9): each of them
 * describes an unsolicited proposal built from details we had to go and find.
 */
const SOURCING_SAMPLES: Record<string, readonly string[]> = {
  "the sentence that says the details came from public listings": [
    "Business details come from public listings about this business.",
  ],
  'the "as published in public listings" caveat': [
    "The address and email address for the business on this page are as published in public listings — please confirm them with the business before relying on them.",
  ],
  'the "public mapping data" credit': [
    "Business details come from public mapping data (© OpenStreetMap contributors, ODbL 1.0).",
  ],
};

/* ----------------------------------------------------- nothing loads from another origin */

/**
 * The two ways a stylesheet can pull a file from another origin. Read by
 * `externalReferenceProblems` in `build.ts`.
 */
export const EXTERNAL_STYLESHEET_PATTERNS: [string, RegExp][] = [
  ["an @import", /@import\s+(?:url\(\s*)?['"]?\s*(?:https?:)?\/\//i],
  ["a url()", /url\(\s*['"]?\s*(?:https?:)?\/\//i],
];

/** One stylesheet construct per entry. */
const EXTERNAL_STYLESHEET_SAMPLES: Record<string, readonly string[]> = {
  "an @import": ["@import url('https://fonts.example.com/source-sans.css');"],
  "a url()": ["url(https://fonts.example.com/source-sans-3-latin.woff2)"],
};

/**
 * The browser APIs `site.js` must never touch, because the privacy notice prints a sentence
 * saying it does not (the "no cookies, no analytics and no tracking" line).
 */
export const FORBIDDEN_SCRIPT_PATTERNS: [string, RegExp][] = [
  ["a cookie", /document\s*\.\s*cookie/i],
  ["web storage", /\b(?:localStorage|sessionStorage|indexedDB)\b/i],
  ["a tracking beacon", /\b(?:sendBeacon|new\s+Image\b)/i],
  ["a direct XHR", /\bXMLHttpRequest\b/i],
  ["an analytics call", /\b(?:gtag|dataLayer|analytics|mixpanel|segment|plausible|fathom)\b/i],
];

/** One call per entry, as `site.js` would have to write it. */
const FORBIDDEN_SCRIPT_SAMPLES: Record<string, readonly string[]> = {
  "a cookie": ["document.cookie = 'seen=1';"],
  "web storage": ["localStorage.setItem('seen', '1');"],
  "a tracking beacon": ["navigator.sendBeacon('/collect', payload);"],
  "a direct XHR": ["const request = new XMLHttpRequest();"],
  "an analytics call": ["window.dataLayer.push({ event: 'view' });"],
};

/**
 * The marks a header with no photograph behind it may not wear, one named pattern per shape
 * so a refusal can say which one it found (clause 2 of `headerOverlayProblems`).
 */
export const OVERLAY_MARKS: { what: string; re: RegExp }[] = [
  { what: "a shared grid cell", re: /\bgrid-(area|row|column)\s*:|(^|;)\s*display\s*:\s*grid\b/ },
  { what: "a wash over the photograph", re: /linear-gradient\([^;]*rgba\(/ },
  { what: "white header text", re: /(^|;)\s*color\s*:\s*#(?:fff|ffffff)\b|(^|;)\s*color\s*:\s*white\s*(;|$)/i },
  { what: "a white action on the wash", re: /(^|;)\s*background(-color)?\s*:\s*#(?:fff|ffffff)\b|(^|;)\s*background(-color)?\s*:\s*white\s*(;|$)/i },
  { what: "a white focus ring on the wash", re: /outline-color\s*:\s*#(?:fff|ffffff)\b|outline-color\s*:\s*white\s*(;|$)/i },
  { what: "the header stacked above the page", re: /(^|;)\s*z-index\s*:\s*\d/ },
];

/** One declaration per mark, as the stylesheet would have to write it. */
const OVERLAY_MARK_SAMPLES: Record<string, readonly string[]> = {
  "a shared grid cell": ["display: grid;"],
  "a wash over the photograph": ["background-image: linear-gradient(rgba(0, 0, 0, 0.4), transparent);"],
  "white header text": ["color: #ffffff;"],
  "a white action on the wash": ["background-color: #fff;"],
  "a white focus ring on the wash": ["outline-color: white;"],
  "the header stacked above the page": ["z-index: 2;"],
};

/* ------------------------------------------------------ the words a page may never claim */

/** One thing a family may not say, as the wording it is a claim when a page says it. */
const FAMILY_RULE_SAMPLES: Record<string, readonly string[]> = {
  "must not book a time": ["Book now and skip the wait."],
  "must not show or claim availability": ["Check availability for next week."],
  "must not offer a time slot": ["Pick a slot that suits you."],
  "must not claim a confirmed appointment": ["You will get a confirmation by email."],
  "must not promise an instant appointment": ["Instant confirmation, guaranteed."],
  "must not promise a same-day appointment": ["Same-day appointments are available."],
  "must not state or promise a price": ["Our prices start at $99."],
  "must not promise a free, fixed or guaranteed price": ["Free quotes on request."],
  "must not promise a timeline": ["We reply within 24 hours."],
  "must not promise a visit": ["We will come out to you."],
  "must not claim a service area": ["Serving Hamilton and the surrounding area."],
};

/**
 * The two claim shapes `composeCopy` writes that name a printed detail, and the sample
 * sentence each reads (`copy.ts` `printedDetailClaimProblems` compiles `source` the same way
 * this registry does).
 */
const DETAIL_SHAPE_SAMPLES: Record<string, readonly string[]> = {
  "the hero's offering line": ["Hours, address and phone number recorded for this barber shop."],
  "the sentence that sends a visitor to a printed detail": ["Hours, address and email address printed with it"],
};

/* ------------------------------------------------------------------------- the registry */

/** One window the guard must find, per shape it names. */
const WINDOW_SAMPLES: Record<string, readonly string[]> = {
  'a window counted from now ("within 30 days")': ["We delete it within 30 days."],
  'a window stated in days, weeks or months ("30 days")': ["Stored for 30 days."],
  'a window spelled out in words ("thirty days")': ["Kept for thirty days."],
  'an approximate window in months ("about three months")': ["Held for about three months."],
};

/** Every sample the registry knows, by entry name. */
export const REFUSAL_SAMPLES: Record<string, readonly string[]> = {
  ...PHASE_SAMPLES,
  ...PLACEHOLDER_SAMPLES,
  ...SOURCING_SAMPLES,
  ...EXTERNAL_STYLESHEET_SAMPLES,
  ...FORBIDDEN_SCRIPT_SAMPLES,
  ...OVERLAY_MARK_SAMPLES,
  ...FAMILY_RULE_SAMPLES,
  ...DETAIL_SHAPE_SAMPLES,
  ...WINDOW_SAMPLES,
};

/**
 * A list of `[what, pattern]` pairs, with the samples each entry claims to refuse.
 *
 * An entry with no sample is left empty here rather than thrown: the coverage check reports
 * it by name, which is the failure a reader needs (an entry nothing can be checked against),
 * and a build-time throw would take the whole generator down instead.
 */
function list(
  source: string,
  refuses: string,
  pairs: readonly [string, RegExp][],
  /** Where an entry names its own prose (a banned phrase), the sample is that prose. */
  selfSample?: (what: string) => readonly string[],
): RefusalList {
  return {
    source,
    refuses,
    entries: pairs.map(([what, pattern]): NamedPattern => ({
      what,
      pattern,
      samples: REFUSAL_SAMPLES[what] ?? selfSample?.(what) ?? [],
    })),
  };
}

/** The two lists `MANIFEST_PHASE_REFUSED` is derived from, kept apart so the check can prove it. */
export const PHASE_REFUSAL_LISTS: RefusalList[] = [
  list("PROPOSAL_FURNITURE", "the unsolicited-proposal furniture a delivered site may not carry", PROPOSAL_FURNITURE),
  list("DEMO_ONLY_PROSE", "the demonstration's own sentences, which a client's site may not carry", DEMO_ONLY_PROSE),
];

/**
 * Every list of named refusals this generator enforces against real text.
 *
 * The guards do not read this array — they read the lists — and that is deliberate: the
 * registry is the coverage check's index of them, so a list that is edited in place is
 * covered by the check the moment it changes, with no second copy to update.
 */
export const REFUSAL_LISTS: RefusalList[] = [
  ...PHASE_REFUSAL_LISTS,
  list(
    "DEMO_SOURCING_CLAIMS",
    "the demonstration's sourcing sentences (provenance.ts, the business-phase half)",
    DEMO_SOURCING_CLAIMS,
  ),
  list("PLACEHOLDER_PATTERNS", "placeholder data reaching visitor-facing text (build.ts)", PLACEHOLDER_PATTERNS),
  list(
    "EXTERNAL_STYLESHEET_PATTERNS",
    "a stylesheet pulling a file from another origin (build.ts)",
    EXTERNAL_STYLESHEET_PATTERNS,
  ),
  list("FORBIDDEN_SCRIPT_PATTERNS", "a browser API the privacy notice says site.js does not touch (build.ts)", FORBIDDEN_SCRIPT_PATTERNS),
  list(
    "OVERLAY_MARKS",
    "a mark the header may not wear when no photograph is behind it (build.ts)",
    OVERLAY_MARKS.map((mark): [string, RegExp] => [mark.what, mark.re]),
  ),
  list("WINDOW_SHAPES", "a retention window in the privacy notice (retention.ts)", WINDOW_SHAPES),
  list(
    "BANNED",
    "a phrase a demo may never contain unless the record itself carries it (copy.ts)",
    BANNED.map((phrase): [string, RegExp] => [phrase, wholeWordPattern(phrase)]),
    // A banned entry names its own prose: the phrase is both the thing refused and the
    // sample the pattern must find. No hand-written sample table can drift from it.
    (phrase) => [phrase],
  ),
  list(
    "APPOINTMENT_RULES",
    "what an appointment page may never claim (family.ts)",
    APPOINTMENT_RULES.map((rule): [string, RegExp] => [rule.claim, rule.pattern]),
  ),
  list(
    "INQUIRY_RULES",
    "what an inquiry page may never claim (family.ts)",
    INQUIRY_RULES.map((rule): [string, RegExp] => [rule.claim, rule.pattern]),
  ),
  list(
    "DETAIL_CLAIM_SHAPES",
    "a page naming a printed detail the record does not carry (copy.ts)",
    DETAIL_CLAIM_SHAPES.map((shape): [string, RegExp] => [shape.what, new RegExp(shape.source, "gi")]),
  ),
];
