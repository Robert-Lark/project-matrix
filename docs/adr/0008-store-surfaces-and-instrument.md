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
  fieldset/legend on the format radios; named qty steppers.
  > **PARTLY SUPERSEDED — see addendum A (2026-08-15).** The format radios are
  > CUT: `formats` is the composition of one release, not a menu, so the group
  > offered a choice the data cannot honour. Every release now renders a
  > `<dt>Format</dt>` pair carrying the full composition, and the em-dash
  > states are NAMED (`lib.mjs` namedGlyph) rather than bare. The rest of this
  > paragraph stands. The
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

## Addendum — the fragment budget, re-set against a real populated state (2026-08-14)

§5 set the chrome fragment's byte budget at **12 KiB**, measured 8.4 KiB
empty "with headroom for populated readings (a receipt adds ~100 bytes per
cell)". The first editorial publication turned that estimate into a
measurement, and the estimate was low: a populated editorial fragment
carries 30 receipt-linked cells **plus** the min–max band ADR-0001
addendum C requires in each — and the largest real fragment (the remix3
exhibit's, whose fenced note and tagged cell are extra) measured **12,396
bytes**, over budget.

Two changes, both recorded rather than one silently absorbed:

1. **Zero-width bands are omitted.** A band whose min equals its max states
   only what the median already stated. Dropping them removed 7 of 30 on
   this surface and 306 bytes; the band element is also `<small>` rather
   than `<span>` — the element for fine print qualifying an adjacent value,
   and 11 bytes cheaper per cell.
2. **The budget is now 13 KiB** (13,312 bytes), which leaves the largest
   real fragment ~1.2 KiB of headroom instead of the 5 bytes the 12 KiB
   number left after bands landed. The raise is bounded and cheap by
   measurement, not by assertion: the fragment's cost **on the wire** is
   1,913 bytes brotli (ADR-0001 addendum N, measured against the deployed
   plane; the 1,908 B this cited was the superseded local figure), and the
   chrome's measured
   timing cost is dominated by its subresources — a render-blocking
   stylesheet, a preloaded mono, and the ruler — not by the fragment's own
   markup. The budget's purpose is to catch creep, and it still does; it
   should not force markup golf against a number chosen before the
   populated state existed.

The obligation §5 attaches to the budget is unchanged: the chrome's
runtime cost is re-measured before publication (ADR-0001 addendum F/L),
and that measurement now runs against the POPULATED chrome by mechanism —
the front build refuses a constant measured against any other.

## Addendum — the PDP master set, and a qty stepper the panel missed (2026-08-14)

The PDP build consumed §8's PDP paragraph as spec and found two things the
spec layer owed it. Both are recorded here rather than improvised in a
variant, because §8 owns the masters and four variants were about to copy
whatever the master said.

**1. The qty steppers' glyphs are now `aria-hidden`.** §8 requires "named qty
steppers", and `render/pdp.mjs` named them with a visually-hidden span — but
left the `−` / `+` glyphs as bare text nodes, so the accessible names computed
to "−Decrease quantity" and "+Increase quantity". Two lines above, the
tracklist header hides its own `#` glyph exactly the way this needed
(`<span aria-hidden="true">#</span>`), so the master was internally
inconsistent about the same technique. Fixed in the master before the first
variant copied it; the four committed PDP masters carry it.

**2. The PDP renders FOUR masters, not one — the degenerate branches CAN now
be gated.** (Heading corrected 2026-08-14: it read "are gated", which is an
overclaim. Rendering four masters is a NECESSARY PRECONDITION for gating, not
gating. No origin-suite leg opens `/{variant}/pdp/…` at all today, so no
variant is yet compared against any PDP master; those legs land with the first
variant PDP. The three nested masters were also missing from the master-health
list in `drift.browser.test.ts`, so until this correction they received no
normalizer-determinism or pixel-stability coverage either.) §8 made the
degenerate states contract ("single-format renders a
static meta line, no radio; unpriced renders em-dash + 'none for sale' +
disabled CTA") and §9 made the fixture branch-covering, but `render/build.mjs`
rendered exactly ONE PDP, from the featured id — the rich path. Since the
drift gate only ever compares a variant against a MASTER, all three degenerate
arms were ungated by construction, and they are the COMMON path: 439/500
single-format, 44/500 unpriced, 90/500 one-image in the crate.

The master set is now `pdp/` (rich) plus `pdp/single-format/`, `pdp/unpriced/`
and `pdp/one-image/`, nested under the one surface rather than becoming
sibling surfaces (SURFACE_CONTROLS keys off surfaces; there is one PDP surface
with four rendered states). Which release each renders is derived by
`render/lib.mjs` `pdpMasterIds` — ONE derivation, consumed today by the
reference build; the variant builds and the gate's re-render adopt it as their
PDP legs land (corrected 2026-08-14 from "shared by the reference build, every
variant build and the gate's re-render", which described the intent rather
than the wiring). The `resolvedPathSegments` lesson is the reason to have one
derivation at all.

Each degenerate master **isolates one branch**: it holds the other two axes at
the SINGLE-FORMAT master's value, so the set is a STAR centred on
single-format — each degenerate master differs from that centre by exactly one
rendering decision (ADR-0001 §4's one-variable-at-a-time rule, applied to the
gate). Corrected 2026-08-14: this previously said "any two masters differ by
exactly one rendering decision", which is false for 3 of the 6 pairs — `rich`
is multi-format and every degenerate pick is single, so `rich`↔`unpriced`,
`rich`↔`one-image` and `unpriced`↔`one-image` each differ by two axes. The
test asserted the true (star) property all along; only the prose overclaimed.

The first draft did not isolate at all, and the flaw was concrete rather than
theoretical — picking "lowest id exhibiting the branch" resolved
`single-format` and `unpriced` to the *same* release in the fixture (9000001
is both), which would have gated the two branches only together and neither
apart. `pdpMasterIds` now refuses a duplicate set outright, and (2026-08-14)
enforces the star property in the derivation itself: the `unpriced` and
`one-image` predicates pin `formats.length <= 1`, and the function throws
unless each degenerate class differs from the centre on exactly one axis.
Before that, isolation held only because 439/500 crate and 239/240 fixture
releases happen to be single-format — a property of the data, not the code.
Both snapshots resolve the same ids with or without the clause, so the
committed masters are byte-unchanged.

What is asserted, and what deliberately is not: per-axis coverage with
isolation IS asserted (`packages/reference/test/reference.test.ts`, sabotage
-proven), for both snapshots. Full *combination* coverage is NOT — three
binary axes span **8** combinations, of which the crate populates **7** and
the fixture **4**, against a master set of 4 — and claiming it would be the
record-not-code class this chain keeps paying for. (Corrected 2026-08-14 from
"the crate has 16 combinations", which was derivable from nothing; the counts
are now derived in the test rather than typed. The three combinations the
crate has and the masters do not are multi/priced/one-image (6 releases),
multi/unpriced/gallery (2) and single/unpriced/one-image (10).)

Also NOT gated, and named here rather than left implied: `render/pdp.mjs`
takes three further branches that `pdpRenderClass` does not model — an absent
notes section, a null track duration, a null year. **0 of the 4 fixture
masters take any of those arms**, so no master gates them. Closing that gap
means widening the class and the master set; until then the guard proves
per-axis coverage of the three STRUCTURAL branches only. The `priceFrom == null ⟺
numForSale === 0` equivalence that `pdp.mjs` leans on (it reads two different
fields for one branch) is asserted against the trays themselves: zero
violations in both committed snapshots.

## Addendum A — a control that cannot act does not ship (2026-08-15)

_Cited in code as "ADR-0008 addendum A". The two addenda above are unlettered;
lettering starts here so a comment can point at one claim, which is the
practice ADR-0001 already follows._

The vanilla PDP shipped to ~500 deployed pages with **two of its four
advertised interactions dead**, and a third control styled by nothing. None of
it was a coding slip: each was a place where the spec layer described a
behaviour and nothing in the repo could tell whether the behaviour existed.

**The rule this addendum adds, normative for every surface:** a control the
markup advertises must be able to do what it says, or it must not be in the
markup. Shipping it inert is not a third option — it is the "falsely
interactive" state ADR-0008 §7 already disclaims, and on a benchmarked surface
it also silently zeroes the same cell in every paradigm at once.

### 1. Zoom — WIRED

`render/pdp.mjs` rendered `<button class="pm-gallery__zoom" aria-pressed="false">`
and `gallery.css` implemented the pressed state, but `variants/vanilla/src/pdp.js`
never referenced it (`grep -c zoom` → 0) and `aria-pressed` is not CSS-settable.
A JS-on visitor heard "Zoom, toggle button, not pressed", pressed it, and got
the same result forever — **WCAG 4.1.2 name/role/value**, on the site that
ships an accessibility exhibit. The enhancement now writes the attribute and
nothing else; the attribute is both the accessible state and the selector the
stylesheet scales from, so a visual state cannot exist without the
programmatic one. **Every paradigm owes this toggle**, and `gallery.css`'s
contract comment now says so.

### 2. The format radio group — CUT, not wired

This reverses the recommendation the unit was handed ("take the cut for zoom,
never for format"), on evidence that recommendation did not have. It is the
load-bearing decision of the unit, so the argument is recorded in full.

**A Discogs `formats` array is the composition of ONE physical release — what
is in the package — not a menu of things to buy.** From this repo's own
sources:

- `packages/data-contract/src/schema.ts:45` types `format` as the *primary*
  format label, and `tools/snapshot-capture/src/normalize.ts:127` builds it
  from `formats[0]`: there is a primary component and there are others.
- `schema.ts:47-48` carries exactly one `priceFrom` and one `numForSale` **per
  release**. No component has a price, a stock count, or a cart identity of its
  own, anywhere in the contract.
- Crate release `896191` is one **$30.00** product whose three `formats`
  entries are two vinyl variants **and** a CD. **39** crate releases carry a
  component literally named **"All Media"** — Discogs' marker for a release
  spanning several media as one product. (Counts tool-derived from
  `tools/snapshot-capture/crate/details.json`.)

So the group offered a choice the data cannot honour. Wiring it as specified —
price, stock line, meta list and cart payload following the selection — was
not a bigger version of the zoom fix; it was **impossible without inventing
per-format prices**, on a site whose first rule is that nothing publishes a
number without a receipt. A fabricated price beside a real one is worse than a
dead control, and it is the exact shape of rigging this project exists to be
unable to do.

The counter-argument, answered: cutting it does **not** gut the PDP's claim to
be the surface where interactivity is genuine. What remains is gallery switch,
zoom, the quantity stepper and add-to-cart — four genuine interactions, and
both of the surface's PLANNED interactions (`pdp-gallery-switch`,
`pdp-add-to-cart`) are untouched. "Planned", not "registered", and the
distinction is the kind this record exists to keep: `INTERACTIONS`
(`collect.ts:26`) holds `none`, `body-click` and `editorial-add-to-cart` and
nothing else — NEITHER PDP id appears anywhere in the codebase yet, so the cut
removed nothing the instrument was going to measure.

**Nothing is lost from the page but the lie.** The `formats` data now renders
as data: the meta list carries the full composition (`lib.mjs`
`formatComposition`) for **every** release, where before only single-format
releases showed a format at all — so the 61 multi-format crate releases gain
information they never had, and the 130 single-format releases whose tray
records a quantity now show it ("2 × Vinyl, LP, Album"). For a single
component of quantity 1 the composition reproduces `format` byte-for-byte,
so **309 of the crate's 500 PDP meta lines are byte-unchanged and 191 move**
(239/1 in the fixture) — derived by rendering both forms over every tray, not
reasoned. That equality is asserted, not assumed
(`tools/repo-checks/test/variant-master-identity.test.ts`).

**ADR-0002's propagated guardrail is amended here**, not silently dropped: the
interaction set the render-axis flip is measured over is now **gallery/zoom,
add-to-cart with client cart state, and quantity**. The guardrail named format
switch at planning time, before anyone had looked at what `formats` contains.

`format-switch.css` is unchanged and still ships — its surviving consumer is
**checkout's shipping-method group**, which is a real choice. The component
was never the defect; the PDP's application of it was. The PDP no longer links
the sheet.

### 3. `pm-pdp__scroll` — STYLED

`pdp.mjs` emitted `role="region" tabindex="0"` (the scrollable-region pattern)
and the class matched **0 lines** across `packages/tokens/css/`. Every PDP page
with a tracklist gave keyboard users a focus stop on a container that could
not scroll, and the WCAG 1.4.10 reflow protection the wrapper exists for was
absent. `pdp.css` now gives it `overflow-x: auto`.

### 3b. The thumb strip — WRAPPED (found by the guard, on real data)

The JS-ON leg above was written to check the tracklist wrapper and instead
failed on something bigger, and only against a **crate-seeded** plane. The
gallery's thumb strip was a flex row with no wrap: it can never be narrower
than its content, and because a grid item's default `min-width` is `auto`, the
gallery column grew to match and pushed the **document** into horizontal
scrolling. Four thumbs at 72 px plus gaps need 312 px inside a 280 px column.

**316 of the crate's 500 releases carry four or more images** (1–5 images:
90 / 64 / 30 / 71 / 245, tool-derived), so this was live WCAG 1.4.10 on the
majority of deployed PDP pages. It survived every check because the FIXTURE's
probe release has **two** images — CI never reached the case. `gallery.css`
now sets `flex-wrap: wrap`; measured before and after at 320 px, the document's
`scrollWidth` goes 332 → 320 for a 4-image release and 412 → 320 for a
5-image one, with thumbs on two rows. Wrapping rather than scrolling, because a
scroll container would need its own focus stop and the 72 px target size
(WCAG 2.5.8) has to survive either way.

The reflow leg now probes the **widest gallery in the served snapshot** rather
than any gallery, and fails closed if that is under four images — the fixture's
release 9000016 has five, so CI exercises the case from now on. Two lessons
are worth keeping: a leg pointed at "some release with a gallery" proved
nothing, and **the fixture is not a scale model of the crate**.

### 4. The guards, and why two were needed

The defects were invisible because of a structural gap, not bad luck:

- **The drift gate is JS-OFF by construction** (ADR-0008 §7). Both dead
  controls had correct, identical, gate-passing markup the entire time.
- **`@pm/vanilla` contributes ZERO tasks to turbo's 30** (`turbo run lint
  typecheck test --dry=json` → 75 nodes, 30 with a real command, none of them
  this workspace), and no test anywhere read `renderPdpPage`. "Turbo 30/30"
  had never covered this variant at all, and the 740 pages matching was an
  **unguarded true statement** — which by this repo's standard is the defect.

Three guards close it, all sabotage-proven against the tree that shipped:

1. `tools/repo-checks/test/pdp-controls-wired.test.ts` — every script-only
   state attribute the master renders must be written by the variant's
   enhancement, and every control must be named by it or listed in a
   reasoned native-behaviour registry. Run against the `pdp.js` on `main` it
   fails **nine** ways. It is in the 30, so it **blocks a merge**.
2. `variant-master-identity.test.ts` gains a fourth `describe` comparing
   `renderPdp` against `renderPdpPage` for **every** detail tray in **both**
   snapshots — 740 pages in ~90 ms, covering the render-class combinations
   the crate has and the fixture does not.
3. `tools/origin-suite/suite/pdp-controls.browser.test.ts` — the JS-ON leg
   that did not exist. Its headline assertion is generic on purpose: **no
   button on the page may change nothing when pressed**. A check naming zoom
   would say nothing about the next control.

### 4b. The verification pass found a regression this slice INTRODUCED

Recorded because it is the strongest evidence in the addendum that the
adversarial pass earns its cost, and because the fix is a spec-layer move.

`.pm-sr-only` — the utility that makes `namedGlyph` work — was defined in
`components/gallery.css:152`, and **only the PDP links that sheet**. So the
moment `namedGlyph` put visually-hidden text on the PLP master (5 instances)
and the checkout master (1), those pages had no rule to hide it with: text
written exclusively for assistive technology would have rendered as visible
"— No price listed". A repo-wide grep would have said the class existed. It
did exist; it just did not exist ON THE PAGE THAT USED IT.

The utility now lives in `surfaces/shell.css`, which `head()` links on every
surface — the correct home for a whole-system utility, and the reason the
defect could not recur for the a11y, editorial or how-it-was-built surfaces
either.

**The CSS cost, because moving a rule onto every page is a published-cell
change and the first draft of this addendum only accounted for the JS.**
`surfaces/shell.css` is linked by `head()` on EVERY surface, so the utility
and its contract comment ride every page including the editorial ones whose
CSS cell is published: **+629 B raw / +243 B brotli-q11** (1,835 → 2,464 raw).
`components/gallery.css`, PDP-only, is **+822 B raw / +376 B brotli-q11** for
the zoom and thumb-wrap contracts minus the rule that left. The comments were
trimmed to their load-bearing form first — the narrative lives here, and the
sheets are served raw (`variants/vanilla/build.mjs` copies the CSS tree with
`cpSync`; no minifier strips a comment before the wire), so prose in a
stylesheet is prose on every visitor's connection. The editorial re-run the
ruler unit owes re-measures this too.

The general guard is `tools/repo-checks/test/master-styles-resolve.test.ts`:
**every `pm-` class a committed master renders must resolve to a rule in a
sheet that master links.** It is the `pm-pdp__scroll` defect made impossible —
markup contract ahead of stylesheet — and it is sabotage-proven against both
instances: remove the `.pm-pdp__scroll` rule and FOUR masters fail; rename
`.pm-sr-only` and SIX do (the four PDP masters plus plp and checkout — a
seventh failure is the separate test pinning where the utility lives, and
counting it as a master was wrong). Three pre-existing unstyled classes are frozen in
a reasoned `OWED` registry (`pm-plp__head`, `pm-plp__results`,
`pm-checkout__form` — all on unbuilt surfaces, all owed to their surface's
build), and a further test fails if that registry ever describes more or fewer
classes than are actually unstyled, so it cannot quietly outlive its debt.

Two things the guard's own first draft got wrong, kept here because they are
the same lesson twice: it matched class names with `String.includes`, so
`.pm-sr-only` was "defined" by `.pm-sr-only-MOVED` and its sabotage proof
PASSED; and it matched inside CSS COMMENTS, where this package names classes
constantly. It now matches whole selector tokens in comment-stripped CSS.

### 4c. The instrument advertised the control too

`SURFACE_CONTROLS.pdp.proves` — the sentence the chrome renders into EVERY
measured page — read "gallery, cart, quantity, format". Amending three
documents while leaving that string would have had the INSTRUMENT advertise an
interaction the surface does not have: the same falsehood as the dead control,
one layer up, and this one is served to visitors. It now reads "gallery, zoom,
quantity, cart", which also promotes zoom from unmentioned to named now that
it works.

The three new guards were also vanilla-hardcoded, which is invisible today
(vanilla is the only live PDP variant) and worthless the moment a second one
lands. The browser leg now runs `describe.each(SURFACE_CONTROLS.pdp.variants)`
— the `cart.browser.test.ts` idiom, so it extends with no edit — and the
pre-merge guard keeps a variant→enhancement map with a **completeness
assertion**: if `variants` ever names a variant the map does not, the guard
FAILS rather than continuing to report green on vanilla alone. Sabotage-proven
by moving astro live: `expected [ 'astro' ] to deeply equal []`.

### 5. Bare glyphs are barred

Swept up in the same pass, because it is the same class — markup that says
something to sighted users and nothing to anyone else. `pdp.mjs` rendered
`${price ?? "—"}` and `<dd>${d.year ?? "—"}</dd>`; a lone "—" announces as "em
dash" or, at the common punctuation-verbosity default, as silence, making
absent data and a rendering fault indistinguishable — the reasoning
`tracklist.css` had already applied to empty duration cells. `lib.mjs`
`namedGlyph` is now the rule, and
`tools/repo-checks/test/master-glyph-names.test.ts` enforces it over every
committed master: any element whose entire text is short and carries neither a
letter nor a digit must be hidden from assistive tech with words supplied
beside it, or named. Against the masters on `main` it finds **seven**
instances — the PDP's unpriced amount, five release-card prices in the PLP
master, and checkout's cart-total placeholder. The null-year arm was invisible
to every other check because all four resolved masters have years.

### Consequences

- The four committed PDP masters are re-rendered; `variants/vanilla` is
  re-rendered and re-deployed. The PDP has no published receipts, so no
  reading is invalidated by the markup change.
- `CART_CONTRACT` gains a **uniqueness** clause. It had always *stated* "one
  entry per release id" without *checking* it, so a duplicate passed
  validation and the two implementations then disagreed — one add on
  `{"v":1,"items":[{"id":7,"qty":1},{"id":7,"qty":1}]}` gave **3** on
  editorial (first match) and **4** on the PDP (every match). The rule now
  checks what it always claimed. Cost, re-derived over all six cart files
  (`git show origin/main:F` vs `git show HEAD:F`, brotli via node zlib at
  quality 11): the clause plus its comment costs **+262 to +294 B raw and +80
  to +105 B brotli-q11**. The closest thing to a wire figure is vanilla's
  `cart.js`, which ships raw and goes **1,122 → 1,205 B brotli-q11 (+7.4%)**,
  or roughly +5% of the published 1.69 KB editorial initial-JS cell. Two
  honest limits on that number: only vanilla, htmx and remix3 ship their source
  raw — react-next, astro and qwik are bundled, so their source delta is an
  UPPER bound on what reaches the wire — and Cloudflare compresses materially
  worse than local q11 (3.68× vs 4.46×, measured 2026-08-14), the very
  mismatch `bench-instrumentation-dilution` exists to settle. (`pdp.js`'s own
  +1,446 B raw / +371 B brotli is NOT this clause: it is dominated by the zoom
  handler and its comment.) The re-run that unit already owes absorbs all of
  it.
- The release-card and checkout glyph repairs are **byte-neutral on every page
  served today** (no featured release is unpriced in either snapshot), so the
  editorial receipts are untouched by them; the five landed variants'
  re-typings were corrected in the same commit so spec and re-implementation
  cannot drift apart in a branch no test exercises.
