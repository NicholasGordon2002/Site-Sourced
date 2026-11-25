#!/usr/bin/env bun
/**
 * A demo page loads nothing from another origin.
 *
 *   bun test test/remote-resources.test.ts
 *
 * The rule this holds: every file a page fetches **when it opens** is a relative path inside
 * its own bundle. It was broken on 25 Nov 2026 by `booking-comparison.html`, which shipped
 * inside the Maple Avenue bundle with Google's scheduling-button script and an eager
 * `calendar.app.google` frame — and was served live, unlinked, from the published demo.
 *
 * The clauses, each able to fail:
 *
 *   1. an external `script`, `iframe`, `img` (and `srcset` candidate), `link` or `object` is
 *      refused by page and by URL;
 *   2. a stylesheet or inline `<style>` asking for another origin is refused;
 *   3. an `a href` to another origin is **allowed** — a booking page and a Maps address are
 *      links the visitor chooses to follow, and refusing them would refuse the product;
 *   4. the form's `action` may name the endpoint this build derived from the record, and no
 *      other external address;
 *   5. a file passed in `allow` (the review-only comparison page, when a build opted in) is
 *      skipped, and one not passed is not.
 *
 * **Proof the build check fails, run by hand on 25 Nov 2026** (each doctor is one edit,
 * reversed with `git checkout -- src/demo`):
 *
 *   # point one page of a fixture build at an external picture, then build:
 *   python3 - <<'PY'
 *   p='src/demo/render.ts'; s=open(p).read()
 *   s=s.replace('<img class="hero-img"', '<img src="https://example.test/x.jpg" class="hero-img"', 1)
 *   open(p,'w').write(s)
 *   PY
 *   DEMO_GHOST_CONTROLS=1 bun run src/demo/cli.ts --record test/fixtures/maple-avenue-barber-shop.json \
 *     --out /tmp/remote-doctor --cache-dir out/cache/demo
 *   # expect FAILED: "index.html: <img src="https://example.test/x.jpg"> makes the browser
 *   #               contact another origin when the page opens …"
 *
 *   # and with the page rendered as it ships, the same build passes — the check is not
 *   # vacuous, and the fixtures are clean.
 */
import { expect, test } from "bun:test";

import { externalCssLoads, externalLoads, externalOriginProblems } from "../src/demo/remote-resources.ts";

const PAGE = `<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body>
<a href="https://maps.google.com/?q=123">Find us</a>
<form method="POST" action="https://submit-form.com/abc123"><input name="name"></form>
<script src="site.js"></script>
</body></html>`;

test("a clean page passes: its own files, an anchor and the declared form endpoint", () => {
  expect(externalOriginProblems({ pages: [{ file: "index.html", html: PAGE }], css: '@font-face{src:url("fonts/a.woff2")}', formEndpoint: "https://submit-form.com/abc123" })).toEqual([]);
});

test("an external script, frame, picture or stylesheet is refused, by page and by URL", () => {
  const problems = externalOriginProblems({
    pages: [
      { file: "index.html", html: `${PAGE}<script src="https://calendar.google.com/calendar/scheduling-button-script.js"></script>` },
      { file: "contact.html", html: `${PAGE}<iframe src="https://calendar.app.google/q6s7"></iframe>` },
      { file: "about.html", html: `${PAGE}<img src="//cdn.example.test/team.jpg" srcset="//cdn.example.test/team-2x.jpg 2x">` },
      { file: "privacy.html", html: `<html><head><link rel="preconnect" href="https://fonts.gstatic.com"></head><body></body></html>` },
    ],
    formEndpoint: "https://submit-form.com/abc123",
  });
  expect(problems.some((p) => p.includes("index.html") && p.includes("calendar.google.com/calendar/scheduling-button-script.js"))).toBe(true);
  expect(problems.some((p) => p.includes("contact.html") && p.includes("calendar.app.google"))).toBe(true);
  expect(problems.some((p) => p.includes("about.html") && p.includes("cdn.example.test/team.jpg"))).toBe(true);
  expect(problems.some((p) => p.includes("about.html") && p.includes("cdn.example.test/team-2x.jpg"))).toBe(true);
  expect(problems.some((p) => p.includes("privacy.html") && p.includes("fonts.gstatic.com"))).toBe(true);
  // Four pages, five loads: the anchor and the declared form action are not among them.
  expect(problems).toHaveLength(5);
});

test("a stylesheet or inline style asking for another origin is refused", () => {
  expect(externalCssLoads('@font-face{src:url("https://fonts.gstatic.com/a.woff2")}')).toEqual(["https://fonts.gstatic.com/a.woff2"]);
  expect(externalCssLoads('@import "https://fonts.googleapis.com/css2";')).toEqual(["https://fonts.googleapis.com/css2"]);
  const problems = externalOriginProblems({
    pages: [{ file: "index.html", html: `<html><head><style>@font-face{src:url(https://fonts.example.test/a.woff2)}</style></head></html>` }],
    css: '@font-face{src:url("https://fonts.example.test/b.woff2")}',
    formEndpoint: "",
  });
  expect(problems.some((p) => p.includes("index.html") && p.includes("fonts.example.test/a.woff2"))).toBe(true);
  expect(problems.some((p) => p.includes("styles.css") && p.includes("fonts.example.test/b.woff2"))).toBe(true);
});

test("a form action that is not the endpoint this build derived is refused; the derived one is not", () => {
  const elsewhere = PAGE.replace("https://submit-form.com/abc123", "https://forms.example.test/collect");
  const problems = externalOriginProblems({
    pages: [{ file: "contact.html", html: elsewhere }],
    formEndpoint: "https://submit-form.com/abc123",
  });
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain("forms.example.test/collect");
  expect(problems[0]).toContain("not the endpoint this build derived");
});

test("an allowed file is skipped, and the same file refused when it is not allowed", () => {
  const comparison = `<html><body><script src="https://calendar.google.com/calendar/scheduling-button-script.js"></script><iframe src="https://calendar.app.google/q6s7"></iframe></body></html>`;
  const pages = [{ file: "booking-comparison.html", html: comparison }];
  expect(externalOriginProblems({ pages, allow: ["booking-comparison.html"], formEndpoint: "" })).toEqual([]);
  expect(externalOriginProblems({ pages, formEndpoint: "" })).toHaveLength(2);
});

test("every load attribute the browser fetches is covered", () => {
  const html = `<object data="https://a.test/x.svg"></object><video poster="https://a.test/p.jpg"><source src="https://a.test/v.mp4"></video><embed src="https://a.test/e.svg">`;
  const found = externalLoads(html).map((l) => `${l.tag}[${l.attribute}]`);
  expect(found).toEqual(["object[data]", "video[poster]", "source[src]", "embed[src]"]);
});
