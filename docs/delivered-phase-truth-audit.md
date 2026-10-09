# The delivered phase's own words — audit, fixes, and the leak class that had no check

9 October 2026. Files: `src/demo/render.ts` (`renderEditingReadme`), `src/demo/forms.ts`,
`src/demo/build.ts` (`phaseFurnitureProblems`), `test/business-phase.test.ts`.
Case: `test/records/business-phase.json`, the delivered-phase barber fixture.

The rule this audit holds every sentence to: **a delivered bundle is the paying client's own
site.** Nothing in it — not on a page, not in the README that ships beside the pages — may
describe the work as an unsolicited proposal, as a demonstration, as temporary, as
takedown-on-request, or as `noindex` (plan, "Rules we hold to"; WORKFLOW.md rule 9). The
demonstration keeps all of that furniture; the delivered phase gets the truth of a client's
own site.

## 1. The claim that started this, checked

The brief named `render.ts:2391-2392` — *"This page is an unsolicited design proposal, not
the business's official site, and it is marked noindex, so it does not appear in search
results. Ask and it comes down."* — as a paragraph that **ships inside a delivered bundle's
README**.

It does not. Those two lines are the *else* arm of the phase ternary that opens at 2386
(`businessPhase ? "These files were built by Site Sourced and are yours outright …" : "This
page is an unsolicited design proposal …"`); the line ends `` `} `` — the arm closes there.
Checked against a real build rather than by reading:

```
$ bun run src/demo/cli.ts --record test/records/business-phase.json --out … --no-images
built business-phase-fixture (19 files, 495 KB): Built 1 / Failed 0
$ grep -rlE "unsolicited|noindex|comes down|proposal|demonstration" \
      /tmp/bz/biz2/business-phase-fixture/*.html /tmp/bz/biz2/business-phase-fixture/*.txt
(no output)
```

So the reported sentence was **not** reaching a client, and the two "same audit" lines the
brief also named are, sentence by sentence:

| line | sentence | phase | verdict |
|---|---|---|---|
| 2353-2356 | "There is no database, no content management system and no server software to keep patched, so nothing here goes stale or needs a monthly update." | both | **kept** — true of static files a client owns, in either phase; it is the delivery promise, not proposal furniture |
| 2382-2383 | "Your domain name needs renewing once a year. Set it to auto-renew and the website can sit untouched indefinitely." | delivered only | **changed** — "can sit untouched indefinitely" is a maintenance promise nothing backs, and the same README says two paragraphs earlier that the form stops accepting submissions once the provider's allowance is spent. Now: "…Set it to auto-renew. The files themselves need no upkeep: nothing to install, patch or update, and no account of ours in the middle. Change any wording whenever you like." |

The rest of `renderEditingReadme` was audited the same way — every sentence, both arms, the
built artefact, not the source. What follows is what the audit actually found.

## 2. What was leaking, and is fixed

Three sentences belonging to the demonstration phase were reaching a delivered build.

### 2.1 The README's demonstration paragraph — refused by nothing

*"DEMONSTRATION — not the business's website, and never sent to the business. The contact
form's submissions come to Site Sourced."* (and, further down, *"This is a demonstration
bundle, not a delivered site."*)

Phase: **demonstration only.** The only thing keeping it out of a client's README was the
`businessPhase` ternary in `renderEditingReadme`. `build.ts`'s `MANIFEST_PHASE_REFUSED`
**listed** "the demonstration paragraph in the delivered README" as refused — and no line of
code tested it: the paragraph matched none of `PROPOSAL_FURNITURE`'s patterns, which cover
the *unsolicited-proposal* family (the banner, the noindex marker, the takedown promise),
not the demonstration's own sentences. A promise in the manifest, checked by nothing.

**Fixed:** a second list, `DEMO_ONLY_PROSE`, refused in the business phase on the pages *and*
in the README, and the manifest's refused list is now built from both lists, so the manifest
can no longer claim a guarantee the code does not make.

### 2.2 "on a demonstration page it is Site Sourced's" — in the client's README

`forms.ts`'s Formspark preset answered the README's question *"Whose account is it?"* for
**both phases at once**: *"…In a delivered site that is the client's own account; on a
demonstration page it is Site Sourced's."* A provider fact, so it was printed verbatim under
its question in the client's own instruction sheet.

Phase: the first half is the client's fact; the second half is our phase.

**Fixed:** the fact is now `(vars: { phase }) => string`, the same shape `visitor_storage`
already had: the delivered phase prints *"your own account — the form id belongs to it, so
you can read, export or delete submissions yourself"*, and the demonstration's wording is
byte-for-byte what it always was.

### 2.3 "on a demonstration page it says nothing here is booked" — in every delivered contact page

The comment above the form's qualifier line spelled out both phases at once, and a comment
ships inside the page: on a delivered site it sat in the client's own file, four times over
(`contact.html` plus one per recorded service).

Phase: the comment describes a fact about each phase; the delivered file may only carry the
delivered one.

**Fixed:** the comment is phase-derived. The demonstration's wording is byte-for-byte what it
always was (proved below).

## 3. Sentences the audit examined and kept, with the reason

| sentence | why it stays in a client's build |
|---|---|
| "This folder is a complete website. The pages are: …" + the derived page list and the `site.js` claim | derived from the bundle the build writes (`pageListBlock`, `readmeScriptClaim`), and `readmePageListProblems` refuses a typed one |
| "Double-click index.html to view it in a browser. To put it on the web, upload the whole folder to your hosting as it is." | true of the files the client now owns |
| "Changing the words" (edit between the tags, Find and Replace, update the links) | true of a static site; it is the instruction a client needs |
| the AI-image note ("It is not a photograph of your business, and the page labels it as an illustration … nothing here waits on a photograph") | the delivered wording already dropped the proposal's deadline ("before this page goes live as anyone's own site"); the remaining claim is about the page as it stands |
| the form section ("Notifications go to …; nobody at Site Sourced receives a copy") and every provider fact | true of the delivered routing; the one fact that named a phase is fixed (§2.2) |
| "These files were built by Site Sourced and are yours outright: no content management system, no database and no account of ours holds anything they need." | authorship, and the ownership the client paid for — the opposite of proposal furniture |
| "Where the details came from" / provenance tail | **absent** in the delivered phase already (`provenanceProblems` + the phase ternary): a client's site is not a proposal whose details we had to look up |
| the privacy page: "This is <business>'s own website…", the provider named, the retention sentences from the provider's own presets, no operator retention window | composed for the phase (`composePrivacy`); checked below |
| the recurring-job paragraph (§1) | **changed** — see the table above |

Delivered-phase privacy page, built verbatim from the fixture (providers the build actually
uses, and no window of ours):

```
The form is handled by Formspark, a third-party form service. Formspark emails it to
Delivered Fixture Barber Shop and also keeps a copy in Delivered Fixture Barber Shop's own
Formspark account until Delivered Fixture Barber Shop deletes it.
Formspark operates internationally, so the message may be handled under the laws of the
places where its servers sit.
How long it is kept: Your message is kept in Formspark's account until it is deleted there…
Last updated: 4 October 2026.
```

No operator practice, no cadence, no window of ours — the build reads the declaration in
`ops/retention-log.md` and, for `none`, prints none (test/privacy-notice.test.ts).

## 4. The check, in the four places

| place | change |
|---|---|
| **data** | `forms.ts`: `who_owns_the_account` is `(vars: { phase }) => string`; only the preset whose wording named a phase branches, the other four answer unchanged |
| **renderer** | `render.ts`: `providerFactsBlock(form, phase)`; the form-note comment is a per-phase const; the delivered recurring-job sentence drops "indefinitely" |
| **manifest** | `build.ts`: `MANIFEST_PHASE_REFUSED` = `PROPOSAL_FURNITURE` names + `DEMO_ONLY_PROSE` names, so what the manifest lists as refused is what the code refuses; the manifest's provider fact is resolved for the phase |
| **build check** | `build.ts`'s `phaseFurnitureProblems`: the business phase refuses `[...PROPOSAL_FURNITURE, ...DEMO_ONLY_PROSE]` on **every page** and on the **README**, naming what it found |

`DEMO_ONLY_PROSE` names the sentences themselves, never a keyword: a record's own recorded
wording is allowed to contain the word "demonstration", and a client's build must never fail
on the client's own copy.

Tests added in `test/business-phase.test.ts` (four tests, all on the real fixture): the
demonstration paragraph in a delivered README is refused by name; the demonstration-page
sentence is refused on a delivered page too; no delivered page or README says anything about
a demonstration *and the demonstration keeps every one of those sentences* (a derivation, not
a deletion); and the provider fact answers for the phase it is printed in.

## 5. Evidence

**Doctored render path** (WORKFLOW.md: doctor the path that renders, then restore byte-exact).
Doctor: `const businessPhase = false;` in `renderEditingReadme` — every delivered README arm
forced to the demonstration's. Verbatim output:

```
FAILED test/records/business-phase.json: compliance self-check failed for business-phase-fixture:
  - the delivered README carries an unsolicited-proposal sentence, but this bundle is a delivered site. …
  - the delivered README carries the sentence about being marked noindex, but this bundle is a delivered site. …
  - the delivered README carries the takedown promise, but this bundle is a delivered site. …
  - the delivered README carries the demonstration paragraph, but this bundle is a delivered site. …
  - the delivered README carries the demonstration bundle's contact-form paragraph, but this bundle is a delivered site. …
Built   : 0
Failed  : 1
```

The last two are the clauses that did not exist before this change: the manifest said they
were refused, and they were not. With the doctor in place the test run also fails
`the delivered README is a client's README: no demonstration paragraph, no sourcing claim`
and `no delivered page or README says anything about a demonstration` — the doctored
sentence demonstrably reached the rendered README, so the proof is not of an unreached arm.

Restored and compared byte-exact:

```
restored: 72efe1ba2585faecb448ca5d24479f634025458060f79124387f32917b0bb944
HEAD:     72efe1ba2585faecb448ca5d24479f634025458060f79124387f32917b0bb944
```

**Byte-identity of the demonstration phase.** All four published fixtures built on `master`
and on this branch, into separate trees, then compared:

```
files compared: 80                       (everything except each bundle's manifest.json)
differing lines: 0
manifest, build timestamp stripped: king-west-dental / maple-avenue-barber-shop /
  northshore-garden-works / red-hill-property-care  → all IDENTICAL
```

The only difference anywhere in the two builds is the `generated_at` / `retrieved_at`
timestamp a bundle records about itself. Every page, README, stylesheet, script, font and
image is byte-for-byte the same, so nothing here touches a signed-off demo.

**Test counts.** `bun test`: 275 pass / 0 fail on `master`; 279 pass / 0 fail on this branch
(the four new tests). Both fixture builds: demonstration phase 4/4, delivered phase 1/1.

## 6. Flagged, not fixed

1. **`manifest.json` ships inside a delivered folder** and is the build's own record: it
   lists the phase's refused furniture by name ("an unsolicited-proposal sentence", "the
   sentence about being marked noindex", "the takedown promise") and carries internal reason
   prose ("…an unconfirmed proposal whose details we had to find"). It is not a page and not
   the README, so it is not covered by this rule, but a client who opens the folder can read
   it. Whether a delivered bundle should ship the manifest at all is a decision for the lead
   and the owner — it is not ours to delete unilaterally.
2. **`noindex` is refused by pattern, not by absence.** A client build with an SEO plugin or
   a `<meta name="robots">` of another shape would pass; the pattern names `noindex` inside a
   robots meta, which is the form our own templates write.
3. **No delivered build has been handed over, and no real client's account exists** — the
   delivered phase is exercised by a test-only record (`test/records/business-phase.json`,
   deliberately outside `test/fixtures/`). The provider facts about a client owning their
   form account are how the delivery derivation describes the case, not something verified
   against a real client's dashboard.
