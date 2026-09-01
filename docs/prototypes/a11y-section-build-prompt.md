# Build /vanilla/a11y/ — the section is designed, its footer link 404s site-wide

**Priority 6 of the 2026-08-29 audit (tied with how-it-was-built).** The audit found the
decision map counts the how-it-was-built footer 404 (~2,006 links) but never records that
the SAME footer's "Accessibility, shown" link → `/vanilla/a11y/`
(`packages/reference/render/shell.mjs:36-43,:162`) 404s from every store page too — verified
live 2026-08-29. Two dead links named after the project's two proudest claims, in every
footer. The design is already settled; this is a build session, not a design session.

---

## The contract (all pre-decided — do not re-litigate)

ADR-0008 §8 designed the section; `decision-map.md:203` records the resolution:

- Three pages under `/vanilla/a11y/`: **index** (what the section is) · **element demos**
  (five two-box compares on one consolidated page — focus, forms, target size, contrast,
  live regions) · **mode demos** (forced-colors, zoom/reflow, reduced-motion as
  additive-only emulations gated behind the real media queries, with the caveat "your OS
  setting is the real thing — these demos never override it").
- Walkthrough label FIRST, DS-ON box adjacent, DS-OFF twin inside a collapsed `<details>`
  (natively unfocusable, hidden from AT until deliberately opened); the element-demos page
  is `noindex`. Strategy-review finding 21's three conditions hold by construction — keep
  them holding.
- The default state of every page is fully conformant.
- Reference renders are already committed (`packages/reference/surfaces/a11y/…`) with the
  `compare` and `mode-demo` DS components — the masters are the spec; the vanilla variant
  build makes them true at the composed origin.
- Hosted in vanilla only (orthogonal to the render/data axes); a11y-mode toggles live
  in-page, NOT in the chrome (ADR-0004 §7 amendment, ADR-0008 §4).

## Duties the recent surfaces established (apply them here from the start)

1. **Register the surface in `packages/switcher/src/config.ts` in the same commit as the
   routes it makes true** — the parallel-builds lesson (`decision-map.md:243`): all three
   PLP/checkout PRs shipped pages the instrument reported as unserved.
2. **No pre-merge-unread enhancement** — every script-set state attribute must be reachable
   by `pdp-controls-wired`-class guards; the dead-controls precedent
   (`decision-map.md:325-329`) is exactly the failure this section cannot afford: an
   accessibility exhibit with inert controls is the project's worst possible bug.
3. **Every `pm-` class a master renders resolves to a rule in a sheet that master links**
   (`master-styles-resolve` will enforce it; check the OWED registry first).
4. **Flip home's PM-005 row** if `SURFACE_CONTROLS` completion state warrants it, per the
   editorial precedent — and update the footer-link expectation legs.
5. The mode demos' honesty caveat is content, not chrome — the emulation-≠-OS-mode
   disclosure ships on-page.

## Done means

`/vanilla/a11y/` serves 200 with all three pages through the composed origin in both
snapshot modes; zero footer links to the section 404; the element-demos page carries
`noindex` and its DS-OFF twins are unfocusable until opened; drift gate green against the
committed masters; every new guard sabotage-proven and restored from a backup copy; the
surface registered in the same commit as its routes.
