/**
 * Site Sourced — page rendering.
 *
 * One template, plain HTML/CSS/JS, no framework and no third-party asset of any
 * kind: the page makes zero network requests while it loads. The only outbound
 * request the site can ever make is the contact-form POST, and that goes to a
 * relay the client owns (see forms.ts).
 *
 * The HTML is deliberately readable. A client who opens index.html in a text
 * editor can find their own sentences and change them.
 */

import type { BusinessRecord, ManifestImage } from "./types.ts";
import type { DemoCopy } from "./copy.ts";
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
  images: ManifestImage[];
  slug: string;
  generatedAt: string;
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

function hoursBlock(record: BusinessRecord): string {
  const { rows, note } = normaliseHours(record);
  if (rows.length === 0) {
    return `      <p class="muted">No opening hours are recorded publicly for this business. Call to ask.</p>`;
  }
  const items = rows
    .map((r) => `        <div class="hours-row"><dt>${esc(r.days)}</dt><dd>${esc(r.hours)}</dd></div>`)
    .join("\n");
  const noteLine = note ? `\n      <p class="muted">${esc(note)}</p>` : "";
  return `      <dl class="hours">\n${items}\n      </dl>${noteLine}`;
}

function servicesBlock(record: BusinessRecord): string {
  const services = normaliseServices(record);
  if (services.length === 0) {
    return `      <p class="muted">Nothing is recorded yet — this is where the business's ${esc(copyOffering(record))} would be listed.</p>`;
  }
  return `      <ul class="services">\n${services
    .map(
      (s) =>
        `        <li><h3>${esc(s.name)}</h3>${s.note ? `<p>${esc(s.note)}</p>` : ""}</li>`,
    )
    .join("\n")}\n      </ul>`;
}

function copyOffering(record: BusinessRecord): string {
  return record.category ? record.category.toLowerCase() : "services";
}

function heroImageStyle(images: ManifestImage[]): { cls: string; style: string } {
  const hero = images.find((i) => i.role === "hero" && i.file);
  if (!hero) return { cls: "hero hero--plain", style: "" };
  return { cls: "hero hero--photo", style: ` style="background-image:linear-gradient(rgba(15,18,22,.62),rgba(15,18,22,.62)),url('${esc(hero.file!)}')"` };
}

function aboutImage(images: ManifestImage[]): ManifestImage | undefined {
  return images.find((i) => i.role === "about" && i.file);
}

/**
 * The visible caption for an AI-generated placeholder image, or "" when the image
 * on that slot is not illustrative.
 *
 * The caption is a plain `<figcaption>` in normal flow: no hover, no no-JS
 * fallback needed, nothing hidden. Its wording comes from `illustrationLabel` in
 * copy.ts, and `build.ts` refuses a bundle whose manifest records an AI-generated
 * image while the page carries no such label.
 */
function illustrationCaption(images: ManifestImage[], role: "hero" | "about", businessName: string): string {
  const image = images.find((i) => i.role === role && isIllustrativeImage(i));
  return image ? illustrationLabel(businessName) : "";
}

export function renderIndex(ctx: RenderContext): string {
  const { record, copy, form, images } = ctx;
  const addr = addressLine(record);
  const tel = record.phone ? telHref(record.phone) : "";
  const hero = heroImageStyle(images);
  const about = aboutImage(images);
  const heroCaption = illustrationCaption(images, "hero", record.name);
  const aboutCaption = illustrationCaption(images, "about", record.name);
  const honeypot = form.provider.key === "web3forms" ? "botcheck" : "_gotcha";
  const hidden = Object.entries(form.hiddenFields)
    .map(([k, v]) => `        <input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("\n");

  return `<!doctype html>
<html lang="en-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Compliance: this page must never appear in search results, and must never
       compete with the business's own site. Do not remove this line. -->
  <meta name="robots" content="noindex, nofollow">
  <title>${esc(record.name)} — ${esc(record.category)}${record.address?.city ? `, ${esc(record.address.city)}` : ""} (design proposal)</title>
  <meta name="description" content="An unsolicited design proposal from Site Sourced for ${esc(record.name)}, ${esc(record.category.toLowerCase())}${record.address?.city ? ` in ${esc(record.address.city)}` : ""}.">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>

  <!-- Compliance: the proposal banner sits above everything, in normal flow, so it
       is visible without scrolling on every screen size. Do not remove. -->
  <div class="proposal-banner" role="note">
    <p class="wrap">${esc(copy.banner)}</p>
  </div>

  <header class="site-header">
    <div class="wrap header-inner">
      <div>
        <p class="biz-name">${esc(record.name)}</p>
        <p class="biz-meta">${esc(record.category)}${record.address?.city ? ` · ${esc(record.address.city)}, ${esc(record.address.province || "ON")}` : ""}</p>
      </div>
${record.phone ? `      <a class="call-button" href="${tel}">Call ${esc(record.phone)}</a>` : `      <span class="call-button call-button--muted">Phone number not recorded</span>`}
    </div>
  </header>

  <main id="main">
    <figure class="hero-figure">
    <section class="${hero.cls}"${hero.style}>
      <div class="wrap hero-inner">
        <h1>${esc(record.name)}</h1>
        <p class="lead">${esc(copy.heroLead)}</p>
        <p class="lead lead--second">${esc(copy.heroSecond)}</p>
        <p class="hero-actions">
${record.phone ? `          <a class="button" href="${tel}">Call ${esc(record.phone)}</a>\n` : ""}          <a class="button button--ghost" href="#contact">Send a message</a>
        </p>
      </div>
    </section>
${heroCaption ? `    <!-- Compliance: an AI-generated placeholder is labelled as an illustration, not a
         photograph of the business. Do not remove. -->
    <figcaption class="wrap muted hero-caption">${esc(heroCaption)}</figcaption>\n` : ""}    </figure>

    <section class="section" id="about">
      <div class="wrap">
        <h2>About ${esc(record.name)}</h2>
${copy.about.map((p) => `        <p>${esc(p)}</p>`).join("\n")}
${about ? `        <figure class="about-figure">
          <img class="about-photo" src="${esc(about.file!)}" alt="${esc(about.notes ?? "Photograph")}" loading="lazy" width="${about.width ?? 1600}" height="${about.height ?? 900}">
${aboutCaption ? `          <figcaption class="muted">${esc(aboutCaption)}</figcaption>\n` : ""}        </figure>\n` : ""}
      </div>
    </section>

    <section class="section section--alt" id="services">
      <div class="wrap">
        <h2>${esc(copy.offeringPlural.charAt(0).toUpperCase() + copy.offeringPlural.slice(1))}</h2>
        <p class="muted">${esc(copy.servicesIntro)}</p>
${servicesBlock(record)}
      </div>
    </section>

    <section class="section" id="hours">
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
          <p>
            <a class="button button--small" href="${directionsLink(record)}" target="_blank" rel="noopener noreferrer">Get directions</a>
            <a class="link-quiet" href="${osmLink(record)}" target="_blank" rel="noopener noreferrer">See it on OpenStreetMap</a>
          </p>
        </div>
      </div>
    </section>

    <section class="section section--alt" id="contact">
      <div class="wrap">
        <h2>${esc(copy.contactHeading)}</h2>
        <p class="muted">${esc(copy.contactIntro)}</p>

        <!-- Compliance: this notice must stay next to the form. -->
        <p class="form-notice">${esc(copy.formNotice)}</p>

        <form class="contact-form" id="contact-form" method="POST" action="${esc(form.endpoint)}"
              data-encode="${esc(form.provider.encode)}" data-success="${esc(copy.formSuccess)}"
              data-failure="Sorry, that didn't send. Please use the email address or phone number below.">
          <div class="field">
            <label for="cf-name">Your name</label>
            <input id="cf-name" name="name" type="text" autocomplete="name" required>
          </div>
          <div class="field">
            <label for="cf-email">Your email</label>
            <input id="cf-email" name="email" type="email" autocomplete="email" required>
          </div>
          <div class="field">
            <label for="cf-phone">Your phone <span class="optional">(optional)</span></label>
            <input id="cf-phone" name="phone" type="tel" autocomplete="tel">
          </div>
          <div class="field">
            <label for="cf-message">Message</label>
            <textarea id="cf-message" name="message" rows="5" required></textarea>
          </div>
          <div class="hp" aria-hidden="true">
            <label for="cf-${honeypot}">Leave this field empty</label>
            <input id="cf-${honeypot}" name="${honeypot}" type="text" tabindex="-1" autocomplete="off">
          </div>
${hidden}
          <button class="button" type="submit">Send message</button>
          <p class="form-status" id="form-status" role="status" aria-live="polite"></p>
        </form>

        <div class="contact-fallback">
          <h3>Prefer email?</h3>
${record.email ? `          <p>Write to us directly: <a href="mailto:${esc(record.email)}">${esc(record.email)}</a></p>` : `          <p>No email address is recorded publicly for this business — please use the phone number.</p>`}
${record.phone ? `          <p>Or call <a href="${tel}">${esc(record.phone)}</a>.</p>` : ""}
${copy.contactCaveat ? `          <!-- Compliance: these details came from public listings and are unconfirmed. Do not remove. -->
          <p class="muted">${esc(copy.contactCaveat)}</p>\n` : ""}        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="wrap">
      <h2 class="footer-biz">${esc(record.name)}</h2>
      <p class="footer-contact">
${addr ? `        ${esc(addr)}<br>\n` : ""}${record.phone ? `        <a href="${tel}">${esc(record.phone)}</a>` : ""}${record.phone && record.email ? " · " : ""}${record.email ? `<a href="mailto:${esc(record.email)}">${esc(record.email)}</a>` : ""}
      </p>
      <!-- Compliance: the same disclaimer as the banner, next to the business's name
           and contact details. Do not remove. -->
      <p class="disclaimer">${esc(copy.footerDisclaimer)}</p>
${copy.contactCaveat ? `      <!-- Compliance: the printed details came from public listings. Do not remove. -->
      <p class="footer-small">${esc(copy.contactCaveat)}</p>\n` : ""}
      <p class="footer-small">
        Business details come from public mapping data (© OpenStreetMap contributors, ODbL 1.0).
        Copy, layout and imagery: Site Sourced. No logo, photograph or text was taken from any
        website belonging to ${esc(record.name)}. This page is marked <code>noindex</code> so it
        never competes with the business's own site.
      </p>
      <p class="footer-small">
        This demo comes down on request — reply to the email that sent it and it will be removed within a day.
      </p>
    </div>
  </footer>

  <script src="site.js" defer></script>
</body>
</html>
`;
}

export function renderCss(profile: CategoryProfile, slug: string): string {
  return `/* Site Sourced demo stylesheet — ${slug}
   Plain CSS, no framework, no webfont, no imports. Everything the page needs is in
   this folder. Colours come from the business's category. */

:root {
  --accent: ${profile.accent};
  --accent-dark: ${profile.accentDark};
  --soft: ${profile.accentSoft};
  --ink: #1b1f24;
  --muted: #5a6572;
  --line: #dfe4e9;
  --radius: 14px;
  --wrap: 68rem;
}

*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 1rem;
  line-height: 1.55;
  color: var(--ink);
  background: #fff;
}

img { max-width: 100%; height: auto; display: block; }

.wrap { width: min(var(--wrap), 100% - 2rem); margin-inline: auto; }

a { color: var(--accent-dark); }

h1 { font-size: 1.85rem; line-height: 1.2; margin: 0 0 .5rem; }
h2 { font-size: 1.35rem; margin: 0 0 .5rem; }
h3 { font-size: 1.05rem; margin: 0 0 .25rem; }

.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  background: #fff;
  padding: .5rem .75rem;
  z-index: 5;
}
.skip-link:focus { left: .5rem; top: .5rem; }

/* The proposal banner: first thing on the page, in normal flow, never hidden. */
.proposal-banner {
  background: #1b1f24;
  color: #fff;
  border-bottom: 3px solid var(--accent);
}
.proposal-banner p {
  margin: 0;
  padding: .6rem 0;
  font-size: .82rem;
  line-height: 1.4;
}

.site-header { border-bottom: 1px solid var(--line); background: #fff; }
.header-inner {
  display: flex;
  flex-wrap: wrap;
  gap: .75rem;
  align-items: center;
  justify-content: space-between;
  padding: .9rem 0;
}
.biz-name { margin: 0; font-weight: 700; font-size: 1.1rem; }
.biz-meta { margin: 0; color: var(--muted); font-size: .85rem; }

.button, .call-button {
  display: inline-block;
  background: var(--accent);
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  padding: .7rem 1.1rem;
  border: 0;
  border-radius: 999px;
  font-size: 1rem;
  cursor: pointer;
}
.button:hover, .call-button:hover, .button:focus, .call-button:focus { background: var(--accent-dark); }
.button--ghost { background: rgba(255, 255, 255, .16); border: 1px solid rgba(255, 255, 255, .75); }
.button--ghost:hover { background: rgba(255, 255, 255, .3); }
.button--small { padding: .5rem .9rem; font-size: .92rem; }
.call-button--muted { background: var(--soft); color: var(--muted); cursor: default; }
.link-quiet { margin-left: .75rem; font-size: .9rem; }

.hero { padding: 2.5rem 0; background: linear-gradient(135deg, var(--accent), var(--accent-dark)); color: #fff; }
.hero--photo { background-size: cover; background-position: center; }
/* The two figures exist so an AI-generated placeholder has a caption element to live
   in. Only the browser's default figure margin is neutralised here; the caption's
   own look is left to the template's design pass. */
.hero-figure, .about-figure { margin: 0; }
.hero-inner { max-width: 42rem; }
.hero h1 { font-size: 2rem; }
.lead { font-size: 1.05rem; margin: 0 0 .5rem; }
.lead--second { opacity: .92; }
.hero-actions { margin: 1.25rem 0 0; display: flex; flex-wrap: wrap; gap: .6rem; }

.section { padding: 2rem 0; }
.section--alt { background: #f7f9fa; border-block: 1px solid var(--line); }
.section p { max-width: 46rem; }
.muted { color: var(--muted); }
.address { font-style: normal; font-weight: 600; }

.services { list-style: none; margin: 1rem 0 0; padding: 0; display: grid; gap: .75rem; }
.services li { background: #fff; border: 1px solid var(--line); border-radius: var(--radius); padding: .9rem 1rem; }
.services p { margin: 0; color: var(--muted); font-size: .95rem; max-width: none; }

.hours { margin: 1rem 0 0; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; max-width: 28rem; background: #fff; }
.hours-row { display: flex; justify-content: space-between; gap: 1rem; padding: .55rem .9rem; border-bottom: 1px solid var(--line); }
.hours-row:last-child { border-bottom: 0; }
.hours dt { font-weight: 600; margin: 0; }
.hours dd { margin: 0; color: var(--muted); }

.about-photo { border-radius: var(--radius); margin-top: 1rem; }

.form-notice {
  background: var(--soft);
  border-left: 4px solid var(--accent);
  padding: .75rem .9rem;
  border-radius: 0 var(--radius) var(--radius) 0;
  font-size: .95rem;
}

.contact-form { max-width: 34rem; margin-top: 1rem; }
.field { margin-bottom: .9rem; }
.field label { display: block; font-weight: 600; margin-bottom: .25rem; }
.optional { font-weight: 400; color: var(--muted); }
.field input, .field textarea {
  width: 100%;
  padding: .65rem .7rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  font: inherit;
  color: inherit;
  background: #fff;
}
.field input:focus, .field textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
.hp { position: absolute; left: -9999px; height: 0; overflow: hidden; }
.form-status { min-height: 1.4rem; margin: .8rem 0 0; font-weight: 600; }
.form-status[data-state="error"] { color: #a3241f; }
.form-status[data-state="ok"] { color: #1f6b3a; }

.contact-fallback { max-width: 34rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--line); }
.contact-fallback h3 { margin-bottom: .25rem; }
.contact-fallback p { margin: .25rem 0; }

.site-footer { background: #1b1f24; color: #e8ebee; padding: 2rem 0; }
.footer-biz { font-size: 1.1rem; margin: 0 0 .25rem; }
.footer-contact { margin: 0 0 .9rem; }
.site-footer a { color: #fff; }
.disclaimer { border-left: 4px solid var(--accent); padding-left: .75rem; margin: 0 0 .9rem; font-size: .95rem; }
.footer-small { color: #b6bec7; font-size: .82rem; margin: .4rem 0; max-width: 46rem; }
.site-footer code { color: #d7dee5; }

@media (min-width: 48rem) {
  h1 { font-size: 2.4rem; }
  .hero h1 { font-size: 2.6rem; }
  .hero { padding: 3.5rem 0; }
  .section { padding: 3rem 0; }
  .services { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .two-col { display: grid; grid-template-columns: 1.1fr .9fr; gap: 2rem; align-items: start; }
}

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
`;
}

/**
 * The page's only script: post the form, show the outcome. It keeps no copy of
 * anything, writes nothing to storage, and sets no analytics. Loaded from a local
 * file — nothing here is fetched from a third party.
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
  const { record, form, delivery, images } = ctx;
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

`}This folder is a complete website. It is three files you will look at most:
index.html (the words), styles.css (the colours and spacing) and site.js (the
contact form). There is no database, no content management system and no server
software to keep patched, so nothing here goes stale or needs a monthly update.

Opening it
----------
Double-click index.html to view it in a browser. To put it on the web, upload the
whole folder to your hosting as it is.

Changing the words
------------------
Open index.html in any text editor (Notepad, TextEdit, VS Code). Every sentence is
plain text between tags. Change the text between the tags and save — do not change
the tags themselves. For example:

  <h2>Opening hours</h2>   ...change only "Opening hours"

The business name appears in several places (the header, the footer, the page
title). Use Find and Replace to change them all at once.

The photograph
--------------
${imageNote}

${formSection}
One recurring job
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
