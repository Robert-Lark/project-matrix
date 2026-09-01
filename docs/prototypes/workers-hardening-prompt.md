# Type the workers plane, and make the publication gate's refusals permanent

**Priority 5 of the 2026-08-29 audit.** Two structural gaps, both confirmed by an
adversarial pass, both in the part of the repo a sceptical reviewer reads first when the
claim is "staff-level":

1. Every package is strict TypeScript (`tsconfig.base.json`: `strict` +
   `noUncheckedIndexedAccess`) — but the entire workers plane is **3,879 LOC of untyped
   plain JS** with zero `@ts-check`, zero JSDoc type tags, and no typecheck task, and that
   includes the blog's auth/session/CSRF/SQL code. No ADR or README records why the boundary
   sits there (contrast: `packages/reference/render/lib.mjs:10-13` documents its own `.mjs`
   choice).
2. The anti-rigging publication gate — the refusal set in `workers/front/build.mjs`
   (1,280 lines, **54 throw sites**, ~33 in `bundleFromReceipt` + the receipt loop) — is
   enforced only by one-time manual sabotage proofs recorded in the decision map. Nothing
   re-proves a single refusal fires. The repo itself already met this failure class once and
   ruled on it: `build.mjs:733-740` records REMOVING a guard because "an unfireable guard
   advertises coverage it lacks". A refactor that inverts one condition ships silently today.

Re-open every citation before editing; all verified 2026-08-29.

---

## Task 1 — typecheck the workers

Pick one, then write the boundary rule down:

- **(a) `// @ts-check` + JSDoc typedefs** per worker file, `tsc --noEmit --checkJs` as each
  worker's `typecheck` script, env bindings typed via wrangler's `cf-typegen` (the eslint
  config already references it). Zero build-output change — the paradigm-purity argument for
  plain JS in Workers survives intact.
- **(b) Convert the three `src/` trees to TS.** Cleaner types, but changes the build story
  for three deployed Workers; weigh against (a)'s near-zero blast radius.

Recommendation: (a). The typo class it kills is real — result unions like `savePost`'s
`{ok}/{error,status}` (`workers/blog/src/db.js:73-88`) are checked only by caller convention
today (`workers/blog/src/index.js:288-296`).

Wire the new `typecheck` scripts into turbo so `pnpm check`'s task count grows — derive the
new count, never type it (`turbo run lint typecheck test --dry=json | jq …`, the map's own
rule at `decision-map.md:434`).

## Task 2 — fixture-driven refusal tests for the publication gate

- Lift `bundleFromReceipt` + the receipt-loop validation out of `build.mjs` into an
  importable module (`workers/front/lab/publish.mjs` or a package), leaving `build.mjs` the
  thin composer. (`grep -rln bundleFromReceipt` outside build.mjs → nothing imports it today.)
- One committed malformed receipt fixture per refusal class — dirty SHA, cross-tree,
  band-overlap, interaction-constancy, batch-integrity, chrome-constant identity, the
  attestation gate once the measurement pass lands it — each asserted to **throw with its
  own message** (the repo's rule: a guard whose failure cannot be read gets muted,
  `decision-map.md:454`).
- This converts the map's fourteen recorded one-time sabotages into permanent legs. Give the
  suite a non-vacuity clause (the fixture list can never be empty) — the anti-pattern the
  repo already names.

## Task 3 — three small quality fixes found on the way (lines, not sessions)

- **Beacon value coercion:** the edge collector coerces a missing metric value to 0 instead
  of rejecting — locate via `grep -n 'Number(' workers/edge/src/index.js` and 400 instead;
  a fabricated 0 is a lie in a dashboard.
- **`esc()` drift:** the blog's escaper does not escape single quotes while the repo's other
  five do — `grep -rn "function esc" --include='*.mjs' --include='*.js' | xargs grep -l "'"`
  to compare; align it (defense in depth — current call sites were audited safe).
- **Cold PDP read parses the whole ~945 KB details tray per request**
  (`workers/edge/src/index.js`, the `/api/pdp/:id` path) to serve one release. Fine at
  portfolio scale; note it in the file as a known cost or index the tray at seed time —
  your call, but say which.

## Done means

`pnpm check` runs a typecheck over all three workers and it is green; a deliberate typo in a
result-union field name fails the build; every publication-gate refusal class has a fixture
test that fails when its condition is inverted (prove one by sabotage in the PR body);
turbo count re-derived and recorded.
