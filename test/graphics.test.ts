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
import { renderPages, type RenderContext } from "../src/demo/render.ts";
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
