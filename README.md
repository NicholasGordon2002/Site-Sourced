# Site Sourced — lead engine

Finds Ontario local businesses that have no website (or a dead / outdated one) using
**OpenStreetMap data only**, and writes a verified lead list with a website verdict for
every business that does have a site.

This is step 1 of the Site Sourced pipeline. It does not generate demo sites and it does
not send email — it only produces the lead list.

---

## Run it

```bash
cd /home/team/shared/pipeline
bun install                       # no dependencies; this is a no-op that verifies the toolchain
bun run leads -- --area "Hamilton, ON" --radius 8km
```

Output (written to `out/`):

```
out/leads-hamilton-on.csv     one row per lead, 29 columns
out/leads-hamilton-on.json    the same rows plus run metadata and counts
out/cache/                    every HTTP response we received (gitignored)
```

A full run over an 8 km radius of Hamilton takes roughly 2–4 minutes and produces
~2,400 leads. Nothing else is needed: no API key, no account, no `.env`.

### Useful flags

| Flag | Default | What it does |
| --- | --- | --- |
| `--area "<text>"` | `Hamilton, ON` | Area name, geocoded with Nominatim (cached forever). |
| `--radius <8km\|5000m\|5mi>` | `8km` | Circle radius around the area centre. |
| `--center <lat,lon>` | — | Skip geocoding entirely and use this centre. |
| `--out <dir>` | `./out` | Where the CSV/JSON go. |
| `--cache-dir <dir>` | `./out/cache` | On-disk HTTP cache. |
| `--cache-ttl-hours <n>` | `168` | How long a cached response stays fresh (failures expire after 6h). |
| `--refresh` | off | Ignore the cache for this run and re-fetch everything. |
| `--max-checks <n>` | `150` | Cap how many websites get a health check. `0` = no cap. |
| `--concurrency <n>` | `6` | Parallel site checks (one request per host at a time, always). |
| `--no-health` | off | Skip website health checks completely. |
| `--no-respect-robots` | off | Do **not** honour `robots.txt` before checking a site. |
| `--limit <n>` | `0` | Only write the first N leads. |
| `--quiet` | off | Less progress output (progress goes to stderr, results to stdout). |

Examples:

```bash
# Every site checked, not just the first 150
bun run leads -- --area "Hamilton, ON" --radius 8km --max-checks 0

# Lead list only, no outbound requests to any business
bun run leads -- --area "St. Catharines, ON" --radius 6km --no-health

# Throw away the cache and start over
bun run leads -- --area "Hamilton, ON" --refresh
```

---

## Output fields

One row per business, deduplicated on name + address.

### Identity

| Column | Meaning |
| --- | --- |
| `osm_id` | `node/12345` or `way/67890`. If two OSM objects were merged, `a+b`. |
| `osm_type` | `node` or `way`. Relations are deliberately excluded. |
| `name` | The OSM `name` tag. Elements without one are skipped. |
| `category` | The matching OSM value, e.g. `hairdresser`. |
| `category_key` | Which OSM key it came from: `shop`, `amenity`, `craft`, `office`, `healthcare`, `leisure`. |
| `category_group` | Human grouping, e.g. `Salons & barbers`. |
| `osm_tag` | The raw tag, e.g. `shop=hairdresser`. |

### Contact & location

| Column | Meaning |
| --- | --- |
| `street_address` | `addr:housenumber` + `addr:street` (+ unit). **Empty when OSM has no address tags** — see coverage gaps. |
| `city` | `addr:city` / `addr:town` / `addr:village` / `addr:suburb` / `addr:hamlet`. |
| `province`, `postcode` | `addr:province`, `addr:postcode`. |
| `phone` | `phone` or `contact:phone` (also `contact:mobile`). Tag only. |
| `email` | `email` or `contact:email`. **Tag only — never guessed or derived from a website.** Blank means there is no published address. |
| `website` | `website` / `contact:website` / `url` / `website:en`. Tag only. Empty means the business has no website recorded in OSM. |
| `opening_hours` | The `opening_hours` tag, verbatim (OSM syntax, e.g. `Mo-Fr 09:00-17:00`). |
| `lat`, `lon` | Coordinates. For ways these are the OSM `center`. |
| `distance_km` | Distance from the area centre, in km (3 decimals). |

### Website tier — the classification that drives everything

| `website_tier` | Meaning |
| --- | --- |
| `no_website` | No website tag at all in OSM. |
| `social_only` | The website tag points at somebody else's platform: Facebook, Instagram, Linktree, LinkedIn, X, TikTok, YouTube, WhatsApp, a Google Maps / `g.page` / `business.site` listing, Yelp, Tripadvisor, a delivery marketplace, or a business directory. `social_platform` names it. |
| `has_website` | A URL that looks like a site the business controls → it gets a health check. |

### Site health check (`has_website` leads only)

Exactly one GET of the homepage per site, redirects followed, 12 s timeout, descriptive
User-Agent, cached on disk. `robots.txt` is honoured by default — if a site disallows
automated agents we do **not** fetch it and say so in the reason.

| Column | Meaning |
| --- | --- |
| `site_checked` | `yes` if we actually made a request, `no` otherwise. |
| `site_verdict` | `ok`, `outdated`, `dead`, `parked`, or empty when not checked. |
| `site_verdict_reason` | One line explaining the verdict. |
| `http_status` | Final HTTP status, `0` if the connection failed. |
| `final_url` | Where we ended up after redirects. |
| `https` | `yes` if the final URL is HTTPS. |
| `viewport_meta` | `yes` if the HTML has a responsive `<meta name="viewport">`. |
| `page_weight_bytes` | Size of the HTML document. `>=N` means we stopped reading at the cap (600 KB). This is the HTML only, not images/scripts. |
| `site_evidence` | The signals behind the verdict, ` \| `-separated. |

**Verdict rules, in priority order**

1. **`dead`** — connection failed (DNS, TLS, timeout), or the homepage returns 4xx/5xx.
   If `https://` fails we retry plain `http://`; if that works the verdict is `outdated`
   ("http only") rather than `dead`, because the site is still serving.
2. **`parked`** — a parked/for-sale domain notice, a host default page (`Welcome to nginx`,
   `It works!`, cPanel/Plesk placeholder), an "under construction" / "coming soon"
   placeholder, a non-HTML response where a page should be, or fewer than 800 bytes of HTML.
3. **`outdated`** — at least one concrete signal: an obsolete generator (`<meta name="generator">`
   naming FrontPage / Dreamweaver / iWeb / WordPress ≤ 4 / Joomla 1–2 / Drupal ≤ 7), deprecated
   markup (`<font>`, `<frameset>`, `<center>`, `<marquee>`, Flash), a pre-HTML5 doctype,
   a table-based layout, a copyright year three or more years old, no HTTPS, or no responsive
   viewport meta tag. The reason line always names the signal it used.
4. **`ok`** — reachable, and none of the above.

**Deliberately conservative:**

- HTTP 401/403/429/451 is a bot wall or a login page, not a broken site → `ok` with a reason
  saying it was not assessed.
- A site we were not permitted to check (robots.txt) → `ok`, `site_checked=no`, reason names
  the rule. We never guess.
- "No viewport tag" is reported as the signal it is — the reason says
  `no responsive viewport meta tag (no other age signals found)`.

---

## Data, licence and attribution

Business data comes from **OpenStreetMap** via the **Overpass API**.

> © OpenStreetMap contributors, available under the **Open Database License (ODbL) 1.0** —
> https://www.openstreetmap.org/copyright

Practical consequences for Site Sourced:

- **Attribution is required.** Any internal list, CRM, spreadsheet or report derived from this
  data must carry "© OpenStreetMap contributors" and note the ODbL. It is already written into
  the JSON's `attribution` field.
- **Share-alike applies to derived databases.** The *lead list itself* is a derived database.
  Keeping it internal and using it to make phone calls is fine. Publishing it, or shipping it
  inside a product, triggers ODbL obligations. Worth a lawyer's eye before any public release.
- **Do not treat OSM as a business registry.** A missing website in OSM means "not recorded in
  OSM", not "this business has no website". Every row is a lead to verify, not a fact to quote
  in outreach.
- The OSM `name` tag is not a licence to use a business's logo, photos or copy. Demo sites stay
  CC0/public-domain only, as the business plan requires.
- Geocoding uses **Nominatim** (also OSM data, same licence), one request per area, cached.

## Politeness

- One descriptive `User-Agent` on every request:
  `SiteSourced-LeadEngine/0.1 (Ontario local-business lead research; …)`.
  Override it with the `SS_USER_AGENT` environment variable — do that before any real run
  so OSM can reach a human if we misbehave.
- Overpass: one request at a time, one request per tag key (6 total per area), ~1.2 s pause
  between them, retry with exponential backoff, and automatic failover between three public
  mirrors (`overpass-api.de`, `overpass.kumi.systems`, `overpass.private.coffee`).
- Nominatim: one request per area, cached for a year.
- Prospect sites: one request per site (plus one `robots.txt`), 6 concurrent at most, never two
  requests to the same host at once, 12 s timeout, cached for a week.
- **No scraping.** Google Maps and every other service whose terms forbid automated access are
  out of scope. OSM/Overpass is the only business data source in this phase.
- Every response is cached, so a re-run is free — for us and for the servers we touch.

---

## Known coverage gaps

Read this before trusting any number in the CSV.

1. **OSM coverage is uneven.** Retail, food and drink in a city core are well mapped; trades
   (`craft=plumber`), cleaning services and landscaping are badly under-mapped because they are
   mobile businesses with no storefront pin. Toronto and Ottawa are the best-covered Ontario
   cities; smaller towns are patchy.
2. **~45% of leads have no street address** in OSM. We do not reverse-geocode to fill it —
   and we never guess. `lat`/`lon` is always present, so those rows are still locatable on a map.
3. **A blank `email` usually means "not published in OSM"**, not "no email exists". Email
   coverage in OSM is low. Outreach that depends on `email` will only reach a minority of rows.
4. **`no_website` is a hypothesis.** Many businesses without a website tag do have one; it is
   just not recorded. Verifying this is what the health check does for `has_website` leads —
   `no_website` leads need a human or a phone call.
5. **Social-only is under-detected** for the same reason: if the Facebook page was never tagged,
   the row looks like `no_website`.
6. **Page weight is HTML only.** A 12 KB page with 8 MB of hero images reads as `ok`. We record
   nothing about images, scripts or performance — that is a job for a real audit.
7. **`outdated` looks at one page.** A site whose homepage is modern but whose menu PDFs are from
   2011 is `ok` here. Only the homepage is fetched: we do not crawl.
8. **Only the categories in `src/overpass.ts` are queried.** Chains and franchise storefronts are
   included — they are not prospects. Filter by `name` if you need independent businesses only.
9. **One area per run.** No multi-area or province-wide sweep in this phase.

---

## Layout

```
src/cli.ts        argument parsing, orchestration, progress output
src/http.ts       polite fetch: User-Agent, timeouts, retry/backoff, per-host queue, disk cache
src/geo.ts        Nominatim geocoding, radius parsing, haversine, bbox maths
src/overpass.ts   category definitions and the Overpass queries (one per tag key)
src/classify.ts   OSM element -> lead, website tier, dedupe/merge
src/health.ts     robots.txt, site fetch, parked/outdated signal detection
src/output.ts     CSV writer + JSON writer
src/types.ts      shared types
```

Run `bun run leads -- --help` for the flag list.

---

# Site Sourced — demo generator (step 2)

One command turns a single business record into a **complete, self-contained static
website**:

```bash
bun run demo -- --record test/fixtures/maple-avenue-barber-shop.json --out out/demos
bun run demo -- --record test/fixtures --out out/demos      # every record in a folder
```

The output folder is simultaneously the demo we send a prospect and the product we
hand a client: it opens from disk with no server, and it uploads to any host as it is.

## The bundle

```
out/demos/<slug>/
  index.html      the page — plain HTML, readable, with the client's words in it
  styles.css      plain CSS, no framework, no webfont, no @import
  site.js         the contact form's only script (no tracking, no storage)
  favicon.svg     generated from the business name and category colour
  img/            CC0/public-domain photographs, or a labelled AI fallback
  manifest.json   every fact about the bundle: images, licences, form, hand-off
  README.txt      plain-language notes for the client (how to change their own text)
```

## What the generator will not do

These are enforced in code, not by good intentions:

- **No invented facts.** Copy is composed from the record's category and services.
  A phrase bank (`src/demo/copy.ts`) refuses to build a page containing an award, a
  testimonial, a customer count, a founding year or a performance claim unless the
  record itself contains those words.
- **No scraped content.** There is no code path that fetches a business's own site,
  logo or photographs. The only URLs the generator fetches are image APIs and the
  images themselves.
- **Copyright-free imagery only.** Openverse and Wikimedia Commons are searched for
  **CC0 / public-domain** files; the licence is re-read from the file's own metadata
  and anything else is skipped. Downloads are capped at 700 KB. If nothing clean is
  found, the page uses a plain CSS/SVG treatment and the manifest says so. A
  hand-supplied image must declare CC0/public-domain, or be labelled `AI-generated`
  (labelled in the manifest, as in the test fixtures).
- **No submissions kept by us.** The form posts straight to a relay the client owns
  (see `src/demo/forms.ts`), the page states that in plain words, and the business's
  email address and phone number are printed next to the form so an enquiry is never
  lost if the relay is down.

## Compliance, in every bundle

`<meta name="robots" content="noindex, nofollow">`; a proposal banner above the fold
(verified by measuring its position in the rendered page); the same disclaimer in the
footer next to the business's name and contact details; and no "© <Business Name>".
The build fails if any of them is missing.

Two rules that used to be half-implemented are now gates as well:

- **Every address the bundle posts to *or prints* must be able to work.** One shared
  function (`src/demo/addresses.ts`) covers the form's recipient *and* every address a
  rendered page prints (a `mailto:` link or plain text), against one predicate. An
  address that is merely unverified passes — the build is offline and deterministic, and
  the printed "please confirm" caveat is what covers that case. Reserved/special-use
  domains (RFC 2606 / RFC 6761), malformed values and empty ones fail the build.
- **Every page states where the business's details came from — derived from the record,
  never typed into a template.** See *Where the details came from* below.

## Where the details came from

A page that credits a source the record does not have is a false claim, so the record
declares its source and everything the page says about it is derived
(`src/demo/provenance.ts`):

```json
"source_kind": "openstreetmap" | "public-listings" | "fictional",
"source": "free-text note for our own records (optional)"
```

| `source_kind` | What the page may say | The footer credits | The caveat on the printed details |
| --- | --- | --- | --- |
| `openstreetmap` | the details came from OpenStreetMap via Overpass | "© OpenStreetMap contributors", ODbL 1.0, public mapping data | the frozen "as published in public listings — please confirm" line |
| `public-listings` | the details were read from a listing the business published | public listings; **no** mapping data | the same frozen line |
| `fictional` | this is a made-up example business, invented to show the layout | neither; nothing was taken from a real business, a listing or a website | the fictional-example line (the frozen one would be false) |

`source_kind` is **required**: a record that declares nothing fails the build, because no
attribution can be chosen on its behalf and printing unconfirmed details with no caveat
is not an option either. The same guard refuses a bundle whose page keeps the
OpenStreetMap credit (or the wrong caveat) while the record declares another source, and
refuses a `fictional` record whose form delivers to it as a client's own site. The
manifest records the declared kind, the exact line derived from it, and why
(`business.source_kind` / `provenance_line` / `provenance_basis`).

## Flags

| Flag | Default | What it does |
| --- | --- | --- |
| `--record <path>` | — | a record JSON file, or a directory of them (repeatable) |
| `--out <dir>` | `./out/demos` | where bundles are written |
| `--cache-dir <dir>` | `./out/cache/demo` | HTTP/image cache (gitignored) |
| `--no-images` | off | skip image sourcing entirely (CSS/SVG only, no network) |
| `--refresh` | off | ignore the image cache and re-fetch |
| `--form-endpoint <url>` | — | override the form endpoint (local relay tests only) |
| `--summary <path>` | — | also write the run summary as JSON |

## The contact form: what we chose, and why

Static files cannot send email, so the form posts to a free relay that sends the
message **to the business's own inbox**. `src/demo/forms.ts` carries the presets and
the trade-offs; the record chooses one (`form_provider`) and supplies the key
(`form_access_key`, which may be `env:NAME` so no real key is ever committed).

**Recommended: Web3Forms.** No account to babysit — one access key tied to the
recipient's address, created by the client themselves, so the client owns it from day
one. Their stated model is that submissions are forwarded and not stored, which
matches what the page promises the visitor. The key keeps the business's email address
out of the page source, where scrapers would otherwise harvest it.

Depends on: free tier 250 submissions/month; no card; no monthly bill.
If it lapses: the form stops delivering, and the printed email address and phone
number next to it still work.

The same file documents **Formspark** (verified from its pricing page on 28 Sept 2026:
free tier 250 submissions and a permanent archive, extra volume as a one-time bundle
rather than a subscription — but it is account-based and it does store submissions),
StaticForms and FormSubmit as alternatives.

> **Unverified from this machine:** `web3forms.com` and `formsubmit.co` are behind a
> Cloudflare bot check that refuses this development machine's IP (HTTP 403 for a
> browser user-agent on both the site and the API endpoint), and every account-based
> relay needs an email confirmation this machine cannot receive. So a submission to a
> real relay could not be executed here. It was executed instead against
> `test/verify.ts`, a local relay that implements the same request/response contract —
> see the run log in the report to the lead.

## Verifying a bundle locally

```bash
bun run demo -- --record test/fixtures --out out/demos
bun run test/verify.ts        # static server on :8099, form relay on :8098
```

`test/verify.ts` serves the bundles and logs every request, which is how the "no
external requests on load" claim is checked; it also stands in for the form relay so a
submission can be followed end to end. Test fixtures live in `test/fixtures/` and are
**fictional businesses** — the form recipient for test runs is our own inbox.

## Test fixtures

| Fixture | Category | `source_kind` | Exercises |
| --- | --- | --- | --- |
| `maple-avenue-barber-shop.json` | Barber shop | `fictional` | structured hours, services with notes, AI-fallback hero |
| `northshore-garden-works.json` | Landscaping | `fictional` | raw OSM `opening_hours` string, five services |
| `king-west-dental.json` | Dental clinic | `fictional` | health category palette, emergency-appointment wording |
| `red-hill-property-care.json` | Landscaping | `public-listings` | the non-OpenStreetMap provenance line, with the frozen caveat |

The three original fixtures are **fictional example businesses** and say so on the page.
None of the four carries an email address: the page cannot print one it has no business
printing, and a fixture that never existed has no address to print.

The fixtures' hero images are **AI-generated** (`test/fixtures/images/`) and both the
manifest and the report say so; the CC0/Openverse/Commons path is the default for real
records. Each fixture hero is a **variant set** of real JPEGs — `…-600.jpg`,
`…-900.jpg`, `…-1200.jpg`, and `…-1536.jpg` where the picture fits the budget — listed
in the record under `images[].variants`. See *Preparing images* below.

---

## Preparing images

Image encoding is **build-time tooling only**. It lives outside this repository, no
delivered bundle needs it, and the pipeline itself has no dependencies: it measures and
copies the files, and refuses a file that is too heavy or mislabelled rather than
quietly re-encoding it behind your back.

One-time setup, in a directory that is neither in this repo nor on the published site:

```bash
python3 -m venv /home/team/shared/.tools/imaging-venv
/home/team/shared/.tools/imaging-venv/bin/pip install Pillow
```

Then, for each picture:

```bash
cd /home/team/shared/pipeline
/home/team/shared/.tools/imaging-venv/bin/python tools/prepare-images.py \
    --in test/fixtures/images/barber-hero-1536.jpg --out-dir test/fixtures/images
```

- It cuts the tier widths the page's `srcset` asks for (600 / 900 / 1200 / 1600), never
  upscaling: the largest tier is `min(native width, 1600)` and its file is named with
  its real width, so the name never lies.
- It fits each tier to the design system's budget (`docs/design-system.md` §8: the hero
  is ≤ 180 KB at its widest and ≤ 120 KB for the file a 360px phone downloads) by
  stepping the JPEG quality down a ladder. A tier that cannot fit even at the bottom of
  the ladder is **dropped, and said out loud** in the output — the budget beats pixels,
  and the aspect ratio is unchanged, so the space the page reserves is unchanged too.
- It prints a ready-to-paste `variants` block for the record.
- It re-encodes a PNG that is wearing a `.jpg` name, and says that it did.
- Output is progressive JPEG, 4:2:0, carrying no metadata from the source.

The **committed `.jpg` files are the artefact of record**: re-running the tool from the
largest committed variant reproduces the smaller tiers.

What the build does with the result, whether the files came from this tool or from a
download:

| Check | Where | On failure |
| --- | --- | --- |
| The bytes match the file name (a `.jpg` must be a JPEG) | `src/demo/supplied.ts` | build fails, naming the file and the command to run |
| The record's stated width is the file's real width | `src/demo/supplied.ts` | build fails: that number goes into the page's `srcset` |
| Each image is inside the budget for its role, and the 700 KB hard cap | `src/demo/supplied.ts`, `src/demo/weight.ts` | build fails |
| The whole page a 360px phone loads is under the 750 KB ceiling | `src/demo/weight.ts` | build fails, naming the page and the heaviest file it loads |
| No file from an earlier build is left behind in the bundle folder | `src/demo/build.ts` | removed, and listed as a warning |

---

## Contact form (demo generator)

A generated demo is a static page, so its contact form posts to a relay the
client owns. Which relay, and which account, is a property of the record, not of
the code:

```json
"form_recipient": "the-business@example.com",
"form_provider": "formspark",
"form_access_key": "env:SS_FORMSPARK_FORM_ID"
```

- `form_provider` picks a preset from `src/demo/forms.ts` (`formspark`,
  `web3forms`, `staticforms`, `formsubmit`, `relay`).
- `form_access_key` is the provider's form id or access key. `env:NAME` reads the
  value from the environment, and the CLI also loads a **gitignored**
  `pipeline/.env.local` automatically, so the id is never committed:

  ```
  # pipeline/.env.local  (never committed — see .gitignore)
  SS_FORMSPARK_FORM_ID=xxxxxxxx
  ```

  A real environment variable always wins over the file, and `--no-env-file`
  turns the file off. Create one Formspark form per client (free plan: 10 forms),
  set that form's Notifications recipient to the client's own address, then give
  the client's record its own variable name — e.g.
  `"form_access_key": "env:SS_FORMSPARK_FORM_ID_ACME"`. Nothing else changes.
- `--form-endpoint <url>` overrides every record's endpoint, for pointing a
  generated bundle at a local test relay. It is a testing flag: never use it for
  a real prospect.

Every fact the demo states about the form — the notice under the form, the
manifest's `form` block and the bundle's `README.txt` — is generated from the
provider preset, so the page cannot claim more privacy than the provider
actually gives. **Formspark keeps submissions in the client's account**; the
evidence, with quotes and dates, is in `docs/formspark.md`. Update that file
before changing what a page says.
### The privacy notice, and what it is allowed to say
The privacy notice is composed at build time from two recorded facts and nothing
else (WORKFLOW.md rule 7 — it binds the demonstration page *and* a paying client's
own page, and both are checked):

- **Provider facts** — what the form service itself does — quoted into the preset
  in `src/demo/forms.ts` from `docs/formspark.md` (`retention_facts`,
  `collection_extra`, `deletion_exception`, `service_descriptor`). They print as
  their own sentences, never appended to one of ours.
- **Our own declared practice** — how often we go through the form account and
  delete what is in it — read from `ops/retention-log.md`, the one file that
  declares it. `SS_RETENTION_LOG` points the build at another copy. With
  **no cadence declared, the build refuses the bundle** rather than printing a
  softer sentence, and under the declared cadence `none` the notice prints **no
  window and no number at all**: a build that prints one fails.
- **The collection list** comes from `FORM_FIELDS` in `src/demo/fields.ts` — the
  same list the form is rendered from — and is checked against the fields the
  rendered contact page actually asks for, so the notice can never name fewer of
  them than the page collects.
- **The client's variant** prints no window on the client's behalf (we do not
  operate their account), names the client as the one who deletes, and gives the
  visitor the route to ask.

The wording and the date are sealed together: `PRIVACY_LAST_UPDATED` and
`PRIVACY_NOTICE_SEAL` in `src/demo/copy.ts`, held by the last test in
`test/privacy-notice.test.ts`. When the notice's sentences change, that test fails
and names the two values to move together — in the same commit. `manifest.json`
records what the retention section was composed from (`privacy.retention`) and the
field list the collection sentence names (`privacy.collection_fields`), so a
reviewer reads the basis rather than inferring it.


### Regenerating the demo bundles

```bash
cd /home/team/shared/pipeline
bun run demo -- --record test/fixtures --out out/demos
```

`out/demos/` is gitignored: the bundles are build output, not source.
