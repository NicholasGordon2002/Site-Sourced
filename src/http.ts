/**
 * Polite, cached HTTP.
 *
 * Rules we hold to here:
 *  - one descriptive User-Agent everywhere (override with SS_USER_AGENT),
 *  - short timeouts, never hang the run,
 *  - retry only on genuinely transient failures (429/5xx/network), with backoff,
 *  - every response (and every failure) written to a disk cache so re-runs
 *    do not re-hit Overpass, Nominatim or the prospect's server,
 *  - per-host serialisation so we never fire two requests at one host at once.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { HttpRecord } from "./types.ts";

export const USER_AGENT =
  process.env.SS_USER_AGENT ??
  "SiteSourced-LeadEngine/0.1 (Ontario local-business lead research; OSM/Overpass data + one-page site health check; set SS_USER_AGENT to add a contact address)";

const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 520, 522, 524]);
const TEXTY = /^(text\/|application\/(json|xml|xhtml|javascript|ld\+json)|image\/svg)/i;

export function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export interface FetchOptions {
  url: string;
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  retries?: number;
  backoffMs?: number;
  /** Directory for the on-disk cache; `null` disables caching entirely. */
  cacheDir?: string | null;
  cacheTtlMs?: number;
  /** Failures are cached for a shorter window so we do not re-hammer dead hosts. */
  errorCacheTtlMs?: number;
  refresh?: boolean;
  label?: string;
  onNote?: (msg: string) => void;
}

function cachePath(dir: string, url: string, method: string, body?: string) {
  const h = createHash("sha256").update(`${method}\n${url}\n${body ?? ""}`).digest("hex").slice(0, 40);
  return join(dir, `${h}.json`);
}

async function readCache(file: string): Promise<HttpRecord | null> {
  try {
    const raw = await readFile(file, "utf8");
    const rec = JSON.parse(raw) as HttpRecord;
    if (!rec || typeof rec.url !== "string") return null;
    return rec;
  } catch {
    return null;
  }
}

async function writeCache(file: string, rec: HttpRecord) {
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(rec), "utf8");
  } catch {
    /* cache is best-effort; never fail a run over it */
  }
}

// --- per-host serialisation -------------------------------------------------

const hostChain = new Map<string, Promise<unknown>>();

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Queue `fn` behind any in-flight request to the same host. */
async function serialise<T>(url: string, fn: () => Promise<T>): Promise<T> {
  const host = hostOf(url);
  const prev = hostChain.get(host) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  hostChain.set(
    host,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

// --- one raw fetch ----------------------------------------------------------

async function fetchOnce(opts: FetchOptions): Promise<HttpRecord> {
  const {
    url,
    method = "GET",
    body,
    headers = {},
    timeoutMs = 20000,
    maxBytes = 2_000_000,
  } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = new Date().toISOString();

  try {
    const res = await fetch(url, {
      method,
      body,
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "*/*", ...headers },
    });

    const hdrs: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      hdrs[k.toLowerCase()] = v;
    });

    let byteLength = 0;
    let byteLengthExact = true;
    let truncated = false;
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let text = "";
    let cancelled = false;

    const clRaw = hdrs["content-length"];
    const declared = clRaw !== undefined ? Number(clRaw) : NaN;
    const texty = TEXTY.test(hdrs["content-type"] ?? "") || !hdrs["content-type"];

    const reader = res.body?.getReader();
    if (reader) {
      while (true) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch {
          break; // truncated transfer — keep what we have
        }
        if (chunk.done) break;
        const value = chunk.value;
        byteLength += value.byteLength;
        if (texty && !truncated) {
          if (byteLength <= maxBytes) {
            text += decoder.decode(value, { stream: true });
          } else {
            // keep the head of the document, drop the rest
            const keep = maxBytes - (byteLength - value.byteLength);
            if (keep > 0) text += decoder.decode(value.subarray(0, keep), { stream: true });
            truncated = true;
            try {
              await reader.cancel();
            } catch {
              /* ignore */
            }
            cancelled = true;
          }
        } else if (!texty) {
          truncated = true;
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          cancelled = true;
        }
        if (cancelled) break;
      }
    }

    if (cancelled) {
      if (!Number.isNaN(declared)) {
        byteLength = declared;
      } else {
        byteLengthExact = false; // we only know it was at least maxBytes
      }
    }
    if (Number.isNaN(declared) && truncated) byteLengthExact = false;

    return {
      url,
      finalUrl: res.url || url,
      status: res.status,
      ok: res.ok,
      headers: hdrs,
      body: text,
      byteLength,
      byteLengthExact,
      truncated,
      redirected: Boolean(res.url) && res.url !== url,
      error: null,
      errorKind: "",
      fetchedAt: started,
    };
  } catch (err) {
    const e = err as { name?: string; message?: string; cause?: { code?: string; message?: string } };
    const aborted = e?.name === "AbortError" || e?.name === "TimeoutError";
    const code = e?.cause?.code ?? "";
    const msg = e?.message ?? String(err);
    return {
      url,
      finalUrl: url,
      status: 0,
      ok: false,
      headers: {},
      body: "",
      byteLength: 0,
      byteLengthExact: true,
      truncated: false,
      redirected: false,
      error: aborted ? `timeout after ${timeoutMs}ms` : code ? `${code}: ${msg}` : msg,
      errorKind: aborted ? "timeout" : code || "network",
      fetchedAt: started,
    };
  } finally {
    clearTimeout(timer);
  }
}

// --- cached + retrying fetch ------------------------------------------------

export async function politeFetch(opts: FetchOptions): Promise<HttpRecord> {
  const {
    url,
    method = "GET",
    body,
    retries = 3,
    backoffMs = 1500,
    cacheDir = null,
    cacheTtlMs = 7 * 24 * 3600 * 1000,
    errorCacheTtlMs = 6 * 3600 * 1000,
    refresh = false,
    label,
    onNote,
  } = opts;

  const file = cacheDir ? cachePath(cacheDir, url, method, body) : null;
  if (file && !refresh) {
    const cached = await readCache(file);
    if (cached) {
      const age = Date.now() - Date.parse(cached.fetchedAt);
      const ttl = cached.error ? errorCacheTtlMs : cacheTtlMs;
      if (Number.isFinite(age) && age >= 0 && age < ttl) {
        return { ...cached, fromCache: true };
      }
    }
  }

  let last: HttpRecord | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const wait = Math.round(backoffMs * Math.pow(3, attempt - 1) * (0.8 + Math.random() * 0.4));
      onNote?.(`  retry ${attempt}/${retries} in ${wait}ms — ${label ?? url} (last: ${last?.error || `HTTP ${last?.status}`})`);
      await sleep(wait);
    }
    last = await serialise(url, () => fetchOnce(opts));
    const transient = Boolean(last.error) || RETRY_STATUS.has(last.status);
    if (!transient) break;
  }

  if (file && last) await writeCache(file, last);
  return last!;
}

/** Small helper so callers can grab a header case-insensitively. */
export function header(rec: HttpRecord, name: string): string {
  return rec.headers[name.toLowerCase()] ?? "";
}
