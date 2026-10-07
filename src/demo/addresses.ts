/**
 * Site Sourced — every email address a bundle prints or posts to, and whether it
 * could possibly work.
 *
 * Two halves of one rule live here, and nowhere else:
 *
 *   - the **form recipient** — where a visitor's message is posted;
 *   - the **printed addresses** — every address a page shows a visitor as a way to
 *     reach the business.
 *
 * They are answered by one function (`undeliverableAddressProblems`) against one
 * predicate (`isUndeliverable`), so the half that reads the rendered page and the half
 * that reads the record cannot drift apart. That drift is exactly how the guard missed
 * this: it only ever looked at the form's recipient, while the pages told visitors to
 * write to `shop@mapleavenuebarber.example` — an address reserved by RFC 2606, which
 * can never receive mail.
 *
 * **What this deliberately does not do:** verify that a mailbox exists. The build is
 * offline and deterministic — no DNS, no MX lookups, no SMTP probe — and a prospect's
 * mailbox could not be checked from here anyway. An address that is merely *unverified*
 * is fine, and is what the printed "as published in public listings — please confirm"
 * caveat is for. This refuses only addresses that **provably cannot work**: reserved /
 * special-use domains (RFC 2606 / RFC 6761), values that are not addresses at all, and
 * empty ones. Known-dead domains can be added to `DEAD_MAIL_DOMAINS` below; there are
 * none recorded yet, because the lead engine's health checks measure websites, not
 * mailboxes.
 */

import type { FormDeliveryMode } from "./delivery.ts";
import type { ResolvedForm } from "./forms.ts";
import type { BusinessRecord } from "./types.ts";

/** Lower-case and strip a `mailto:` prefix, so comparisons are about the address. */
export function normaliseAddress(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase().replace(/^mailto:/, "");
}

/**
 * Domains reserved by RFC 2606 / RFC 6761 for documentation and testing. They can
 * never receive mail, so a page that prints one as the way to reach the business — or
 * posts a visitor's message to one — is a page that lies about reaching anyone.
 */
const RESERVED_DOMAIN = /^[^@\s]+@(?:[^@\s]*\.)?(?:example|test|invalid|localhost|local)(?:\.(?:com|net|org))?$/i;

/**
 * Domains whose mail we already know does not work, from a bounce or a provider's own
 * statement. Empty today — nothing has been recorded — and kept here so that evidence,
 * when it exists, lands in the one predicate both callers share.
 */
export const DEAD_MAIL_DOMAINS: string[] = [];

/** A domain a public mail server could exist at: at least two labels, no bad edges. */
const WELL_FORMED_DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * True when the value cannot possibly work as an address: empty, not address-shaped,
 * on a reserved or known-dead domain, or on a domain no public mail could live at.
 * Never true merely because an address is unverified.
 */
export function isUndeliverable(address: string | undefined | null): boolean {
  const a = normaliseAddress(address);
  const at = a.indexOf("@");
  if (at <= 0 || at === a.length - 1) return true; // empty, or no local part / no domain
  const domain = a.slice(at + 1);
  if (/\s/.test(a)) return true;
  if (RESERVED_DOMAIN.test(a)) return true;
  if (DEAD_MAIL_DOMAINS.some((d) => domain === d.toLowerCase() || domain.endsWith(`.${d.toLowerCase()}`))) return true;
  return !WELL_FORMED_DOMAIN.test(domain);
}

/** One address, and where on a page a visitor meets it. */
export interface AddressUse {
  /** The address as the page writes it. */
  address: string;
  /** Where it is printed, in the words a failure message needs. */
  places: string[];
}

/**
 * Every email address a rendered page prints or links to.
 *
 * Read from the HTML rather than from the record on purpose: what matters is what a
 * visitor can actually read, and a record whose address never reaches the page cannot
 * mislead anyone. Both shapes count — the `mailto:` an address is linked through, and
 * the address as plain text (which is how the privacy notice prints ours).
 */
export function addressesPrintedIn(page: { file: string; html: string }): AddressUse[] {
  const found = new Map<string, AddressUse>();
  const add = (raw: string, place: string) => {
    const address = raw.trim();
    const key = normaliseAddress(address);
    if (!key) return;
    const existing = found.get(key);
    if (existing) {
      if (!existing.places.includes(place)) existing.places.push(place);
      return;
    }
    found.set(key, { address, places: [place] });
  };
  for (const m of page.html.matchAll(/mailto:([^"'?>\s]+)/gi)) add(m[1]!, `the email link on ${page.file}`);
  for (const m of page.html.matchAll(/[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
    add(m[0], `the text of ${page.file}`);
  }
  return [...found.values()];
}

/** Every address printed on any of the pages, deduplicated by address. */
export function printedAddresses(pages: { file: string; html: string }[]): AddressUse[] {
  const merged = new Map<string, AddressUse>();
  for (const page of pages) {
    for (const use of addressesPrintedIn(page)) {
      const key = normaliseAddress(use.address);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { address: use.address, places: [...use.places] });
        continue;
      }
      for (const place of use.places) if (!existing.places.includes(place)) existing.places.push(place);
    }
  }
  return [...merged.values()];
}

/* ---------------------------------------------------------------- the address line */

/**
 * The street address as every page writes it: street, city, province and postcode, with
 * an empty part dropped rather than left as a stray comma. `""` when the record records
 * no address at all.
 *
 * It lives here, beside the other "what does this page actually print?" questions, so the
 * footer that prints it (`render.ts`) and the caveat that enumerates it (`provenance.ts`)
 * read one function and cannot drift apart — the same reason `normaliseAddress` is shared.
 */
export function addressLine(record: BusinessRecord): string {
  const a = record.address ?? {};
  const parts = [a.street, a.city, [a.province, a.postcode].filter(Boolean).join(" ")].filter((p) => p && p.trim());
  return parts.join(", ");
}

/**
 * Which of the business's details a printed-details page really prints for this record,
 * in the order the owner's caveat names them.
 *
 * The distinction matters because the caveat that qualifies those details must name
 * **exactly** the ones the page shows (owner ruling, 4 Oct): an address the record does
 * not carry is never named, and a phone number the page does not print is not named
 * either. Derived from the record, so nothing has to remember.
 */
export type PrintedDetail = "address" | "phone number" | "email address";

export function printedDetails(record: BusinessRecord): PrintedDetail[] {
  const out: PrintedDetail[] = [];
  if (addressLine(record).trim()) out.push("address");
  if ((record.phone ?? "").trim()) out.push("phone number");
  if ((record.email ?? "").trim()) out.push("email address");
  return out;
}

/* ------------------------------------------------------------- the phone number model */

/**
 * The reserved range a **fictional** fixture's phone number has to sit in
 * (`555-0100…0199`, WORKFLOW.md rule 9). The range exists in every North American
 * numbering plan for fiction and testing, so a number inside it cannot be a real
 * business's line — which is exactly what a made-up business needs, and what makes the
 * label "Phone (example):" true rather than a fig leaf.
 */
export const EXAMPLE_PHONE_RANGE = "555-0100…0199";

/** Digits only — the shape a phone number is compared in. */
function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/** Ten digits of a North American number, with a leading country code dropped. */
function nationalDigits(value: string): string {
  const d = digitsOf(value);
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

/** True when the value is a number inside the reserved fictional range. */
export function isExamplePhoneNumber(value: string): boolean {
  const d = nationalDigits(value);
  if (d.length !== 10 || d.slice(3, 6) !== "555") return false;
  const subscriber = Number(d.slice(6));
  return subscriber >= 100 && subscriber <= 199;
}

/**
 * Which of the owner's three phone versions a build is in, and on what basis.
 *
 *   `client`     a delivered site (`delivery.mode` `business`): the client's own recorded
 *                number, confirmed at hand-off. A client build with none is broken, not
 *                cautious, so the build refuses it.
 *   `published`  a personalised demo built from a real business's record: the business's
 *                **own** publicly listed number, labelled as such, with the page's caveat
 *                asking the visitor to confirm it. Never any other real number.
 *   `example`    a test demo with no business behind it (a fictional fixture): a number
 *                inside the reserved range, labelled "Phone (example):". The word
 *                "published" may never describe an invented number.
 *   `none`       no number prints (a demonstration may show none; a client build may not).
 */
export type PhoneMode = "client" | "published" | "example" | "none";

export interface ResolvedPhone {
  mode: PhoneMode;
  /** The number the record carries, as the record wrote it — `""` when it carries none. */
  number: string;
  /** The label printed in front of it on the page. */
  label: string;
  /** Plain-English reason for the determination, carried into the manifest. */
  basis: string;
}

/**
 * Resolve the phone version from the build's phase and the record's source.
 *
 * Never throws and never guesses a number: an odd input produces a mode the build then
 * refuses, rather than a page that prints a number nobody recorded.
 */
export function resolvePhone(vars: {
  record: BusinessRecord;
  phase: FormDeliveryMode;
  /** The record's `source_kind` is `fictional` — a made-up business with no listing. */
  fictional: boolean;
}): ResolvedPhone {
  const { record, phase, fictional } = vars;
  const number = (record.phone ?? "").trim();
  const who = `the record for ${record.name}`;

  if (phase === "business") {
    return {
      mode: number ? "client" : "none",
      number,
      label: "Phone:",
      basis: number
        ? `${who} is a delivered site (the form delivers to the business), so the page prints the client's own recorded number`
        : `${who} is a delivered site but carries no phone number, so the client's page would have no way to be called`,
    };
  }
  if (!number) {
    return {
      mode: "none",
      number: "",
      label: "Phone:",
      basis: `${who} is a demonstration and carries no phone number, so no number is printed — no number is ever invented for a page`,
    };
  }
  if (fictional) {
    return {
      mode: "example",
      number,
      label: "Phone (example):",
      basis: `${who} is a fictional example business, so the only honest number is one inside the reserved range ${EXAMPLE_PHONE_RANGE}, labelled as an example and never as published`,
    };
  }
  return {
    mode: "published",
    number,
    label: "Phone:",
    basis: `${who} is a real business's own published number on a demonstration page, so it prints with the caveat that asks the visitor to confirm it with the business`,
  };
}

/**
 * Every phone number a rendered page (or the delivered README) prints or dials.
 *
 * Read from the HTML on purpose, exactly like `addressesPrintedIn`: what matters is what
 * a visitor can read or tap, and a number that never reaches the page cannot mislead
 * anyone. Both shapes count — the `tel:` a number is dialled through, and the number as
 * plain text — because a real number can leak in through the header's Call button, the
 * hero's call-to-action pair, the contact-details block or the fallback block, and a
 * number only one of those prints is still printed.
 */
export function phonesPrintedIn(page: { file: string; html: string }): { number: string; places: string[] }[] {
  const found = new Map<string, { number: string; places: string[] }>();
  const add = (raw: string, place: string) => {
    const number = raw.trim();
    const key = nationalDigits(number);
    if (key.length < 10) return;
    const existing = found.get(key);
    if (existing) {
      if (!existing.places.includes(place)) existing.places.push(place);
      return;
    }
    found.set(key, { number, places: [place] });
  };

  for (const m of page.html.matchAll(/href="tel:([^"]*)"/gi)) add(m[1]!, `the call link on ${page.file}`);
  // A run of digits and the punctuation a phone number is written with. The digit count
  // is what decides: a postcode, a year or a font weight never reaches ten digits.
  for (const m of page.html.matchAll(/\+?\d[\d\s().-]{7,}\d/g)) {
    const raw = m[0]!;
    const digits = digitsOf(raw);
    if (digits.length !== 10 && !(digits.length === 11 && digits.startsWith("1"))) continue;
    // A number written with no separators at all is almost always an id (a srcset width,
    // a pixel size, a timestamp) rather than something a visitor reads as a phone number.
    add(raw, `the text of ${page.file}`);
  }
  return [...found.values()];
}

/**
 * Every phone number printed on any of the pages, deduplicated by its digits.
 */
export function printedPhones(pages: { file: string; html: string }[]): { number: string; places: string[] }[] {
  const merged = new Map<string, { number: string; places: string[] }>();
  for (const page of pages) {
    for (const use of phonesPrintedIn(page)) {
      const key = nationalDigits(use.number);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { number: use.number, places: [...use.places] });
        continue;
      }
      for (const place of use.places) if (!existing.places.includes(place)) existing.places.push(place);
    }
  }
  return [...merged.values()];
}

/** The text a visitor reads immediately around one printed number, tags stripped. */
function around(html: string, value: string): string {
  const at = html.indexOf(value);
  if (at < 0) return "";
  return html
    .slice(Math.max(0, at - 160), at + value.length + 160)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * The one guard over every phone number a bundle would print or dial, as sentences a
 * build can print.
 *
 * Called from the single compliance self-check in `build.ts`, and as deliberately narrow
 * as `undeliverableAddressProblems` beside it: it reads the rendered pages, never the
 * renderer's intent, because a number that reaches one of the five places a page can show
 * one is a number a visitor can read. Every clause below is a case where the page would
 * claim something about a phone that the record does not support:
 *
 *   - a number printed that is not the record's own (a leaked or invented number, in any
 *     phase);
 *   - a fictional example business whose number falls outside the reserved range
 *     (`555-0100…0199`), so the "example" label would be false;
 *   - the word "published" describing an invented number;
 *   - a client's own site with no phone at all: broken, not cautious;
 *   - a sentence pointing a visitor at "the phone number printed with it" when the page
 *     prints no phone number.
 */
export function phoneProblems(vars: {
  record: BusinessRecord;
  phone: ResolvedPhone;
  phase: FormDeliveryMode;
  /** The record's source is `fictional` — nothing about it was ever published. */
  fictional: boolean;
  /** The rendered pages: what is actually printed, not what the record claims. */
  pages: { file: string; html: string }[];
  /** The delivered README, when the caller has it — it ships in the bundle too. */
  readme?: string;
}): string[] {
  const { record, phone, phase, fictional, pages } = vars;
  const problems: string[] = [];
  const own = nationalDigits(phone.number);

  if (phase === "business" && !phone.number) {
    problems.push(
      `${record.name} is a delivered site but the record carries no phone number, so the client's own pages would print none. ` +
        `A client build with no phone is broken rather than cautious: add the number confirmed at hand-off to the record and rebuild.`,
    );
  }

  if (fictional && phone.number && !isExamplePhoneNumber(phone.number)) {
    problems.push(
      `the record's phone number (${phone.number}) is outside the reserved range ${EXAMPLE_PHONE_RANGE}, and ${record.name} is a fictional example business. ` +
        `An invented number may only come from the range reserved for fiction, because any other number could be a real business's line — and the label "Phone (example):" would then be false. ` +
        `Move the number inside ${EXAMPLE_PHONE_RANGE} and rebuild.`,
    );
  }

  const surfaces: { file: string; html: string }[] = [...pages];
  if (vars.readme !== undefined) surfaces.push({ file: "README.txt", html: vars.readme });

  for (const surface of surfaces) {
    for (const use of phonesPrintedIn(surface)) {
      const key = nationalDigits(use.number);
      if (!own) {
        problems.push(
          `${use.places.join(" and ")} print the phone number ${use.number}, but the record carries no phone number for ${record.name}. ` +
            `No page may print a number nobody recorded: a number that is not the record's own is either invented or someone else's.`,
        );
        continue;
      }
      if (key !== own) {
        problems.push(
          `${use.places.join(" and ")} print the phone number ${use.number}, which is not the number recorded for ${record.name} (${phone.number}). ` +
            `A page may print only the business's own number (mode "${phone.mode}"): ${phone.basis}.`,
        );
      }
    }
  }

  if (fictional) {
    for (const surface of surfaces) {
      for (const use of phonesPrintedIn(surface)) {
        const context = around(surface.html, use.number);
        if (/publish/i.test(context)) {
          problems.push(
            `${surface.file} prints the invented number ${use.number} as published ("${context.trim()}"). ` +
              `The word "published" may never describe a number invented for a fictional example business: no listing anywhere carries it. ` +
              `Label it as an example instead.`,
          );
        }
      }
    }
  }

  // The sentence that points a visitor at a printed number. It is derived in `copy.ts`
  // (a record that prints no phone must not promise one), and this is the half that reads
  // the page a visitor actually gets rather than the composer's intent.
  if (!phone.number) {
    for (const surface of surfaces) {
      if (/phone number printed with/i.test(surface.html)) {
        problems.push(
          `${surface.file} tells a visitor to use "the phone number printed with it", but no phone number is recorded for ${record.name}, so no page prints one. ` +
            `A page may not send a visitor to a detail it does not show: drop the clause, and say what the page does offer.`,
        );
      }
    }
  }

  return problems;
}

/**
 * The one guard over every address a bundle would post a message to or print as a way
 * to reach the business, as sentences a build can print.
 *
 * Called from the single compliance self-check in `build.ts`. Both halves are here so
 * that a change to what counts as undeliverable changes both, and neither can be
 * forgotten: the form's recipient, and every address the pages print.
 */
export function undeliverableAddressProblems(vars: {
  record: BusinessRecord;
  form: ResolvedForm;
  /** The rendered pages: what is actually printed, not what the record claims. */
  pages: { file: string; html: string }[];
}): string[] {
  const { record, form, pages } = vars;
  const problems: string[] = [];

  // Half one: the address the form posts a visitor's message to.
  const recipient = (form.recipient ?? "").trim();
  if (isUndeliverable(recipient)) {
    problems.push(
      `the form's recipient "${recipient}" is a placeholder or malformed address that cannot receive mail, so a visitor's message would be lost and the page's promise to deliver it would be false. ` +
        `A bundle with a dead form recipient must not reach a public path.`,
    );
  }

  // Half two: every address the pages print. An address that is only unverified passes;
  // one that provably cannot work fails, whichever page carries it.
  for (const use of printedAddresses(pages)) {
    if (!isUndeliverable(use.address)) continue;
    problems.push(
      `${use.places.join(" and ")} print${use.places.length === 1 ? "s" : ""} "${use.address}" as a way to reach ${record.name}, but that address cannot receive mail ` +
        `(a reserved or malformed address, empty, or on a domain that cannot receive it). A page must not tell a visitor to write to an address that provably goes nowhere: ` +
        `drop the address from the record, or correct it, and rebuild. An address that is merely unverified is fine — that is what the printed caveat is for.`,
    );
  }

  return problems;
}
