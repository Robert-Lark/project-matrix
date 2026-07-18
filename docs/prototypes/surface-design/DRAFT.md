# Surface design + instrument — working draft (pre-panel)

> The interrogation artifact for the store-surface + instrument design session
> (2026-07-16). Structure and copy before pixels. This draft goes to an
> adversarial panel before anything is built; findings and revisions are
> recorded alongside. Binding constraints: ADR-0001 (measurement bible),
> ADR-0002 (trays, PDP guardrail), ADR-0003 (markup contract, matched pairs,
> drift gate), ADR-0004 (chrome edge-injected, byte-identical, JS-off core),
> ADR-0005 (six PLP cells, §8 switcher additions), ADR-0006 (Catalogue; the
> instrument register reserved for chrome), ADR-0007 (phrasing discipline: no
> verdict without a published receipt).

## 0. The two kill conditions (designed against, per the brief)

1. **"Of course it's slow — look how this page is engineered."** Every surface
   is the page a performance-obsessed senior engineer would build: image slots
   sized from data (zero CLS by construction), no interaction pattern that
   demands main-thread abuse, no decorative weight. The paradigm must be the
   only possible explanation for any gap.
2. **A design that quietly biases a paradigm.** Every component is expressible
   idiomatically in vanilla, React, Astro, Qwik, and HTMX with byte-identical
   DOM. Anything that only works with a client runtime is a rigged benchmark.

## 1. The instrument (chrome) — the hero

### 1.1 Concept: the bench strip

The store is the specimen; the chrome is the bench instrument holding it. Home
(ADR-0007) established the two-register system: warm-paper store, near-black
(`--pm-neutral-950`) instrument with the deadwax/receipt voice. The redesigned
chrome extends that register to every surface as a **compact dark strip at the
top of the page** — in-flow (server-injected into the slot, so zero CLS by
construction), one collapsed row tall, expandable to the full instrument panel
via a native `<details>` (works JS-off).

Rejected placements: fixed bottom dock (out-of-flow overlay obscures store
content near the page end, and chrome.css must not restyle `body` to
compensate — that would leak instrument bytes into the page's own layout);
side rail (dies on mobile); keeping the light strip (reads as site furniture,
not an instrument — the personality budget ADR-0006 §1 reserved goes unspent).

### 1.2 The two voices

- **Chrome-owned mono face.** The receipt/metric voice is a self-hosted subset
  mono (JetBrains Mono, OFL), declared *inside chrome.css* via `@font-face`
  with `src: /_pm/fonts/...` — chrome-owned bytes on the known excluded path,
  identical on every platform. `--pm-font-metric` (the store's price face) is
  untouched: pouring a mono into the metric slot would re-litigate the
  Catalogue pick ("one face for UI and metrics", ADR-0006 §3) and change every
  store price — a re-pour, not a chrome design. ADR-0006 explicitly left both
  routes open ("reachable through the `--pm-font-metric` slot **and chrome
  CSS**"); the chrome route spends the personality where it was reserved
  without touching the store.
- **Colors**: the strip uses the dark end of the poured neutrals via
  `color-mix()` derivations (home's rule: no literal hex in composition CSS);
  paper-white text/focus rings on the dark ground (the semantic accent fails
  contrast on near-black — home §7 precedent). Forced-colors: the strip
  remaps like everything else (chrome.css gets its own forced-colors block
  since it compounds on dark ground).

### 1.3 Anatomy (collapsed row → expanded panel)

Collapsed row (always visible, ~one line):
```
PM ▸ variant: [vanilla] [react-next] [astro] [qwik] [htmx]   ·   profile: Slow 4G · mid phone   ·   your visit: LCP 654ms CLS 0.00   ·   [instrument ▾]
```
- Variant cells: plain anchors (swap = hard navigation, ADR-0004 §4), current
  cell marked `aria-current="true"`. Singleton surfaces show the surface name
  instead of a switcher.
- Live mini-readout: the two most legible vitals stream in via measure.js;
  em-dash otherwise. Never mixed with lab numbers.
- `[instrument ▾]` is the `<details><summary>` toggle for the panel.

Expanded panel sections, in order:

1. **The reading** (lab panel) — *the comparison is the interface*: a table,
   columns = the variants this surface is built in (sparse), rows = TTFB /
   FCP / LCP / CLS / INP (scripted, Checkout only) / initial JS KB, under the
   selected profile. Every populated cell is a link whose href IS its receipt
   (`profile · date · commit · location · URL`); the cell renderer takes a
   receipt object — a value physically cannot render without one.
   **Empty state (ships now, C2):** the table renders with all cells em-dash
   and one line beneath: *"No published runs yet. When a number lands here it
   carries its receipt — profile, date, commit, location — or it doesn't land
   at all."*
2. **Fit line (verdict slot)** — one sentence per surface-condition, rendered
   only from a published receipt bundle whose bands don't overlap (ADR-0001
   addendum C). Empty state: *"No verdict — nothing is published for this
   page yet."* Second empty state (post-publication, overlapping bands):
   *"Indistinguishable at this sample size."* Never a global ranking; the
   verdict names the condition it holds under.
3. **Your visit** (live panel) — the five vitals + the falsifiability line
   from home: *"When a published number and yours disagree, trust yours —
   then send me the URL."* Plus the noscript paragraph.
4. **The condition** (receipt strip) — the URL decomposed: variant · surface ·
   n · cache · profile(selector) · served-from location. Copy: *"The URL is
   the whole measurement condition — share it and you share the experiment."*
5. **Per-surface controls** (the contextual switcher's knob row):
   - PLP: data-strategy presets (5 anchors incl. the fenced exhibit,
     ADR-0005 §2 table), the `n` knob (24 / 240 anchors), per-interaction
     readout slot ("last interaction: — KB · — ms", empty state: *"lands with
     the store's PLP build"*), replay affordance slot (same empty state).
   - Checkout: profile selector foregrounded (CPU is the axis); lab INP row
     is labeled "INP (scripted)" per ADR-0001 addendum B.
   - A11y section: the chrome carries NO mode toggles — the demos own them
     in-page (the emulation-honesty caveat belongs next to the demo, not in
     the instrument; and the chrome must stay byte-identical while toggles
     are page-state). The chrome shows the section's singleton label.
   - Editorial/PDP: no extra knobs (render axis only).
6. **This surface** (solo-first self-explanation) — one line from the
   config: what am I looking at · what does it prove · what should I try.
   E.g. PDP: *"One product page, built five ways. Interactivity is the
   variable: gallery, cart, quantity, format all earn their JavaScript —
   or don't. Try the swap: the cart survives; the paradigm doesn't."*

### 1.4 Mechanics preserved

Injection contract unchanged: `div#pm-chrome-slot`, exactly one per page;
`<link href="/_pm/chrome.css">` first, single `<script src="/_pm/measure.js"
defer>` last; `nav#pm-chrome` (id + `data-pm-hud-live` hooks shared with
home's in-page HUD); anchors-only core; `?profile=` stays a snapshot selector.
`SURFACE_CONTROLS` grows a richer typed shape (variants + axis kind + knob
presets + the self-explanation line). Surface keys register **when a variant
actually serves the surface** (sparse honesty: the switcher can never offer a
cell that doesn't exist) — the full planned control-sets are recorded in the
ADR as the spec the variant builds consume.

### 1.5 The fence plaques — one labeling system

A DS component family, `pm-plaque`, spanning the store side (measured pages):
- `pm-plaque` (base): kicker · name · one claim sentence · receipt/method link.
- `pm-plaque--fenced`: adds `data-pm-fenced="true"`, the "EXCLUDED FROM EVERY
  BENCHMARK NUMBER" rule line. Users: Remix 3 exhibit (exact version), the
  Apollo misapplication exhibit (its build-measured +65.1 KB rides here), the
  live-origin demonstration (PDP), the a11y DS-OFF exhibits, checkout's
  "simulated — no payment, nothing ships, no PII" notice.
Plaque register: pressing-plant stamp — bordered, uppercase kicker in the
store's own face (NOT the chrome mono: plaques are page bytes; shipping the
instrument's font into measured KB would tax every variant). Plaques are part
of the canonical markup contract and the reference renders.

## 2. The surfaces

Shared shell (canonical markup, all store surfaces): skip link → masthead
(store brand → home link, nav: Records / Editorial / Checkout, cart link with
count slot) → `<main>` → footer (the store fiction line: *"A working store on
frozen Discogs data — nothing ships, checkout is simulated"*, links: what is
this? · how it was built · GitHub). The chrome slot sits above the masthead.

**Store brand:** "Matrix Records" — the store needs a believable name; the
matrix number is the project's own metaphor spent on the right axis (the
pressing identifies the variant). Panel should attack this.

### 2.1 Editorial — the render baseline
- Structure: kicker (STAFF PICK) · h1 · dek · byline + dated line · prose
  (~65ch measure) with one figure (a crate cover, dimensions from data) and
  one blockquote · **the one interaction**: the featured release as a card
  with a real Add-to-crate CTA (cart state) · plaque (Remix 3 version, on the
  remix3 build only — paradigm-owned, not canonical) · footer.
- The tradeoff it proves: hydration-overkill-for-prose. The page is prose +
  exactly one interactive element; a paradigm that ships a runtime to serve
  it explains itself.
- Copy: a real staff-pick essay on a crate release (Stars of the Lid,
  `And Their Refinement of the Decline`, 2007, Kranky — the crate's $515.24
  outlier is itself the story hook: what a record becomes when it goes out of
  print). Music writing, C2-clean (no paradigm verdicts in store copy).

### 2.2 PDP — interactivity earns its JS
- Two-column above the fold (stacks on mobile): gallery | buy panel.
- Gallery: main figure (first image, width/height from data, `fetchpriority=
  "high"` — the LCP element) + thumbnail row (up to 5, `<button>` elements,
  behavior per paradigm, ADR-0003 "appearance shared / behavior per
  paradigm"). Zoom: a zoom toggle button on the main figure ([aria-pressed]
  state, CSS transform presentation). JS-off: full content visible, switching
  inert — honest, since "interactivity earns JS" is this surface's thesis.
- Buy panel: title/artist · format switch (radio group segmented control —
  the release's `formats[]`; JS-off native radios) · price (`--font-metric`
  tabular) + `numForSale` stock line · quantity (label + `input type=number`
  + stepper buttons) · Add to crate (primary CTA) · meta list (label/catno ·
  year · genres/styles).
- Below: tracklist (table: position · title · duration mm:ss formatted in
  render) · notes (real crate notes — ℗ lives here) · the live-origin
  demonstration: `pm-plaque--fenced` + a button ("Fetch today's price from
  the live Discogs API") + result slot; copy states the default is real
  captured data served as production serves catalog data, and this is an
  excluded-from-numbers cost exhibit (ADR-0002 §3 mandatory copy).
- CLS: zero by construction — every image slot sized from tray data;
  the gallery reserves the tallest image's box? **No** — the main figure box
  is sized per-image from data (aspect-ratio from width/height); switching
  images with different ratios must not shift the buy panel: the gallery
  column reserves `max(image heights)`? Draft answer: the figure gets a
  fixed aspect frame (1:1, the dominant crate shape — 1,022 of 1,817 at
  600×600) with `object-fit: contain` letterboxing on the mat; per-image
  dimensions still on the `img`. Panel: attack this (letterboxing vs shift).

### 2.3 PLP — the data axis
- Toolbar: `<h1>` (Records) · result line rendered from tray (`total`,
  page window) · search form (GET, `q`) · sort form (GET select + Apply,
  works JS-off; enhancement per paradigm).
- Facet rail: three groups (Genre / Style / Format) from the tray's facet
  counts; each facet a plain link carrying canonical query params
  (ADR-0005 §5 contract — the edge Worker grows the params in the PLP build;
  the markup contract fixes the URL shape now: `?genre=`, `?style=`,
  `?format=`, `?sort=`, `?q=`). Selected facet: `aria-current="true"` +
  a remove affordance. Counts in tabular figures.
- Grid: the existing `pm-grid` / `pm-release-card`; cards link to PDP.
  Card meta line carries "33 ⅓ RPM" — the glyph decision (§4.1) lands here.
  Images: `loading="lazy"` + `decoding="async"` below the first grid row;
  the first row eager (LCP candidates). `sizes` attribute matched to the
  grid's actual column widths.
- Pagination: prev/next + numbered anchors preserving the full condition
  (n, filters, sort).
- 24 vs 240 both intentional: the mat-board (space-gap) holds density; at
  240 the toolbar's result line states the volume plainly ("showing 240 of
  500") — volume is a condition, not a bug.

### 2.4 Checkout — INP under pressure
- Single-page form, one narrow column (realistic modern checkout), sections:
  Contact (email) · Shipping address (name, address lines, city, state,
  postal, country select) · Shipping method (radio cards: standard/express —
  media-mail joke stays out, panel may veto) · Payment (fake card fields,
  plaque BEFORE the fields: "Simulated checkout — no payment is processed,
  nothing ships, nothing you type leaves this page") · Order summary (cart
  lines + totals, tabular prices) · Place order (primary CTA) → confirmation
  state (fake order number derived from... nothing typed by hand: the commit
  SHA? No — order numbers are theater; use a static designed string).
- Every field: real `<label for>`, `autocomplete` tokens, `inputmode`,
  error slots wired `aria-describedby`/`aria-invalid` (the DS field pattern).
- What "main thread under load" is honestly demonstrated with: the work a
  real checkout genuinely does — validate on blur, format the card number,
  recalculate the summary on quantity change — implemented per paradigm,
  published as the interaction registry entries (`checkout-type-card`,
  `checkout-submit-invalid`, `checkout-fix-and-submit`). No artificial
  busy-loops: the INP story must survive "view source".
- The INP row in the chrome reads "INP (scripted)" with the registry id in
  the receipt (ADR-0001 addendum B).

### 2.5 A11y section — vanilla singleton
- Three pages under `/vanilla/a11y/`:
  1. **Index**: what this section is, the DS-on/DS-off idea (matched pairs,
     byte-identical except the a11y treatment), how to use the demos.
  2. **Element demos** (one page, five two-box A/B blocks): focus ·
     forms · target size · contrast · live regions. Each block: the
     walkthrough label FIRST (what to try, what assistive tech announces),
     then DS-ON box, then DS-OFF box (labeled before the defect), compliant
     twin literally adjacent. `noindex` on this page.
  3. **Mode demos** (one page): forced-colors · reflow/400% zoom ·
     reduced-motion. Each: an emulation toggle scoped to the demo block +
     the honesty caveat: *"This toggle emulates the mode with CSS so you can
     see the mechanism; your OS setting is the real thing and always wins."*
     `noindex` optional here (nothing broken on the page itself — panel call).
- The DS-OFF boxes reuse the matched stripped pairs from the DS; defects are
  scoped to the box, never the page shell (a real AT user deep-linking must
  be able to leave cleanly — skip link and landmarks stay compliant).

### 2.6 How it was built — the process as evidence
- Reading surface: doc layout — left TOC (details/summary groups per phase)
  + article column (pm-prose). Content generated at build from `docs/`
  (ADR excerpts, decision-map rows, build-log phases) — never re-typed.
  This session designs the surface + renders a real ADR excerpt as the
  reference content.

## 3. Component inventory (new DS modules)

`masthead` · `footer` (both with skip-link pattern) · `prose` ·
`plaque` · `gallery` · `qty` · `format-switch` · `tracklist` · `facets` ·
`toolbar` · `pagination` · `checkout` (form sections + order summary +
radio-card) · `compare` (two-box A/B frame) · `mode-demo` (toggle + caveat) ·
`doc` (TOC layout). Existing: `button` · `field` · `release-card`.
Every module: semantic tokens only; state off native attributes; a11y-relevant
ones ship matched pairs (facets? no — pairs where the a11y treatment IS the
demo: field (exists), compare uses them; new pairs: gallery thumbs?
target-size demo reuses button). `structure.test.ts`'s module list grows.

## 4. Open decisions, settled (panel: attack each)

### 4.1 crate-glyph-coverage — decided, not fenced
- Ship **"PM Crate Symbols"**: a subset of Inter v4.1 (same source/license as
  the warn glyph) covering the crate's Latin-adjacent deferred set that Inter
  covers: `U+2153 ⅓, U+2117 ℗, U+02D9 ˙, U+03C0 π, U+03C1 ρ, U+03C6 φ,
  U+042F Я, U+2202 ∂, U+2207 ∇, U+221A √, U+221D ∝, U+22C5 ⋅, U+FB02 ﬂ`
  (~13 codepoints, ~2–4 KB woff2), `unicode-range`-scoped, appended to the
  `--pm-font-*` stacks after "PM Warn Glyph". Identical everywhere
  (ADR-0003 §8 held for everything we cover).
- **Arabic + CJK stay on documented per-OS system fallback** (17 codepoints
  across a handful of releases): subsetting isolated Arabic forms breaks
  shaping (worse than honest fallback); CJK Han-unification variant choice
  (JP vs SC forms) is a locale call a webfont would get wrong for someone.
  Real production sites do exactly this for out-of-repertoire scripts —
  real-world fidelity. Recorded in coverage.json as a *decided* fallback
  list (renamed from "deferred"), README, and the ADR.
- **Guard hardening (the anti-rigging note):** repo-checks gains a woff2
  cmap parser (fontkit) and re-derives coverage from the font bytes in-test;
  coverage.json remains the human record but can no longer be hand-faked.

### 4.2 Issue #9 derivative sizing — closed with the design
The single 600px-ceiling derivative set is **correct by data**: Discogs
originals cap near 600px, so 600 is the ceiling regardless; the PLP card
renders ~250–300 CSS px (600 ≈ the exact 2× asset), and the PDP main figure
renders ≤600 CSS px at 1× (2× would want 1200px that does not exist
upstream). Thumbnails reuse the gallery images (same URLs — browser cache,
zero extra bytes) rather than minting a thumb derivative. `sizes` attributes
make the browser's choice explicit. No re-capture, no new derivatives; the
follow-up closes with this rationale recorded.

### 4.3 Reference renders are BUILT, not hand-written
Golden masters render from tray JSON via a framework-free build script in
`packages/reference` (template per surface). CI builds from the committed
**fixture** (CI never reads the crate trays — ADR-0007 consequence honored);
local design builds point the same renderer at the crate for boards,
screenshots, Lighthouse. Committed: templates + renderer + fixture-rendered
masters (regeneration-checked so they can't go stale). Numbers/dates in any
render come from tray/manifest fields — never typed (ADR-0007's lesson,
now structural for all six surfaces).

### 4.4 SURFACE_CONTROLS registration
Config module grows the typed shape now (axis kind, knobs, self-explanation
copy); each surface's `variants` array stays empty until a variant build
actually serves it (sparse honesty at runtime). The planned lineups live in
the ADR table as the spec.

## 5. Out of scope (recorded)
Edge Worker filter/sort/search params (`genre/style/format/sort/q` — the PLP
build's contract, ADR-0005 §5); per-paradigm variant builds; live wiring of
per-interaction byte readout + replay (slots + copy ship now); publishing any
lab number; the beacon interaction-id tag; Editorial's Remix 3 build.

---

## 6. Panel revisions (2026-07-17)

Seven-lens adversarial panel — 78 findings (12 kill / 43 discount / 23
nitpick), raw output in [`panel-findings.json`](panel-findings.json). Three
lenses independently caught the same hand-typed wrong statistic ("1,022 of
1,817 at 600×600" — the true counts, tool-derived: **653/1,817** exactly
600×600, **771** exactly square, **296/500** primary covers exactly square,
**456/500** within 2%), proving the §4.3 rule against its own author. Every
number below is jq/sips-derived this session.

### Adopted — instrument
- **The strip is geometrically inert.** Fixed collapsed block-size; every
  live value slot reserves fixed `ch` width (mono + tabular figures); no
  post-load mutation may change the strip's box. The live mini-readout gets
  its own hooks AND the panel keeps the full set: `measure.js` moves to
  `querySelectorAll` (one-line change, named deliverable).
- **chrome.css moves to the head** (HTMLRewriter head-append) so the in-body
  blocking/FOUC path dies; the mono face is preloaded from the fragment,
  `size-adjust`-matched fallback metrics, swap cannot shift (fixed slots).
- **Chrome byte budget** asserted in repo-checks; the ADR records the
  ADR-0001 addendum-F obligation: the with/without-chrome constant is
  re-measured after the redesign, before any publication.
- **Signature move (the named aesthetic risk):** the variant cells are set
  in the deadwax etch grammar home established — uppercase, letterspaced,
  interpunct-separated, hairline etch rules, radius-0, no boxes; the current
  cell carries its cut (`· CUT f60385f`). The risk, stated: a permanent dark
  mono strip is the most imitable element in the system — it stands or falls
  on the matrix-number/etch signature.
- **Collapsed row** = PM mark · variant cells (or surface name) · your-visit
  mini (2 vitals) · Instrument toggle. Profile chip moves into the reading
  section (it was mixing lab/live registers in the collapsed row). Mobile
  contract: below the breakpoint the row is PM · current cell + "N OF M" ·
  toggle — asserted one line at 320 px.
- **Panel order** (a11y: orientation first) with pinned on-page headings:
  **This surface · The reading · Fit · Your visit · The condition ·
  Controls**. "Verdict slot"/"lab panel" stay ADR-only vocabulary.
- **Landmarks:** outer `<aside id="pm-chrome" aria-label="Project Matrix
  instrument">`; `<nav>` scoped to the switcher row only; summary accessible
  name = "Instrument — lab readings and your visit" (visible word +
  visually-hidden completion); marker glyph never announced.
- **Singleton surfaces get no lab table** — home's ADR-0007 §5 plain-sentence
  precedent (no lab snapshot will ever exist off the matrix); the reading
  section branches on matrix membership.
- **`SurfaceControls` grows `plannedVariants`** distinct from `variants`
  (live anchors): planned columns render as dead, labeled "not built yet"
  headers — a disclosure, not an offer; the em-dash table is renderable from
  config on day one, and "singleton surface" can never mislabel an
  unregistered matrix surface. Origin suite gains: every served page's
  chrome marks the serving variant `aria-current="page"`.
- **Published-runs bundle owned:** committed snapshots build into the front
  Worker's dist as `/_pm/lab/{surface}.json` (chrome-owned excluded path);
  the typed receipt schema (value inaccessible without profile · date ·
  commit · location · URL) lives in `@pm/switcher` now.
- **Checkout's contextual controls recorded honestly:** the device/CPU axis
  IS the profile system (ADR-0004 §6); the control-set collapses to
  profile-foregrounding — an explicit ADR-0004 §7 qualification, with the
  fenced "feel the difference" CPU demo noted as the checkout build's
  option, not half-designed here.
- **A11y-mode toggles move in-page** — an explicit ADR-0004 §7 amendment
  (rationale: toggles are page presentation state, and the emulation-honesty
  caveat must sit beside the demo). Rejected alternative recorded: mode as
  query-param anchors — emulation state is not a measurement condition and
  would pollute URL-as-receipt.
- **Dark-ground contrast is audited, not assumed:** poured pairs fail on
  neutral-950 (neutral-600 muted = 3.02:1; accent = 2.71:1) — the chrome
  palette is derived and audited by an extended audit script wired into
  repo-checks (the §4.1 hardening pattern applied to color).

### Adopted — store shell + surfaces
- **Store brand: "Long Decay Records"** ("Matrix Records" killed 3×: it
  inverts ADR-0007 §4's metaphor axis, blurs specimen/bench, and is the
  least believable name available). Scene-true (the crate's music is built
  from long decays), fictional, no reserved-motif words. The masthead
  wordmark is quiet Catalogue register; the chrome alone carries Project
  Matrix identity.
- **Masthead nav = absolute links to each surface's designated host variant**
  (recorded per surface in config; brand → `/`, cart → the designated
  checkout). Relative nav 404s on sparse cells; Worker-307 fallback silently
  swaps the variant and corrupts URL-as-receipt — both recorded as rejected.
- **CTA is "Add to cart"** — "Add to crate" forked CONTEXT.md's reserved
  noun (Crate = the snapshot scope).
- **Cart contract:** cart is `localStorage` (ADR-0004 §5), so the CANONICAL
  SERVED state of every cart-bound region is the empty state, pinned in the
  golden masters (the JS-off drift gate can only ever see it). Reserved
  geometry: fixed-width tabular count slot, min-height summary region with
  designed empty-cart copy; population is per-paradigm client enhancement,
  announced via a `role="status"` slot in the shell; populated-cart
  divergence is policed when a JS-on gate pass exists. JS-off statements per
  surface (checkout: fields fillable, native validation; placing the order
  requires JS in this build — the thesis stated honestly).
- **Checkout error contract:** invalid submit renders the error-summary
  region (heading + links to each invalid field), focus moves to it
  (WCAG 3.3.1/4.1.3); the confirmation state announces the same way. The
  interaction registry entries perform identical DOM + focus work per
  paradigm. Plaque copy scoped honestly: *"Simulated checkout — no payment
  is processed, nothing ships, and what you type never leaves your browser.
  This page sends only the same anonymous timing beacons every page sends."*
  The checkout notice is a **base** plaque — `--fenced` is reserved for true
  number-exclusions (Remix 3, Apollo exhibit, live-origin demonstration,
  a11y DS-OFF exhibits); checkout IS measured.
- **PDP degenerate states specified:** 439/500 releases are single-format —
  the format switch renders as a static meta line at n=1 (radio group only
  when real); unpriced/zero-stock renders em-dash price + "none for sale" +
  disabled CTA. Reference-render PDP: id 896191 (Explosions In The Sky —
  All Of A Sudden I Miss Everyone: 3 formats, priced, 5 images) so the
  golden master exercises the rich path.
- **Gallery:** 1:1 mat frame kept (letterboxing IS the mat-board; uniform
  geometry; extremes rare) — per-release max-height frame recorded as the
  alternative with its tradeoff. Thumb semantics pinned: buttons named
  "View image N of M: {alt}", selected thumb `aria-current="true"`.
  Fieldset/legend on format switch + shipping methods; qty buttons named
  Increase/Decrease quantity; tracklist + reading tables get caption +
  `th scope` + visually-hidden empty-cell text + labelled scroll container.
- **Thumb derivative tier minted:** originals scanned (sips, n=1,838):
  **zero exceed 600 px on either side** — the 600 ceiling is now
  receipt-backed, and a 160 px thumb tier (`{id}-{k}.thumb.avif`) is minted
  from the retained originals via the derive phase built for exactly this
  ("re-derivation starts here, never at Discogs"). Thumbs 2–5 otherwise cost
  ~100 KB of full-size fetches per PDP — kill-condition-1 surface. Eager
  count pinned: first 4 grid images eager, card 1 `fetchpriority="high"`,
  rest lazy.
- **A11y section:** DS-OFF twins ship inside collapsed `<details>` (natively
  unfocusable until opened — the default page state is fully conformant; a
  vanilla singleton, so cross-variant byte-identity is not in play). Caveat
  rewritten to a keepable promise: *"your OS setting is the real thing —
  these demos never override it"* (emulations additive-only, gated behind
  the real media queries).
- **Editorial provenance:** the essay is committed content with an explicit
  carve-out — prose narrates crate facts allusively ("north of five hundred
  dollars"); every component-rendered number (featured card, price, date)
  interpolates tray/manifest fields through the renderer; the dateline is
  the freeze date. Fixture gets a `curation.json` with a featured id so the
  fixture-rendered master resolves.
- **Self-explanation lines** live in config as templates whose counts render
  from the config's own arrays — never typed ("built five ways" killed).

### Adopted — mechanics
- **Masters render from the RESOLVED snapshot at suite time** (the
  snapshot-aware issue-#11 precedent): fixture in CI, committed crate trays
  on the deployed smoke — the committed fixture-rendered masters are the
  renderer's checked output (regeneration-asserted), and the post-deploy
  smoke stops being un-extendable. Gate server gains an `/assets/img/*`
  alias (fixture dir locally; origin on the deployed smoke).
- **The fixture becomes adversarially branch-covering** (generate.mjs
  extension, a §4.3 prerequisite): non-square covers, a 5-image and a
  1-image release, ≥1 h and null durations (crate max is 3,816 s — another
  typed-number catch), single- and multi-format, unpriced, a second genre,
  `U+2153`/`U+2117` strings (exercises the crate-symbols face in CI), a
  `curation.json`. The zero-bias claim is restated precisely: identical
  modulo a per-variant, audited noise registry; behavior attributes
  (`hx-*`, `on:*`, `q:*`) get their own declared registry class.
- **The session ADR carries the normative "what a variant may vary" section**
  (serialization freedoms the normalizer actually grants) and names
  `packages/reference/surfaces/{surface}/` as each surface's spec of record.
- **How-it-was-built owned:** front Worker static singleton at
  `/how-it-was-built/` (the home build precedent); the footer gains the
  a11y-section link. Departure from the decision-map row's "store chrome,
  editorial" form recorded.
- **Coverage rename targets enumerated:** `font-covers-crate.test.ts` (all
  four refs incl. the error-message copy), the README regeneration recipe,
  coverage.json itself; fontkit cmap re-derivation lands in the same change.
- **Planned registry ids** (`checkout-type-card`, `checkout-submit-invalid`,
  `checkout-fix-and-submit`) recorded in the ADR per the ADR-0005 precedent,
  owner tools/bench-runner.
- **Home's band deliberately keeps its ADR-0007 composition** (a designed
  destination); the strip shares the receipt grammar, not the anatomy —
  recorded so divergence reads as intent.

### Refuted (with evidence)
- *"Put display strings in the frozen tray"* (zero-bias fix option 1):
  contradicts ADR-0002 §6's data-not-UI guardrail ("no pre-sorting /
  pre-formatting / pre-computed render output" — typed primitives only).
  The branch-covering fixture covers the same risk without re-freezing.
- *Per-page first-image aspect frame* (hostile alternative): rejected — a
  2:1-first-image PDP would letterbox every square thumb hard; uniform 1:1
  mat keeps gallery geometry stable and the mat IS the aesthetic. 18/500
  LCP images letterbox; accepted and recorded.

### Correction to §1.2
ADR-0006's sentence, quoted exactly this time: "Its receipt/mono language
remains reachable later through the `--pm-font-metric` slot and chrome CSS
without touching a component."
