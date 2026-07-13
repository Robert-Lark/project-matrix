---
status: accepted
date: 2026-07-12
ticket: aesthetic-direction
---

# Aesthetic direction — the "Catalogue" pour

## Context

ADR-0003 §7 deliberately built the design system aesthetic-agnostic: the look
is the *values poured into the primitive token tier*, swappable with zero
component changes, and the shipped values were a labeled neutral placeholder.
This ADR records the actual look.

Two things had changed since ADR-0003. The crate was frozen (issue #9):
**ambient / melodic techno / neo-classical vinyl, 2006–2026** — so the frame's
subject stopped being hypothetical; the store's color is now 500 real sleeves
from that scene, and the system's job is to hold them. And the exploration had
to run **entirely locally** (Rob's constraint, 2026-07-12: no external design
tool) — which turned out to strengthen the method: candidate directions were
built as real primitive-token pours rendered against the actual component CSS
and canonical markup, with real crate covers, not as approximate mockups.

Method (recorded in `docs/prototypes/aesthetic-direction/directions/` and
build-log Phase 6): three candidate boards, each grounded in a different
corner of the subject's world; every palette audited for WCAG AA
programmatically (`audit-contrast.mjs`, the ADR-0003 §4 pair list plus
real-usage advisory pairs) **before** any screenshot; then one
screenshot-critique pass per board against the eight classic principles
(contrast, hierarchy, alignment, proximity, repetition, balance, white space,
unity), with revisions committed as comments in each candidate file. Rob
picked from the finished boards.

## Decision

**1. The direction is "Catalogue": the label's own catalogue.** Warm paper
ground, slate-water accent, one grotesk, generous air — the system is
mat-board; the sleeves supply the color. The store register stays quiet and
credible; the site's personality may concentrate later in the instrument
surfaces (chrome, receipts, methodology), which have compositional freedom
outside the component fence.

**2. Palette (primitive tier).** Nine warm-paper neutrals `#fdfcfa → #131009`,
accent `#3d5d70` / hover `#2b4454` (slate-water), danger `#a03a2d`. Every
consumed **text** pair clears WCAG 1.4.3 AA at token-definition time — audited
programmatically, worst 6.14:1 (`--color-text-muted` on surface), all others
≥6.5:1 (`docs/prototypes/aesthetic-direction/directions/audit-contrast.mjs`,
run against the poured production file). **One known non-text exception:**
`--color-border` (`--pm-neutral-200`) on surface is **1.39:1**, below SC
1.4.11's 3:1 for a UI-component boundary. It is a deliberate choice for the
airy "mat-board" look, pre-existing (the placeholder border was 1.37:1, so the
pour did not regress it), and its applicability is narrow — the affected
control (`.pm-field__control`) also carries a label and, on focus, a 3px
`--color-focus` ring at ≥3:1. Flagged, not hidden: whether to darken the
control boundary to meet 1.4.11 is deferred to `a11y-section` (a single
primitive change, but one that thickens every border against the intended
look). The audit script scores it as an advisory visibility check so the
gap is visible on every run rather than asserted away.

**3. The face is Familjen Grotesk (one face for UI and metrics).** v2.002
variable, `wght` 400–700 — the token scale's 550 medium is real — with
OpenType tabular figures, satisfying ADR-0003 §8 with a single family. SIL
OFL 1.1 with **no Reserved Font Name**, so the Latin subset keeps its real
name; provenance + reproducible subset recipe in
`packages/tokens/fonts/README.md`. The subset covers Latin-1 + Latin
Extended-A/B + General Punctuation + the symbols the store needs (524 glyphs,
~24 KB woff2, down from the placeholder's ~105 KB). Candidates without `tnum`
(e.g. Hanken Grotesk) were disqualified on inspection with fontTools before
any board was built.

**Glyph coverage against the frozen crate (the honest gap).** Familjen is a
Latin face; the frozen crate (issue #9) is not purely Latin. Two categories
are not drawn from Familjen:

- **U+26A0 (⚠)** — the field error affordance's icon (`field.css`
  `content: "\26A0"`), which Familjen lacks. Supplied by a 1-glyph, ~1.2 KB
  monochrome subset of Inter (SIL OFL 1.1) declared as the `"PM Warn Glyph"`
  family, scoped by `unicode-range: U+26A0`, added to the `--pm-font-*` stacks
  after Familjen — consulted for that codepoint alone. Keeps the icon
  identical on every platform (ADR-0001) and monochrome under forced-colors
  (ADR-0003 §5) rather than a per-OS, sometimes colour-emoji glyph. (The pour
  had silently dropped it; caught by the verification pass's correctness lens
  before commit — build-log Phase 6.)
- **30 codepoints the crate uses that no Latin face covers** — chiefly
  `U+2153 ⅓` (179×, in "33⅓ RPM" on the card meta line) and `U+2117 ℗` (74×,
  in PDP notes), plus CJK, Arabic, Greek, Cyrillic and math symbols across a
  handful of releases. These need a fraction/symbol/script fallback strategy —
  a genuine **i18n decision deferred to the crate-rendering surface builds**
  (new `crate-glyph-coverage` ticket), not to the aesthetic pour. It is
  latent: no shipped surface renders the crate yet (the CI fixture is pure
  Latin). The exact set is recorded in `packages/tokens/fonts/coverage.json`
  and guarded by `tools/repo-checks/test/font-covers-crate.test.ts`, which
  fails if a future re-freeze introduces a codepoint that is neither covered
  nor on that documented deferred list — so the gap can grow only
  deliberately.

So Familjen + the ⚠ fallback render all Latin store text; the deferred set is
explicit and test-guarded rather than an unqualified "one font, everything."

**4. Scale and voice dials.** Airy type scale (`0.8125 → 2.625rem`) with
size-3 deliberately capped at `1.1875rem` — the boards' critique pass showed
card titles at 1.25rem+ fighting the cover art, and the covers must win.
Space scale opens up at the top (`… 2rem / 3rem`); radii `5px / 14px`; one
soft double shadow; motion `170/280 ms` with a gentle ease (still collapsed
by the semantic reduced-motion gate).

**5. The pour touched the primitive tier only.** The semantic tier,
forced-colors remap, reduced-motion gate, and every component module are
byte-unchanged (ADR-0003 §7 honored literally). Forced-colors survival is
structural: under the remap all semantic colors collapse to system colors,
bypassing the poured values entirely; the structure tests continue to assert
full remap coverage.

**6. The placeholder guard inverted.** `packages/tokens/test/structure.test.ts`
previously enforced *"the stand-in must be labeled PLACEHOLDER"* (issue #2
acceptance). The pour is the state change that guard was waiting for; it now
enforces the opposite invariant — the token file must cite its rationale of
record (this ADR) and contain no placeholder language.

## Considered alternatives

- **"Faceplate" (candidate B)** — the one canonical theme poured *dark*: warm
  charcoal, amber signal, mono metrics. The strongest single identity and the
  best instrument register of the three (its mono receipt voice was the most
  memorable element on any board). Rejected because dark-canonical commits
  the *entire* portfolio — long-form methodology reading, the a11y section,
  employer first impressions — to the boldest bet, and ADR-0003 §4 ships
  exactly one theme. Its receipt/mono language remains reachable later
  through the `--pm-font-metric` slot and chrome CSS without touching a
  component.
- **"Runout" (candidate C)** — pressing-plant document: stamp blue, square
  corners, zero shadow, Archivo's width axis as the display voice. Coherent
  concept, weakest realized distinctiveness on the store surface, and its
  accent sat closest to generic link-blue. Its deadwax-etch receipt motif is
  noted for the instrument surfaces.
- **Splices** (e.g. Catalogue ground + a mono metric face) — legal pours by
  construction; Rob picked A whole. Recorded so nobody mistakes the single
  face for an architectural limit.
- **Keeping a project-renamed font** ("PM …" naming) — rejected; with no
  Reserved Font Name the transparent real name wins, and the README carries
  provenance.

## Consequences

- Every existing and future variant inherits the look automatically — the
  drift gate re-proved all variants against the re-poured golden master
  through the composed origin (the full origin-suite × 2 runs, 120/120, incl.
  normalized-DOM + pixel diff × 3 profiles) with zero component changes.
- The candidate boards, audit script, picks, and prompt pack are committed
  under `docs/prototypes/aesthetic-direction/` as the exploration record and
  "How it was built" source material.
- `domain-cutover`'s aesthetic prerequisite is satisfied; it now waits on
  `home-surface` alone.
- The a11y section's forced-colors story is unaffected by the pour
  (mechanically bypassed, §5) — its demos compare DS-on/DS-off, not palettes.
- Image derivative sizing (issue #9 follow-up) can now be finalized against
  real component dimensions: the release-card media box is unchanged by this
  pour (dimensions come from data, not tokens).
- The drift gate's font-readiness wait (`drift-gate/src/gate.ts`
  `captureStablePixels`) was corrected as a consequence of the `"PM Warn
  Glyph"` fallback: it previously required *every* registered `@font-face` to
  load, which a `unicode-range` face the page never triggers can never
  satisfy. It now settles on "no face still loading and at least one loaded,"
  so the standard `unicode-range` technique no longer stalls the gate
  (build-log Phase 6).
