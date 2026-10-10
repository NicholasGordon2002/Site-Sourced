# The card switch's scope, measured

**The claim under test.** `DEMO_SERVICE_CARD_ACTION_BAR` is described as an opt-in that changes
nothing when it is unset, and changes exactly one demonstration when it is set. That claim was
written into the module's header and into the plan; it had never been **diffed**. It is diffed
here, with four real builds of every fixture plus the delivered business-phase record, in
temporary directories, from two detached worktrees (the shared tree was never built into).

**Method.** `git worktree add --detach /tmp/wt/base 92e4f1b` (the commit before the card shape
existed) and `/tmp/wt/head f01a985` (master). Each worktree was given the two things the pipeline
reads from outside the repository (`ops/retention-log.md` and `.env.local`, symlinked) and built
with `bun run src/demo/cli.ts -- --record test/fixtures --record test/records/business-phase.json
--out … --no-images --quiet`. Comparison is per file, over the whole bundle:
`manifest.json` is normalised by dropping its timestamp fields (`generated_at` and any ISO
timestamp) and **nothing else**; every other file is compared as bytes.

**Bundles built:** `maple-avenue-barber-shop` (22 files), `northshore-garden-works` (21),
`red-hill-property-care` (19), `king-west-dental` (22), `business-phase-fixture` (19, the
delivered build).

---

## Run 1 — `92e4f1b` vs `f01a985`, switch unset (run 2)

**Expected:** every non-manifest file byte-identical.

| bundle | differing files (timestamps stripped) |
|---|---|
| all five | `manifest.json` only |

No file was added or removed in any bundle. **The claim holds.** The manifest difference is
expected and is the record itself: `92e4f1b` writes `bar_variant`, `f01a985` writes `card_variant`
 the same block renamed and widened to carry the shape. No rendered byte moves.

## Run 2 — `f01a985` switch unset vs `f01a985` switch = `nested` (run 3)

**Expected:** changes confined to the barber demonstration's `index.html`, `services.html` and
`styles.css`; Northshore, the other fixtures and the delivered build byte-identical.

| bundle | differing files (timestamps stripped) |
|---|---|
| `maple-avenue-barber-shop` | `index.html`, `services.html`, `styles.css`, `manifest.json` |
| `northshore-garden-works` | `manifest.json` |
| `red-hill-property-care` | `manifest.json` |
| `king-west-dental` | `manifest.json` |
| `business-phase-fixture` | `manifest.json` |

**Exactly the four files the claim names, in exactly the one bundle it names.** Every page of
every other bundle is byte-identical. Pages carrying the shape, checked directly:

```
nested run:  maple-avenue-barber-shop/index.html, /services.html, /styles.css
unset run:   (none)
```

**The one honest qualification.** The *manifests* of the untouched bundles differ between run 2
and run 3, and it is worth saying why rather than calling it noise: once every timestamp is
stripped (`generated_at`, and the per-image `retrieved_at`), the only remaining difference is
exactly one field — `conversion.service_action.card_variant.basis` — which now records that the
switch was set to `"nested"` and that **this record is not the demonstration it is scoped to, so no
page changed**.
That is the decision being recorded, not a page changing; a reviewer reading Northshore's manifest
sees why nothing moved rather than having to guess. It is a manifest-only edit, and it is the same
class of change as run 1's `bar_variant` → `card_variant` rename. If the team would rather a
refused switch left even the manifest untouched, that is a change to make deliberately — it is not
what the module does today.

## Run 4 — the delivered build with the switch set

**Expected:** the decision refuses it, and the client path is untouched.

`bun run src/demo/cli.ts -- --record test/records/business-phase.json --out /tmp/out/bizswitch
--no-images --quiet` with `DEMO_SERVICE_CARD_ACTION_BAR=nested`:

```
exit code 0
built business-phase-fixture (19 files, 495 KB)
Built   : 1   Failed  : 0
```

A build, not a refusal to build — which is the right outcome: the switch is refused *as a
rendering decision*, so a delivered build still succeeds and still contains the client's own site.

| comparison | differing files (timestamps stripped) |
|---|---|
| delivered build, switch unset vs switch = `nested` | `manifest.json` only |

and, scanning every HTML and CSS file of that build for either variant class
(`service-tile--cta`, `service-tile--bar`, `class="service-cta"`):

```
files carrying a variant class: none
```

**The owner's client path is untouched, with the switch set or unset.** The `maple-avenue-barber-shop`
delivered record and the fictional fixtures alike.

---

## What this does and does not prove

- **Proves:** the switch is inert when unset (every page of every bundle byte-identical across the
  commit that introduced it), and its effect when set is confined to the one demonstration and the
  four files the claim names — with the delivered build and every other record unaffected.
- **Proves, in a real build rather than in a unit test:** the delivered phase refuses the switch
  and still produces a working client bundle.
- **Does not prove** anything about how the shape *looks* — that is a browser measurement, and it
  lives with the 360px evidence in `/home/team/shared/design/service-cards-nested-cta/`.
- **Does not cover** a future switch that carries content rather than naming a shape. The variable
  is a switch today: it names no address, no label and no page.

## Reproducing

```sh
git worktree add --detach /tmp/wt/base 92e4f1b
git worktree add --detach /tmp/wt/head f01a985
ln -s /home/team/shared/ops /tmp/ops                     # <repo>/../ops/retention-log.md
for d in base head; do ln -sf /home/team/shared/pipeline/.env.local /tmp/wt/$d/.env.local; done
cd /tmp/wt/head && bun run src/demo/cli.ts -- --record test/fixtures \
  --record test/records/business-phase.json --out /tmp/out/head --no-images --quiet
```

then set `DEMO_SERVICE_CARD_ACTION_BAR=nested` for the second build, and compare per file with the
manifests' timestamp fields stripped. The two worktrees were removed afterwards; the shared tree
was never built into, and nothing under `site/public/` was touched.

*Runs made 10 Oct 2026 against `f01a985`. Comparisons excluded `manifest.json` timestamps
(`generated_at`, and `images`, which carries per-run entries) and nothing else.*
