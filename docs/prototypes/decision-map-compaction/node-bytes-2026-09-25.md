# Decision-map node bytes — before and after compaction (unit 9, 2026-09-25)

Written by `node-bytes-table.mjs` beside this file over two runs of `node-bytes.mjs` (a node is its `### ` heading line through the line before the next `### `, in UTF-8 bytes — the span the repo-checks leg `decision-map-node-cap.test.ts` measures). "Before" is the map at `7a3f568` (`git show`); "after" is the map on disk. Nothing here is typed: re-run `node docs/prototypes/decision-map-compaction/node-bytes-table.mjs` and the file is rewritten.

## Totals

| measure | before | after |
|---|---|---|
| `wc -c docs/decision-map.md` | 255,899 B | 147,981 B |
| nodes (`grep -c '^### '`) | 35 | 35 |
| sum of node bytes | 249,644 B | 140,326 B |
| the sixteen compacted nodes | 194,144 B | 84,826 B |
| largest RESOLVED node | 21,937 B (`plp-htmx`) | 6,707 B (`checkout-measure-prep`) |
| median RESOLVED node | 6,365 B | 4,113 B |
| resolved / open nodes | 31 / 4 | 31 / 4 |
| cap (`NODE_CAP_BYTES`) | — | 7,168 B |

## Per node, sorted by size before

| node | status class | before | after | compacted |
|---|---|---|---|---|
| `plp-htmx` | resolved | 21,937 | 5,333 | yes |
| `plp-react-next` | resolved | 17,022 | 4,384 | yes |
| `pdp-build` | resolved | 15,805 | 4,923 | yes |
| `editorial-build` | resolved | 15,732 | 6,029 | yes |
| `checkout-measure-prep` | resolved | 15,667 | 6,707 | yes |
| `workers-hardening` | resolved | 13,915 | 6,327 | yes |
| `interaction-registry` | resolved | 13,767 | 5,365 | yes |
| `checkout-vanilla` | resolved | 11,664 | 5,729 | yes |
| `pdp-controls` | resolved | 10,607 | 5,685 | yes |
| `security-floor` | resolved | 9,879 | 5,574 | yes |
| `plp-data-plane` | resolved | 9,613 | 5,595 | yes |
| `bench-accounting-fix` | resolved | 8,538 | 4,113 | yes |
| `bench-instrumentation-dilution` | resolved | 8,330 | 4,458 | yes |
| `a11y-section` | resolved | 8,010 | 5,566 | yes |
| `editorial-bench-batch` | resolved | 7,293 | 4,552 | yes |
| `how-it-was-built` | resolved | 6,365 | 4,486 | yes |
| `measurement-pass` | open (exempt) | 4,852 | 4,852 | — |
| `deployment-topology` | resolved | 3,636 | 3,636 | — |
| `data-contract` | resolved | 3,516 | 3,516 | — |
| `aesthetic-direction` | resolved | 3,370 | 3,370 | — |
| `data-strategy-lab` | resolved | 3,355 | 3,355 | — |
| `measurement-methodology` | resolved | 3,347 | 3,347 | — |
| `blog` | resolved | 3,293 | 3,293 | — |
| `remix3-frontier` | resolved | 3,282 | 3,282 | — |
| `design-system` | resolved | 3,268 | 3,268 | — |
| `foundation-build` | resolved | 3,192 | 3,192 | — |
| `home-surface` | resolved | 3,078 | 3,078 | — |
| `crate-glyph-coverage` | resolved | 2,954 | 2,954 | — |
| `cf-composition-spike` | resolved | 2,853 | 2,853 | — |
| `surface-design` | resolved | 2,805 | 2,805 | — |
| `snapshot-capture` | resolved | 2,349 | 2,349 | — |
| `masthead-brand-target` | open (exempt) | 2,190 | 2,190 | — |
| `(fog) remaining per-surface builds` | open (exempt) | 1,924 | 1,924 | — |
| `domain-cutover` | open (exempt) | 1,744 | 1,744 | — |
| `thesis-and-curation` | resolved | 492 | 492 | — |

Open nodes (exempt from the cap, untouched by this unit): `measurement-pass`, `masthead-brand-target`, `(fog) remaining per-surface builds`, `domain-cutover`.
