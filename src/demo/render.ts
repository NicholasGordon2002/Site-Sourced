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
 *   3. `noindex, nofollow`, so a proposal never competes with the business's own site.
 *
 * `site.js` is loaded by the contact page and by nothing else: the form is the only
 * thing on the site that needs script, so every other page works with JavaScript off
 * and asks the browser for one file less.
 *
 * Navigation is plain links to real files, in the header and repeated in the footer.
 * There is no hamburger menu and no JavaScript: on the published host a bundle is
 * served as flat files, so `services.html` is a path that serves and `/services/` is
 * not — the links point at files for exactly that reason.
 *
 * The HTML is deliberately readable. A client who opens index.html in a text editor
 * can find their own sentences and change them.
 */

import type { BusinessRecord, ManifestImage } from "./types.ts";
import type { DemoCopy, PrivacyNotice } from "./copy.ts";
import type { CategoryProfile } from "./copy.ts";
import { normaliseHours, normaliseServices } from "./copy.ts";
import { illustrationLabel, isIllustrativeImage } from "./copy.ts";
import type { FormDelivery } from "./delivery.ts";
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

function hoursBlock(record: BusinessRecord): string {
  const { rows, note } = normaliseHours(record);
  if (rows.length === 0) {
    return `        <p class="muted">No opening hours are recorded publicly for this business. Call to ask.</p>`;
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
function servicesBlock(record: BusinessRecord, level: 2 | 3): string {
  const services = normaliseServices(record);
  const heading = `h${level}`;
  if (services.length === 0) {
    return `        <p class="muted">Nothing is recorded yet — this is where the business's ${esc(copyOffering(record))} would be listed.</p>`;
  }
  return `        <ul class="services">\n${services
    .map(
      (s) =>
        `          <li class="card"><${heading}>${esc(s.name)}</${heading}>${s.note ? `<p>${esc(s.note)}</p>` : ""}</li>`,
    )
    .join("\n")}\n        </ul>`;
}

function copyOffering(record: BusinessRecord): string {
  return record.category ? record.category.toLowerCase() : "services";
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

function pageTitle(ctx: RenderContext, id: PageId): string {
  const { record, copy } = ctx;
  const city = record.address?.city;
  switch (id) {
    case "services":
      return `${copy.pages.services.title} — ${record.name}${city ? `, ${city}` : ""} (design proposal)`;
    case "about":
      return `${copy.pages.about.title} — ${record.category}${city ? ` in ${city}` : ""} (design proposal)`;
    case "contact":
      return `${copy.pages.contact.title} — ${record.name} (design proposal)`;
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
  const items = PAGE_IDS.map((id) => {
    const current_ = id === current ? ' aria-current="page"' : "";
    return `          <li><a href="${PAGE_SPECS[id].file}"${current_}>${esc(copy.nav[id])}</a></li>`;
  }).join("\n");
  return `      <nav class="${className}" aria-label="${esc(label)}">
        <ul>
${items}
        </ul>
      </nav>`;
}

function headerBlock(ctx: RenderContext, id: PageId): string {
  const { record, copy } = ctx;
  const tel = record.phone ? telHref(record.phone) : "";
  // The call button prints the business's published phone number. The privacy page
  // prints none of the business's details — an unconfirmed number has no business on
  // a notice about how we handle a message — so its header carries the wordmark and
  // the navigation only.
  const call = !PAGE_SPECS[id].printsDetails
    ? ""
    : record.phone
      ? `          <a class="call-button" href="${tel}">${esc(copy.ui.callLabel)} ${esc(record.phone)}</a>`
      : `          <span class="call-button call-button--muted">${esc(copy.ui.noPhoneNote)}</span>`;
  return `  <header class="site-header">
    <div class="wrap header-inner">
      <p class="wordmark">${esc(record.name)}</p>
${navBlock(copy, id, "site-nav", "Pages")}
${call ? `${call}\n` : ""}    </div>
  </header>`;
}

/**
 * The printed phone number and email address, next to the contact route.
 *
 * On a demonstration page these came from public listings and were never confirmed
 * with the business, so the caveat from `copy.contactCaveat` sits directly under them
 * — here and again in the footer. That is the plan's rule ("as published in public
 * listings — please confirm"), and `build.ts` counts the two instances per page.
 */
function fallbackBlock(ctx: RenderContext): string {
  const { record, copy } = ctx;
  const tel = record.phone ? telHref(record.phone) : "";
  return `        <div class="contact-fallback">
          <h3>${esc(copy.fallback.heading)}</h3>
${record.email ? `          <p>${esc(copy.fallback.emailIntro)} <a href="mailto:${esc(record.email)}">${esc(record.email)}</a></p>` : `          <p>${esc(copy.fallback.noEmail)}</p>`}
${record.phone ? `          <p>${esc(copy.fallback.phoneIntro)} <a href="${tel}">${esc(record.phone)}</a>.</p>` : `          <p>${esc(copy.fallback.noPhone)}</p>`}
${copy.contactCaveat ? `          <!-- Compliance: these details came from public listings and are unconfirmed. Do not remove. -->
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
${copy.contactCaveat && spec.printsDetails ? `        <!-- Compliance: the printed details came from public listings. Do not remove. -->
        <p class="footer-small">${esc(copy.contactCaveat)}</p>
` : ""}${navBlock(copy, id, "footer-nav", "Pages")}
        <p class="footer-small">
          ${esc(copy.footer.provenance)}
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
  return `    <header class="page-head">
      <div class="wrap">
        <p class="eyebrow">${esc(eyebrow)}</p>
        <h1>${esc(copy.pages[id].title)}</h1>
        <p class="lead">${esc(copy.pages[id].lead)}</p>
      </div>
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
${record.phone ? `            <a class="button button--paper" href="${tel}">${esc(copy.ui.callLabel)} ${esc(record.phone)}</a>\n` : ""}            <a class="button button--ghost" href="${PAGE_SPECS.contact.file}">${esc(copy.contactCtaButton)}</a>
          </p>
        </div>
      </div>
${caption ? `      <!-- Compliance: an AI-generated placeholder is labelled as an illustration, not a
           photograph of the business. Do not remove. -->
      <figcaption class="wrap muted hero-caption">${esc(caption)}</figcaption>\n` : ""}    </figure>`;
}

function aboutSection(ctx: RenderContext, paragraphs: string[]): string {
  const { record, copy, images } = ctx;
  const image = aboutImage(images);
  const caption = illustrationCaption(images, "about", record.name);
  return `    <section class="section" id="about">
      <div class="wrap">
        <h2>About ${esc(record.name)}</h2>
${paragraphs.map((p) => `        <p>${esc(p)}</p>`).join("\n")}
${paragraphs.length < copy.about.length ? `        <p><a class="link-quiet link-quiet--inline" href="${PAGE_SPECS.about.file}">More about ${esc(record.name)}</a></p>\n` : ""}${image ? `        <figure class="about-figure">
          <img class="about-photo" src="${esc(image.file!)}"${sizeAttrs(image)} alt="" loading="lazy" decoding="async">
${caption ? `          <!-- Compliance: an AI-generated placeholder is labelled as an illustration. Do not remove. -->
          <figcaption class="muted">${esc(caption)}</figcaption>\n` : ""}        </figure>\n` : ""}      </div>
    </section>`;
}

function hoursAddressSection(ctx: RenderContext): string {
  const { record, copy } = ctx;
  const addr = addressLine(record);
  return `    <section class="section" id="hours">
      <div class="wrap two-col">
        <div>
          <h2>Opening hours</h2>
          <p class="muted">${esc(copy.hoursIntro)}</p>
${hoursBlock(record)}
        </div>
        <div>
          <h2>Address</h2>
          <p class="muted">${esc(copy.locationIntro)}</p>
          ${addr ? `<address class="address">${esc(addr)}</address>` : `<p class="address muted">No street address recorded.</p>`}
          <p class="address-links">
            <a class="button button--small" href="${directionsLink(record)}" target="_blank" rel="noopener noreferrer">${esc(copy.ui.directions)}</a>
            <a class="link-quiet" href="${osmLink(record)}" target="_blank" rel="noopener noreferrer">${esc(copy.ui.osm)}</a>
          </p>
        </div>
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
        <p class="cta-actions"><a class="button" href="${PAGE_SPECS.contact.file}">${esc(copy.contactCtaButton)}</a></p>
${fallbackBlock(ctx)}
      </div>
    </section>`;
}

function contactFormSection(ctx: RenderContext): string {
  const { copy, form } = ctx;
  const honeypot = form.provider.key === "web3forms" ? "botcheck" : "_gotcha";
  const hidden = Object.entries(form.hiddenFields)
    .map(([k, v]) => `            <input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("\n");
  return `    <section class="section section--alt" id="form">
      <div class="wrap">
        <h2>${esc(copy.contactCtaHeading)}</h2>

        <!-- Compliance: this notice must stay next to the form. It is derived from
             the delivery the record describes, never written by hand. -->
        <p class="form-notice">${esc(copy.formNotice)}</p>

        <form class="contact-form" id="contact-form" method="POST" action="${esc(form.endpoint)}"
              data-encode="${esc(form.provider.encode)}" data-success="${esc(copy.formSuccess)}"
              data-failure="Sorry, that didn't send. Please use the email address or phone number below.">
          <div class="field">
            <label for="cf-name">${esc(copy.ui.fieldName)}</label>
            <input id="cf-name" name="name" type="text" autocomplete="name" required>
          </div>
          <div class="field">
            <label for="cf-email">${esc(copy.ui.fieldEmail)}</label>
            <input id="cf-email" name="email" type="email" autocomplete="email" required>
          </div>
          <div class="field">
            <label for="cf-phone">${esc(copy.ui.fieldPhone)} <span class="optional">${esc(copy.ui.fieldOptional)}</span></label>
            <input id="cf-phone" name="phone" type="tel" autocomplete="tel">
          </div>
          <div class="field">
            <label for="cf-message">${esc(copy.ui.fieldMessage)}</label>
            <textarea id="cf-message" name="message" rows="5" required></textarea>
          </div>
          <div class="hp" aria-hidden="true">
            <label for="cf-${honeypot}">${esc(copy.ui.honeypot)}</label>
            <input id="cf-${honeypot}" name="${honeypot}" type="text" tabindex="-1" autocomplete="off">
          </div>
${hidden}
          <button class="button" type="submit">${esc(copy.ui.submit)}</button>
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
export function renderPage(ctx: RenderContext, id: PageId): string {
  const { record, copy, delivery } = ctx;
  const spec = PAGE_SPECS[id];
  const body = (() => {
    switch (id) {
      case "services":
        return `${pageHead(ctx, id)}
    <section class="section">
      <div class="wrap">
${servicesBlock(record, 2)}
      </div>
    </section>

${hoursAddressSection(ctx)}

${contactCtaSection(ctx, true)}`;
      case "about":
        return `${pageHead(ctx, id)}
${aboutSection(ctx, copy.about)}

${hoursAddressSection(ctx)}

${contactCtaSection(ctx, true)}`;
      case "contact":
        return `${pageHead(ctx, id)}
${contactFormSection(ctx)}

${hoursAddressSection(ctx)}`;
      case "privacy":
        return `${pageHead(ctx, id)}
${privacySection(ctx)}`;
      default:
        return `${heroSection(ctx)}

${aboutSection(ctx, copy.about.slice(0, 1))}

    <section class="section section--alt" id="services">
      <div class="wrap">
        <h2>${esc(copy.offeringPlural.charAt(0).toUpperCase() + copy.offeringPlural.slice(1))}</h2>
        <p class="muted">${esc(copy.servicesIntro)}</p>
${servicesBlock(record, 3)}
      </div>
    </section>

${hoursAddressSection(ctx)}

${contactCtaSection(ctx, true)}`;
    }
  })();

  return `<!doctype html>
<html lang="en-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Compliance: this page must never appear in search results, and must never
       compete with the business's own site. Do not remove this line. -->
  <meta name="robots" content="noindex, nofollow">
  <title>${esc(pageTitle(ctx, id))}</title>
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

/** Every page of one bundle, in order. */
export function renderPages(ctx: RenderContext): RenderedPage[] {
  return PAGE_IDS.map((id) => ({ id, file: PAGE_SPECS[id].file, html: renderPage(ctx, id) }));
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
  --fs-display: clamp(2.1rem, 8.5vw, 3.4rem);
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

h1 { font-size: var(--fs-display); line-height: 1.05; margin: 0 0 var(--s-4); }
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
.proposal-banner p {
  margin: 0;
  padding: 0.7rem 0;
  font-size: var(--fs-small);
  line-height: 1.5;
  max-width: 60em;
}

/* ----------------------------------------------------------------- header */

.site-header {
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
.wordmark {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
  line-height: 1.2;
  letter-spacing: -0.01em;
}
.site-header .call-button { margin-left: auto; }

/* The navigation. On a phone it takes its own full-width row under the wordmark —
   four short labels, all visible, no menu to open and nothing to script. From 48rem
   it sits on the wordmark's line. */
.site-nav { flex: 1 1 100%; order: 4; }
.site-nav ul {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--s-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
.site-nav a {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--body-text);
  text-decoration: none;
  border-bottom: 2px solid transparent;
}
.site-nav a:hover { color: var(--ink); border-bottom-color: var(--line); }
.site-nav a[aria-current="page"] { color: var(--accent-ink); border-bottom-color: var(--accent); }

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

.button--small { min-height: 2.25rem; padding: 0.45rem 0.9rem; font-size: var(--fs-small); }

.call-button--muted {
  background: var(--paper-2);
  color: var(--muted);
  border-color: var(--line);
  cursor: default;
  font-weight: 400;
}
.call-button--muted:hover { background: var(--paper-2); color: var(--muted); }

.link-quiet { display: inline-block; margin: var(--s-3) 0 0 var(--s-4); font-size: var(--fs-small); color: var(--muted); }
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
.hero-img {
  width: 100%;
  height: 100%;
  min-height: 22rem;
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
.hero h1 { color: #fff; margin-bottom: var(--s-4); max-width: 20ch; letter-spacing: -0.02em; }
.hero-lead { margin: 0; max-width: 30rem; font-size: var(--fs-lead); line-height: 1.5; color: rgba(255, 255, 255, .94); }
.hero-actions { display: flex; flex-wrap: wrap; gap: var(--s-3); margin: var(--s-5) 0 0; max-width: none; }
.hero :focus-visible { outline-color: #fff; }

/* The two figures exist so a placeholder has a caption element to live in: the hero's
   under the picture, in normal flow. Its wording is fixed by build-gated copy; only
   its spacing is design. */
.hero-figure, .about-figure { margin: 0; }
.hero-caption { margin: var(--s-3) 0 0; padding-bottom: var(--s-1); font-size: var(--fs-small); }

/* ----------------------------------------------------------------- page head */

/* Every page but the home page opens with this band instead of a photograph: cheaper
   on a phone than five copies of one hero, and it keeps the headline the loudest
   thing on the page. */
.page-head {
  padding: var(--s-7) 0 var(--s-5);
  background: var(--paper-2);
  border-bottom: var(--rule);
}
.page-head h1 { font-size: var(--fs-h2); margin-bottom: var(--s-3); }
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
.services li.card { padding: var(--s-4) var(--s-5); }
.services p { margin: 0; max-width: none; color: var(--muted); font-size: 0.9375rem; }

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

/* ------------------------------------------------------------ contact + form */

.form-notice {
  margin: var(--s-5) 0;
  padding: var(--s-4) var(--s-5);
  background: var(--accent-soft);
  border-left: 4px solid var(--accent);
  border-radius: 0 var(--r-md) var(--r-md) 0;
  color: var(--ink);
  font-size: 0.9375rem;
}

.contact-form { max-width: 34rem; margin-top: var(--s-5); }
.field { margin-bottom: var(--s-4); }
.field label { display: block; margin-bottom: var(--s-2); font-weight: 600; font-size: 0.9375rem; color: var(--ink); }
.optional { font-weight: 400; color: var(--muted); }
.field input, .field textarea {
  width: 100%;
  padding: 0.7rem 0.8rem;
  border: var(--rule);
  border-radius: var(--r-sm);
  background: var(--paper);
  color: var(--ink);
  font: inherit;
}
.field textarea { min-height: 8rem; resize: vertical; }
.field input:focus-visible, .field textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

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
.disclaimer {
  margin: var(--s-4) 0 0;
  padding-left: var(--s-4);
  border-left: 4px solid var(--accent);
  color: #fff;
  font-size: 0.9375rem;
}
.footer-small { margin: 0 0 var(--s-4); }
.footer-small:last-child { margin-bottom: 0; }
.site-footer code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 1em; color: #E8EBEE; }
.site-footer :focus-visible { outline-color: #fff; }

/* The same four links again, plus the privacy notice: on a phone the footer is the
   second place a visitor looks, and the privacy notice is linked from every page. */
.footer-nav { margin: 0 0 var(--s-5); }
.footer-nav ul { display: flex; flex-direction: column; gap: var(--s-1); margin: 0; padding: 0; list-style: none; }
.footer-nav a {
  display: inline-flex;
  align-items: center;
  min-height: 2.25rem;
  color: #fff;
  font-weight: 600;
  text-decoration: none;
}
.footer-nav a:hover { text-decoration: underline; }
.footer-nav a[aria-current="page"] { color: #fff; text-decoration: underline; text-decoration-color: var(--accent); text-decoration-thickness: 2px; text-underline-offset: 4px; }

/* ------------------------------------------------------------ wider screens */

@media (min-width: 48rem) {
  :root { --gutter: 2rem; }
  .hero-img { min-height: 28rem; max-height: 34rem; }
  .hero-inner { padding: var(--s-9) 0 var(--s-8); }
  .services { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .two-col { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: var(--s-7); align-items: start; }
  .footer-grid { grid-template-columns: 1.1fr 0.9fr; gap: var(--s-8); }
  .site-nav { flex: 1 1 auto; order: 2; margin-left: var(--s-6); }
  .site-nav a { min-height: 2rem; }
  .site-header .call-button { order: 3; }
  .page-head { padding: var(--s-8) 0 var(--s-6); }
  .privacy-notice h2 { font-size: var(--fs-h3); }
  .footer-nav ul { flex-direction: row; flex-wrap: wrap; gap: var(--s-5); }
  .footer-nav a { min-height: 2rem; }
}

@media (min-width: 64rem) {
  .wordmark { font-size: 1.25rem; }
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
      say("Thanks — your message is on its way.", "ok");
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
          say(form.getAttribute("data-success") || "Thanks — your message is on its way.", "ok");
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
  const { record, form, delivery, images, privacy } = ctx;
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
it is marked noindex so it never competes with one. Ask and it comes down.
${businessPhase ? "" : `
On a demonstration bundle the name, address, phone number and hours come from public
mapping data to show the layout; the text is written by Site Sourced and is not the
business's own words. Nothing on the page was copied from a website belonging to
${record.name}.
`}`;
}
