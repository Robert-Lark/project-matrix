# Handoff — data-strategy-lab resolved (2026-07-12)

**Session summary:** the PLP data-strategy comparison is decided and
prototype-proven. Rob's one call: the misapplication exhibit is **in**;
everything else best-judgment per the standing mode, approved at veto
review ("looks good land it"). Rationale + rejected alternatives in
[ADR-0005](../adr/0005-plp-data-strategy-comparison.md); prototype +
measured evidence at
[`docs/prototypes/data-strategy-lab/`](../prototypes/data-strategy-lab/)
(15/15 probe assertions against the real local composed origin);
narrative in `build-log.md` Phase 5.

## The decisions in one breath

Strategy axis = where the data layer lives (nowhere/browser/server/edge),
each one move from the cold baseline; edge-KV is cold's own build with
the bypass dropped; strategy = path, condition = query, so the switcher's
five (path, query) presets ARE the scenario table; client warmth is a
scripted priming-interaction prefix (never a URL knob) riding the
existing receipt registry; client-cache config is published copy
(staleTime 5min, default's background refetch shown as footnote); all
strategies delegate filter/sort/search to the data plane; six published
cells each prove one thing incl. where each strategy wins; the Apollo
exhibit is fenced, idiomatic, and measured (+65.1 KB vs +9.0 KB brotli
data layer, 7.3×, identical revisit UX).

## What changed

- `docs/adr/0005-plp-data-strategy-comparison.md` — new.
- `docs/prototypes/data-strategy-lab/` — new (README, FINDINGS,
  evidence.json, sources, probe; own npm root with a public-registry
  `.npmrc` — the user-level CodeArtifact default 401s otherwise).
- `CONTEXT.md` — new "Data strategies (PLP)" vocabulary: data strategy,
  client warmth, priming interaction, misapplication exhibit.
- `docs/decision-map.md` — data-strategy-lab resolved (8 decisions);
  locked-axes note records the exhibit as in (Rob 2026-07-12).
- `docs/build-log.md` — Phase 5 entry.
- No composed-origin code touched (prototype interactions are page-flips
  precisely so the origin stayed untouched; origin-suite runs not
  required).

## What the next ticket (the PLP build) consumes

- ADR-0005 §5: the edge Worker's canonical `genre/style/format/sort/q`
  params — validated against real facet values, 400 on junk, no junk KV
  keys.
- §3: the bench registry's `{ prime?, measure }` extension + the six
  named sequences; wall-ms per measured step joins the receipt.
- §2: the routes + switcher presets; beacon strategy rides `surface` tag
  values (`plp-*`), no contract change.
- §8: per-interaction HUD readout + replay affordance (chrome, stripped
  from measured KB).
- §4: the published staleTime and the footnote run.
- FINDINGS §6: the tray sends facet counts on every page — a data-plane
  design note for that ticket (per-interaction bytes favor hypermedia
  partials until considered).
- The HTMX variant Worker owes the x-pm-cache-state pass-through onto
  HTML (prototype-proven pattern).

## Housekeeping

- `pnpm dev` was stopped mid-session (background task killed) — nothing
  left running from it; the prototype's node server on :8940 was killed
  at close. Re-run per `workers/README.md` when needed.
- Playwright CDN is TLS-intercepted on this machine; the prototype's
  probe (like the origin suite) falls back to system Chrome.
- Rob's standing riders remain: the two published-data flags (public R2
  cover images; price aggregates in committed trays) and the
  verify-slice args-parse patch — surfaced at session start, untouched.

## The map now

Foundations closed; `data-strategy-lab` resolved. Open and needing Rob:
`aesthetic-direction` (his track), `a11y-section`, `home-surface`.
Blocked: `domain-cutover`. **The PLP surface build is fog → ready to
ticket** (this session unblocked it). One ticket per session; Rob picks
the next node.
