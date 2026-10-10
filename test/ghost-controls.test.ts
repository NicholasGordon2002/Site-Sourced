#!/usr/bin/env bun
/**
 * **The ghost controls** — the owner's second button treatment, tried on the one review copy
 * and refused everywhere else (owner direction by text, 10 Oct 2026; the treatment itself is
 * `src/demo/ghost-controls.ts`, and the gate is `ghostControlsProblems` in `src/demo/build.ts`
 * plus clause 6 of `headerOverlayProblems`).
 *
 *   bun test test/ghost-controls.test.ts
 *
 * The gate was doctor-proved by hand when it was written (`docs/ghost-controls.md` … which is
 * **not in this repository** — see the note at the foot of this file). A named refusal with no
 * test is the rot this team's rules exist to prevent (WORKFLOW.md rule 6), so this file is the
 * regression: one test per clause, each with the doctored input that makes it fire, never only
 * a happy path.
 *
 *   1. the opt-in, both directions — a stylesheet carrying the marker while
 *      `DEMO_GHOST_CONTROLS` is unset is refused, and an opt-in whose build wrote the filled
 *      buttons is refused;
 *   2. a switch value this build cannot read is refused rather than guessed at, and the refusal
 *      names every value it accepts;
 *   3. the delivered phase refuses the treatment outright, whatever the switch says;
 *   4. every record except the one the treatment is scoped to refuses it;
 *   5. the surfaces are scoped — a `white` ghost outside `.page--index`, an `ink` ghost inside
 *      it, and a build that paints only one of the two surfaces are each refused;
 *   6. a fill at rest and a light state fill are refused — a light fill behind white text is
 *      the one thing the treatment must never do;
 *   7. a page carrying the marker is refused: the treatment is stylesheet-only, and a page that
 *      moved is a page that stopped being the copy signed off on 7 Oct 2026;
 *   8. the nested CTA's own refusals, inside the nested card shape: a fill, a light outline, and
 *      an outline colour that does not match the surface it claims;
 *   9. **clause 6** (added in `ea47016`, after the first draft shipped unreadable hover and
 *      active states on the photograph): a state rule that leaves its own `color` to the
 *      cascade is refused — proved the way it was found, by building the **pre-fix**
 *      `ghost-controls.ts` against this `build.ts`, and then by removing only the home header's
 *      hover `color` and showing exactly one problem.
 *
 * Three habits this file keeps, because each was a real defect in a sibling check:
 *
 *   - **every expectation is a literal written here**, never a value derived by calling the
 *     function the page's own value came from (a check that asks the producer what it meant
 *     agrees with a broken producer); `ACCEPTED_VALUES` and `SURFACES` below are stated, and
 *     asserted against the module's own tables so the two have to be moved together;
 *   - **every doctor asserts that it doctored**: `doctor()` fails if the substitution matched
 *     nothing, so a reformat of the stylesheet cannot leave a test that passes by measuring the
 *     un-doctored input;
 *   - **the harness is checked against the build's own writer**: `stylesheet()` re-composes the
 *     stylesheet the way `renderCss` does (base, then the card block, then the ghost block) and
 *     one test asserts the result equals `renderCss(…, { serviceCardAction, ghostControls })`
 *     byte for byte — otherwise every doctor below measures a stylesheet no build ever writes.
 *
 * No filesystem writes, no network. The records read are the repository's own fixtures.
 */
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ghostControlsProblems, headerOverlayProblems, resolveBuildParts } from "../src/demo/build.ts";
import { composePrivacy, profileFor } from "../src/demo/copy.ts";
import {
  GHOST_CONTROLS_MARKER,
  GHOST_CONTROLS_SLUG,
  GHOST_CONTROLS_SURFACES,
  GHOST_CONTROLS_VAR,
  GHOST_SURFACE_INK,
  GHOST_SURFACE_WHITE,
  ghostControlsCss,
  ghostControlsDecision,
  type GhostControlsDecision,
} from "../src/demo/ghost-controls.ts";
import { renderCss, renderPages, type RenderContext, type RenderedPage } from "../src/demo/render.ts";
import {
  SERVICE_CARD_ACTION_VAR,
  serviceCardActionCss,
  serviceCardActionDecision,
  type ServiceCardShape,
} from "../src/demo/service-card-action.ts";
import type { BusinessRecord, FormDeliveryMode } from "../src/demo/types.ts";

const FIXTURES = join(import.meta.dir, "fixtures");
const record = (slug: string): BusinessRecord =>
  JSON.parse(readFileSync(join(FIXTURES, `${slug}.json`), "utf8")) as BusinessRecord;

/** The one record the treatment is scoped to, plus the other three demonstration fixtures. */
const MAPLE = record(GHOST_CONTROLS_SLUG);
const OTHER_SLUGS = readdirSync(FIXTURES)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""))
  .filter((slug) => slug !== GHOST_CONTROLS_SLUG)
  .sort();

/**
 * **The accepted spellings, stated here** rather than read off `GHOST_CONTROLS_SURFACES`:
 * a list derived from the module under test would agree with whatever the module says next.
 * The last assertion of clause 2 ties the two together, so adding a spelling to the module
 * without stating it here fails this file — the friction is the point.
 */
const ACCEPTED_VALUES = ["1", "true", "on", "yes", "ghost", "surface", "follow-surface", "outline-follows-surface"];
/** The two surfaces, likewise stated: the values `--ghost-control` may claim. */
const SURFACES = [GHOST_SURFACE_INK, GHOST_SURFACE_WHITE];

const INK_RULE = `.site-header .call-button`;
const HOME_RULE = `.page--index .site-header .call-button`;

interface Built {
  record: BusinessRecord;
  slug: string;
  pages: RenderedPage[];
  /** The stylesheet `renderCss` writes for this build — the one the bundle ships. */
  css: string;
  cardCss: string;
  decision: GhostControlsDecision;
}

/**
 * The stylesheet, composed the way `renderCss` composes it: the base sheet, then the card
 * shape's block, then the ghost's block. A doctor replaces one of those two blocks, which is
 * why they are separate strings here — doctoring the assembled stylesheet by string overlap
 * would edit the base sheet's own `.call-button` rules by accident.
 */
function stylesheet(opts: { cardShape?: ServiceCardShape; ghost?: boolean | string } = {}): {
  css: string;
  base: string;
  card: string;
  ghost: string;
} {
  const base = renderCss(profileFor(MAPLE), GHOST_CONTROLS_SLUG, {});
  const card = opts.cardShape ? serviceCardActionCss(opts.cardShape) : "";
  const ghost = opts.ghost === true ? ghostControlsCss() : typeof opts.ghost === "string" ? opts.ghost : "";
  return { css: base + card + ghost, base, card, ghost };
}

/**
 * Render every page and write every stylesheet of a build, with the switch carrying `value`
 * (`false` = the variable is absent, exactly as the repository has it) on `record`.
 */
function build(opts: {
  value?: string | false;
  env?: Record<string, string | undefined>;
  record?: BusinessRecord;
  slug?: string;
  phase?: FormDeliveryMode;
  cardShape?: ServiceCardShape;
} = {}): Built {
  const source = opts.record ?? MAPLE;
  const slug = opts.slug ?? source.slug ?? GHOST_CONTROLS_SLUG;
  const env = opts.env ?? (opts.value === false || opts.value === undefined ? {} : { [GHOST_CONTROLS_VAR]: opts.value });
  const phase = opts.phase ?? "demo";
  const decision = ghostControlsDecision({ slug, phase, env });
  const card = opts.cardShape
    ? serviceCardActionDecision({ slug: source.slug ?? slug, phase, env: { [SERVICE_CARD_ACTION_VAR]: opts.cardShape } })
    : null;
  const { form, delivery, copy } = resolveBuildParts(source, slug);
  const ctx: RenderContext = {
    record: source,
    copy,
    profile: profileFor(source),
    form,
    delivery,
    privacy: composePrivacy(source, form, delivery),
    images: [],
    slug,
    generatedAt: "2026-10-10T00:00:00.000Z",
    ...(card?.enabled ? { serviceCardAction: card } : {}),
  };
  return {
    record: source,
    slug,
    pages: renderPages(ctx),
    // The stylesheet this build really ships, composed by the build's own writer.
    css: renderCss(profileFor(source), slug, {
      ...(card?.enabled ? { serviceCardAction: card.shape } : {}),
      ...(decision.enabled ? { ghostControls: true } : {}),
    }),
    cardCss: opts.cardShape ? serviceCardActionCss(opts.cardShape) : "",
    decision,
  };
}

/** The gate, over the pages and the stylesheet a build ships — or over doctored ones. */
const list = (built: Built, over: { css?: string; pages?: RenderedPage[] } = {}): string[] =>
  ghostControlsProblems({ pages: over.pages ?? built.pages, css: over.css ?? built.css, decision: built.decision });
/** The same, as one string: the way a refusal reaches a log. */
const refusal = (built: Built, over: { css?: string; pages?: RenderedPage[] } = {}): string =>
  list(built, over).join(" | ");

/** Replace `re` with `to`, and fail if it matched nothing. */
function doctor(text: string, re: RegExp, to: string): string {
  const out = text.replace(re, to);
  expect(out).not.toBe(text);
  return out;
}

/** A page carrying the treatment's marker, as the marker would arrive in markup. */
const marked = (built: Built, file: string): RenderedPage[] =>
  built.pages.map((page) =>
    page.file === file ? { ...page, html: page.html.replace("</body>", `<!-- ${GHOST_CONTROLS_MARKER}: ink --></body>`) } : page,
  );

/* ------------------------------------------------------------------ 0. the harness itself */

test("the harness composes the stylesheet the build's own writer composes", () => {
  // Without this, every doctor below could be measuring a stylesheet no build writes.
  const mine = stylesheet({ cardShape: "nested-cta", ghost: true });
  const build = renderCss(profileFor(MAPLE), GHOST_CONTROLS_SLUG, {
    serviceCardAction: "nested-cta",
    ghostControls: true,
  });
  expect(mine.css).toBe(build);
  expect(stylesheet({ ghost: true }).css).toBe(renderCss(profileFor(MAPLE), GHOST_CONTROLS_SLUG, { ghostControls: true }));
  expect(stylesheet().css).toBe(renderCss(profileFor(MAPLE), GHOST_CONTROLS_SLUG, {}));
  // The three blocks are the build's own: the base carries neither marker.
  expect(stylesheet().css).not.toContain(GHOST_CONTROLS_MARKER);
  expect(stylesheet().css).not.toContain(".service-cta");
});

/* ------------------------------------------------------------------- 1 and 2. the opt-in */

test("the opt-in both ways: a stylesheet that paints the ghost with the switch unset is refused, and so is an opt-in that painted nothing", () => {
  /* The switch absent — the repository's state, and every published build: the decision is
     off and `renderCss` writes no ghost block, so the gate is silent. */
  const off = build({ value: false });
  expect(off.decision.enabled).toBe(false);
  expect(off.css).not.toContain(GHOST_CONTROLS_MARKER);
  expect(refusal(off)).toBe("");

  /* Direction one (clause 1): the same build's stylesheet carrying the marker anyway — the
     treatment smuggled in behind the opt-in. This is the doctor: the block, not the decision. */
  const smuggled = refusal(off, { css: stylesheet({ ghost: true }).css });
  expect(smuggled).toContain(`paints the ghost controls (${INK_RULE}, ${HOME_RULE})`);
  expect(smuggled).toContain(`while ${GHOST_CONTROLS_VAR} is not in force for this build`);
  expect(smuggled).toContain("every bundle is the copy signed off on 7 Oct 2026, byte for byte");

  /* The switch on, on the record it is scoped to: the block is written and the gate is silent. */
  const on = build({ value: "1" });
  expect(on.decision.enabled).toBe(true);
  expect(on.css).toContain(GHOST_CONTROLS_MARKER);
  expect(refusal(on)).toBe("");

  /* Direction two (clause 2): the build asked for the treatment and wrote the filled buttons —
     `renderCss` dropping the ghost block while the decision says it is on. */
  const unpainted = refusal(on, { css: stylesheet({ ghost: false }).css });
  expect(unpainted).toContain(`paints no ghost controls while ${GHOST_CONTROLS_VAR} is set`);
  expect(unpainted).toContain(`this record is the ${GHOST_CONTROLS_SLUG} demonstration`);
  expect(unpainted).toContain("the build asked for the treatment and wrote the filled buttons instead");
});

test("a switch value this build cannot read is refused rather than guessed at, and the refusal names the values it accepts", () => {
  // Stated in this file, not derived: adding a spelling to the module without stating it here
  // fails the last assertion below.
  expect(Object.keys(GHOST_CONTROLS_SURFACES).sort()).toEqual([...ACCEPTED_VALUES].sort());
  expect(SURFACES).toEqual(["ink", "white"]);

  // The spellings it does read: all of them mean the one treatment this build paints.
  for (const value of ACCEPTED_VALUES) {
    const decision = ghostControlsDecision({ slug: GHOST_CONTROLS_SLUG, phase: "demo", env: { [GHOST_CONTROLS_VAR]: value } });
    expect(decision.enabled).toBe(true);
    expect(decision.unrecognised).toBeNull();
    expect(decision.surface).toBe("follow-surface");
  }

  // A value that names a treatment this build does not paint — including the two the brief
  // named and the lead ruled out — is refused, and the refusal quotes the values it accepts.
  for (const value of ["white", "dark", "maybe", "2", "follow surface"]) {
    const decision = ghostControlsDecision({ slug: GHOST_CONTROLS_SLUG, phase: "demo", env: { [GHOST_CONTROLS_VAR]: value } });
    expect(decision.enabled).toBe(false);
    expect(decision.unrecognised).toBe(value);
    expect(decision.basis).toContain(`${GHOST_CONTROLS_VAR} is set to "${value}", which names no treatment this build knows`);
    for (const accepted of ACCEPTED_VALUES) expect(decision.basis).toContain(`"${accepted}"`);
    // The numbers that decided it are in the refusal, not left to the reader.
    expect(decision.basis).toContain("a white ghost on every header is 1.00:1 on the paper-surfaced pages");
  }

  // And a build that *guessed* — painted the ghost for a value it could not read — is refused
  // by the gate by name, which is the shape the "rather than guessed at" promise protects.
  const refused = build({ value: "white" });
  expect(refused.decision.enabled).toBe(false);
  expect(refusal(refused, { css: stylesheet({ ghost: true }).css })).toContain(
    `while ${GHOST_CONTROLS_VAR} is not in force for this build`,
  );
});

/* ------------------------------------------------- 3 and 4. the phase and the record */

test("the delivered phase refuses the treatment outright, whatever the switch says", () => {
  for (const value of ["1", "ghost", "outline-follows-surface"]) {
    const decision = ghostControlsDecision({ slug: GHOST_CONTROLS_SLUG, phase: "business", env: { [GHOST_CONTROLS_VAR]: value } });
    expect(decision.enabled).toBe(false);
    expect(decision.unrecognised).toBeNull();
    expect(decision.basis).toContain("refused: this bundle is in the delivered phase");
    expect(decision.basis).toContain(`carries no weight in a client build`);
  }

  // The phase the decision is handed is the one a real delivered record resolves to, not a
  // literal this test typed: read it off `resolveDelivery`.
  const delivered = JSON.parse(readFileSync(join(import.meta.dir, "records", "business-phase.json"), "utf8")) as BusinessRecord;
  const deliveredSlug = delivered.slug ?? "business-phase";
  const parts = resolveBuildParts(delivered, deliveredSlug);
  expect(parts.delivery.mode).toBe("business");
  expect(
    ghostControlsDecision({ slug: deliveredSlug, phase: parts.delivery.mode, env: { [GHOST_CONTROLS_VAR]: "1" } }).enabled,
  ).toBe(false);

  // A delivered build whose stylesheet carries the marker anyway is refused by name.
  const shoehorned = build({ value: "1", phase: "business" });
  expect(shoehorned.decision.enabled).toBe(false);
  expect(refusal(shoehorned, { css: stylesheet({ ghost: true }).css })).toContain(
    `while ${GHOST_CONTROLS_VAR} is not in force for this build`,
  );
});

test("every record except the one the treatment is scoped to refuses it", () => {
  expect(OTHER_SLUGS.length).toBeGreaterThan(0);
  for (const slug of OTHER_SLUGS) {
    const source = record(slug);
    for (const value of ["1", "ghost"]) {
      const decision = ghostControlsDecision({ slug, phase: "demo", env: { [GHOST_CONTROLS_VAR]: value } });
      expect(decision.enabled).toBe(false);
      expect(decision.unrecognised).toBeNull();
      expect(decision.basis).toContain(`${GHOST_CONTROLS_VAR} is set but this record is "${slug}"`);
      expect(decision.basis).toContain(`scoped to the ${GHOST_CONTROLS_SLUG} appointment demonstration`);
      expect(decision.basis).toContain("so the stylesheet this bundle ships is unchanged");
    }
    // The decision is not merely a report: the build on that record writes no block, and if one
    // reaches its stylesheet the gate refuses the build.
    const built = build({ value: "1", record: source, slug });
    expect(built.css).not.toContain(GHOST_CONTROLS_MARKER);
    expect(refusal(built)).toBe("");
    expect(refusal(built, { css: stylesheet({ ghost: true }).css })).toContain(
      `while ${GHOST_CONTROLS_VAR} is not in force for this build`,
    );
  }
  // The scoped record is the only one that keeps it, so "every record except" is a claim about
  // the whole fixture set rather than about the three slugs written above.
  expect(build({ value: "1" }).decision.enabled).toBe(true);
});

/* --------------------------------------------------------------- 5. the two surfaces */

test("the surfaces are scoped: a white ghost outside the home page, an ink ghost inside it, and a build painting one surface are each refused", () => {
  const on = build({ value: "1" });
  expect(refusal(on)).toBe("");
  const block = ghostControlsCss();

  // (a) the white ghost un-scoped: it also paints the paper-surfaced headers, where white text
  //     and a white outline are 1.00:1.
  const unscopedWhite = doctor(block, /^\.page--index \.site-header \.call-button \{/m, `${INK_RULE} {`);
  const white = refusal(on, { css: stylesheet({ ghost: unscopedWhite }).css });
  expect(white).toContain(`claims the photograph surface (${GHOST_CONTROLS_MARKER}: ${GHOST_SURFACE_WHITE}) but is not scoped to the home page (.page--index)`);
  expect(white).toContain("where a white ghost is 1.00:1 and invisible");

  // (b) the ink ghost scoped to the home page: ink on the hero's scrim is a different treatment
  //     wearing the marker, and on the picture it is ink text over a dark wash.
  const scopedInk = doctor(block, /^\.site-header \.call-button \{/m, `${HOME_RULE} {`);
  const ink = refusal(on, { css: stylesheet({ ghost: scopedInk }).css });
  expect(ink).toContain(`claims the paper surface (${GHOST_CONTROLS_MARKER}: ${GHOST_SURFACE_INK}) but is scoped to the home page (.page--index)`);
  expect(ink).toContain("the ink ghost belongs to the paper-surfaced headers and to the service card");
  // Both doctors move one rule and nothing else: one problem each, not a pile.
  expect(list(on, { css: stylesheet({ ghost: unscopedWhite }).css }).length).toBe(1);
  expect(list(on, { css: stylesheet({ ghost: scopedInk }).css }).length).toBe(1);

  // (c) a build that paints one of the two surfaces: half the site keeps the filled pill and
  //     half wears the ghost.
  const cut = block.indexOf(`\n${HOME_RULE} {`);
  expect(cut).toBeGreaterThan(0);
  const oneSurface = block.slice(0, cut);
  expect(oneSurface).toContain(`--ghost-control: ${GHOST_SURFACE_INK}`);
  expect(oneSurface).not.toContain(`--ghost-control: ${GHOST_SURFACE_WHITE}`);
  const half = refusal(on, { css: stylesheet({ ghost: oneSurface }).css });
  expect(half).toContain("the ghost treatment covers 1 surface while the header's action exists on two");
  expect(half).toContain("which is the half-applied state this clause refuses");

  // A marker on a rule that is not the header's action is a ghost drawn somewhere the owner did
  // not ask for — the third way the surfaces can be wrong.
  const stray = doctor(block, /^\.site-header \.call-button \{/m, `.wordmark {`);
  expect(refusal(on, { css: stylesheet({ ghost: stray }).css })).toContain(
    `declares ${GHOST_CONTROLS_MARKER} but is not the header's action`,
  );

  // A marker naming a surface this build does not know: refused rather than treated as one.
  const bogus = doctor(block, /--ghost-control: ink;/, `--ghost-control: grey;`);
  expect(refusal(on, { css: stylesheet({ ghost: bogus }).css })).toContain(
    `which names no surface this build knows (${SURFACES.join(", ")})`,
  );
});

/* ------------------------------------------------------------------------- 6. the fills */

test("a fill at rest, and a light state fill, are refused — the treatment is a control with no fill, and its states deepen the ink", () => {
  const on = build({ value: "1" });
  expect(refusal(on)).toBe("");
  const block = ghostControlsCss();
  const css = (ghost: string) => stylesheet({ ghost }).css;

  // (a) a fill at rest on the paper-surface ghost: the pill this treatment replaces.
  const filled = doctor(block, /(^\.site-header \.call-button \{[^}]*?background: )transparent;/m, "$1#fff;");
  const rest = refusal(on, { css: css(filled) });
  expect(rest).toContain(`"${INK_RULE}" declares a fill (background: #fff) on the ghost`);
  expect(rest).toContain("The owner's direction is a control with **no fill**");

  // (b) a light state fill on the paper surface: it lifts the ink words' backdrop instead of
  //     deepening it, and lowers their contrast.
  const lightVeil = doctor(block, /(^\.site-header \.call-button:hover \{[^}]*?background: )[^;]+;/m, "$1rgba(255, 255, 255, .16);");
  const hover = refusal(on, { css: css(lightVeil) });
  expect(hover).toContain("the ghost's hover state fills the header's action with rgba(255, 255, 255, .16), which is not ink");
  expect(hover).toContain("a light veil darkens nothing");
  const active = doctor(block, /(^\.site-header \.call-button:active \{[^}]*?background: )[^;]+;/m, "$1rgba(255, 255, 255, .3);");
  expect(refusal(on, { css: css(active) })).toContain("the ghost's active state fills the header's action with rgba(255, 255, 255, .3)");

  // (c) the home surface, where the words are white: a light veil behind white text is exactly
  //     the thing the treatment must never do. This half lives in `headerOverlayProblems`,
  //     which has the wash the words sit on.
  const wash = (ghost: string) =>
    headerOverlayProblems(on.pages, css(ghost), on.decision).join(" | ");
  expect(wash(block)).toBe("");
  const lightHome = doctor(block, /(^\.page--index \.site-header \.call-button:hover \{[^}]*?background: )[^;]+;/m, "$1rgba(255, 255, 255, .16);");
  expect(wash(lightHome)).toContain("the ghost action in its hover state fills itself with rgba(255, 255, 255, .16), which is not ink");
  expect(wash(lightHome)).toContain("a light veil darkens nothing and drops the label's contrast");

  // (d) a fill at rest on the home ghost: its boundary is its outline, and the ghost is a control
  //     with no fill on either surface.
  const filledHome = doctor(block, /(^\.page--index \.site-header \.call-button \{[^}]*?background: )transparent;/m, "$1#fff;");
  expect(wash(filledHome)).toContain("the home header's action is not transparent at rest (background: #fff)");
});

/* --------------------------------------------------------------- 7. nothing reaches a page */

test("a page carrying the marker is refused: the treatment is stylesheet-only, and a page that moved is not the copy signed off on 7 Oct", () => {
  const on = build({ value: "1" });
  // The real build: no page of any bundle carries the marker, switch on or off.
  for (const page of build({ value: false }).pages) expect(page.html).not.toContain(GHOST_CONTROLS_MARKER);
  for (const page of on.pages) expect(page.html).not.toContain(GHOST_CONTROLS_MARKER);

  // The doctor: the marker in one page's markup, as it would arrive if a future edit painted the
  // treatment in the renderer instead of the stylesheet.
  const doctored = marked(on, "index.html");
  expect(doctored[0]!.html).toContain(GHOST_CONTROLS_MARKER);
  const problems = list(on, { pages: doctored });
  expect(problems.length).toBe(1);
  expect(problems[0]).toContain("index.html: carries the ghost treatment's own marker (--ghost-control) in its markup");
  expect(problems[0]).toContain("The treatment is a stylesheet treatment");
  expect(problems[0]).toContain("a page carrying it is a page that stopped being the copy the owner signed off on 7 Oct 2026");
  // It fires on the page that carries it, and it names that page — not the bundle.
  expect(refusal(on, { pages: marked(on, "contact.html") })).toContain("contact.html: carries the ghost treatment's own marker");
  // It fires whether the switch is on or off: a page that moved is not the off-state bundle either.
  expect(refusal(build({ value: false }), { pages: marked(build({ value: false }), "about.html") })).toContain(
    "about.html: carries the ghost treatment's own marker",
  );
});

/* ------------------------------------------------------------- 8. the nested card CTA */

test("inside the nested card shape the CTA is the same treatment, and a fill, a light outline or an outline that is not the words' colour is refused", () => {
  const nested = build({ value: "1", cardShape: "nested-cta" });
  expect(nested.decision.enabled).toBe(true);
  expect(nested.pages.find((page) => page.file === "services.html")!.html).toContain('class="service-cta"');
  expect(refusal(nested)).toBe("");

  const cta = nested.cardCss;
  // The nested shape's own stylesheet, with the CTA's block replaced by a doctored one: base,
  // then the CTA's block, then the ghost's — the order `renderCss` writes them in.
  const css = (ctaBlock: string) => stylesheet({}).base + ctaBlock + ghostControlsCss();
  const ctaRest = ".services .service-tile--cta .service-cta";

  // (a) a fill on the CTA: the transparent treatment replaced by the button it replaces.
  const filled = doctor(cta, /(\.service-tile--cta \.service-cta \{[^}]*?background: )transparent;/m, "$1#fff;");
  const fillProblem = refusal(nested, { css: css(filled) });
  expect(fillProblem).toContain(`the card CTA (${ctaRest}) declares a fill (background: #fff)`);
  expect(fillProblem).toContain("The owner's second direction of 10 Oct 2026 is the same transparent treatment on the card");

  // (b) a light outline: a transparent control's only boundary is its outline, and a pale line on
  //     the card is no boundary at all.
  const pale = doctor(cta, /border: 1px solid var\(--ink\);/, "border: 1px solid #efefef;");
  const paleProblem = refusal(nested, { css: css(pale) });
  expect(paleProblem).toContain("the card CTA's outline reaches only");
  expect(paleProblem).toContain("against the card's surface, under the 3:1 a control's own boundary needs");
  expect(paleProblem).toContain("A transparent control has no fill to give it an edge");

  // (c) an outline colour that is not the surface's own: the two controls stop being one
  //     treatment, which is the claim the whole module rests on.
  const mismatched = doctor(cta, /border: 1px solid var\(--ink\);/, "border: 1px solid #3d4450;");
  const mismatch = refusal(nested, { css: css(mismatched) });
  expect(mismatch).toContain("the card CTA draws its outline in rgb(61, 68, 80) and its words in rgb(22, 24, 27)");
  expect(mismatch).toContain("two colours on one control");

  // (d) no outline at all is refused too: a transparent control with no boundary is invisible.
  expect(refusal(nested, { css: css(doctor(cta, /^\s*border: 1px solid var\(--ink\);\n/m, "")) })).toContain(
    "declares no readable outline colour, so its own boundary against the card is unknown",
  );

  // (e) the CTA's states are the treatment's too: a state rule of the card CTA that leaves its
  //     colour to the cascade is the same defect clause 6 refuses on the header.
  const noColour = doctor(cta, /(\.service-cta:hover \{[^}]*?)\n\s*color: var\(--ink\);/m, "$1");
  expect(refusal(nested, { css: css(noColour) })).toContain(`the card CTA (${ctaRest}) leaves its hover colour to the cascade`);
});

/* ----------------------------------------------------------------- 9. clause 6, by name */

/**
 * **The pre-fix `ghost-controls.ts`** — the stylesheet `ea47016` was written to fix, taken from
 * `git show ea47016^:src/demo/ghost-controls.ts` and rendered through that file's own
 * `ghostControlsCss()`. Its state rules declare a fill and a ring and no `color`, which is the
 * defect: on the home header the earlier
 * `.page--index .site-header .call-button:hover { color: var(--ink) }` painted the words, and
 * the earlier draft's own gate agreed with the broken cascade because `stateDeclarations`
 * merges in document order and the ghost's *resting* rule does declare its colour.
 *
 * It is kept verbatim, as a historical fixture: this is the input clause 6 exists to refuse, and
 * a later rewrite of the treatment must not be able to make the clause unfalsifiable by moving
 * the thing it reads.
 */
const PREFIX_GHOST_CSS = `
/* ------------------------------------------------ ghost controls (review treatment)
   The owner's direction by text, 10 Oct 2026: the header action transparent with white
   text and a white outline, and the nested service-card CTA the same treatment in black.
   One system, from the lead's ruling the same day: the ghost is drawn in the colour of the
   surface it sits on, because white text or a white outline on a paper-surfaced header is
   1.00:1 — invisible. So the outline follows the surface: white over the home page's
   photograph, ink on every other page's header. DEMO_GHOST_CONTROLS is unset in the
   repository, so this block is absent from the published stylesheet: it is written only for
   a build that opts in (src/demo/ghost-controls.ts). */
.site-header .call-button {
  --ghost-control: ink;
  background: transparent;
  color: var(--ink);
  border-color: var(--ink);
}
/* The states deepen the ink rather than lightening the surface: a light veil on hover would
   drop the *text's* contrast, which is the one thing a ghost cannot afford. The inset ring
   doubles the outline to 2px without touching the control's box. */
.site-header .call-button:hover {
  background: rgba(22, 24, 27, .08);
  box-shadow: inset 0 0 0 1px var(--ink);
}
.site-header .call-button:active {
  background: rgba(22, 24, 27, .16);
  box-shadow: inset 0 0 0 1px var(--ink);
}
/* The home page alone: the header sits on the hero photograph's scrim, so the same ghost is
   white. One class more specific than the rule above, so the cascade picks it here. */
.page--index .site-header .call-button {
  --ghost-control: white;
  background: transparent;
  color: #fff;
  border-color: #fff;
}
.page--index .site-header .call-button:hover {
  background: rgba(10, 12, 14, .18);
  box-shadow: inset 0 0 0 1px #fff;
}
.page--index .site-header .call-button:active {
  background: rgba(10, 12, 14, .34);
  box-shadow: inset 0 0 0 1px #fff;
}
`;

test("clause 6: the last rule carrying a state's own selector must declare its own color — proved by the stylesheet that shipped the defect", () => {
  const on = build({ value: "1" });

  /* The pre-fix file, against this build: refused by name, on each of the four state rules it
     left to the cascade — two surfaces, two states. */
  const preFix = list(on, { css: stylesheet({ ghost: PREFIX_GHOST_CSS }).css });
  expect(preFix.length).toBe(4);
  expect(preFix.join(" | ")).toContain("leaves its hover colour to the cascade");
  expect(preFix.join(" | ")).toContain("leaves its active colour to the cascade");
  expect(preFix.filter((one) => one.includes(`the header's ghost (${HOME_RULE}) leaves its hover colour to the cascade`)).length).toBe(1);
  expect(preFix.filter((one) => one.includes(`the header's ghost (${HOME_RULE}) leaves its active colour to the cascade`)).length).toBe(1);
  expect(preFix.filter((one) => one.includes(`the header's ghost (${INK_RULE}) leaves its active colour to the cascade`)).length).toBe(1);
  for (const one of preFix) {
    expect(one).toContain("the last rule for");
    expect(one).toContain("declares no color, so whichever earlier rule matches paints the words");
    expect(one).toContain("rendered white words as ink at 1.00-1.53:1 on the hero picture");
  }

  /* And why the clause had to be added at all: the wash-side clause — `headerOverlayProblems`
     clause 6, which measures the ghost's states against the hero's scrim — is **silent** on
     the pre-fix stylesheet, because `stateDeclarations` merges in document order and the
     pre-fix resting rule does declare `color: #fff`. The gate agreed with the broken cascade;
     this clause is the one that does not. */
  expect(headerOverlayProblems(on.pages, stylesheet({ ghost: PREFIX_GHOST_CSS }).css, on.decision).join(" | ")).toBe("");

  /* The defect isolated: remove only the home header's hover `color`, and exactly one problem
     fires — the one rule whose declaration was missing. */
  const missing = doctor(ghostControlsCss(), /(^\.page--index \.site-header \.call-button:hover \{[^}]*?)\n\s*color: #fff;/m, "$1");
  const isolated = list(on, { css: stylesheet({ ghost: missing }).css });
  expect(isolated.length).toBe(1);
  expect(isolated[0]).toContain(`the header's ghost (${HOME_RULE}) leaves its hover colour to the cascade`);
  // The words are *still* white to the cascade — the defect is not a colour choice, it is the
  // missing declaration — so the wash-side clause stays silent, which is the point.
  expect(headerOverlayProblems(on.pages, stylesheet({ ghost: missing }).css, on.decision).join(" | ")).toBe("");

  // The active state, isolated the same way, and the paper surface's own two states.
  for (const [re, where] of [
    [/(^\.page--index \.site-header \.call-button:active \{[^}]*?)\n\s*color: #fff;/m, `${HOME_RULE}) leaves its active colour`],
    [/(^\.site-header \.call-button:hover \{[^}]*?)\n\s*color: var\(--ink\);/m, `${INK_RULE}) leaves its hover colour`],
    [/(^\.site-header \.call-button:active \{[^}]*?)\n\s*color: var\(--ink\);/m, `${INK_RULE}) leaves its active colour`],
  ] as const) {
    const one = list(on, { css: stylesheet({ ghost: doctor(ghostControlsCss(), re, "$1") }).css });
    expect(one.length).toBe(1);
    expect(one[0]).toContain(where);
  }

  /* A state rule that disappears altogether is refused too, and it is a different sentence:
     the cue the owner's brief asked for is gone, not merely mis-declared. It is proved on the
     paper surface, where the treatment's rule is the only rule carrying that selector — on the
     home page `.page--index .site-header .call-button:hover` also exists in the base sheet (the
     white pill's own hover), so deleting the ghost's rule there leaves a state the page still
     declares, and the earlier rule's ink is what would paint the words. */
  const gone = doctor(ghostControlsCss(), /\n\.site-header \.call-button:hover \{[\s\S]*?\n\}\n/, "\n");
  const absent = list(on, { css: stylesheet({ ghost: gone }).css });
  expect(absent.join(" | ")).toContain(`the header's ghost (${INK_RULE}) declares no :hover rule at all`);
  expect(absent.join(" | ")).toContain("every state the treatment paints deepens the surface's own colour and thickens the control's own outline");
});

/* ------------------------------------------------------------------------------- limits */

/**
 * **Two things this file cannot assert, written down where the clauses live** rather than left
 * for the next reader to rediscover.
 *
 *   1. **The build does not fail on a switch value it cannot read.** `buildBundle` prints
 *      `! ghost controls refused: …` and exits 0: the refusal lives in `ghostControlsDecision`
 *      and in that warning, and only the *smuggled* treatment (the block painted for a value
 *      the decision refused) reaches `complianceChecks`. Its sibling is stricter —
 *      `serviceCardActionProblems` clause 0a pushes a problem for an unrecognised
 *      `DEMO_SERVICE_CARD_ACTION_BAR`, so that build fails. This file asserts what the ghost's
 *      switch actually does (clause 2 above) and does not assert the sibling's shape, which
 *      would be a claim about code that is not there. Recorded for the lead, not fixed here:
 *      a change to a check is not this session's work.
 *   2. **The documents this module cites are not all in the repository.** `ghost-controls.ts`,
 *      the manifest's own note and the branch's commit messages point at
 *      `docs/ghost-controls.md` for the before/after table, the measured numbers and the two
 *      refused resolutions of the contrast problem; there is no such file in the tree, and the
 *      decision's refusal text therefore contains numbers whose working is not on disk. The
 *      measurements themselves are in `design/ghost-controls-measurements.md` (outside the
 *      repository). A regression test cannot assert a document that does not exist; it can
 *      only say so, which is what this note does.
 */
