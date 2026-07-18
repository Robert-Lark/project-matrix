# PM Instrument Mono — provenance

The chrome's receipt/metric voice (surface-design session, 2026-07-17): a
Basic-Latin subset of **JetBrains Mono v2.304** (variable `wght`), declared in
`../src/chrome.css` and served from the front Worker's `/_pm/fonts/` — the
instrumentation path whose bytes are excluded from every variant's measured KB
(ADR-0001 §6). It is CHROME-OWNED on purpose: the store's `--pm-font-metric`
stays Familjen Grotesk (ADR-0006 §3, "one face for UI and metrics" — pouring a
mono into the metric slot would change every store price and re-litigate the
Catalogue pick). ADR-0006's alternatives note reserved exactly this route:
"Its receipt/mono language remains reachable later through the
`--pm-font-metric` slot and chrome CSS without touching a component."

- Source: `fonts/variable/JetBrainsMono[wght].ttf` from the
  [JetBrains/JetBrainsMono v2.304 release](https://github.com/JetBrains/JetBrainsMono/releases/tag/v2.304)
  (retrieved 2026-07-17).
- Licensed under the **SIL Open Font License 1.1**
  ([LICENSE-OFL-JetBrainsMono.txt](LICENSE-OFL-JetBrainsMono.txt)); the OFL
  copyright line declares no Reserved Font Name restriction that would bar a
  renamed subset, and the family is renamed ("PM Instrument Mono") to make the
  subset's non-canonical coverage obvious.
- Why a mono, why this one: a monospace is tabular by construction (the
  strip's fixed-width value slots depend on it), and the instrument register —
  the deadwax/receipt voice ADR-0006 §1 reserved for chrome — was the
  Faceplate board's most memorable element (mono metrics, ADR-0006
  alternatives). Weight range 100–800 kept variable so the strip's 400/700 are
  real.

## How it was subset (reproducible)

```sh
pip install fonttools brotli
pyftsubset "JetBrainsMono[wght].ttf" \
  --flavor=woff2 \
  --output-file=PMInstrumentMono.var.woff2 \
  --unicodes="U+0020-007E,U+00A0,U+00B7,U+00D7,U+2013,U+2014,U+2026,U+2191,U+2193,U+25B4,U+25BE" \
  --layout-features='tnum,zero,liga'
```

Basic Latin + the instrument's punctuation (interpunct, ×, dashes, ellipsis,
arrows for future deltas, the ▾/▴ disclosure markers — the instrument's one visible glyph must never come from a per-OS fallback; verify-slice F5). Result: 111 glyphs, ~12 KB woff2. The chrome never
renders crate text (titles stay in the store register), so no wider coverage
is owed; if a chrome string ever needs a codepoint outside this set, re-run
the recipe with it added.
