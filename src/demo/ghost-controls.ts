/**
 * **The ghost controls** — the owner's second button treatment, tried on the one review
 * copy and off everywhere else (owner direction by text, 10 Oct 2026):
 *
 *   1. **the header action** — transparent (no fill), with white text and a white outline
 *      instead of the filled pill it wears today;
 *   2. **the nested service-card CTA** — the same treatment with black text and a black
 *      outline.
 *
 * ## One system: the outline follows the surface
 *
 * The two controls ask for the same thing, so they are one treatment with one rule: **the
 * ghost is drawn in the colour of the surface it sits on**. That is not a style preference,
 * it is the only way the request survives the page's own contrast reality (the lead's
 * ruling, 10 Oct 2026 — handle it, do not paper over it):
 *
 *   - the header sits **over the hero photograph** on the home page alone
 *     (`page--index`, the scrim measured at 6.0:1 for white text over pure white), so
 *     there the ghost is **white**: white text, white outline, no fill;
 *   - on **every other page** the header sits on `var(--paper)` — pure white. White text
 *     or a white outline there is 1.00:1, invisible. So on paper the same ghost is drawn
 *     in **ink** (`var(--ink)`), and it clears 4.5:1 for its text and 3:1 for its outline
 *     against that surface (`ghostControlsProblems` measures both, off the stylesheet the
 *     bundle ships).
 *   - the **service card's CTA** sits on the card's own paper surface, so it is the ink
 *     ghost. It is the same treatment as the paper header's, written in the card's own
 *     block (`service-card-action.ts`), and it takes its colours from this module so the
 *     two cannot drift.
 *
 * ## Why this is CSS only — and why every page stays byte-identical
 *
 * Nothing about the treatment is markup: the header's action is the same
 * `<a class="call-button header-action">` it has always been, and the nested CTA is the
 * same `<a class="service-cta">`. The whole treatment is a **stylesheet** treatment, so:
 *
 *   1. it changes **one file** (`styles.css`) and no page of any bundle;
 *   2. with `DEMO_GHOST_CONTROLS` unset, `renderCss` writes the stylesheet it writes today,
 *      byte for byte, and no page moves either — so the four fixtures are identical to a
 *      build from `master` (`docs/ghost-controls.md` carries the before/after diff table);
 *   3. a stylesheet that carries the treatment without the opt-in is refused by name
 *      (`ghostControlsProblems` clause 1), and so is an opt-in that painted nothing
 *      (clause 2) — the switch cannot be ignored and the treatment cannot be smuggled in.
 *
 * ## The opt-in
 *
 * Shaped exactly like `DEMO_SERVICE_CARD_ACTION_BAR` (`service-card-action.ts`): the
 * variable is **value-addressed** — its value names the treatment, not just "on" — and a
 * value this build cannot read is **refused rather than guessed at**, because rendering the
 * filled buttons while a reviewer asked for the ghost is a review copy that lies about what
 * it shows. The accepted spellings are `1`/`true`/`on`/`yes` and the treatment's own names
 * (`ghost`, `surface`, `follow-surface`); **anything else is refused**, including values
 * that name a *different* resolution of the contrast problem:
 *
 *   - `white` — a white ghost on every header. **Not accepted, and not built.** Over the
 *     paper headers it is text and outline at **1.00:1**; the lead's brief of 10 Oct asked
 *     for that number in this report rather than for the variant.
 *   - `dark` — the other honest resolution the brief named: the inner-page headers painted
 *     dark so they can carry white. **Not accepted, and not built**: it is a change to the
 *     signed-off inner-page design, and the choice is the owner's. `docs/ghost-controls.md`
 *     states it with the number it would need.
 *
 * The treatment is refused in the **delivered phase** and on every other record: a client's
 * site carries the design the client agreed to, and a review treatment is not part of it.
 */
import type { FormDeliveryMode } from "./types.ts";

/** The configuration switch that opts the treatment in. It carries no content. */
export const GHOST_CONTROLS_VAR = "DEMO_GHOST_CONTROLS";
/**
 * The demonstration it is scoped to — the same Maple Avenue appointment demo the owner's
 * booking comparison and nested-CTA direction are scoped to. Any other record refuses it.
 */
export const GHOST_CONTROLS_SLUG = "maple-avenue-barber-shop";

/**
 * **The marker the treatment declares in the stylesheet**: a custom property only this
 * block writes, so the build can see its own treatment in the CSS it ships instead of
 * trusting that the renderer wrote it. It paints nothing — it names the surface the ghost
 * was drawn for, which is the one claim the check then verifies against the colours beside
 * it. A custom property no other rule in the bundle uses is a marker that cannot go stale
 * by accident.
 */
export const GHOST_CONTROLS_MARKER = "--ghost-control";
/** The two surfaces a ghost can be drawn for, as the marker's own values. */
export const GHOST_SURFACE_INK = "ink";
export const GHOST_SURFACE_WHITE = "white";

/**
 * **The treatment, as the spellings that select it.** The value names the treatment this
 * build knows — `follow-surface`, the one resolution of the contrast problem that is built
 * — and every spelling here means that one treatment. A value that names a different
 * treatment is refused (`docs/ghost-controls.md` names the two that are deliberately not
 * built and the numbers that decided it).
 */
export const GHOST_CONTROLS_SURFACES: Record<string, "follow-surface"> = {
  "1": "follow-surface",
  true: "follow-surface",
  on: "follow-surface",
  yes: "follow-surface",
  ghost: "follow-surface",
  surface: "follow-surface",
  "follow-surface": "follow-surface",
  "outline-follows-surface": "follow-surface",
};

/** The paper-surface ghost's ink: the design system's own ink token, used by both controls. */
export const GHOST_PAPER_INK = "var(--ink)";
/**
 * The paper-surface ghost's hover and active fills: a wash of that same ink, never a light
 * veil. A light fill lowers the *dark* text's contrast and, on the photograph, lowers white
 * text's — the one thing a ghost must not do (`ghostControlsProblems` clause 4).
 */
export const GHOST_PAPER_FILL_HOVER = "rgba(22, 24, 27, .08)";
export const GHOST_PAPER_FILL_ACTIVE = "rgba(22, 24, 27, .16)";
/** The photograph-surface ghost: white, and the ink wash it deepens by. */
export const GHOST_SCRIM_COLOUR = "#fff";
export const GHOST_SCRIM_FILL_HOVER = "rgba(10, 12, 14, .18)";
export const GHOST_SCRIM_FILL_ACTIVE = "rgba(10, 12, 14, .34)";

/** The header action's own selectors, the two surfaces apart. */
export const GHOST_HEADER_ACTION_SELECTOR = ".site-header .call-button";
export const GHOST_HOME_ACTION_SELECTOR = ".page--index .site-header .call-button";

/**
 * The source of the treatment, cited where it lives so a reader can check it rather than
 * take our word for it.
 */
export const GHOST_CONTROLS_BASIS =
  "the owner's direction of 10 Oct 2026 (the header action transparent with white text and a white outline; the nested service-card CTA the same treatment with black text and a black outline) and the lead's ruling of 10 Oct 2026 (one system: the outline colour follows the surface — white over the photograph, ink on paper — because white on paper is 1.00:1)";

export interface GhostControlsDecision {
  /** Whether this build paints the ghost controls. */
  enabled: boolean;
  /** The treatment this build knows, when it recognised the value. */
  surface: "follow-surface" | null;
  /** The value the environment carried, verbatim, so a report can quote what was set. */
  raw: string;
  /**
   * The value when it names no treatment this build knows (`null` otherwise). A build that
   * painted the filled buttons because it could not read the switch says so here, and the
   * checks refuse it rather than quietly shipping the design nobody asked for.
   */
  unrecognised: string | null;
  /** Why — recorded in the manifest and printed as a warning when it is on. */
  basis: string;
}

/** `DEMO_GHOST_CONTROLS` switches the treatment on; unset or `0`/`false`/`off` is off. */
export function ghostControlsRequested(env: Record<string, string | undefined> = process.env): boolean {
  const raw = (env[GHOST_CONTROLS_VAR] ?? "").trim().toLowerCase();
  return raw !== "" && raw !== "0" && raw !== "false" && raw !== "off";
}

/**
 * What this build does with the treatment, and on what basis — the same shape as
 * `serviceCardActionDecision` and `comparisonDecision`, so a reviewer reads one decision the
 * same way in all three places. A refusal is a refusal, not a silent fallback: the basis
 * names which condition failed.
 */
export function ghostControlsDecision(vars: {
  slug: string;
  phase: FormDeliveryMode;
  env?: Record<string, string | undefined>;
}): GhostControlsDecision {
  const env = vars.env ?? process.env;
  const raw = env[GHOST_CONTROLS_VAR] ?? "";
  const off = { enabled: false, surface: null as "follow-surface" | null, raw, unrecognised: null as string | null };
  if (!ghostControlsRequested(env)) {
    return {
      ...off,
      basis: `${GHOST_CONTROLS_VAR} is not set in this build, so the header action and the nested card CTA wear the filled buttons they wear today: both published demonstrations and all four fixtures are unchanged, byte for byte (${GHOST_CONTROLS_BASIS}).`,
    };
  }
  const value = raw.trim().toLowerCase();
  const surface = GHOST_CONTROLS_SURFACES[value];
  if (!surface) {
    return {
      ...off,
      unrecognised: raw.trim(),
      basis: `refused: ${GHOST_CONTROLS_VAR} is set to "${raw.trim()}", which names no treatment this build knows. The accepted values are ${Object.keys(GHOST_CONTROLS_SURFACES)
        .map((key) => `"${key}"`)
        .join(", ")}. A switch this build cannot read is refused rather than guessed at, and "${raw.trim()}" names a treatment this build deliberately does not paint: a white ghost on every header is 1.00:1 on the paper-surfaced pages, and dark inner-page headers are a design change the owner has not asked for (${GHOST_CONTROLS_BASIS}).`,
    };
  }
  if (vars.phase === "business") {
    return {
      ...off,
      surface,
      basis: `refused: this bundle is in the delivered phase. The ghost treatment is a review treatment for the owner, tried on the demonstration's review copy — it is not part of the design a client has agreed to, and ${GHOST_CONTROLS_VAR} carries no weight in a client build (${GHOST_CONTROLS_BASIS}).`,
    };
  }
  if (vars.slug !== GHOST_CONTROLS_SLUG) {
    return {
      ...off,
      surface,
      basis: `refused: the ghost treatment is scoped to the ${GHOST_CONTROLS_SLUG} appointment demonstration. ${GHOST_CONTROLS_VAR} is set but this record is "${vars.slug}", so the stylesheet this bundle ships is unchanged (${GHOST_CONTROLS_BASIS}).`,
    };
  }
  return {
    enabled: true,
    surface,
    raw,
    unrecognised: null,
    basis: `${GHOST_CONTROLS_VAR} is set to "${raw.trim()}" and this record is the ${GHOST_CONTROLS_SLUG} demonstration, so the stylesheet carries the ghost controls: the header action is transparent with an outline in the surface's own colour (white over the home page's photograph, ink on the paper-surfaced headers), and the nested service-card CTA is the same treatment in ink on the card. No page changes at all — the treatment is written in styles.css alone (${GHOST_CONTROLS_BASIS}).`,
  };
}

/**
 * The treatment's CSS, appended to the stylesheet **only** when the opt-in is set, so the
 * off-state `styles.css` is the published one byte for byte.
 *
 * Every colour is the bundle's own: `var(--ink)` (the design system's ink), white (what the
 * home header's type already is), and washes mixed from the two inks the site already
 * paints with — `rgba(22, 24, 27, …)` for the ink the buttons use, `rgba(10, 12, 14, …)` for
 * the hero's own scrim ink. No new colour, size, radius or breakpoint: the geometry of both
 * controls is untouched, so the boxes are the ones already measured (44px tall, the header's
 * own padding, the card CTA's full width) and only the paint changes.
 *
 * The rule order matters and is the cascade the treatment relies on: the paper-surface rule
 * is written first, the photograph-surface rule second at one class more specific, so the
 * home page's ghost is white even though every page's header wears the same classes.
 *
 * `box-shadow: inset 0 0 0 1px …` is how a state shows a heavier outline without moving a
 * pixel: a `border-width: 2px` would grow the control's box by 2px, and the 44px floor and
 * the measured thumb target are worth more than the half-pixel of extra line.
 */
export function ghostControlsCss(): string {
  return `
/* ------------------------------------------------ ghost controls (review treatment)
   The owner's direction by text, 10 Oct 2026: the header action transparent with white
   text and a white outline, and the nested service-card CTA the same treatment in black.
   One system, from the lead's ruling the same day: the ghost is drawn in the colour of the
   surface it sits on, because white text or a white outline on a paper-surfaced header is
   1.00:1 — invisible. So the outline follows the surface: white over the home page's
   photograph, ink on every other page's header. ${GHOST_CONTROLS_VAR} is unset in the
   repository, so this block is absent from the published stylesheet: it is written only for
   a build that opts in (src/demo/ghost-controls.ts). */
${GHOST_HEADER_ACTION_SELECTOR} {
  ${GHOST_CONTROLS_MARKER}: ${GHOST_SURFACE_INK};
  background: transparent;
  color: ${GHOST_PAPER_INK};
  border-color: ${GHOST_PAPER_INK};
}
/* The states deepen the ink rather than lightening the surface: a light veil on hover would
   drop the *text's* contrast, which is the one thing a ghost cannot afford. The inset ring
   doubles the outline to 2px without touching the control's box. */
${GHOST_HEADER_ACTION_SELECTOR}:hover {
  background: ${GHOST_PAPER_FILL_HOVER};
  box-shadow: inset 0 0 0 1px ${GHOST_PAPER_INK};
}
${GHOST_HEADER_ACTION_SELECTOR}:active {
  background: ${GHOST_PAPER_FILL_ACTIVE};
  box-shadow: inset 0 0 0 1px ${GHOST_PAPER_INK};
}
/* The home page alone: the header sits on the hero photograph's scrim, so the same ghost is
   white. One class more specific than the rule above, so the cascade picks it here. */
${GHOST_HOME_ACTION_SELECTOR} {
  ${GHOST_CONTROLS_MARKER}: ${GHOST_SURFACE_WHITE};
  background: transparent;
  color: ${GHOST_SCRIM_COLOUR};
  border-color: ${GHOST_SCRIM_COLOUR};
}
${GHOST_HOME_ACTION_SELECTOR}:hover {
  background: ${GHOST_SCRIM_FILL_HOVER};
  box-shadow: inset 0 0 0 1px ${GHOST_SCRIM_COLOUR};
}
${GHOST_HOME_ACTION_SELECTOR}:active {
  background: ${GHOST_SCRIM_FILL_ACTIVE};
  box-shadow: inset 0 0 0 1px ${GHOST_SCRIM_COLOUR};
}
`;
}
