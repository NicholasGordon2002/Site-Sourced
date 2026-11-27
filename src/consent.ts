/**
 * Consent evidence and the send gate.
 *
 * The plan's rule is "consent evidence per lead, or no send": a source URL, an
 * archived copy of the page the address was taken from, a relevance note and the
 * date the evidence was captured. This module decides whether a lead may be
 * offered to a sending step at all, and says why not when it may not.
 *
 * Nothing here sends anything, and nothing here fetches anything: the archived
 * copy is a saved file, so the marker scan runs on the same bytes every time.
 */

import { readFileSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import type { SuppressionList } from "./suppression.ts";
import { normaliseAddress } from "./suppression.ts";
import type { Lead } from "./types.ts";

/** The four evidence fields, in the order the plan names them. */
export const CONSENT_FIELDS = [
  ["consent_source_url", "source URL"],
  ["consent_archive_path", "archived copy"],
  ["consent_relevance_note", "relevance note"],
  ["consent_captured_at", "capture date"],
] as const satisfies ReadonlyArray<readonly [keyof Lead, string]>;

export type ConsentField = (typeof CONSENT_FIELDS)[number][0];

/** A relevance note shorter than this says nothing about why the lead is relevant. */
export const MIN_RELEVANCE_NOTE = 20;

/** A saved page bigger than this is not something we read for a marker. */
export const MAX_ARCHIVE_BYTES = 4 * 1024 * 1024;

const PLACEHOLDER_NOTE = /^(n\/?a|none|nil|todo|tbd|unknown|test|see above|-+|\.+)$/i;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const HTTP_URL = /^https?:\/\/[^\s/]+(\/[^\s]*)?$/i;

/**
 * Phrases a page uses to refuse unsolicited mail. Any one of them is a hard block:
 * the address is never a lead, whatever else the page says.
 */
const UNSOLICITED_MARKERS: ReadonlyArray<{ label: string; re: RegExp }> = [
  { label: "no unsolicited email", re: /\bno\s+unsolicited\s+(e-?mails?|mail|messages?|contact|marketing)/i },
  { label: "do not send unsolicited", re: /\b(do\s+not|don't|dont)\s+send\s+(us\s+|me\s+)?unsolicited/i },
  { label: "unsolicited email not welcome", re: /\bunsolicited\s+(e-?mails?|mail|messages?)\s+(are|is)\s+not\s+(welcome|accepted|wanted|read)/i },
  { label: "no cold email", re: /\bno\s+(cold\s+(e-?mails?|calls?)|unsolicited\s+(e-?mails?|calls?))\b/i },
  { label: "we do not accept unsolicited email", re: /\b(we|i)\s+(do\s+not|don't|dont)\s+(accept|want|read)\s+unsolicited/i },
];

/** The readable text of a saved page: tags, scripts, styles and comments removed. */
export function visibleText(source: string): string {
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;?/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ");
}

/** The "no unsolicited email" marker a page carries, or null. */
export function findUnsolicitedMarker(source: string): string | null {
  const plain = visibleText(source);
  for (const marker of UNSOLICITED_MARKERS) if (marker.re.test(plain)) return marker.label;
  return null;
}

export interface ConsentOptions {
  /** Directory a relative `consent_archive_path` is resolved against. Default: cwd. */
  archiveRoot?: string;
  /** "Now", for the capture-date check. Default: the clock. */
  now?: Date;
}

function isRealDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

/**
 * Every reason this lead may not be sent, in plain words. An empty array means the
 * evidence is complete and the source page carries no marker.
 */
export function consentProblems(lead: Lead, opts: ConsentOptions = {}): string[] {
  const problems: string[] = [];
  const root = opts.archiveRoot ?? process.cwd();
  const now = opts.now ?? new Date();
  const value = (field: ConsentField) => String(lead[field] ?? "").trim();

  // 1. All four pieces of evidence must be present ---------------------------
  for (const [field, label] of CONSENT_FIELDS) {
    if (!value(field)) {
      problems.push(`no ${label} (${field}) — consent evidence per lead, or no send`);
    }
  }

  // 2. Each piece must be usable evidence ------------------------------------
  const source = value("consent_source_url");
  if (source && !HTTP_URL.test(source)) {
    problems.push(`the source URL (${source}) is not a plain http(s) page address`);
  }

  const note = value("consent_relevance_note");
  if (note && (note.length < MIN_RELEVANCE_NOTE || PLACEHOLDER_NOTE.test(note))) {
    problems.push(
      `the relevance note says nothing about why this business is relevant (${note.length} characters, minimum ${MIN_RELEVANCE_NOTE}, and not a placeholder)`,
    );
  }

  const captured = value("consent_captured_at");
  if (captured && !isRealDate(captured)) {
    problems.push(`the capture date (${captured}) is not a real ISO 8601 date`);
  } else if (captured) {
    const when = new Date(captured);
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (when.getTime() > today.getTime() + 24 * 3600 * 1000) {
      problems.push(`the capture date (${captured}) is in the future`);
    }
  }

  // 3. The archived copy, and the marker it may carry ------------------------
  const archive = value("consent_archive_path");
  if (archive) {
    const path = isAbsolute(archive) ? archive : resolve(root, archive);
    let saved = "";
    try {
      const stat = statSync(path);
      if (!stat.isFile()) throw new Error("not a file");
      if (stat.size === 0) throw new Error("the file is empty");
      if (stat.size > MAX_ARCHIVE_BYTES) throw new Error(`larger than ${MAX_ARCHIVE_BYTES} bytes`);
      saved = readFileSync(path, "utf8");
    } catch (err) {
      problems.push(
        `the archived copy (${archive}) cannot be read as a saved page — ${(err as Error).message}; a copy we cannot read cannot be checked for a marker`,
      );
    }
    if (saved) {
      const marker = findUnsolicitedMarker(saved);
      if (marker) {
        problems.push(
          `the source page carried a "${marker}" marker — this address is a hard block, never a lead`,
        );
      }
    }
  }

  return problems;
}

/** True when the lead's evidence is complete and its source page carries no marker. */
export function isSendable(lead: Lead, opts: ConsentOptions = {}): boolean {
  return consentProblems(lead, opts).length === 0;
}

/** Throws with every reason at once — used where a lead is about to be handed on. */
export function assertSendable(lead: Lead, opts: ConsentOptions = {}): void {
  const problems = consentProblems(lead, opts);
  if (problems.length) {
    throw new Error(`${lead.name || lead.osm_id || "lead"} may not be sent:\n  - ${problems.join("\n  - ")}`);
  }
}

export interface SendGateOptions extends ConsentOptions {
  /** The durable suppression list. A suppressed address is refused even with perfect evidence. */
  suppression?: SuppressionList;
}

export interface SendGateResult {
  sendable: Lead[];
  refused: Array<{ lead: Lead; reasons: string[] }>;
}

/**
 * The send gate: consent evidence, a usable address, and the durable suppression
 * list. A lead that fails any of the three is refused with its reasons.
 */
export function sendableLeads(leads: Lead[], opts: SendGateOptions = {}): SendGateResult {
  const sendable: Lead[] = [];
  const refused: Array<{ lead: Lead; reasons: string[] }> = [];
  for (const lead of leads) {
    const reasons: string[] = [];
    const address = normaliseAddress(lead.email);
    if (!address) reasons.push("no email address to send to (the suppression list is keyed on it)");
    if (address && opts.suppression) {
      const entry = opts.suppression.has(address);
      if (entry) {
        reasons.push(
          `the address is on the durable suppression list (added ${entry.added_at}: ${entry.reason}) — a later lead can never override that`,
        );
      }
    }
    reasons.push(...consentProblems(lead, opts));
    if (reasons.length) refused.push({ lead, reasons });
    else sendable.push(lead);
  }
  return { sendable, refused };
}
