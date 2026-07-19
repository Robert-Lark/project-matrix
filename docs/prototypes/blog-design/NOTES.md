# Blog design — "Sleeve & Shelf" (the committed direction)

> Exploration record for the blog plane's public design (ADR-0009; build-log
> Phase 9). Method note, honestly recorded: the planned four-board
> adversarial exploration (marginalia / darkroom / liner-notes /
> field-notebook, three-lens judge panel) was launched as a workflow and
> **died on a session limit before any agent could report** — the run
> returned zero results, and the direction below was designed single-handed
> using the same boards-on-real-system method: real pages, headless-Chrome
> screenshots (`shots/`), eight-principles critique, revise, re-shoot. At
> COMMIT time it emerged that all four agents had in fact written their
> board pages to disk before dying (three had even self-shot screenshots;
> none wrote their NOTES or returned) — those boards are kept under
> `boards/` as-found, unjudged, and had no influence on the committed
> direction. The four-register spread collapsed into one deliberate splice
> anyway: liner-notes typography carrying the identity, the field-notebook's
> chronology discipline on the contents page, and the darkroom/Tumblr mood
> scoped to photo posts — convergent, in the end, with what the dead
> panel's spread was designed to explore.

## The register

Every post is a record on a shelf. Not clip-art vinyl — the TYPOGRAPHY of
sleeve design: a spine, a catalog line, oversized display moments, credits
in mono. The signature element is the **spine**: a colored vertical edge on
every post header and every shelf entry, driven by the per-post `accent`
knob. The named risk: an entire visual identity hung on one 6-px bar and a
mono eyebrow — if the type pairing didn't carry it, the whole thing would
read as "nice serif blog".

## Tokens

Palette (light): paper `#FBFAF6` · ink `#232019` (15.56:1) · muted
`#675F4E` (6.05:1) · hairline `#E6E2D6` · wash `#F2F0E8` · default accent
`#3D6B54` (5.86:1 — but see discipline).
Palette (dark): paper `#16150F` · ink `#DED9CB` (12.97:1) · muted
`#9D9787` (6.28:1) · hairline `#2D2B22`.
Code: Shiki dual-theme Everforest (fg/bg 5.18:1 light, 7.38:1 dark),
inline styles so RSS readers and print get highlighting for free.

**Accent discipline (the load-bearing rule):** the accent knob accepts any
hex, so accent may never color text — it lives in spines, marks, and link
underlines (`text-decoration-color`) only; text is always ink or muted.
Two violations were caught in critique (the eyebrow's kind label, footnote
refs) and repaired.

Type: **Fraunces** (variable opsz/wght — display, masthead, year marks,
pullquotes) · **Literata** (variable + real italics — body at 17px/1.75,
measure 66ch) · **Fragment Mono** (catalog lines, dates, tags, code).
Self-hosted latin subsets via Fontsource (~230 KB total, two preloaded).
Deliberately zero overlap with the store's faces.

Header treatments (the `header_style` knob): `standard` · `display`
(oversized Fraunces, 10-px spine) · `photo-hero` (cover image full-bleed
above the head) · `bare` (notes: catalog line only). Mood knob: `default` /
`quiet` (smaller, lighter head) / `loud` (a bigger, bolder title + thicker
spine).

> **Correction (phase 2, 2026-07-18):** `loud` originally inked the display
> title in the per-post accent — recorded here as "the one sanctioned
> accent-as-text." A verify pass caught that this breaks the load-bearing
> rule: the accent is format-validated but never contrast-checked, so a
> light accent renders the title near-invisible on paper (fails AA), and
> "accessibility without exception" is the plane's floor (ADR-0009 Context).
> `loud` is now carried by scale and weight, not color — the accent-never-
> colors-text discipline is now absolute, with the spine as its only home.

## The shelf (contents page)

Chronology is the spine of the archive: Fraunces year numerals as section
marks, entries with spine ticks (notes get a dot, links get ↗), date in
mono right-aligned, deks under essay titles. Browse block (series + tags
with counts) under a hairline at the foot. Tested with mixed kinds; the
structure holds for years × dozens of posts because years are sections and
everything inside is one flat ruled list.

## Photo posts

The Tumblr mood (dreamstoday14-blog.tumblr.com — reference only, never
imported): contemplative, full-bleed single-column frames, muted
naturalistic palettes, *italic location + date* captions hugging the frame,
generous vertical air. Encoded as: `:::bleed` for full-width frames,
galleries with matched 3:2 cells, and the rule that in photo posts a
lone-italic paragraph IS a caption (centered, small, muted).

## Critique rounds (what the screenshots changed)

1. **Broken photo posts** — sanitize's default protocol list strips `data:`
   img URIs → allowed (CSP already permits; inert).
2. **Gallery collapse** — adjacent image lines parse as ONE markdown
   paragraph → one grid child stretching over the footer. Fixed in the
   renderer (images hoisted to their own cells) so authors never learn the
   blank-line rule; CSS aspect-ratio 3/2 on grid layouts.
3. **Margin-aside overflow** — the −18rem pull needs a ≥18rem gutter; the
   74rem breakpoint gave 16rem at worst → moved to 84rem.
4. **Accent-as-text leaks** — kind label + footnote refs → muted.
5. **Code block definition** — hairline border added (wash-on-paper was too
   quiet).
6. **Note dot geometry** — was a 4×6 oval mid-row; now 6×6 on the first
   line.

Dark mode: real night surface (warm near-black), not an inversion;
photographs dimmed 6%; Everforest dark for code. Print: chrome hidden,
black-on-white, external link URLs printed after anchors, asides un-floated.

Shots: `shots/` (contents/essay/photo/note at 1440, essay+contents at 390,
essay dark full-page). Editor interaction shots: `../blog-design/editor-shots/`.
