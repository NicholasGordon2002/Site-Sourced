/**
 * Site Sourced — the conversion family: which of the two a build is for, how that was
 * decided, and the words that decision puts out of bounds.
 *
 * One core, two families (business plan; `template-system.md` §2.1):
 *
 *   appointment  the conversion is a *requested time*. The page may ask for one and
 *                may never book one — no availability, no slots, no "confirmed", no
 *                "instant". It says "request", never "book".
 *   inquiry      the conversion is a *described need*. The page may pass on a question
 *                and may never promise a price, a timeline, a visit or a service area.
 *
 * ## How a record gets a family
 *
 * The family is **derived** from what the record already carries, and it can be
 * **overridden** by an explicit `conversion_family` field on the record. Which rule
 * fired is recorded in `manifest.json` (`conversion.basis`) — never left to memory.
 *
 * The classification table is keyed by the category profile in `copy.ts` (`PROFILES[].key`,
 * chosen by `profileFor` from the record's category words) — one table, in one place:
 *
 *   | category profile (`copy.ts`)                                    | family      |
 *   | --------------------------------------------------------------- | ----------- |
 *   | salon (barber, hair, nails, spa, tattoo)                        | appointment |
 *   | dental                                                          | appointment |
 *   | health (clinic, physio, chiro, massage, vet, optic)             | appointment |
 *   | fitness (gym, yoga, pilates, dance, martial)                    | appointment |
 *   | trades (plumber, electrician, carpenter, roofer, mechanic …)    | inquiry     |
 *   | landscaping (garden, lawn, tree, nursery, snow removal)         | inquiry     |
 *   | professional (law, accounting, insurance, real estate…)         | inquiry     |
 *   | retail (shop, store, florist, boutique, pharmacy …)             | inquiry     |
 *   | food (restaurant, cafe, bakery, deli, butcher, coffee …)        | inquiry     |
 *   | general (no category words matched)                             | inquiry     |
 *
 * The reason for each row is the reason in `template-system.md` §2.1: a time-slot
 * service takes a booking and a repeat visit; a job that depends on scope or location
 * starts with a described need. Anything the table does not recognise falls to
 * `general`, whose family is inquiry — the family that promises least.
 *
 * A test asserts that every profile in `copy.ts` has a row here, so a new category
 * profile cannot be added without deciding its family in the same change.
 *
 * ## The honesty guard
 *
 * `familyHonestyProblems` is the build check: it reads the *rendered pages*, splits
 * what a visitor would read into sentences, and refuses a sentence that makes a claim
 * the family may not make. A hit is allowed when
 *
 *   1. the record itself carries the words — a business whose recorded service is
 *      "Book a fitting" or whose record quotes a price is not edited by us (this is the
 *      same allowance `guardCopy` in copy.ts makes, and the positive control the
 *      regression tests use); or
 *   2. the record carries a booking page (`booking_url`), so "book" is a true word
 *      about a link that really books; or
 *   3. the sentence *denies* the claim — "This is a request, not a confirmed booking"
 *      and "Nothing here is booked" are the honest ways to say it, and a guard that
 *      refused them would refuse the copy the rules require.
 *
 * Every failure names the file, the offending sentence and the word, because a build
 * error that does not say what to fix is a build error somebody disables.
 */

import type { BusinessRecord } from "./types.ts";

export type ConversionFamily = "appointment" | "inquiry";

/** The two families, in the order the plan names them. */
export const FAMILIES: readonly ConversionFamily[] = ["appointment", "inquiry"] as const;

export function isConversionFamily(value: unknown): value is ConversionFamily {
  return value === "appointment" || value === "inquiry";
}

/**
 * The classification table: category profile (`copy.ts`) → family. One row per profile,
 * with the reason in the module comment above. `general` is the fallback row.
 */
export const FAMILY_BY_PROFILE: Record<string, ConversionFamily> = {
  salon: "appointment",
  dental: "appointment",
  health: "appointment",
  fitness: "appointment",
  trades: "inquiry",
  landscaping: "inquiry",
  professional: "inquiry",
  retail: "inquiry",
  food: "inquiry",
  general: "inquiry",
};

/** The family a profile the table does not know falls back to: the one that promises least. */
export const FAMILY_FALLBACK: ConversionFamily = "inquiry";

/** Which rule decided the family. The value is what the manifest prints. */
export type FamilySource = "record override" | "category table";

/** The family a build is for, and exactly how that was worked out. */
export interface FamilyResolution {
  family: ConversionFamily;
  source: FamilySource;
  /** Plain English: the rule that fired, for a reviewer reading the manifest. */
  basis: string;
  /** The category profile the record's words selected. */
  category_profile: string;
  /** The category word that selected it, or null when nothing matched. */
  matched_category_word: string | null;
}

/**
 * Derive the family, or take the record's override.
 *
 * `profile` is what `profileMatch(record)` in copy.ts returned — the profile key and the
 * category word that matched it. Passing it in rather than re-deriving it here keeps the
 * category table in one place and the dependency one-way (copy.ts → family.ts).
 *
 * A `conversion_family` value that is neither family is ignored here and reported by
 * `familyProblems`, so the build fails with a message rather than silently building the
 * other family's page.
 */
export function resolveFamily(
  record: BusinessRecord,
  profile: { key: string; matched: string | null },
): FamilyResolution {
  const declared = (record as { conversion_family?: unknown }).conversion_family;
  if (isConversionFamily(declared)) {
    return {
      family: declared,
      source: "record override",
      basis:
        `the record sets conversion_family: "${declared}", which overrides the classification table in src/demo/family.ts ` +
        `(the family is derived, overridable, and the basis is recorded — WORKFLOW.md rule 8).`,
      category_profile: profile.key,
      matched_category_word: profile.matched,
    };
  }

  const mapped = FAMILY_BY_PROFILE[profile.key];
  const family = mapped ?? FAMILY_FALLBACK;
  const cat = record.category || "(no category)";
  const where = record.category_group
    ? `category "${cat}" (group "${record.category_group}")`
    : `category "${cat}"`;
  const basis = mapped
    ? profile.matched
      ? `${where} contains "${profile.matched}", which the "${profile.key}" row of the classification table in src/demo/family.ts maps to the ${family} family.`
      : `the "${profile.key}" row of the classification table in src/demo/family.ts applies to ${where}: the ${family} family.`
    : `no row of the classification table in src/demo/family.ts matched ${where}, so the "${FAMILY_FALLBACK}" fallback applies: the ${family} family.`;

  return {
    family,
    source: "category table",
    basis,
    category_profile: profile.key,
    matched_category_word: profile.matched,
  };
}

/**
 * A malformed override is a build failure, not a fallback. (`resolveFamily` still returns
 * a usable family so the rest of the build can report the real problem alongside any
 * others rather than crashing on the first one.)
 */
export function familyProblems(vars: { record: BusinessRecord; family: ConversionFamily }): string[] {
  const declared = (vars.record as { conversion_family?: unknown }).conversion_family;
  if (declared === undefined || declared === null) return [];
  if (isConversionFamily(declared)) return [];
  return [
    `the record asks for conversion_family ${JSON.stringify(declared)}, which is neither "appointment" nor "inquiry", so the page's conversion cannot be the one the record asked for. ` +
      `The build used the classification table instead (the ${vars.family} family). Fix the record or remove the field.`,
  ];
}

/* ------------------------------------------------------------------ the label */

/**
 * The primary contact label a build carries, and why. Recorded in the manifest.
 *
 * The CTA label and the form's submit label are one decision, not two: on a build from
 * a real business's record they are the same words, and on our own fictional fixture
 * the call to action is the neutral `Contact Us` while the button under the form stays
 * the plain `Send message` (WORKFLOW.md rule 8, owner decision 4 October). Resolved
 * together here so no renderer has to remember the pairing — it renders what this
 * returns, and `submitLabelProblems` fails the build if a page prints anything else.
 */
export interface PrimaryLabel {
  /** The call to action on the hero, the CTA band and the service cards. */
  label: string;
  /** The label on the form's submit button. */
  submit: string;
  /** Which rule chose it: the owner's fictional-fixture decision, or the family. */
  source: "fictional fixture" | "family-aware";
  basis: string;
}

/** The family's own label (WORKFLOW.md rule 8; template-system.md §2.3–§2.4). */
export const FAMILY_LABELS: Record<ConversionFamily, string> = {
  appointment: "Request an appointment",
  inquiry: "Send a message",
};

/**
 * The neutral label the owner chose for our own invented business (4 Oct 2026,
 * WORKFLOW.md rule 8). It is a label, not an exemption: every honesty rule still binds,
 * and the notice naming who receives the message stays under the button.
 */
export const NEUTRAL_CONTACT_LABEL = "Contact Us";

/**
 * The submit button's label on our own fictional fixture: the plainest thing a button
 * that posts a message can say. It is not a family's call to action, because the
 * fixture's page is a sales piece about Site Sourced rather than about a business —
 * but it also makes no claim the page cannot keep, which is why it is `Send message`
 * and never anything that sounds like a booking.
 */
export const NEUTRAL_SUBMIT_LABEL = "Send message";
/** Where a recorded service's own name goes in a service-card action's label. */
export const SERVICE_NAME_SLOT = "{service}";
/**
 * The service card's one action, per family (owner text, 6 October 2026: an action
 * "named for that service"). It is a **template**: the card is a plain panel, and its
 * single action carries the family's own words with the recorded service's name in
 * them — "Request Hot shave" for an appointment, "Ask about Hot shave" for an inquiry.
 *
 * Two reasons the words live here rather than in the renderer. First, they are the
 * family's own: Family A may ask for a time and never book one, Family B may ask about
 * a job and never promise a price, so "Get a quote" is not available to it. Second, the
 * build check (`serviceCardProblems`) composes the label a card must carry from this
 * same function, so the action a visitor reads and the action the gate expects cannot
 * become two different strings.
 */
export const SERVICE_ACTION_LABELS: Record<ConversionFamily, string> = {
  appointment: `Request ${SERVICE_NAME_SLOT}`,
  inquiry: `Ask about ${SERVICE_NAME_SLOT}`,
};
/** The one service card's action label: `Request Hot shave` / `Ask about Hot shave`. */
export function serviceActionLabel(family: ConversionFamily, service: string): string {
  return SERVICE_ACTION_LABELS[family].replace(SERVICE_NAME_SLOT, service);
}

/** Family B's quote-shaped profiles: the ones whose job starts with a described scope. */
const QUOTE_PROFILES = ["trades", "landscaping"];

/**
 * The primary contact label, decided by **where the record came from**, not by the build
 * phase (WORKFLOW.md rule 8, owner decision 4 Oct 2026):
 *
 *   - a fictional fixture (`source_kind: "fictional"`) carries the neutral `Contact Us`,
 *     because our invented business is a sales piece about Site Sourced rather than about
 *     a particular business; its form submit button stays the plain `Send message`;
 *   - a build from a real business's record — a personalised demo for a named prospect,
 *     or a client's own site — carries the family's own label, and for an inquiry the
 *     label that fits the category: `Ask for a quote` where a job is quoted, otherwise
 *     `Send a message`.
 *
 * No variant may print "Book Now" or any booking promise while the build is in
 * `booking: none` mode; that is `familyHonestyProblems`' job, not this function's.
 */
export function resolvePrimaryLabel(
  record: BusinessRecord,
  family: ConversionFamily,
  profileKey: string,
): PrimaryLabel {
  if (record.source_kind === "fictional") {
    return {
      label: NEUTRAL_CONTACT_LABEL,
      submit: NEUTRAL_SUBMIT_LABEL,
      source: "fictional fixture",
      basis:
        `the record is a fictional fixture (source_kind "fictional"), so the primary contact label is the neutral "${NEUTRAL_CONTACT_LABEL}" rather than a family's own call to action: ` +
        `the owner's decision of 4 October is that our invented business is a sales piece about Site Sourced, not about a particular business (WORKFLOW.md rule 8). ` +
        `Its form submit button stays the plain "Send message".`,
    };
  }
  const label =
    family === "appointment"
      ? FAMILY_LABELS.appointment
      : QUOTE_PROFILES.includes(profileKey)
        ? "Ask for a quote"
        : FAMILY_LABELS.inquiry;
  return {
    label,
    submit: label,
    source: "family-aware",
    basis:
      `the record describes a real business (source_kind "${record.source_kind ?? "not declared"}"), so the primary contact label is the ${family} family's own (WORKFLOW.md rule 8; template-system.md §2.3–§2.4)` +
      (family === "inquiry" ? `, chosen for the "${profileKey}" category profile.` : `.`),
  };
}

/* ---------------------------------------------------------- the honesty guard */

/**
 * One thing a family may not say, as a whole-word/phrase pattern.
 *
 * `claim` completes the failure sentence ("the page says … — a page in this family may
 * never <claim>"), and `allowed` says what would have to be true for the words to be
 * allowed, so the message tells the reader how to fix it rather than only that it failed.
 */
export interface FamilyWordRule {
  claim: string;
  pattern: RegExp;
  allowed: string;
}

const RECORD_ALLOWANCE =
  "allowed only where the record itself carries the words (a recorded service is not edited by us) or where the record carries a booking page (`booking_url`) that really books";

/** Family A — appointment. The page requests a time; it never books one. */
export const APPOINTMENT_RULES: FamilyWordRule[] = [
  { claim: "must not book a time", pattern: /\bbook(s|ed|ing|ings)?\b/i, allowed: RECORD_ALLOWANCE },
  { claim: "must not show or claim availability", pattern: /\bavailab(le|ility)\b/i, allowed: RECORD_ALLOWANCE },
  { claim: "must not offer a time slot", pattern: /\bslots?\b/i, allowed: RECORD_ALLOWANCE },
  {
    // "confirmed", "confirming", "confirmation" — not bare "confirm", which the frozen
    // contact-details caveat uses in its ordinary sense ("please confirm them with the
    // business"). A frozen string is never reworded to suit a guard (rule 5).
    claim: "must not claim a confirmed appointment",
    pattern: /\bconfirm(ed|ing|ation)\b/i,
    allowed: RECORD_ALLOWANCE,
  },
  { claim: "must not promise an instant appointment", pattern: /\binstant(ly)?\b/i, allowed: RECORD_ALLOWANCE },
  { claim: "must not promise a same-day appointment", pattern: /\bsame[-\s]?day\b/i, allowed: RECORD_ALLOWANCE },
];

/** Family B — inquiry. The page passes on a question; it promises nothing. */
export const INQUIRY_RULES: FamilyWordRule[] = [
  {
    claim: "must not state or promise a price",
    pattern: /\bprices?\b|\bpricing\b|\bcosts?\b|\bcosting\b/i,
    allowed: "allowed only where the record itself carries the words (a recorded pricing note is printed verbatim, and is the business's own claim)",
  },
  {
    claim: "must not promise a free, fixed or guaranteed price",
    pattern:
      /\bfree (quote|quotes|estimate|estimates|consultation|assessment|call[-\s]?out)\b|\bno[-\s]?obligation\b|\b(guaranteed|fixed|best|lowest) price\b|\bprice match\b|\bcheapest\b|\bdiscount(s|ed)?\b|\bwe'?ll beat\b/i,
    allowed: "allowed only where the record itself carries the words",
  },
  {
    claim: "must not promise a timeline",
    pattern:
      /\bsame[-\s]?day\b|\b24\/7\b|\bwithin (24 hours|48 hours|an hour|the hour|a few hours)\b|\b(reply|replies|respond|responds|response|answer|get back to you|call you back) within\b|\bfast (reply|response|quote)\b|\bquick (reply|response)\b|\bguaranteed turnaround\b|\bturnaround of\b/i,
    allowed: "allowed only where the record itself carries the words",
  },
  {
    claim: "must not promise a visit",
    pattern:
      /\b(site|on[-\s]?site|home|free) visit\b|\bvisit (your|the) (home|property|site)\b|\bwe (come|will come|'ll come|can come)( out)? to you\b|\bwe'?ll come out\b|\bcome out and (quote|price)\b/i,
    allowed: "allowed only where the record itself carries the words",
  },
  {
    claim: "must not claim a service area",
    pattern: /\bservice area\b|\bserving\b|\bwe serve\b|\bwe cover\b|\bcovering\b|\bin and around\b|\bthroughout the (city|region|area)\b/i,
    allowed:
      "allowed only where the record itself carries the words (a recorded service area is printed verbatim, and is the business's own claim)",
  },
];

/** The rules that bind a family. */
export function familyRules(family: ConversionFamily): FamilyWordRule[] {
  return family === "appointment" ? APPOINTMENT_RULES : INQUIRY_RULES;
}

/**
 * A whole-word (or whole-phrase) matcher, so "generated" does not trip "rated" and
 * "booking" does not trip a check for the word "book". Shared with `guardCopy` in
 * copy.ts, which is the same problem.
 */
export function wholeWordPattern(phrase: string): RegExp {
  const escaped = phrase
    .split("")
    .map((ch) => ("\\^$.*+?()[]{}|".includes(ch) ? `\\${ch}` : ch))
    .join("");
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i");
}

/**
 * Does the record itself carry this word or phrase? The positive-control allowance.
 *
 * Two ways the record "carries" a hit:
 *
 *   - the word appears in the record's own prose — a recorded service or a pricing note;
 *   - the hit is the label for a field the record carries (the extras card's "Service
 *     area" label for `service_area`), which is the record's own claim rendered under our
 *     label rather than a claim we invented.
 *
 * The second case exists because field names use underscores while the page's labels use
 * spaces: "service area" never appears verbatim in the record, yet a record carrying
 * `service_area` is precisely the record whose page may print that label.
 */
function recordCarries(record: BusinessRecord, hit: string): boolean {
  if (wholeWordPattern(hit).test(JSON.stringify(record))) return true;
  const key = hit.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return key !== "" && Object.prototype.hasOwnProperty.call(record, key);
}

/**
 * A negation in the words just before a hit: the sentence is *denying* the claim, which
 * is the honest way to say it, not making it.
 */
const DENIAL =
  /\b(not|no|never|nothing|none|neither|nor|cannot|can'?t|isn'?t|aren'?t|doesn'?t|don'?t|won'?t|without)\b/i;

function denies(sentence: string, index: number): boolean {
  return DENIAL.test(sentence.slice(Math.max(0, index - 48), index));
}

/** The entities the pages use, decoded so a reported sentence reads as a visitor sees it. */
const ENTITIES: [RegExp, string][] = [
  [/&amp;/g, "&"],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&apos;/g, "'"],
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
  [/&nbsp;/g, " "],
];

function decodeEntities(text: string): string {
  let out = text;
  for (const [pattern, replacement] of ENTITIES) out = out.replace(pattern, replacement);
  return out;
}

/**
 * What a visitor can read on a page, as sentences.
 *
 * Comments, scripts and styles are dropped — a note in the markup is not a claim. The
 * values of `alt`, `placeholder` and `aria-label` are kept, because a visitor reads them
 * (and a screen reader reads them aloud) exactly like body text.
 */
export function visibleSentences(html: string): string[] {
  const spoken: string[] = [];
  for (const m of html.matchAll(/\b(?:alt|placeholder|aria-label)="([^"]*)"/gi)) {
    if (m[1]!.trim()) spoken.push(m[1]!);
  }
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ");
  const decoded = decodeEntities([...spoken, text].join(" \u2016 "));
  return decoded
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\s*\u2016\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The family honesty check: **the build refuses a page that says what its family may not
 * say.** Run from `complianceChecks` on every rendered page, because compliance is per
 * page and never inherited.
 *
 * Each problem names the file, the sentence a visitor would read, and the word that
 * tripped it (template-system.md checklist #17, WORKFLOW.md rules 3 and 6).
 */
export function familyHonestyProblems(vars: {
  pages: { file: string; html: string }[];
  record: BusinessRecord;
  family: ConversionFamily;
}): string[] {
  const { pages, record, family } = vars;
  const rules = familyRules(family);
  const bookingPage =
    typeof record.booking_url === "string" && record.booking_url.trim() !== "";
  const problems: string[] = [];

  for (const page of pages) {
    for (const sentence of visibleSentences(page.html)) {
      for (const rule of rules) {
        const flags = rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`;
        const pattern = new RegExp(rule.pattern.source, flags);
        let hit: RegExpExecArray | null;
        let refused: string | null = null;
        while ((hit = pattern.exec(sentence)) !== null) {
          if (hit.index === pattern.lastIndex) pattern.lastIndex += 1;
          // The record's own words are never edited by us — that is the positive control.
          if (recordCarries(record, hit[0])) continue;
          // A booking page in the record makes the booking words true about that link.
          if (family === "appointment" && bookingPage) continue;
          // A sentence that denies the claim is the honest way to make it.
          if (denies(sentence, hit.index)) continue;
          refused = hit[0];
          break;
        }
        if (refused) {
          problems.push(
            `${page.file}: the page says "${sentence}" — a page in the ${family} family ${rule.claim} ` +
              `(WORKFLOW.md rule 3; template-system.md §2.${family === "appointment" ? "3" : "4"}). ` +
              `"${refused}" is ${rule.allowed}.`,
          );
          break;
        }
      }
    }
  }
  return problems;
}

/**
 * The label on the page must be the label the build resolved — the check that makes the
 * manifest's `conversion.contact_label` a fact about the bundle rather than a claim about
 * it. Only the call-to-action buttons are compared (`class="button"`), because the same
 * `contact.html` is also a plain nav link whose label is the nav's own.
 */
export function contactLabelProblems(vars: {
  pages: { file: string; html: string }[];
  label: PrimaryLabel;
}): string[] {
  const { pages, label } = vars;
  const problems: string[] = [];
  for (const page of pages) {
    for (const m of page.html.matchAll(
      /<a\b[^>]*class="button[^"]*"[^>]*href="contact\.html[^"]*"[^>]*>([\s\S]*?)<\/a>/g,
    )) {
      const printed = m[1]!.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      if (printed !== label.label) {
        problems.push(
          `${page.file}: the primary action to the contact page prints "${printed}" while the build resolved the label "${label.label}" (${label.source}: ${label.basis}). ` +
            `Every build carries the one label its record decides — edit the label in src/demo/family.ts, not in the template.`,
        );
      }
    }
  }
  return problems;
}

/**
 * The form's submit button prints the label the build resolved, and only that.
 *
 * The submit label is the family's call to action (`Request an appointment` / `Ask for
 * a quote` / `Send a message`) — lead ruling 1 of 30 Sept, which supersedes
 * `template-system.md` §2.4's "Send inquiry" and the old `copy.ui.submit`. On our own
 * fictional fixture it is the plain `Send message` while the call to action stays the
 * neutral `Contact Us`: one decision, two strings, both from `resolvePrimaryLabel`.
 *
 * The check exists because the button is the one place a page could quietly promise
 * something ("Book Now") that the family honesty guard would only catch if the word
 * were already on its list — and because the manifest's `conversion.form.submit_label`
 * has to be a fact about the bundle rather than a note about it.
 */
export function submitLabelProblems(vars: {
  pages: { file: string; html: string }[];
  label: PrimaryLabel;
}): string[] {
  const { pages, label } = vars;
  const problems: string[] = [];
  let seen = 0;
  for (const page of pages) {
    for (const m of page.html.matchAll(/<button\b[^>]*type="submit"[^>]*>([\s\S]*?)<\/button>/g)) {
      seen += 1;
      const printed = m[1]!.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      if (printed !== label.submit) {
        problems.push(
          `${page.file}: the submit button prints "${printed}" while the build resolved "${label.submit}" (${label.source}: ${label.basis}). ` +
            `The button's label is the family's own call to action, resolved in src/demo/family.ts — edit it there, not in the template.`,
        );
      }
    }
  }
  if (seen === 0) {
    problems.push(
      "no rendered page carries a submit button, so the form cannot be submitted at all — the contact page must always carry one.",
    );
  }
  return problems;
}
