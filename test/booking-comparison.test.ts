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
  FRAME_TITLE,
  OPTION1_LABEL,
  OPTION2_LABEL,
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
