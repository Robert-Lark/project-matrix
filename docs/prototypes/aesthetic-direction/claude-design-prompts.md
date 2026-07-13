# `aesthetic-direction` — Claude design prompt pack

> Drafted 2026-07-10 as the kickoff of the `aesthetic-direction` ticket
> (decision-map). These prompts run in Claude design (or any multimodal
> Claude surface) — the tool has **no repo access**, so every prompt is
> self-contained: paste the CONTEXT block above each one. Outputs are
> **exploration input**, not decisions; the pour + ADR happen in-repo per
> the ticket (`/prototype` + frontend-design skill, then ADR + build-log).
>
> Critique method woven through (per
> https://expo.dev/blog/how-to-apply-professional-design-principles-in-ai-app-development):
> eight principles — contrast, hierarchy, alignment, proximity, repetition,
> balance, white space, unity — used as iteration vocabulary; screenshots
> fed back for critique ("AI has no eyes"); never settle for the sterile
> utilitarian first pass.

## How to run the sequence

1. **Prompt 1** → pick a winning direction board (or splice two).
2. **Prompt 2** with the winner pasted in → the production token sheet.
3. **Prompts 3–5** in any order, each with the token sheet pasted in.
4. **Prompt 6** is the reusable critique loop — attach screenshots of
   anything (Claude design output, or the real reference render later)
   and iterate. Reuse it every round.

---

## CONTEXT block (paste above every prompt)

```text
CONTEXT — Project Matrix

You are designing the visual system for "Project Matrix", a live-benchmarking
portfolio site by a staff-level frontend engineer. One real commercial product
— a vinyl record store running on frozen Discogs data (a curated ~500-release
"crate") — is built in parallel across five rendering paradigms (vanilla,
heavy-hydration React/Next, Astro islands, Qwik resumability, HTMX
hypermedia). Visitors flip between implementations of the same page with a
switcher while a HUD shows their own live web-vitals (TTFB, FCP, LCP, CLS,
INP) beside published lab numbers across three device/network profiles
(fast-wifi laptop / average-broadband desktop / slow-4G mid-range phone).
Every benchmark number ships as a dated, commit-pinned "receipt" — each field
carries its value AND its source — and a cost report converts measured
CPU-ms/bytes/requests into dollars per 1M visits. Audience: skeptical staff
engineers and hiring managers arriving alone from a job application or a blog
link. Voice: pure evidence — the site convinces with receipts and working
demos, never with manifesto copy. The argument is fit, not a leaderboard.

Two registers share one design system:
1. THE STORE — must read as a credible vinyl shop. Square album cover art
   supplies the color; the system is the bins — a quiet, confident frame that
   makes other people's art pop.
2. THE INSTRUMENT — switcher, HUD, receipts, methodology, cost tables. Dense,
   tabular, provenance-obsessed. The site's personality concentrates here.

Subject vocabulary worth mining: crate digging, record bins, sleeve and
center-label typography, hi-fi faceplates and VU meters, spec sheets, lab
notebooks — and the deadwax "matrix number", the code etched into a record's
runout groove that identifies the exact pressing. The project is named for
it: a receipt etched into the artifact itself.

HARD CONSTRAINTS (the token architecture is locked; the aesthetic is values
poured into fixed slots):
- Exactly ONE theme ships (no light/dark pair). It must carry both a
  storefront and long-form technical reading.
- Palette slots: 9 neutrals (steps 0/50/100/200/400/600/700/900/950), ONE
  accent in two steps (500 + darker 700 for hover), ONE danger (600). No
  other color slots exist — this mechanically enforces repetition.
- Type: ONE variable sans carries UI + prose. It must be self-hostable and
  subsettable (OFL or similar), have a true ~550 medium, and offer tabular
  figures. A second face is permitted ONLY for metrics/numerals (tabular or
  mono). Display personality must come from the sans's variable axes
  (weight / width / optical size) — no third display family.
- Scales: 6 type sizes (rem), weights 400/550/700, 6 space steps, exactly 2
  radii (control + card), ONE shadow, 2 motion durations + 1 easing (all
  collapse under OS reduced-motion).
- Every pair must clear WCAG AA. Deliver a contrast audit for: text/surface,
  text/surface-sunk, muted-text/surface, accent-as-link/surface,
  on-accent/accent-500, on-accent/accent-700, danger/surface, and
  focus-ring/surface (3:1 non-text).
- Must survive Windows forced-colors mode (all color collapses to system
  colors — meaning may never ride on hue alone) and 400% zoom reflow.
- Store components may gain NO new ornament — their look changes only through
  the dials above. Compositional and signature moments live in the instrument
  chrome, the home page, and the methodology/receipt surfaces, which are
  free ground.
- No decorative image assets; everything in plain CSS. Page weight is
  literally on display in this project.

DESIGN DISCIPLINE (applies to everything you produce):
- Before presenting, critique your own output against: contrast, hierarchy,
  alignment, proximity, repetition, balance, white space, unity — and revise
  what fails. Say what you changed.
- One surgical high-contrast focal point per view; state each view's
  hierarchy as explicit tiers (1 / 2 / 3).
- Avoid the stock AI looks: warm-cream + big serif + terracotta; near-black +
  one acid-green accent; broadsheet hairline-rule pastiche. Derive every
  choice from THIS subject's world instead.
- Real content only — never lorem ipsum. Sample content (from the real frozen
  crate — ambient / melodic techno / neo-classical, 2006–2026): releases
  "And Their Refinement Of The Decline — Stars Of The Lid · 2007 · $515.24 ·
  1 for sale" and "Spaces — Nils Frahm · 2014 · $23.24 · 1 for sale"; variants
  vanilla / react / astro / qwik / htmx; metrics like "TTFB 400 ms cold →
  15 ms warm edge", LCP 1.9 s, CLS 0.02, INP 140 ms; receipt stamp
  "commit f60385f · captured 2026-07-11 · slow-4G profile · median of 9 runs".
  _(Amended 2026-07-12: the drafted samples predated the crate capture —
  issue #9 froze the real crate, so the samples now match it.)_
```

---

## Prompt 1 — three direction boards

```text
[CONTEXT block here]

Task: propose THREE genuinely different aesthetic directions for this system,
presented as boards I can flip between (spec boards, not full mockups). Each
direction must be rooted in a different corner of the subject's world — for
example: the record shop as a material space; the hi-fi instrument panel; the
archival spec-sheet/documentation tradition — but name and own your three.

Each board must deliver:
1. A name + one-sentence thesis (what it says about the engineer who built it).
2. The full palette poured into the exact slots (9 neutrals, accent-500/700,
   danger-600) as hex values, with the WCAG AA contrast audit.
3. The typeface call: one named variable sans (+ optional metric/mono face),
   its license, why this face for this direction, and which variable axes
   carry the display voice.
4. The voice dials: the two radii, the one shadow, spacing rhythm/density,
   motion feel (two durations + easing), and three adjectives.
5. The signature element — the one memorable thing — and WHERE it lives given
   the ornament fence (chrome, home, receipts — never store components).
6. Three in-direction thumbnails: a PLP release-card row, the HUD strip, and
   a benchmark receipt.
7. The one real aesthetic risk this direction takes, and its failure mode.

Then self-critique every board against the eight principles and the
stock-AI-look ban, revise what fails, and note what changed.
```

## Prompt 2 — the token pour

```text
[CONTEXT block + the winning direction board here]

Task: turn this direction into final production token values. Deliver:

1. A CSS block assigning every slot:
   --pm-neutral-0/50/100/200/400/600/700/900/950; --pm-accent-500;
   --pm-accent-700; --pm-danger-600; --pm-font-ui; --pm-font-metric;
   --pm-size-0..5 (rem, state the scale's ratio logic);
   --pm-weight-normal/medium/bold; --pm-space-1..6;
   --pm-radius-1 (controls); --pm-radius-2 (cards); --pm-shadow-1;
   --pm-ease; --pm-dur-fast; --pm-dur-base.
2. The AA contrast audit for the listed pairs, with computed ratios.
3. Forced-colors notes: which visual meaning is lost when color collapses to
   system colors, and the non-color cue that carries it.
4. Font logistics: exact family + version, license terms for a renamed
   self-hosted subset, variable axes to retain, confirmation of tabular
   figures (tnum), subsetting notes.
5. The three hardest tradeoffs you made (e.g. muted-text quietness vs 4.5:1)
   and why you resolved them that way — written so they can be quoted
   verbatim in an architecture decision record.
```

## Prompt 3 — storefront proof

```text
[CONTEXT block + final token sheet here]

Task: prove the direction works as the STORE, using only the token dials —
the component anatomy below is locked and may not gain ornament.

Locked anatomy:
- Release card: square cover image → title → artist → meta line ("Vinyl, LP,
  Album, Reissue · 1959") → footer with price + "N for sale". Cards sit in a
  responsive grid.
- Buttons: primary ("Add to cart"), secondary ("Save for later"), disabled
  ("Sold out").
- Form field: label above control, hint below, error as warning icon + text.

Render: (a) a PLP grid of 8 release cards with real jazz releases and varied
cover-art tones — show the covers popping against the system; (b) the top of
a product page: gallery, title/artist, price + stock, add-to-cart, tracklist;
(c) a checkout field group with one field in its error state.

For each view: state the hierarchy tiers; point at the single high-contrast
focal point; self-critique against the eight principles and revise once.
Finally, show the card row twice more: once approximating forced-colors
(system colors only, no hue meaning), once at a narrow viewport standing in
for 400% zoom.
```

## Prompt 4 — the instrument

```text
[CONTEXT block + final token sheet here]

Task: design the INSTRUMENT — the measurement layer. It shares the store's
tokens but may carry more personality (its CSS is excluded from the
benchmarked page weight). It must read as an honest lab tool bolted onto the
shop by the engineer who runs it: distinct, never clashing. This is where the
site's signature lives — take the one real aesthetic risk here and justify it.

Surfaces:
1. The chrome bar injected atop every store page. Row 1: variant switcher —
   plain links "vanilla / react / astro / qwik / htmx", current one marked.
   Row 2: HUD — profile selector (fast-wifi laptop / broadband desktop /
   slow-4G phone), the published lab snapshot for this page (and its honest
   empty state: "No published runs yet"), then "your visit" live metrics
   (TTFB · FCP · LCP · CLS · INP). Compact, works as plain text, every
   numeral tabular.
2. A benchmark receipt: header stamp (commit SHA, capture date, profile,
   median-of-9); per-metric rows where EVERY value shows its source; a
   resource profile (CPU-ms, bytes by bucket, request count); method notes.
   Explore the deadwax matrix-number etching motif here — a receipt pressed
   into the artifact itself.
3. A comparison view: variants × cold/warm × three profiles. NOT a
   leaderboard — the framing is fit: the same variant wins one surface and
   loses another. Show how the table's design says "context decides", not
   "ranking" (e.g. per-surface verdicts, no aggregate score, ties honored).
4. The cost report: architecture-only dollars vs real-world-host dollars per
   1M visits, the arithmetic shown in full, inputs visibly swappable.

For each: hierarchy tiers, one focal point, eight-principle self-critique,
revise once before presenting.
```

## Prompt 5 — home / gateway

```text
[CONTEXT block + final token sheet here]

Task: the home page. Scope is deliberately small — chrome + prose + CTA: an
about-me and a gateway, nothing complex. It must self-explain to someone
arriving cold from a job application: what this site is, who built it, why it
exists — in evidence language, zero manifesto.

Structure:
1. A hero that answers "what am I looking at" in one breath. Display voice
   comes from the variable axes of the system sans — no display font, and NOT
   the stock big-number-with-gradient-accent hero.
2. An about-me block: name, role, what this engineer cares about (fit over
   fashion; receipts over claims), links out (GitHub, the write-up).
3. The gateway: one entry per surface — Editorial / Product page /
   Catalog + search / Checkout / Accessibility / How it was built — each
   stating in one line the tradeoff that surface proves. These are the CTAs
   into the tool.
4. A quiet trust strip: how the numbers are made (dated snapshots, pinned
   commits, public harness), linking to the methodology page.

One surgical focal point (the primary CTA into the matrix). Explicit
hierarchy tiers. Self-critique against the eight principles; revise once
before presenting.
```

## Prompt 6 — the critique loop (reusable, attach screenshots)

```text
[CONTEXT block here + attach screenshot(s) of the current design or build]

Act as a design director reviewing this screen. Do not redesign it wholesale
— art-direct it.

1. Critique the screenshot against each principle BY NAME — contrast,
   hierarchy, alignment, proximity, repetition, balance, white space, unity —
   citing specific elements ("the price and the stock count compete"), never
   generic advice ("improve spacing").
2. State the hierarchy you actually perceive, top to bottom, then the
   hierarchy the page SHOULD have. Flag any view with more than one
   high-contrast focal point.
3. Flag anything that reads as template/AI-default rather than a choice made
   for this subject.
4. Flag utilitarian sterility: places that are functionally complete but
   characterless — and propose the smallest nuance that fixes each WITHIN the
   constraints (token dials only for store components; free composition only
   in chrome / home / meta surfaces).
5. Output a punch list of concrete revisions, each tagged with the principle
   it serves and the exact token or spacing step to change. Then apply the
   punch list and show the revised version beside the original.
```

---

## Bringing results back to the repo

- The pour lands in `packages/tokens/css/tokens.css` **primitive tier only**
  (`:root` `--pm-*` block); semantic tokens and component modules stay
  untouched (decision-map, `aesthetic-direction` ticket; ADR-0003 §7).
- Font swap per `packages/tokens/fonts/README.md`: replace the woff2 +
  `--pm-font-*` primitives; keep self-hosted/subset/`tnum`. If a direction
  truly demands a third display family, that is an **ADR-0003 §8 amendment**
  — flag it, don't silently do it.
- Verification is already built: the reference render is the golden master
  and the drift gate (normalized DOM + pixels × 3 profiles) proves every
  variant absorbed the pour identically.
- Contrast: AA is checked **at token-definition time** (ticket text) — the
  Prompt 2 audit table is the evidence; re-verify locally before committing.
- Record the decision as an ADR + build-log entry per the ticket
  (Prototype + Grilling); the boards and tradeoff write-ups double as
  "How it was built" source content.
