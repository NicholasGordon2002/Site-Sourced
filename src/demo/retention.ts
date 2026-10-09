/**
 * Site Sourced — the retention practice we actually operate.
 *
 * The privacy notice may only print what is backed by a recorded fact (WORKFLOW.md
 * standing rule 7; plan revision 13). For *our* behaviour — how often we go through the
 * form account and delete what is in it — the recorded fact is one line in
 * `ops/retention-log.md`, the team file that declares the cadence and logs every pass:
 *
 *     **Declared cadence: `none`** — no timetable.
 *
 * This module reads that declaration, turns it into the sentence the notice prints, and
 * carries the allow-list the guard uses. The rule it enforces is the one the owner set:
 *
 *   **no notice may print a numeric window the declared cadence does not support.**
 *
 * With `none` declared, no window at all is printed, and any number in the operator's
 * half of the retention section fails the build. The three routines that *do* support a
 * number are derived from `research/privacy-wording.md` §2's honest-cadence table:
 *
 *   | routine we run       | the largest honest claim   |
 *   | -------------------- | -------------------------- |
 *   | none                 | (no number)                |
 *   | monthly              | about two months           |
 *   | weekly               | about forty days           |
 *   | every second day     | 30 days                    |
 *
 * The provider's own behaviour is *not* ours and does not live here: it is quoted from
 * `docs/formspark.md` into the provider preset in `forms.ts`, and the notice prints it
 * as its own sentences.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The published form of the routine we run. */
export type RetentionCadence = "none" | "monthly" | "weekly" | "every-second-day";

/**
 * The address a visitor is told to write to, in the two forms a sentence needs it:
 * one at the start of a sentence, one in the middle. Built once so the retention
 * sentence, the choices sentence and the complaints sentence cannot drift apart.
 */
export interface RetentionRoute {
  /** Sentence-initial: `Email privacy@…` or the fallback when there is no address. */
  lead: string;
  /** Mid-sentence, lower-cased: `email privacy@…`. */
  mid: string;
}

export function routeFor(contactEmail: string): RetentionRoute {
  const email = (contactEmail ?? "").trim();
  if (!email) {
    const fallback = "Use the phone number or email address printed on this page";
    return { lead: fallback, mid: "use the phone number or email address printed on this page" };
  }
  return { lead: `Email ${email}`, mid: `email ${email}` };
}

interface CadenceSpec {
  /** The window the notice prints, or "" when no number is honest. */
  window: string;
  /**
   * Every window phrase this routine can support. The guard allows a number in the
   * operator's half of the retention section only if it matches one of these.
   */
  allowed: string[];
  /** What we actually operate, for the audit trail and the manifest. */
  routine: string;
  /** The routine, as a visitor reads it. */
  sentence: (route: RetentionRoute) => string;
  /** What we promise about replying, tied to the same routine. */
  reply: string;
}

export const CADENCES: Record<RetentionCadence, CadenceSpec> = {
  none: {
    window: "",
    allowed: [],
    routine: "nothing scheduled: messages are deleted after we answer them, and on request",
    sentence: (route) => `Messages are deleted when we go through the account, not on a timetable. ${route.lead} and we will delete yours.`,
    reply: "We reply as soon as we can.",
  },
  monthly: {
    window: "about two months",
    allowed: ["about two months", "two months"],
    routine: "one pass per calendar month, plus deletion as soon as a message has been answered",
    sentence: (route) =>
      `We delete your message once we have answered it, and we clear the account at the end of every month, so nothing a visitor sends stays longer than about two months. If you want yours gone sooner, ${route.mid} and we will delete it.`,
    reply: "We reply within 30 days.",
  },
  weekly: {
    window: "about forty days",
    allowed: ["about forty days", "forty days"],
    routine: "one pass per week, plus deletion as soon as a message has been answered",
    sentence: (route) =>
      `We delete your message once we have answered it, and we clear the account every week, so nothing a visitor sends stays longer than about forty days. If you want yours gone sooner, ${route.mid} and we will delete it.`,
    reply: "We reply within 30 days.",
  },
  "every-second-day": {
    // The only routine that keeps a 30-day claim true (research/privacy-wording.md §2).
    window: "30 days",
    allowed: ["30 days", "about 30 days"],
    routine: "one pass every second day, plus deletion as soon as a message has been answered",
    sentence: (route) =>
      `We delete your message once we have answered it, and we clear the account every second day, so nothing a visitor sends stays longer than 30 days. If you want yours gone sooner, ${route.mid} and we will delete it.`,
    reply: "We reply within 30 days.",
  },
};

/** The practice as it was read, with the declaration kept for the audit trail. */
export interface RetentionPractice {
  cadence: RetentionCadence;
  /** The window the notice may print — "" when the routine supports no number. */
  window: string;
  /** What we operate, in plain words, for the manifest and the review. */
  routine: string;
  /** The declaration line, verbatim, so a reader can see where the value came from. */
  declaration: string;
  /** The file the declaration was read from, or "the environment" for an override. */
  source: string;
}

/** The file that declares the operator practice. One value, read by the build. */
export const PRACTICE_FILE = "ops/retention-log.md";

/**
 * Where the declaration is read from.
 *
 * The retention log is a team file that lives beside the repository (it is not part of
 * the delivered product), so the path is `<repo>/../ops/retention-log.md` unless
 * `SS_RETENTION_LOG` names another file. A missing file is not silently ignored: the
 * build fails, because a notice with no recorded practice behind it is exactly the
 * claim the owner's rule forbids.
 */
export function retentionLogPath(): string {
  const override = (process.env.SS_RETENTION_LOG ?? "").trim();
  if (override) return resolve(override);
  return resolve(import.meta.dir, "..", "..", "..", PRACTICE_FILE);
}

/** The declaration line, e.g. `**Declared cadence: `none`** — no timetable.` */
const CADENCE_LINE = /Declared\s+cadence\s*:\s*[`'"]?([A-Za-z][A-Za-z0-9 -]*)[`'"]?/i;

function normaliseCadence(raw: string): RetentionCadence | null {
  const value = raw
    .trim()
    .toLowerCase()
    .replace(/[`'"*._]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+$/, "");
  switch (value) {
    case "none":
    case "no-timetable":
    case "no-schedule":
      return "none";
    case "monthly":
    case "month":
    case "per-month":
      return "monthly";
    case "weekly":
    case "week":
    case "per-week":
      return "weekly";
    case "every-second-day":
    case "every-2-days":
    case "second-day":
    case "every-other-day":
      return "every-second-day";
    default:
      return null;
  }
}

export interface PracticeRead {
  /** The declared practice, or null when the declaration could not be read. */
  practice: RetentionPractice | null;
  /** Why it could not be read, as sentences the build can print. */
  problems: string[];
}

/**
 * Read the declared cadence out of the retention log.
 *
 * Never throws: an unreadable file or an unrecognised cadence comes back as a problem
 * sentence, and the build refuses the bundle rather than composing a notice whose
 * operator half has no recorded fact behind it.
 */
export function readRetentionPractice(path = retentionLogPath()): PracticeRead {
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch (err) {
    return {
      practice: null,
      problems: [
        `the retention practice could not be read from ${path} (${(err as Error).message}). The privacy notice may only state what is backed by a recorded fact (WORKFLOW.md rule 7), so no bundle is built until ${PRACTICE_FILE} is readable. Set SS_RETENTION_LOG to point at it if it lives elsewhere.`,
      ],
    };
  }

  for (const line of text.split("\n")) {
    const match = CADENCE_LINE.exec(line);
    if (!match) continue;
    const cadence = normaliseCadence(match[1] ?? "");
    // The declaration as it will be quoted back — the bolded segment of the line,
    // without the prose that follows it in the log file.
    const declaration = (line.trim().match(/^\*\*(.+?)\*\*/)?.[1] ?? line.trim()).trim();
    if (!cadence) {
      return {
        practice: null,
        problems: [
          `the declared retention cadence in ${path} is not one we can print ("${(match[1] ?? "").trim()}"). Use one of: none, monthly, weekly, every-second-day — the four routines research/privacy-wording.md §2 prices, each with the largest window it honestly supports.`,
        ],
      };
    }
    const spec = CADENCES[cadence];
    return {
      practice: { cadence, window: spec.window, routine: spec.routine, declaration, source: path },
      problems: [],
    };
  }

  return {
    practice: null,
    problems: [
      `${path} declares no retention cadence. The notice's operator half is composed from that one value, so the file must carry a line of the form "Declared cadence: none" before a bundle can be built.`,
    ],
  };
}

/** The declared practice, or null when it cannot be read. For callers that just compose. */
export function currentRetentionPractice(path?: string): RetentionPractice | null {
  return readRetentionPractice(path).practice;
}

/** The sentence the notice prints about our own routine. */
export function practiceSentence(practice: RetentionPractice, route: RetentionRoute): string {
  return CADENCES[practice.cadence].sentence(route);
}

/** What we promise about replying — as soft as the routine we run, never softer. */
export function replyLine(practice: RetentionPractice): string {
  return CADENCES[practice.cadence].reply;
}

/** Every window phrase the declared routine supports. Empty means "no number at all". */
export function allowedWindows(practice: RetentionPractice | null): string[] {
  return practice ? CADENCES[practice.cadence].allowed : [];
}

/* ------------------------------------------------------------------- the guard */

/**
 * Shapes of a retention window, in the words a notice might reach for — **one named
 * shape per pattern**, so the coverage meta-check can prove each of them can still
 * find the kind of window it names (`refusal-coverage.ts`). The `g` flag is
 * load-bearing: the guard reads the notice with `matchAll`.
 */
export const WINDOW_SHAPES: [string, RegExp][] = [
  ['a window counted from now ("within 30 days")', /\bwithin\s+\d+\s+(?:days?|weeks?|months?)\b/gi],
  ['a window stated in days, weeks or months ("30 days")', /\b\d+\s+(?:days?|weeks?|months?)\b/gi],
  ['a window spelled out in words ("thirty days")', /\b(?:one|two|three|four|five|six|thirty|forty|sixty|ninety)\s+(?:days?|weeks?|months?)\b/gi],
  ['an approximate window in months ("about three months")', /\babout\s+(?:two|three|four|forty|thirty|sixty)\s+months?\b/gi],
];

/**
 * The retention half of the owner's rule, as sentences a build can print.
 *
 * Three things are checked against the notice's retention section as it will be read:
 *
 *   1. **The declared practice is printed.** The sentence the retention log supports
 *      must be in the notice; a hand-written replacement cannot pass.
 *   2. **No window the cadence does not support.** Every number of days/weeks/months
 *      outside the provider's own facts must match the declared routine's allow-list —
 *      so with `none` declared, any number at all is a build failure. That is what
 *      makes "within 30 days" impossible to print again without a routine behind it.
 *   3. **No window on a client's behalf.** On a delivered site the account is the
 *      client's, so the notice may print the provider's facts and name the client as
 *      the one who deletes, but never a number (WORKFLOW.md rule 8, client-variant
 *      retention).
 */
export function retentionProblems(vars: {
  /** The retention section's paragraphs, as a visitor will read them. */
  text: string;
  /** The provider's own facts, which do state the provider's windows. */
  providerFacts: string[];
  /** The exact operator sentence the notice is required to print ("" on a client's site). */
  practiceSentence: string;
  practice: RetentionPractice | null;
  mode: "business" | "demo";
  /** The party the notice names as the account holder: the client, or Site Sourced. */
  party: string;
}): string[] {
  const { text, providerFacts, practiceSentence: required, practice, mode, party } = vars;
  const problems: string[] = [];

  if (mode === "demo" && !practice) {
    problems.push(
      "the privacy notice prints an operator practice but no retention cadence was declared, so there is no recorded fact behind the sentence. `ops/retention-log.md` is the single source for what we operate, and the build refuses a notice without it.",
    );
  }

  if (required && !text.includes(required)) {
    problems.push(
      `the privacy notice does not print the sentence the declared retention practice supports (expected it to contain: "${required}"). The operator half of the retention section is composed from ${PRACTICE_FILE} — it is never written by hand, so the page cannot promise a routine we do not run.`,
    );
  }

  // Strip the provider's own sentences first: they state the provider's windows, which
  // are not ours to ground and are checked separately as quoted facts.
  let operator = text;
  for (const fact of providerFacts) {
    if (fact) operator = operator.split(fact).join(" ");
  }

  const allowed = mode === "business" ? [] : allowedWindows(practice);
  const found = new Set<string>();
  for (const [, pattern] of WINDOW_SHAPES) {
    for (const match of operator.matchAll(pattern)) {
      const phrase = (match[0] ?? "").trim().toLowerCase();
      if (!phrase) continue;
      if (allowed.some((a) => a.toLowerCase().includes(phrase) || phrase.includes(a.toLowerCase()))) continue;
      found.add(phrase);
    }
  }
  if (/delete[ds]?\s+within\s+\d/i.test(operator)) {
    found.add("deleted within a number of days");
  }

  if (found.size > 0) {
    const list = [...found].map((f) => `"${f}"`).join(", ");
    problems.push(
      mode === "business"
        ? `the client's privacy notice prints a retention window (${list}). We do not operate the client's form account, so a number there is a claim about their conduct we cannot ground — state the provider's facts, name the client as the one who deletes, and give the visitor the route to ask (WORKFLOW.md rule 8).`
        : `the privacy notice prints a retention window the declared cadence does not support (${list}). The declared routine is "${practice?.cadence ?? "unreadable"}"${
            allowed.length > 0 ? `, which supports only: ${allowed.map((a) => `"${a}"`).join(", ")}` : ", which supports no number at all"
          }. Either run the routine or change the sentence — never the other way round.`,
    );
  }

  if (!/\bdeletes?\b|\bdeletion\b/i.test(text)) {
    problems.push(
      "the privacy notice never says who deletes a stored message, although the form service keeps it until the account holder removes it. A visitor must be able to read who that is.",
    );
  }
  if (mode === "business" && party && !text.includes(party)) {
    problems.push(
      `the client's privacy notice does not name ${party} as the party who holds and deletes the message. The account is theirs, so the notice must say so rather than leaving a visitor to infer it (WORKFLOW.md rule 8).`,
    );
  }

  return problems;
}
