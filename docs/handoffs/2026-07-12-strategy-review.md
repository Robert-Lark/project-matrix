# Handoff — strategy review (2026-07-12)

**Ticket:** strategy-review (the final Fable 5 session). One deliverable, landed:
[`docs/reviews/2026-07-12-strategy-review.md`](../reviews/2026-07-12-strategy-review.md).

## What ran

The skeptical-staff-architect pass over the decision layer only (thesis + sparse matrix,
ADR-0001..0005, CONTEXT.md, prototype FINDINGS, tool READMEs' public claims). Five lenses,
sequential, one context: fairness/methodology → hiring-signal → real-world-replication →
cost-model → completeness critic. Steelman first, then attack; every citation re-verified
against source in-session. Two read-only probes against the live plane (fresh `?run=`
nonce): the KV warm/cold/bypass seam and `GET /api/snapshot`. No code reviewed, no fixes
applied, no ADR edited — findings live in the review artifact only.

## Result shape

- **2 kill-shots:** (1) ADR-0004 §6's anti-synthetic-throttle language contradicts the
  CDP-throttled bench runner — quotable ammunition against every slow-network cell;
  (2) the thesis is fenced off-page while `home-surface` (its only carrier) is scoped
  "nothing complex."
- **11 discounts** — including: the loaders column breaks "exactly one architectural
  move"; Checkout's INP spotlight is unproducible under ADR-0001's own rules; the live
  `SnapshotManifest` serves `"commitSha": null` against a "tied to commit SHAs" promise
  (probed); "idiomatic, not hand-tuned" has no enforcement mechanism; KV "reproducible
  everywhere" + bare "400ms→15ms" magnitudes; the fat-tray byte confound; invalidation as
  the unnamed thing freezing hides; toy origin compute; cost-cell h-sensitivity + the
  implicit deployed-CPU gate; Discogs image ToS unchecked; field-spread display the ADR
  itself calls unstable.
- **8 nitpicks**, **14 survived attacks** (with quotes — interview ammunition), and a
  12-question interview sheet with three questions the docs cannot yet answer (throttle
  defense, noise rule, Checkout INP).

## For Rob

Verdict is hire-leaning; the artifact's verdict paragraph names the two highest-leverage
fixes (both doc edits): resolve the throttling contradiction, and re-scope `home-surface`
as the thesis-carrier. Everything is a recommendation — nothing was ticketed or changed.
Suggested cheap wins if you agree with them: findings 5 (backfill commitSha), 7 (language
fix), 14 (CONTEXT.md "five pages"). Committed locally; push is yours.
