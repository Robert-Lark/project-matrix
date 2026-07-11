# Handoff — remix3-frontier resolved (2026-07-11)

**Session summary:** the `remix3-frontier` decision-map ticket resolved as
[issue #10](https://github.com/Robert-Lark/project-matrix/issues/10). The
fenced Remix 3 showcase is **hosted on the canonical plane via a
hand-rolled Workers entry** — proven by a runnable spike, not doc-reading.
Full narrative: `docs/build-log.md` Phase 4; canonical state:
`docs/decision-map.md`; evidence + citations:
`docs/prototypes/remix3-frontier/FINDINGS.md`; hosting decision recorded in
the ADR-0004 second addendum.

## What exists now

- `docs/prototypes/remix3-frontier/` — self-contained npm spike (like
  cf-composition): one host-agnostic Remix 3 app (editorial page +
  `<Frame>` staff-pick partial + anchor-driven partial reloads + one
  hydrated island + the fence plaque) served by BOTH a ~15-line Workers
  entry (wrangler dev :8931, **no nodejs_compat**) and the official
  template's `node:http` shape (:8932). `test.sh`: 42/42 on both hosts +
  cross-host identity; browser leg verified (frame reload without document
  reload, island state survives, history traversal). Fresh-clone proven
  (`npm ci` → build → all green).
- Research: 4 areas, 54/54 claims adversarially confirmed (2026-07-11).
  Status unchanged since 07-06: `3.0.0-beta.5` newest anywhere, "not
  production ready" unretracted, no official deploy target beyond the
  Node ≥24.3 template. Decisive gap closed empirically: no official
  example runs `@remix-run/ui` on Workers — the spike does.

## Decisions the Editorial build consumes (recorded, reviewable)

1. **Hosting**: Workers entry on the canonical plane; off-plane Node host
   is the recorded fallback with a named revisit trigger (FINDINGS §6).
2. **The exhibit owes the ADR-0003 markup/CSS contract** — fencing
   excludes numbers, not visual identity (FINDINGS §7a).
3. **Drift gate covers remix3 in advisory mode** — warns, never fails CI
   (FINDINGS §7b). Paradigm noise to register when wiring it: `rmx:f`/
   `rmx:h` comment markers, the `#rmx-data` script, `rmxc-*` classes.
4. **Labeling**: on-surface plaque (`data-pm-fenced="true"` + exact
   version + "excluded from every benchmark number"), pre-release tag in
   the switcher control, HUD shows RUM-only (no lab snapshot by policy),
   bench runner never batches `/remix3/*` (FINDINGS §7c).
5. **Exact-pin `3.0.0-beta.5`** — the metapackage carets its sub-packages,
   so the committed lockfile is the real pin; the spike's `test.sh` is the
   canary on any bump. Known frictions if you touch the spike:
   `clientEntry()` needs a stable ID on workerd (`import.meta` is empty at
   runtime there — probed); client assets are prebuilt (esbuild) because
   the template's runtime asset server is Node-only.

## Rob-gated (unchanged)

Deploy secrets (#3/#1, runbook `workers/README.md`) → then the
snapshot-aware smoke fix → `pnpm capture seed --remote`; the
"Prometheus Studio" label question; the two published-data flags;
`.claude/workflows/verify-slice.js` args-parse patch (the gotcha fired
again this session; session-copy workaround worked as documented).

## Housekeeping

- Spike dev servers on ports 8931/8932 (+9331 inspector) may still be
  running — `lsof -nP -iTCP:8931 -sTCP:LISTEN -t` etc., kill when done.
  They're outside the repo's reserved port set.
- `caffeinate -is` PID 45961 still running (reused from the last
  session) — `kill 45961` when you're done.
- Something serves 127.0.0.1:8787 (a placeholder page was open in
  Chrome) — possibly Rob's parallel track; deliberately not touched.

## The map now

Open and unblocked: `data-strategy-lab` (grilling — needs Rob),
`a11y-section`, `home-surface` (+ `aesthetic-direction`, Rob's track).
#3/#1 stay open on the deploy leg. Per the map discipline: one ticket per
session, Rob picks the next node.
