/**
 * Site Sourced — **a demo page loads nothing from another origin.**
 *
 * Every page of a demo is built from files in its own folder: its stylesheet, its script,
 * its two fonts, its pictures. That is a promise the pages make in their own words ("no
 * analytics, no tracking, nothing loaded from anyone else"), and it is the promise that
 * was broken on 25 Nov 2026 by `booking-comparison.html`, which loaded Google's
 * scheduling-button script and an eager `calendar.app.google` frame on open — and was
 * served live, unlinked, from the Maple Avenue bundle.
 *
 * The rule is written here as a check over the rendered pages, not as prose: anything the
 * browser fetches **when the page opens** must be a relative path inside the bundle.
 *
 * What counts as a load:
 *
 *   - `src` on `script`, `iframe`, `img`, `source`, `embed`, `audio`, `track`;
 *   - `data` on `object`;
 *   - `poster` on `video`;
 *   - `srcset` on `img` and `source` (every candidate);
 *   - `href` on `link` — a stylesheet, an icon, a preload: all of them are fetched;
 *   - `url(...)` and `@import` in the stylesheet, and in any inline `<style>`.
 *
 * What does **not** count, and why:
 *
 *   - `href` on an `a`. A link the visitor chooses to follow is navigation, not a load:
 *     the business's own booking page and its Google Maps address link are exactly that,
 *     and refusing them would refuse the product.
 *   - `action` on a `form`. A form posts where the visitor sends it, when they send it —
 *     not when the page opens. The one external address a page may name in `action` is the
 *     form endpoint this build derived from the record's provider (`form.endpoint`), which
 *     the delivery checks hold to the record separately. Any other external `action` is a
 *     message going somewhere nobody declared, and is refused here.
 *
 * The review-only comparison page (`booking-comparison.ts`) is the single exception in the
 * package, and it is not an exception this file grants: `build.ts` passes it in `allow`
 * only when the build opted in, and that module's own checks refuse the page in the
 * delivered phase, on any other record, and refuse every remote load on every other page.
 */

export interface ScannedPage {
  file: string;
  html: string;
}

/** Attributes that make the browser fetch something when the page opens, by tag. */
const LOAD_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  script: ["src"],
  iframe: ["src"],
  img: ["src", "srcset"],
  source: ["src", "srcset"],
  embed: ["src"],
  object: ["data"],
  audio: ["src"],
  track: ["src"],
  video: ["src", "poster"],
  link: ["href"],
};

/** `https:`, `http:` and the protocol-relative `//host/…`, which resolves to the page's own scheme. */
const EXTERNAL = /^(?:https?:)?\/\//i;

/** Every external URL a page asks the browser to fetch, as `tag[attr]=url`. */
export function externalLoads(html: string): { tag: string; attribute: string; url: string }[] {
  const found: { tag: string; attribute: string; url: string }[] = [];
  for (const tag of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g)) {
    const name = tag[1]!.toLowerCase();
    const attributes = tag[2] ?? "";
    const allowed = LOAD_ATTRIBUTES[name];
    if (!allowed) continue;
    for (const attribute of allowed) {
      const pattern = new RegExp(`\\b${attribute}\\s*=\\s*"([^"]*)"`, "gi");
      for (const hit of attributes.matchAll(pattern)) {
        const value = hit[1]!.trim();
        const urls = attribute === "srcset" ? value.split(",").map((c) => c.trim().split(/\s+/)[0] ?? "") : [value];
        for (const url of urls) if (EXTERNAL.test(url)) found.push({ tag: name, attribute, url });
      }
    }
  }
  return found;
}

/** Every external URL a stylesheet (or an inline `<style>`) asks for. */
export function externalCssLoads(css: string): string[] {
  const found: string[] = [];
  for (const hit of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    if (EXTERNAL.test(hit[1]!.trim())) found.push(hit[1]!.trim());
  }
  for (const hit of css.matchAll(/@import\s+(?:url\(\s*)?['"]?([^'")\s;]+)/g)) {
    if (EXTERNAL.test(hit[1]!.trim())) found.push(hit[1]!.trim());
  }
  return found;
}

/**
 * Everything wrong with a bundle's pages, in the words a failure message uses.
 *
 * Empty means every page loads only files from its own folder. A page named in `allow` is
 * the review-only comparison page, and only when this build opted into it.
 */
export function externalOriginProblems(vars: {
  pages: ScannedPage[];
  /** The stylesheet the bundle ships, if the caller has it. */
  css?: string;
  /** The endpoint this build derived from the record's form provider, or `""`. */
  formEndpoint?: string;
  /** Files that may load a third party: the review-only comparison page, when opted in. */
  allow?: readonly string[];
}): string[] {
  const { pages, css = "", formEndpoint = "", allow = [] } = vars;
  const problems: string[] = [];
  for (const page of pages) {
    if (allow.includes(page.file)) continue;
    for (const load of externalLoads(page.html)) {
      problems.push(
        `${page.file}: <${load.tag} ${load.attribute}="${load.url}"> makes the browser contact another origin when the page opens. ` +
          `A demo is zero-remote-resources: every file a page loads is a relative path inside its own folder. ` +
          `A booking page is a plain https anchor the visitor chooses to follow, never a script, frame or image the page fetches by itself.`,
      );
    }
    for (const url of externalCssLoads(page.html)) {
      problems.push(
        `${page.file}: its inline <style> asks for ${url}, which is another origin. A demo loads its type and its pictures from its own folder.`,
      );
    }
  }
  for (const url of externalCssLoads(css)) {
    problems.push(
      `styles.css: asks for ${url}, which is another origin. The stylesheet a bundle ships names only files beside it — fonts/, images/ — so a page that loads it asks nobody else for anything.`,
    );
  }
  if (formEndpoint !== "") {
    const declared = formEndpoint.trim();
    for (const page of pages) {
      if (allow.includes(page.file)) continue;
      for (const form of page.html.matchAll(/<form\b[^>]*>/gi)) {
        const action = /\baction\s*=\s*"([^"]*)"/i.exec(form[0])?.[1]?.trim() ?? "";
        if (action !== "" && EXTERNAL.test(action) && action !== declared) {
          problems.push(
            `${page.file}: the form posts to ${action}, which is not the endpoint this build derived from the record (${declared}). ` +
              `An external action is where a visitor's message goes, so it is the one the record and the delivery checks name — never another origin.`,
          );
        }
      }
    }
  }
  return problems;
}
