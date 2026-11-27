/**
 * The durable suppression list.
 *
 * Keyed on the email address, normalised (trimmed, lower-cased, `mailto:` dropped).
 * An entry is only ever added: nothing in this module removes one, and adding an
 * address that is already on the list keeps the first entry's reason and date.
 * That is what "a later lead can never override" means in code — a fresh Overpass
 * pull, a fresh consent note or a newer record cannot put a suppressed address
 * back into a list.
 *
 * A list that cannot be read is an error, never an empty list: treating a corrupt
 * file as "nobody is suppressed" would silently un-suppress everyone.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Lead } from "./types.ts";

export const SUPPRESSION_VERSION = 1;

export interface SuppressionEntry {
  /** Normalised address — the key. */
  address: string;
  /** Why it is on the list: `unsubscribe`, `hard-block`, `manual`, `complaint`. */
  reason: string;
  /** ISO 8601 date the entry was recorded. */
  added_at: string;
  note: string;
}

interface SuppressionFile {
  version: number;
  note: string;
  entries: SuppressionEntry[];
}

export function normaliseAddress(raw: string | null | undefined): string {
  const v = String(raw ?? "")
    .trim()
    .replace(/^mailto:/i, "")
    .toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : "";
}

export class SuppressionList {
  readonly path: string;
  private readonly byAddress = new Map<string, SuppressionEntry>();

  private constructor(path: string, entries: SuppressionEntry[]) {
    this.path = path;
    for (const e of entries) {
      const key = normaliseAddress(e.address);
      if (!key || this.byAddress.has(key)) continue; // first entry wins
      this.byAddress.set(key, { ...e, address: key });
    }
  }

  static async load(path: string): Promise<SuppressionList> {
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return new SuppressionList(path, []);
      throw new Error(`cannot read the suppression list at ${path}: ${(err as Error).message}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`the suppression list at ${path} is not valid JSON: ${(err as Error).message}`);
    }
    const file = parsed as Partial<SuppressionFile>;
    if (!file || !Array.isArray(file.entries)) {
      throw new Error(`the suppression list at ${path} has no "entries" array — refusing to treat it as empty`);
    }
    for (const e of file.entries) {
      if (!e || typeof e.address !== "string") {
        throw new Error(`the suppression list at ${path} has an entry with no address`);
      }
    }
    return new SuppressionList(path, file.entries as SuppressionEntry[]);
  }

  get size(): number {
    return this.byAddress.size;
  }

  entries(): SuppressionEntry[] {
    return [...this.byAddress.values()].sort((a, b) => a.address.localeCompare(b.address));
  }

  /** The entry for this address, or null. Never removes anything. */
  has(raw: string | null | undefined): SuppressionEntry | null {
    const key = normaliseAddress(raw);
    return key ? (this.byAddress.get(key) ?? null) : null;
  }

  /**
   * Record an address. Idempotent: an address already on the list keeps its first
   * reason and date, so a later lead cannot rewrite the evidence.
   */
  async add(
    raw: string | null | undefined,
    opts: { reason: string; note?: string; addedAt?: string },
  ): Promise<{ added: boolean; entry: SuppressionEntry }> {
    const key = normaliseAddress(raw);
    if (!key) throw new Error(`not an email address: ${String(raw ?? "").trim() || "(empty)"}`);
    const existing = this.byAddress.get(key);
    if (existing) return { added: false, entry: existing };
    const entry: SuppressionEntry = {
      address: key,
      reason: opts.reason.trim() || "unspecified",
      added_at: opts.addedAt ?? new Date().toISOString().slice(0, 10),
      note: (opts.note ?? "").trim(),
    };
    this.byAddress.set(key, entry);
    await this.save();
    return { added: true, entry };
  }

  /** Split leads into those that may go on, and those a suppression entry stops. */
  filter(leads: Lead[]): { kept: Lead[]; dropped: Array<{ lead: Lead; entry: SuppressionEntry }> } {
    const kept: Lead[] = [];
    const dropped: Array<{ lead: Lead; entry: SuppressionEntry }> = [];
    for (const lead of leads) {
      const entry = this.has(lead.email);
      if (entry) dropped.push({ lead, entry });
      else kept.push(lead);
    }
    return { kept, dropped };
  }

  private async save(): Promise<void> {
    const file: SuppressionFile = {
      version: SUPPRESSION_VERSION,
      note: "Durable suppression list. Entries are only ever added — never removed, never rewritten by a later lead.",
      entries: this.entries(),
    };
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    await writeFile(tmp, `${JSON.stringify(file, null, 2)}\n`, "utf8");
    await rename(tmp, this.path);
  }
}
