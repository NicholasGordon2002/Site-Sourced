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
