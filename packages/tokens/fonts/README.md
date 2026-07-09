# PM Placeholder Sans — provenance

**⚠ Placeholder face.** This is an interim, clearly-labeled stand-in (ADR-0003
§7–§8): the real typeface pairing is decided in the `aesthetic-direction` ticket
and swaps in by replacing these files and the `--pm-font-*` primitives in
`../css/tokens.css` — zero component changes.

## What it is

A Latin subset of **Inter v4.1** (variable), renamed at the CSS layer to
`PM Placeholder Sans` so the placeholder status is visible in the name itself.

- Source: `InterVariable.ttf` from
  [github.com/rsms/inter release v4.1](https://github.com/rsms/inter/releases/tag/v4.1)
  (`Inter-4.1.zip`, published 2024-11-16)
- Copyright © 2016 The Inter Project Authors — licensed under the
  **SIL Open Font License 1.1** ([LICENSE-OFL.txt](LICENSE-OFL.txt)). Inter
  declares no Reserved Font Name, so a renamed subset is OFL-compliant with the
  license shipped alongside (this file + LICENSE-OFL.txt travel with the font).
- Why Inter: open license, true variable axes (`wght` 100–900 — the token
  scale's 550 weight is real, not synthesized — plus `opsz` 14–32), and
  OpenType **tabular figures** (`tnum`) for the aligned prices/HUD metrics that
  ADR-0003 §8 requires.

## How it was subset (reproducible)

```sh
pip install fonttools brotli
pyftsubset InterVariable.ttf \
  --flavor=woff2 \
  --output-file=PMPlaceholderSans.var.woff2 \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+26A0,U+FEFF,U+FFFD" \
  --layout-features='*'
```

Latin unicode range plus `U+26A0` (⚠ — used by the field component's error
icon); `--layout-features='*'` keeps every OpenType feature, including `tnum`.
Result: 816 glyphs, ~105 KB woff2 (full file is ~352 KB). Italic deliberately
not shipped — no store surface uses it; add `InterVariable-Italic` here if one
ever does.

## Loading

`../css/fonts.css` carries the single `@font-face`; [`loading-markup.html`](loading-markup.html)
is the canonical `<head>` markup every consumer copies (only the base path may
differ). Font delivery is a controlled constant across variants — never a
per-paradigm optimization surface.
