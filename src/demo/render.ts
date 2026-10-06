/**
 * Site Sourced — page rendering.
 *
 * **One record in, five pages out**, plain HTML/CSS/JS: no framework and no
 * third-party asset of any kind, so a page makes zero network requests while it
 * loads. The only outbound request the site can ever make is the contact-form POST,
 * and that goes to a relay the client owns (see forms.ts).
 *
 *   index.html    the hero, a short About, the recorded services, hours, a contact CTA
 *   services.html the full recorded list as cards, hours, a contact CTA
 *   about.html    the About paragraphs, the about photograph, hours, a contact CTA
 *   contact.html  the delivery notice, the form, the printed details, directions, hours
 *   privacy.html  our privacy notice (see `composePrivacy`)
 *
 * Three rules hold on **every** page, and `build.ts` checks each page rather than
 * trusting the template:
 *
 *   1. the proposal banner is the first content element, in normal flow;
 *   2. the same disclaimer sits next to the business's name in the footer, and the
 *      printed-details caveat sits with the details it belongs to;
 *   3. `noindex, nofollow`, so a proposal never appears in search results.
 *
 * `site.js` is loaded by the contact page and by nothing else: the form is the only
 * thing on the site that needs script, so every other page works with JavaScript off
 * and asks the browser for one file less.
 *
 * Navigation is plain links to real files, in the header and nowhere else: on a phone
 * they live behind a CSS-only `<details>` disclosure whose summary is a hamburger and
 * whose panel is a third of the viewport wide; from `48rem` they are the inline row.
 * The privacy notice left the phone's menu on the owner's instruction (6 Oct) and is
 * reachable from the footer's small print instead. There is no JavaScript-driven nav:
 * on the published host a bundle is served as flat files, so `services.html` is a path
 * that serves and `/services/` is not — the links point at files for exactly that
 * reason. The footer carries no page list; the privacy notice is linked from its small
 * print on every page, and from beside the form.
 *
 * The HTML is deliberately readable. A client who opens index.html in a text editor
 * can find their own sentences and change them.
 */

import type { BusinessRecord, ManifestImage } from "./types.ts";
import type { DemoCopy, PrivacyNotice } from "./copy.ts";
import type { CategoryProfile } from "./copy.ts";
import { familyFields, normaliseHours, normaliseServices, slugify } from "./copy.ts";
import { illustrationLabel, isIllustrativeImage } from "./copy.ts";
import type { FormDelivery } from "./delivery.ts";
import type { FieldGroup, FieldSpec } from "./fields.ts";
import { SECTION_ORDER, extrasLines, type SectionId } from "./family-render.ts";
import { serviceActionLabel } from "./family.ts";
import type { ResolvedForm } from "./forms.ts";

export interface RenderContext {
  record: BusinessRecord;
  copy: DemoCopy;
  profile: CategoryProfile;
  form: ResolvedForm;
  /** Who the form actually reaches — decides the notice and the wording around it. */
  delivery: FormDelivery;
  /** The privacy notice, composed for the same phase as the form notice. */
  privacy: PrivacyNotice;
  images: ManifestImage[];
  slug: string;
  generatedAt: string;
}

export type PageId = "index" | "services" | "about" | "contact" | "privacy";

/**
 * What each page is, as data: the filename the links point at, whether the page
 * prints the business's phone number and email (the caveat's home), whether it
 * carries the form (the only thing site.js is for), and which image slots it shows
 * (which is where an AI-illustration label has to appear).
 *
 * `build.ts` reads this table to check the right obligations on the right page, and
 * the two scripts that audit a bundle read the same table from the manifest.
 */
export interface PageSpec {
  id: PageId;
  file: string;
  printsDetails: boolean;
  carriesForm: boolean;
  slots: ("hero" | "about")[];
}

export const PAGE_SPECS: Record<PageId, PageSpec> = {
  index: { id: "index", file: "index.html", printsDetails: true, carriesForm: false, slots: ["hero", "about"] },
  services: { id: "services", file: "services.html", printsDetails: true, carriesForm: false, slots: [] },
  about: { id: "about", file: "about.html", printsDetails: true, carriesForm: false, slots: ["about"] },
  contact: { id: "contact", file: "contact.html", printsDetails: true, carriesForm: true, slots: [] },
  privacy: { id: "privacy", file: "privacy.html", printsDetails: false, carriesForm: false, slots: [] },
};

/** Every page, in the order a visitor meets them and the nav lists them. */
export const PAGE_IDS: PageId[] = ["index", "services", "about", "contact", "privacy"];

export interface RenderedPage {
  id: PageId;
  file: string;
  html: string;
}

/**
 * What makes one page differ from its plain sibling.
 *
 * There is one such difference today: a **per-service contact page** — the page a
 * service card links to — which renders the same contact page with the tapped
 * service's option carrying `selected`. It is a variant of the five-page contract,
 * not a sixth kind of page: same shell, same furniture, same form, one option chosen.
 */
export interface PageVariant {
  /** The recorded service this page's form has already chosen. */
  preselectService?: string;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** `tel:` links keep a leading + and drop everything else. */
export function telHref(phone: string): string {
  const plus = phone.trim().startsWith("+") ? "+" : "";
  return `tel:${plus}${phone.replace(/[^\d]/g, "")}`;
}

function addressLine(record: BusinessRecord): string {
  const a = record.address ?? {};
  const parts = [a.street, a.city, [a.province, a.postcode].filter(Boolean).join(" ")].filter((p) => p && p.trim());
  return parts.join(", ");
}

function directionsLink(record: BusinessRecord): string {
  const q = encodeURIComponent(addressLine(record) || record.name);
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

function osmLink(record: BusinessRecord): string {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(addressLine(record) || record.name)}`;
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  const letters = words.slice(0, 2).map((w) => w[0]!.toUpperCase());
  return letters.join("") || "SS";
}

export function renderFavicon(record: BusinessRecord, profile: CategoryProfile): string {
  const label = initials(record.name);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${esc(record.name)}">`,
    `  <rect width="64" height="64" rx="14" fill="${profile.accent}"/>`,
    `  <text x="32" y="43" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="700" fill="#ffffff">${esc(label)}</text>`,
    `</svg>`,
    ``,
  ].join("\n");
}

/* ------------------------------------------------------------ record sections */

function hoursBlock(record: BusinessRecord, copy: DemoCopy): string {
  const { rows, note } = normaliseHours(record);
  if (rows.length === 0) {
    return `        <p class="muted">${esc(copy.hoursEmpty)}</p>`;
  }
  const items = rows
    .map((r) => `          <div class="hours-row"><dt>${esc(r.days)}</dt><dd>${esc(r.hours)}</dd></div>`)
    .join("\n");
  const noteLine = note ? `\n        <p class="muted">${esc(note)}</p>` : "";
  return `        <dl class="hours card">\n${items}\n        </dl>${noteLine}`;
}

/**
 * The service cards. `level` is the heading level the names take: `h3` under a
 * section heading on the home page, `h2` on a page whose `h1` is the offering
 * itself, so no page skips a heading level.
 */
/**
 * The contact page a service card is its own link to, and the fragment that lands the
 * visitor on the form (owner revision #4, 6 Oct 2026).
 *
 * A card is **a panel with one action, carrying its own service**: tapping "Request Hot
 * shave"
 * opens a contact page whose select already says "Hot shave". That page is a real file
 * the build writes (`contact-hot-shave.html`), because the choice has to be in the HTML
 * the browser receives: a query string, a fragment or a script would all leave a
 * visitor with JavaScript off on a form that asks nothing. The option the card's
 * service selects is rendered with `selected` on that page, so the answer is there
 * before any script runs — and there is no script involved in it at all.
 *
 * The name is `slugify`d from the recorded service: one page per recorded service, and
 * `serviceCardProblems` (family-render.ts) refuses a card whose destination does not
 * really carry that service.
 */
export function servicePageFile(service: string): string {
  return `contact-${slugify(service)}.html`;
}

function serviceActionHref(name: string): string {
  return `${servicePageFile(name)}#form`;
}

function servicesBlock(record: BusinessRecord, level: 2 | 3, copy: DemoCopy): string {
  const services = normaliseServices(record);
  const heading = `h${level}`;
  if (services.length === 0) {
    return `        <p class="muted">${esc(copy.servicesEmpty)}</p>`;
  }
  // The action asks for the thing and names it, and it never promises a price — which is
  // why Family B says "Ask about Hot shave" and never "Get a quote" (design spec §6).
  // The words are the family's own, composed in `family.ts` (`serviceActionLabel`);
  // nothing here types them. The card itself is a plain panel: heading and note as
  // ordinary text, and this one link as its only control.
  return `        <ul class="services">\n${services
    .map(
      (s) =>
        `          <li class="card"><${heading}>${esc(s.name)}</${heading}>${s.note ? `<p>${esc(s.note)}</p>` : ""}` +
        `<p class="service-action"><a class="button" href="${esc(serviceActionHref(s.name))}">` +
        `${esc(serviceActionLabel(copy.conversion.family, s.name))}</a></p></li>`,
    )
    .join("\n")}\n        </ul>`;
}

/** The hero photograph, if this bundle carries one. */
function heroImage(images: ManifestImage[]): ManifestImage | undefined {
  return images.find((i) => i.role === "hero" && i.file);
}

/**
 * The hero's `srcset`, built from the sizes the bundle actually holds.
 *
 * A bundle with one file gets a single candidate: valid markup, and the browser
 * downloads exactly that file. With `images/hero-600.jpg … hero-1536.jpg` listed as
 * `variants` on the manifest image, this same markup asks a phone for the 600px file
 * instead of the 1536px one. `sizes="100vw"` because the hero is full-bleed at every
 * breakpoint.
 */
function heroSrcset(hero: ManifestImage): string {
  const variants = (hero.variants ?? []).filter((v) => v.file && v.width > 0);
  if (variants.length > 0) return variants.map((v) => `${v.file} ${v.width}w`).join(", ");
  return hero.width ? `${hero.file} ${hero.width}w` : "";
}

/**
 * `width`/`height` from the image's recorded dimensions, or nothing at all.
 *
 * Omitted rather than guessed when the size was never measured: the layout reserves
 * space from these numbers, so a wrong one is worse than no attribute.
 */
function sizeAttrs(image: ManifestImage): string {
  return image.width && image.height ? ` width="${image.width}" height="${image.height}"` : "";
}

function aboutImage(images: ManifestImage[]): ManifestImage | undefined {
  return images.find((i) => i.role === "about" && i.file);
}

/**
 * The visible caption for an AI-generated placeholder image, or "" when the image in
 * that slot is not illustrative.
 *
 * The caption is a plain `<figcaption>` in normal flow: no hover, no no-JS fallback
 * needed, nothing hidden. Its wording comes from `illustrationLabel` in copy.ts, and
 * `build.ts` refuses a page that shows an image the manifest records as AI-generated
 * while that page carries no such label.
 */
function illustrationCaption(images: ManifestImage[], role: "hero" | "about", businessName: string): string {
  const image = images.find((i) => i.role === role && isIllustrativeImage(i));
  return image ? illustrationLabel(businessName) : "";
}

/* ----------------------------------------------------------------- page shell */

function pageTitle(ctx: RenderContext, id: PageId, variant?: PageVariant): string {
  const { record, copy } = ctx;
  const city = record.address?.city;
  switch (id) {
    case "services":
      return `${copy.pages.services.title} — ${record.name}${city ? `, ${city}` : ""} (design proposal)`;
    case "about":
      return `${copy.pages.about.title} — ${record.category}${city ? ` in ${city}` : ""} (design proposal)`;
    case "contact":
      // A page built for one recorded service names it in its title, so the tab a
      // visitor opened says which service the form is already set to. The service name
      // is the record's own — nothing here composes copy.
      return variant?.preselectService
        ? `${copy.pages.contact.title}: ${variant.preselectService} — ${record.name} (design proposal)`
        : `${copy.pages.contact.title} — ${record.name} (design proposal)`;
    case "privacy":
      return copy.pages.privacy.title;
    default:
      return `${record.name} — ${record.category}${city ? `, ${city}` : ""} (design proposal)`;
  }
}

function pageDescription(ctx: RenderContext, id: PageId): string {
  const { record, copy } = ctx;
  if (id === "index") {
    return `An unsolicited design proposal from Site Sourced for ${record.name}, ${record.category.toLowerCase()}${record.address?.city ? ` in ${record.address.city}` : ""}.`;
  }
  return `${copy.pages[id].lead} An unsolicited design proposal from Site Sourced for ${record.name}.`;
}

/** The navigation: same links on every page, as real files. */
function navBlock(copy: DemoCopy, current: PageId, className: string, label: string): string {
  const items = PAGE_IDS.map((id) => navItem(copy, id, current)).join("\n");
  return `      <nav class="${className}" aria-label="${esc(label)}">
        <ul>
${items}
        </ul>
      </nav>`;
}

/**
 * One page link.
 *
 * The privacy notice is marked `nav-item--desktop` because it has left the **phone's**
 * menu (owner, 6 Oct 2026, by text): the phone panel carries the four page links the
 * owner named, and the privacy notice stays reachable from the footer's small print on
 * every page — which `privacyLinkProblems` enforces, so the phone menu cannot lose the
 * page's only other route to the notice. It keeps its place in the desktop row, so the
 * wide layout is unchanged.
 */
function navItem(copy: DemoCopy, id: PageId, current: PageId): string {
  const current_ = id === current ? ' aria-current="page"' : "";
  const desktopOnly = id === "privacy" ? ' class="nav-item--desktop"' : "";
  return `          <li${desktopOnly}><a href="${PAGE_SPECS[id].file}"${current_}>${esc(copy.nav[id])}</a></li>`;
}

/**
 * The slot's own marker class, on top of the button treatment it wears. A check needs to
 * be able to say *which* element in the header the action is (the header also holds the
 * wordmark link, four navigation links and the menu chip), and a class is how the
 * stylesheet and the gate name the same element.
 */
export const HEADER_ACTION_CLASS = "header-action";

/**
 * Which pages carry the header's action at all.
 *
 * Two kinds of page do not. The privacy notice prints none of the business's details —
 * an unconfirmed number or a contact route has no business on a notice about how we
 * handle a message — so it carries the wordmark and the navigation only. The **contact
 * section** (`contact.html` and every `contact-<service>.html`) is where the action
 * already leads: there the header action would link to the page the visitor is already
 * on, and on a per-service page it would throw away the service that page exists to
 * preselect in the HTML. Omitting it is the team's default, sent to the owner with the
 * three 6 Oct decisions.
 */
export function headerActionBelongs(id: PageId): boolean {
  return PAGE_SPECS[id].printsDetails && id !== "contact";
}

/**
 * Where a record's **primary action** leads: the business's own booking page when the
 * record carries one (the owner's 4 Oct ruling — a booking link is primary where one
 * exists), otherwise the demo's contact page. Derived here, once, so the header slot, the
 * build check and the manifest cannot disagree about the destination.
 */
export function primaryActionHref(record: BusinessRecord): string {
  const booking = (record.booking_url ?? "").trim();
  return booking === "" ? PAGE_SPECS.contact.file : booking;
}

/**
 * The header's action: **the page's primary action**, in the header's second row.
 *
 * It is a slot, never a hardcoded Call link (owner-approved 6 Oct 2026). Both halves come
 * from the record rather than from this template:
 *
 *   - the label is `copy.contactLabel.label` — the neutral `Contact Us` on a fictional
 *     fixture and the family's own words on a build from a real record (rule 8) — so the
 *     header cannot say something the page's own action does not;
 *   - the destination is `primaryActionHref` — the record's booking page when it has one,
 *     the contact page otherwise.
 *
 * The home page's **Call** button is a different thing and stays: it is the hero's own
 * action, not the header's. What this replaced was a Call link on every page — and, on a
 * record with no phone, a dead "no phone" chip where the action should be: a record with
 * no phone still has a contact page and an email, so the honest slot is the action.
 *
 * `headerActionProblems` refuses a page that disagrees with any of this — a missing
 * action, a second one, another label, another destination, or an element whose own
 * stylesheet cannot show it is 44px.
 */
function headerActionBlock(ctx: RenderContext, id: PageId): string {
  const { record, copy } = ctx;
  if (!headerActionBelongs(id)) return "";
  return `          <a class="call-button ${HEADER_ACTION_CLASS}" href="${esc(primaryActionHref(record))}">${esc(copy.contactLabel.label)}</a>`;
}

function headerBlock(ctx: RenderContext, id: PageId): string {
  const { record, copy } = ctx;
  const action = headerActionBlock(ctx, id);
  return `  <header class="site-header">
    <div class="wrap header-inner">
      <!-- The phone's navigation: a CSS-only disclosure whose summary is a hamburger.
           The control carries its name twice over — the summary's aria-label and a
           visually-hidden "Pages" inside it — because three lines are not a label a
           screen reader can read. The <nav> is this element's next sibling, never its
           child: a nav inside a closed <details> cannot be revealed by CSS. No script.
           From 48rem the summary is hidden and the same list sits inline on the
           wordmark's line. -->
      <details class="site-menu">
        <summary class="site-menu-summary" aria-label="Pages"><span class="visually-hidden">Pages</span><span class="site-menu-icon" aria-hidden="true"></span></summary>
      </details>
      <!-- The wordmark is the site's name, so it is the way home: one link to the
           demo's own home page, and on a client's site to theirs. It is a link at
           every width and on every page, including the home page itself, where a
           visitor who opened a deep page expects it to work. Its styling keeps the
           wordmark's own look — no underline until a pointer or the keyboard is on
           it (.wordmark in the stylesheet) — so the header reads as it always has.
           One link: nothing is nested inside it. -->
      <a class="wordmark" href="${PAGE_SPECS.index.file}">${esc(record.name)}</a>
${navBlock(copy, id, "site-nav", "Pages")}
${action ? `${action}\n` : ""}    </div>
  </header>`;
}

/**
 * The printed phone number and email address, next to the contact route.
 *
 * On a demonstration page they came from a public source and were never confirmed with
 * the business, so the caveat from `copy.contactCaveat` sits directly under them — here
 * and again in the footer. Which caveat that is comes from the record's declared source
 * (`provenance.ts`): the frozen "as published in public listings — please confirm" line
 * where it is true, and the fictional-example line where it is not. `build.ts` counts the
 * two instances per page and refuses the caveat that belongs to another source.
 */
function fallbackBlock(ctx: RenderContext): string {
  const { record, copy } = ctx;
  const tel = record.phone ? telHref(record.phone) : "";
  return `        <div class="contact-fallback">
          <h3>${esc(copy.fallback.heading)}</h3>
${record.email ? `          <p>${esc(copy.fallback.emailIntro)} <a href="mailto:${esc(record.email)}">${esc(record.email)}</a></p>` : `          <p>${esc(copy.fallback.noEmail)}</p>`}
${record.phone ? `          <p>${esc(copy.fallback.phoneIntro)} <a href="${tel}">${esc(record.phone)}</a></p>` : `          <p>${esc(copy.fallback.noPhone)}</p>`}
${copy.contactCaveat ? `          <!-- Compliance: the caveat that belongs with these printed details, derived from the
               record's source. Do not remove. -->
          <p class="muted">${esc(copy.contactCaveat)}</p>\n` : ""}        </div>`;
}

function footerBlock(ctx: RenderContext, id: PageId): string {
  const { record, copy } = ctx;
  const spec = PAGE_SPECS[id];
  const addr = addressLine(record);
  const tel = record.phone ? telHref(record.phone) : "";
  // The privacy page deliberately prints none of the business's details: a privacy
  // notice is not the place to repeat an unconfirmed phone number, and the plan's
  // caveat belongs only with details we actually print.
  const details = spec.printsDetails
    ? [addr ? esc(addr) : "", record.phone ? `<a href="${tel}">${esc(record.phone)}</a>` : "", record.email ? `<a href="mailto:${esc(record.email)}">${esc(record.email)}</a>` : ""]
        .filter(Boolean)
        .join("<br>\n          ")
    : "";
  return `  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div>
        <h2 class="footer-biz">${esc(record.name)}</h2>
${details ? `        <p class="footer-contact">\n          ${details}\n        </p>\n` : ""}        <!-- Compliance: the same disclaimer as the banner, next to the business's name
             and contact details. Do not remove. -->
        <p class="disclaimer">${esc(copy.footerDisclaimer)}</p>
      </div>
      <div>
${copy.contactCaveat && spec.printsDetails ? `        <!-- Compliance: the caveat that belongs with the printed details, derived from the
             record's source. Do not remove. -->
        <p class="footer-small">${esc(copy.contactCaveat)}</p>
` : ""}        <!-- Compliance: the privacy notice must stay reachable from the footer of every
             page and from beside the form. It used to be reachable through the footer's
             copy of the page navigation, which item 54 removed; this link is now the
             footer's only route to it. Do not remove. -->
        <p class="footer-small">
          <a href="${PAGE_SPECS.privacy.file}">Privacy notice</a>
        </p>
        <!-- Compliance: the provenance line, derived from the record's source. It may not
             credit a source the record does not name. Do not remove. -->
        <p class="footer-small">
          ${copy.footer.provenanceHtml}
        </p>
        <p class="footer-small">
          ${esc(copy.footer.takedown)}
        </p>
      </div>
    </div>
  </footer>`;
}

function pageHead(ctx: RenderContext, id: PageId): string {
  const { record, copy } = ctx;
  const city = record.address?.city;
  const eyebrow = [record.category, city ? `${city}, ${record.address?.province ?? "ON"}` : ""].filter(Boolean).join(" · ");
  const lead = copy.pages[id].lead;
  return `    <header class="page-head">
      <div class="wrap">
        <p class="eyebrow">${esc(eyebrow)}</p>
        <h1>${esc(copy.pages[id].title)}</h1>
${lead ? `        <p class="lead">${esc(lead)}</p>\n` : ""}      </div>
    </header>`;
}

/* --------------------------------------------------------------- page content */

function heroSection(ctx: RenderContext): string {
  const { record, copy, images } = ctx;
  const hero = heroImage(images);
  const heroSrc = hero ? heroSrcset(hero) : "";
  const caption = illustrationCaption(images, "hero", record.name);
  const tel = record.phone ? telHref(record.phone) : "";
  return `    <figure class="hero-figure">
      <div class="hero${hero ? " hero--photo" : " hero--plain"}">
${hero ? `        <!-- The hero is a real <img>, not a CSS background: it carries its own
             dimensions, a load priority and a srcset, which is what stops a phone
             reflowing the page as the picture arrives and what lets it fetch the
             smaller file rather than the biggest one. Decorative here — the headline
             over it carries the meaning — so it is alt="" and the picture is
             described, when it is an illustration, by the caption below. -->
        <img class="hero-img" src="${esc(hero.file!)}"${heroSrc ? ` srcset="${esc(heroSrc)}" sizes="100vw"` : ""}${sizeAttrs(hero)} alt="" fetchpriority="high" decoding="async">
        <div class="hero-scrim" aria-hidden="true"></div>
` : ""}        <div class="wrap hero-inner">
          <p class="eyebrow">${esc(copy.heroEyebrow)}</p>
          <h1>${esc(record.name)}</h1>
          <p class="hero-lead">${esc(copy.heroLead)}</p>
          <p class="hero-actions">
${record.phone ? `            <a class="button button--paper" href="${tel}">${esc(copy.ui.callLabel)} ${esc(record.phone)}</a>\n` : ""}            <a class="button button--ghost" href="${PAGE_SPECS.contact.file}">${esc(copy.contactLabel.label)}</a>
          </p>
        </div>
      </div>
${caption ? `      <!-- Compliance: an AI-generated placeholder is labelled as an illustration, not a
           photograph of the business. Do not remove. -->
      <figcaption class="wrap muted hero-caption">${esc(caption)}</figcaption>\n` : ""}    </figure>`;
}

function aboutSection(ctx: RenderContext, paragraphs: string[], heading: boolean): string {
  const { record, copy, images } = ctx;
  const image = aboutImage(images);
  const caption = illustrationCaption(images, "about", record.name);
  return `    <section class="section" id="about">
      <div class="wrap">
${heading ? `        <h2>About ${esc(record.name)}</h2>\n` : ""}${paragraphs.map((p) => `        <p>${esc(p)}</p>`).join("\n")}
${paragraphs.length < copy.about.length ? `        <p><a class="link-quiet link-quiet--inline" href="${PAGE_SPECS.about.file}">More about ${esc(record.name)}</a></p>\n` : ""}${image ? `        <figure class="about-figure">
          <img class="about-photo" src="${esc(image.file!)}"${sizeAttrs(image)} alt="" loading="lazy" decoding="async">
${caption ? `          <!-- Compliance: an AI-generated placeholder is labelled as an illustration. Do not remove. -->
          <figcaption class="muted">${esc(caption)}</figcaption>\n` : ""}        </figure>\n` : ""}      </div>
    </section>`;
}

function hoursAddressSection(ctx: RenderContext): string {
  const { record, copy } = ctx;
  const addr = addressLine(record);
  const hasStreet = Boolean(record.address?.street?.trim());
  return `    <section class="section" id="hours">
      <div class="wrap two-col">
        <div>
          <h2>Opening hours</h2>
          <p class="muted">${esc(copy.hoursIntro)}</p>
${hoursBlock(record, copy)}
        </div>
        <div>
          <h2>${esc(copy.locationHeading)}</h2>
${copy.locationIntro ? `          <p class="muted">${esc(copy.locationIntro)}</p>\n` : ""}          ${addr ? `<address class="address">${esc(addr)}</address>` : `<p class="address muted">${esc(copy.locationEmpty)}</p>`}
${hasStreet ? `          <p class="address-links">
            <a class="button button--small" href="${directionsLink(record)}" target="_blank" rel="noopener noreferrer">${esc(copy.ui.directions)}</a>
          </p>\n` : ""}        </div>
      </div>
    </section>`;
}

/** The link to the contact page, with the printed details beside it. */
function contactCtaSection(ctx: RenderContext, alt: boolean): string {
  const { copy } = ctx;
  return `    <section class="section${alt ? " section--alt" : ""}" id="contact">
      <div class="wrap">
        <h2>${esc(copy.contactCtaHeading)}</h2>
        <p class="muted">${esc(copy.contactCtaIntro)}</p>
        <p class="cta-actions"><a class="button" href="${PAGE_SPECS.contact.file}">${esc(copy.contactLabel.label)}</a></p>
${fallbackBlock(ctx)}
      </div>
    </section>`;
}

/**
 * The form's own fields, rendered from `FORM_FIELDS`.
 *
 * One source of truth: the same list feeds the privacy notice's collection sentence and
 * the bundle manifest, so the page cannot ask for a field the notice does not name (the
 * defect the published page shipped — an optional phone number the notice never
 * mentioned), and the notice cannot name a field the page does not ask for.
 */
function fieldLabel(copy: DemoCopy, field: FieldSpec): string {
  const text = esc(copy.ui[field.labelKey]);
  return field.optional ? `${text} <span class="optional">${esc(copy.ui.fieldOptional)}</span>` : text;
}

/**
 * One field, drawn from the family's own set (`familyFields`) — the same object the
 * manifest lists and the privacy notice's collection sentence is composed from.
 *
 * Three controls, each working with JavaScript off:
 *
 *   - a text/email/tel/textarea field, exactly as before;
 *   - a `select` with the **native** picker (no custom arrow, no script, better on a
 *     phone than anything we would draw);
 *   - a chip group — checkbox or radio — where the control is visually hidden but
 *     focusable, so it still posts, still works by keyboard, and needs no `:has()`
 *     (the checked state is drawn from the sibling `<span>`, which every browser we
 *     care about supports).
 *
 * The `required` attribute follows the field's own flag, never the `(optional)`
 * marker: a select whose default is one of its own options is never empty but is
 * equally not something a visitor could fail to answer.
 */
function fieldHtml(copy: DemoCopy, field: FieldSpec, preselectService?: string): string {
  const label = fieldLabel(copy, field);
  // The one thing a per-service contact page changes: the service select carries the
  // recorded service the visitor tapped as its `selected` option, in the HTML, with no
  // script and no query string involved. Every other field — and the plain contact
  // page, which passes nothing — keeps the default the field's own set decided.
  const selected = field.name === "service" && preselectService ? preselectService : field.preselected;

  if (field.control === "checkbox" || field.control === "radio") {
    const chips = (field.options ?? [])
      .map(
        (option) =>
          `              <label class="chip"><input type="${field.control}" name="${field.name}" value="${esc(option)}"${
            selected === option ? " checked" : ""
          }><span class="chip-text">${esc(option)}</span></label>`,
      )
      .join("\n");
    return `          <fieldset class="field choice-group${field.name === "days" ? " choice-group--days" : ""}">
            <legend>${label}</legend>
            <div class="choice-wrap">
${chips}
            </div>
          </fieldset>`;
  }

  const attrs = [
    `id="${field.id}"`,
    `name="${field.name}"`,
    field.autocomplete ? `autocomplete="${field.autocomplete}"` : "",
    field.required ? "required" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (field.control === "select") {
    const options = (field.options ?? [])
      .map(
        (option) =>
          `              <option value="${esc(option)}"${selected === option ? " selected" : ""}>${esc(option)}</option>`,
      )
      .join("\n");
    return `          <div class="field">
            <label for="${field.id}">${label}</label>
            <select ${attrs}>
${options}
            </select>
          </div>`;
  }

  const control =
    field.control === "textarea"
      ? `            <textarea ${attrs} rows="${field.rows ?? 5}"></textarea>`
      : `            <input type="${field.control}" ${attrs}>`;
  return `          <div class="field">
            <label for="${field.id}">${label}</label>
${control}
          </div>`;
}

/** One fieldset: a short small-caps legend over the fields it groups. */
function fieldGroupHtml(copy: DemoCopy, group: FieldGroup, index: number, preselectService?: string): string {
  return `          <fieldset class="field-group${index > 0 ? " field-group--second" : ""}">
            <legend class="field-group-legend">${esc(group.legend)}</legend>
${group.fields.map((field) => fieldHtml(copy, field, preselectService)).join("\n")}
          </fieldset>`;
}

function contactFormSection(ctx: RenderContext, preselectService?: string): string {
  const { copy, form } = ctx;
  const fields = familyFields(ctx.record);
  const honeypot = form.provider.key === "web3forms" ? "botcheck" : "_gotcha";
  const hidden = Object.entries(form.hiddenFields)
    .map(([k, v]) => `            <input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("\n");
  // No section heading: the page's own <h1> is this page's title ("Contact" in demo
  // phase, "Contact {name}" on a client's site), so a heading here printed the same
  // words twice in a row (§P6.0). The delivery notice below already says what the form
  // is and who receives a message, exactly as services.html's block carries no heading
  // because its <h1> is already the offering.
  return `    <section class="section section--alt" id="form">
      <div class="wrap">
        <!-- Compliance: this notice must stay next to the form. It is derived from
             the delivery the record describes, never written by hand. -->
        <p class="form-notice">${esc(copy.formNotice)}</p>

        <form class="contact-form" id="contact-form" method="POST" action="${esc(form.endpoint)}"
              data-encode="${esc(form.provider.encode)}" data-success="${esc(copy.formSuccess)}"
              data-failure="${esc(copy.formFailure)}">
${fields.groups.map((group, index) => fieldGroupHtml(copy, group, index, preselectService)).join("\n")}
          <div class="hp" aria-hidden="true">
            <label for="cf-${honeypot}">${esc(copy.ui.honeypot)}</label>
            <input id="cf-${honeypot}" name="${honeypot}" type="text" tabindex="-1" autocomplete="off">
          </div>
          <input type="hidden" name="request_type" value="${esc(copy.conversion.family)}">
${hidden}
          <p class="form-actions"><button class="button" type="submit">${esc(copy.contactLabel.submit)}</button></p>
          <!-- The qualifier the button needs, derived from the delivery mode and the
               family: on an appointment page it is the request-not-a-booking line, and
               on a demonstration page it says nothing here is booked. Do not reword
               without the record behind it. -->
          <p class="form-note">${esc(copy.formNote)}</p>
          <p class="form-status" id="form-status" role="status" aria-live="polite"></p>
        </form>

        <p class="form-privacy"><a href="${PAGE_SPECS.privacy.file}">${esc(copy.ui.privacyLink)}</a></p>

${fallbackBlock(ctx)}
      </div>
    </section>`;
}

function privacySection(ctx: RenderContext): string {
  const { privacy } = ctx;
  const blocks = privacy.sections
    .map(
      (s) => `        <h2>${esc(s.heading)}</h2>
${s.paragraphs.map((p) => `        <p>${esc(p)}</p>`).join("\n")}`,
    )
    .join("\n");
  return `    <section class="section">
      <div class="wrap privacy-notice">
${blocks}
        <p class="muted updated">Last updated: ${esc(privacy.lastUpdated)}.</p>
      </div>
    </section>`;
}

/* -------------------------------------------------------------- the five pages */

/**
 * One page, complete: shell, content, footer. Every page carries the banner, the
 * disclaimer and its own copy of whatever compliance line belongs to its content,
 * because compliance is per-page and never inherited.
 */
/**
 * One block of a page, drawn. The blocks each page carries, and their order, come from
 * `SECTION_ORDER` in `family-render.ts`, so a family's page shape is **data**: Family B's
 * home page carries its "How an inquiry works" between the recorded services and the
 * hours, and Family A's does not, without either of them being a branch in the template.
 */
function sectionHtml(ctx: RenderContext, id: PageId, section: SectionId, variant?: PageVariant): string {
  switch (section) {
    case "head":
      return pageHead(ctx, id);
    case "hero":
      return heroSection(ctx);
    case "about-short":
      return aboutSection(ctx, ctx.copy.about.slice(0, ctx.copy.aboutExcerptLength), true);
    // The About page's own body: its page head already says "About {name}", so the
    // section carries no heading of its own (§P6.0 — a page never repeats its h1).
    case "about-full":
      return aboutSection(ctx, ctx.copy.about, false);
    case "services":
      return id === "index" ? servicesHomeSection(ctx) : servicesPageSection(ctx);
    case "how":
      return stepsSection(ctx);
    case "hours":
      return hoursAddressSection(ctx);
    case "extras":
      return extrasSection(ctx);
    case "form":
      return contactFormSection(ctx, variant?.preselectService);
    case "privacy":
      return privacySection(ctx);
    case "cta":
      return contactCtaSection(ctx, true);
  }
}

/** The services block as the home page shows it: the offering noun as its heading. */
function servicesHomeSection(ctx: RenderContext): string {
  const { record, copy } = ctx;
  const title = copy.offeringPlural.charAt(0).toUpperCase() + copy.offeringPlural.slice(1);
  return `    <section class="section section--alt" id="services">
      <div class="wrap">
        <h2>${esc(title)}</h2>
${copy.servicesIntro ? `        <p class="muted">${esc(copy.servicesIntro)}</p>\n` : ""}${servicesBlock(record, 3, copy)}
      </div>
    </section>`;
}

/** The services block as its own page shows it: the `h1` is the offering, so no `h2`. */
function servicesPageSection(ctx: RenderContext): string {
  return `    <section class="section" id="services">
      <div class="wrap">
${servicesBlock(ctx.record, 2, ctx.copy)}
      </div>
    </section>`;
}

/**
 * Family B's three steps — describe the job, who receives it, who answers — as a
 * process list rather than a claim. The lines are data (`copy.steps`, derived from the
 * delivery mode by `inquirySteps`), so both phases render the same markup and only the
 * words change; Family A has no such block and `copy.steps` is empty there.
 */
function stepsSection(ctx: RenderContext): string {
  const { copy } = ctx;
  if (copy.steps.length === 0) return "";
  const items = copy.steps
    .map(
      (step, index) =>
        `          <li><span class="step-num" aria-hidden="true">${index + 1}</span><span class="step-text">${esc(step)}</span></li>`,
    )
    .join("\n");
  return `    <section class="section" id="how">
      <div class="wrap">
        <h2>${esc(copy.stepsHeading)}</h2>
        <ol class="steps">
${items}
        </ol>
      </div>
    </section>`;
}

/**
 * The extras card: the record's own facts, one per line, in the client's words. A
 * record with none of them renders **no card at all** — no heading, no empty list, no
 * generic filler (design spec §4).
 */
function extrasSection(ctx: RenderContext): string {
  const { copy, record, profile } = ctx;
  const lines = extrasLines({ record, profileKey: profile.key, labels: copy.ui });
  if (lines.length === 0) return "";
  const items = lines
    .map((line) => `          <div class="extras-item"><dt>${esc(line.label)}</dt><dd>${esc(line.value)}</dd></div>`)
    .join("\n");
  return `    <section class="section" id="extras">
      <div class="wrap">
        <h2>${esc(copy.ui.extrasHeading)}</h2>
        <dl class="card extras">
${items}
        </dl>
      </div>
    </section>`;
}

/**
 * One page, complete: shell, content, footer. Every page carries the banner, the
 * disclaimer and its own copy of whatever compliance line belongs to its content,
 * because compliance is per-page and never inherited.
 */
export function renderPage(ctx: RenderContext, id: PageId, variant?: PageVariant): string {
  const { record, copy, delivery } = ctx;
  const spec = PAGE_SPECS[id];
  // The page's blocks, in this family's order. A block that renders nothing — the
  // extras card on a record with no extras, the steps on an appointment page — is
  // dropped rather than left as an empty section.
  const body = SECTION_ORDER[copy.conversion.family][id]
    .map((section) => sectionHtml(ctx, id, section, variant))
    .filter((block) => block !== "")
    .join("\n\n");

  return `<!doctype html>
<html lang="en-CA" class="page page--${id}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Compliance: this page must never appear in search results. Do not remove this line. -->
  <meta name="robots" content="noindex, nofollow">
  <title>${esc(pageTitle(ctx, id, variant))}</title>
  <meta name="description" content="${esc(pageDescription(ctx, id))}">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a class="skip-link" href="#main">${esc(copy.ui.skip)}</a>

  <!-- Compliance: the proposal banner sits above everything, in normal flow, so it
       is visible without scrolling on every screen size. Do not remove. -->
  <div class="proposal-banner" role="note">
    <p class="wrap">${esc(copy.banner)}</p>
  </div>

${headerBlock(ctx, id)}

  <main id="main">
${body}
  </main>

${footerBlock(ctx, id)}

${spec.carriesForm ? `  <!-- The only page that loads a script: the form is the only thing here that needs
       one. With JavaScript off a visitor submits the form in the ordinary way. -->
  <script src="site.js" defer></script>\n` : ""}</body>
</html>
`;
}

/**
 * Every page of one bundle, in order: the five the page contract names, then one
 * contact page per recorded service — the destination a service card is its own link
 * to, with that service already chosen in the HTML (owner revision #4, 6 Oct 2026).
 *
 * A record with no recorded services gets no such page, exactly as it gets no service
 * cards: the list is the record's, and a gap is never filled.
 */
export function renderPages(ctx: RenderContext): RenderedPage[] {
  const core = PAGE_IDS.map((id) => ({ id, file: PAGE_SPECS[id].file, html: renderPage(ctx, id) }));
  const servicePages = normaliseServices(ctx.record).map((service) => ({
    id: "contact" as PageId,
    file: servicePageFile(service.name),
    html: renderPage(ctx, "contact", { preselectService: service.name }),
  }));
  return [...core, ...servicePages];
}

/** The home page alone — kept for the tests and callers that only want it. */
export function renderIndex(ctx: RenderContext): string {
  return renderPage(ctx, "index");
}

/* -------------------------------------------------------------- the stylesheet */

export function renderCss(profile: CategoryProfile, slug: string): string {
  return `/* Site Sourced demo stylesheet — ${slug}
   Plain CSS: no framework, no preprocessor, no @import, and nothing fetched from
   the network. The two fonts live in fonts/, beside this file, and are served from
   the same folder. The business's category supplies the four accent values; every
   other value is a token below, so a palette change is a change of four lines.

   One stylesheet serves all five pages. The design system behind these decisions is
   docs/design-system.md. */

/* ------------------------------------------------------------------ fonts */

@font-face {
  font-family: "Fraunces";
  src: url("fonts/fraunces-latin-600.woff2") format("woff2");
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Source Sans 3";
  src: url("fonts/source-sans-3-latin.woff2") format("woff2");
  font-weight: 200 900;
  font-style: normal;
  font-display: swap;
}

/* ----------------------------------------------------------------- tokens */

:root {
  /* Type */
  --font-display: "Fraunces", Georgia, "Times New Roman", serif;
  --font-body: "Source Sans 3", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  /* CANDIDATE A (owner's type-treatment ask, 6 Oct 2026) — a display-scale push, same
     two faces, no new file. The tokens below replace the ones docs/design-system.md §2
     carries; if this candidate is the one the owner picks, that section's table changes
     in the same commit. --fs-page is new here: an inner page's title used to borrow
     --fs-h2 (24px at 360px, barely above a section heading), so the loudest thing on
     an inner page was the least designed thing on it. */
  --fs-display: clamp(2.4rem, 11vw, 3.6rem);
  --fs-page: clamp(2.1rem, 8.5vw, 2.6rem);
  --fs-h2: clamp(1.5rem, 5vw, 2.05rem);
  --fs-h3: 1.2rem;
  --fs-lead: clamp(1.0625rem, 2.4vw, 1.1875rem);
  --fs-body: 1.0625rem;
  --fs-small: 0.875rem;
  --fs-label: 0.75rem;

  /* Colour — one accent, ink, paper, warm grey. Contrast is measured in
     docs/design-system.md §3; every pair a visitor reads meets 4.5:1. */
  --accent: ${profile.accent};
  --accent-ink: ${profile.accentInk};
  --accent-soft: ${profile.accentSoft};
  --ink: #16181B;
  --body-text: #3D444C;
  --muted: #5E6672;
  --paper: #FFFFFF;
  --paper-2: #FAF7F2;
  --line: #E6E2DA;
  --footer-ink: #C3C9D1;

  /* Space — a 4px base, named by what it is for. */
  --s-1: 0.25rem;
  --s-2: 0.5rem;
  --s-3: 0.75rem;
  --s-4: 1rem;
  --s-5: 1.5rem;
  --s-6: 2rem;
  --s-7: 3rem;
  --s-8: 4rem;
  --s-9: 6rem;
  --section-y: clamp(3rem, 8vw, 5rem);

  /* Layout and shape */
  --wrap: 68rem;
  --gutter: 1.25rem;
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 18px;
  --rule: 1px solid var(--line);
  --shadow: 0 1px 2px rgba(16, 18, 20, .05), 0 8px 24px -16px rgba(16, 18, 20, .25);
}

/* ------------------------------------------------------------------- base */

*, *::before, *::after { box-sizing: border-box; }

html {
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--body-text);
  font-family: var(--font-body);
  font-size: var(--fs-body);
  line-height: 1.6;
}

img { display: block; max-width: 100%; height: auto; }

h1, h2, h3 {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--ink);
  letter-spacing: -0.01em;
  text-wrap: balance;
}

h1 { font-size: var(--fs-display); line-height: 1.02; letter-spacing: -0.025em; margin: 0 0 var(--s-4); }
h2 { font-size: var(--fs-h2); line-height: 1.15; margin: 0 0 var(--s-3); }
h3 { font-size: var(--fs-h3); line-height: 1.25; margin: 0 0 var(--s-1); }

p { margin: 0 0 var(--s-4); max-width: 34em; }

a { color: var(--accent-ink); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
a:hover { text-decoration-thickness: 2px; }

:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.wrap { width: min(var(--wrap), 100% - var(--gutter) * 2); margin-inline: auto; }
.muted { color: var(--muted); }
.lead { max-width: 34em; font-size: var(--fs-lead); line-height: 1.5; color: var(--body-text); }

.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 9;
  background: var(--paper);
  color: var(--ink);
  padding: var(--s-3) var(--s-4);
  border-radius: 0 0 var(--r-md) 0;
  box-shadow: var(--shadow);
}
.skip-link:focus { left: 0; }

/* The proposal banner: first thing on the page, in normal flow, never hidden. */
.proposal-banner {
  background: var(--ink);
  color: #fff;
  border-bottom: 3px solid var(--accent);
}
/* The three standalone compliance lines — this banner, the footer disclaimer and the
   illustration caption — are centred at both widths. They stand on their own with
   nothing beside them, so a centred block does not break a reading line. The two lines
   that sit beside a control (the printed-details caveat and the form-delivery notice)
   stay left-aligned: they are read as prose attached to the details and the button.

   The inline-auto margin also fixes the alignment this line had: a bare
   margin: 0 used to beat the wrap rule's margin-inline: auto, so the banner's text sat
   flush to the viewport's left edge while the rest of the page was inset by the
   gutter. */
.proposal-banner p {
  margin: 0 auto;
  padding: 0.7rem 0;
  font-size: var(--fs-small);
  line-height: 1.5;
  max-width: 60em;
  text-align: center;
}

/* ----------------------------------------------------------------- header */

.site-header {
  /* The phone menu panel is positioned against this box, and --gutter is the page's
     own left edge, so the panel opens on the same line the hamburger sits on. */
  position: relative;
  background: var(--paper);
  border-bottom: var(--rule);
}
.header-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-3) var(--s-4);
  padding: var(--s-4) 0;
}

/* The home page is one surface, and the header sits **on** the photograph (owner
   retouch, 6 Oct 2026). The header and the page body are given the same grid row, so
   the picture behind the header runs up to the proposal banner and no white band sits
   between them; the header takes the top of that row (align-self: start) and paints
   above the picture (z-index, which works because .site-header is positioned). The
   banner keeps row 1 and the footer row 3, so the page below the hero is exactly the
   page it was. The photograph's own height is untouched: it is the header's former
   row that the picture now fills.

   An inner page has no photograph, so nothing there overlays anything. page--index is
   on the home page alone, and headerOverlayProblems in build.ts refuses an overlay
   rule that is not scoped to it. Those pages keep the paper surface and the hairline
   that gives the page-head band its top edge.

   The wash below is the header's own, because the picture is unknown until it is
   drawn: it must hold up over the lightest pixel a photograph can contain, which is
   pure white. Its lightest stop is rgba(10, 12, 14, .63), and no part of the wash is
   lighter than that, so white text on it is 5.77:1 whatever the picture turns out to
   be. */
/* Every one of the four is placed in the one column explicitly: a row without a
   column lets auto-placement find the cell occupied and start a second, implicit
   column, which is sized by its content and leaves the real one nothing to give. */
.page--index body { display: grid; grid-template-columns: minmax(0, 1fr); }
.page--index .proposal-banner { grid-area: 1 / 1; }
.page--index .site-header { grid-area: 2 / 1; }
.page--index main { grid-area: 2 / 1; }
.page--index .site-footer { grid-area: 3 / 1; }
.page--index .site-header {
  align-self: start;
  z-index: 1;
  /* No wash (owner, 6 Oct): the header's box is bare and the photograph runs to its
     top edge. What delimits it instead is one light hairline at each edge — above it
     against the proposal banner, below it against the hero copy — so it reads as a
     band that has been ruled off, not as a panel sitting on the picture. The base
     .site-header rule paints --paper; this rule has to switch that off, and
     headerOverlayProblems refuses a build where it is back. */
  background: none;
  border-top: 1px solid rgba(255, 255, 255, .55);
  border-bottom: 1px solid rgba(255, 255, 255, .55);
  /* The wordmark inherits this, which is the only reason white reaches it: the
     wordmark's own rule is color: inherit, and it stays that way. */
  color: #fff;
}
/* With the wash gone, white glyphs sit on the picture itself, and a header on an
   unknown photograph needs something between type and image. This is the minimal
   glyph-level device (owner, 6 Oct: no background band): a soft ink halo under the
   strokes only — 1px down, 2px of blur, the same ink the hero scrim is mixed from —
   which measured 4.6:1 at its worst on the lightest header in the two demos. It is
   not a surface: it paints behind the glyphs and nowhere else, and it cannot be read
   as a band because it has no box. */
.page--index .site-header .wordmark { text-shadow: 0 1px 2px rgba(10, 12, 14, .55); }
/* The action on the wash is a white pill with the ink label (17.8:1 inside it) and
   5.77:1 against the wash — where the ink pill on the wash is 3.2:1, a control edge
   that only just clears the 3:1 a non-text boundary needs. Every .call-button in the
   header is the action: the slot is the page's primary action (render.ts
   headerActionBlock) and nothing else in the header wears the treatment, so this rule
   needs no exemption for a chip that is not a link. */
.page--index .site-header .call-button { background: #fff; color: var(--ink); }
.page--index .site-header .call-button:hover { background: #F1EEE8; color: var(--ink); }
/* The accent focus ring is 1.3:1 on the wash — invisible, and an outright failure of
   the 3:1 an indicator needs. Inside this header the ring is white (5.77:1 there). */
.page--index .site-header :focus-visible { outline-color: #fff; }
.page--index .header-inner { padding: var(--s-3) 0; }
.wordmark {
  /* A phone needs the wordmark on one line with the hamburger and the header's action
     on the next, and a flex line is broken on the item's hypothetical main size before
     anything shrinks. A basis of half the row puts the wordmark and the hamburger on
     the first line — the wordmark's own width, about 255px at 1.3rem, would otherwise
     claim that line and leave the action nowhere but a third line — and the action,
     which cannot share a line with both, takes the second row to itself. The
     desktop block below puts the auto basis back, so the wide layout is untouched. */
  flex: 1 1 50%;
  min-width: 0;
  margin: 0;
  font-family: var(--font-display);
  /* CANDIDATE A: the name goes up with the h1 — 18.4px to 20px. It is measured, not
     guessed, because the row is the hard limit: at 360px the header's inner box is
     320px, and the 44px menu chip plus the gap leaves the name 260px. Measured natural
     widths in Fraunces: 1.15rem 231px, 1.2rem 241px, 1.25rem 251px, 1.3rem 261px — so
     1.25rem is the ceiling and 1.3rem wrapped the name onto two lines at 360px. It also
     means a real business whose name runs longer than these two fixtures wraps here. */
  font-size: 1.25rem;
  line-height: 1.2;
  letter-spacing: -0.02em;
  /* The wordmark is a link home (owner revision, 6 Oct). At rest it keeps exactly the
     look it had as a paragraph — the site's name in the display face, no underline —
     and it shows a visitor it is a link by underlining on hover and on keyboard focus,
     which is also the only state in which an underline here would mean anything. The
     colour is inherited, so the header's contrast pairs are unchanged: body text on
     paper and on the footer, both measured in docs/design-system.md §3. */
  color: inherit;
  text-decoration: none;
}
.wordmark:hover, .wordmark:focus-visible { text-decoration: underline; text-underline-offset: 3px; }
.site-header .call-button { margin-left: auto; }
/* Off-screen, still read aloud. The phone menu's summary draws three lines, so its name
   cannot be its visible text; this carries the name a screen reader reads. */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  min-width: 0;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

/* The navigation, in two shapes and with no JavaScript in either.
   On a phone the page links sit in a left-side panel opened by a hamburger: a
   <details> summary (native semantics, keyboard-operable, no script) whose next
   sibling is the panel — never its child, because a nav inside a closed <details>
   cannot be revealed by CSS.
   The summary is a 44×44px target, the printable minimum, and it is named twice over:
   by aria-label and by the visually-hidden text inside it. Three lines are not a
   label, and an icon-only control is one a screen reader cannot read.
   The panel is a third of the viewport wide with a min-content floor, so a link row
   can never wrap or clip: 33% of a 360px viewport is 119px, which holds "Services" with
   room to spare, and on a narrower screen the floor widens the panel rather than
   squeezing the text (white-space: nowrap on the links is what gives the floor its
   job). The panel is taken **out of the flow**, so opening it cannot add a row to the
   header: item 44's two-row phone header holds whatever the menu does.
   From 48rem the summary goes, the panel's geometry is undone, and the same list sits
   inline on the wordmark's line. */
.site-menu { flex: 0 0 auto; margin: 0; }
.site-menu-summary {
  /* The visually-hidden name is positioned against this box, not the page. */
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border: var(--rule);
  border-radius: var(--r-md);
  background: var(--paper-2);
  color: var(--ink);
  list-style: none;
  cursor: pointer;
}
.site-menu-summary::-webkit-details-marker { display: none; }
.site-menu-summary::marker { content: ""; }
.site-menu[open] .site-menu-summary { background: var(--accent-soft); border-color: var(--accent); }
/* Three 18×2px lines, 6px apart, drawn from one element: the two shadows repeat the bar
   rather than a second and third span. No icon file, no third-party asset. */
.site-menu-icon {
  display: block;
  width: 1.125rem;
  height: 2px;
  background: currentColor;
  box-shadow: 0 -0.375rem 0 currentColor, 0 0.375rem 0 currentColor;
}
.site-nav {
  position: absolute;
  top: 100%;
  left: var(--gutter);
  z-index: 5;
  display: none;
  width: 33vw;
  min-width: min-content;
  margin-top: var(--s-2);
  padding: var(--s-2);
  background: var(--paper);
  border: var(--rule);
  border-radius: var(--r-md);
  box-shadow: var(--shadow);
}
.site-menu[open] ~ .site-nav { display: block; }
.site-nav ul {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
/* The privacy notice is not in the phone's menu (owner, 6 Oct): the four page links the
   owner named are, and the notice stays reachable from the footer's small print on every
   page — which privacyLinkProblems keeps there. It keeps its place in the desktop row. */
.site-nav li.nav-item--desktop { display: none; }
.site-nav a {
  display: flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0 var(--s-3);
  border-radius: var(--r-md);
  background: var(--paper-2);
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--body-text);
  text-decoration: none;
  white-space: nowrap;
}
.site-nav a:hover { color: var(--ink); background: #F1EEE8; }
.site-nav a[aria-current="page"] { background: var(--accent-soft); color: var(--accent-ink); }

/* ---------------------------------------------------------------- buttons */

.button, .call-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  min-height: 2.75rem;
  padding: 0.7rem 1.15rem;
  border: 1px solid transparent;
  border-radius: var(--r-md);
  background: var(--ink);
  color: #fff;
  font-family: var(--font-body);
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.2;
  text-decoration: none;
  cursor: pointer;
}
.button:hover, .call-button:hover { background: #000; color: #fff; }

.button--paper { background: #fff; color: var(--ink); }
.button--paper:hover { background: #F1EEE8; color: var(--ink); }

.button--ghost {
  background: rgba(255, 255, 255, .1);
  color: #fff;
  border-color: rgba(255, 255, 255, .75);
}
.button--ghost:hover { background: rgba(255, 255, 255, .22); color: #fff; }

/* Backlog 273f40d1: the design system promises 44×44 (docs/design-system.md §…), and
   this control was 36px. It is the "Get directions" action, alone in its own paragraph,
   so the height is the whole fix — nothing sits on the line beside it. */
.button--small { min-height: 2.75rem; padding: 0.45rem 0.9rem; font-size: var(--fs-small); }

/* The quiet link — "More about <the business's name>", under the home page's About
   excerpt. It is a control, not part of a sentence: it is the only thing in its
   paragraph (the --inline modifier resets the left offset and nothing else), so padding
   can give it the 44px the design system promises without bursting a line of running
   text. The box grows downward and the words stay where they were; the fill is
   transparent, so what a visitor sees is unchanged. A quiet link set *inside* running
   text would need a pseudo-element hit area instead — that is why this rule says where
   it is used. */
.link-quiet {
  display: inline-block;
  min-height: 2.75rem;
  padding: 0.5rem 0;
  margin: var(--s-3) 0 0 var(--s-4);
  font-size: var(--fs-small);
  color: var(--muted);
}
.link-quiet--inline { margin-left: 0; }
.cta-actions { margin: var(--s-5) 0 0; max-width: none; }

/* --------------------------------------------------------------- eyebrow */

/* Uppercase label line — category and place — with the one accent mark that is not
   a button. Used on the hero and at the top of every other page. */
.eyebrow {
  margin: 0 0 var(--s-3);
  font-size: var(--fs-label);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
.eyebrow::before {
  content: "";
  display: inline-block;
  width: 1.5rem;
  height: 2px;
  margin-right: var(--s-2);
  vertical-align: middle;
  background: var(--accent);
}

/* ------------------------------------------------------------------- hero */

/* The hero is a real <img> filling a grid cell the copy sits in: the row is as tall
   as the taller of the two, so the picture never decides where the words go. The
   background below is the fallback — a bundle where no photograph passed the licence
   check gets this ink gradient and nothing else. */
.hero {
  display: grid;
  background: linear-gradient(140deg, var(--ink), #2C323A 70%);
  color: #fff;
}
.hero > * { grid-area: 1 / 1; }
.hero--photo { background: #1A1D21; }
/* The picture fills the first screen on a phone and is bounded on a tall desktop
   monitor: the 22rem line is the fallback for a browser without svh. Height only —
   the bytes the hero costs are set by its srcset and the per-page weight budget. */
.hero-img {
  width: 100%;
  height: 100%;
  min-height: 22rem;
  min-height: min(78svh, 34rem);
  object-fit: cover;
  object-position: center;
}
/* The scrim is what makes white text on an unknown photograph legible: measured at
   11:1 for white on the lightest part of it. Never removed, whatever the picture. */
.hero-scrim {
  background: linear-gradient(180deg, rgba(10, 12, 14, .58) 0%, rgba(10, 12, 14, .40) 34%, rgba(10, 12, 14, .88) 100%);
}
.hero-inner { align-self: end; padding: var(--s-7) 0 var(--s-6); }
.hero .eyebrow { color: rgba(255, 255, 255, .9); }
.hero .eyebrow::before { background: #fff; }
.hero h1 { color: #fff; margin-bottom: var(--s-4); max-width: 20ch; letter-spacing: -0.035em; }
.hero-lead { margin: 0; max-width: 30rem; font-size: var(--fs-lead); line-height: 1.5; color: rgba(255, 255, 255, .94); }
.hero-actions { display: flex; flex-wrap: wrap; gap: var(--s-3); margin: var(--s-5) 0 0; max-width: none; }
.hero :focus-visible { outline-color: #fff; }

/* The two figures exist so a placeholder has a caption element to live in: the hero's
   under the picture, in normal flow. Its wording is fixed by build-gated copy; only
   its spacing is design. */
.hero-figure, .about-figure { margin: 0; }
/* A standalone notice, centred like the banner and the footer disclaimer. The auto
   inline margin keeps the wrap measure this element also carries — a bare
   margin: var(--s-3) 0 0 used to cancel it and leave the caption flush to the left. */
.hero-caption { margin: var(--s-3) auto 0; padding-bottom: var(--s-1); font-size: var(--fs-small); text-align: center; }

/* ----------------------------------------------------------------- page head */

/* Every page but the home page opens with this band instead of a photograph: cheaper
   on a phone than five copies of one hero, and it keeps the headline the loudest
   thing on the page. */
.page-head {
  padding: var(--s-7) 0 var(--s-5);
  background: var(--paper-2);
  border-bottom: var(--rule);
}
.page-head h1 { font-size: var(--fs-page); line-height: 1.05; margin-bottom: var(--s-3); }
.page-head .lead { margin: 0; }

/* --------------------------------------------------------------- sections */

.section { padding: var(--section-y) 0; }
.section--alt { background: var(--paper-2); border-block: var(--rule); }
.section h2 { margin-bottom: var(--s-3); }
.section h2::before {
  content: "";
  display: block;
  width: 2.25rem;
  height: 3px;
  border-radius: 2px;
  background: var(--accent);
  margin-bottom: var(--s-3);
}
.section p { color: var(--body-text); }
.section .muted, .muted { color: var(--muted); }

.address { font-style: normal; font-weight: 600; color: var(--ink); line-height: 1.5; }
.address-links { margin: var(--s-4) 0 0; }
/* The hours/address split is two blocks inside one section. On a phone they stack, and
   they used to touch — the hours card's bottom margin is 0 and the second block began
   the moment the first ended, so "Where {name} is" read as part of the card above it.
   The gap is the token every section boundary in the template is built from rather than
   a number of its own: --section-y, the section's own top spacing, so the pair reads
   like the section boundary it is. Above 48rem the pair is the two-column grid below,
   whose own gap does this job, so the margin goes there. */
.two-col > div + div { margin-top: var(--section-y); }
.page-head + .section { padding-top: var(--s-7); }

/* The card: one white surface with a hairline edge, used for the service list and
   the hours table. Defined once so the two cannot drift apart. */
.card {
  background: var(--paper);
  border: var(--rule);
  border-radius: var(--r-lg);
  box-shadow: 0 1px 2px rgba(16, 18, 20, .03);
}

.services { list-style: none; margin: var(--s-5) 0 0; padding: 0; display: grid; gap: var(--s-3); }
/* A service card is a plain panel with one action (owner text, 6 Oct 2026). The heading
   and the note are ordinary text; the card's one control is a link wearing the site's
   button treatment — 44px tall, named after its own service. Nothing else in the card is
   clickable, so there is one tap target and one tab stop per card, and the card stops
   being a single giant target a thumb can hit while it is scrolling. The column layout
   and the action's auto top margin keep the button at the foot of every card, so a row
   of cards with notes of different lengths still lines its buttons up. */
.services li.card {
  padding: var(--s-4) var(--s-5);
  display: flex;
  flex-direction: column;
  transition: border-color .15s ease;
}
.services li.card:hover, .services li.card:focus-within { border-color: var(--accent); }
.services p { margin: 0; max-width: none; color: var(--muted); font-size: 0.9375rem; }
/* The card's one control. The wrapping paragraph carries the spacing, so the button's
   own padding and its 44px min-height stay exactly what .button gives every other
   action on the site; a top margin of auto is what puts it at the foot of a taller
   card. */
.services .service-action { margin: auto 0 0; padding-top: var(--s-4); }

.hours { margin: var(--s-5) 0 0; max-width: 30rem; overflow: hidden; }
.hours-row {
  display: flex;
  justify-content: space-between;
  gap: var(--s-4);
  padding: var(--s-3) var(--s-4);
  border-bottom: var(--rule);
}
.hours-row:last-child { border-bottom: 0; }
.hours dt { margin: 0; font-weight: 600; color: var(--ink); }
.hours dd { margin: 0; color: var(--muted); font-variant-numeric: tabular-nums; }

.about-photo { margin-top: var(--s-4); border-radius: var(--r-lg); }

/* --------------------------------------------------------------- how it works */

/* Family B's three steps. The same metric rhythm as .hours-row and .extras-item, so
   the page has one list language rather than three. */
.steps { list-style: none; margin: var(--s-5) 0 0; padding: 0; max-width: 34rem; }
.steps li { display: flex; gap: var(--s-4); padding: var(--s-3) 0; border-bottom: var(--rule); }
.steps li:last-child { border-bottom: 0; }
.step-num {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--r-sm);
  background: var(--accent-soft);
  color: var(--accent-ink);
  font-size: var(--fs-small);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.step-text { color: var(--ink); }

/* The extras card: the record's own facts, in the client's own words. Identical
   metrics to .hours-row, so the two cards read as siblings. */
.extras { margin: var(--s-5) 0 0; max-width: 34rem; overflow: hidden; }
.extras-item { padding: var(--s-3) var(--s-4); border-bottom: var(--rule); }
.extras-item:last-child { border-bottom: 0; }
.extras-item dt {
  margin: 0 0 var(--s-1);
  font-size: var(--fs-label);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
.extras-item dd { margin: 0; font-size: 0.9375rem; color: var(--ink); }

/* ------------------------------------------------------------ contact + form */

.form-notice,
.notice {
  margin: var(--s-5) 0;
  padding: var(--s-4) var(--s-5);
  background: var(--accent-soft);
  border-left: 4px solid var(--accent);
  border-radius: 0 var(--r-md) var(--r-md) 0;
  color: var(--ink);
  font-size: 0.9375rem;
}

/* The form is two field sets — your details, then the request itself (design spec §2).
   The vocabulary it needs beyond the text input: a fieldset, a small-caps legend, a
   native select, and a chip group for checkboxes and radios. No new tokens: every value
   below is one of the tokens above. */
fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }

.field-group { margin-top: var(--s-4); }
.field-group--second { border-top: var(--rule); margin-top: var(--s-5); padding-top: var(--s-5); }
.field-group-legend {
  display: block;
  width: 100%;
  margin: 0 0 var(--s-4);
  padding: 0;
  font-size: var(--fs-label);
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.contact-form { max-width: 34rem; margin-top: var(--s-5); }
.field { margin-bottom: var(--s-4); }
.field label { display: block; margin-bottom: var(--s-2); font-weight: 600; font-size: 0.9375rem; color: var(--ink); }
.optional { font-weight: 400; color: var(--muted); }
.field input, .field textarea, .field select {
  width: 100%;
  padding: 0.7rem 0.8rem;
  border: var(--rule);
  border-radius: var(--r-sm);
  background: var(--paper);
  color: var(--ink);
  font: inherit;
}
.field textarea { min-height: 8rem; resize: vertical; }
.field input:focus-visible, .field textarea:focus-visible, .field select:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
/* The select keeps the browser's own picker: it is better on a phone than anything we
   would draw, it needs no script, and it costs nothing. */
.field select { min-height: 2.75rem; }

/* Choice chips: one component for checkboxes and radios. The input is visually hidden
   but focusable, so the group still posts with JavaScript off and works by keyboard. */
.choice-group { margin-bottom: var(--s-4); }
.choice-group legend { display: block; margin-bottom: var(--s-2); padding: 0; font-weight: 600; font-size: 0.9375rem; color: var(--ink); }
.choice-wrap { display: flex; flex-wrap: wrap; gap: var(--s-2); }
.chip { display: inline-flex; position: relative; cursor: pointer; }
.chip input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.chip-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.75rem;
  min-width: 2.75rem;
  padding: 0.4rem 0.9rem;
  border: var(--rule);
  border-radius: var(--r-md);
  background: var(--paper);
  color: var(--ink);
  font-size: 0.9375rem;
  font-weight: 600;
}
.chip input:checked + .chip-text { background: var(--accent-soft); border-color: var(--accent); }
.chip input:focus-visible + .chip-text { outline: 2px solid var(--accent); outline-offset: 2px; }

/* The preferred days, if the record states any, read as a date-picker strip rather
   than as a form: 52x44 chips, five to seven to a row. */
.choice-group--days .choice-wrap { display: grid; grid-template-columns: repeat(auto-fit, minmax(3.25rem, 1fr)); gap: var(--s-2); }
.choice-group--days .chip-text { width: 100%; }

.form-actions { margin: var(--s-5) 0 0; }
.form-actions .button { width: 100%; }
.form-note { margin: var(--s-3) 0 0; max-width: 34rem; font-size: var(--fs-small); color: var(--muted); }

.hp { position: absolute; left: -9999px; height: 0; overflow: hidden; }

.form-status { min-height: 1.5rem; margin: var(--s-4) 0 0; font-weight: 600; }
.form-status[data-state="error"] { color: #A3241F; }
.form-status[data-state="ok"] { color: #1F6B3A; }

.form-privacy { margin: var(--s-4) 0 0; font-size: var(--fs-small); }

.contact-fallback {
  max-width: 34rem;
  margin-top: var(--s-6);
  padding-top: var(--s-5);
  border-top: var(--rule);
}
.contact-fallback h3 { margin-bottom: var(--s-2); }
.contact-fallback p { margin: 0 0 var(--s-2); }
.contact-fallback p:last-child { margin-bottom: 0; font-size: var(--fs-small); }

/* ------------------------------------------------------------- privacy page */

/* A notice is read, not skimmed: one narrow measure, headings that separate the
   questions a visitor actually asks, and no accent marks competing with the text. */
.privacy-notice { max-width: 42rem; }
.privacy-notice h2 { margin-top: var(--s-6); font-size: var(--fs-h3); }
.privacy-notice h2:first-child { margin-top: 0; }
.privacy-notice .updated { margin: var(--s-6) 0 0; padding-top: var(--s-4); border-top: var(--rule); font-size: var(--fs-small); }

/* ---------------------------------------------------------------- footer */

.site-footer {
  background: var(--ink);
  color: var(--footer-ink);
  padding: var(--s-8) 0 var(--s-7);
  font-size: var(--fs-small);
}
.footer-grid { display: grid; gap: var(--s-7); }
.footer-biz { margin: 0 0 var(--s-2); font-family: var(--font-display); font-size: 1.35rem; color: #fff; }
.footer-contact { margin: 0 0 var(--s-4); color: #E8EBEE; line-height: 1.7; max-width: 34em; }
.site-footer a { color: #fff; text-decoration-color: rgba(255, 255, 255, .45); }
.site-footer a:hover { text-decoration-color: #fff; }
.site-footer p { max-width: 46em; }
/* A standalone notice, centred like the banner and the hero caption. The accent bar
   that used to sit on its left was a left-alignment device, so it goes with the
   alignment and nothing decorative replaces it. */
.disclaimer {
  margin: var(--s-4) auto 0;
  color: #fff;
  font-size: 0.9375rem;
  text-align: center;
}
.footer-small { margin: 0 0 var(--s-4); }
.footer-small:last-child { margin-bottom: 0; }
.site-footer code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 1em; color: #E8EBEE; }
.site-footer :focus-visible { outline-color: #fff; }

/* The footer carries no list of page links: the header is the navigation, on a phone
   behind the Pages disclosure and on a desktop as the inline row. The one page link
   that must stay reachable from every page — the privacy notice — sits in the small
   print above, as inline 14px text rather than a 44px target. That is deliberate: the
   footer's job is to be read, and the phone's large targets are in the header. */

/* ------------------------------------------------------------ wider screens */

@media (min-width: 48rem) {
  :root { --gutter: 2rem; }
  /* The hero's min-height — min(78svh, 34rem) — is the same at every width: from 48rem
     up, the viewport-height term exceeds the 34rem cap on any screen taller than about
     700px, so a desktop hero is capped at 34rem and a phone hero fills what it can. No
     separate upper bound is needed: the 34rem in the min() is it. */
  .hero-inner { padding: var(--s-9) 0 var(--s-8); }
  /* Level rows: a card whose service has a recorded note and one without end at the
     same height instead of leaving the shorter card floating. The grid has no height of
     its own, so 1fr auto-rows resolve to the tallest card's height. On a phone the list
     is one column, where unequal heights are honest and a reserved empty box would be
     unexplainable — and no note is ever written to fill one. */
  .services { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 1fr; align-items: stretch; }
  .two-col { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: var(--s-7); align-items: start; }
  /* The stacked pair's gap (see the phone rule) is the grid's own gap up here. */
  .two-col > div + div { margin-top: 0; }
  .footer-grid { grid-template-columns: 1.1fr 0.9fr; gap: var(--s-8); }
  /* Desktop keeps the plain inline row it has always had: the summary goes, the nav
     comes back into the flow — the phone panel's geometry undone property by property,
     since it is out of the flow and inset on the gutter down there — and the links lose
     the phone panel's row shape. The wordmark takes its auto basis back, so the wide
     header is exactly the one it has always been, and the privacy link returns to the
     row it has always been in. */
  .site-menu { display: none; }
  .wordmark { flex: 1 1 auto; }
  .site-nav {
    position: static;
    top: auto;
    left: auto;
    z-index: auto;
    display: block;
    width: auto;
    min-width: 0;
    margin-top: 0;
    padding: 0;
    background: none;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    flex: 1 1 auto;
    order: 2;
    margin-left: var(--s-6);
  }
  .site-nav li.nav-item--desktop { display: block; }
  .site-nav ul { flex-direction: row; flex-wrap: wrap; gap: 0 var(--s-4); }
  .site-nav a {
    display: inline-flex;
    min-height: 2rem;
    padding: 0;
    border-radius: 0;
    background: none;
    border-bottom: 2px solid transparent;
  }
  .site-nav a:hover { background: none; color: var(--ink); border-bottom-color: var(--line); }
  .site-nav a[aria-current="page"] { background: none; color: var(--accent-ink); border-bottom-color: var(--accent); }
  /* From 48rem the nav sits in the header row rather than in the phone panel — and on
     the home page that row is now on the photograph, where the body colour is 1.7:1 and
     the accent "current" mark is 1.3:1. The wide row's links, hover and current mark go
     white there. Only the wide row: the phone panel is an opaque paper surface of its
     own, and white text on it would be nothing at all. */
  .page--index .site-header .site-nav a { color: #fff; text-shadow: 0 1px 2px rgba(10, 12, 14, .55); }
  .page--index .site-header .site-nav a:hover { color: #fff; border-bottom-color: rgba(255, 255, 255, .6); }
  .page--index .site-header .site-nav a[aria-current="page"] { color: #fff; border-bottom-color: #fff; }
  .site-header .call-button { order: 3; }
  .page-head { padding: var(--s-8) 0 var(--s-6); }
  .form-actions .button { width: auto; }
  .privacy-notice h2 { font-size: var(--fs-h3); }
}

@media (min-width: 64rem) {
  /* CANDIDATE A: steps up from the phone's 1.25rem, so the wide header keeps its gain. */
  .wordmark { font-size: 1.4rem; }
}

/* ------------------------------------------------------------ preferences */

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  * { transition: none !important; animation: none !important; }
}
`;
}

/**
 * The page's only script: post the form, show the outcome. It keeps no copy of
 * anything, writes nothing to storage, and sets no analytics. Loaded from a local
 * file — nothing here is fetched from a third party. Only the contact page loads it.
 */
export function renderJs(): string {
  return `/* Site Sourced demo — contact form. No dependencies, no tracking, no storage. */
(function () {
  "use strict";

  // Nothing here preselects anything. A service card is one link to its own contact
  // page (contact-hot-shave.html), where the service's option already carries
  // \`selected\` in the HTML the browser received — so the choice a visitor made is
  // there with this script switched off, on a static host, with no query string read
  // and no fragment parsed. This file only posts the form and reports the outcome.

  var form = document.getElementById("contact-form");
  if (!form) return;

  var status = document.getElementById("form-status");
  var button = form.querySelector('button[type="submit"]');
  var hpField = form.querySelector(".hp input");

  function say(message, state) {
    if (!status) return;
    status.textContent = message;
    if (state) status.setAttribute("data-state", state);
    else status.removeAttribute("data-state");
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (hpField && hpField.value.trim() !== "") {
      say("Thanks.", "ok");
      form.reset();
      return;
    }

    var data = new FormData(form);
    if (!String(data.get("phone") || "").trim()) data.delete("phone");

    var endpoint = form.getAttribute("action");
    var encode = form.getAttribute("data-encode") || "json";
    var payload;
    var headers = { Accept: "application/json" };

    if (encode === "json") {
      var obj = {};
      data.forEach(function (value, key) { obj[key] = value; });
      payload = JSON.stringify(obj);
      headers["Content-Type"] = "application/json";
    } else {
      payload = new URLSearchParams();
      data.forEach(function (value, key) { payload.append(key, value); });
    }

    if (button) button.disabled = true;
    say("Sending…", null);

    fetch(endpoint, { method: "POST", headers: headers, body: payload })
      .then(function (response) {
        return response.text().then(function (text) {
          var ok = response.ok;
          var parsed = null;
          try { parsed = JSON.parse(text); } catch (err) { parsed = null; }
          if (parsed && parsed.success === false) ok = false;
          return ok;
        });
      })
      .then(function (ok) {
        if (ok) {
          say(form.getAttribute("data-success") || "Thanks.", "ok");
          form.reset();
        } else {
          say(form.getAttribute("data-failure") || "Sorry, that didn't send.", "error");
        }
      })
      .catch(function () {
        // The fetch was blocked rather than refused — the usual cause is a page opened
        // straight from disk (file://) or an unusually locked-down host. A plain form
        // POST is not subject to those restrictions, so hand the message to the browser
        // instead of losing it.
        say("Sending your message\u2026", null);
        try {
          form.submit();
        } catch (err) {
          say(form.getAttribute("data-failure") || "Sorry, that didn't send.", "error");
        }
      })
      .then(function () {
        if (button) button.disabled = false;
      });
  });
})();
`;
}

/** Plain-language hand-over notes that ship inside the bundle. */
export function renderEditingReadme(ctx: RenderContext): string {
  const { record, copy, form, delivery, images, privacy } = ctx;
  const provenance = copy.provenance;
  const businessPhase = delivery.mode === "business";

  const title = businessPhase
    ? `${record.name} — your website files`
    : `${record.name} — demonstration site files (built by Site Sourced)`;

  // What the page says about its own imagery has to match the licences actually
  // recorded for it: an AI-generated placeholder is never a stock photograph.
  const aiHero = images.some((i) => /^AI-generated/i.test(i.license ?? ""));
  const imageNote = aiHero
    ? `The hero picture on this page is an AI-generated illustration (a labelled fallback used
because no suitable free-to-use photograph existed). It is not a photograph of the
business and must be replaced with a real photograph before this page goes live as
anyone's own site. The file is inside the bundle; swap it for one of your own and the
layout follows automatically — keep the same file name, or update the name in
styles.css and index.html.`
    : `The photograph is a free-to-use (CC0 / public-domain) stock photograph, not a photo
of your business. Swap it for one of your own and the layout follows automatically:
keep the same file name, or update the name in styles.css and index.html.`;

  const privacyOpen = privacy.openItems.length > 0
    ? `\nBefore this bundle is published, ${privacy.openItems.length} thing(s) about us are still
unfilled on the privacy page: ${privacy.openItems.join("; ")}. The page prints our working
inbox instead and says nothing it cannot support. Fill them in copy.ts (PRIVACY_IDENTITY)
and rebuild.\n`
    : "";

  const formSection = businessPhase
    ? `The contact form
----------------
The form posts to ${form.provider.label}. ${form.provider.needs_account}.
${form.provider.who_owns_the_account}. Notifications go to ${form.recipient};
nobody at Site Sourced receives a copy and no list of names is gathered.

  Where the message is kept: ${form.provider.stores_submissions}
  Free tier: ${form.provider.free_tier}
  If it stops working: ${form.provider.if_it_lapses}
  Documentation: ${form.provider.url || "(self-hosted endpoint)"}

The page says the same thing to your visitors, in the line just above the form.
If you change form provider, that line changes with it — do not edit it by hand
without checking what the new provider does with a submission.

The form also shows your email address and phone number, so an enquiry can always
reach you even if the form service is ever down.
`
    : `The contact form
----------------
This is a demonstration bundle, not a delivered site. The form posts to
${form.provider.label} (${form.provider.needs_account}), and submissions go to
${form.recipient} — Site Sourced's own test inbox, not the business's. ${record.name}
is not notified, and nothing is forwarded on to them. The line above the form on the
page tells the visitor exactly that, in their own words, because a form that goes to
the demo operator must never read as the business's own.

  Where the message is kept: ${form.provider.stores_submissions}
  Free tier: ${form.provider.free_tier}
  If it stops working: ${form.provider.if_it_lapses}
  Documentation: ${form.provider.url || "(self-hosted endpoint)"}

Before this bundle could be handed to a client, the record's form_recipient must be
the client's own published address in an account the client owns. The page's notice
then switches to the delivered-site wording on its own — that choice is derived by
comparing form_recipient with the record's published email, never set by hand — and
the build refuses to publish a bundle whose notice claims business delivery while the
form routes anywhere else. The form also prints the business's published email
address and phone number, so a visitor who wants the business itself rather than this
demonstration can reach it directly.
`;

  return `${title}
${"=".repeat(title.length)}

${businessPhase ? "" : `DEMONSTRATION — not the business's website, and never sent to the business.
The contact form's submissions come to Site Sourced. See "The contact form" below.

`}This folder is a complete website. The pages are:

  index.html      the front page
  services.html   everything recorded for the business
  about.html      about the business, its hours and where it is
  contact.html    the contact form (the only page that uses site.js)
  privacy.html    how a message sent from these pages is handled

They all share styles.css (the colours and spacing), site.js (the contact form) and
the fonts/ folder. Every link between them is an ordinary link to a file, so the site
works with JavaScript switched off. There is no database, no content management
system and no server software to keep patched, so nothing here goes stale or needs a
monthly update.
${privacyOpen}
Opening it
----------
Double-click index.html to view it in a browser. To put it on the web, upload the
whole folder to your hosting as it is.

Changing the words
------------------
Open any .html file in a text editor (Notepad, TextEdit, VS Code). Every sentence is
plain text between tags. Change the text between the tags and save — do not change
the tags themselves. For example:

  <h2>Opening hours</h2>   ...change only "Opening hours"

The business name appears in several places (the headers, the footers, the page
titles), so use Find and Replace across all the files to change them at once. The
navigation at the top of every page names the pages — if you rename a file, update the
links in all five.

The photograph
--------------
${imageNote}

${formSection}One recurring job
-----------------
${businessPhase ? `Your domain name needs renewing once a year. Set it to auto-renew and the website
can sit untouched indefinitely.
` : `The domain name is the one recurring item on a live site: it needs renewing once a
year, set to auto-renew.`}
Built by Site Sourced
---------------------
This page is an unsolicited design proposal, not the business's official site, and
it is marked noindex, so it does not appear in search results. Ask and it comes down.
${businessPhase ? "" : `
Where the details came from
---------------------------
The pages carry this provenance line, derived from the record's own source rather than
written by hand — it is the same sentence a visitor reads in the footer:

  ${provenance.attribution || "(no source is declared for this record)"}

The words on the pages are written by Site Sourced and are not the business's own, and
nothing on them was copied from any other website.
`}`;
}
