# Make the front doors tell the truth — README, home rows, stale numbers

**Priority 2 of the 2026-08-29 audit. Highest value-per-line in the repo.** A hiring manager
given the GitHub link today reads a README frozen at 2026-07-09, finds no link to the live
site, and a reviewer starting at `/` has no path to three quarters of the built store. The
site is good; the doors lie about it.

Every file:line verified 2026-08-29 by an adversarial pass. Re-open each before editing.

---

## Task 1 — README.md (1,173 bytes, last touched `da8fec5`, 2026-07-09)

`README.md:12` still reads "Implementation (in progress — the foundation build, issues
#2–#8)" and `:16` says variants/workers/tools are "arriving with their slices". Reality:
six variants serve four surfaces on a live plane (since 2026-07-11), with published,
receipted numbers. Rewrite:

- The live URL `https://pm-front.robresearch87.workers.dev` up top (it appears in ZERO of
  README.md / CONTEXT.md today — only buried in long docs).
- A 60-second reviewer path: home → an editorial reading → click a receipt → `/methodology/`.
- Current surface inventory (which variants serve which surfaces; what publishes numbers).
- The one-command reproduce.
- Keep it short — the map stays canonical; the README routes to it.

Also set the GitHub repo **homepage field** to the live URL (`gh api` — it is `null` today).
Note: setting it leaves this machine — confirm with Rob per the working agreement.

## Task 2 — home's catalogue rows hide three live surfaces

Live home rows PM-002 (Product page), PM-003 (Search + filters), PM-004 (Checkout) all read
"In build" linking GitHub docs (`workers/front/home/index.html` — live lines 796/807/815),
while `/vanilla/pdp/{slug}/`, `/react-next/plp/plain|tanstack|apollo/`, `/htmx/plp/` and
`/vanilla/checkout/` all serve 200 with full chrome. ADR-0007 designed this flip as a
one-word edit performed as a unit completion duty (`docs/adr/0007-home-surface.md:51-53`,
`:92-93`; precedent: slice E flipped editorial's row, `decision-map.md:235`).

The verifier's correction sharpens the rule — flip at **surface completion**
(plannedVariants gone), not first serve:

- **PDP: owed.** `packages/switcher/src/config.ts:119-124` — all four planned cells LIVE,
  plannedVariants gone.
- **PLP: owed.** `config.ts:137-141` — both arms LIVE, plannedVariants gone. But word the
  status so it does not promise the filters the page lacks (the rail is cut; the row is
  titled "Search + filters") — see `plp-data-plane-prompt.md`.
- **Checkout: correctly stays "In build".** `config.ts:166-174` — 1 of 3 variants.

Update the home origin-suite contract legs in the same commit, and add "flip your home row"
to the unit-completion checklist so surface #7 doesn't repeat this.

## Task 3 — home serves prototype numbers labeled "build-measured"

`workers/front/home/index.html:142-144` hand-types "+65.1 KB brotli against +9.0 KB" for the
Apollo exhibit — the 2026-07-12 **prototype** figures (ADR-0005:148-149). The shipped build
re-measured **+60,952 B vs +8,897 B = 6.85×** (`decision-map.md:475`, whose own rule is
"quote the DELTAS" in bytes). Home overstates the misapplication ~9% in the
thesis-flattering direction, on the credibility page. Replace with the real-build deltas —
and prefer substituting them at build from a committed artifact (the `%%…%%` marker pattern
already used at `:125`) so they cannot go stale again.

## Task 4 — the two stale sibling READMEs

- `workers/README.md:5-8` still describes the front Worker as "the throwaway chrome-free
  index at `/`" with chrome "arriving with issue #5" (landed 2026-07-11); `:189`'s runbook
  step closes issues closed 2026-07-11. Rewrite the bullet to present tense (routes, chrome
  injection, home + methodology singletons, `/_pm/lab`).
- `tools/README.md` documents six of seven tool dirs — `snapshot-fixture` (the CI seed
  everything depends on) has no entry. Add the three-line bullet.

## Explicitly out of scope

The footer 404s (`/how-it-was-built/`, `/vanilla/a11y/`) are fixed properly by their build
sessions (`how-it-was-built-build-prompt.md`, `a11y-section-build-prompt.md`) — do not
interim-retarget the footer here; it lives in the reference master and moves all six
variants' drift masters together.

## Done means

README + repo homepage route a stranger to the live plane in one click; home's rows match
`SURFACE_CONTROLS` state; no hand-typed number on home differs from the artifact of record;
origin suite green in both snapshot modes.
