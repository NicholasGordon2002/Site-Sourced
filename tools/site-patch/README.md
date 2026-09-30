# Site patch — clean demo URL (`/demo/<slug>`)

The published site lives at `/home/team/shared/site` and is **not tracked in git** (the platform
builds and deploys it from that directory). This folder is the durable copy of the small routing
change made there on 30 Sept 2026 so it can be re-applied if the site is ever rebuilt or reset.
Nothing here is executed by the pipeline; it is a mirror plus the commands to verify it.

## What changed (2 files, ~14 lines)

**1. `files/src/routes/demo/$slug.tsx` — NEW FILE** (routes `/demo/<slug>`).

A bundle is a self-contained directory and every path inside it is *relative* (`styles.css`,
`images/barber-hero-600.jpg`, `favicon.svg`). Relative paths resolve against the base directory of
the URL the browser is on, so a visitor has to land on a URL whose last segment is the bundle's
`index.html`; on `/demo/<slug>` the browser would ask for `/demo/styles.css` and the page would load
unstyled. The platform's edge proxy also strips a trailing slash from every request (verified
30 Sept 2026: `/index.html/` → 307 `/index.html`, `/demo/<slug>/` → 307 `/demo/<slug>`), so
`/demo/<slug>/` never reaches the app either. The site therefore answers the clean URL with a 307 to
the bundle's own `index.html`, which is a static 200 and resolves every relative path correctly.

```tsx
export const Route = createFileRoute("/demo/$slug")({
  loader: ({ params }) => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(params.slug)) throw notFound();
    throw redirect({ href: `/demo/${params.slug}/index.html`, statusCode: 307 });
  },
  component: () => null,
});
```

The slug regex matters: without it a crafted path could be turned into a redirect somewhere else.
Nothing is generated, rewritten or reworded — no page content, no frozen string; the bundle is served
byte for byte from disk.

**2. `files/serve.ts`** — directory-index resolution in the static layer (the diagnosed root cause:
nesting is not the problem, `index.html` resolution is). Before / after:

```ts
// before
const file = Bun.file(CLIENT_DIR + pathname);
// after
const target = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
const file = Bun.file(CLIENT_DIR + target);
```

Two honest caveats: on the **published** site this half is inert, because the edge strips the
trailing slash before the request arrives (`/demo/<slug>/` → 307 `/demo/<slug>`); it is what makes
`/demo/<slug>/` answer 200 with the bundle HTML when the app is reached directly (local runs, and any
client that sends the slash form). The route in (1) is what makes the clean URL work on the live
domain.

## Verified locally (30 Sept 2026)

`cd /home/team/shared/site && bun run build` → exit 0. Then the site's own `serve.ts` run on port
3100 (a copy with only the port and the dist paths rewritten, so the running dev server on 3000 is
untouched):

```
/                                                    200 2427
/demo/maple-avenue-barber-shop                       307 -> /demo/maple-avenue-barber-shop/index.html
/demo/maple-avenue-barber-shop/                      200 8868   <- bundle HTML, byte-identical (md5 e8cabce8fcceeb2a3699b6f545932bee)
/demo/maple-avenue-barber-shop/index.html            200 8868
/demo/maple-avenue-barber-shop/{services,about,contact,privacy}.html  200
/demo/maple-avenue-barber-shop/{styles.css,site.js,favicon.svg}      200
/demo/maple-avenue-barber-shop/images/barber-hero-600.jpg            200
/demo/maple-avenue-barber-shop/fonts/source-sans-3-latin.woff2       200
/nonexistent-xyz                                     404 (unchanged)
```

Following the clean URL ends at `…/demo/maple-avenue-barber-shop/index.html`, 200, one redirect, with
the proposal banner, `noindex, nofollow` and the relative `styles.css` link intact.

## Re-applying after a site rebuild

```bash
cd /home/team/shared/site
mkdir -p src/routes/demo
cp /home/team/shared/pipeline/tools/site-patch/files/src/routes/demo/'$slug.tsx' src/routes/demo/
# then re-apply the two-line serve.ts change by hand (the file may have moved on)
bun run build
```

Gotcha worth knowing: route files with a `$` in the name must be created with a quoted shell path
(`'src/routes/demo/$slug.tsx'`). A tool that expands `$` writes `demo..tsx`, the router generator then
registers a route named `/demo/`, and the clean URL keeps 404ing.
