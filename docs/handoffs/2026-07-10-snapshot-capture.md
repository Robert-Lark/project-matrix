# Handoff: `snapshot-capture` (drafted 2026-07-10, post foundation close-out)

Paste everything below the rule into the next agent session.

---

Continue work on project-matrix (Rob's live-benchmarking portfolio,
/Users/roblark/Work/project-matrix). The foundation build is closed out;
you are running the `snapshot-capture` ticket — capture and freeze the
real Discogs crate that replaces the synthesized fixture as the store's
canonical data.

WHERE THINGS STAND (2026-07-10):
- Read docs/decision-map.md first (canonical state; your ticket is
  `snapshot-capture`), then docs/build-log.md (Phase 2 close-out section +
  ALL methodology notes — the verification-resilience note governs how you
  verify). Vocabulary: CONTEXT.md. ADRs 0001–0004 are the rationale of
  record; ADR-0002 is YOUR spec. The data-contract prototype
  (docs/prototypes/data-contract/README.md + schema.ts) has the verified
  API facts and the tray schemas.
- Foundation: all seven slices landed and adversarially verified
  (issues #2–#8; #2, #4–#8 closed). The one command is
  `pnpm run origin-suite` (113 assertions incl. drift gate + bench +
  cost legs) — run twice back-to-back before committing. CI is green on
  every push. The measurement chain is complete: `pnpm bench run` →
  SHA-pinned receipt → `pnpm cost from-receipt` → $/1M-visits report.
- Still Rob-gated (unchanged, don't block on it): issue #3's deploy leg —
  no CLOUDFLARE_* secrets, the deploy job skips loudly; arming runbook in
  workers/README.md. #1 (the PRD) stays open until #3 closes.

YOUR TASK: the `snapshot-capture` decision-map ticket (Type: Task).
One-time capture per ADR-0002: pull ~500 releases (the crate), download +
self-host images, normalize ONCE at capture to the two trays, validate,
freeze with a dated manifest.

0. HARD PREREQUISITE — get a Discogs personal access token from Rob
   before anything else (search AND image endpoints require auth; 60/min
   authenticated rate limit). Suggest he runs `! export DISCOGS_TOKEN=…`
   in-session or tells you where it lives. NEVER commit or log it. If he
   isn't around and left no token, do the parts that need no API access
   (capture-script skeleton, checkpointing, manifest schema, tests) and
   flag the blocker in your handoff.
1. The crate choice (genre/era, realistic facet distribution, heavy on
   purpose) is a portfolio-content decision — ask Rob if reachable; if
   not, standing best-judgment applies: pick something facet-rich and
   record the rationale.
2. Build the capture as a CHECKPOINTED, RESUMABLE tool (tools/ workspace,
   no `test` script — origin-suite precedent): 500 releases at 60/min
   across search + per-release details + image downloads is hours of API
   time and WILL cross session limits — every fetched page/image lands on
   disk before the next request; a re-run resumes, never re-pulls.
   Respect the X-Discogs-Ratelimit-* headers with backoff (verified facts
   in the prototype README).
3. Endpoints (verified in ADR-0002): PLP `GET /database/search`
   (filters), PDP `GET /releases/{id}?curr_abbr=USD` (price aggregate
   inline — one call). Normalize to ReleaseSummary/ReleaseDetail and
   Zod-validate via @pm/data-contract at capture time. Data-not-UI
   guardrail: typed primitives, no pre-render work.
4. Images: downloaded + self-hosted (hotlinking is unviable — auth +
   rate-limited). Derivative sizing: the reference render's component
   dimensions are the spec (packages/reference); the ticket carries a
   note that a follow-up may refine derivatives.
5. Land it: dated SnapshotManifest (capture date + commit SHA, ADR-0002
   §1). The local R2 seed path exists (workers/edge, `pnpm run
   seed:local` / `seed:remote`); production R2 landing shares issue #3's
   credential gate — capture/normalize/validate/local-seed all work
   without secrets; flag the remote seed in your handoff if still
   unarmed.
6. Decide and RECORD the fixture relationship: the synthesized fixture
   (tools/snapshot-fixture, ≥240 releases) stays the CI seed — CI must
   never depend on the 500-release artifact or the Discogs API. The
   `?n=` knob (24 vs 240) must hold against the real crate too.
7. Convention: file a GitHub issue for the ticket first (acceptance
   criteria = definition of done, ADR-0002 cited — the one-shot-the-issues
   pattern), implement, verify, land, close with an AC→evidence comment,
   update docs/decision-map.md (ticket → resolved) + docs/build-log.md,
   then HAND OFF — one ticket per session per the map discipline. Rob's
   parallel tracks (don't touch): `aesthetic-direction` exploration (his
   prompt pack: docs/prototypes/aesthetic-direction/claude-design-prompts.md)
   and arming the deploy secrets.

STANDING RULES FOR THIS REPO:
- ADR wins on any conflict with issue/ticket text — flag it, never
  silently resolve.
- Rob has standing best-judgment authorization; don't block on questions
  you can decide from the ADRs (the crate choice and the token are the
  two genuine Rob-inputs here).
- Outside-in testing at the composed-origin seam; no unit tests of Worker
  internals; tools packages have no `test` script.
- Dev servers/watchers ALWAYS run_in_background, never foreground.
- Commits stay narratable (see git log; no Jira IDs). STAGE EXPLICIT
  PATHS — never `git add -A`: Rob drafts planning files in-tree in
  parallel (one got swept into commit 9ee3931; recorded memory).
- Secrets: the Discogs token must never appear in code, receipts, logs,
  or committed files.

VERIFICATION — LIMIT-RESILIENT (now battle-tested; round-four story in
the build-log methodology notes):
- Verify pre-commit with the SAVED workflow:
  Workflow({name: "verify-slice", args: {issue: <n>, scratchDir: "<your
  session scratchpad>", context: "<changed files + runtime notes +
  accepted-knowns>"}}). Run it in the background EARLY; do inline
  empirical probing in the foreground meanwhile (probes and code-reading
  lenses catch DISJOINT defect classes — 15/15 adopted findings on #8
  split roughly half and half). Refute findings INLINE; fix pre-commit.
- KNOWN GOTCHA: the harness may deliver workflow `args` as a JSON string;
  the saved script's guard rejects it. The 3-line parse-if-string patch
  is described in the build-log methodology note, pending Rob's review of
  .claude/workflows/verify-slice.js (the permission classifier blocks
  agents from editing it — correctly). Until patched: launch once, let it
  fail, edit the persisted SESSION COPY the Workflow tool names in its
  result (that edit is sanctioned), relaunch via {scriptPath}.
- On a session-limit death: the failure list is the truth; completed
  lenses are durable in the run journal. Resume with
  Workflow({..., resumeFromRunId: "<id>"}) and BYTE-IDENTICAL args — any
  args change invalidates the prompt cache for ALL lenses and silently
  restarts from lens 1 (learned the hard way on #8; check which lens the
  live agent transcript is running if in doubt).
- Keep durable state on disk (checkpointed capture doubly so) — the tree,
  docs, and issue comments survive a dead session; conversation doesn't.

ENVIRONMENT GOTCHAS (all learned the hard way):
- pnpm via corepack; shim at ~/.local/bin/pnpm. If missing:
  `corepack enable --install-directory ~/.local/bin pnpm`.
- `hoist: false` MUST stay in pnpm-workspace.yaml; public npm registry
  pinned in .npmrc; allowBuilds covers esbuild/sharp/workerd.
- Playwright's CDN is blocked locally by org TLS interception — browser
  code falls back to system Chrome (channel:"chrome"); CI installs
  bundled Chromium (cached).
- Leaked wrangler/workerd trees poison later runs; the suite pre-flights
  ports 8787-8790/9230-9233 and fails loudly. `pkill -f "wrangler dev"`
  does NOT reliably kill workerd grandchildren — find them with
  `lsof -nP -iTCP:<port> -sTCP:LISTEN` and `kill -9` by PID, then
  re-check every port.
- Single-process `wrangler dev -c a -c b` is forbidden (breaks
  assets-through-bindings). One `wrangler dev` per Worker: edge 8790,
  placeholder-static 8788, placeholder-ssr 8789, front 8787 (seed local
  R2 first: `pnpm --filter @pm/edge run seed:local`).
- The wrangler inspector proxy (9230-9233) rejects websocket handshakes
  without an Origin header — Node undici's non-standard {headers} option
  supplies it (see bench-runner/src/cpu.ts).
- JS-disabled pages: requestAnimationFrame NEVER fires — poll with sync
  evaluates from Node (drift-gate). document.fonts.status reads "loaded"
  VACUOUSLY before layout forces the font fetch.
- Chromium REBASES navigation-timing sub-phases beneath applied CDP
  throttling — a measured property, stated in receipt methodNotes; don't
  "fix" it.
- Local `wrangler dev` serves identity encoding (no Brotli); the deployed
  smoke sets PM_EXPECT_BROTLI=1.
- Discogs API: 60/min authenticated, auth required for search AND images,
  backoff on the X-Discogs-Ratelimit-* headers (prototype README quotes).
- Rate cards drift by design — if your session touches cost numbers,
  re-verify against the live pricing pages and date the card
  (tools/cost-calculator/ratecards/, verified-quote convention).

HOUSEKEEPING:
- No caffeinate process is running; if the capture leg will run long on
  Rob's machine, ask him to start one (`caffeinate -is &`) and record the
  PID + kill instruction in your handoff.
- Scratchpad files are disposable; the repo, issues, and docs are
  canonical.
