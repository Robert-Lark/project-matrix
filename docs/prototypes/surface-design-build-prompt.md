<!--
  Build prompt for the store-surface + instrument design session.
  Drafted 2026-07-16 by the home-surface session (ADR-0007). Paste everything
  inside the fenced block into a fresh session opened in this repo.

  Setup notes (for Rob, not part of the prompt):
  - Run it in a worktree (say "work in a worktree").
  - home-surface (ADR-0007) merged + deployed 2026-07-16 (commit 7117138),
    so origin/main is the complete base.
-->

```
Design every store surface of Project Matrix — and above all, the
instrument: the HUD that shows the performance numbers this site exists
to publish, and how they compare.

This is a DESIGN session, not the five paradigm builds. The deliverable is
the canonical spec layer the variant builds will consume: per-surface
canonical markup contracts + per-component CSS modules (semantic tokens
only) + framework-free reference renders (the drift-gate golden masters),
plus the full design of the chrome (switcher + HUD). The per-paradigm
implementations are follow-on tickets that consume what you produce.

── FIRST ACTION, BEFORE ANYTHING ──
Run `git fetch origin --prune` and base your worktree on origin/main —
never on the local clone's idea of main. The previous session lost time
to a three-day-stale clone. The home surface (ADR-0007, commit 7117138)
is merged and deployed; your chrome work builds on its precedents
(receipts substituted at build, the in-page HUD contract, the C2
phrasing discipline).

── READ FIRST ──
docs/decision-map.md (the whole matrix; the per-surface rows; the
data-strategy-lab and measurement-methodology answers), CONTEXT.md (get
the words right), ADR-0001 (how measurement stays un-riggable — this is
your bible), ADR-0002 (the trays, PDP interactivity guardrail), ADR-0003
(the design system: markup contract, matched pairs, drift gate), ADR-0004
(chrome is edge-injected, byte-identical, JS-off core), ADR-0005 (the six
PLP cells and the HUD additions they demand), ADR-0006 (the Catalogue
aesthetic; the instrument register reserved for chrome), ADR-0007 (the
home surface; the phrasing discipline that binds all on-page copy).
Then the code: packages/reference (the golden-master pattern),
packages/tokens/css, packages/switcher/src (chrome.ts + chrome.css — what
you are redesigning), packages/measurement/src (what the HUD can know),
tools/snapshot-capture/crate/ (the REAL data your designs must hold: 500
releases, real cover art, real prices $0.04–$515, titles in many scripts).
Open the deployed plane and the home page for the shipped state.

── THE NORTH STAR (read this twice) ──
The performance numbers are the product. Every design decision on every
surface is subordinate to one outcome: numbers nobody can discount.
There are two ways a design can kill this site, and you must design
against both:

1. A hostile staff engineer looks at a slow number, views source, and
   says "well of course it's slow — look how this page is engineered."
   DESIGN SO THAT SENTENCE IS IMPOSSIBLE. Every surface must be the page
   a performance-obsessed senior engineer would build: image slots sized
   from data with reserved space (zero CLS by construction — and settle
   the issue #9 derivative-sizing follow-up while you fix component
   dimensions), interaction patterns that don't demand main-thread abuse,
   no decorative weight, nothing below the standard the DS already set.
   The paradigm must be the ONLY possible explanation for any gap.
2. A design that quietly biases a paradigm. Every component must be
   expressible idiomatically in vanilla, React, Astro, Qwik, and HTMX
   with byte-identical DOM (ADR-0003 §1). If a component's design only
   works with a client runtime, you have designed a rigged benchmark.
   Zero-bias is not a constraint on your creativity; it IS the brief.

── THE HUD IS THE HERO ──
Today's chrome is a functional stub. Design the real instrument — the
thing a visitor remembers. It must communicate, at a glance, on every
surface: (a) the published lab numbers for this page under the selected
profile, across every variant it's built in — side by side, so the
COMPARISON is the interface; (b) the visitor's own live vitals next to
them (never mixed — lab compares, field is your reality check, ADR-0001
§1); (c) the full receipt behind every number: profile, date, commit,
location, and the URL-as-measurement-condition; (d) fit, not leaderboard
— a per-surface, per-condition reading, never a global ranking; design
how a "verdict" is displayed such that it cannot exist without a receipt
(C2: the machinery ships now, verdict slots stay honestly empty until
the first publication — the empty states are already-written copy).
Also design: the contextual switcher per surface (render-swap on spine,
data-strategy on PLP with the ?n= knob and replay affordance ADR-0005 §8
owes, device/CPU on Checkout, mode-toggles on A11y), per-interaction byte
readouts, and the fence plaques (Remix 3, the Apollo misapplication
exhibit, the live-origin demonstration) as one designed labeling system.
Constraints you inherit: edge-injected into a known slot, byte-identical
across variants, anchor-link core that works JS-off, bytes excluded from
measured KB, styled from semantic tokens via /_pm/chrome.css. Freedom you
inherit: ADR-0006 §1 reserved the site's personality for exactly this
register — the mono metric voice (--pm-font-metric), the deadwax/receipt
motif the home page established. Spend it here.

── THE SURFACES (one tradeoff each — design what proves it) ──
- Editorial: prose + exactly one interaction; the render baseline. The
  reading experience must be excellent enough that "just use HTML" is a
  felt conclusion, not a slogan.
- Product page: gallery/zoom, add-to-cart with cart state, quantity,
  format switch (ADR-0002 §PDP guardrail — interactivity stays rich; it
  is the render-axis variable). CLS/LCP showcase; media sized from data.
- Search + filters (PLP): the grid + faceted search/sort; the six
  ADR-0005 cells drive the switcher and HUD states; 24 vs 240 items must
  both look intentional; the covers supply the color, the mat-board holds.
- Checkout: a realistic form under INP pressure, built from the DS's
  accessible field components; design what "main thread under load" is
  demonstrated WITH, honestly.
- Accessibility section: vanilla singleton; two-box A/B pages for
  element-scoped defects + mode-toggle demos for global ones, using the
  matched DS-on/DS-off pairs; label BEFORE defect, compliant twin one
  link away, noindex (strategy-review finding 21).
- How it was built: singleton; the ADRs/build-log/reviews as readable
  content — the process is the evidence.
Every surface self-explains (solo-first): what am I looking at, what does
it prove, what should I try. Copy obeys CONTEXT.md vocabulary and the
ADR-0007 phrasing discipline: no verdict without a published receipt.

── KNOWN TRAPS (bind, or scope consciously) ──
- The crate is not pure Latin: "33⅓ RPM" (U+2153, 179×) and ℗ (74×) sit
  in the meta lines your cards will render; the fraction/symbol fallback
  strategy is the open `crate-glyph-coverage` ticket and lands on you the
  moment a reference render shows real crate data. Decide it or fence it
  — silently shipping tofu is not an option (the coverage guard will
  catch you anyway).
- New components join the reference render and the drift gate, and
  a11y-relevant ones ship matched pairs — that's the ADR-0003 toll.
- WCAG AA at token/definition time; forced-colors, reduced-motion, 400%
  zoom, keyboard — non-negotiable, as always.
- Cover art is real Discogs imagery with an open ToS/attribution call
  (domain-cutover item e): the store obviously shows covers, but don't
  spread them into chrome/marketing contexts beyond the store's need.

── HOW TO WORK ──
Work in a git worktree (after fetching — see FIRST ACTION). Design
tooling is LOCAL-ONLY (standing rule): boards are real token/CSS/markup
prototypes rendered against real crate data, screenshotted and critiqued
against the eight classic principles — no external design tools. This is
a Grilling + Prototype ticket: interrogate structure and copy before
pixels; run your drafts through an adversarial panel before building, and
run the standing verify-slice pass before committing. Record as you go:
ADR(s), decision-map answers (the per-surface rows + a11y-section +
crate-glyph-coverage), a build-log phase — the record is content for the
How-it-was-built surface. Verify with the real tooling: turbo checks, the
origin suite, the drift gate over your new golden masters, Lighthouse and
traces on the reference renders (throttled — measure, don't hope), plus
your own eyes in a real browser at desktop/mobile/zoom. Every number,
date, or SHA that appears in a design comes from a manifest or receipt at
build time — never typed by hand (ADR-0007 learned this twice).

── DELIVERABLE ──
Reference renders for all six surfaces + the redesigned chrome, verified
and committed on your worktree branch with the decision records. Present
for review with screenshots (or a preview URL if the chrome ships), the
one aesthetic risk you took in the instrument, and the list of follow-on
variant-build tickets your specs unblock. Do NOT merge to main — merging
deploys, and that stays my call.
```
