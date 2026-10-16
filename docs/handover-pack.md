# The hand-over pack: what a client actually receives

16 October 2026. Engineered against the delivered fixture (`test/records/business-phase.json`,
`delivery.mode: "business"`), built by the build's own path
(`bun run src/demo/cli.ts --record test/records/business-phase.json --out <tmp>`).

**The one rule every file below answers to** — the plan, "Rules we hold to": **"A client's
files never describe the demonstration phase."** A second rule governs what a delivery is at
all: a demo is an **unsolicited proposal** (banner, footer line, `noindex`, taken down on
request); a delivered bundle is the client's own site, and carries none of that furniture.

The rest of the hand-over pack — the corrected `README.txt` text, the booking reconnection
steps, the dependencies list and the decisions still open — is `research/handover-pack.md`
(the 4 Oct session's report). This file is the half that did not exist: **the inventory of
the folder, and the rule each file must satisfy.**

---

## 1. The inventory — every file a delivered bundle ships

Eighteen files, 468 KB, no third-party request on load. Built and listed from a real run of
the delivered fixture (`built business-phase-fixture (18 files, 468 KB)`).

| # | file | what it is for | the rule it must satisfy |
|---|---|---|---|
| 1 | `index.html` | the front page: hero, hours, services, contact block | no demo furniture; no claim the record does not carry |
| 2 | `services.html` | everything recorded for the business | the record's own words only; no invented price, timeline, visit or area |
| 3 | `about.html` | about the business, its hours and where it is | same, and no "where the details came from" sentence (delivered phase) |
| 4 | `contact.html` | the contact form | the notice above the form names who receives the message; the delivered README's claims match the account |
| 5 | `privacy.html` | how a message sent from these pages is handled | composed at build time from a recorded provider fact; **no window we do not operate** |
| 6–8 | `contact-<service>.html` (one per recorded service — three here) | the same form with that service already chosen | as `contact.html`, plus the family's own label |
| 9 | `styles.css` | colours, spacing, the design system | no second origin (`@import`, `url()`); the tokens of `docs/design-system.md` |
| 10 | `site.js` | the contact form, and nothing else | no cookie, no storage, no tracking, no XHR — the privacy notice says so |
| 11 | `favicon.svg` | the picture in a browser tab | ours to replace; carries no other business's mark |
| 12 | `README.txt` | **the client's own instruction sheet** — what they own, what to upload, how to change the words, what the form does | the delivered phase's own register: no demonstration paragraph, no noindex sentence, no takedown promise, no sourcing claim |
| 13 | `fonts/fraunces-latin-600.woff2` | the display typeface | ships locally, with its licence |
| 14 | `fonts/source-sans-3-latin.woff2` | the text typeface | as above |
| 15 | `fonts/OFL.txt` | the SIL Open Font License text for both | required to travel with the fonts |
| 16–18 | `images/barber-hero-600.jpg` / `-900` / `-1200` | the hero, one file per screen width (`srcset` picks) | CC0/PD, or an AI placeholder **labelled as an illustration on the page**; never a scraped photo, never the business's own logo |

**And the file that is not in the list: `manifest.json`, the build's own record.** As of this
change a delivered bundle ships none — §3 below is why, and what now refuses one.

## 2. The quoted evidence: what was in the record

Not an assertion — the lines, from the record the delivered fixture wrote before this change
(`manifest.json`, 31 KB, built 16 Oct 2026; line numbers from that file).

**It lists the demonstration's refused furniture by name** (the bundle's own account of
itself, `` `refused` ``):

```
353:      "refused": [
354:        "the proposal banner element",
355:        "an unsolicited-proposal sentence",
357:        "a noindex marker",
358:        "the sentence about being marked noindex",
359:        "the takedown promise",
360:        "the demonstration paragraph",
361:        "the demonstration bundle's contact-form paragraph",
362:        "the demonstration-page sentence",
363:        "the demonstration form-delivery notice"
```

**It carries internal reason prose written for us** — a client reading their own folder would
read our working notes:

```
 14: "provenance_basis": "…describe an unconfirmed proposal whose details we had to find,
      and a client's own site is neither"
 66: "cell": "…the hero photograph starts at the proposal banner's bottom edge, behind the
      header…"
 67: "surface": "…nothing separates the header from the proposal banner above it or the hero
      photograph below it."
159: "basis": "The header's second row is the page's primary-action slot (owner-approved
      6 Oct 2026)… a demonstration leaves the slot exactly as signed off on 7 Oct … (lead
      ruling, 8 Oct 2026)."
170: "placement": "…with the demonstration notice immediately below it as .form-note small
      print…"
201: "basis_note": "A booking link is a plain anchor that leaves the site: https only…"
315: "basis": "DEMO_SERVICE_CARD_ACTION_BAR is not set in this build, so no page carries the
      action-bar card: both bundles are the pages signed off on 7 Oct 2026, byte for byte
      (the owner's direction of 9 Oct 2026 …)"
536: "booking mode business: … the header slot is unchanged on a demonstration."
537: "provenance: … describe an unconfirmed proposal whose details we had to find…"
```

**And it names our own switches and other builds:**

```
 77: "basis": "DEMO_GHOST_CONTROLS is not set in this build, so every button of the review
      copy — the header action, the nested card CTA, the CTA band's action, the form's
      submit, Get directions and the home hero's two actions — wears the filled button it
      wears today: both published demonstrations and all four fixtures are unchanged, byte
      for byte…"
 96: "note": "…the two refused resolutions of the contrast problem … are named in
      docs/ghost-controls.md."
```

This is not a handful of sentences that could be reworded — it is the record's whole register,
field by field, and it is the register the record exists in: a reviewer reads *why* a bundle
is the way it is. There is no client-phase version of "`DEMO_SERVICE_CARD_ACTION_BAR` is not
set in this build".

**Why shipping it was not a theoretical leak.** The delivered `README.txt` says, correctly for
a static site, *"To put it on the web, upload the whole folder to your hosting as it is."* The
folder contained the record, so the record — our working notes, our rulings, the names of our
switches — would have landed in the client's own public web root. Our own publishing path
already treats it as internal-only: `tools/stage-review-copy.sh` excludes `manifest.json` and
`README.txt` and fails if either reaches a staged demo path.

**One thing the record did not contain:** nothing about the client's own site was untrue
because it carried them — the leak was of our internals, not a false claim to a visitor.

## 3. What changed, and the checks that hold it

**The change, smallest that does it:** the record is now a **phase item**, like the proposal
banner. `buildBundle` (`src/demo/build.ts`) computes `shipsRecord = delivery.mode === "demo"`
and uses it in four places — the file list the record reports, the leftover prune's keep set,
the manifest's own `files` entry, and the write itself (`if (shipsRecord) await write("manifest.json", …)`).
A delivered folder therefore loses a record an earlier demonstration run left in it (with its
own warning), instead of carrying it forward.

**The refusal** — `internalRecordProblems({ mode, carried })`, one function with two
directions, fed by `readBundleTexts(dir)` **reading the folder the build has just written**
rather than the intent that wrote it. Every other rule in `build.ts` judges intent; this one
reads the artifact, because the artifact is what the client receives.

| direction | what it refuses |
|---|---|
| `business` | any file of the folder carrying the build's own record, a `DEMO_*` switch name, or a line of our decision record — naming the file and the thing it carried |
| `demo` | a bundle with no record of itself: the demonstration **requires** it, exactly as it requires the banner |

**The patterns are registered** (`src/demo/refusal-registry.ts`, `INTERNAL_RECORD_MARKERS`),
each with samples taken verbatim from the record the build writes —
`"generator": "sitesourced-demo-generator/0.1"`, the `DEMO_GHOST_CONTROLS` basis line, the
`owner-approved 6 Oct 2026` basis line. `refusal-coverage.ts` requires every entry's pattern to
match its own samples and no pattern to match ordinary business prose, and it runs first inside
`complianceChecks`, so a rotted marker table fails the **build**, not only a test.

**No existing demo-phase refusal was weakened or removed.** `PROPOSAL_FURNITURE`,
`DEMO_ONLY_PROSE` and the README's requirement are untouched; the demonstration keeps its
record and every line of it.

### The check can fail — both directions, provable

`src/demo/build.ts`, one line each: `const shipsRecord = delivery.mode === "demo";`

**Doctor A — a delivered bundle that ships the record** (`shipsRecord = true`), rebuilt:

```
$ bun run src/demo/cli.ts --record test/records/business-phase.json --out /tmp/hp/docA
FAILED …/test/records/business-phase.json: the bundle's own record does not answer to the phase for business-phase-fixture:
  - manifest.json: carries the build's own record, but this bundle is a delivered site. A client's files never describe the demonstration phase: the build's own record is written for us, not for them — it lists the furniture a proposal carries, quotes the owner's directions and the lead's rulings, and explains decisions in a register the client did not ask for. A delivered bundle is the site and the client's own README; the demonstration keeps every line of the record.
  - manifest.json: carries a configuration variable of our own, but this bundle is a delivered site. …
  - manifest.json: carries a line from our own decision record, but this bundle is a delivered site. …
Records : 1
Built   : 0
Failed  : 1
```

**Doctor B — a demonstration that lost its record** (`shipsRecord = false`), rebuilt:

```
$ bun run src/demo/cli.ts --record test/fixtures/maple-avenue-barber-shop.json --out /tmp/hp/docB
FAILED …/test/fixtures/maple-avenue-barber-shop.json: the bundle's own record does not answer to the phase for maple-avenue-barber-shop:
  - this folder is a demonstration and carries no record of itself: the build's own record (manifest.json, marked with the line "sitesourced-demo-generator") is not in it. The record is how a reviewer reads what a bundle did rather than inferring it (WORKFLOW.md, "Modular development" rule 4c), so the demonstration phase requires it exactly as it requires the proposal banner — and a demonstration is the one phase allowed to carry it.
Built   : 0
Failed  : 1
```

Both doctors restored byte-exact, and the file compared against `git show HEAD:`:

```
restored: 8193269da03d91f2a585c022cebed21695118ffe5d7840ba2f016cd7b57440a3  src/demo/build.ts
committed: 8193269da03d91f2a585c022cebed21695118ffe5d7840ba2f016cd7b57440a3  -
```

**Tests** (`test/delivered-record.test.ts`, six, all on the real fixture): the delivered folder
ships eighteen files, listed by name, and no record; the demonstration twin keeps its record
and **every registered sample is really a line of it**; the refusal fires by name on a record,
on a page carrying our decision-record prose and on a `DEMO_*` name; a demonstration without
its record is refused; the markers never fire on a client's own words ("under new ownership",
"the lead time on a custom order", "our lead stylist"); a delivered build **clears** a record
an earlier run left in the folder, and says so in a warning.

## 4. Proving nothing else changed

All four published fixtures rebuilt from `4f7ef2d` (a detached worktree, `.env.local` copied
in) and from this branch, all four review switches unset, then compared:

```
diff -r -x manifest.json out-master out-branch
  (no output — exit 0)
files compared: 84 vs 84 (per bundle: 22 / 22 / 21 / 19)
manifest, generated_at and retrieved_at stripped, keys sorted:
  king-west-dental / maple-avenue-barber-shop / northshore-garden-works /
  red-hill-property-care → all IDENTICAL
```

The only byte that moves anywhere in the demonstration phase is the timestamp a bundle records
about itself. **Suite:** `bun test` 349 pass / 0 fail (343 on `4f7ef2d`, plus the six new
tests); the four published fixtures build 4/4 and the delivered fixture 1/1.

Nothing is staged, nothing is published, and the demo the owner is reviewing on their phone is
untouched: the branch changes no page, no stylesheet and no README.

## 5. Open, and flagged rather than guessed

1. **Where our own record of a delivered build should live.** The build still *constructs* the
   record — it is what makes the phase decision legible — but a delivered folder no longer
   carries it, so the delivered phase has no on-disk audit trail (the CLI's `--summary` JSON
   carries slug, dir, file list, bytes and warnings, not the bases). If the lead wants one, the
   natural home is beside the bundle rather than in it, and it is a lead call, not ours.
2. **`README.txt` is still in the folder the README tells the client to upload.** That is the
   one remaining internal-ish file in a client's web root, and it is a defender of the site's
   honesty rather than a leak — but the corrected README in `research/handover-pack.md` §1
   already splits "what goes on the host" from "notes for you, keep them with your records".
   Nothing here changes `README.txt`: it is byte-identical in all four demos and any edit would
   break the identity claim above.
3. **A client-facing register slip in the delivered README**, noticed while auditing it: *"The
   business name appears in several places (the headers, the footers, the page titles)"* — the
   client's own instruction sheet talks about "the business" in the third person. It is not a
   phase leak (the same sentence is in the demonstration's README) and it is **not** changed
   here, because it is a shared sentence and editing it would move the demo bundles' bytes.
4. **`BUNDLE_FILES`** (exported, unused) now describes a demonstration's file set; its comment
   says so. If a later task needs "the files a delivered bundle ships", that is the inventory in
   §1, not that constant.
