/**
 * **Wiring the graphics layer into a demo** — the switch, the decision and the check.
 *
 * `graphics.ts` (S3) builds the layer and proves it: icons, grounds, dividers, the
 * schematic map and the wordmark, all inline or CSS, no file, no request. What it
 * deliberately does not do is *render* anything — no renderer calls `icon()`, and
 * `renderCss()` does not append the layer's rules. This file is the other half: the
 * opt-in that puts the layer on the pages, in the same shape as the two treatments
 * beside it (`DEMO_GHOST_CONTROLS`, `DEMO_SERVICE_CARD_ACTION_BAR`).
 *
 * ## The switch
 *
 * `DEMO_GRAPHICS` is **value-addressed**, exactly like the two above: its value names
 * the treatment, and a value this build cannot read is **refused rather than guessed
 * at**. The accepted spellings are `1`/`true`/`on`/`yes` and the treatment's own names
 * (`layer`, `marks`, `graphics`). The scope is the same one demonstration the button
 * treatments are scoped to — `maple-avenue-barber-shop` — because *one change in front
 * of the owner at a time* is the standing rule: the owner is reviewing the every-button
 * treatment on that demo right now, so the layer goes on beside it, on a branch, and
 * nowhere near a client build. The treatment is also **refused in the delivered phase**:
 * a client's site carries the design the client agreed to, and section marks are a
 * proposal, not part of a signed design.
 *
 * ## What is wired, and what is not
 *
 * A mark is written **beside the label it belongs to** and nowhere else — the layer's own
 * rule (`graphics.ts`, rule 2), which is also why it emits no icon-only control:
 *
 *   - the page head of each inner page carries the page's own mark in its eyebrow
 *     (Services, About, Contact, Privacy) and a divider under the band;
 *   - each service card carries the **services** mark beside its recorded name — the card
 *     shapes themselves are untouched (`service-card-action.ts`), the mark goes inside the
 *     name block both shapes share;
 *   - `Opening hours` carries the **hours** mark, the location heading the **pin**, and the
 *     contact page's location column carries the **schematic map** with `MAP_CAPTION` as
 *     its visible sentence;
 *   - the contact details in the footer/contact block carry the **email** and **phone**
 *     marks beside their own printed lines, and the footer's privacy link the **privacy**
 *     mark;
 *   - the CTA band carries the **message** mark on its heading, and the home page's
 *     `More about {name}` link the **arrow-right**;
 *   - a record with **no hero photograph** gets the layer's `no-photo` ground on the hero
 *     (the hero is already an ink surface with white type, so the arcs and the accent
 *     hairline are an addition and not a repaint).
 *
 * **Not wired, deliberately** (the reasons are the interesting part, and they are in
 * `docs/graphics-wiring.md` beside the measured numbers):
 *
 *   - **the wordmark.** It belongs in the header, and the header's own approved check
 *     refuses it there: `wordmarkLinkProblems` requires the header link to carry the
 *     business's name as **plain text** and nothing else. Replacing the header's name with
 *     a mark is a change to a page signed off on 7 Oct, so it is the owner's call, not
 *     this session's;
 *   - **a mark inside any control.** No icon goes inside a `.button`, the header's action
 *     or a card CTA: those boxes are the ones the owner has already been shown (108×44,
 *     270×44 / 488×44), and an inline mark inside them would move every one of those
 *     numbers. Marks sit beside controls, never in them — and clause 5 below refuses one
 *     that tries;
 *   - **a ground behind a control or behind body text.** The CTA band and the cards are the
 *     surfaces whose contrast was measured for the outlined buttons; a pattern behind them
 *     would move the backdrop under a control the owner is reviewing. `rules`, `grid`,
 *     `arcs` and `stripe` stay unwired for that reason;
 *   - **the `gallery` and `link` marks.** No page renders a Gallery or Socials module, so
 *     the vocabulary does not exist yet. `info` rides the extras card, which is where a
 *     record's own facts already print;
 *   - **any mark for a rating, a price or a review.** The build refuses those modules, and a
 *     mark is not a licence to imply one.
 *
 * ## What it costs
 *
 * **Zero files and zero requests.** Every mark is inline SVG and every rule is CSS; the
 * layer's own byte report carries `"assets": 0, "requests": 0`. What a page gains is
 * markup and stylesheet bytes, per page, measured on the built bundle and printed in
 * `docs/graphics-wiring.md`.
 */
import type { RenderedPage } from "./render.ts";
import { GRAPHICS_VERSION, MAP_CAPTION } from "./graphics.ts";
import type { FormDeliveryMode } from "./types.ts";

/** The configuration switch that turns the layer on. It carries no content. */
export const GRAPHICS_VAR = "DEMO_GRAPHICS";
/**
 * The demonstration it is scoped to — the same Maple Avenue appointment demo the owner's
 * button treatments are being reviewed on. Any other record refuses it.
 */
export const GRAPHICS_SLUG = "maple-avenue-barber-shop";

/**
 * **The marker the wiring declares in the stylesheet**, so the build can see the layer in
 * the CSS it ships instead of trusting that the renderer appended it. It paints nothing —
 * it names the version of the layer that is on the page, which is what the check then
 * verifies against the layer's own rules. A class no other rule in the bundle uses is a
 * marker that cannot go stale by accident.
 */
export const GRAPHICS_MARKER = "--graphics-layer";
/** The class that carries the marker. Nothing in the markup wears it. */
export const GRAPHICS_MARKER_SELECTOR = ".gfx-layer";

/**
 * **The treatment, as the spellings that select it.** The value names the one treatment
 * this build paints — the whole layer, wired at the sites this file's header lists.
 */
export const GRAPHICS_SCOPES: Record<string, "layer"> = {
  "1": "layer",
  true: "layer",
  on: "layer",
  yes: "layer",
  layer: "layer",
  marks: "layer",
  graphics: "layer",
};

/**
 * The source of the wiring, cited where it lives so a reader can check it rather than take
 * our word for it.
 */
export const GRAPHICS_BASIS =
  "the graphics layer (S3, src/demo/graphics.ts, docs/graphics-layer.md) — built and proved on 16–17 Oct 2026 with no wiring into any demo, and the plan's own sequence (S3 → hand-over pack), which puts the layer on the pages before the pack is written";

export interface GraphicsDecision {
  /** Whether this build writes the layer onto the pages and into the stylesheet. */
  enabled: boolean;
  /** The treatment this build knows, when it recognised the value. */
  scope: "layer" | null;
  /** The value the environment carried, verbatim, so a report can quote what was set. */
  raw: string;
  /**
   * The value when it names no treatment this build knows (`null` otherwise). A build that
   * drew the plain pages because it could not read the switch says so here, and the checks
   * refuse it rather than quietly shipping the design nobody asked for.
   */
  unrecognised: string | null;
  /** Why — recorded in the manifest and printed as a warning when it is on. */
  basis: string;
}

/** `DEMO_GRAPHICS` switches the layer on; unset or `0`/`false`/`off` is off. */
export function graphicsRequested(env: Record<string, string | undefined> = process.env): boolean {
  const raw = (env[GRAPHICS_VAR] ?? "").trim().toLowerCase();
  return raw !== "" && raw !== "0" && raw !== "false" && raw !== "off";
}

/**
 * What this build does with the layer, and on what basis — the same shape as
 * `ghostControlsDecision` and `serviceCardActionDecision`, so a reviewer reads one decision
 * the same way in all three places. A refusal is a refusal, not a silent fallback: the basis
 * names which condition failed.
 */
export function graphicsDecision(vars: {
  slug: string;
  phase: FormDeliveryMode;
  env?: Record<string, string | undefined>;
}): GraphicsDecision {
  const env = vars.env ?? process.env;
  const raw = env[GRAPHICS_VAR] ?? "";
  const off = { enabled: false, scope: null as "layer" | null, raw, unrecognised: null as string | null };
  if (!graphicsRequested(env)) {
    return {
      ...off,
      basis: `${GRAPHICS_VAR} is not set in this build, so no page carries a mark, a divider, the schematic map or the no-photograph ground, and the stylesheet carries none of the layer's rules: every fixture and both published demonstrations are the bytes master builds (${GRAPHICS_BASIS}).`,
    };
  }
  const value = raw.trim().toLowerCase();
  const scope = GRAPHICS_SCOPES[value];
  if (!scope) {
    return {
      ...off,
      unrecognised: raw.trim(),
      basis: `refused: ${GRAPHICS_VAR} is set to "${raw.trim()}", which names no treatment this build paints. The accepted values are ${Object.keys(GRAPHICS_SCOPES)
        .map((key) => `"${key}"`)
        .join(", ")}. A switch this build cannot read is refused rather than guessed at — a review copy that shows plain pages while the reviewer asked for the layer is a copy that lies about what it shows (${GRAPHICS_BASIS}).`,
    };
  }
  if (vars.phase === "business") {
    return {
      ...off,
      scope,
      basis: `refused: this bundle is in the delivered phase. The graphics layer is a proposal — section marks, a divider and a schematic map the owner has not signed off — and a client's site carries the design the client agreed to, so ${GRAPHICS_VAR} carries no weight in a client build (${GRAPHICS_BASIS}).`,
    };
  }
  if (vars.slug !== GRAPHICS_SLUG) {
    return {
      ...off,
      scope,
      basis: `refused: the layer is wired into the ${GRAPHICS_SLUG} appointment demonstration, the copy the owner is reviewing. ${GRAPHICS_VAR} is set but this record is "${vars.slug}", so no page and no stylesheet of this bundle moves (${GRAPHICS_BASIS}).`,
    };
  }
  return {
    enabled: true,
    scope,
    raw,
    unrecognised: null,
    basis: `${GRAPHICS_VAR} is set to "${raw.trim()}" and this record is the ${GRAPHICS_SLUG} demonstration, so the pages carry the layer: the page mark in each inner page's eyebrow and a divider under its band, the services mark on each recorded service card, the hours and pin marks on the hours and location headings, the email and phone marks beside the printed details, the privacy mark on the footer's notice link, the message mark on the CTA band, the arrow-right on the home page's "More about" link, the schematic map with its caption in the contact page's location column, and the no-photograph ground on a record with no hero picture. Every mark is inline SVG beside a label it belongs to, so the layer adds no file and no request (${GRAPHICS_BASIS}).`,
  };
}

/**
 * The wiring's own stylesheet block, written into the stylesheet **only** with the opt-in.
 * Two jobs, and nothing else:
 *
 *   - the **marker rule**, which paints nothing: it names the layer's version in one place,
 *     so clause 2 of `graphicsWiringProblems` can read the shipped CSS and see that the
 *     opt-in was honoured, instead of trusting that the renderer appended the layer;
 *   - the **spacing the marks need** and nothing more — the map's caption and the figure it
 *     sits in. Every value is a token from the bundle's own stylesheet, and every selector
 *     is scoped to a `.gfx-` class like the rest of the layer, so this block too cannot
 *     restyle a page that did not ask for it.
 */
export function graphicsWiringCss(): string {
  return `
/* -------------------------------------------------- graphics layer (wired, opt-in)
   The marker rule — it paints nothing and names the layer's version, so the build can see
   in the stylesheet it ships that the opt-in was honoured. ${GRAPHICS_VAR} is unset in the
   repository, so this block is absent from the published stylesheet
   (src/demo/graphics-wiring.ts). */
${GRAPHICS_MARKER_SELECTOR} { ${GRAPHICS_MARKER}: ${GRAPHICS_VERSION}; }
/* The map's figure, in the location column beside the address. The caption is the drawing's
   only carrier of meaning (the drawing itself is aria-hidden), so it is set as small print
   under it rather than as decoration. */
.gfx-map-figure { margin: var(--s-5) 0 0; }
.gfx-map-caption {
  margin: var(--s-2) 0 0;
  max-width: 30rem;
  font-size: var(--fs-small);
  color: var(--muted);
}
`;
}

/** `<svg …>` opening tags in a page, as strings, without their bodies. */
function svgTagsIn(html: string): string[] {
  return html
    .split(/<svg\b/i)
    .slice(1)
    .map((chunk) => chunk.slice(0, chunk.indexOf(">")))
    .filter((tag) => tag.length > 0);
}

/** The class attribute of an opening tag, as written. */
function classOf(tag: string): string {
  return /class="([^"]*)"/i.exec(tag)?.[1] ?? "";
}

/** Every control on a page whose box the owner has already been shown, opening tag first. */
const CONTROL_CLASSES = ["button", "call-button", "service-cta"];

/**
 * What the wiring may never do, as a build check. Runs inside `complianceChecks()`, so a
 * bundle whose pages carry the layer without its opt-in — or whose opt-in painted nothing,
 * or left a mark inside a control — fails the build rather than a review.
 *
 * Takes its pages and the stylesheet as arguments so a test can hand it a doctored bundle
 * and prove each clause fires (`test/graphics.test.ts`; the sweep rows are
 * `gw1-…`/`gw5-…` in `tools/graphics-sweep.ts`).
 */
export function graphicsWiringProblems(vars: {
  pages: RenderedPage[];
  css?: string;
  decision: GraphicsDecision;
}): string[] {
  const problems: string[] = [];
  const { pages, decision } = vars;
  const css = vars.css ?? "";
  const marked = pages.filter((page) => /class="[^"]*\bgfx-[a-z]/.test(page.html));
  const cssCarriesLayer = css.includes(".gfx-icon {") && css.includes(GRAPHICS_MARKER);

  // Clause 0 — the switch names a treatment this build paints. A value it cannot read is
  // refused here rather than warned about: a bundle that painted the plain pages while the
  // reviewer asked for the layer is a review copy that lies about what it shows.
  if (decision.unrecognised !== null) {
    problems.push(
      `${GRAPHICS_VAR} is set to "${decision.unrecognised}", which names no treatment this build paints, so no page carries the layer. The switch is value-addressed: its value names which treatment to write, and a value this build cannot read is refused rather than guessed at. The accepted values are ${Object.keys(
        GRAPHICS_SCOPES,
      )
        .map((key) => `"${key}"`)
        .join(", ")}.`,
    );
  }

  if (!decision.enabled) {
    // Clause 1 — with the switch off, nothing carries the layer: no page and no rule. This is
    // what makes the byte-identity claim checkable rather than a promise about the build.
    for (const page of marked) {
      problems.push(
        `${page.file}: carries a graphics-layer class while ${GRAPHICS_VAR} is not in force for this build. The layer is an opt-in: with the variable unset no page and no stylesheet changes, and every bundle is the copy signed off on 7 Oct 2026, byte for byte. ${decision.basis}`,
      );
    }
    if (css.includes(".gfx-icon {") || css.includes(GRAPHICS_MARKER)) {
      problems.push(
        `the stylesheet this bundle ships carries the graphics layer's rules (${GRAPHICS_MARKER}) while ${GRAPHICS_VAR} is not in force. The layer is an opt-in written into styles.css only with the variable set, so a stylesheet that carries it anyway is the layer smuggled in behind a reviewer's back. ${decision.basis}`,
      );
    }
    return problems;
  }

  // Clause 2 — turned on, the layer is really in the bundle: every page carries at least one
  // mark (the footer's privacy notice mark is on all of them by construction) and the
  // stylesheet carries both the layer's rules and the marker that names it.
  for (const page of pages) {
    if (!marked.includes(page)) {
      problems.push(
        `${page.file}: carries no graphics-layer mark while ${GRAPHICS_VAR} is in force and this record is the ${GRAPHICS_SLUG} demonstration. The switch asked for the layer and the page came out plain — a review copy that does not show what the reviewer asked to see.`,
      );
    }
  }
  if (!cssCarriesLayer) {
    problems.push(
      `the stylesheet this bundle ships carries no graphics layer while ${GRAPHICS_VAR} is set and this record is the ${GRAPHICS_SLUG} demonstration: it needs the layer's own rules (.gfx-icon and the rest) and the marker ${GRAPHICS_MARKER} that says the opt-in was honoured. ${decision.basis}`,
    );
  }

  // Clause 3 — every graphic on a page is marked, and marked one way. `graphicsProblems`
  // clause 2 reads the layer's parts; this reads the pages the layer was actually written
  // into, which is where a hand-edit would land.
  for (const page of pages) {
    for (const tag of svgTagsIn(page.html)) {
      if (!/\bgfx-/.test(classOf(tag))) continue;
      if (!/aria-hidden="true"/i.test(tag) && !/role="img"/i.test(tag)) {
        problems.push(
          `${page.file}: a graphics-layer <svg> carries no marking (class "${classOf(tag)}"). Every mark is either decoration — aria-hidden, with its label beside it — or content, with a real accessible name. A screen reader meets an unmarked drawing as noise.`,
        );
      }
      if (!/focusable="false"/i.test(tag)) {
        problems.push(
          `${page.file}: a graphics-layer <svg> does not carry focusable="false" (class "${classOf(tag)}"), so it is a tab stop in older Edge.`,
        );
      }
    }
  }

  // Clause 4 — the schematic map is decoration with a visible sentence. Its caption is the
  // only carrier of its meaning, so a page that shows the drawing must print the words.
  for (const page of pages) {
    const shows = page.html.includes('class="gfx-map');
    if (shows && !page.html.includes(MAP_CAPTION)) {
      problems.push(
        `${page.file}: carries the schematic map without its caption. The drawing is aria-hidden — it is a plan with no street name, no compass and no scale — so "${MAP_CAPTION}" is the only thing that carries its meaning, and it has to be on the page.`,
      );
    }
  }

  // Clause 5 — no mark inside a control. The measured boxes of every button the owner has been
  // shown (the header action, the CTA band's action, the form's submit, Get directions, the two
  // hero actions, the card CTAs) are the numbers a mark inside them would move.
  for (const page of pages) {
    const controls = [...page.html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map((match) => match[0]!);
    for (const control of controls) {
      const tag = control.slice(0, control.indexOf(">"));
      const classes = classOf(tag).split(/\s+/);
      if (!classes.some((one) => CONTROL_CLASSES.includes(one))) continue;
      if (/\bgfx-/.test(control.slice(control.indexOf(">")))) {
        problems.push(
          `${page.file}: the control "${classOf(tag)}" carries a graphics-layer mark inside it. A mark belongs beside the control, never inside it: the box of every button on this copy has been measured (108×44, 270×44, 488×44) and an inline mark moves it.`,
        );
      }
    }
  }

  return problems;
}
