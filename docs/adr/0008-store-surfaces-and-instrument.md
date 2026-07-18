---
status: accepted
date: 2026-07-17
ticket: surface-design
---

# Store surfaces + the instrument — the canonical spec layer

## Context

Every store surface was fog until this session: the decision map's sparse
matrix named seven surfaces and one tradeoff each, but no markup contract,
no surface CSS, no reference render, and a chrome that ADR-0004 §7 shipped
as a functional stub. This ADR records the design of the spec layer the
per-paradigm variant builds will consume: per-surface canonical markup
contracts, per-component CSS modules, framework-free reference renders (the
drift-gate golden masters), and the full chrome — the contextual switcher
and the HUD instrument.

Two kill conditions bound every choice (the session brief): a hostile
engineer must never be able to say "of course it's slow — look how this
page is engineered" (image slots sized from data, zero CLS by construction,
no interaction pattern that demands main-thread abuse); and no component may
quietly bias a paradigm — everything must be expressible idiomatically in
vanilla, React, Astro, Qwik, and HTMX with byte-identical DOM (ADR-0003 §1),
precisely: identical modulo the per-variant, audited noise registry
(`PERMITTED_NOISE`), where behavior attributes (`hx-*`, `on:*`, `q:*`) are a
declared registry class of their own, distinct from inert residue.

Method: structure and copy were drafted first
([`docs/prototypes/surface-design/DRAFT.md`](../prototypes/surface-design/DRAFT.md)),
then attacked by a seven-lens adversarial panel (hostile staff engineer,
zero-bias auditor, a11y auditor, voice cop, ADR fact-checker, design critic,
seams editor — 78 findings: 12 kill, 43 discount; raw output committed
alongside). Three lenses independently caught the same hand-typed wrong
statistic in the draft, re-proving the ADR-0007 rule on its own author;
every number in this record is tool-derived. Designs were then built as real
renders against the real crate and screenshot-critiqued (the
`aesthetic-direction` boards method); the board captures live in
`docs/prototypes/surface-design/boards/`.

## Decision

**1. The instrument is a bench strip: a fixed-height dark band on every
measured page, expanding to a console panel.** The chrome extends home's
deadwax register (ADR-0006 §1 reserved the site's personality for exactly
this) to every surface as a compact strip above the masthead — in-flow,
server-injected, one line — whose expansion is a native `<details>` opening
an OVERLAY panel (occludes, never reflows). The strip is **geometrically
inert**: fixed block-size, fixed-width live-value slots, so neither the
streamed vitals nor the font swap can move a pixel — the instrument must
never manufacture the CLS it reports (panel kill). Landmarks: outer
`<aside id="pm-chrome">`, `<nav>` scoped to the switcher row only; the
summary's accessible name is "Instrument — lab readings and your visit".
Below the mobile breakpoint the switcher row SCROLLS inside the fixed bar
(hiding the anchors would make variant switching unreachable to mobile,
keyboard, and AT users — verify-slice corrected the draft's hide-and-count
mobile contract); one line at 320 px is asserted in the origin suite.

**2. The etch grammar is the signature — and the named aesthetic risk.**
Variant cells are set in the deadwax etch voice home established: uppercase,
letterspaced, interpunct-separated, hairline rules, radius-0, no boxes; the
current cell carries an etched underline and `aria-current="page"`. The
receipt/metric voice is a **chrome-owned mono** — "PM Instrument Mono", a
~12 KB Basic-Latin subset of JetBrains Mono (OFL, provenance in
`packages/switcher/fonts/README.md`) served from `/_pm/fonts/` on the
excluded instrumentation path. `--pm-font-metric` is untouched: pouring a
mono into the metric slot would change every store price and re-litigate the
Catalogue pick (ADR-0006 §3 "one face for UI and metrics"); ADR-0006's
alternatives note left exactly this route open ("Its receipt/mono language
remains reachable later through the `--pm-font-metric` slot and chrome CSS
without touching a component"). **The risk, stated:** a permanent dark mono
strip is the most imitable element in the system — it stands or falls on
the matrix-number/etch signature; cut that move and the hero of this design
is the one AI-default in an otherwise proprietary system.

**3. The reading: the comparison is the interface, and C2 is structural.**
The panel's lab table sets columns to the surface's comparison axis — data
strategies on the PLP (fenced exhibits never get a column, ADR-0005 §7),
variants elsewhere — under the selected profile, whose selector sits beside
the table labeled for what it is (a snapshot selector that "never
re-throttles this page", ADR-0004 §6). `SurfaceControls` grows
**`plannedVariants`**: unbuilt matrix cells render as dead, labeled
"not built yet" column headers — a disclosure, not an offer, so sparse
honesty holds and an unregistered matrix surface can never mislabel as
"singleton surface" (panel finding). A lab value physically cannot render
without its receipt: the renderer takes a `PublishedReading` whose
`LabReceipt` (profile · date · commit · location · URL) is a required field
(`packages/switcher/src/lab.ts`); published bundles are committed artifacts
built into the front Worker's dist at `/_pm/lab/{surface}.json` (owner:
workers/front). Until the first publication every cell is an em-dash and
the empty state reads: *"No published runs yet. When a number lands here it
carries its receipt — profile, date, commit, location — or it doesn't land
at all."* The fit line renders only from a receipt bundle whose bands don't
overlap (ADR-0001 addendum C); its empty states are designed copy.
**Singleton surfaces get no lab table at all** — ADR-0007 §5's plain
sentence instead (no lab snapshot will ever exist off the matrix).

**4. Panel order and voice are pinned.** Sections: **This surface** (the
solo-first orientation line, first — panel a11y finding) **· The reading ·
Fit · Your visit · The condition · Controls**. Self-explanation lines live
in the config; any count in them renders from the config's own arrays,
never typed. "Your visit" reuses home's explanation and falsifiability
lines verbatim; "The condition" decomposes the URL (variant · surface · n ·
cache · profile · served-from · a link to `/api/snapshot`) — the chrome
renders no snapshot SHA of its own because a sync renderer cannot know the
served snapshot; the manifest link dereferences to the receipt instead.
The PLP's Controls carry the `n` knob, the fenced-exhibit anchor with its
exclusion line, and the per-interaction readout + replay slots with honest
empty states ("lands with the store's PLP build") — the wiring belongs to
the PLP build with its interaction registry. Checkout's contextual controls
collapse, deliberately, to profile-foregrounding: the device/CPU axis IS
the lab profile system; a live CPU knob would fake slowness at a visitor
(ADR-0004 §6). The fenced "feel the difference" demo remains the checkout
build's option. **A11y-mode toggles move in-page — an explicit ADR-0004 §7
amendment**: toggles are page presentation state, and the emulation-honesty
caveat must sit beside the demo. (Rejected: mode as query-param anchors —
emulation state is not a measurement condition and would pollute
URL-as-receipt.)

**5. Chrome delivery: head-injected CSS, budgeted fragment, audited dark
ground.** The front Worker head-appends the chrome stylesheet link and the
mono preload (an in-body stylesheet at the top of every measured page either
blocks paint or flashes unstyled — panel finding); the fragment in the slot
is pure markup ending with the single deferred `measure.js` script.
`measure.js` updates ALL matching live slots (`querySelectorAll` — the bar
mini and the panel both carry hooks). The fragment has a **byte budget**
(12 KiB, asserted in the switcher tests; measured 8.4 KiB empty, headroom
for populated readings) and the ADR-0001 addendum-F obligation binds: the
with/without-chrome cost constant is re-measured after this redesign,
before any publication. Chrome colors are `color-mix()` derivations of the
poured neutrals (no literal hex; a re-pour moves the instrument), and the
dark-ground pairs are **audited by derivation**:
`tools/repo-checks/test/chrome-contrast.test.ts` re-derives the actual
mixes from chrome.css and asserts 4.5:1 text / 3:1 focus — because the
store's own defaults demonstrably fail there (muted 3.02:1, accent 2.71:1
on neutral-950; the semantic accent is never used as ink on the strip).

**6. The store shell: one fiction, stated plainly.** Brand: **"Long Decay
Records"** — scene-true for the crate (the music is built from long
decays), fictional, and deliberately not "Matrix Records": that name
inverts ADR-0007 §4's metaphor axis (matrix numbers name pressings/
variants; a store is the label side), blurs specimen and bench, and is the
least believable name available (panel kill, three lenses). The chrome
alone carries Project Matrix identity; the connection is the strip sitting
above the masthead. Shell skeleton (canonical): skip link FIRST, then the
chrome slot, then `.pm-page` (masthead · main · a `role="status"` live
region · footer). The footer states the fiction: *"A working store on
frozen Discogs data — nothing ships, checkout is simulated."*
**Cross-surface links are absolute, to each surface's designated host
variant** (masthead nav, card titles, cart → `/vanilla/checkout/`,
Records → `/react-next/plp/plain/`): the sparse matrix means same-variant
links 404 where a variant lacks the surface, and a Worker redirect would
silently swap the variant under a URL-as-receipt (both rejected). CTA
vocabulary: **"Add to cart"** — "Add to crate" would fork CONTEXT.md's
reserved noun.

**7. The cart contract: the canonical served state is empty.** Cart is
`localStorage` (ADR-0004 §5), so no paradigm can serve cart contents; the
golden masters pin the EMPTY state (masthead count slot vacant at fixed
width, order-summary region with designed empty copy and reserved
min-height), population is per-paradigm client enhancement announced
through the shell's status slot (WCAG 4.1.3), and populated-cart divergence
is policed when a JS-on gate pass exists. Checkout's invalid-submit
contract: the error-summary region (heading + links to each invalid field)
renders and RECEIVES FOCUS — identical DOM + focus work in every paradigm,
so the flagship INP comparison compares like work (WCAG 3.3.1/4.1.3; panel
kill). JS-off statements ship on-page (checkout: fields and native
validation work; placing the order is the JavaScript moment — the
comparison, stated).

**8. Surface structure, one tradeoff each** (contracts of record:
`packages/reference/render/*.mjs`; compositions:
`packages/tokens/css/surfaces/`):
- **Editorial** — prose (~65ch, `pm-prose`) + exactly one interaction (the
  featured release's Add to cart). The essay is committed content with an
  explicit carve-out: prose narrates crate facts allusively ("north of five
  hundred dollars"); every precise number interpolates tray/manifest fields
  through the renderer; the dateline IS the freeze date. Per-snapshot
  essays (the fixture's synthetic register gets a synthetic essay,
  structurally identical).
- **PDP** — gallery mat | buy panel. The stage is a fixed 1:1 mat with
  `object-fit: contain` (296/500 covers exactly square, 456/500 within 2%;
  letterboxing IS the mat-board; a fixed frame means image switching can
  never shift the buy panel; per-release frames rejected — a 2:1-first
  PDP would letterbox every square thumb). Degenerate states are contract:
  single-format (439/500) renders a static meta line, no radio; unpriced
  (44/500) renders em-dash + "none for sale" + disabled CTA. Thumbs are
  buttons named "View image N of M: {alt}", selected = `aria-current`;
  fieldset/legend on the format radios; named qty steppers. The
  live-origin demonstration is a fenced plaque with ADR-0002 §3's copy.
  Reference PDP: id 896191 (3 formats, priced, 5 images — the rich path).
- **PLP** — toolbar (count from the tray, search + sort as GET forms) ·
  facet rail (plain links carrying the canonical `?genre/style/format/
  sort/q` params — the edge Worker grows them in the PLP build, ADR-0005
  §5; display cut stated in the group titles, never silent) · the grid ·
  pagination preserving the whole condition. Image loading pinned: first 4
  cards eager, card 1 `fetchpriority="high"`, rest lazy (a "first row" rule
  is unimplementable in static markup — the fixed count trades slight
  mobile over-fetch for correct desktop LCP).
- **Checkout** — single-page form (contact · address · shipping method ·
  payment · summary), every field with label/autocomplete/inputmode, the
  base-plaque disclosure BEFORE the card fields, scoped honestly:
  *"…what you type never leaves your browser — this page sends only the
  same anonymous timing beacons every page sends."* (An absolute "nothing
  leaves this page" would be falsified by the beacon in devtools.) The
  notice is NOT fenced — checkout is measured; `--fenced` is reserved for
  true number-exclusions (Remix 3, Apollo exhibit, live-origin, a11y
  DS-OFF).
- **A11y section** (vanilla singleton, three pages) — index + element
  demos (five two-box compares; the DS-OFF twin sits inside a collapsed
  `<details>`, natively unfocusable and hidden from AT until deliberately
  opened — the default page state is fully conformant) + mode demos
  (additive-only emulations gated behind the real media queries, with the
  keepable caveat: *"your OS setting is the real thing — these demos never
  override it"*). Element-demos is `noindex` (strategy-review finding 21).
- **How it was built** — front-Worker static singleton at
  `/how-it-was-built/` (the home build precedent; owner workers/front),
  a `pm-doc` TOC + prose layout whose content is generated from `docs/`
  (the master renders the real ADR index and build-log phases at build —
  never retyped).

**9. Reference renders are BUILT, and the fixture is adversarial.** Golden
masters render from tray JSON via the framework-free renderer
(`packages/reference/render/`): committed masters are the fixture-rendered
output (regeneration-asserted so they cannot go stale); the crate renders
are local board builds (`.local/`, git-excluded — crate image bytes are not
in git); extending the deployed smoke to re-render masters from the RESOLVED
snapshot (the issue-#11 pattern) is an owned obligation of the first
variant build that serves a content surface — today's masters-health leg
proves fixture-equivalence only (verify-slice kept this claim honest). The gate's static server grows an `/assets/img/*` alias. The
FIXTURE became branch-covering by construction (panel kill: the gate only
ever proves fixture-equivalence, so the fixture must contain every
rendering branch the crate does): non-square covers, 1- and 5-image
galleries, a ≥1 h duration (crate max 3,816 s) and null durations,
multi-format, unpriced, multiple genres, `33 ⅓ RPM` / `℗` strings
(exercising the crate-symbols face in CI), and a `curation.json` with a
featured id. The crate's featured picks are design constants
(editorial 953800, PDP 896191) — curated choices, like the crate itself,
not receipts.

**10. crate-glyph-coverage, decided** (the open ticket closes): ship
**"PM Crate Symbols"** — a 9-codepoint Inter subset (⅓ ℗ ˙ π ρ φ Я ∂ √;
3.8 KB; same source family and OFL as the warn glyph), `unicode-range`-
scoped behind Familjen in both stacks, preloaded in the canonical font
markup (⅓ is first-paint content on the PLP meta line; a late swap is a
layout-shift risk; PMWarnGlyph stays unpreloaded — error-state only). The
remaining **21 codepoints stay on a documented per-OS system fallback**:
Arabic ×8 (subsetting isolated forms breaks shaping — worse than an honest
fallback), CJK ×9 (Han-unification variant choice is a locale call a single
webfont gets wrong for someone), and ∇ ∝ ⋅ ﬂ at exactly one occurrence
each. Recorded in `coverage.json` as `crateSystemFallback` (renamed from
"deferred" — this is a decision, not a deferral) and **guard-hardened**:
repo-checks now re-derives each font's cmap from the woff2 bytes (fontkit),
so the manifest can no longer be hand-faked (the anti-rigging note carried
on the ticket).

**11. Issue #9 derivative sizing, settled with receipts.** The retained
originals were scanned (sips, n=1,838 — the receipt is committed at
[`prototypes/surface-design/originals-scan.json`](../prototypes/surface-design/originals-scan.json),
including why 1,838 originals back 1,817 served derivatives): **zero exceed
600 px on either side** — 600 is the upstream ceiling, so the single 600 px tier is correct
by data for the card (~250–300 CSS px ≈ the exact 2× asset) and the PDP
stage (2× would want pixels that don't exist). One new tier IS minted: the
**160 px thumb** (`{src}.thumb.avif` by URL convention — the frozen trays
are untouched), because 600 px files in 72 px thumb slots cost ~100 KB per
PDP for nothing (panel finding); 1,817 thumbs generated from the retained
originals through the derive phase built for exactly this re-derivation,
indexed with chained sha256s, ~2.2 KB each. Card media gains
`object-fit: cover` — 204/500 primaries are non-square and the forced 1:1
box was silently distorting them (the card had only ever been proven on
square placeholders).

**12. The semantic tier grew with the surfaces** — `--space-block`,
`--space-section`, `--text-caption`, `--text-headline` — because the new
modules needed vocabulary that only existed as primitives, and components
consume semantic tokens only (ADR-0003 §3; the structure test now also
covers `css/surfaces/`). Fifteen component modules joined (masthead,
footer, prose, plaque, gallery, format-switch, qty, tracklist, facets,
toolbar, pagination, cart-summary, error-summary, compare, mode-demo) and
seven surface compositions; every module keeps state off native attributes
and passes the semantic-only guard. `role="list"` joined the `pm-grid`
contract everywhere (Safari/VoiceOver strips list semantics under
`list-style: none` — home's lesson, retrofitted to the sample surface and
both placeholders in the same change).

## What a variant may vary (normative — the serialization freedoms)

The drift gate's normalizer grants exactly these; everything else must
match the master byte-for-byte after parsing:

- attribute ORDER and class-token ORDER are free (both are sorted before
  comparison); whitespace runs collapse (NBSP compares verbatim);
- comment nodes, `script`/`style`/`link`/`template` elements, and the
  `<head>` subtree are delivery, not contract (but `<html>`/`<body>` own
  attributes ARE contract);
- paradigm noise must be REGISTERED per variant in `PERMITTED_NOISE`
  (hydration markers, scoping hashes) — and behavior attributes (`hx-*`,
  `on:*`, `q:*`) get their own declared registry class when those variants
  land: they are the paradigm's mechanism, not residue, and the registry is
  part of the published diff-to-starter story (ADR-0003 2026-07-12
  addendum);
- the chrome slot subtree is instrumentation and is dropped before both
  DOM and pixel comparison; the gate sees the JS-off SERVED document only —
  which is why every cart-bound region's canonical state is empty (§7);
- `packages/reference/surfaces/{surface}/` is each surface's spec of
  record; registration of a variant in `SURFACE_CONTROLS` is part of that
  variant build's definition of done, and the origin suite asserts the
  serving variant is marked `aria-current` in its own chrome.

## Considered alternatives

- **Light strip / paper chrome.** Rejected: a paper link-row above the
  paper masthead reads as store navigation — the register blur the
  two-register system exists to prevent; the personality budget ADR-0006 §1
  reserved would go unspent (panel: the always-dark strip survived attack).
- **Fixed bottom dock / side rail for the chrome.** Rejected: an
  out-of-flow overlay occludes store content at page end (and chrome.css
  must not restyle `body` to compensate); a side rail dies on mobile.
- **Push-down panel (in-flow expansion).** Refined to the overlay during
  build: opening in-flow reflows the whole store under the reader; the
  overlay occludes without moving anything, and `<details>` still carries
  it JS-off.
- **Pouring the mono into `--pm-font-metric`.** Rejected (§2): changes
  every store price, re-litigates the Catalogue pick, and drags the store
  register toward the instrument's.
- **"Matrix Records" as the store brand.** Rejected (§6) — three lenses,
  same verdict: wrong metaphor axis, specimen/bench blur, least believable
  name available.
- **Worker 307 for unbuilt variant×surface cells; relative cross-surface
  links.** Both rejected (§6): the first silently swaps the variant under a
  URL-as-receipt; the second 404s on sparse cells.
- **Per-release gallery frames (aspect from the first image).** Rejected
  (§8): removes letterboxing from 18 LCP images at the cost of letterboxing
  every square thumb on non-square-first pages and per-page geometry drift;
  the uniform mat wins.
- **Minting no thumb tier** (reusing 600 px files with `fetchpriority=
  low`). Rejected (§11): ~100 KB per PDP into 72 px slots is exactly the
  "look how this page is engineered" quote; the derive phase was built for
  this re-derivation.
- **Display strings in the frozen trays** (killing the per-paradigm
  formatting surface). Rejected: violates ADR-0002 §6's data-not-UI
  guardrail; the branch-covering fixture covers the same risk without
  re-freezing.
- **Webfonts for the crate's Arabic/CJK.** Rejected (§10): isolated-form
  Arabic subsets break shaping; Han-unification needs locale awareness a
  single webfont lacks; per-OS fallback for out-of-repertoire scripts is
  what real production sites do — real-world fidelity.
- **Order numbers, mode toggles in chrome, "Add to crate", checkout plaque
  as `--fenced`, per-cell SR text in the reading table** — each rejected
  for the reasons recorded in the panel revisions (DRAFT §6).

## Consequences

- **The variant builds are unblocked** and consume: the masters as spec,
  the serialization freedoms above, the SURFACE_CONTROLS registration duty,
  the designated-host link map, the cart/error contracts, and the published
  interaction-registry ids — `checkout-type-card`, `checkout-submit-invalid`,
  `checkout-fix-and-submit` (owner tools/bench-runner; the ADR-0005 §3 PLP
  ids stand unchanged).
- **Merge prerequisite (one manual step):** the 1,817 thumb derivatives
  exist only on the capture machine (crate image bytes are deliberately not
  in git, so CI cannot seed them) — before this branch merges, run the
  manual crate re-seed from workers/edge:
  `node seed-local.mjs --remote --dir ../../tools/snapshot-capture/crate`
  (idempotent puts; adds the thumbs the committed images-index now names).
  Without it the post-deploy smoke's image sample goes red on the thumb
  entries.
- **Obligations bound to the first benchmark publication:** re-measure the
  ADR-0001 addendum-F chrome constant against the redesigned strip; run the
  drift gate against a crate-serving plane before any published verdict
  (CI proves fixture-equivalence; the deployed smoke proves the crate).
- **The chrome's populated future is owned:** `/_pm/lab/{surface}.json`
  bundles (workers/front) render into the typed receipt slots; the fit
  line's three states are already written.
- **Home deliberately keeps its ADR-0007 band** (a designed destination);
  the strip shares the receipt grammar, not the anatomy — divergence is
  intent, recorded here.
- **`domain-cutover` item (e) sharpens:** the reference renders and boards
  now display crate cover art through the store surfaces; the ToS/
  attribution call covers them the same way it covers the PLP/PDP.
- The DRAFT, panel findings, and board captures under
  `docs/prototypes/surface-design/` are the exploration record and
  "How it was built" source material.
