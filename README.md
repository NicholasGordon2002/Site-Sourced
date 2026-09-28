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
