# Handoff — blog plane phase 2 (the incoming session's prompt)

> Written 2026-07-18 at the close of the session that landed `worktree-blog`
> (`d5cecb5`). Paste the block below as the incoming agent's prompt.

---

Continue the blog plane (ADR-0009) — phase 2: make the editor luxurious
and close the recorded loose ends. This continues the 2026-07-18 session
that landed branch `worktree-blog` (`d5cecb5`, pushed, UNMERGED at time of
writing).

── FIRST ACTIONS ──
Run `git fetch origin --prune` and check whether `worktree-blog` has been
merged into origin/main.
- If MERGED: work in a fresh worktree from origin/main. Verify the deploy:
  CI post-deploy smoke green, `/blog/` serving on the production origin,
  and a REAL login at `/blog/admin` — the wall's accept side is invisible
  to CI (a missing secret 401s exactly like a working wall; runbook note
  in `workers/README.md` §prerequisites 5).
- If NOT merged: work in a worktree branched from `worktree-blog` and keep
  the one-commit-per-branch convention (amend + force-push per
  `.claude/rules/git.md`). Do not nag about merging — that is Rob's call.

── READ FIRST (the contract) ──
`docs/adr/0009-blog-plane.md` · `docs/prototypes/blog-design/NOTES.md`
(the committed "Sleeve & Shelf" direction + accent discipline) ·
`docs/build-log.md` Phase 9 (what was verified and what was fixed) ·
memory: `blog-build-decisions` (interview-locked answers — do NOT re-ask).

── STANDING STATE (verify, don't trust) ──
- Live outside the origin: worker `pm-blog` (binding-only, workers_dev
  false), D1 `pm-blog` (holds the real post `a-quiet-room`), R2
  `pm-blog-media`, secret `ADMIN_CREDENTIAL_HASH` set. Credential:
  `~/.config/project-matrix/blog-admin-credential` (0600).
- Preview origin: https://043b0a4f-pm-front.robresearch87.workers.dev —
  a new `wrangler versions upload` in workers/front mints a new URL;
  deploying pm-blog updates any front preview in place (the binding
  resolves to the active deployment). Deploying pm-blog is sanctioned
  (production cannot reach it until merge); deploying pm-front is NOT.
- Local dev: `pnpm run dev` in workers/blog (port 8791), fixture
  credential `local-dev-credential` (committed .dev.vars, documented).
  `pnpm run origin-suite` WIPES workers/blog/.wrangler/state every run —
  local content is disposable; re-seed through the admin API.
- Scripting against the deployed origin: workers.dev 1010-blocks
  python-urllib UAs — send a browser User-Agent.

── FENCES (absolute, unchanged) ──
The benchmark stays provably untouched: zero store-file changes, the FULL
origin suite green (`pnpm run origin-suite`, 164 at handoff), the blog
carries no HUD/beacons/receipts. Accent discipline: an arbitrary per-post
accent never colors text. Every new admin route: session + CSRF, no state
change on GET, generic errors out. Words are never lost or locked in —
any new editor behavior keeps the autosave/mirror/concurrency contracts
in `src/admin/editor/main.js`'s header comment. Run the standing
verify-slice workflow before committing.

── THE WORK (in value order; best-judgment throughout, no check-ins) ──
1. **Media library**: browsable panel of everything in R2 (the `media`
   table has it all) — insert an existing image without re-uploading;
   edit alt text after the fact (alt lives on the media row and feeds
   rendering through `mediaLookup`, so fixing alt re-fixes every post on
   next render).
2. **Zip-of-markdown export** beside the JSON dump: each post as
   front-matter + body_md, media manifest included. A STORE-only zip
   writer is ~80 lines — no new dependency without a defense.
3. **AVIF uploads**: add dimension sniffing to `src/dimensions.js`
   (ISOBMFF `ispe` box), then re-add `image/avif` to MEDIA_TYPES — the
   zero-CLS rule is why it is currently refused.
4. **Scheduled publishing**: `original_date` plumbing exists; decide the
   mechanism (publish_at checked on read vs a cron trigger) and record it
   as an ADR-0009 addendum.
5. **Public luxuries with taste**: footnote hover-popovers as progressive
   enhancement (single-digit KB, CSP `script-src 'self'`, no frameworks);
   print polish; an `/blog/archive` shape only if the shelf needs it.
6. **Optional**: judge the four never-judged design boards
   (`docs/prototypes/blog-design/boards/` — written by agents that died
   before reporting) for splice-able ideas; "Sleeve & Shelf" stays unless
   something clearly beats a piece of it.

── HOW TO WORK ──
Prototype editor interactions and public changes as real pages; critique
with screenshots (the eight principles); verify with the full origin
suite, the workers/blog unit tests (`pnpm exec vitest run`), and a real
browser pass on the editor. Record decisions the house way: ADR addendum
+ decision-map + build-log phase. Commit on the branch, present a preview
URL, do NOT merge — merging deploys, and that stays Rob's call.

── DELIVERABLE ──
The editor upgrades working end to end behind the wall, suite green,
verify-slice run and findings adopted, records updated, a preview URL,
and a short account of what changed and what you'd build next.
