# The four boards, finally judged (2026-07-18)

> The four design boards under this directory were written by agents that
> died on a session limit before reporting (see `../NOTES.md`). Phase 2
> judged them. Method: a workflow inventoried all four faithfully (40
> concrete devices, evidence-cited) — that leg completed; the three-lens
> judge panel then died on the same session limit. Per the standing
> best-judgment rule the judgment was finished inline against the committed
> "Sleeve & Shelf" system, with a real screenshot probe of the one
> candidate close enough to matter.

## Verdict: Sleeve & Shelf stands. Nothing spliced this session.

The bar was "stays unless something clearly beats a piece of it." Held.
The registers and why each stays a reference, not a donor:

- **liner-notes** — the *nearest neighbor*, because Sleeve & Shelf already
  IS the record-sleeve conceit (the committed direction spliced its
  liner-notes typography deliberately, per NOTES.md). Its distinctive
  additions over what shipped: the **accent-filled catalogue strip**
  (`RL–067 / ESSAY / …` on a solid accent bar) and **tracklist contents
  rows with dotted leaders to a mono date**. The strip is a hard **reject**:
  a solid accent-background bar with text on top is exactly the
  accent-colors-text violation the load-bearing discipline forbids (an
  arbitrary per-post hex behind small type cannot hold AA). The dotted
  leaders were the one idea worth a real look.

- **field-notebook** & **marginalia** — both hang everything on an 8–16rem
  **margin rail** (§ counters, dates, № catalog numbers, asides in the
  gutter). Genuinely elegant, and genuinely a *different blog*: the rail
  reflows to callouts below ~1140px and rewrites the whole layout contract.
  Sleeve & Shelf deliberately keeps a single 42rem column with a **spine**,
  not a rail; adopting the rail is a redesign, not a splice. The one
  gutter idea that composes with a spine — a **margin aside** (`.bp-aside`)
  — already ships (it floats into a wide-screen gutter, styles.css:787).
  marginalia's **※ reference mark as house glyph** is a nice touch but
  decorative; the committed system's mono eyebrow already carries kind.

- **darkroom** — committed-dark, "photographs are the brightest object."
  A strong photo-blog identity, but it throws away light mode entirely,
  and Sleeve & Shelf's photo-post register (dimmed images, italic-caption
  discipline, real dark *and* light) already covers the reader value
  without the commitment. Reject on scope. Its **FR frame-number spine**
  overlaps our spine concept and would need a per-post sequence number the
  data model doesn't carry.

## The one real probe: tracklist dotted leaders on the shelf

I rendered the committed shelf against a variant with liner-notes' dotted
leaders (title → leader → mono date) — `shelf-base.png` vs
`shelf-leaders.png` beside this file. On plain rows
(notes, links, titled-only entries) the leader genuinely helps the eye
track title to date — it is on-register (a tracklist is a sleeve object).
But every essay entry carries a **dek**, and the leader + wrapped dek reads
busy: two horizontal rules of information (the leader, then the dek) fight.
The committed shelf's baseline-aligned title/date with the dek hung
underneath is calmer at the density this blog will actually have.

**Held, not adopted.** If the shelf ever needs more scannability at scale,
dotted leaders scoped to dek-less rows (notes/links) are the first thing to
reach for — recorded here so a future session doesn't re-derive it. It is
not a clear win over what ships, so it does not ship.

Full 40-device inventory with evidence lives in the phase-2 verify/judge
workflow journal (transcript dir under the session's workflows/).
