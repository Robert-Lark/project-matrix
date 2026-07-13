# Familjen Grotesk — provenance

The design-system face: a controlled constant across every variant (ADR-0003
§8), chosen by the `aesthetic-direction` ticket (ADR-0006 — the "Catalogue"
pour, 2026-07-12). It replaced the interim "PM Placeholder Sans" (a renamed
Inter subset); swapping was, by design, this directory + the `--pm-font-*`
primitives in `../css/tokens.css` — zero component changes.

## What it is

A Latin subset of **Familjen Grotesk v2.002** (variable).

- Source: `FamiljenGrotesk[wght].ttf` from the
  [google/fonts repo](https://github.com/google/fonts/tree/main/ofl/familjengrotesk)
  (retrieved 2026-07-12); upstream project per the license line:
  Copyright 2021 The Familjen Grotesk Project Authors
  (github.com/Familjen-Sthlm/Familjen-Grotesk).
- Licensed under the **SIL Open Font License 1.1**
  ([LICENSE-OFL.txt](LICENSE-OFL.txt), which travels with the font). The OFL
  copyright notice declares **no Reserved Font Name**, so a subset keeping the
  original family name is OFL-compliant with the license shipped alongside.
- Why this face: true variable `wght` 400–700 (the token scale's 550 medium is
  real, not synthesized), OpenType **tabular figures** (`tnum`) for aligned
  prices/HUD metrics (ADR-0003 §8), and a warm Scandinavian-grotesk voice that
  fits the Catalogue direction and the crate it frames — verified with
  fontTools before adoption (candidates without `tnum`, e.g. Hanken Grotesk,
  were rejected; see `docs/prototypes/aesthetic-direction/directions/`).

## How it was subset (reproducible)

```sh
pip install fonttools brotli
pyftsubset "FamiljenGrotesk[wght].ttf" \
  --flavor=woff2 \
  --output-file=FamiljenGrotesk.var.woff2 \
  --unicodes="U+0000-00FF,U+0100-024F,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+26A0,U+FEFF,U+FFFD" \
  --layout-features='*'
```

Latin-1 + Latin Extended-A/B (so European accents in the crate — `ā`, `ś`, … —
render from the controlled face, not an OS fallback) + General Punctuation +
the store's symbols; `--layout-features='*'` keeps every OpenType feature,
including `tnum`. Result: 524 glyphs, ~24 KB woff2 (the full variable TTF is
~88 KB). Italic deliberately not shipped — no store surface uses it; add the
italic variable TTF here if one ever does.

**Coverage against the frozen crate.** Familjen is a Latin face; the crate
(issue #9) is not purely Latin. `U+26A0 (⚠)` — a component-CSS dependency,
below — is supplied by a fallback. Beyond it, **30 crate codepoints are not
covered by any Latin face** — chiefly `U+2153 ⅓` (179×, "33⅓ RPM") and
`U+2117 ℗` (74×), plus CJK/Arabic/Greek/Cyrillic/math across a few releases.
These are a deferred **i18n / font-fallback decision** (the
`crate-glyph-coverage` ticket), latent until a crate-rendering surface ships.
The exact set lives in [`coverage.json`](coverage.json) and is guarded by
`tools/repo-checks/test/font-covers-crate.test.ts`.

**`coverage.json` (regenerate when a font or the crate changes).** It pins
each shipped font by sha256 and records its cmap, so the coverage guard
(`tools/repo-checks/test/font-covers-crate.test.ts`) needs no font parser in
the Node test env. Regenerate with fontTools (run from this `fonts/` dir):

```python
import json, hashlib, collections
from pathlib import Path
from fontTools.ttLib import TTFont
FONTS = ["FamiljenGrotesk.var.woff2", "PMWarnGlyph.U26A0.woff2"]
CRATE = Path("../../../tools/snapshot-capture/crate")  # display trays below
def cmap(p):
    s = set()
    for t in TTFont(p)["cmap"].tables: s |= set(t.cmap)
    return s
def strings(o):
    if isinstance(o, str): yield o
    elif isinstance(o, dict):
        for v in o.values(): yield from strings(v)
    elif isinstance(o, list):
        for v in o: yield from strings(v)
covered = set().union(*(cmap(f) for f in FONTS))
used = collections.Counter(
    ord(c) for tray in ("summaries.json", "details.json", "curation.json")
    for s in strings(json.loads((CRATE / tray).read_text()))
    for c in s if ord(c) > 0x7F)
json.dump({
    "fonts": {f: {"sha256": hashlib.sha256(Path(f).read_bytes()).hexdigest(),
                  "codepoints": sorted(cmap(f))} for f in FONTS},
    "crateDeferredI18n": sorted(cp for cp in used if cp not in covered),
}, open("coverage.json", "w"), indent=1)
```

**One glyph is NOT in Familjen: `U+26A0` (⚠).** The field component's error
affordance renders it via `content: "\26A0"` (`css/components/field.css`), but
Familjen Grotesk has no glyph for it, so `pyftsubset` silently drops it from
the subset above. Left unhandled, that one icon would fall back to the
visitor's OS font — per-platform metrics, and a colour-emoji presentation on
some platforms that ignores the forced-colors remap. So it is supplied
separately:

### `PMWarnGlyph.U26A0.woff2` — the ⚠ fallback (1 glyph)

A 1-glyph monochrome subset of **Inter v4.1** (SIL OFL 1.1 —
[LICENSE-OFL-Inter.txt](LICENSE-OFL-Inter.txt); Copyright © 2016 The Inter
Project Authors, no Reserved Font Name), declared in `css/fonts.css` as the
`"PM Warn Glyph"` family and added to the `--pm-font-*` stacks *after*
Familjen, scoped by `unicode-range: U+26A0` so it is consulted for that
codepoint alone. The error icon therefore renders from a self-hosted webfont
identically on every platform (ADR-0001 fairness) and stays monochrome under
forced-colors (ADR-0003 §5) — restoring exactly what the interim Inter
placeholder did before the Catalogue pour (ADR-0006).

```sh
pyftsubset Inter.woff2 \
  --flavor=woff2 --output-file=PMWarnGlyph.U26A0.woff2 \
  --unicodes="U+26A0" --layout-features='' --no-layout-closure
```

Result: 2 glyphs, ~1.2 KB woff2. If a future face includes ⚠ natively, drop
this file, its `@font-face`, and the `"PM Warn Glyph"` stack entries.

## Loading

`../css/fonts.css` carries the single `@font-face`; [`loading-markup.html`](loading-markup.html)
is the canonical `<head>` markup every consumer copies (only the base path may
differ). Font delivery is a controlled constant across variants — never a
per-paradigm optimization surface.
