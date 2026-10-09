#!/usr/bin/env bun
/**
 * The review-only booking comparison page — its labels, and the one thing that lets them
 * pass the family guard.
 *
 *   bun test test/booking-comparison.test.ts
 *
 * Two of this page's three controls carry the word `book`: option 1's
 * `Book a demonstration time` and option 2's `Book an appointment`. An appointment page
 * "may request a time and may never book one" (WORKFLOW.md rule 3), and the guard that
 * enforces that exempts a booking page **only where the record carries a `booking_url`**
 * (`family.ts` `familyHonestyProblems`: "a booking page in the record makes the booking
 * words true about that link").
 *
 * The barber fixture carries `"booking_url": "env:DEMO_BOOKING_URL"` — a **non-empty raw
 * string** whose variable is deliberately unset, because setting it would switch the whole
 * bundle's derived booking mode to `demo` and change the five contact pages signed off on
 * 7 Oct. So the two labels pass the guard on the strength of the raw string, and this file
 * is the regression test that says so out loud: **clear the raw field and both labels are
 * refused**, which is the behaviour that must not go missing if someone "tidies" the
 * fixture or loosens the guard.
 *
 * Nothing here touches the filesystem, the network or the real environment.
 */
import { expect, test } from "bun:test";
import { familyHonestyProblems } from "../src/demo/family.ts";
import {
  BOOKING_COMPARISON_FILE,
  BOOKING_COMPARISON_SLUG,
  comparisonDecision,
  comparisonStyleBlock,
  FRAME_BOX_CLASS,
  FRAME_BREAKPOINT,
  FRAME_DESKTOP_HEIGHT,
  FRAME_FALLBACK_LABEL,
  FRAME_NOTES_ID,
  FRAME_PHONE_HEIGHT,
  FRAME_TITLE,
  OPTION1_LABEL,
  OPTION2_LABEL,
  OPTION3_BOX_SENTENCE,
  OPTION3_MANDATED_STRINGS,
  OPTION3_STALE_MEASUREMENT,
  optionThreeSection,
} from "../src/demo/booking-comparison.ts";
import type { BusinessRecord } from "../src/demo/types.ts";
import barber from "./fixtures/maple-avenue-barber-shop.json";
import dental from "./fixtures/king-west-dental.json";

const FIXTURE = barber as unknown as BusinessRecord;
/** The fixture's raw field: the indirection, not a URL — and not empty. */
const RAW_BOOKING_URL = (barber as { booking_url?: string }).booking_url ?? "";

/** The labels as the page prints them: a sentence per control, which is what the guard reads. */
const LABEL_HTML = `<p>${OPTION1_LABEL}</p><p>${OPTION2_LABEL}</p>`;

function guard(record: BusinessRecord): string[] {
  return familyHonestyProblems({
    pages: [{ file: BOOKING_COMPARISON_FILE, html: LABEL_HTML }],
    record,
    family: "appointment",
  });
}

test("the barber fixture carries the booking indirection, non-empty, and no literal URL", () => {
  expect(RAW_BOOKING_URL).toBe("env:DEMO_BOOKING_URL");
  expect(RAW_BOOKING_URL.trim()).not.toBe("");
  expect(RAW_BOOKING_URL).not.toContain("http");
});

test("both booking labels pass the family guard — only because the raw booking_url is non-empty", () => {
  expect(LABEL_HTML).toContain("Book a demonstration time");
  expect(LABEL_HTML).toContain("Book an appointment");
  expect(guard(FIXTURE)).toEqual([]);
});

test("clear the raw booking_url and the same two labels are refused, by name", () => {
  const noBooking: BusinessRecord = { ...FIXTURE, booking_url: "" };
  const problems = guard(noBooking);
  expect(problems.length).toBeGreaterThan(0);
  expect(problems.join("\n")).toContain("Book a demonstration time");
  expect(problems.join("\n")).toContain("Book an appointment");
  // The guard's own words for why the field is what makes them true.
  expect(problems.join("\n")).toContain("booking_url");
});

test("a third fixture without a booking_url is refused the same way", () => {
  const dentalRecord = dental as unknown as BusinessRecord;
  expect((dental as { booking_url?: string }).booking_url ?? "").toBe("");
  expect(guard(dentalRecord).length).toBeGreaterThan(0);
});

test("the page is scoped: it exists for the named demonstration only, and never in the delivered phase", () => {
  const url = "https://example.invalid/demonstration";
  expect(comparisonDecision({ record: FIXTURE, slug: BOOKING_COMPARISON_SLUG, url, phase: "demo" }).enabled).toBe(true);
  // Another record, the delivered phase, and an unset address each refuse it.
  expect(
    comparisonDecision({ record: dental as unknown as BusinessRecord, slug: "king-west-dental", url, phase: "demo" })
      .enabled,
  ).toBe(false);
  expect(comparisonDecision({ record: FIXTURE, slug: BOOKING_COMPARISON_SLUG, url, phase: "business" }).enabled).toBe(false);
  expect(comparisonDecision({ record: FIXTURE, slug: BOOKING_COMPARISON_SLUG, url: "", phase: "demo" }).enabled).toBe(false);
});

test("the frame's accessible name is a real sentence, not a filename", () => {
  expect(FRAME_TITLE).toBe("Demonstration booking page — a Google page shown inside this page");
});

/**
 * Option 3, the frame, as **one uninterrupted block** — the owner's 9 Oct 2026 reading
 * ("coded poorly … split between your text", and on a desktop "can't be seen at all").
 * These read the rendered section and the page's own CSS, so the order and the heights
 * cannot drift away from the brief without a failing test.
 */
const SECTION_URL = "https://example.invalid/demonstration";
const SECTION = optionThreeSection({ url: SECTION_URL });
/** Where a marker sits in the rendered section, in document order. */
function at(marker: string): number {
  const i = SECTION.indexOf(marker);
  expect(i).toBeGreaterThan(-1);
  return i;
}
test("option 3 is one uninterrupted block: heading, box, frame, anchor, then the prose", () => {
  const heading = at("<h2>Option 3 — the booking page in a frame</h2>");
  const box = at(`<div class="${FRAME_BOX_CLASS}">`);
  const frame = at("<iframe");
  const anchor = at(FRAME_FALLBACK_LABEL);
  const caption = at("The demonstration booking page, shown inside this page:");
  const boxSentence = at(OPTION3_BOX_SENTENCE);
  const explanation = at("This option loads Google's booking page inside this page");
  const notes = at(`<div id="${FRAME_NOTES_ID}">`);
  expect(heading).toBeLessThan(box);
  expect(box).toBeLessThan(frame);
  expect(frame).toBeLessThan(anchor);
  expect(anchor).toBeLessThan(caption);
  expect(caption).toBeLessThan(boxSentence);
  expect(boxSentence).toBeLessThan(explanation);
  expect(explanation).toBeLessThan(notes);
});
test("nothing of ours sits between option 3's heading and its frame", () => {
  const heading = "<h2>Option 3 — the booking page in a frame</h2>";
  const afterHeading = SECTION.slice(SECTION.indexOf(heading) + heading.length, SECTION.indexOf("<iframe"));
  // Whitespace, the box's opening tag and the frame — no prose, no caption, no control.
  expect(afterHeading.trim()).toBe(`<div class="${FRAME_BOX_CLASS}">`);
});
test("the fallback anchor is a plain link under the box, to the same address", () => {
  const anchor = /<a class="[^"]+" href="([^"]+)" target="_blank" rel="noopener noreferrer">([^<]+)<\/a>/.exec(SECTION);
  expect(anchor).not.toBeNull();
  expect(anchor?.[1]).toBe(SECTION_URL);
  expect(anchor?.[2]).toBe(`${FRAME_FALLBACK_LABEL}&nbsp;↗`);
  expect(FRAME_FALLBACK_LABEL).toBe("Open the booking page on its own");
});
test("the frame is eager, borderless, and the box is visible with nothing loaded in it", () => {
  const frame = /<iframe\b[^>]*>/.exec(SECTION)?.[0] ?? "";
  expect(frame).toContain('loading="eager"');
  expect(frame).not.toContain("lazy");
  expect(frame).toContain('style="display:block;width:100%;border:0"');
  const style = comparisonStyleBlock();
  expect(style).toContain(`.${FRAME_BOX_CLASS} {`);
  expect(style).toContain("border: var(--rule)");
  expect(style).toContain("background: var(--paper)");
  expect(style).toContain("padding: var(--s-2)");
});
test("the frame's height answers to the screen in both views, and never to the whole viewport", () => {
  const style = comparisonStyleBlock();
  expect(style).toContain(`.${FRAME_BOX_CLASS} iframe { height: ${FRAME_PHONE_HEIGHT}; }`);
  expect(style).toContain(`@media (min-width: ${FRAME_BREAKPOINT})`);
  expect(style).toContain(`.${FRAME_BOX_CLASS} iframe { height: ${FRAME_DESKTOP_HEIGHT}; }`);
  expect(FRAME_PHONE_HEIGHT).toBe("max(520px, 72vh)");
  expect(FRAME_DESKTOP_HEIGHT).toBe("min(760px, 78vh)");
  expect(style).not.toMatch(/\b100(?:vh|svh|dvh)\b/);
});
test("every option-3 sentence the copy document fixes is still on the page, and the stale measurement is gone", () => {
  for (const sentence of OPTION3_MANDATED_STRINGS) {
    expect(SECTION).toContain(sentence);
  }
  expect(OPTION3_MANDATED_STRINGS).toContain(OPTION3_BOX_SENTENCE);
  expect(OPTION3_BOX_SENTENCE).toContain("most of your screen");
  expect(SECTION).not.toContain(OPTION3_STALE_MEASUREMENT);
  expect(OPTION3_STALE_MEASUREMENT).toBe("600 pixels");
});
