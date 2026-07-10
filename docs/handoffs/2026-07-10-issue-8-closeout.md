# Handoff — issue #8 (cost calculator) + foundation close-out

> Paste everything below the rule into the fresh session as its opening
> prompt. Committed per the decision-map convention (handoffs are part of
> the build record).

---

Continue work on project-matrix (Rob's live-benchmarking portfolio,
/Users/roblark/Work/project-matrix). Six of seven foundation slices are
landed; you are implementing the last one, then closing out the foundation
build.

WHERE THINGS STAND (2026-07-10):
- Read docs/decision-map.md first (canonical state), then docs/build-log.md
Phase 2 (per-slice narrative; read the #6 and #7 entries and ALL the
methodology notes — the verification-resilience note governs how you
verify). Vocabulary: CONTEXT.md. ADRs 0001–0004 are the rationale of
record.
- Issues #2–#7 are landed and closed (commits da8fec5 → f7f8ef2, plus
0a1d49d for verification tooling), each adversarially verified pre-commit
with findings in the build log and in closing comments on the issues. CI is
green on every push.
- What exists and works, on top of the previous handoff's inventory
(monorepo, shared packages, composed origin, edge data plane, injected
chrome):
  - The DRIFT GATE (#6): tools/drift-gate + the surface golden master at
    packages/reference/surfaces/sample/ + suite/drift.browser.test.ts.
    Every variant page is checked against the reference render (normalized
    DOM + pixels × 3 profiles) through the composed origin with chrome
    injected; a deliberate-drift fixture proves both checks catch drift.
  - The BENCH RUNNER (#7): tools/bench-runner — `pnpm bench run` /
    `pnpm bench reproduce`. Profiled batches over composed-origin URLs
    emitting SHA-pinned receipts. THE RECEIPT CONTRACT IS YOUR INPUT:
    tools/bench-runner/src/receipt.ts — each target×column carries
    resourceProfile {cpuMs, bytes, requests}, every field {value, source}
    with value:null allowed only when the named source genuinely can't
    account it here (CPU-ms is null against the deployed origin until the
    deploy leg arms; locally it's real V8 inspector profiles).
  - Testing is still outside-in: `pnpm run origin-suite` is the one command
    (79 assertions incl. drift + bench browser legs), run twice
    back-to-back before committing.
- THE ONE ROB-GATED ITEM (unchanged): the deploy leg. No CLOUDFLARE_*
secrets, CI's deploy job skips loudly. Arming runbook in workers/README.md.
Don't block on it — flag it in your handoff back.

YOUR TASK: issue #8 (cost calculator), then the foundation close-out.
1. `gh issue view 8` in full — acceptance criteria are the definition of
   done. Read ADR-0001 §7 (and §9) closely: cost model = measured resource
   profile (from bench receipts — never estimated) × dated, swappable rate
   card; report BOTH an architecture-only number (one card for all) and a
   real-world number (each variant on its actual host); normalize to $/1M
   visits at a stated cache-hit ratio and region; show actual charge to
   date (honestly ≈$0, free tiers) + grounded extrapolation; publish the
   full arithmetic so a skeptic can swap inputs and re-run. The ADR's rate
   figures (CF $0.30/1M req + $0.02/1M CPU-ms; Vercel $0.60/1M invocations
   + ~$0.13/CPU-hr + ~$0.15/GB egress) were verified 2026-07-06 — RE-VERIFY
   against the live pricing pages at build time per the web-research rules
   and DATE the card; rate cards drift by design.
2. When #8 lands: the foundation build closes out against issue #1's PRD —
   re-verify the whole skeleton against the PRD's "done" paragraph, update
   docs/decision-map.md (foundation-build status) + build-log, and hand the
   map back to Rob for the next phase (snapshot-capture,
   aesthetic-direction, home-surface, a11y-section, data-strategy-lab,
   remix3-frontier are the open tickets waiting on it). PAUSE there — do
   not start next-phase tickets.

STANDING RULES FOR THIS REPO:
- ADR wins on any conflict with issue/PRD text — flag it, never silently
  resolve (see the #6 closing comment for the pattern).
- Rob has standing best-judgment authorization; don't block on questions
  you can decide from the ADRs.
- No unit tests of Worker internals — the composed-origin seam is the
  contract. Tools packages have no `test` script (origin-suite precedent);
  pure-function tests are fine where the repo already has them.
- Dev servers/watchers ALWAYS run_in_background, never foreground.
- Commits stay narratable (see git log; no Jira IDs). Update
  docs/decision-map.md + docs/build-log.md per convention on each landing;
  commit, push, `gh run watch` until green, close the issue with an
  AC→evidence comment.

VERIFICATION — LIMIT-RESILIENT, THE NEW STANDING PATTERN (this exists
because three verification fan-outs died on session limits; the full story
is in the build-log methodology notes):
- Verify pre-commit with the SAVED workflow:
  Workflow({name: "verify-slice", args: {issue: 8, scratchDir: "<your
  session scratchpad>", context: "<changed files + runtime notes +
  accepted-knowns>"}}). It runs four finder lenses SEQUENTIALLY (each
  completed lens is durable in the run journal before the next starts) and
  every finder streams confirmed findings to
  <scratchDir>/findings-<lens>.md AS IT GOES.
- Run it in the background and do inline empirical probing in the
  foreground meanwhile — probes and code-reading lenses catch different
  defect classes (probes found #7's two realest defects).
- Refute findings INLINE yourself; adopt/fix pre-commit.
- If a limit death happens anyway: the failure list is the truth (a
  workflow summary can be hollow — `findings: []` from a dead stage means
  nothing ran, not nothing found). Read the run journal
  (~/.claude/.../workflows/<run>/journal.jsonl) + the findings-*.md files,
  refute what landed, and RESUME after the reset with
  Workflow({name: "verify-slice", args: <same>, resumeFromRunId: "<id>"})
  — completed lenses replay from cache. Never abandon a run.
- Budget-shape: launch the verification workflow EARLY in your window (not
  at the tail of a heavy build leg), and keep durable state on disk — the
  tree, docs, and issue comments survive a dead session; conversation
  doesn't.

ENVIRONMENT GOTCHAS (all learned the hard way; the new ones are #7's):
- pnpm via corepack; shim at ~/.local/bin/pnpm. If missing:
  `corepack enable --install-directory ~/.local/bin pnpm`.
- `hoist: false` MUST stay in pnpm-workspace.yaml; public npm registry
  pinned in .npmrc; allowBuilds covers esbuild/sharp/workerd.
- Playwright's CDN is blocked locally by org TLS interception — browser
  code falls back to system Chrome (channel:"chrome"); CI installs
  bundled Chromium (cached).
- Leaked wrangler/workerd trees poison later runs; the orchestrator
  pre-flights ports 8787-8790/9230-9233 and fails loudly. `pkill -f
  "wrangler dev"` does NOT reliably kill workerd grandchildren — find them
  with `lsof -nP -iTCP:<port> -sTCP:LISTEN` and `kill -9` by PID, then
  re-check every port.
- Single-process `wrangler dev -c a -c b` is forbidden (breaks
  assets-through-bindings).
- The wrangler inspector proxy (ports 9230-9233) rejects websocket
  handshakes without an Origin header — Node's undici WebSocket takes a
  non-standard {headers:{origin:...}} option (see bench-runner/src/cpu.ts).
- In JS-disabled pages, requestAnimationFrame NEVER fires — an async
  in-page evaluate awaiting it dies with "execution context was
  destroyed". Poll with sync evaluates from Node instead (drift-gate).
- document.fonts.status reads "loaded" VACUOUSLY before layout triggers the
  font fetch — force layout first (see drift-gate/src/gate.ts).
- Chromium REBASES navigation-timing sub-phases beneath applied CDP
  throttling (500ms emulated latency delivers on the wall clock while
  responseStart reads ~1ms) — bench receipts state this in methodNotes;
  don't "fix" it, it's a measured property.
- Local `wrangler dev` serves identity encoding (no Brotli); the deployed
  smoke sets PM_EXPECT_BROTLI=1.

HOUSEKEEPING:
- A `caffeinate -is` process (PID 69347, 8h auto-expiry) is keeping Rob's
  machine awake for this work — when you finish the close-out, run
  `kill 69347` (ignore errors if already expired).
- Scratchpad files are disposable; the repo, issues, and docs are
  canonical.
