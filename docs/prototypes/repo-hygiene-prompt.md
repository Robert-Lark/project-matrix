# Repo hygiene sweep — one-liners, plus three calls only Rob can make

**Priority 9 of the 2026-08-29 audit.** Nothing here is a session-sized unit; it is a sweep
of verified one-liners plus three items that need Rob's explicit go (marked **ROB-GATED** —
an unanswered question is not a yes). Re-open every citation before editing.

---

## The one-liners

1. **eslint lints all 24 stale worktrees — 94% of its work.** `pnpm exec eslint . --format
   json | jq -r '.[].filePath' | wc -l` → 4,153 files, of which 3,914 are under
   `.claude/worktrees/` (grep-counted; ~33 s wall). Worse than waste: turbo's `//#lint`
   inputs (`turbo.json:20-28`) exclude `.claude/`, so lint's result depends on local state
   the cache key ignores — a failing worktree file can be masked by a cached PASS, and local
   red can contradict CI green (CI checkouts have no worktrees; `git ls-files
   .claude/worktrees | wc -l` → 0). **Fix: add `".claude/worktrees/**"` to the ignores in
   `eslint.config.mjs`** (the list at `:6-42` already has `.claude/workflows/**` at `:41`).
2. **`//#lint` inputs miss `.mts`/`.cts`** — the two linted `.d.mts` files can stale-PASS.
   Add the extensions to `turbo.json:20-28`.
3. **Two variant deploy scripts rebuild outside the PM_SNAPSHOT-set step**, contradicting
   ci.yml's own guardrail — locate with `grep -rn "turbo run build" .github/workflows
   variants/*/package.json` and align them with the parameterized-build hash discipline
   (`turbo.json:62,78`).
4. **CI deploy job uses mutable action tags on an unpinned runner while holding Cloudflare
   secrets.** Pin actions by SHA in `.github/workflows/ci.yml` (the deploy job at `:80+` is
   the one that matters).
5. **Commit the untracked prompt files.** All ~19 `docs/prototypes/*-prompt.md` files
   (derive: `git status --porcelain | wc -l`) are session inputs for landed units — exactly
   the build-process record the standing preference says to keep — and as porcelain they
   flip `commitPin`'s dirty bit (`tools/bench-runner/src/git.ts:13`), which makes any
   receipt minted from this checkout unpublishable (`workers/front/build.mjs:551-552`).
   They are also one `git clean` from the crate-img loss mode the map already documented
   (`decision-map.md:321`). Quick human pass over the home-surface prompt's ABOUT ME block
   first, then one docs commit. The 2026-08-29 audit prompts (this file and its siblings)
   ride the same commit.

## ROB-GATED calls

6. **Branch protection on main.** `gh api repos/Robert-Lark/project-matrix/branches/main/
   protection` → 404 "Branch not protected"; rulesets → `[]`. The failure mode already
   happened: PR #30 merged RED on 2026-08-27, deploy skipped, and the live plane silently
   served the pre-merge state for a day (`decision-map.md:321`). A ruleset requiring the
   `check` + `origin` status checks green before merge costs solo-repo friction exactly
   once per deliberate red — and the one recorded deliberate red is the incident. Repo is
   public, so rulesets are on the free plan. Settings change, no code — but it changes how
   Rob merges, so it is his call.
7. **Prune the worktrees.** 24 dirs under `.claude/worktrees/`, ~25 GB, 23 node_modules
   copies, ≥14 fully-merged branches still checked out (one orphaned checkout:
   `bench-accounting-fix`). Deletion is destructive and some worktrees may hold uncommitted
   drafts — inventory each (`git -C <wt> status --porcelain`) and present the list to Rob
   before removing anything. Do NOT `git worktree remove` anything with porcelain output.
8. **The Discogs ToS / attribution call (domain-cutover sub-decision (e)) — do it FIRST and
   independently of the cutover.** `decision-map.md:216`: the plane already serves the
   crate's data + 1,817 self-hosted image derivatives publicly, and the ToS/attribution
   check is recorded as owed but not done. It is a reading-and-recording task; an
   application link should not go out with the question open. Fetch the current Discogs API
   ToS (fetched pages + quotes, per the working agreement — no training-data claims),
   record the call in the map, and if attribution is required, note where it lands
   (`/methodology/` or the footer).

## Done means

Items 1–4 landed and `pnpm check` timing visibly drops (derive before/after); item 5
committed with the tree porcelain-clean; items 6–8 each have Rob's explicit answer recorded
— yes, no, or deferred — in the decision map.
