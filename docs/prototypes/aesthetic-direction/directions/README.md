# aesthetic-direction — candidate boards

Three competing pours of the primitive token tier (ADR-0003 §7), each rendered
against the REAL system: shared `tokens.css` semantic tier → candidate fonts →
candidate primitives → the real component modules + injected-chrome CSS, with
real covers from the frozen crate. The markup is identical across all three —
what differs is exactly what the real pour will change, nothing else.

| Board | Corner of the subject | Faces (all SIL OFL 1.1, subset per `packages/tokens/fonts/README.md`) |
|---|---|---|
| `a-catalogue` | the label's own catalogue (neo-classical print culture) | Familjen Grotesk (var 400–700, tnum) |
| `b-faceplate` | the instrument panel (hardware/techno) — the ONE theme poured dark | Public Sans (var 100–900, tnum) + JetBrains Mono metrics |
| `c-runout` | the pressing-plant document (deadwax/spec-sheet) | Archivo (var wght × wdth 62–125, tnum) |

## Reproduce

```sh
node build-previews.mjs                # regenerates each */preview.html from picks.json
node audit-contrast.mjs */tokens.css   # WCAG AA at token-definition time; exit 1 on failure
open a-catalogue/preview.html          # file:// is fine; no server needed
```

Cover art is referenced by absolute `file://` path into the MAIN checkout's
`tools/snapshot-capture/crate/img/` (image bytes are deliberately git-excluded
— see issue #9). `picks.json` is 10 releases chosen for year/style/price
spread (the $0.04 and the $515.24 are both in).

## Method notes (2026-07-12)

- Palettes were audited programmatically BEFORE viewing (36/36 AA pairs pass,
  nothing under 5.7:1), then each board took one screenshot-critique pass
  against contrast / hierarchy / alignment / proximity / repetition / balance /
  white space / unity. Revisions are commented inline in each `tokens.css`
  (A: title size; B: body-cream contrast; C: bold weight).
- Narrow-viewport reflow spot-checked at 375px (chrome wraps, no horizontal
  scroll). Forced-colors + drift-gate verification belong to the pour, not the
  boards — the semantic tier these boards inherit is unchanged.
- Candidate faces were verified with fontTools before adoption (axes + true
  550 + `tnum`); Hanken Grotesk was rejected for lacking tabular figures.
- The presentation artifact (side-by-side screenshots + choose-if framing) was
  published from this exploration; the `preview.html` pages are the source of
  truth.

The pick pours into `packages/tokens/css/tokens.css` primitives + a font swap,
and is recorded as an ADR. Semantic tokens and components stay untouched.
