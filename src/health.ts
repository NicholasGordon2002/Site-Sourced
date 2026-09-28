/**
 * Site health check for `has_website` leads.
 *
 * One GET of the homepage with a real, descriptive User-Agent, short timeout,
 * redirects followed, HTML only. This is a link check, not a crawl: exactly one
 * request per site, cached on disk, never two at once for the same host.
 *
 * Conservative by design:
 *  - `outdated` is only ever returned with a concrete, quotable signal;
 *  - bot-blocked responses (401/403/429) are NOT treated as a broken site;
 *  - a site we were not allowed to check (robots.txt) is reported as `ok` with a
 *    reason saying so, rather than guessed at.
 */

import { header, politeFetch } from "./http.ts";
import { normaliseUrl, hostOfUrl } from "./classify.ts";
import type { SiteVerdict } from "./types.ts";

export interface HealthResult {
  verdict: SiteVerdict;
  reason: string;
  checked: boolean;
  http_status: string;
  final_url: string;
  https: string;
  viewport_meta: string;
  page_weight_bytes: string;
  evidence: string[];
}

export interface HealthOptions {
  cacheDir: string;
  refresh?: boolean;
  respectRobots?: boolean;
  timeoutMs?: number;
  onNote?: (m: string) => void;
}

const MAX_HTML_BYTES = 600_000;

// --- robots.txt -------------------------------------------------------------

async function robotsAllows(url: string, opts: HealthOptions): Promise<{ allowed: boolean; rule: string }> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return { allowed: true, rule: "" };
  }
  const rec = await politeFetch({
    url: `${origin}/robots.txt`,
    cacheDir: opts.cacheDir,
    cacheTtlMs: 7 * 24 * 3600 * 1000,
    refresh: opts.refresh,
    timeoutMs: 8000,
    retries: 0,
    maxBytes: 200_000,
    onNote: opts.onNote,
  });
  // No robots.txt, or the server refused to serve one -> nothing to obey.
  if (rec.error || rec.status === 404 || rec.status >= 500 || rec.status === 401 || rec.status === 403) {
    return { allowed: true, rule: "" };
  }
  if (rec.status !== 200) return { allowed: true, rule: "" };

  const lines = rec.body.split(/\r?\n/);
  type Group = { agents: string[]; disallow: string[]; allow: string[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "disallow") current.disallow.push(value);
    else if (field === "allow") current.allow.push(value);
  }

  const ourToken = "sitesourced";
  const specific = groups.find((g) => g.agents.some((a) => a !== "*" && ourToken.includes(a)));
  const group = specific ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return { allowed: true, rule: "" };

  // We only ever request "/", so only a rule that covers "/" can block us.
  const blocks = group.disallow.some((p) => p === "/" || p === "/*");
  const allows = group.allow.some((p) => p === "/" || p === "/*" || p === "");
  if (blocks && !allows) return { allowed: false, rule: `Disallow: / for ${group.agents.join(", ")}` };
  return { allowed: true, rule: "" };
}

// --- signal detection -------------------------------------------------------

interface Signals {
  parked: string[];
  outdated: string[];
  notes: string[];
  title: string;
  generator: string;
  copyrightYear: number | null;
  viewport: boolean;
  hasTableLayout: boolean;
  oldDoctype: boolean;
  flash: boolean;
}

const PARKED_PHRASES: Array<[RegExp, string]> = [
  [/this domain (is|may be) for sale/i, "text: \"this domain is for sale\""],
  [/buy this domain/i, "text: \"buy this domain\""],
  [/domain (is|has been) parked/i, "text: \"domain is parked\""],
  [/this (web ?)?(page|site) is parked/i, "text: \"this site is parked\""],
  [/parked (free )?(by|courtesy of)/i, "text: parked-domain notice"],
  [/(sedoparking|parkingcrew|afternic|hugedomains|dan\.com|brandbucket|undeveloped\.com)/i, "domain-marketplace host"],
  [/the (web ?)?page you are looking for (could not be found|is temporarily unavailable)/i, "text: page-not-found notice"],
  [/apache2? ubuntu default page/i, "server default page"],
  [/welcome to nginx/i, "nginx default page"],
  [/\bit works!\b/i, "Apache default page"],
  [/(cpanel|plesk|web hosting|future home of|placeholder (page|site)|default web page|site not published|no website configured here)/i, "host placeholder page"],
  [/this site is under construction/i, "text: \"under construction\""],
  [/website (is )?coming soon/i, "text: \"coming soon\""],
  [/under construction/i, "text: \"under construction\""],
  [/coming soon/i, "text: \"coming soon\""],
];

const GENERATOR_OLD: Array<[RegExp, string]> = [
  [/frontpage/i, "generator: Microsoft FrontPage"],
  [/dreamweaver/i, "generator: Adobe Dreamweaver"],
  [/microsoft word/i, "generator: Microsoft Word (\"Save as HTML\")"],
  [/microsoft publisher/i, "generator: Microsoft Publisher"],
  [/coffeecup/i, "generator: CoffeeCup HTML Editor"],
  [/iweb/i, "generator: Apple iWeb"],
  [/mambo/i, "generator: Mambo CMS"],
  [/joomla!?\s*(1\.|2\.)/i, "generator: Joomla 1.x/2.x"],
  [/drupal\s*[1-7]\b/i, "generator: Drupal 6/7 or older"],
  [/wordpress\s*([1-4])\./i, "generator: WordPress 4.x or older"],
  [/textpattern/i, "generator: Textpattern"],
  [/netscape/i, "generator: Netscape Composer"],
];

const MODERN_MARKERS =
  /(tailwind|bootstrap\s*[45]|__next|next\.js|nuxt|gatsby|astro|svelte|vite|webpack|wixstatic|squarespace|shopify|weebly|react|vue|data-reactroot)/i;

export function detectSignals(html: string, url: string, bytes: number): Signals {
  const head = html.slice(0, 200_000);
  const lower = head.toLowerCase();
  const parked: string[] = [];
  const outdated: string[] = [];
  const notes: string[] = [];

  const title = (/<title[^>]*>([\s\S]{0,200}?)<\/title>/i.exec(head)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const generator =
    /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']{0,120})["']/i.exec(head)?.[1]?.trim() ??
    /<meta[^>]+content=["']([^"']{0,120})["'][^>]+name=["']generator["']/i.exec(head)?.[1]?.trim() ??
    "";

  const viewport = /<meta[^>]+name=["']viewport["']/i.test(head);

  // Parked / placeholder detection.
  for (const [re, label] of PARKED_PHRASES) {
    if (!re.test(head)) continue;
    const isGenericComingSoon = /coming soon|under construction/i.test(label);
    const genericOk =
      !isGenericComingSoon || bytes < 20_000 || /coming soon|under construction|parked|for sale/i.test(title);
    if (genericOk) parked.push(label);
  }
  if (/index of \//i.test(title)) parked.push("directory listing as homepage");

  // Age signals.
  for (const [re, label] of GENERATOR_OLD) {
    if (re.test(generator)) outdated.push(label);
  }
  if (/<frameset/i.test(lower)) outdated.push("<frameset> layout");
  if (/<marquee/i.test(lower)) outdated.push("<marquee>");
  if (/<center[\s>]/i.test(lower)) outdated.push("<center> tag");
  if (/<font[\s>]/i.test(lower)) outdated.push("<font> tag");
  if (/<applet[\s>]/i.test(lower)) outdated.push("<applet>");
  if (/x-shockwave-flash|\.swf["'?]/i.test(lower)) outdated.push("Flash content");
  const doctype = /<!doctype[^>]*>/i.exec(head)?.[0] ?? "";
  const oldDoctype = /html\s+4\.0|xhtml\s+1\.[01]|html\s+3\.2/i.test(doctype);
  if (oldDoctype) outdated.push(`doctype: ${doctype.replace(/\s+/g, " ").slice(0, 60)}`);

  const hasTableLayout =
    (lower.match(/<table/g)?.length ?? 0) >= 2 && !MODERN_MARKERS.test(lower) && /width=["']?\d{3}/i.test(lower);

  let copyrightYear: number | null = null;
  const yearRe = /(?:©|&copy;|copyright)[^0-9\n]{0,30}?((?:19|20)\d{2})(?:\s*[-–—]\s*((?:19|20)\d{2}))?/gi;
  for (const m of head.matchAll(yearRe)) {
    const y = Number(m[2] ?? m[1]);
    if (Number.isFinite(y) && y >= 1995 && y <= 2100) {
      copyrightYear = copyrightYear === null ? y : Math.max(copyrightYear, y);
    }
  }

  if (hasTableLayout) outdated.push("table-based layout");
  if (!viewport && oldDoctype) outdated.push("no viewport meta tag on a pre-HTML5 doctype");
  if (MODERN_MARKERS.test(lower)) notes.push("modern build marker present");

  return {
    parked: [...new Set(parked)],
    outdated: [...new Set(outdated)],
    notes,
    title,
    generator,
    copyrightYear,
    viewport,
    hasTableLayout,
    oldDoctype,
    flash: /x-shockwave-flash|\.swf["'?]/i.test(lower),
  };
}

// --- main check -------------------------------------------------------------

export async function checkSite(rawWebsite: string, opts: HealthOptions): Promise<HealthResult> {
  const url = normaliseUrl(rawWebsite);
  const empty: HealthResult = {
    verdict: "ok",
    reason: "not checked",
    checked: false,
    http_status: "",
    final_url: "",
    https: "",
    viewport_meta: "",
    page_weight_bytes: "",
    evidence: [],
  };
  if (!url) return { ...empty, reason: "no usable website URL in OSM tags" };

  if (opts.respectRobots !== false) {
    const rob = await robotsAllows(url, opts);
    if (!rob.allowed) {
      return {
        ...empty,
        verdict: "ok",
        checked: false,
        reason: `not checked — robots.txt disallows automated agents (${rob.rule})`,
        final_url: url,
      };
    }
  }

  let rec = await politeFetch({
    url,
    cacheDir: opts.cacheDir,
    refresh: opts.refresh,
    timeoutMs: opts.timeoutMs ?? 12000,
    maxBytes: MAX_HTML_BYTES,
    retries: 1,
    backoffMs: 1000,
    label: `site check ${hostOfUrl(url)}`,
    onNote: opts.onNote,
  });

  // https failed outright -> does plain http still serve the site? That is a
  // real, reportable finding rather than "dead".
  let downgraded = false;
  if (rec.error && url.startsWith("https://")) {
    const fallback = await politeFetch({
      url: url.replace(/^https:/, "http:"),
      cacheDir: opts.cacheDir,
      refresh: opts.refresh,
      timeoutMs: opts.timeoutMs ?? 12000,
      maxBytes: MAX_HTML_BYTES,
      retries: 0,
      label: `site check (http fallback) ${hostOfUrl(url)}`,
      onNote: opts.onNote,
    });
    if (!fallback.error) {
      rec = fallback;
      downgraded = true;
    }
  }

  if (rec.error) {
    return {
      ...empty,
      verdict: "dead",
      checked: true,
      reason: `not reachable — ${rec.error}`,
      final_url: rec.finalUrl,
      http_status: "0",
      evidence: [rec.errorKind || "network error"],
    };
  }

  const status = rec.status;
  const finalUrl = rec.finalUrl || url;
  const isHttps = finalUrl.startsWith("https://");
  const bytes = rec.byteLength;
  const weight = rec.byteLengthExact ? `${bytes}` : `>=${bytes}`;
  const base = {
    checked: true,
    http_status: String(status),
    final_url: finalUrl,
    https: isHttps && !downgraded ? "yes" : "no",
    page_weight_bytes: weight,
  };

  // Bot protection / auth walls: we learned nothing, so do not claim anything.
  if (status === 401 || status === 403 || status === 429 || status === 451) {
    return {
      ...empty,
      ...base,
      verdict: "ok",
      reason: `not assessed — server answered HTTP ${status} to automated requests (bot protection or login wall)`,
      viewport_meta: "",
      evidence: [`HTTP ${status}`],
    };
  }
  if (status >= 500) {
    return {
      ...empty,
      ...base,
      verdict: "dead",
      reason: `server error HTTP ${status} on the homepage`,
      evidence: [`HTTP ${status}`],
    };
  }
  if (status >= 400) {
    return {
      ...empty,
      ...base,
      verdict: "dead",
      reason: `homepage returns HTTP ${status}`,
      evidence: [`HTTP ${status}`],
    };
  }

  const contentType = header(rec, "content-type");
  if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
    return {
      ...empty,
      ...base,
      verdict: "parked",
      reason: `homepage is not HTML (${contentType.split(";")[0]})`,
      evidence: [`content-type: ${contentType.split(";")[0]}`],
    };
  }
  if (bytes < 800 && rec.body.trim().length < 400) {
    return {
      ...empty,
      ...base,
      verdict: "parked",
      reason: `placeholder page — only ${bytes} bytes of HTML`,
      evidence: [`${bytes} bytes`],
    };
  }

  const s = detectSignals(rec.body, finalUrl, bytes);
  const evidence: string[] = [`HTTP ${status}`, `${bytes} bytes`];
  if (s.title) evidence.push(`title: "${s.title.slice(0, 80)}"`);
  if (s.generator) evidence.push(`generator: ${s.generator}`);

  if (s.parked.length > 0) {
    return {
      ...empty,
      ...base,
      viewport_meta: s.viewport ? "yes" : "no",
      verdict: "parked",
      reason: `parked / placeholder page (${s.parked.slice(0, 2).join("; ")})`,
      evidence: [...evidence, ...s.parked],
    };
  }

  const outdatedSignals = [...s.outdated];
  const nowYear = new Date().getFullYear();
  if (s.copyrightYear !== null && s.copyrightYear <= nowYear - 3) {
    outdatedSignals.push(`footer copyright stops at ${s.copyrightYear}`);
  }
  if (!isHttps && !downgraded) outdatedSignals.push("served over http:// only (no HTTPS)");
  if (!s.viewport) outdatedSignals.push("no responsive viewport meta tag");

  if (outdatedSignals.length > 0) {
    const strong = outdatedSignals.filter((x) => !x.startsWith("no responsive viewport") && !x.includes("no HTTPS"));
    let reason: string;
    if (strong.length > 0) {
      reason = `outdated signals — ${outdatedSignals.slice(0, 3).join("; ")}`;
    } else if (outdatedSignals.some((x) => x.includes("no HTTPS")) && outdatedSignals.some((x) => x.startsWith("no responsive"))) {
      reason = "reachable but no HTTPS and no responsive viewport meta tag";
    } else {
      reason = `${outdatedSignals[0]} (no other age signals found)`;
    }
    return {
      ...empty,
      ...base,
      viewport_meta: s.viewport ? "yes" : "no",
      verdict: "outdated",
      reason,
      evidence: [...evidence, ...outdatedSignals],
    };
  }

  return {
    ...empty,
    ...base,
    viewport_meta: "yes",
    verdict: "ok",
    reason: `reachable, HTTPS, responsive, no age signals (${bytes} bytes of HTML)`,
    evidence,
  };
}
