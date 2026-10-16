#!/usr/bin/env bun
/**
 * The graphics layer's own rules, and the proof that each one can fail.
 *
 *   bun test test/graphics.test.ts
 *
 * `graphicsProblems()` in `src/demo/graphics.ts` runs inside `complianceChecks()`, so it
 * is a build refusal, not a style guide. Five clauses, one test each, and — because a
 * check nobody has seen fail is a check nobody should trust (`WORKFLOW.md` rule 6) — each
 * clause is shown firing on a **deliberately broken copy** of the layer, with the message
 * it prints. The valid copies are proved too: the real layer passes all five, and the
 * whole thing is re-checked through `complianceChecks()` so the wiring is tested and not
 * assumed.
 *
 * The doctor proofs, with the verbatim output, are in `docs/graphics-check-doctor-proofs.md`.
 *
 * No filesystem, no network. The record below is fictional.
 */
import { expect, test } from "bun:test";
import { complianceChecks, resolveBuildParts } from "../src/demo/build.ts";
import { composePrivacy, profileFor } from "../src/demo/copy.ts";
import { resolveDelivery } from "../src/demo/delivery.ts";
import { resolveForm } from "../src/demo/forms.ts";
import {
  DIVIDER_NAMES,
  GRAPHICS_BYTE_CAPS,
  GRAPHICS_VERSION,
  ICON_NAMES,
  MAP_CAPTION,
  PATTERN_NAMES,
  graphicsByteReport,
  graphicsCss,
  graphicsParts,
  graphicsProblems,
  ground,
  icon,
  schematicMap,
  divider,
  initialsOf,
  monogram,
  wordmark,
  type GraphicsPart,
} from "../src/demo/graphics.ts";
import { renderCss, renderPages, type RenderContext } from "../src/demo/render.ts";
import {
  GRAPHICS_MARKER,
  GRAPHICS_SLUG,
  GRAPHICS_VAR,
  graphicsDecision,
  graphicsWiringProblems,
  type GraphicsDecision,
} from "../src/demo/graphics-wiring.ts";
import { headingText } from "../src/demo/family-render.ts";
import { phonesPrintedIn } from "../src/demo/addresses.ts";
import { fetchedBy } from "../src/demo/service-card-action.ts";
import type { BusinessRecord, ManifestImage } from "../src/demo/types.ts";

const SLUG = "example-barber-shop";
const RECORD: BusinessRecord = {
  name: "Example Barber Shop",
  category: "Barber shop",
  city: "Hamilton, ON",
  source_kind: "public-listings",
  email: "shop@example-barber.ca",
  form_recipient: "site-sourced-311e0184@ctomail.io",
  form_delivery: "demo",
  form_provider: "formspark",
  form_access_key: "test-form-id",
};

/** The layer's parts with one of them replaced by a doctored copy. */
function withPart(name: string, text: string): GraphicsPart[] {
  return graphicsParts().map((part) =>
    part.name === name ? { name: part.name, bytes: Buffer.byteLength(text, "utf8"), text } : part,
  );
}

/* ------------------------------------------------------------------- the layer */

test("the layer is complete: every name it publishes draws something", () => {
  // The vocabulary is read off the shipped pages (see the file header), so each name has
  // a drawing and a written reason; a name with no note is a need nobody recorded.
  expect(ICON_NAMES.length).toBe(14);
  for (const name of ICON_NAMES) {
    const markup = icon(name);
    expect(markup).toContain("<svg");
    expect(markup).toContain("</svg>");
    expect(markup.length).toBeGreaterThan(60);
  }
  expect(DIVIDER_NAMES.length).toBe(4);
  expect(PATTERN_NAMES.length).toBe(5);
  for (const name of DIVIDER_NAMES) expect(divider(name)).toContain("preserveAspectRatio=\"none\"");
  for (const name of PATTERN_NAMES) expect(ground(name)).toContain(`gfx-ground--${name}`);
  expect(schematicMap()).toContain('aria-hidden="true"');
  expect(MAP_CAPTION.length).toBeGreaterThan(20);
  expect(GRAPHICS_VERSION).toBe("s3.1");
});

test("every icon is 24px-grid, one stroke weight, and decorative", () => {
  for (const name of ICON_NAMES) {
    const markup = icon(name);
    expect(markup).toContain('viewBox="0 0 24 24"');
    expect(markup).toContain('stroke-width="1.75"');
    expect(markup).toContain('stroke="currentColor"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain('role="img"');
  }
  // Both sizes are real sizes: the drawing scales and the box it reports scales with it.
  expect(icon("hours", { size: 20 })).toContain('width="20" height="20"');
  expect(icon("hours", { size: 24 })).toContain('width="24" height="24"');
  expect(icon("hours", { size: 20 })).toContain("gfx-icon--20");
});

test("a meaningful graphic is named, and the initials mark is decorative", () => {
  // The map is the layer's one non-decorative case, and the choice is deliberate: the
  // drawing carries no geography, so the *caption* carries the meaning and the drawing is
  // hidden from a screen reader (proved on pixels in docs/graphics-layer.md).
  expect(schematicMap()).toContain('aria-hidden="true"');
  expect(schematicMap()).not.toContain('role="img"');
  // The monogram sits beside the business's name as text, so it is decoration too.
  expect(monogram("Maple Avenue Barber Shop")).toContain('aria-hidden="true"');
  expect(monogram("Maple Avenue Barber Shop")).toContain(">MA<");
  expect(initialsOf("Maple Avenue Barber Shop")).toBe("MA");
  expect(initialsOf("King West Dental")).toBe("KW");
  expect(initialsOf("")).toBe("SS");
  expect(wordmark("Maple Avenue Barber Shop", { mark: true })).toContain("gfx-wordmark-name");
});

test("the real layer passes all five clauses, and fits its byte caps", () => {
  expect(graphicsProblems()).toEqual([]);
  const report = graphicsByteReport();
  expect(report.layerBytes).toBeLessThanOrEqual(GRAPHICS_BYTE_CAPS.layer);
  for (const part of report.parts) expect(part.ok).toBe(true);
  // No asset and no request is the layer's strongest claim, and it is structural: the
  // layer emits markup and CSS only, so there is no file for a page to fetch.
  expect(report.assets).toBe(0);
  expect(report.requests).toBe(0);
});

/* ------------------------------------------------- clause 1 — nothing remote */

test("clause 1 fires: a layer that reaches the network fails the build", () => {
  const remote = [
    [".gfx-icon { background-image: url(\"https://cdn.example/icons.svg\"); }", "url() reference"],
    ["@import url(\"https://fonts.example/x.css\");", "absolute http(s) URL"],
    ['<use href="//cdn.example/sprite.svg#pin"/>', "protocol-relative URL"],
    ['<script src="track.js"></script>', "<script> element"],
    ['<image href="hero.png"/>', "<image> element"],
    ['<use href="sprite.svg#pin"/>', "<use> pointing outside this document"],
    ['<svg src="icons.svg"></svg>', "external resource attribute"],
  ] as const;
  for (const [doctor, expected] of remote) {
    const problems = graphicsProblems(withPart("css", doctor));
    expect(problems.some((p) => p.includes(expected) && p.includes("graphics layer"))).toBe(true);
  }
  // `url()` is refused wholesale, fragment or not: the layer draws its grounds with
  // gradients and its marks with inline SVG, so it never needs a reference to resolve —
  // and a rule that has to judge which `url()` is local is a rule that will get one wrong.
  expect(
    graphicsProblems(withPart("css", '.gfx-map-dot { fill: url("#accent"); }')).some((p) =>
      p.includes("a url() reference"),
    ),
  ).toBe(true);
  expect(graphicsProblems()).toEqual([]);
});

/* -------------------------------------------------------- clause 2 — marking */

test("clause 2 fires: an unmarked, doubly-marked or nameless graphic fails", () => {
  const unmarked = icon("pin").replace(' aria-hidden="true"', "");
  expect(
    graphicsProblems(withPart("icons", unmarked)).some((p) => p.includes("carries no marking")),
  ).toBe(true);

  const both = icon("pin").replace('class="gfx-icon', 'role="img" aria-label="pin" class="gfx-icon');
  expect(
    graphicsProblems(withPart("icons", both)).some((p) => p.includes("both decorative")),
  ).toBe(true);

  const nameless = icon("pin")
    .replace(' aria-hidden="true"', "")
    .replace('class="gfx-icon', 'role="img" aria-label="" class="gfx-icon');
  expect(
    graphicsProblems(withPart("icons", nameless)).some((p) => p.includes("no accessible name")),
  ).toBe(true);
});

/* --------------------------------------------------------- clause 3 — colour */

test("clause 3 fires: a baked-in colour fails, because it cannot follow the surface", () => {
  const doctored: [string, string][] = [
    [icon("pin").replace('stroke="currentColor"', 'stroke="#16181B"'), "hex colour"],
    [icon("pin").replace('stroke="currentColor"', 'stroke="rgb(22 24 27)"'), "rgb()/hsl() colour"],
    [graphicsCss() + "\n.gfx-icon { color: white; }", "named colour"],
  ];
  for (const [markup, expected] of doctored) {
    const part = markup.startsWith("<svg") ? "icons" : "css";
    expect(graphicsProblems(withPart(part, markup)).some((p) => p.includes(expected))).toBe(true);
  }
});

/* ---------------------------------------------------------- clause 4 — bytes */

test("clause 4 fires: an icon, the set and the whole layer each have a cap", () => {
  // One redrawn mark that costs an order of magnitude more than the others.
  const fat = icon("pin").replace("</svg>", `<path d="M${"0 ".repeat(400)}"/></svg>`);
  const one = graphicsProblems(withPart("icons", fat));
  expect(one.some((p) => p.includes("over the 512-byte per-icon cap"))).toBe(true);

  // A set that has grown past its own cap (15 copies: same names, more bytes).
  const many = graphicsParts()
    .find((part) => part.name === "icons")!
    .text.repeat(3);
  const setProblems = graphicsProblems(withPart("icons", many));
  expect(setProblems.some((p) => p.includes("over the 6144-byte cap"))).toBe(true);
  // ...and the set with an element that has no name in the list is a set nobody can call.
  expect(setProblems.some((p) => p.includes("elements for 14 named icons"))).toBe(true);

  // The whole layer over its cap, however the bytes are distributed.
  const grown = graphicsParts().map((part) => ({
    ...part,
    text: part.text + " ".repeat(GRAPHICS_BYTE_CAPS.layer),
  }));
  expect(
    graphicsProblems(grown).some((p) => p.includes("the whole layer is") && p.includes("over the")),
  ).toBe(true);

  // A part with no cap in the table is refused rather than silently free. Unreachable
  // from the real layer — every part `named` passes carries a cap, and the caption, the
  // one part without one, is exempted — so this is the doctored layer's own case, and the
  // sweep row `c4-cap-declared` is what proves this test is holding the branch up. It is
  // also why the caption exemption is load-bearing: without it the caption lands here.
  const uncapped = graphicsProblems([
    ...graphicsParts(),
    { name: "sparkle", text: "<svg aria-hidden=\"true\"></svg>" } as unknown as GraphicsPart,
  ]);
  expect(uncapped.some((p) => p.includes("its sparkle part has no byte cap"))).toBe(true);
});

/* -------------------------------------------------------- clause 5 — scoping */

test("clause 5 fires: every rule is scoped to a .gfx- class, or it is refused", () => {
  const leaked = `${graphicsCss()}\n.card { border-color: var(--accent); }\nbody { color: var(--ink); }`;
  const problems = graphicsProblems(withPart("css", leaked));
  expect(problems.some((p) => p.includes('the rule ".card"'))).toBe(true);
  expect(problems.some((p) => p.includes('the rule "body"'))).toBe(true);
  // The real stylesheet writes no unscoped selector and no selector list outside .gfx-.
  expect(graphicsProblems(withPart("css", graphicsCss()))).toEqual([]);
});

test("clause 5 fires inside an at-rule, and the refusal says which at-rule", () => {
  // The case that will actually arrive first: a correctly scoped rule inside a media
  // query. It is additive, so it is accepted — a walk that refused it would refuse the
  // layer's own next commit.
  expect(
    graphicsProblems(withPart("css", "@media (min-width: 40rem) { .gfx-icon--24 { width: 1.5rem; } }")),
  ).toEqual([]);

  // The same rule unscoped, one block down, is refused — and the refusal names where it
  // lives, not only what it says.
  const nested = graphicsProblems(
    withPart("css", "@media (min-width: 40rem) { .card { border-color: var(--accent); } }"),
  );
  expect(nested.length).toBe(1);
  expect(nested[0]).toContain('the rule ".card"');
  expect(nested[0]).toContain('inside the at-rule "@media (min-width: 40rem)"');

  // Two levels: both at-rules are named, outermost first.
  const deep = graphicsProblems(
    withPart("css", "@media (min-width: 40rem) { @supports (display: grid) { .card { border-color: var(--accent); } } }"),
  );
  expect(deep.length).toBe(1);
  expect(deep[0]).toContain('inside the at-rules "@media (min-width: 40rem) > @supports (display: grid)"');

  // A rule after the at-rule block is back at the top level: nothing carries the path on.
  const after = graphicsProblems(
    withPart("css", "@media (min-width: 40rem) { .gfx-icon { width: 1rem; } }\n.card { border-color: var(--accent); }"),
  );
  expect(after.length).toBe(1);
  expect(after[0]).toContain('the rule ".card"');
  expect(after[0]).not.toContain("inside the at-rule");

  // A statement-terminated at-rule (`@charset`, `@layer a, b;`) is a statement, not a
  // block prelude: it ends at its `;`, so it is neither a selector itself nor read as the
  // next rule's selector.
  expect(graphicsProblems(withPart("css", '@charset "utf-8";\n.gfx-icon { color: var(--body-text); }'))).toEqual([]);
  const afterStatement = graphicsProblems(withPart("css", '@charset "utf-8";\n.card { border-color: var(--accent); }'));
  expect(afterStatement.length).toBe(1);
  expect(afterStatement[0]).toContain('the rule ".card"');
});

test("clause 5's stated limits hold at the boundary: key frames, and CSS nesting", () => {
  // `@keyframes` inner blocks are stops (`from`, `to`), not selectors. Looking inside one
  // would refuse a legitimate animation, so the walk does not — which also means the
  // animation *name* goes unchecked (the limit is on the record in the doc comment).
  expect(
    graphicsProblems(withPart("css", "@keyframes gfx-dash { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 2rem; } }")),
  ).toEqual([]);
  expect(graphicsProblems(withPart("css", "@keyframes dash { from { opacity: 0; } }"))).toEqual([]);

  // A rule nested inside a style rule's declaration block is composed with the selector
  // around it, so the *enclosing* selector is the one that decides whether the layer stays
  // additive — and that selector is checked. The leak moves to the outer rule, where it is
  // caught:
  expect(graphicsProblems(withPart("css", ".gfx-icon { .card { border-color: var(--accent); } }"))).toEqual([]);
  expect(graphicsProblems(withPart("css", ".card { .gfx-icon { border-color: var(--accent); } }")).length).toBe(1);
});

/* ------------------------------------------------------------------ wiring */

test("the clauses are wired into the build itself, not only callable", async () => {
  const { form, delivery, copy } = resolveBuildParts(RECORD, SLUG);
  const ctx: RenderContext = {
    record: RECORD,
    copy,
    profile: profileFor(RECORD),
    form,
    delivery,
    privacy: composePrivacy(RECORD, form, delivery),
    images: [] as ManifestImage[],
    slug: SLUG,
    generatedAt: "2026-10-17T00:00:00.000Z",
  };
  const pages = renderPages(ctx);
  const base = {
    pages,
    record: RECORD,
    copy,
    form,
    delivery,
    images: [] as ManifestImage[],
    privacy: ctx.privacy,
  };
  // The unbroken layer adds nothing to a real build's problem list...
  expect(complianceChecks(base).filter((p) => p.startsWith("graphics layer"))).toEqual([]);
  // ...and a layer that reaches the network stops that same build. The parts below are
  // injected exactly as `build.ts` passes cardShape and ghostControls, so this proves the
  // producer (`graphicsParts`) and the consumer (`complianceChecks`) are the same check.
  const broken = complianceChecks({
    ...base,
    graphics: withPart("css", graphicsCss() + "@import \"https://fonts.example/x.css\";"),
  });
  expect(broken.some((p) => p.startsWith("graphics layer") && p.includes("@import"))).toBe(true);
});

test("the layers' own exports do not collide with the template's class names", () => {
  // The layer is additive: every class it writes is namespaced, so wiring it in cannot
  // restyle the existing page (clause 5 checks the CSS; this checks the markup half).
  const markup = [ICON_NAMES.map((name) => icon(name)).join(""), schematicMap(), wordmark("X", { mark: true }), ...DIVIDER_NAMES.map((name) => divider(name))].join("");
  const classes = [...markup.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1]!.split(/\s+/));
  expect(classes.length).toBeGreaterThan(20);
  for (const name of classes) expect(name.startsWith("gfx-")).toBe(true);
  expect(graphicsCss()).toContain(".gfx-ground--no-photo");
});

/* ------------------------------------------- the wiring (`DEMO_GRAPHICS`, S3 wired) */

/** The decision a build of the one demonstration this layer is scoped to makes. */
function decision(env: Record<string, string | undefined>, phase: "demo" | "business" = "demo"): GraphicsDecision {
  return graphicsDecision({ slug: GRAPHICS_SLUG, phase, env });
}
const ON = decision({ [GRAPHICS_VAR]: "layer" });
const OFF = decision({});

/** One bundle's pages and stylesheet, with the layer on or off — the real renderer. */
function rendered(graphics: boolean) {
  const { form, delivery, copy } = resolveBuildParts(RECORD, SLUG);
  const ctx: RenderContext = {
    record: RECORD,
    copy,
    profile: profileFor(RECORD),
    form,
    delivery,
    privacy: composePrivacy(RECORD, form, delivery),
    images: [] as ManifestImage[],
    slug: SLUG,
    generatedAt: "2026-10-17T00:00:00.000Z",
    ...(graphics ? { graphics: true } : {}),
  };
  return {
    pages: renderPages(ctx),
    css: renderCss(profileFor(RECORD), SLUG, graphics ? { graphics: true } : {}),
  };
}

/** A one-page bundle, for the clauses that read the pages rather than the renderer. */
function bundle(html: string) {
  return [{ id: "index" as const, file: "index.html", html }];
}

test("the switch is value-addressed, scoped to one demonstration, and refused in the delivered phase", () => {
  expect(OFF.enabled).toBe(false);
  expect(OFF.unrecognised).toBe(null);
  expect(ON.enabled).toBe(true);
  expect(ON.scope).toBe("layer");
  // A value this build cannot read is refused rather than guessed at, and it says so.
  const odd = decision({ [GRAPHICS_VAR]: "shiny" });
  expect(odd.enabled).toBe(false);
  expect(odd.unrecognised).toBe("shiny");
  expect(graphicsWiringProblems({ pages: [], css: "", decision: odd }).some((p) => p.includes("names no treatment"))).toBe(true);
  // Off, and the switch is off for every spelling the repo uses for off.
  for (const off of ["0", "false", "off", " "]) expect(decision({ [GRAPHICS_VAR]: off }).enabled).toBe(false);
  // Scoped: another record's build reads the same variable and nothing happens.
  const other = graphicsDecision({ slug: "red-hill-property-care", phase: "demo", env: { [GRAPHICS_VAR]: "layer" } });
  expect(other.enabled).toBe(false);
  expect(other.basis).toContain("refused");
  // The delivered phase refuses it: a client's site carries the design the client agreed to.
  const client = decision({ [GRAPHICS_VAR]: "layer" }, "business");
  expect(client.enabled).toBe(false);
  expect(client.basis).toContain("delivered phase");
});

test("with the layer on, every page carries a marked mark and the stylesheet carries the layer", () => {
  const { pages, css } = rendered(true);
  expect(pages.length).toBeGreaterThan(4);
  for (const page of pages) expect(/class="[^"]*\bgfx-[a-z]/.test(page.html)).toBe(true);
  expect(css).toContain(".gfx-icon {");
  expect(css).toContain(GRAPHICS_MARKER);
  // The whole bundle, through the clauses the build runs.
  expect(graphicsWiringProblems({ pages, css, decision: ON })).toEqual([]);
  // A mark is never inside a control: the measured button boxes do not move.
  for (const page of pages) {
    for (const control of [...page.html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map((m) => m[0]!)) {
      const classes = (/class="([^"]*)"/.exec(control.slice(0, control.indexOf(">")))?.[1] ?? "").split(/\s+/);
      if (!classes.some((one) => ["button", "call-button", "service-cta"].includes(one))) continue;
      expect(/gfx-/.test(control.slice(control.indexOf(">")))).toBe(false);
    }
  }
});

test("with the layer off, no page and no stylesheet carries it — and the clauses refuse one that does", () => {
  const { pages, css } = rendered(false);
  for (const page of pages) expect(page.html.includes("gfx-")).toBe(false);
  expect(css.includes(GRAPHICS_MARKER)).toBe(false);
  expect(css.includes(".gfx-icon {")).toBe(false);
  expect(graphicsWiringProblems({ pages, css, decision: OFF })).toEqual([]);
  // Clause 1: a layer smuggled in while the switch is off, on a page or in the stylesheet.
  const smuggled = bundle('<main><svg class="gfx-icon gfx-icon--20" aria-hidden="true"></svg></main>');
  expect(graphicsWiringProblems({ pages: smuggled, css: "", decision: OFF }).some((p) => p.includes("carries a graphics-layer class"))).toBe(true);
  expect(
    graphicsWiringProblems({ pages: [], css: `.gfx-icon { color: var(--ink); }\n.gfx-layer { ${GRAPHICS_MARKER}: s3.1; }`, decision: OFF }).some((p) =>
      p.includes("carries the graphics layer's rules"),
    ),
  ).toBe(true);
  // Clause 2: the opt-in in force and nothing painted, or the marker missing.
  expect(
    graphicsWiringProblems({ pages: bundle("<main><p>plain</p></main>"), css: "", decision: ON }).some((p) =>
      p.includes("carries no graphics-layer mark"),
    ),
  ).toBe(true);
  expect(
    graphicsWiringProblems({ pages: bundle('<svg class="gfx-icon" aria-hidden="true"></svg>'), css: css, decision: ON }).some((p) =>
      p.includes("carries no graphics layer while"),
    ),
  ).toBe(true);
});

test("the wiring refuses an unmarked mark, a map without its caption, and a mark inside a control", () => {
  const { css } = rendered(true);
  const ok = bundle('<svg class="gfx-icon gfx-icon--20" aria-hidden="true" focusable="false"></svg>');
  expect(graphicsWiringProblems({ pages: ok, css, decision: ON })).toEqual([]);

  // Clause 3 — marking, and the focusable attribute.
  const unmarked = bundle('<svg class="gfx-icon" focusable="false"></svg>');
  expect(graphicsWiringProblems({ pages: unmarked, css, decision: ON }).some((p) => p.includes("carries no marking"))).toBe(true);
  const unfocusable = bundle('<svg class="gfx-icon" aria-hidden="true"></svg>');
  expect(graphicsWiringProblems({ pages: unfocusable, css, decision: ON }).some((p) => p.includes('focusable="false"'))).toBe(true);

  // Clause 4 — the map's meaning is its caption, and only its caption.
  const mapNoCaption = bundle(schematicMap());
  expect(graphicsWiringProblems({ pages: mapNoCaption, css, decision: ON }).some((p) => p.includes("without its caption"))).toBe(true);
  const mapWithCaption = bundle(`${schematicMap()}<p>${MAP_CAPTION}</p>`);
  expect(graphicsWiringProblems({ pages: mapWithCaption, css, decision: ON })).toEqual([]);

  // Clause 5 — a mark beside a control is fine; a mark inside one is not.
  const beside = bundle(`<p>${icon("hours")} <a class="button" href="#form">Request an appointment</a></p>`);
  expect(graphicsWiringProblems({ pages: beside, css, decision: ON })).toEqual([]);
  const inside = bundle(`<a class="button" href="#form">${icon("hours")} Request an appointment</a>`);
  expect(graphicsWiringProblems({ pages: inside, css, decision: ON }).some((p) => p.includes("carries a graphics-layer mark inside it"))).toBe(true);
});

test("the clauses are wired into the build itself, not only callable", () => {
  const { pages, css } = rendered(true);
  const { form, delivery, copy } = resolveBuildParts(RECORD, SLUG);
  const base = { pages, record: RECORD, copy, form, delivery, images: [] as ManifestImage[], privacy: composePrivacy(RECORD, form, delivery), css };
  // The layer, wired and opted in, adds nothing to a real build's problem list...
  expect(complianceChecks({ ...base, graphicsWiring: ON }).filter((p) => p.includes("graphics-layer") || p.includes("graphics layer"))).toEqual([]);
  // ...and a page that lost its marking stops that same build, through the same entry point
  // `build.ts` uses.
  const broken = complianceChecks({ ...base, pages: bundle('<svg class="gfx-icon"></svg>'), graphicsWiring: ON });
  expect(broken.some((p) => p.includes("carries no marking"))).toBe(true);
});

test("the three guards that read markup now read text: an inline mark is not a phone number, a name or a fetch", () => {
  // The phone guard read an inline SVG's path data as eleven digits starting with 1, which
  // is a North American number: geometry is stripped, and nothing else is.
  const drawing = `<svg class="gfx-icon" viewBox="0 0 24 24"><path d="M12.6 3.4h6.1a1.9 1.9 0 0 1 1.9 1.9v6.1a1.9 1.9 0 0 1-.56 1.34l-7.2 7.2a1.9 1.9 0 0 1-2.69 0Z"/></svg>`;
  expect(phonesPrintedIn({ file: "index.html", html: drawing })).toEqual([]);
  // What a visitor can read is still read: the same number as visible text, and inside a
  // drawing's own <text> element.
  expect(phonesPrintedIn({ file: "index.html", html: `<p>Call +1 905-555-0142</p>` }).length).toBe(1);
  expect(phonesPrintedIn({ file: "index.html", html: `<svg><text>+1 905-555-0142</text></svg>` }).length).toBe(1);
  expect(phonesPrintedIn({ file: "index.html", html: `<a href="tel:+19055550142">Call</a>` }).length).toBe(1);

  // The card checks compared a heading's markup with the record's own name.
  expect(headingText(`<svg class="gfx-icon"></svg> Haircut`)).toBe("Haircut");
  expect(headingText("Kids&#39; cut")).toBe("Kids&#39; cut");

  // The card's cost scan listed `svg` as a tag that fetches. Inline SVG fetches nothing;
  // these are the shapes that do.
  expect(fetchedBy(drawing)).toEqual([]);
  expect(fetchedBy('<svg src="icons.svg"></svg>')).toEqual(["an <svg src>", "src="]);
  expect(fetchedBy('<svg><image href="hero.png"/></svg>')).toEqual(["an <image>"]);
  expect(fetchedBy('<svg><use href="sprite.svg#pin"/></svg>')).toEqual(["an external <use>"]);
  expect(fetchedBy('<img src="x.png">')).toEqual(["img", "src="]);
  expect(fetchedBy('<a href="https://example.com">x</a>')).toEqual(["a remote address"]);
});
