/**
 * The Northshore theme (`src/demo/theme-northshore.ts`) — the owner's experimental design
 * pass of 24 Nov 2026.
 *
 * Four claims, each able to fail:
 *
 *   1. the decision is the record's and the demonstration's alone — Maple Avenue and a
 *      delivered build of the same record are both refused;
 *   2. the stylesheet carries the theme's marker, and the marker is what the check reads;
 *   3. a stylesheet that carries the theme for another record, or that does not carry it
 *      while the theme is in force, fails the build by name;
 *   4. every colour pair the theme introduces clears its floor **as measured off the
 *      stylesheet this build ships** — and a moved token fails it.
 */
import { describe, expect, test } from "bun:test";
import {
  NORTHSHORE_THEME_MARKER,
  NORTHSHORE_THEME_NAME,
  NORTHSHORE_THEME_SLUG,
  northshoreCss,
  northshoreThemeDecision,
  northshoreThemeProblems,
} from "../src/demo/theme-northshore.ts";

const maple = "maple-avenue-barber-shop";

describe("the Northshore theme's decision", () => {
  test("is on for the Northshore demonstration", () => {
    const decision = northshoreThemeDecision({ slug: NORTHSHORE_THEME_SLUG, phase: "demo" });
    expect(decision.enabled).toBe(true);
    expect(decision.name).toBe(NORTHSHORE_THEME_NAME);
  });

  test("is off for Maple Avenue — the other review demo keeps its own design", () => {
    expect(northshoreThemeDecision({ slug: maple, phase: "demo" }).enabled).toBe(false);
  });

  test("is off for a delivered build of the same record", () => {
    expect(northshoreThemeDecision({ slug: NORTHSHORE_THEME_SLUG, phase: "delivered" }).enabled).toBe(false);
  });
});

describe("the Northshore stylesheet", () => {
  test("declares its marker, and the marker names the theme", () => {
    const css = northshoreCss();
    expect(css).toContain(`${NORTHSHORE_THEME_MARKER}: ${NORTHSHORE_THEME_NAME}`);
  });

  test("writes no background and no state rule on a control — the fill is the treatment's", () => {
    const css = northshoreCss();
    // Every rule whose selector names a button or the card CTA, as written in the theme.
    const rules = [...css.matchAll(/(^|\})\s*([^{}@/][^{}]*)\{([^{}]*)\}/g)].map((m) => ({
      selector: m[2]!.trim(),
      body: m[3]!,
    }));
    const controls = rules.filter((rule) =>
      /\.(button|call-button|service-cta)\b/.test(rule.selector) && !/--/.test(rule.selector),
    );
    expect(controls.length).toBeGreaterThan(0);
    for (const rule of controls) {
      expect(`${rule.selector} {${rule.body}}`).not.toMatch(/\bbackground(-color)?\s*:/);
      expect(rule.selector).not.toMatch(/:(hover|active|focus|focus-visible)\b/);
    }
  });
});

describe("the Northshore theme's checks", () => {
  const on = northshoreThemeDecision({ slug: NORTHSHORE_THEME_SLUG, phase: "demo" });
  const off = northshoreThemeDecision({ slug: maple, phase: "demo" });

  test("pass on the build they are written for", () => {
    expect(northshoreThemeProblems({ slug: NORTHSHORE_THEME_SLUG, decision: on, css: northshoreCss() })).toEqual([]);
  });

  test("refuse a stylesheet that carries the theme while it is not in force", () => {
    const problems = northshoreThemeProblems({ slug: maple, decision: off, css: northshoreCss() });
    expect(problems.length).toBe(1);
    expect(problems[0]).toContain("carries the Northshore theme");
    expect(problems[0]).toContain(maple);
  });

  test("refuse a build that asked for the theme and shipped the shared design", () => {
    const problems = northshoreThemeProblems({ slug: NORTHSHORE_THEME_SLUG, decision: on, css: ":root { --ink: #16181B; }" });
    expect(problems.length).toBe(1);
    expect(problems[0]).toContain("does not carry the Northshore theme");
  });

  test("refuse the theme on a second record, by name", () => {
    const wrong = northshoreThemeDecision({ slug: "another-record", phase: "demo" });
    const problems = northshoreThemeProblems({
      slug: "another-record",
      decision: { ...wrong, enabled: true, name: NORTHSHORE_THEME_NAME },
      css: northshoreCss(),
    });
    expect(problems.join("\n")).toContain(`designed for ${NORTHSHORE_THEME_SLUG} alone`);
  });

  test("fail when a token moves without its pair being re-measured", () => {
    // The muted line darkened to the point where it no longer clears 4.5:1 on the bone paper:
    // the theme is untouched and only the token moves, which is exactly the drift the check is
    // for. Proves the contrast clause can fire, not that it is written down.
    const drifted = northshoreCss().replace("--muted: #55625A;", "--muted: #8A948C;");
    const problems = northshoreThemeProblems({ slug: NORTHSHORE_THEME_SLUG, decision: on, css: drifted });
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join("\n")).toContain("the muted line");
    expect(problems.join("\n")).toContain("under the 4.5:1 it needs");
  });
});
