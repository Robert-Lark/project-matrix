# Item 7, the worktree inventory, and Rob's call (2026-10-05)

Rob-gated; presented before anything was touched. **Rob's answer, 2026-10-05: remove
none, defer.** Nothing was removed. The inventory stands as the record for whoever
picks this up.

Derived from `git worktree list`, `git -C <wt> status --porcelain | wc -l`,
`gh pr list --head <branch> --state all` (squash-merged branches are not ancestors
of main, so "merged" was read off the PR, not `git branch --merged`), and
`du -sk`. Total under `.claude/worktrees/`: 27,162,096 KB (25.9 GB), 24
`node_modules` copies (`ls -d .claude/worktrees/*/node_modules | wc -l`).

| Folder | Branch | Merged how | Porcelain lines | Size |
|---|---|---|---|---|
| aesthetic-direction | worktree-aesthetic-direction | PR #12, 2026-07-13 | 0 | 0.32 GB |
| blog | worktree-blog | ancestor of main | 0 | 0.51 GB |
| blog-phase2 | worktree-blog-phase2 | PR #14, 2026-07-19 | 0 | 0.52 GB |
| blog-publish-fix | blog-publish-fix | ancestor of main | 0 | 0.51 GB |
| checkout-vanilla | checkout-vanilla | PR #36, 2026-08-29 | 0 | 1.18 GB |
| constant-remeasure | constant-remeasure | ancestor of main | 0 | 1.15 GB |
| decision-map-compaction | decision-map-compaction | PR #51, 2026-09-26 | 0 | 1.30 GB |
| editorial-bench-batch | editorial-bench-batch | ancestor of main | 0 | 1.27 GB |
| editorial-receipts | editorial-receipts | ancestor of main | 0 | 1.24 GB |
| editorial-rerun | editorial-rerun | ancestor of main | 0 | 1.24 GB |
| home-surface | worktree-home-surface | ancestor of main | 0 | 0.44 GB |
| how-it-was-built-spec | how-it-was-built-spec | PR #37, 2026-08-29 | 0 | 1.15 GB |
| interaction-registry | interaction-registry | PR #35, 2026-08-28 | 0 | 1.25 GB |
| pdp-build | pdp-build | ancestor of main (merge commit, never squashed: `b12b8d9` carries receipts) | 0 | 1.20 GB |
| pdp-controls | pdp-controls | ancestor of main | 0 | 1.28 GB |
| pdp-variants | pdp-variants | ancestor of main | **1** | 1.28 GB |
| plp-htmx | plp-htmx | PR #39, 2026-08-29 | 0 | 1.27 GB |
| plp-react-next | plp-react-next | PR #38, 2026-08-29 | 0 | 1.27 GB |
| record-repair | record-repair | ancestor of main | 0 | 1.15 GB |
| ruler-unit | ruler-unit | ancestor of main | 0 | 1.24 GB |
| slice-d-qwik | fix-pixel-decode-race | ancestor of main | 0 | 1.22 GB |
| slice-e-htmx | slice-e-htmx | ancestor of main | 0 | 1.24 GB |
| slice-f-remix3 | slice-f-remix3 | ancestor of main | 0 | 1.32 GB |
| store-surfaces | worktree-store-surfaces | ancestor of main | 0 | 1.32 GB |
| bench-accounting-fix | (none: not a registered worktree, a stray folder holding only `workers/`, dated Aug 1, no `.git`) | n/a | n/a | 0.00 GB |
| repo-hygiene | repo-hygiene | this unit's, live | 0 | 0.03 GB |

Three facts that bear on the decision, verified that day:

- `git worktree remove` deletes the folder only; every branch ref stays, so
  `pdp-build`'s unsquashed receipts commit stays reachable through its branch and
  through main's merge commit.
- `pdp-variants`' one porcelain line is `?? tools/snapshot-capture/crate/img`: that
  branch's `.gitignore` carried the pattern with a trailing slash, which does not
  match the SYMLINK every worktree holds at that path (the main checkout's
  `.gitignore` line 11 records the proof). It is a link to the main checkout's real
  image directory (3,634 files), not a copy. By the standing rule nothing with
  porcelain output is removed.
- Every worktree's crate image path is that same symlink to the one real directory;
  a removal would delete links, and the proof that it deletes no target was going to
  be a throwaway worktree with a symlink, removed and checked, before any real one
  went. Not run, since nothing was removed.

Until item 1 landed, each of these folders was also linted by every `eslint .` in
the main checkout (`eslint-timing-2026-10-05.md`).
