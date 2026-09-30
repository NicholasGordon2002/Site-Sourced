import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

// Clean entry URL for a published demo bundle (/demo/<slug>).
//
// A bundle is a self-contained directory — index.html plus its pages, styles,
// script, fonts and images — and every one of those is referenced RELATIVELY
// ("styles.css", "images/hero.jpg"). Relative paths resolve against the base
// directory of the URL the browser is on, so a visitor has to land on a URL
// whose last segment is that index.html; on /demo/<slug> the browser would ask
// for /demo/styles.css and the page would load unstyled.
//
// The platform's edge proxy also strips a trailing slash from every request
// (verified 30 Sept 2026: /index.html/ -> 307 /index.html, and also
// /demo/<slug>/ -> 307 /demo/<slug>), so a /demo/<slug>/ URL never reaches this
// server and cannot serve as an entry point either. Redirecting to the bundle's
// own index.html is therefore the one entry point that works: it ends at a real
// 200 served as a static file, byte for byte, and every relative path in the
// bundle then resolves under /demo/<slug>/.
//
// Nothing is generated or rewritten here — no page content, no frozen string.
// 307 (not 301) so a phone that has visited once does not cache the entry point
// permanently if we later serve the clean URL directly.
export const Route = createFileRoute("/demo/$slug")({
  loader: ({ params }) => {
    // Slugs are directory names under public/demo/. Refuse anything else, so a
    // crafted URL can never turn this into a redirect somewhere else.
    if (!/^[a-z0-9][a-z0-9-]*$/.test(params.slug)) throw notFound();
    throw redirect({ href: `/demo/${params.slug}/index.html`, statusCode: 307 });
  },
  component: () => null,
});
