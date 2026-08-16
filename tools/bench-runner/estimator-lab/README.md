# Estimator lab — the evidence behind ADR-0001 addendum O

The `bench-instrumentation-dilution` unit's central decision — which
estimator splits a document's compressed `transferSize` across
html/js/data/instrumentation — was settled by measurement, and this
directory is that measurement, committed so it re-derives offline
(ADR-0001 §9: publish the arithmetic). `bodies/` holds the exact
Cloudflare-served brotli bodies the candidates were computed over
(sha256-manifested in `manifest.json`); the live pages will drift, these
bytes will not.

Run it:

    node estimator-lab.mjs

It computes four candidates — the superseded uncompressed share (addendum
G), isolated-region + normalise ("the fix as written"), leave-one-out +
normalise (chosen), and Shapley over the four parts — at q11 and at the
wire-calibrated quality, on all three delivery shapes, plus the two
deciding probes:

- **Probe A (chrome-swap invariance):** the recorded defect's own shape —
  swap the populated editorial chrome for the PDP's real empty-state
  chrome on a fixed page and watch the JS attribution. Old rule: 14.1%
  drift. Chosen rule: 0.3%.
- **Probe B (external recovery):** inline a copy of vanilla's real
  `cart.js` and compare the JS attribution against the identical file's
  actual external wire cost (1,351 B — which standalone brotli-q4
  reproduces exactly). Old rule: −40.5%. Chosen rule: −2.2%.

The calibration table it prints is where "Cloudflare's wire is brotli q4
within 0.1–0.3%" comes from. The production implementation
(`../src/collect.ts` `decomposeDocument`) was verified to reproduce this
lab's numbers exactly on all three bodies.
