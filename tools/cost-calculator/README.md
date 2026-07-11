# @pm/cost-calculator

The [ADR-0001 §7](../../docs/adr/0001-benchmark-measurement-methodology.md)
cost model as auditable arithmetic (issue #8): a measured **resource
profile** × a dated, swappable **rate card** → **$/1M visits**, with every
intermediate step published so a skeptic swaps inputs and re-runs instead of
arguing with a bottom line.

```
pnpm cost from-receipt tools/bench-runner/receipts/receipt-….json \
  --card tools/cost-calculator/ratecards/2026-07-10-usd.json \
  --cache-hit 0.9 --region us-east \
  --architecture-host cloudflare-workers-paid \
  --host /placeholder-static/sample/=cloudflare-workers-paid \
  --host /placeholder-ssr/sample/=cloudflare-workers-paid \
  --host /api/plp=cloudflare-workers-paid \
  --monthly-visits 3000
```

Reports land in `tools/cost-calculator/reports/` (gitignored — published
numbers ship as dated snapshots downstream, ADR-0001 §9) and render to the
terminal with the full arithmetic.

## The split that carries the model (ADR-0001 §7)

- **Measured resource profile** — CPU-ms, bytes, requests per visit, read
  from a bench receipt's per-target `resourceProfile` (cold + warm columns).
  Every field names its accounting source; a field the source genuinely
  can't account is **null and stays null** — the line prices as UNPRICED
  and the total goes null (a partial subtotal is labeled partial, never
  passed off as the answer). One deliberate exception: a **$0 rate prices
  any usage at exactly $0** — the cost is arithmetic, not an estimate,
  even when the usage itself is unknown.
- **Rate card** — a dated JSON document (`ratecards/`). Swapping prices is
  swapping the file; the calculator has no price knowledge of its own.
  Every rate carries the verbatim vendor quote + URL it was verified from,
  and each host **declares the vendor meters the profile cannot account**
  (`unmeasured`, e.g. Vercel's Provisioned Memory and Fast Origin Transfer)
  so they surface as stated limits instead of silently vanishing.

## Required, explicit inputs — never defaults hidden in code

- `--cache-hit` — blends the receipt's two **measured** columns:
  `expected = h × warm + (1 − h) × cold`. Nothing is modeled, only weighted.
- `--region` — resolved against the card's own region vocabulary (the card
  documents which vendor region each name maps to; unknown regions error,
  naming what the card knows).
- `--architecture-host` — the **architecture-only view**: one host's rates
  applied to every variant, isolating paradigm from vendor.
- `--host <path>=<hostId>` per target — the **real-world view**: each
  variant on its actual host. An unmapped target errors.
- `--monthly-visits` (optional) — the **actual-charge view**: free-plan fit
  (the honest ≈$0 to date; free plans block rather than bill, and the
  arithmetic shows the headroom) + the paid-plan bill (base fee + included
  allotments + credits + marginal overage).

## Views

The $/1M-visits views price at **marginal rates** (beyond included monthly
allotments) — the stated assumption is that base fees and allotments
amortize toward zero at scale; they enter the actual-charge view instead.

## Assertions

No `test` script (`@pm/origin-suite` precedent). The arithmetic is asserted
pure — exact hand-computed dollars, `toBe` not `toBeCloseTo` — by
`tools/origin-suite/suite/cost.test.ts`; input-shape alignment with real
receipts and the shipped card is proven at the composed-origin seam by
`suite/bench.browser.test.ts`. The honest-null CPU branch is asserted
locally (V8 inspector profiles) on every suite run; the deployed branch
(UNPRICED with the armed-path source named) is written into the same test
and runs in the post-deploy smoke once the Cloudflare secrets arm — not
yet exercised.
