/**
 * Site Sourced — the meta-check over every list of named refusals.
 *
 * The generator refuses prose and constructs in about a dozen places, always as a list of
 * `[what it is, the pattern that finds it]` pairs. Nothing ever proved that any individual
 * entry could be found. That is the shape that produced the 9 Oct leak: the manifest listed
 * "the demonstration paragraph in the delivered README" as refused, and no pattern in the
 * build matched that paragraph — the claim was true only of the phase ternary in the
 * renderer, and `phaseFurnitureProblems` could not refuse the paragraph at all. An entry
 * whose pattern matches nothing reads exactly like a guard that passes.
 *
 * So each list is registered with **the prose its entries claim to refuse** (or a sample of
 * the construct it names), and this module checks, for every entry:
 *
 *   1. the entry records at least one sample — an entry with nothing to point at cannot be
 *      checked, and is refused here rather than assumed;
 *   2. the entry's own pattern matches at least one of its samples — a pattern that cannot
 *      match the prose it names is a refusal that never fires;
 *   3. the pattern does **not** match a page of ordinary business prose (`NEUTRAL_PROSE`) —
 *      a pattern that matches anything at all would satisfy 2 while refusing
 *      nothing, and is the obvious way to make an unmatched entry look covered.
 *
 * It is a **class** check, not an instance check: it iterates whatever is registered, so a
 * new list of refusals is covered the moment it is registered, and
 * `test/refusal-coverage.test.ts` additionally refuses a list that exists in the source and
 * is *not* registered (or exempted with a written reason). Adding a named refusal without a
 * matchable pattern fails the suite.
 *
 * This module deliberately imports nothing: it is the checker, the lists are the data, and
 * where the data lives (the demo generator) changes without touching this file.
 */

/** One named refusal: what it is, the pattern that must find it, and prose it must find. */
export interface NamedPattern {
  /** The name the refusal message uses — `carries ${what}`. */
  what: string;
  /** The pattern that is supposed to refuse it. */
  pattern: RegExp;
  /**
   * The prose this entry claims to refuse, at least one line of it. For a list whose
   * patterns refuse our own composed sentences, the samples are those sentences (the test
   * checks each one is really on a built page or in the README); for a list that names a
   * construct (`a cookie`, `an @import`), the sample is an instance of the construct.
   */
  samples: readonly string[];
}

/** A list of named refusals, as the build declares and uses it. */
export interface RefusalList {
  /** Where the list is declared — `the const the check reads`, for a reader who must find it. */
  source: string;
  /** What the list refuses, one line. */
  refuses: string;
  entries: readonly NamedPattern[];
}

/**
 * Ordinary business prose: what a page may say with nothing refused on it.
 *
 * Deliberately plain and short. It must not contain a demonstration's sentence, a sourcing
 * claim, a placeholder, a retention window, a banned phrase, a family-rule word or a CSS/JS
 * construct — a pattern that fires on *this* fires on a page nobody has anything to answer
 * for, which is the definition of a refusal that refuses nothing. The check reports any
 * pattern that matches it, so this text is also the specification of what each list does not
 * cover.
 */
export const NEUTRAL_PROSE: readonly string[] = [
  "Maple Avenue Barber Shop is a barber shop in Hamilton, Ontario. We cut hair, trim beards and shave. " +
    "Our opening times are listed below. Come in, or write to us with your question and we will answer it.",
];

/** Does this pattern match this text? `g` patterns carry state, so it is reset either side. */
export function matches(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  const hit = pattern.test(text);
  pattern.lastIndex = 0;
  return hit;
}

/** A short, readable excerpt of a sample for a failure message. */
function clip(text: string, max = 90): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * The whole meta-check: every registered entry must have prose its pattern can refuse, and
 * no pattern may refuse ordinary prose. Returns refusal messages, one per entry at fault —
 * each naming the entry, so a new list entry that nothing can find is not a silent pass.
 */
export function refusalCoverageProblems(lists: readonly RefusalList[]): string[] {
  const problems: string[] = [];
  if (lists.length === 0) {
    problems.push(
      "no list of named refusals is registered, so nothing checks that any of them can fire. " +
        "Every refusal list this build reads belongs in the registry the coverage check iterates `(src/demo/build.ts, REFUSAL_LISTS)`.",
    );
    return problems;
  }
  let entries = 0;
  for (const list of lists) {
    if (list.entries.length === 0) {
      problems.push(
        `${list.source} is registered as a list of named refusals but has no entries: either it lost them, or the registry points at the wrong declaration.`,
      );
    }
    for (const entry of list.entries) {
      entries += 1;
      const on = `${list.source} names "${entry.what}"`;
      if (entry.samples.length === 0) {
        problems.push(
          `${on} but records no sample of the prose or construct it refuses, so nothing proves its pattern ${entry.pattern} can refuse it. ` +
            `Add the sample to the registry (\`REFUSAL_SAMPLES\` beside REFUSAL_LISTS): an entry nothing can be checked against is a refusal nobody can rely on.`,
        );
        continue;
      }
      if (!entry.samples.some((sample) => matches(entry.pattern, sample))) {
        problems.push(
          `${on} but its pattern ${entry.pattern} cannot refuse it: it matches none of the prose recorded for it (${entry.samples
            .map((sample) => `"${clip(sample)}"`)
            .join(", ")}). The refusal is a no-op — this is the leak class the coverage check exists for (a manifest entry claiming a refusal no pattern performs).`,
        );
      }
      for (const control of NEUTRAL_PROSE) {
        if (matches(entry.pattern, control)) {
          problems.push(
            `${on} and its pattern ${entry.pattern} also matches ordinary page prose that carries none of it ("${clip(control)}"). ` +
              `A pattern that matches anything refuses nothing: narrow it to the words or the construct the entry names.`,
          );
        }
      }
    }
  }
  if (entries === 0) {
    problems.push(
      "every registered list of named refusals is empty. The lists are the data this check reads; an empty registry makes the whole meta-check vacuous.",
    );
  }
  return problems;
}

/**
 * A manifest's own claim, checked against the lists behind it.
 *
 * `MANIFEST_PHASE_REFUSED` is the sentence the bundle carries about itself: "the business
 * phase refuses these things". It is derived from the phase lists, and this is what makes
 * that derivation enforced rather than intended — **every entry in the manifest must be a
 * named refusal in one of the lists** (so the manifest cannot list a thing no pattern
 * refuses, which is exactly what it did until 9 Oct), and **every entry in those lists must
 * appear in the manifest** (so a list cannot grow a refusal the manifest never mentions).
 */
export function manifestClaimProblems(vars: {
  /** How the manifest is reached in a failure message, e.g. `MANIFEST_PHASE_REFUSED`. */
  claim: string;
  /** The manifest's list, as the bundle carries it. */
  manifest: readonly string[];
  /** The lists the manifest claims to be derived from. */
  lists: readonly RefusalList[];
}): string[] {
  const { claim, manifest, lists } = vars;
  const problems: string[] = [];
  const backed = new Map<string, string>();
  for (const list of lists) for (const entry of list.entries) backed.set(entry.what, list.source);
  for (const what of manifest) {
    if (!backed.has(what)) {
      problems.push(
        `${claim} lists "${what}" as refused, but no registered refusal list names it: there is no pattern that refuses it, so the manifest is claiming a guard that does not exist. ` +
          `Either add the entry (with the prose it refuses) to the list that enforces it, or take it out of the manifest.`,
      );
    }
  }
  for (const [what, source] of backed) {
    if (!manifest.includes(what)) {
      problems.push(
        `${source} refuses "${what}" but ${claim} does not list it, so a bundle reading its own manifest is not told about a refusal its pages are held to. The manifest is derived from the lists; add it there or drop the entry.`,
      );
    }
  }
  return problems;
}
