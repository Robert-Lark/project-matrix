---
status: accepted
date: 2026-07-16
ticket: home-surface
---

# Home surface — the front door as a receipt

## Context

The gateway page opened cold from a job application or a blog link, by
skeptical staff engineers and hiring managers allergic to marketing. In ~90
seconds it must, in order: (1) land the site's argument — one Discogs-powered
store, several rendering architectures, real numbers; **fit, not a
leaderboard** — (2) establish judgment quietly, (3) hand over the gateway (one
entry per surface, one tradeoff each). [ADR-0004](0004-deployment-topology-and-contextual-switcher.md)
had already settled the paradigm: a **static singleton on the canonical
plane, served assets-first by the front Worker, no render-switcher**. The
Catalogue aesthetic was poured ([ADR-0006](0006-aesthetic-direction-catalogue.md));
strategy-review finding 2 (deferred here by Rob, 2026-07-12) made this
surface the thesis-carrier: the 2–3 plain sentences deserve grilling weight.

Two constraints discovered in recon bound every sentence:

- **The page ships before the pressings.** No store surface is built; what is
  live is the instrument — the frozen snapshot serving at `/api/*`, the
  composed origin, the drift gate, the bench harness, the public decision
  record. Any present-tense "built five ways" is false on publication day.
- **No pre-asserted verdicts** (strategy review / ADR-0005 §6): the flip is
  what the instrument is *designed to expose*; published verdicts are what
  receipts say. There are no published lab runs.

Method: copy drafted as a deck with a claims-table (every on-page claim →
source → true-today?), then attacked by a six-lens adversarial panel (tired
staff engineer, hiring manager, voice cop, fact-checker with repo access,
thesis guard, structure editor — 60 findings). The panel killed six C2
verdict-phrasings, fixed the hero's tense in place, and caught a transcribed
commit SHA that was wrong in its seventh character — the exact string this
audience would paste into git. That catch decided §3's mechanism.

## Decision

**1. The message.** Headline: **"One store. Five architectures. One ruler."**
Body in honest progressive tense — *being built five ways* — with one
checkable number in the first sentence (500 releases, the freeze date,
linking the live manifest). The thesis is stated as **the premise under
test** ("no architecture wins everywhere"), never as a result; the numbers
"exist to show where each one earns its bytes, where the same one is
overkill." Status is an inventory, not an apology, and leads with the
judgment signal: **the instrument shipped first — no verdict can be
retrofitted.** This phrasing discipline binds future edits: verdict language
lands on this page only when a published receipt carries it, and "being
built" flips to "built" as surfaces land (a one-word edit per the design).

**2. Structure (the 90-second order).** Masthead → hero (argument + status +
CTAs) → a three-sentence "Why 'Matrix'" aside — the page's single prose
metaphor spend: a matrix number names the master and cut a record was pressed
from; which pressing sounds better depends on the system; which architecture
fits depends on the page (design-voiced) → **the catalogue** (the gateway, at
scan position three) → **how the numbers stay honest** (four mechanisms, each
correctly attributed and receipt-linked: frozen snapshot → live manifest; one
ruler → `/_pm/measure.js`; URL = measurement condition → ADR-0004; held
constant by construction → canonical plane · frozen snapshot · drift gate) →
**your visit** (the live HUD) → built by → colophon.

**3. The signature: a deadwax disc etched from the committed manifest.** A
pure-CSS/SVG vinyl record, half out of its sleeve at the viewport's right
edge, whose runout-groove etch is **generated at build time from
`tools/snapshot-capture/crate/manifest.json`** — release count, freeze date,
`CUT f60385f`, source — and whose center-label catalogue number is the commit
SHA itself. The disc links to `/api/snapshot`, so the ornament dereferences
to the live receipt; the origin suite asserts the page's receipts equal the
committed manifest (a hand-typed SHA is how a wrong receipt ships — proven by
the panel catching exactly that). It rotates with scroll (compositor-only,
double-gated behind `@supports` and `prefers-reduced-motion`; Firefox gets a
still disc). It is `aria-hidden` decoration whose data also appears as
visible text, and it collapses to an outline under forced-colors. Provenance:
ADR-0006 explicitly reserved the deadwax-etch receipt motif (rejected
candidate "Runout") for instrument surfaces.

**4. The gateway model: a label catalogue that is honest about street
dates.** Six rows — Editorial, Product page, Search + filters, Checkout,
Accessibility, How it was built — each with a **catalogue number** (PM-001…;
matrix numbers belong to pressings/variants, catalogue numbers to a label's
listing — the metaphor spent on the right axis), one verdict-free tradeoff
line, and a status token: **In build · its dated public decision record**
(ADR-0005 2026-07-12 for Search + filters; ADR-0003 2026-07-06 for
Accessibility; the decision map otherwise). "How it was built" ships **Public
today**, linking the build log — so the catalogue demonstrates both token
states on day one instead of being 100% forthcoming. The only measured number
on the page rides its honest row: the fenced misapplication exhibit,
build-measured, +65.1 KB brotli vs +9.0 KB. Rows update one at a time as
surfaces land, with zero prose rewrites.

**5. The HUD carries the live half only.** Home renders the HUD in-page (the
`#pm-chrome` / `data-pm-hud-live` contract `measure.js` already reads),
loading the same pinned ruler from `/_pm/measure.js` — not a second
web-vitals copy. Beacons tag `variant=singleton`, `surface=home`. The lab
panel is omitted in favor of the plain sentence the chrome uses as its empty
state — no published runs yet — because no lab snapshot will ever exist for a
surface off the benchmarked matrix. The band closes with the falsifiability
line, placed next to the readout it refers to: *when a published number and
yours disagree, trust yours — then send me the URL.*

**6. Delivery: one round trip, canonical fonts, assets-first unchanged.** The
page stays on the front Worker's static assets (ADR-0004 §3; the spike-
verified assets-first behavior untouched — no injected chrome, and the
origin-suite contract for `/` updated accordingly). Its render-critical CSS —
the real `@pm/tokens` files plus the page's own composition — is **inlined at
build time from the package sources** (`@pm/tokens` is now a declared
dependency of `@pm/front`), so first paint costs one HTML round trip. This
deviates from the variants' linked-delivery shape deliberately: presentation
delivery is a *measured variable* for variants (ADR-0003 §2), and this
singleton is in no comparison — while **font loading keeps the canonical
ADR-0003 §8 markup verbatim** (preload + `fonts.css`, base path `/pm/`).
The only JavaScript is the shared ruler. Measured (2026-07-16, local
composed origin): wire cost ≈ 37.7 KB total — 10.5 KB HTML-with-CSS (brotli)
+ 1.0 KB fonts.css + 23.7 KB font + 2.5 KB measure.js; zero images. Lab
trace: LCP 70 ms desktop unthrottled / **654 ms on Slow-4G + 4× CPU**, CLS
0.00; Lighthouse 100 accessibility / 100 best-practices / 100 SEO.

**7. The instrument register, from existing primitives.** The disc and the
"Your visit" band use the dark end of the poured neutral scale
(`--pm-neutral-950`) — the compositional freedom ADR-0006 §1 reserved for
instrument surfaces, and the register candidate B was praised for. **No new
primitive was minted**; the page compositions reach shared primitives
directly, as the reference render's demo scaffolding already does. Three
precision notes (verification-lens findings, fixed pre-commit): the disc's
vinyl-surface tints **and all its paper/ink alphas** are `color-mix()`
derivations of the poured neutrals — no literal hex or rgba in the page CSS —
so a re-pour of the primitive tier moves the disc with it; the document-head
colors that cannot read custom properties (`theme-color`, the favicon) are
substituted at build from the real token file, same anti-drift rule as the
receipts; and the fluid type ramps are page-level `clamp()` compositions
anchored to the token scale (the hero floor dips just under `--pm-size-5` so
the headline balances at 320 px). On the
dark band, links and focus rings use paper-white primitives (the semantic
accent fails contrast on near-black); under forced-colors the semantic seam
handles everything else.

**8. Voice rules adopted from the panel, binding on this page:** no
self-assigned seniority (the bio reads "Frontend engineer at Discogs" — the
site argues the level so the bio doesn't have to); the 1,817-image count
stays off the page until `domain-cutover` records the Discogs-ToS call; the
pressing metaphor appears in exactly one prose location; "several" never
stands where a locked count exists.

## Considered alternatives

- **Present-tense hero ("built five ways") + status-line walk-back.** All six
  panel lenses called it the close-tab: to this audience a hero that
  overclaims and a footnote that retracts reads worse than the honest tense.
  Rejected.
- **Injected chrome for home (route `/` through the Worker script).** Would
  reuse the chrome renderer, but abandons the spike-verified assets-first
  behavior, adds Worker latency to the front door, and buys a lab panel that
  is meaningless off the matrix. Rejected for the in-page HUD (§5).
- **Linked CSS per the variants' canonical delivery shape.** Coherent, but
  the delivery contract exists to keep a *measured* surface fair; the
  singleton is unmeasured, and inlining removes a render-blocking round trip
  from the one page whose first impression carries the perf thesis. Rejected;
  fonts stay canonical (§6).
- **Matrix-style codes on the gateway rows.** The metaphor's wrong axis — a
  matrix number identifies a pressing (a variant), not a catalogue entry (a
  surface). Catalogue numbers instead (§4).
- **Featuring the placeholder variants as "see it working" links.** They are
  throwaway plumbing; the honest live receipts are the manifest, the ruler,
  and the public repo. Rejected.
- **Record-sleeve cover art as hero texture.** Open Discogs-ToS/attribution
  question (`domain-cutover` item e) and the wrong register for an evidence
  site; type, palette, and the CSS disc carry it. Rejected.
- **A "Faceplate"-style dark page.** ADR-0006 ships one canonical warm-paper
  theme; the dark register is spent narrowly on the instrument elements
  where that ADR reserved it (§7). Rejected as the page ground.

## Consequences

- `workers/front` composes the page at build: `home/index.html` +
  `home/home.css`, manifest-field substitution, tokens/button CSS inlined,
  `/pm/css/fonts.css` + `/pm/fonts/*` copied for the canonical font markup;
  the throwaway `public/index.html` is retired. `@pm/front` now depends on
  `@pm/tokens`, and the front build reads the committed crate manifest — a
  new, deliberate CI-time dependency on `tools/snapshot-capture/crate/manifest.json`
  (manifest only; CI still never reads the crate's trays or images).
- Origin-suite contract for `/` updated: home marker + own-HUD present,
  injected-chrome markers absent, **on-page receipts must equal the committed
  crate manifest** (asserted against home's build source; on the deployed
  plane, snapshot resolution separately proves served == committed).
- Home RUM lands in the collector tagged `singleton`/`home` — field data for
  the front door, structurally excluded from any variant comparison.
- The copy's tense and the catalogue's status tokens are designed to flip
  row-by-row as surfaces land; the C2 discipline (no verdict without a
  published receipt) binds future edits of this page.
- `domain-cutover`'s remaining prerequisite (`home-surface`) is satisfied —
  it can now be ticketed on its own merits.
- The copy deck, six-lens panel findings, and this page's build narrative are
  "How it was built" source material (build-log Phase 7).
