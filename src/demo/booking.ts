/**
 * Site Sourced — the booking link, and the three modes it exists in.
 *
 * A page may offer a visitor a **time**. Whether it may, and what the link is allowed
 * to point at, is not a matter of someone remembering which phase we are in: it is
 * **derived from the record** and written into the bundle manifest, the same way the
 * form's delivery phase is (`delivery.ts`).
 *
 * Three modes exist, and only three (gbp-and-booking-handoff.md §5.3):
 *
 *   `none`      the record carries no booking page at all — or it is **Family B**, an
 *               inquiry page, which asks for a described need and never for a time. No
 *               page changes; every page is the approved copy, byte for byte.
 *   `demo`      the record's booking page **is our demonstration schedule** — the one
 *               the owner creates (gbp §5.2). The link is real (a time really can be
 *               chosen there) and so is the notice beside it: the booking is with Site
 *               Sourced, not with the business named on the page.
 *   `business`  the record's booking page is the **business's own**. A prospect's real
 *               booking page is never used before they sign, so this mode may only be
 *               built in the delivered phase; in the demonstration phase the build
 *               refuses it.
 *
 * The comparison is the record's `booking_url` against the configured demonstration
 * page (`DEMO_BOOKING_URL`). A record therefore never carries a literal demonstration
 * URL in git: it carries `"env:DEMO_BOOKING_URL"`, exactly as `form_access_key` carries
 * `"env:SS_FORMSPARK_FORM_ID"`, and the value lives in the gitignored `.env.local`. With
 * the variable unset — which is the state of this repository until the owner creates the
 * page — the record resolves to `none` and the four fixtures render byte-identically.
 *
 * Fail-safe direction: an unset, unreadable or unresolvable booking page resolves to
 * `none`, so an incomplete configuration can only ever make a page say *less*, never
 * more. Nothing here throws; the guard that decides publishability is
 * `bookingProblems` in `build.ts`.
 */

import type { BusinessRecord } from "./types.ts";
/** Type-only: the family is defined where the classification table lives (`family.ts`). */
import type { ConversionFamily } from "./family.ts";

export type BookingMode = "none" | "demo" | "business";

export interface ResolvedBooking {
  mode: BookingMode;
  /** The URL the link points at, or `""` when nothing renders. */
  url: string;
  /** Plain-English reason for the determination — carried into the manifest. */
  basis: string;
}

/** The configuration key the record points at with `env:DEMO_BOOKING_URL`. */
export const DEMO_BOOKING_URL_VAR = "DEMO_BOOKING_URL";

/**
 * The arrow on the booking anchor: a **text glyph**, not an icon file. It carries no
 * request, no image and no stylesheet rule, and it survives with CSS off.
 */
export const BOOKING_ARROW = "↗";

/**
 * The class that gives the booking control its 44px box — and it is a class the 44px
 * audit actually measures (`TAP_TARGET_CLASSES`, build.ts). Everything about this choice
 * is a claim the build can check, which is why it lives here as data and not in the
 * template:
 *
 *   - `.link-quiet` is `color: var(--muted)` — `#5E6672` — which is a **paper-surface**
 *     colour. The control sits in the contact pages' `section--alt` (`--paper-2`,
 *     `#FAF7F2`), and the browser-measured contrast there is **5.43:1** (6.96:1 for the
 *     focus ring); the reading and the method are in
 *     `design/booking-measurements-E2.log`.
 *   - `.button--ghost` was the first draft and it was **wrong**: it is the hero's
 *     white-on-photograph treatment (`color:#fff` over `rgba(255,255,255,.1)`, over the
 *     hero scrim it was built for). On paper that is white on near-white — about 1.05:1 —
 *     and `button--ghost` is **not among the classes the tap-target audit sizes**, so the
 *     audit would not have caught it either. Two independent reviews found this; it must
 *     not come back, and `bookingAnchorSizeProblems` refuses it if it does.
 */
export const BOOKING_ANCHOR_SIZE_CLASS = "link-quiet";

/**
 * The classes the booking anchor wears, in one place: the renderer draws them and the
 * build check reads them, so the shape the check refuses and the shape the page ships
 * cannot drift apart. `--inline` is the existing modifier that cancels `.link-quiet`'s
 * left offset, which is what keeps the control **left-aligned with the form's 34rem
 * measure** rather than indented from it (lead correction C2, 8 Oct 2026). No new CSS:
 * both classes ship already.
 */
export const BOOKING_ANCHOR_CLASS = `${BOOKING_ANCHOR_SIZE_CLASS} link-quiet--inline`;

/**
 * The `env:NAME` indirection, read the way `forms.ts` reads `form_access_key`: the
 * record names a **variable**, never a value, so no per-client URL is ever committed.
 * An unset variable resolves to the empty string, which is `none` — the fail-safe
 * direction.
 */
function resolveEnvRef(value: string): { value: string; name: string } | null {
  if (!value.startsWith("env:")) return null;
  const name = value.slice(4).trim();
  return { value: (process.env[name] ?? "").trim(), name };
}

/**
 * Decide what booking link this record may carry, from the record alone.
 *
 * `demoUrl` is the configured demonstration booking page, read once at the build
 * boundary (`build.ts`) — never inside the renderer. `family` is the family the record
 * resolved to (`family.ts`); an inquiry page renders no booking link whatever the
 * record carries, which is why this argument is taken rather than re-derived here.
 */
export function resolveBooking(
  record: BusinessRecord,
  demoUrl = "",
  family?: ConversionFamily,
): ResolvedBooking {
  const raw = (record.booking_url ?? "").trim();
  const configured = demoUrl.trim();

  if (family === "inquiry") {
    return {
      mode: "none",
      url: "",
      basis:
        "the record is Family B (inquiry): an inquiry page passes on a described need and asks for no time, so no booking link is rendered on it, whatever the record carries",
    };
  }

  if (raw === "") {
    return { mode: "none", url: "", basis: "the record carries no booking_url, so this build has no booking page to link to" };
  }

  const ref = resolveEnvRef(raw);
  const url = ref ? ref.value : raw;
  if (ref && url === "") {
    return {
      mode: "none",
      url: "",
      basis: `the record's booking_url names the environment variable ${ref.name} ("${raw}"), which is not set in this build, so there is no booking page to link to`,
    };
  }
  if (url === "") {
    return { mode: "none", url: "", basis: "the record's booking_url is blank, so this build has no booking page to link to" };
  }

  if (configured !== "" && url === configured) {
    return {
      mode: "demo",
      url,
      basis: `the record's booking_url (${url}) is the configured demonstration booking page (${DEMO_BOOKING_URL_VAR}), so this link opens our own demonstration schedule and not a business's`,
    };
  }

  return {
    mode: "business",
    url,
    basis:
      configured === ""
        ? `the record's booking_url (${url}) is not the configured demonstration booking page — ${DEMO_BOOKING_URL_VAR} is not set in this build — so the link points at a business's own booking page`
        : `the record's booking_url (${url}) is not the configured demonstration booking page (${configured}), so the link points at a business's own booking page`,
  };
}

/**
 * Which pages carry a booking link at all: exactly the pages where the visitor is
 * already deciding how to ask for a time — the contact section, `contact.html` and
 * every `contact-<service>.html` (lead ruling, 8 Oct 2026).
 *
 * The **header's** primary-action slot is untouched in `demo` mode, and the home,
 * services, about and privacy pages carry no booking anchor of their own: the notice
 * that keeps a demonstration link honest has to be readable *before* the tap, and the
 * header has no room for a paragraph. A link that leaves our site must never stand
 * under the neutral `Contact Us` label either — that is the defect class the honesty
 * rule exists to prevent. In `business` mode the header slot does carry the client's
 * booking page, because a client's own site has nothing to hide from the tap.
 */
export function bookingBelongs(file: string, contactFile: string): boolean {
  return file === contactFile || file.startsWith("contact-");
}
