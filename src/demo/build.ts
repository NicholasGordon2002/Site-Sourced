/**
 * Site Sourced — bundle assembly and self-check.
 *
 * `buildBundle` writes one self-contained folder: the five contract pages (index.html,
 * services.html, about.html, contact.html, privacy.html), one contact-<service>.html per
 * recorded service (the destination a service card is its own link to, owner revision #4,
 * 6 Oct 2026), styles.css, site.js, favicon.svg, the images, the two self-hosted fonts
 * with their OFL licence text (fonts/), manifest.json and a plain-language README.txt.
 * Every reference on every page is a relative path to a file in the same folder, so the
 * bundle opens straight from disk (`file://`) and would also drop onto any host unchanged.
 *
 * The self-check is not decoration: if a compliance string is missing, if a local
 * file a page refers to does not exist, or if the copy guard finds a claim we are
 * not allowed to make, the build fails loudly instead of shipping.
 */

import { copyFile, mkdir, readdir, rm, rmdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import type { BundleResult, BusinessRecord, DemoManifest, ManifestImage } from "./types.ts";
import type { DemoCopy, PrivacyNotice } from "./copy.ts";
import {
  collectionProblems,
  composeCopy,
  composePrivacy,
  familyFields,
  fictionalNarrativeProblems,
  guardCopy,
  illustrationLabel,
  isIllustrativeImage,
  narrativeParagraphs,
  normaliseServices,
  privacyNoticeProblems,
  profileFor,
  slugify,
} from "./copy.ts";
import { contactLabelProblems, familyHonestyProblems, familyProblems, submitLabelProblems } from "./family.ts";
import { SECTION_ORDER, extrasLines, familyRenderingProblems, serviceCardProblems, type PageKey } from "./family-render.ts";
import { currentRetentionPractice, PRACTICE_FILE, readRetentionPractice, type RetentionPractice } from "./retention.ts";
import type { FormDelivery } from "./delivery.ts";
import { formDeliveryProblems, resolveDelivery } from "./delivery.ts";
import { undeliverableAddressProblems } from "./addresses.ts";
import { provenanceProblems } from "./provenance.ts";
import { KEY_PLACEHOLDER, notificationSubject, resolveForm, type ResolvedForm } from "./forms.ts";
import { sourceImages } from "./images.ts";
import { filesForSupplied, inspectSuppliedImage, manifestForSupplied } from "./supplied.ts";
import { BUDGET, imageBudgetProblems, kb, pageLoadout, weightProblems } from "./weight.ts";
import {
  esc,
  PAGE_IDS,
  PAGE_SPECS,
  renderCss,
  renderEditingReadme,
  renderFavicon,
  renderJs,
  renderPages,
  servicePageFile,
  type PageId,
  type RenderContext,
  type RenderedPage,
} from "./render.ts";

export const GENERATOR = "sitesourced-demo-generator/0.1";

/**
 * The two typefaces every bundle ships, and the licence text that has to travel with
 * them under the SIL Open Font License. They are files inside the bundle — loaded by a
 * relative `url()` from styles.css — because the page must load nothing from the
 * network. See docs/design-system.md §2.
 */
const FONT_ASSETS = ["fraunces-latin-600.woff2", "source-sans-3-latin.woff2", "OFL.txt"] as const;
const FONT_SOURCE_DIR = join(import.meta.dir, "assets", "fonts");

export interface BuildOptions {
  outRoot: string;
  /** HTTP/image cache directory (gitignored). */
  cacheDir: string;
  /** Directory the record was loaded from, used to resolve relative image paths. */
  recordDir: string;
  noImages: boolean;
  refresh: boolean;
  onNote: (msg: string) => void;
}

/**
 * Visitor-facing text that is still a working note rather than a sentence.
 *
 * The plan's rule is that nothing published carries placeholder data, and the privacy
 * notice is the first page with a value we do not have yet (the owner's legal name and
 * mailing address). The rule the owner set for it is stricter than "looks finished": a
 * bracket-shaped or invented value must never reach a public path, so the build refuses
 * a page containing a bracketed token, an unfilled `{Template}` token, or a working
 * note. Attributes, comments and scripts are stripped first: what is scanned is what a
 * visitor would read.
 */
export function placeholderProblems(pages: RenderedPage[]): string[] {
  const patterns: [RegExp, string][] = [
    [/\[[^\]\n]{2,60}\]/, "a bracketed placeholder"],
    [/\{[a-zA-Z][^}\n]{2,60}\}/, "an unfilled template token"],
    [/\b(TBD|TODO|FIXME)\b/, "a working note"],
    [/lorem ipsum/i, "filler text"],
  ];
  const problems: string[] = [];
  for (const page of pages) {
    const text = page.html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ");
    for (const [pattern, what] of patterns) {
      const hit = pattern.exec(text);
      if (hit) {
        problems.push(
          `${page.file} carries ${what} in visitor-facing text ("${hit[0].trim()}"). Nothing published carries placeholder data: ` +
            `fill the value in copy.ts (PRIVACY_IDENTITY for our own identity) or leave the sentence out, and rebuild.`,
        );
      }
    }
  }
  return problems;
}

/**
 * The privacy notice is reachable from every page, and from the form itself.
 *
 * It always was reachable — through the footer's copy of the page navigation, which
 * item 54 of the owner's punch list removed. Removing the navigation without replacing
 * that route would have left the requirement satisfied by nothing, so the rule is
 * asserted here rather than assumed: every page's footer carries a link to the notice,
 * and the page that carries the form carries one next to it as well (the two are
 * different obligations — a footer link is not a link beside a control).
 */
export function privacyLinkProblems(pages: RenderedPage[]): string[] {
  const problems: string[] = [];
  const href = `href="${PAGE_SPECS.privacy.file}"`;
  for (const page of pages) {
    const footerAt = page.html.indexOf("<footer");
    const inFooter = footerAt >= 0 && page.html.slice(footerAt).includes(href);
    if (!inFooter) {
      problems.push(
        `${page.file}: the footer carries no link to ${PAGE_SPECS.privacy.file}. The privacy notice must be reachable from every page — the footer's small print is its only route now that the footer carries no page list.`,
      );
    }
    if (PAGE_SPECS[page.id].carriesForm) {
      const beside = footerAt >= 0 ? page.html.slice(0, footerAt).includes(href) : page.html.includes(href);
      if (!beside) {
        problems.push(
          `${page.file}: carries the form but the privacy notice is not linked next to it. A visitor asked for their details must be able to read what happens to them without leaving the form.`,
        );
      }
    }
  }
  return problems;
}

/**
 * A page never opens by saying its own name twice.
 *
 * §P6.0 of the punch list: `contact.html` carried `<h1>Contact</h1>` from its page head
 * and `<h2>Contact</h2>` from the form section — the same words, one under the other,
 * with the form-delivery notice already saying what the form is. The `services.html`
 * page had already solved it the same way (`the h1 is the offering, so no h2`), and the
 * About page's own body repeated `About {name}` the same way, so the rule is stated once
 * for every page rather than patched per page.
 *
 * The check reads only `<main>`: the footer's `<h2 class="footer-biz">` deliberately
 * repeats the business's name, which on the home page is also the `<h1>`.
 */
export function headingStackProblems(pages: RenderedPage[]): string[] {
  const problems: string[] = [];
  const text = (html: string) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  for (const page of pages) {
    const start = page.html.indexOf("<main");
    const end = page.html.indexOf("</main>");
    const main = start >= 0 && end > start ? page.html.slice(start, end) : "";
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(main);
    if (!h1) continue;
    const title = text(h1[1]!);
    const repeated = [...main.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].some((m) => text(m[1]!) === title);
    if (repeated) {
      problems.push(
        `${page.file}: a section heading repeats the page's own heading ("${title}"). A page that says its name twice in a row has no heading stack — name the section by what it adds, or drop the heading where the page head already says it (.service: services.html's block carries none for the same reason).`,
      );
    }
  }
  return problems;
}

/**
 * The header's wordmark is the way home — one link, on every page (owner revision #5,
 * 6 Oct 2026).
 *
 * Until this revision the wordmark was a `<p>`: a visitor who had opened a deep page
 * (a demo link arrives at whatever page we sent) had no way back to the home page
 * except the nav's own Home link, which on a phone sits behind the menu. The owner
 * asked for the site's name in the header to be the link home. It is the plainest
 * thing a visitor tries, so it is checked rather than assumed:
 *
 *   - the header carries **exactly one** `<a class="wordmark">`, pointing at the
 *     demo's home file, and it holds the business's name and nothing else — no nested
 *     link, no second target, no `<p class="wordmark">` left behind beside it;
 *   - the page's own nav item still carries `aria-current="page"`, because the
 *     wordmark is not a substitute for the navigation marking where a visitor is.
 *
 * The check reads the rendered header only: a wordmark-shaped link in a footer is not
 * this rule, and the footer deliberately carries no page list.
 */
export function wordmarkLinkProblems(pages: RenderedPage[]): string[] {
  const problems: string[] = [];
  for (const page of pages) {
    const start = page.html.indexOf("<header");
    const end = page.html.indexOf("</header>");
    const header = start >= 0 && end > start ? page.html.slice(start, end) : "";
    const links = [...header.matchAll(/<a\b[^>]*class="wordmark"[^>]*>([\s\S]*?)<\/a>/g)];
    if (/<p\b[^>]*class="wordmark"/.test(header)) {
      problems.push(
        `${page.file}: the header still carries the old <p class="wordmark"> as well as the link (or instead of it). The site's name in the header is one link home — one element, not two.`,
      );
    }
    if (links.length !== 1) {
      problems.push(
        `${page.file}: the header carries ${links.length} wordmark links, not one. The business's name in the header is a single link to ${PAGE_SPECS.index.file} — duplicate or nested targets make the header's own name ambiguous to a screen reader and to a tap.`,
      );
      continue;
    }
    const link = links[0]!;
    if (!link[0].includes(`href="${PAGE_SPECS.index.file}"`)) {
      problems.push(
        `${page.file}: the header wordmark does not point at ${PAGE_SPECS.index.file}, the demo's home page. The name in the header is the way home on every page.`,
      );
    }
    if (/<a\b/i.test(link[1]!)) {
      problems.push(`${page.file}: the header wordmark has a link nested inside it. One target per link.`);
    }
    if (/<[a-z]/i.test(link[1]!) || link[1]!.trim() === "") {
      problems.push(
        `${page.file}: the header wordmark carries markup or nothing at all rather than the business's name in plain text. The header's link text is the business's own name, exactly as the footer prints it.`,
      );
    }
    if (!/<li[^>]*>\s*<a[^>]*aria-current="page"/.test(page.html)) {
      problems.push(
        `${page.file}: no nav item is marked aria-current="page". The wordmark is a link home, not a replacement for the navigation saying which page a visitor is on.`,
      );
    }
  }
  return problems;
}

/**
 * The page of the five-page contract a bundle file belongs to.
 *
 * A per-service contact page (`contact-hot-shave.html`, owner revision #4, 6 Oct 2026)
 * is a **variant of the Contact page**, not a sixth page: same shell, same furniture,
 * same form, one option already chosen. It is the Contact section, so its nav mark, its
 * obligations and its section order are the Contact page's.
 */
function sectionOf(file: string): PageId | null {
  const named = PAGE_IDS.find((id) => PAGE_SPECS[id].file === file);
  if (named) return named;
  return /^contact-.+\.html$/.test(file) ? "contact" : null;
}

/**
 * The page contract and what the navigation says about it (template-system.md checklist
 * #15; WORKFLOW.md rule 6). Three things were true by construction and by nothing else.
 *
 *   - **The five named pages are in the bundle — and nothing else is.** Removing a page
 *     used to fail only for a side reason: something still linked to the file. The bundle
 *     is the five-page contract (`render.ts` `PAGE_SPECS`) plus one `contact-<service>.html`
 *     per recorded service, which is the shape owner revision #4 gave it; a page outside
 *     that shape is a bundle that has quietly outgrown the contract it is checked against.
 *   - **`aria-current="page"` says where the visitor is.** `render.ts` writes it on the nav
 *     entry for the page it is rendering, and deleting it failed nothing at all. Each page
 *     carries exactly one, it sits **inside** the navigation, and it points at the nav
 *     entry for that page's own section — a visitor on `contact-haircut.html` is on the
 *     Contact page, so the mark belongs on `contact.html`.
 *   - **Every nav target is a file this bundle contains.** The host serves flat files, so a
 *     nav link to a page the bundle does not hold is a 404 from the page's most-trusted
 *     control. (`referencedFilesExist` asks the disk the same question after writing; this
 *     one asks the rendered bundle, and refuses links that point at nothing at all.)
 */
export function navProblems(pages: RenderedPage[]): string[] {
  const problems: string[] = [];
  const named = PAGE_IDS.map((id) => PAGE_SPECS[id].file);
  const files = new Set(pages.map((page) => page.file));

  for (const file of named) {
    if (!files.has(file)) {
      problems.push(
        `the bundle contains no ${file}. The page contract is the five named pages (${named.join(", ")}) plus one contact-<service>.html per recorded service — a page that quietly stops being built is a page whose links 404 on a host that serves flat files.`,
      );
    }
  }
  for (const file of files) {
    if (!named.includes(file) && sectionOf(file) === null) {
      problems.push(
        `${file}: a page that is neither one of the five named pages nor a per-service contact page (contact-<service>.html, owner revision #4, 6 Oct 2026). The contract is those pages and nothing else — a new kind of page has to be named in PAGE_SPECS and given its obligations, not slipped into the bundle.`,
      );
    }
  }

  for (const page of pages) {
    const section = sectionOf(page.file);
    if (!section) continue; // already refused above: an unknown page has no section to check
    const navAt = page.html.indexOf('<nav class="site-nav"');
    const navEnd = navAt >= 0 ? page.html.indexOf("</nav>", navAt) : -1;
    const nav = navAt >= 0 && navEnd > navAt ? page.html.slice(navAt, navEnd) : "";
    if (!nav) {
      problems.push(`${page.file}: the header carries no <nav class="site-nav">, so the page has no navigation to check.`);
      continue;
    }

    const marked = [...nav.matchAll(/<a\b[^>]*>/g)].filter((m) => /aria-current="page"/.test(m[0]!));
    const everywhere = [...page.html.matchAll(/aria-current="page"/g)].length;
    if (everywhere === 0) {
      problems.push(
        `${page.file}: no element carries aria-current="page". The navigation has to say which page a visitor is on — on a phone the other pages are behind a menu, and a screen reader otherwise hears five equal links.`,
      );
    } else {
      if (everywhere > 1) {
        problems.push(
          `${page.file}: ${everywhere} elements carry aria-current="page", not one. A page with two "current" entries cannot tell a visitor (or a screen reader) where they are.`,
        );
      }
      if (marked.length === 0) {
        problems.push(
          `${page.file}: the aria-current="page" marker is outside the navigation (<nav class="site-nav">). "Current" describes a page link, not a list item, a heading or a footer line.`,
        );
      }
      for (const m of marked) {
        const href = /\bhref="([^"]*)"/.exec(m[0]!)?.[1] ?? "";
        if (href.split(/[?#]/)[0] !== PAGE_SPECS[section].file) {
          problems.push(
            `${page.file}: the nav entry marked aria-current="page" points at ${href || "nothing"}, not ${PAGE_SPECS[section].file} — this page's own section. A per-service contact page is the Contact page, so its mark belongs on ${PAGE_SPECS.contact.file}.`,
          );
        }
      }
    }

    for (const m of nav.matchAll(/<a\b[^>]*href="([^"]*)"/g)) {
      const target = m[1]!.split(/[?#]/)[0]!;
      if (!files.has(target)) {
        problems.push(
          `${page.file}: the navigation links to ${target}, which this bundle does not contain. Every nav link is a page the bundle holds — on a host that serves flat files, anything else is a 404 from the page's most-trusted control.`,
        );
      }
    }
  }

  return problems;
}

/**
 * The phone menu is the four page links the owner named, opened by a named control
 * (WORKFLOW.md rule 11; owner revision, 6 Oct 2026 — owed by the session that wired it).
 *
 * The menu is a pure-CSS `<details>` whose summary is a 44×44px hamburger, and the
 * designer wired it in the previous session without a build check, which is the state
 * rule 11 forbids: a rule that lives only in prose rots. What this refuses:
 *
 *   - **anything but the four links** the owner named (Home, Services, About, Contact,
 *     in that order). A fifth row is a menu that has quietly become the footer's page
 *     list again;
 *   - **a control with no accessible name**. Three lines are not a label: the summary
 *     carries `aria-label` and a visually-hidden word, and losing both leaves an
 *     icon-only control a screen reader cannot read;
 *   - **a privacy link that is not marked phone-hidden.** The notice stays out of the
 *     phone menu and reachable from the footer's small print on every page — which
 *     `privacyLinkProblems` checks separately — and it keeps its place in the desktop
 *     row, so the wide layout is unchanged. Un-hiding it in the phone panel would put a
 *     fifth row in a menu the owner asked to hold four.
 *
 * The stylesheet is checked too when it is passed in: the class only means anything if
 * the phone rule hides it and the desktop block restores it.
 */
export function phoneMenuProblems(pages: RenderedPage[], css = ""): string[] {
  const problems: string[] = [];
  const menuFiles = PAGE_IDS.filter((id) => id !== "privacy").map((id) => PAGE_SPECS[id].file);
  let sawMenu = false;

  for (const page of pages) {
    const at = page.html.indexOf('<details class="site-menu">');
    if (at < 0) {
      problems.push(
        `${page.file}: the header carries no phone menu (<details class="site-menu">). Phones need the four page links behind a control — the desktop row is hidden from 48rem only.`,
      );
      continue;
    }
    sawMenu = true;
    const details = page.html.slice(at, page.html.indexOf("</details>", at));
    const summary = /<summary([^>]*)>([\s\S]*?)<\/summary>/.exec(details);
    if (!summary) {
      problems.push(`${page.file}: the phone menu's control is not a <summary>, so it cannot be opened without JavaScript.`);
    } else {
      const aria = /\baria-label="([^"]*)"/.exec(summary[1]!)?.[1]?.trim() ?? "";
      const spoken = /<span[^>]*class="visually-hidden"[^>]*>([^<]*)<\/span>/.exec(summary[2]!)?.[1]?.trim() ?? "";
      const text = summary[2]!.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
      if (!aria && !spoken && !text) {
        problems.push(
          `${page.file}: the phone menu's control has no accessible name — neither aria-label nor a visually-hidden word inside it. A hamburger is three lines, which a screen reader reads as nothing.`,
        );
      }
    }

    const navAt = page.html.indexOf('<nav class="site-nav"');
    const nav = navAt >= 0 ? page.html.slice(navAt, page.html.indexOf("</nav>", navAt)) : "";
    if (!nav) {
      problems.push(`${page.file}: the header carries no navigation beside the phone menu's control, so the menu opens onto nothing.`);
      continue;
    }
    const rows = [...nav.matchAll(/<li([^>]*)>\s*<a\s[^>]*href="([^"]*)"/g)].map((m) => ({ attrs: m[1] ?? "", file: m[2]! }));
    const phoneRows = rows.filter((r) => !/nav-item--desktop/.test(r.attrs));
    const got = phoneRows.map((r) => r.file);
    if (got.join(",") !== menuFiles.join(",")) {
      problems.push(
        `${page.file}: the phone menu carries [${got.join(", ") || "nothing"}], not the four links the owner named [${menuFiles.join(", ")}] (WORKFLOW.md rule 11). A fifth row, a missing page or a reordered menu is a menu nobody approved — and Privacy belongs to the footer's small print on a phone, not here.`,
      );
    }
    const privacy = rows.filter((r) => r.file === PAGE_SPECS.privacy.file);
    if (privacy.length !== 1) {
      problems.push(`${page.file}: the navigation carries ${privacy.length} links to ${PAGE_SPECS.privacy.file}, not one. The notice is reachable from the footer on every page and once in the desktop row.`);
    } else if (!/nav-item--desktop/.test(privacy[0]!.attrs)) {
      problems.push(
        `${page.file}: the privacy link in the nav is no longer marked phone-hidden (class="nav-item--desktop"), so it appears in the phone menu as a fifth row. The notice stays reachable from the footer's small print on a phone, and in the desktop row.`,
      );
    }
  }

  if (sawMenu && css) {
    if (!/\.site-nav\s+li\.nav-item--desktop\s*\{\s*display:\s*none;?\s*\}/.test(css)) {
      problems.push(
        'the stylesheet no longer hides the nav\'s phone-hidden items (".site-nav li.nav-item--desktop { display: none; }"), so the privacy link is back in the phone menu whatever the markup says.',
      );
    }
    if (!/@media\s*\(min-width:\s*48rem\)[\s\S]*\.site-nav li\.nav-item--desktop \{ display: block; \}/.test(css)) {
      problems.push('the stylesheet hides the privacy link at every width: the desktop row must restore it (".site-nav li.nav-item--desktop { display: block; }" inside the 48rem block).');
    }
  }

  return problems;
}

/**
 * Everything that must be true for a bundle to be publishable at all — one list, one
 * throw — checked **on every page**, because the plan's compliance rules are per page
 * and never inherited. It covers the pages' compliance strings, the contact form, and
 * the privacy notice: an unconfigured endpoint, a recipient that cannot receive mail,
 * a notice that promises delivery to the business while the form routes somewhere else,
 * or a page whose printed details carry no caveat all fail the build here, before any
 * of it can reach a public path.
 *
 * `PAGE_SPECS` says which obligations belong to which page, so the check cannot drift
 * from the template: a page that prints the business's details must carry the caveat
 * exactly twice, a page that carries the form must carry the delivery notice and load
 * `site.js`, and every other page must do neither.
 */
export function complianceChecks(vars: {
  pages: RenderedPage[];
  record: BusinessRecord;
  copy: DemoCopy;
  form: ResolvedForm;
  delivery: FormDelivery;
  /** The images this bundle will contain, as recorded in its manifest. */
  images: ManifestImage[];
  /** The privacy notice this bundle carries, composed for the same phase. */
  privacy: PrivacyNotice;
  /**
   * The declared operator practice (`ops/retention-log.md`). The build reads it once and
   * passes it in; a caller that leaves it out gets the current declaration, so a missing
   * one is still a failure rather than a silently softer notice.
   */
  practice?: RetentionPractice | null;
  /** The stylesheet, so the check can see whether it loads anything externally. */
  css?: string;
  /** The bundle's only script, so the no-tracking sentence can be checked, not asserted. */
  js?: string;
}): string[] {
  const { pages, record, copy, form, delivery, images, privacy } = vars;
  const practice = vars.practice === undefined ? currentRetentionPractice() : vars.practice;
  const problems: string[] = [];
  const illustrative = images.filter(isIllustrativeImage);
  const label = illustrationLabel(record.name);
  const caveat = copy.contactCaveat;

  for (const page of pages) {
    const spec = PAGE_SPECS[page.id];
    const html = page.html;
    const on = `on ${page.file}`;

    if (!/<meta\s+name="robots"\s+content="noindex,\s*nofollow">/.test(html)) {
      problems.push(`${on}: missing or malformed <meta name="robots" content="noindex, nofollow">`);
    }
    if (!html.includes(copy.banner)) problems.push(`${on}: the proposal banner text is not present`);
    if (html.indexOf(copy.banner) > html.indexOf("<header")) problems.push(`${on}: the banner is not above the header`);
    // The banner has to be the first content element in the body. The skip link is
    // allowed in front of it: it is a keyboard affordance, not content, and it is
    // invisible until focused.
    const inBody = html.slice(html.indexOf("<body>") + 6).replace(/<!--[\s\S]*?-->/g, " ").trim();
    const afterSkip = inBody.startsWith('<a class="skip-link"')
      ? inBody.slice(inBody.indexOf("</a>") + 4).trim()
      : inBody;
    if (!afterSkip.startsWith('<div class="proposal-banner"')) {
      problems.push(`${on}: the proposal banner is not the first content element in <body>, so a visitor can meet the business's name before they learn the page is our proposal`);
    }
    if (!html.includes(copy.footerDisclaimer)) {
      problems.push(`${on}: the footer disclaimer is not present next to the business's name`);
    } else {
      // Presence was never the whole rule: checklist #3 says the disclaimer sits **with
      // the business's name and contact details**, in the footer. It was written there by
      // the renderer and asserted by nothing, so a disclaimer once counted in the page
      // body — or inside the footer but above the name — passed. Both are refused here.
      const footerAt = html.indexOf("<footer");
      const footerEnd = footerAt >= 0 ? html.indexOf("</footer>", footerAt) : -1;
      const footer = footerAt >= 0 && footerEnd > footerAt ? html.slice(footerAt, footerEnd) : "";
      if (!footer.includes(copy.footerDisclaimer)) {
        problems.push(
          `${on}: the footer disclaimer is outside <footer>. It is only somewhere on the page — the disclaimer belongs beside the business's name and its contact details, in the footer, where the visitor reading them also reads who the page is from.`,
        );
      } else if (footer.indexOf(copy.footerDisclaimer) < footer.indexOf('class="footer-biz"')) {
        problems.push(
          `${on}: the footer disclaimer sits inside <footer> but above the business's name rather than beside it. Checklist #3 puts the disclaimer with the name and contact details it qualifies.`,
        );
      }
    }
    if (/©\s*<strong>?/.test(html) || html.includes(`© ${record.name}`)) {
      problems.push(`${on}: a copyright line naming the business is present`);
    }

    if (spec.printsDetails) {
      // The demonstration notice sends a visitor to the printed phone number and
      // email address to reach the business, so those details must carry the plan's
      // caveat — twice, once with the details in the page body and once in the
      // footer. (On a delivered site the client has confirmed them, so it is empty.)
      const count = caveat ? html.split(esc(caveat)).length - 1 : 0;
      if (caveat && count !== 2) {
        problems.push(
          `${on}: the business's published contact details are printed with the caveat that belongs with them ${count} time(s), not twice (once beside the details in the page body, once in the footer). ` +
            `Unconfirmed details must never read as the business's own.`,
        );
      }
      if (delivery.mode === "demo" && !html.includes("demonstration site")) {
        problems.push(`${on}: this bundle is in the demonstration phase but the page does not say so in words a visitor would recognise`);
      }
    } else if (delivery.mode === "demo") {
      // On a demonstration page the privacy notice prints none of the business's
      // details: a notice about our own handling is not the place to repeat an
      // unconfirmed phone number or email address.
      //
      // On a client's own site the notice must do the opposite — the account is theirs,
      // so their own contact address is the route a visitor is given (`composePrivacy`,
      // lead ruling in WORKFLOW.md rule 8). That is why this check is demo-only.
      if (caveat && html.includes(esc(caveat))) {
        problems.push(`${on}: carries the published-listings caveat although it prints none of the business's contact details — the caveat belongs only with the details it qualifies`);
      }
      for (const [what, value] of [["phone number", record.phone], ["email address", record.email]] as [string, string | undefined][]) {
        if (value && html.includes(value)) {
          problems.push(`${on}: prints the business's ${what} (${value}). The privacy notice is about our own handling, so it reprints none of the business's details.`);
        }
      }
    }

    if (spec.carriesForm) {
      if (!html.includes("site.js")) {
        problems.push(`${on}: the page carries the form but does not load site.js, so a submission cannot report its outcome`);
      }
      // Compared in its escaped form: that is how render.ts writes text into html.
      if (!html.includes(esc(copy.formNotice))) {
        problems.push(`${on}: the form-delivery notice is not present in the page, next to the form`);
      }
    } else {
      if (html.includes("site.js")) {
        problems.push(`${on}: loads site.js, but the contact form is only on ${PAGE_SPECS.contact.file}. Every other page must work unchanged with JavaScript off, and asks for one file less.`);
      }
      if (html.includes(esc(copy.formNotice))) {
        problems.push(`${on}: quotes the form-delivery notice without carrying the form, which tells a visitor where a message goes on a page that has no message field`);
      }
    }

    // An AI-generated placeholder must be labelled on the page that shows it, in words
    // a visitor reads — the manifest recording it is not enough. The label is built by
    // `illustrationLabel`, so the page and the manifest cannot disagree.
    for (const role of spec.slots) {
      const image = illustrative.find((i) => i.role === role);
      if (image && !html.includes(esc(label))) {
        problems.push(
          `${on}: shows the AI-generated ${role} image (${image.file}) with no label saying so. ` +
            `An AI-generated placeholder must be labelled as an illustration, not left looking like a photograph of ${record.name}; expected the page to contain: "${label}"`,
        );
      }
    }
    if (spec.slots.length === 0 && html.includes(esc(label))) {
      problems.push(`${on}: carries an AI-illustration label although it shows no image that needs one`);
    }

    const banned = guardCopy(html, record);
    if (banned.length > 0) problems.push(`${on}: copy guard tripped: ${banned.join(", ")}`);
  }

  problems.push(...formDeliveryProblems({ record, form, noticeMode: copy.formNoticeDelivery, placeholder: KEY_PLACEHOLDER }));
  // Two rules that were each missing a half. Both are checked here, on the rendered
  // pages — what a visitor can actually read:
  //
  //   - every address the bundle posts to *or prints* must be able to work, through one
  //     shared function, so the form's recipient and the printed "contact us here" line
  //     cannot drift apart (addresses.ts);
  //   - every claim about where the business's details came from is derived from the
  //     record's declared source, and a page carrying a credit the record does not
  //     support fails here (provenance.ts).
  problems.push(...undeliverableAddressProblems({ record, form, pages }));
  problems.push(...provenanceProblems({ record, provenance: copy.provenance, pages, deliveryMode: delivery.mode }));
  // The privacy notice, both halves of it: the phase checks that already existed, plus
  // the owner's rule that every sentence about collection, storage or deletion is backed
  // by a recorded fact — a provider fact from `docs/formspark.md`, or the one declared
  // operator practice in `ops/retention-log.md` (WORKFLOW.md rule 7).
  problems.push(...privacyNoticeProblems({ privacy, record, delivery, form, practice }));
  problems.push(...collectionProblems({ pages, privacy, form, fields: familyFields(record).fields }));
  // Which family this page is for, and whether it keeps that family's promises:
  // an appointment page may request a time and never book one, an inquiry page may pass
  // on a question and never promise a price, a timeline, a visit or a service area
  // (WORKFLOW.md rule 3; template-system.md checklist #17). The label the page prints has
  // to be the label the build resolved, so the manifest's own record is a fact.
  problems.push(...familyProblems({ record, family: copy.conversion.family }));
  problems.push(...familyHonestyProblems({ pages, record, family: copy.conversion.family }));
  problems.push(...fictionalNarrativeProblems(record));
  problems.push(...contactLabelProblems({ pages, label: copy.contactLabel }));
  problems.push(...submitLabelProblems({ pages, label: copy.contactLabel }));
  // The family rendering layer: the fields the form asks for, the days the
  // preferred-days control may offer, the extras card's lines, the three inquiry steps
  // and the order the page's blocks are rendered in — each derived, each checked on the
  // rendered page rather than trusted (WORKFLOW.md rule 6).
  {
    const fields = familyFields(record);
    const extras = extrasLines({ record, profileKey: copy.conversion.category_profile, labels: copy.ui });
    problems.push(
      ...familyRenderingProblems({
        pages,
        record,
        family: copy.conversion.family,
        fields: fields.fields.map((f) => ({ name: f.name, id: f.id })),
        openDays: fields.preferredDays.days,
        steps: copy.steps,
        extras,
        order: SECTION_ORDER[copy.conversion.family] as unknown as Record<string, string[]>,
        pageKeys: { index: "index", services: "services", about: "about", contact: "contact", privacy: "privacy" } satisfies Record<string, PageKey>,
      }),
    );
  }
  // A service card is one link, one action, carrying its own recorded service to a
  // page whose form already has that service chosen (owner revision #4, 6 Oct).
  problems.push(...serviceCardProblems({ pages, record, family: copy.conversion.family }));
  problems.push(...privacyLinkProblems(pages));
  problems.push(...headingStackProblems(pages));
  problems.push(...wordmarkLinkProblems(pages));
  // The page contract itself: the five named pages are all built (plus the per-service
  // contact pages and nothing else), each carries exactly one `aria-current="page"` on
  // the nav entry for its own section, and every nav link points at a page the bundle
  // holds (template-system.md checklist #15).
  problems.push(...navProblems(pages));
  // The phone menu: four named links, a named control, and the privacy link phone-hidden
  // (WORKFLOW.md rule 11).
  problems.push(...phoneMenuProblems(pages, vars.css ?? ""));
  problems.push(...externalReferenceProblems({ pages, css: vars.css ?? "", js: vars.js ?? "" }));
  problems.push(...placeholderProblems(pages));
  return problems;
}

/**
 * The bundle loads nothing from anywhere else, and `site.js` is its only script.
 *
 * This is what makes the privacy notice's sentence — "There are no cookies, no analytics
 * and no tracking on this page" — an enforced fact rather than an assurance someone
 * remembers. It is checked on every page and on the stylesheet:
 *
 *   - no inline `<script>`, and no `<script src>` other than the bundle's own `site.js`;
 *   - nothing a page *loads* (script, stylesheet, image, frame, media, `srcset`) comes
 *     from another origin;
 *   - the stylesheet imports and points at no other origin either;
 *   - the script itself touches no cookie, no web storage and no tracking beacon.
 *
 * Two things are deliberately **not** covered, and both are named in the manifest so a
 * reader sees the boundary rather than assuming it:
 *
 *   - an `<a href>` to another site (the OpenStreetMap directions link) is navigation a
 *     visitor chooses, not a resource the page fetches;
 *   - the form's `action` is where a submission is *posted* when the visitor submits —
 *     the one outbound request the page can make, and the reason the notice says "on this
 *     page" rather than "never". With JavaScript off the browser navigates to that
 *     service's own page, whose behaviour is not ours (docs/formspark.md records it).
 */
export function externalReferenceProblems(vars: { pages: RenderedPage[]; css: string; js: string }): string[] {
  const { pages, css, js } = vars;
  const problems: string[] = [];
  const external = (value: string) => /^(?:https?:)?\/\//i.test(value.trim());

  for (const page of pages) {
    const on = `on ${page.file}`;

    for (const tag of page.html.matchAll(/<script\b([^>]*)>/gi)) {
      const attrs = tag[1] ?? "";
      const src = /\bsrc="([^"]*)"/i.exec(attrs)?.[1]?.trim() ?? "";
      if (!src) {
        problems.push(
          `${on}: carries an inline <script>. The privacy notice tells a visitor there is no tracking on the page, and nothing about an inline script can be read in the page source a visitor is looking at — keep the bundle's script in site.js.`,
        );
        continue;
      }
      if (external(src)) {
        problems.push(
          `${on}: loads a script from another origin (${src}). The page must load nothing from the network, or the "no cookies, no analytics and no tracking on this page" sentence it prints stops being true.`,
        );
      } else if (src !== "site.js") {
        problems.push(
          `${on}: loads the script "${src}". site.js is the bundle's only script; a second one is a file nobody has read for what it does.`,
        );
      }
    }

    for (const tag of page.html.matchAll(/<(?:link|img|iframe|source|embed|object|video|audio)\b[^>]*>/gi)) {
      const element = tag[0]!;
      for (const attr of ["href", "src", "data", "poster"]) {
        const value = new RegExp(`\\b${attr}="([^"]*)"`, "i").exec(element)?.[1]?.trim() ?? "";
        if (value && external(value)) {
          problems.push(
            `${on}: loads ${value} from another origin, so the page's "no tracking on this page" sentence is not something we can check. Every file a page needs must sit in its own folder.`,
          );
        }
      }
      for (const set of element.matchAll(/srcset="([^"]*)"/gi)) {
        for (const candidate of (set[1] ?? "").split(",")) {
          const value = candidate.trim().split(/\s+/)[0] ?? "";
          if (value && external(value)) {
            problems.push(`${on}: its srcset asks another origin for ${value}, which the page cannot be loading.`);
          }
        }
      }
    }
  }

  for (const [what, pattern] of [
    ["an @import", /@import\s+(?:url\(\s*)?['"]?\s*(?:https?:)?\/\//i],
    ["a url()", /url\(\s*['"]?\s*(?:https?:)?\/\//i],
  ] as [string, RegExp][]) {
    if (pattern.test(css)) {
      problems.push(
        `the stylesheet pulls a file from another origin (${what}), so a page using it is not the self-contained file the privacy notice describes. Fonts and images are bundled for exactly this reason.`,
      );
    }
  }

  for (const [what, pattern] of [
    ["a cookie", /document\s*\.\s*cookie/i],
    ["web storage", /\b(?:localStorage|sessionStorage|indexedDB)\b/i],
    ["a tracking beacon", /\b(?:sendBeacon|new\s+Image\b)/i],
    ["a direct XHR", /\bXMLHttpRequest\b/i],
    ["an analytics call", /\b(?:gtag|dataLayer|analytics|mixpanel|segment|plausible|fathom)\b/i],
  ] as [string, RegExp][]) {
    if (pattern.test(js)) {
      problems.push(
        `site.js uses ${what}, which the privacy notice's "no cookies, no analytics and no tracking on this page" sentence says it does not. Either the script changes or the sentence does.`,
      );
    }
  }

  return problems;
}

/**
 * Every relative file the HTML/CSS/JS refers to must exist inside the bundle.
 *
 * `srcset` is read as well as `src`: a hero whose `src` exists but whose `srcset`
 * points at variants that were never copied in would 404 on a phone while looking
 * perfectly fine on the machine that built it.
 */
async function referencedFilesExist(dir: string, html: string, css: string): Promise<string[]> {
  const missing: string[] = [];
  const refs = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)) refs.add(m[1]!);
  for (const m of html.matchAll(/srcset="([^"]*)"/g)) {
    for (const candidate of m[1]!.split(",")) {
      const path = candidate.trim().split(/\s+/)[0];
      if (path) refs.add(path);
    }
  }
  for (const m of css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) refs.add(m[1]!);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:)/.test(ref)) continue;
    if (ref.startsWith("#")) continue;
    try {
      // A fragment or a query string is not part of the file name a link points at:
      // `contact-hot-shave.html#form` is the file `contact-hot-shave.html`. Splitting on
      // both keeps a link with a fragment from being read as a missing file.
      await stat(join(dir, ref.split(/[?#]/)[0]!));
    } catch {
      missing.push(ref);
    }
  }
  return missing;
}

/**
 * A bundle contains what the build put in it and nothing else — files **and** directories.
 *
 * The file half is not new: without it a file from an earlier run survives in the folder,
 * which is how a re-encoded hero could leave its 2.6 MB predecessor sitting in the
 * published demo path, reachable at a guessable URL, long after the page stopped referring
 * to it. The directory half came out of the 6 Oct gate audit: `buildBundle` `mkdir`s `img/`
 * before it writes anything, and nothing in it is the current build's output, so every
 * fixture bundle shipped an **empty `img/`**. The old prune skipped non-files, so it stayed.
 *
 * A directory is only removed when it is empty after the file prune — so a folder holding
 * anything the bundle ships is untouched, and the bundle root is never a candidate.
 * Removed paths are returned rather than logged, so the caller decides how loud to be.
 */
export async function pruneLeftovers(dir: string, keep: Set<string>): Promise<{ files: string[]; dirs: string[] }> {
  const files: string[] = [];
  const dirs: string[] = [];
  const present = await readdir(dir, { recursive: true, withFileTypes: true });
  for (const entry of present) {
    if (!entry.isFile()) continue;
    const rel = entry.parentPath ? relative(dir, join(entry.parentPath, entry.name)) : entry.name;
    if (keep.has(rel)) continue;
    await rm(join(dir, rel), { force: true });
    files.push(rel);
  }
  // Deepest first, so `img/generated/` can empty before `img/` is tested. `rmdir` (not a
  // recursive removal) is deliberate: it refuses to take anything with it.
  const subdirs = present
    .filter((entry) => entry.isDirectory())
    .map((entry) => (entry.parentPath ? relative(dir, join(entry.parentPath, entry.name)) : entry.name))
    .sort((a, b) => b.split("/").length - a.split("/").length);
  for (const rel of subdirs) {
    try {
      if ((await readdir(join(dir, rel))).length > 0) continue;
      await rmdir(join(dir, rel));
      dirs.push(rel);
    } catch {
      // Already gone, or not empty despite the reading above: either way there is nothing
      // here to report and nothing to remove.
    }
  }
  return { files, dirs };
}

export async function buildBundle(record: BusinessRecord, opts: BuildOptions): Promise<BundleResult> {
  const slug = (record.slug ?? "").trim() || slugify(record.name);
  const dir = join(opts.outRoot, slug);
  // Tracked so a failed build can leave no half-written bundle behind: a folder
  // that existed before this run (a previous, valid bundle) is left alone, but
  // one this run created is removed rather than left looking publishable.
  const existedBefore = await stat(dir).then(() => true).catch(() => false);
  await mkdir(join(dir, "img"), { recursive: true });
  const fail = async (message: string): Promise<never> => {
    if (!existedBefore) await rm(dir, { recursive: true, force: true });
    throw new Error(message);
  };

  const profile = profileFor(record);
  // The form is resolved first, then the delivery is derived from the record and
  // that form: the page's notice depends on both the provider and on whether the
  // message actually reaches the business.
  const form = resolveForm(record);
  const delivery = resolveDelivery(record, form);
  const copy = composeCopy(record, slug, form, delivery);
  // The notification email's title is family- and phase-derived, and the key it sits
  // under is provider-specific — so it is set here, after both are known, against the
  // key the provider reads (forms.ts `notificationSubject`). `resolveForm` runs earlier
  // and carries no phase parameter.
  form.hiddenFields[form.provider.subjectField] = notificationSubject(record.name, copy.conversion.family, delivery.mode);
  // The operator practice the privacy notice is allowed to print, read once from the
  // team file that declares it (`ops/retention-log.md`). A missing or unreadable
  // declaration is a build failure, not a softer sentence: the notice's retention half
  // may only state what a recorded fact supports.
  // The form this build renders: the family's own field set, minus everything the
  // record cannot support (`fields.ts`). Derived once here and carried into the
  // manifest, the self-check and the page — the same object, so the page, the notice
  // and the manifest cannot disagree about what is asked for.
  const fields = familyFields(record);
  const extras = extrasLines({ record, profileKey: copy.conversion.category_profile, labels: copy.ui });
  const practiceRead = readRetentionPractice();
  const practice = practiceRead.practice;
  // The privacy notice is composed for the same phase as the form notice, from the
  // same derivation — never a flag someone set. Anything the owner has not supplied
  // (today: our legal name and mailing address) is recorded as an open item rather
  // than printed as a placeholder.
  const privacy = composePrivacy(record, form, delivery, practice);
  const warnings: string[] = [];
  if (form.warning) warnings.push(form.warning);
  if (!record.phone) warnings.push("record has no phone number — the header call button and the contact fallback are weaker without one.");
  if (!record.email) warnings.push("record has no email address — the form fallback line has no address to print.");
  if (normaliseServices(record).length === 0) warnings.push("record lists no services — the services section says so plainly rather than inventing any, and the form asks for no service.");
  for (const item of fields.omitted) {
    warnings.push(`the form does not ask "${item.field}": ${item.why}`);
  }
  warnings.push(`preferred days: ${fields.preferredDays.basis}`);
  if (delivery.mode === "demo") {
    warnings.push(`demonstration phase: ${delivery.basis} — so the page carries the demonstration notice and no message reaches ${record.name}.`);
  }
  warnings.push(`provenance: ${copy.provenance.basis}.`);
  warnings.push(
    practice
      ? `retention practice: "${practice.cadence}" — ${practice.routine} (${practice.declaration}, read from ${practice.source}). The privacy notice's retention sentence is composed from this and nothing else.`
      : `retention practice: none declared — the privacy notice's retention section carries only the provider's facts, and the build fails until ${PRACTICE_FILE} declares a cadence.`,
  );
  if (copy.provenance.kind === "fictional") {
    warnings.push(
      `this record is a fictional example business, so the page says so instead of crediting a real source — it must not be published as anyone's site, and its printed details are examples.`,
    );
  }
  for (const item of privacy.openItems) {
    warnings.push(`privacy notice incomplete: ${item}. The page states nothing it cannot support, but this must be filled before a real prospect sees a page.`);
  }

  const sourced = await sourceImages(record, {
    cacheDir: opts.cacheDir,
    noImages: opts.noImages,
    refresh: opts.refresh,
    onNote: opts.onNote,
  });

  // Everything that goes into the bundle, in memory, before anything is written:
  // the bytes we downloaded, and the supplied files we read and measured. A supplied
  // file is measured exactly like a fetched one — that check is how a 2.7 MB hero
  // shipped, because it only ever ran on files we had fetched ourselves.
  // Reasons to refuse the bundle that are known before a single file is written.
  // Merged with the page's compliance self-check below, and thrown as one list.
  const problemsBeforeWrite: string[] = [];
  const suppliedFiles: { path: string; bytes: Uint8Array }[] = [];
  const images: ManifestImage[] = [];
  for (const image of sourced.images) {
    const downloaded = sourced.files.find((f) => f.path === image.file);
    if (downloaded) {
      images.push(image);
      continue;
    }
    const inspected = await inspectSuppliedImage(image, opts.recordDir);
    problemsBeforeWrite.push(...inspected.problems);
    if (inspected.variants.length === 0) {
      // Missing where it was expected to be: the page falls back to its CSS treatment,
      // in the same words it always has.
      warnings.push(
        `image ${inspected.missing.join(", ") || image.file} could not be read (${inspected.missing.length > 0 ? "not found" : "unreadable"}) — the page falls back to its CSS treatment.`,
      );
      images.push({ ...image, file: null, source: "css-gradient-fallback", notes: "Supplied file was not found." });
      continue;
    }
    const measured = manifestForSupplied(image, inspected.variants);
    images.push(measured);
    suppliedFiles.push(...filesForSupplied(inspected.variants));
    opts.onNote(
      `images: ${image.role} ← ${measured.file} (${inspected.variants.length} size${inspected.variants.length === 1 ? "" : "s"}: ${inspected.variants
        .map((v) => `${v.width}px ${kb(v.bytes.byteLength)}`)
        .join(", ")})`,
    );
  }
  const bytesByPath = new Map<string, Uint8Array>();
  for (const file of [...sourced.files, ...suppliedFiles]) bytesByPath.set(file.path, file.bytes);

  const ctx: RenderContext = {
    record,
    copy,
    profile,
    form,
    delivery,
    privacy,
    images,
    slug,
    generatedAt: new Date().toISOString(),
  };

  const pages = renderPages(ctx);
  const css = renderCss(profile, slug);
  const js = renderJs();
  const favicon = renderFavicon(record, profile);
  const readme = renderEditingReadme(ctx);

  const problems = [
    ...problemsBeforeWrite,
    ...practiceRead.problems,
    ...complianceChecks({ pages, record, copy, form, delivery, images, privacy, practice, css, js }),
  ];
  if (problems.length > 0) await fail(`compliance self-check failed for ${slug}:\n  - ${problems.join("\n  - ")}`);

  const files: string[] = [];
  const write = async (relPath: string, contents: string | Uint8Array) => {
    const abs = join(dir, relPath);
    await mkdir(dirname(abs), { recursive: true });
    await Bun.write(abs, contents);
    files.push(relPath);
  };

  for (const page of pages) await write(page.file, page.html);
  await write("styles.css", css);
  await write("site.js", js);
  await write("favicon.svg", favicon);
  await write("README.txt", readme);

  // The page's fonts, and the licence that must travel with them. A missing asset is a
  // build failure, not a warning: the stylesheet would be pointing at nothing.
  for (const name of FONT_ASSETS) {
    try {
      await mkdir(join(dir, "fonts"), { recursive: true });
      await copyFile(join(FONT_SOURCE_DIR, name), join(dir, "fonts", name));
      files.push(`fonts/${name}`);
    } catch (err) {
      await fail(`bundle ${slug} cannot include its font assets — ${name}: ${(err as Error).message}`);
    }
  }

  // Images: either the bytes we downloaded, or a supplied file in the record — both
  // are in `bytesByPath` by now, already measured, so the page and the manifest
  // describe the same picture with the same real dimensions. A variant set is written
  // in full: that is the point of it — the phone downloads one file, the folder holds
  // the set.
  for (const image of images) {
    const paths = (image.variants?.length ?? 0) > 0 ? image.variants!.map((v) => v.file) : image.file ? [image.file] : [];
    for (const path of paths) {
      const bytes = bytesByPath.get(path);
      if (!bytes) {
        warnings.push(`image ${path} has no bytes to write — the page would refer to a file it does not contain.`);
        continue;
      }
      await write(path, bytes);
    }
  }

  // A bundle contains what this build put in it and nothing else. Without this, a
  // file from an earlier build survives in the folder — which is how a re-encoded hero
  // could leave its 2.6 MB predecessor sitting in the published demo path, still
  // reachable at a guessable URL, long after the page stopped referring to it. Directories
  // go the same way when they end up empty: the gate audit of 6 Oct found an empty `img/`
  // on every fixture bundle, left by the build's own `mkdir` for images that are written
  // elsewhere today.
  const keep = new Set<string>([...files, "manifest.json"]);
  const pruned = await pruneLeftovers(dir, keep);
  for (const rel of pruned.files) {
    warnings.push(`removed ${rel}, a file inside this bundle that this build did not write (a leftover from an earlier run).`);
  }
  for (const rel of pruned.dirs) {
    warnings.push(`removed ${rel}, an empty directory inside this bundle — it holds no file the bundle ships, and an empty folder in a published path is a path a visitor can still land on.`);
  }

  // Every page, not just the home page: a nav link to a file that was never written,
  // or a font a second page refers to, is a 404 on the published host — which serves
  // flat files and has no directory-index resolution, so `/demo/<slug>/` does not work
  // and only real paths do.
  const missing: string[] = [];
  for (const page of pages) {
    for (const ref of await referencedFilesExist(dir, page.html, css)) {
      missing.push(`${page.file} → ${ref}`);
    }
  }
  if (missing.length > 0) await fail(`bundle ${slug} refers to files it does not contain: ${missing.join(", ")}`);

  // What each page actually weighs, measured from the files on disk rather than
  // estimated from the record: the page itself, its stylesheet, its script if it has
  // one, its two fonts, and one file per image slot it shows — the hero variant a
  // 360px phone asks for. Over the ceiling the bundle does not ship; over the target it
  // still does, and the manifest carries the per-page number so a heavy-but-honest page
  // is visible, not hidden.
  const sizes = new Map<string, number>();
  for (const f of files) sizes.set(f, (await stat(join(dir, f))).size);
  const weight: string[] = [];
  const pageBytes: { file: string; bytes: number }[] = [];
  for (const page of pages) {
    const loadout = { page: page.file, html: page.html, css, sizes, images };
    weight.push(...weightProblems(loadout));
    pageBytes.push({ file: page.file, bytes: pageLoadout(loadout).reduce((sum, f) => sum + f.bytes, 0) });
  }
  const imageBudgets = imageBudgetProblems({ images, sizes });
  if (weight.length > 0 || imageBudgets.length > 0) {
    await fail(`bundle ${slug} breaks the weight budget in docs/design-system.md §8:\n  - ${[...weight, ...imageBudgets].join("\n  - ")}`);
  }
  const heaviest = [...pageBytes].sort((a, b) => b.bytes - a.bytes)[0]!;
  opts.onNote(
    `weight: heaviest page is ${heaviest.file} at ${kb(heaviest.bytes)} cold at 360px (target ${kb(BUDGET.pageTarget)}, ceiling ${kb(BUDGET.pageCeiling)})`,
  );
  for (const page of pageBytes) {
    if (page.bytes > BUDGET.pageTarget) {
      warnings.push(
        `${page.file} weighs ${kb(page.bytes)} cold, over the ${kb(BUDGET.pageTarget)} target in docs/design-system.md §8 (the ${kb(BUDGET.pageCeiling)} ceiling is what fails a build).`,
      );
    }
  }

  const narrativeCount = narrativeParagraphs(record).length;

  const manifest: DemoManifest = {
    generator: GENERATOR,
    generated_at: ctx.generatedAt,
    slug,
    business: {
      name: record.name,
      category: record.category,
      city: record.address?.city ?? "",
      phone_printed: Boolean(record.phone),
      email_printed: Boolean(record.email),
      source: record.source ?? "test fixture (fictional business)",
      /* The declared source, and the exact lines derived from it — so a reviewer (or a
         later audit) can see what the page claimed about its own provenance and why. */
      source_kind: copy.provenance.kind,
      provenance_line: copy.provenance.attribution,
      provenance_basis: copy.provenance.basis,
    },
    files: [...files, "manifest.json"].sort(),
    images,
    /* Which family the page converts for, the rule that decided it, and the primary
       contact label with its own basis — derived in family.ts, recorded here so a
       reviewer reads the result and the reason together. */
    conversion: {
      family: copy.conversion.family,
      source: copy.conversion.source,
      basis: copy.conversion.basis,
      category_profile: copy.conversion.category_profile,
      matched_category_word: copy.conversion.matched_category_word,
      contact_label: copy.contactLabel.label,
      contact_label_source: copy.contactLabel.source,
      contact_label_basis: copy.contactLabel.basis,
      /* What the family rendering layer actually put on the pages: the fields the form
         asks for (and the ones this record could not support, with the reason), the
         labels it rendered, the under-button note, the days the hours rows state as
         open, the section order, Family B's three steps, the extras lines and the
         service-card action. A reviewer reads the result and the reason together. */
      form: {
        submit_label: copy.contactLabel.submit,
        note_under_button: copy.formNote,
        legends: fields.groups.map((group) => group.legend),
        fields: fields.fields.map((field) => field.manifest),
        omitted: fields.omitted.map((item) => ({ field: item.field, why: item.why })),
        preferred_days: { days: fields.preferredDays.days, basis: fields.preferredDays.basis },
      },
      section_order: Object.fromEntries(
        PAGE_IDS.map((id) => [PAGE_SPECS[id].file, SECTION_ORDER[copy.conversion.family][id] as string[]]),
      ),
      steps: copy.steps,
      extras: extras.map((line) => ({ label: line.label, value: line.value, source: line.source, field: line.field })),
      /* A service card is one link to that service's own contact page (owner revision
         #4, 6 Oct) — not a query string a script reads. The mechanism, its default and
         every page it produces are recorded here, so a reviewer reads what a tap does
         rather than inferring it. */
      service_action: {
        label: copy.conversion.family === "appointment" ? copy.ui.serviceActionRequest : copy.ui.serviceActionAsk,
        mechanism:
          "the whole card is one link to a page built for that recorded service " +
          "(contact-<service-slug>.html#form), whose own service select carries that " +
          "service's option with `selected` in the HTML — so the choice is there with " +
          "JavaScript off, on a static host that ignores query strings. No script and " +
          "no query string takes part.",
        default_option: fields.fields.find((f) => f.name === "service")?.preselected ?? null,
        pages: normaliseServices(record).map((service) => ({ service: service.name, file: servicePageFile(service.name) })),
      },
      narrative: {
        paragraphs: narrativeCount,
        excerpt_paragraphs: copy.aboutExcerptLength,
        field: "about_paragraphs",
        basis:
          narrativeCount > 0
            ? `the record carries ${narrativeCount} paragraph${narrativeCount === 1 ? "" : "s"} in \`about_paragraphs\`, printed verbatim; the home page shows the first one as an excerpt`
            : "the record carries no `about_paragraphs`, so the About section is the identity line, the services sentence and the provenance line",
      },
    },
    compliance: {
      robots_meta: "noindex, nofollow",
      banner_text: copy.banner,
      footer_disclaimer: copy.footerDisclaimer,
      banner_above_the_fold: true,
      business_own_assets_used: false,
      /* Printed with the phone number and email address; null on a delivered site. */
      contact_details_caveat: copy.contactCaveat || null,
      external_requests_on_load: [],
      external_requests_note:
        "The page loads nothing from the network: styles, script, favicon and images are files in this folder. The only outbound request the site can make is the contact-form POST, which happens when a visitor submits the form.",
      per_page: pages.map((page) => ({
        file: page.file,
        banner_above_the_fold: true,
        prints_business_details: PAGE_SPECS[page.id].printsDetails,
        caveat_instances: copy.contactCaveat ? page.html.split(esc(copy.contactCaveat)).length - 1 : 0,
        loads_site_js: page.html.includes("site.js"),
        illustration_labels: PAGE_SPECS[page.id].slots
          .flatMap((role) => images.filter((i) => i.role === role && isIllustrativeImage(i)))
          .map((i) => illustrationLabel(record.name)),
      })),
    },
    privacy: {
      file: PAGE_SPECS.privacy.file,
      mode: privacy.mode,
      contact_email: privacy.contactEmail,
      last_updated: privacy.lastUpdated,
      open_items: privacy.openItems,
      // What the retention section was composed from: the one declared operator
      // practice, and the provider's own facts as printed. A reviewer can see the basis
      // without reconstructing it from the page.
      retention: {
        declared_cadence: privacy.retention.cadence,
        window_printed: privacy.retention.window || null,
        practice_sentence: privacy.retention.practiceSentence || null,
        provider_facts: privacy.retention.providerFacts,
        source: privacy.retention.source,
      },
      /* The field list the notice's collection sentence is composed from — the same
         list the form itself is rendered from (fields.ts). */
      collection_fields: fields.fields.map((f) => f.manifest),
    },
    form: {
      provider: form.provider.label,
      endpoint: form.endpoint,
      recipient: form.recipient,
      // How the phase was decided, recorded so nobody has to remember it: the
      // comparison, its outcome, and the exact notice the page carries.
      delivery: {
        mode: delivery.mode,
        party: delivery.party,
        basis: delivery.basis,
        recipient: delivery.recipient,
        business_published_address: delivery.business_address || null,
        claimed_by_record: delivery.claimed_by_record,
        notice: copy.formNotice,
        success_message: copy.formSuccess,
      },
      needs_account: form.provider.needs_account,
      who_owns_the_account: form.provider.who_owns_the_account,
      stores_submissions: form.provider.stores_submissions,
      free_tier: form.provider.free_tier,
      if_it_lapses: form.provider.if_it_lapses,
      fields: fields.fields.map((f) => f.manifest),
      submit_label: copy.contactLabel.submit,
      fallback_shown:
        delivery.mode === "business"
          ? `The form sits next to ${record.email ? `the business's email address (${record.email})` : "no recorded email address"} and phone number, so an enquiry still reaches the business if the relay is ever down.`
          : `The form sits next to the business's published email address ${record.email ? `(${record.email}) ` : ""}and phone number, so a visitor who wants the business itself rather than this demonstration can reach it directly.`,
    },
    handoff: {
      external_dependencies: [
        {
          name: form.provider.label,
          purpose:
            delivery.mode === "business"
              ? "delivers contact-form submissions to the business's own inbox"
              : `carries contact-form submissions to ${delivery.party} while this site is a demonstration — the business named on the page is not a recipient`,
          owner: form.provider.who_owns_the_account,
          cost: form.provider.free_tier,
          url: form.provider.url || "(the endpoint configured in this record)",
        },
        {
          name: "domain registrar",
          purpose: "the address the site is published at",
          owner: "the client, as registrant from day one (Site Sourced only as technical contact)",
          cost: "the client's annual domain renewal — the single recurring item",
          url: "",
        },
        {
          name: "static hosting",
          purpose: "serves this folder",
          owner: "the client",
          cost: "free tiers exist; no server runtime, database or build step is required to keep this page up",
          url: "",
        },
      ],
      recurring_costs: [
        "annual domain renewal (the client's, set to auto-renew)",
        "everything else in this bundle is static files with no runtime cost",
      ],
      day_one_ownership: [
        "the domain registration (client is registrant)",
        "the hosting account",
        "the contact-form account and access key",
        "these files, unencumbered",
      ],
    },
    warnings,
  };

  await write("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

  let total = 0;
  for (const f of files) total += (await stat(join(dir, f))).size;

  return { slug, dir, files: manifest.files, images, warnings, bytes: total };
}

/** Every bundle output file, in the order a human would read them. */
export const BUNDLE_FILES = [
  ...PAGE_IDS.map((id) => PAGE_SPECS[id].file),
  "styles.css",
  "site.js",
  "favicon.svg",
  "README.txt",
  "manifest.json",
] as const;
