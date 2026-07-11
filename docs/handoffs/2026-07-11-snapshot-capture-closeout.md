# Handoff — snapshot-capture closed out (2026-07-11)

**Session summary:** the `snapshot-capture` decision-map ticket resolved as
[issue #9](https://github.com/Robert-Lark/project-matrix/issues/9), landed in
`f60385f`. The real crate is frozen and receipted: **500 releases, 1,817
self-hosted AVIF derivatives**, ambient / melodic techno / neo-classical
vinyl 2006–2026 from Rob's 18-label list. Full narrative:
`docs/build-log.md` Phase 3; canonical state: `docs/decision-map.md`.

## What exists now

- `tools/snapshot-capture` — the checkpointed, resumable capture CLI
  (`pnpm capture run/status/seed`). The one-time capture is DONE; a re-run
  makes zero API requests. Working state (`.capture/`, ~150 MB: raw
  responses, originals, tombstones) and the derivatives (`crate/img/`,
  43 MB) live on Rob's disk only — **don't delete `.capture/`**: originals
  are what future derivative re-cuts start from.
- Committed dataset (~1.7 MB): `crate/{manifest,summaries,details,
  images-index,curation}.json` — trays + dated manifest (`commitSha` null by
  design; `f60385f` is the landing provenance) + sha256 index chained to the
  originals + the curation receipt.
- Local R2 holds the **fixture** right now (the origin suite re-seeds it);
  `pnpm capture seed` re-lands the crate locally in ~3.5s any time.

## Rob-gated (unchanged + new)

1. **Deploy secrets** (issue #3, unchanged): `CLOUDFLARE_API_TOKEN` /
   `CLOUDFLARE_ACCOUNT_ID` + the one-time prereqs (workers/README.md).
2. **Remote crate seed** (new, after #1): `pnpm capture seed --remote`.
   Before flipping the remote bucket to the crate, the fixture-coupled
   origin-suite assertions need snapshot-awareness (recorded on issue #9,
   workers/README.md "Known follow-up") — otherwise the post-deploy smoke
   goes red. The seeder itself is fail-closed against fixture-over-crate
   clobbering.
3. **Token hygiene**: the Discogs PAT lives at
   `~/.config/project-matrix/discogs-token` (600). It also sits in this
   session's local transcript (Rob pasted it in chat) — regenerate it on
   Discogs if that bothers you; nothing needs it until a re-capture.
4. **"Prometheus Studio"** matched nothing (vinyl, 2006–2026). If a
   different label name was meant, say so — re-plan is nearly free
   (searches checkpointed; delete `.capture/plan.json`, re-run).
5. **Two published-data decisions flagged for review** (tool README
   "Artifact placement"): image bytes excluded from git (copyright
   caution), and the two commerce aggregates (`priceFrom`/`numForSale`)
   published in the committed trays as a dated factual snapshot.

## Housekeeping

- `caffeinate -is` is still running from this session: **PID 45961** —
  `kill 45961` when you're done.
- The verify-slice saved workflow still needs the 3-line args-parse patch
  (`.claude/workflows/verify-slice.js` — pending Rob's review; the
  session-copy workaround worked again this session).

## The map now

Foundation + snapshot-capture resolved. Open and unblocked:
`data-strategy-lab`, `aesthetic-direction` (Rob's parallel track),
`a11y-section`, `remix3-frontier`, `home-surface`. #3/#1 stay open on the
deploy leg. Per the map discipline: one ticket per session, Rob picks the
next node.
