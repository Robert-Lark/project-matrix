<!--
  Handoff prompt: merge the surface-design branch and watch the deploy.
  Drafted 2026-07-17 by the surface-design session (ADR-0008). Paste the
  fenced block into a fresh session. Rob is away from his desk — the agent
  decides on its own per the standing best-judgment authorization and the
  decisions already recorded in the ADRs.
-->

```
Finish the surface-design session's last leg: merge its branch to main and
watch the deploy through to a green post-deploy smoke. Rob is away — decide
everything yourself per the recorded decisions (docs/adr/, especially
ADR-0008) and the standing best-judgment rule. Do not open new scope: the
per-paradigm variant builds are the NEXT tickets, one per session, not this
handoff's job.

── STATE (verify, don't trust) ──
- Branch `worktree-store-surfaces`, one commit `a886de1` ("Land the surfaces
  + instrument spec layer (ADR-0008)"), pushed; branch CI completed green.
  It is based on origin/main tip `7117138`. Work happened in the worktree
  /Users/roblark/Work/project-matrix/.claude/worktrees/store-surfaces —
  fine to keep using it; never `git add -A`; the tree should be clean.
- Local dev servers are running for Rob's interactive review — LEAVE THEM
  UP: the composed origin (4 wrangler devs, port 8787, crate-seeded) and a
  board server (port 8321, scratchpad script). Ports 8787-8790/9230-9233
  and 8321 are occupied; don't run `pnpm run origin-suite` (it needs those
  ports) unless you first stop and afterwards restart the stack.

── GATE 1: the remote thumb seed MUST be complete before merging ──
The branch's committed images-index.json names 1,817 new `*.thumb.avif`
objects that exist only on this machine (crate image bytes are deliberately
not in git — CI cannot seed them; ADR-0008 consequences). Rob was running
the upload when he left:
  cd workers/edge && node seed-local.mjs --remote --dir ../../tools/snapshot-capture/crate
(first attempt died ~2,900/3,637 on a transient Cloudflare 500; the seeder
is idempotent — re-runs are safe and cost nothing meaningful).
VERIFY COMPLETION EMPIRICALLY, not from logs: the deployed plane must serve
  https://pm-front.robresearch87.workers.dev/assets/img/9861004-primary.thumb.avif
with HTTP 200 (that object sits at one of the post-deploy smoke's five
sample positions). Also spot-check one more thumb. If it 404s: the seed did
not finish — try running the seed command yourself; if the permission
classifier blocks you (it blocked the previous agent), DO NOT MERGE — leave
a clear note for Rob at the top of your final message and stop. Merging
without the seed makes the post-deploy smoke go red on main.

── GATE 2: main must not have moved ──
`git fetch origin --prune`; confirm origin/main is still `7117138`. If it
moved, stop and reconcile deliberately (nothing else is expected to land).

── THE MERGE ──
Fast-forward main to the branch (the home-surface precedent, one commit):
  git push origin worktree-store-surfaces:main
Pushing main triggers CI: check + origin jobs, then the deploy job (build →
fixture seed, whose clobber guard correctly SKIPS the crate → deploy all
workers → post-deploy smoke against the live plane with PM_ORIGIN +
PM_EXPECT_BROTLI=1; the smoke includes the snapshot-aware image sample,
drift, bench, and the new chrome assertions).

── WATCH IT ──
Follow the main CI run to completion (gh run list/watch; poll in the
background, don't spin). If the smoke fails:
- thumb/image-sample assertions → Gate 1 didn't actually hold; fix the seed
  first, then re-run the deploy (re-push or gh run rerun).
- anything else → diagnose against the deploy-leg precedents (build-log
  Phase 2, docs/handoffs/2026-07-11-deploy-leg.md). The ADRs win over any
  test's expectation; if a test is wrong, fix the test, never the honesty.
Then verify the live plane yourself: / serves home (200, receipts intact),
/placeholder-ssr/sample/ carries the new instrument (`<aside id="pm-chrome"`,
one line at the top), /api/snapshot returns the crate manifest, and one
thumb URL serves 200 with content-type image/avif.

── AFTER GREEN ──
- Update the memory file home-surface-branch-state.md (memory dir): branch
  MERGED to main as <the new main sha>, seed done, deploy smoke green; the
  next work is the per-surface variant-build tickets (fog → ready, ADR-0008
  consequences list what each consumes).
- Append one line to docs/build-log.md Phase 8 recording the merge + smoke
  result (numbers from the CI run, never typed approximations) — commit that
  small docs change directly on main (fetch first).
- Report to Rob: merge sha, CI run link, smoke result, live URLs, and the
  one open follow-on list. No screenshots needed.

── SESSION-LIMIT RESILIENCE (mandatory — no lost work) ──
Every step in this leg is independently verifiable from the world (git
SHAs, HTTP probes, `gh run` status), so a limit death must never cost a
re-run. The discipline:
- CHECKPOINT AS YOU GO: after each gate/step, append a dated one-line entry
  to the "## Progress log" at the bottom of THIS file (e.g. "2026-07-18
  09:12 — Gate 1 verified: thumb probe 200" · "merged: main = <sha>" ·
  "CI run <id>: deploy in_progress"). Your successor reads this file FIRST.
- On resuming after a death: re-VERIFY checkpointed steps empirically
  (origin/main's SHA proves the merge; the thumb probe proves the seed; the
  CI run keeps running server-side regardless of your death) — never
  re-EXECUTE a step the world shows completed, and never redo one whose
  outcome you can probe.
- Long waits (the deploy run takes minutes): poll in the BACKGROUND at
  generous intervals; never burn the rolling window on tight foreground
  loops. A death mid-watch loses nothing — the run continues without you.
- If you fan out subagents (this leg shouldn't need any): sequential, each
  streaming findings to disk before the next starts, resumable with
  Workflow resumeFromRunId and BYTE-IDENTICAL args — the verify-slice
  runbook. Parallel fan-outs die correlated at the limit wall (this
  project lost two full passes that way; the runbook exists because of it).
- If the death interrupts a git push: `git fetch` and read the remote state
  before touching anything — a push either landed or didn't; the remote is
  the truth, not your transcript.

── DO NOT ──
Do not redesign anything (ADR-0008 is the rationale of record and the panel
already ran); do not start the variant builds; do not touch
tools/snapshot-capture/.capture or the crate JSONs; do not kill Rob's dev
servers; do not run the drift/origin suite locally while his stack holds
the ports.
```

## Progress log

(Successor sessions: read this first; verify, don't redo. Append one dated
line per completed step.)

- 2026-07-17 — branch `worktree-store-surfaces` @ a886de1 pushed; branch CI
  green. NOT merged. Remote thumb seed attempt 1 died ~2,900/3,637 on a
  transient Cloudflare 500; attempt 2 launched by Rob, in flight at handoff
  time. Local dev servers up for Rob (8787 composed origin, 8321 boards) —
  leave them running.
- 2026-07-18 — DONE by the surface-design session itself: main fast-forwarded
  to a886de1; deploy succeeded; smoke initially red on two transients (thumb
  seed race + worker-version propagation), seed completed via a resumable
  re-put (3,637 objects), failed job re-run → CI run 29630914441 GREEN.
  This runbook is now historical; the live handoff is
  finish-line-handoff-prompt.md.
