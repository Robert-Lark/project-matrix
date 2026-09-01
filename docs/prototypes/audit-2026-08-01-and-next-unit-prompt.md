<!--
  Deep-audit findings (2026-08-01) + the next-unit handoff prompt.
  Produced by a whole-repo audit: 10 subsystem/dimension finder lenses, every
  finding adversarially re-verified by an independent skeptic (52 agents total).
  35 findings CONFIRMED against source, 3 PLAUSIBLE (latent), 4 REFUTED.
  The fenced block at the bottom is paste-ready for the incoming session.
-->

# Project Matrix — deep audit, 2026-08-01

State verified from the world, not the record: main = `b08b662`, CI green on all
three jobs (check / origin / deploy). Four of five editorial variants
(vanilla, react-next, astro, qwik) serve 200 on the live plane with the crate;
the blog is live in production (`/blog/` 200, `/blog/admin/` 401). Local suite
28/28 after repairing a corrupted pnpm store (a missing `tslib` symlink under
`@swc/helpers@0.5.23` broke the two fontkit font guards — `rm -rf node_modules
&& pnpm install --frozen-lockfile` restored it; CI was never affected). All 8
local branches and 7 worktrees are fully merged and clean — pure leftovers.

**Verdict: the project is on a straight path to its north star.** The
architecture and discipline are genuinely staff-level, and the credibility
mechanisms (drift gate, one ruler, receipts, fenced exhibits) are enforced in
code, not just documented. The risk is concentrated in exactly two places —
the instrument's measurement integrity and a handful of blog/edge security
gaps — and **no benchmark number has published yet**, so none of the
measurement gaps have corrupted a real result. The project's own plan already
sequences the measurement fix (issue #16) *before* the first bench batch, which
is precisely right. The audit's job was to widen that fix's scope with what it
missed, and to surface the security gaps for a priority call.

## Findings by theme (all CONFIRMED unless marked)

### A. Instrument integrity — highest stakes; a wrong number here is the one failure mode the whole project exists to avoid

These are IN ADDITION to issue #16's four known defects. Fold them into that unit.

- **`tools/bench-runner/src/collect.ts:303` — the HTML byte bucket includes the
  injected chrome's compressed markup.** The runner strips chrome *subresources*
  (`/_pm/*`, `/api/beacon`) but not the chrome markup the front Worker injects
  into `#pm-chrome-slot`, so every variant's `buckets.html` carries instrument
  bytes it should not — violating ADR-0001 §6 and `packages/switcher/README.md`.
  The audit explicitly places the fix in the issue-#16 accounting session.
- **`collect.ts:171` (+ `:127` `DEFAULT_SETTLE_MS`) — per-interaction byte
  boundary is a fixed 400 ms proxy wait.** An interaction-triggered fetch slower
  than 400 ms is counted in neither `interactionBytes` nor `totalBytes`. Same
  "wait for the real signal, never a proxy" class as issue #16 defect 4 and the
  standing rule in `drift-gate/README.md`.
- **`collect.ts:254` — the vitals harvest ends on a fixed 300 ms wait for beacon
  delivery.** A slow flush records `null` web-vitals into a receipt, and the
  medians then silently compute over fewer runs than `runsPerUrl` — a real
  published-number corruption path, not just a test flake.
- **`tools/bench-runner/src/cli.ts:42` / `batch.ts:104` — `--local-cpu` is never
  cross-checked against `--origin`.** Benching a *remote* origin with
  `wrangler dev` running emits a receipt whose `cpuMs` is a near-zero profile of
  the idle *local* plane, labeled as real; the cost calculator then prices it
  with no provenance check. ADR-0001 binding E bars this but only as unenforced
  policy.
- **`tools/drift-gate/src/pixels.ts:50` — pixel threshold `0.1`.** The pixel leg
  claims zero-tolerance ("any visible difference counts") but `pixelmatch`'s
  `threshold: 0.1` lets uniform color re-valuations of ~26 neutral levels (or
  ~75 blue-only levels) pass with 0 differing pixels — the exact re-valued-token
  drift the pixel check exists to catch. The deliberate-drift fixture only
  exercises a *large* drift, so the sensitivity gap is untested.
- **`tools/origin-suite/suite/drift.browser.test.ts:208` — the self-hosted-only
  proof is weaker than the claim it cites.** An undelimited `startsWith(ORIGIN)`
  accepts prefix-extension hosts (`https://<origin>.evil.tld/…`), and the
  external-request array is asserted only once at `load`, so requests that start
  after load (e.g. `@font-face` fetches, which `gate.ts`'s own note says begin
  only when layout is forced) escape the check entirely.
- **`tools/drift-gate/src/normalize.ts:253` — `dropElementSelectors` tolerates
  TEXT nodes inside an excused element**, contradicting its own contract ("only
  comment nodes are tolerated inside"). The content-aware guard that is supposed
  to make whole-element noise-removal safe has a hole.

### B. Security — the blog is a real public admin surface with no Cloudflare Access in front yet (Access lands at domain-cutover), so the Worker-side wall is the only wall

- **`workers/edge/src/index.js:125` — unbounded KV key minting on the PLP data
  endpoint.** `page` is clamped only from below; any unauthenticated
  `GET /api/plp?n=7&page=<huge>` mints a distinct, **never-expiring** KV entry
  (~7.5 KB each, no TTL because there's no `run` nonce) plus a full R2 read +
  facet compute per miss. An attacker iterating `page` grows the namespace and
  the billable-write count without bound; because the `WARM.put` is awaited
  inline, exhausting the KV write quota turns every legitimate cache *miss* into
  a 500. A future WAF rate-limit slows but never *bounds* total distinct keys.
- **`workers/edge/src/index.js:197` — the beacon endpoint buffers and parses the
  entire request body before any size check.** The README's recorded interim
  mitigation ("strict input caps") bounds only what is *stored*, not per-request
  parse cost; the endpoint is publicly reachable through `pm-front`.
- **`workers/edge/src/index.js:243` — the beacon silently coerces a
  missing/malformed metric value to `0`** (and a missing name to `""` at :214)
  and stores it with a 204, while every other malformed input is a 400.
  Analytics Engine points are undeletable, so a fabricated `0 ms` LCP/TTFB
  permanently drags field percentiles for whatever `variant` tag it carries.
- **`workers/blog/src/auth.js:53` — login lockout is a non-atomic
  read-modify-write.** A burst of N concurrent login POSTs all read the same
  pre-state and collectively advance the counter by 1, so an attacker gets
  ~5×N guesses per window instead of `MAX_FAILURES=5`. Bucket is per-IP
  (`cf-connecting-ip`).
- **`workers/blog/src/index.js:456` — secret preview-link tokens are logged
  verbatim.** Preview links are `/blog/preview/<token>` (path segment), and
  `handlePublic` logs `{ path: url.pathname }` on every serve, so the secret
  token lands in Workers Logs — directly against security.md ("never log raw
  secrets").
- **`workers/blog/src/auth.js:124` — the "30-day rolling" session renewal never
  reaches the browser.** `expires_at` is extended in D1 but no `Set-Cookie` is
  re-issued, so the cookie's original `Max-Age` is a hard 30-day ceiling
  (contradicts ADR-0009 §5), and D1 rows can stay valid ~30 days past their
  cookie's death.
- **`workers/blog/src/index.js:228` (PLAUSIBLE) — MIME allowlist bypass via a
  prototype-chain key.** An upload part with `Content-Type: constructor` or
  `__proto__` resolves to an inherited `Object.prototype` member and skips the
  415. Verified as a robustness/junk-row gap (orphaned R2 object, `mime` set to
  `"constructor"`) rather than a serving-side MIME-confusion exposure — same
  class already fixed with `Object.hasOwn` in the front Worker. Low severity,
  cheap fix.

### C. Correctness / bugs

- **`workers/blog/src/admin/editor/main.js:111` — a successful save in one tab
  overwrites the shared per-post localStorage crash mirror with a body-less
  `{saved:true}` marker**, destroying a second tab's unsaved-words net (the
  "never a lost word" promise). Related: `:815` revision-restore ignores
  `save()`'s failure result (unlike publish/schedule), and `:517` the slug field
  autosaves like prose — a >1.5 s pause mid-rename of a *published* post renames
  the live URL to the half-typed slug and mints a permanent redirect row.
- **`workers/blog/src/index.js:218` — the live-preview endpoint never resolves
  the cover**, so a post with `cover_media_id` set (API-settable today) renders
  a photo-hero + `og:image` on the published page and tokened preview but *not*
  in the admin live-preview iframe — contradicting the full-document parity the
  code advertises. Related: `admin/pages.js:48` offers the photo-hero treatment
  but ships no UI to set `cover_media_id`, so the knob silently no-ops.
- **`workers/blog/src/public/pages.js:240` — `absolutize()` does blind string
  replacement over the whole `body_html`**, rewriting `/blog/…` URLs inside code
  blocks and inline code, so RSS readers see altered code samples.
- **`packages/switcher/src/chrome.ts:143` — the strategy-axis fallback renders a
  variant name under the `strategy` switcher key** — exactly what the comment two
  lines above forbids. Latent today (unregistered PLP paths 404 without a chrome
  slot) but a live trap for the PLP build.

### D. State-of-record drift (mechanical; misleads the next agent)

- `docs/decision-map.md:231` / `:242` still say slice D (qwik) is UNMERGED on a
  branch — it merged 2026-07-26 (PR #18) and is live.
- `docs/decision-map.md:220` still says production `/blog/` 404s pending a
  D1:Edit token re-mint — the blog has been live since 2026-07-19.
- `docs/prototypes/finish-line-handoff-prompt.md:272` points successors to a
  decision-map heading ("OBLIGATIONS BOUND TO THE BENCHMARK-PUBLICATION ARC")
  that commit `56e0b26` renamed; the pointer is dead.
- `workers/README.md:149` — the re-arm runbook step 2 promises the first
  post-deploy smoke against a fresh fixture-seeded bucket "goes green"; since
  slice A it's a guaranteed red (deploy bakes vanilla/astro with
  `PM_SNAPSHOT=crate` while the bucket serves the fixture) until step 3's seed.
- `packages/data-contract/src/schema.ts:108` — `SnapshotManifest.source` is a
  literal that forces the committed *fixture* manifest to claim its data came
  from `api.discogs.com`; the fixture cannot state a truthful provenance.
- (MEMORY.md index line already corrected 2026-08-01.)

### E. Quality / CI hygiene

- **`.github/workflows/ci.yml:10` — no `permissions:` block and all three
  checkouts keep `persist-credentials: true`**, so `GITHUB_TOKEN` sits in
  `.git/config` throughout every job — contradicting the workflow's own
  secrets-scoping claim at :107.
- **`ci.yml:88` — the deploy concurrency group orders by queue-arrival, not
  commit order**, so an older main push's deploy can land *after* a newer one and
  silently regress the plane to a stale SHA that the smoke then green-lights.
- **`variants/astro/scripts/prepare-build.mjs:53` — copies `@pm/tokens` into
  `public/assets/pm/` additively, never pruning**, so files deleted/renamed in
  tokens persist forever on an incrementally-used machine (vanilla's
  `build.mjs:59` `rmSync`s first — astro doesn't).
- **`variants/vanilla/build.mjs:69` (+ three siblings) — the whole-directory
  fonts copy ships non-font collateral** (`README.md`, `coverage.json`,
  `loading-markup.html`) as publicly reachable assets under each variant's
  measured prefix — the same stray-reachable-file class qwik ticketed and
  `.assetsignore`'d for its `404.html`, recorded in no DIFF-TO-STARTER.
- **Two request-time asymmetries no receipt discloses:** `react-next` is the only
  variant whose masthead badge live-syncs across tabs via a `storage` listener
  (`CartCount.tsx:18`), and its editorial failure fallback (`error.tsx`) renders
  only *after* client JS runs — the served failure HTML carries no chrome slot,
  so the front Worker injects no chrome and logs an error on every failure hit,
  while qwik's counterpart is a server-rendered branded 503. Both are
  cross-variant behavioral differences not registered as declared noise.

### What the audit checked and found SOUND (the clean bills, condensed)

Path-prefix dispatch (prototype-key-guarded, 404 on unknown); chrome injection
content-type-guarded with every interpolated value HTML-escaped; cold `?cache=cold`
never touches KV, warm keys bijective, 4xx never cached; R2 fails closed with
generic messages; no secrets in any Worker. Blog wall: every mutation behind
`getSession` + per-session CSRF header + `Sec-Fetch-Site`; all 59 D1 sites
parameterized; timing-safe credential compare; no fixation; cookie flags correct;
no draft leaks; markdown sanitized before Shiki; DOM-clobbering prefix defense
holds. Median math, kbps→bytes conversion, cost arithmetic, receipt Zod contract,
lab/field isolation all verified. Snapshot resolution fails closed; noise
registries non-vacuous and two-directionally proven; font guards re-derive cmaps
from woff2 bytes. Cart contract conforms across all four variants (failed-write
changes nothing, 9+ cap, aria-labels). ~10 load-bearing ADR claims spot-checked
in source and hold. No pre-asserted-verdict copy on any served surface; remix3
and the Apollo exhibit correctly get no reading-table column.

---

## Handoff prompt for the incoming agent

```
Continue Project Matrix (a live-benchmarking portfolio: one Discogs-powered
vinyl store built across several rendering paradigms, instrumented to show real
perf/UX/infra-cost tradeoffs). docs/decision-map.md is the state of record;
docs/adr/ is the rationale of record and wins every conflict; docs/build-log.md
is the narrative; CONTEXT.md owns the vocabulary. Work under the standing
best-judgment authorization: decide from the recorded decisions and roll into
the next unblocked step; merging to main is Rob's call.

NORTH STAR. The value is credibility, not cleverness. Every published number
must be defensible to a hostile reader: identical DOM across paradigms (drift
gate), one measurement ruler, dated frozen snapshots, a receipt behind every
number, no verdict where bands overlap. A variant that looks good because the
harness can't see its cost is worse than no variant. When in doubt, choose the
option that makes the comparison harder to fake.

STATE OF THE WORLD (2026-08-01; verify, don't trust):
main = b08b662, CI green (check/origin/deploy). Editorial slices A–D
(vanilla/react-next/astro/qwik) are MERGED and live; the blog plane is live in
production. Local suite 28/28. Remaining editorial slices: E (htmx), F (remix3
fenced). Then PDP, PLP, Checkout, a11y, how-it-was-built; then the
benchmark-publication arc; then domain-cutover.

── FIRST ACTIONS ──
git fetch origin --prune; git log --oneline -5 origin/main; gh run list
--branch main --limit 3 (confirm the DEPLOY job's own conclusion — it is a
separate job that has gone red while the origin was healthy). Branch fresh from
origin/main in a NEW worktree (the stale ones are all merged; delete or ignore).
pnpm install then pnpm exec turbo run lint typecheck test — expect 28/28. If the
two fontkit font guards (@pm/repo-checks font-covers-crate, instrument-font) die
on a missing 'tslib', the pnpm store is corrupt: rm -rf node_modules &&
pnpm install --frozen-lockfile. CI is unaffected by this.

── YOUR UNIT: bench-accounting-fix (GitHub issue #16), NOW EXPANDED ──
This is the planned next unit (Rob's explicit 2026-07-24 call: fix the ruler
before the first bench batch, before slices E/F). It HARD-BLOCKS the first
editorial bench publication. A prior paste-ready prompt exists at
docs/prototypes/bench-accounting-fix-prompt.md — read it: it carries issue #16's
FOUR original defects in full, the measured eager-JS ground-truth table your
fixed harness must reproduce, and every standing-discipline trap. THEN add the
measurement-integrity findings a 2026-08-01 whole-repo audit surfaced (§A of
docs/prototypes/audit-2026-08-01-and-next-unit-prompt.md — this file), which
belong in this same accounting session because they are the same class:
  - collect.ts:303 counts the injected chrome markup in buckets.html (ADR-0001
    §6 / switcher README boundary — strip it like the subresources already are);
  - collect.ts:171 (+127) the per-interaction byte boundary is a fixed 400 ms
    proxy wait — fetches slower than that vanish from interactionBytes AND
    totalBytes;
  - collect.ts:254 the vitals harvest ends on a fixed 300 ms beacon wait — a
    slow flush writes null vitals into a receipt and the medians silently
    compute over fewer runs than runsPerUrl;
  - cli.ts:42/batch.ts:104 --local-cpu is never cross-checked against a remote
    --origin, so a receipt can carry an idle-local CPU profile labeled as real
    (enforce ADR-0001 binding E in code, or refuse to emit cpuMs).
The 400 ms / 300 ms / networkidle waits are all the "wait for the real signal,
never a proxy" pattern already written up in tools/drift-gate/README.md — fix
them by making each wait precise (await the actual entry/beacon), never by
loosening an assertion. Needs an ADR-0001 §3 addendum (inline-byte
double-counting) and an ADR-0003 §2 addendum ("CSS its native way").

── ALSO FIX HERE (cheap, same files, drift-gate integrity) ──
Two drift-gate sensitivity gaps the audit CONFIRMED — the gate is the mechanism
that proves zero-bias, so a blind spot in it is a north-star risk:
  - tools/drift-gate/src/pixels.ts:50 threshold 0.1 lets uniform color
    re-valuations (~26 neutral / ~75 blue-only levels) pass with 0 diff pixels,
    against the file's own zero-tolerance claim; the deliberate-drift fixture
    only tests a large drift, so add a small-uniform-re-valuation fixture and
    tighten the threshold (or justify a documented known-boundary in an ADR).
  - tools/origin-suite/suite/drift.browser.test.ts:208 the self-hosted-only
    check is an undelimited startsWith(ORIGIN) asserted once at load; make it a
    delimited origin match and re-assert after captureStablePixels forces the
    late @font-face fetches.
  - tools/drift-gate/src/normalize.ts:253 dropElementSelectors tolerates TEXT
    nodes inside an excused element against its own contract — reject non-comment
    children.

── TASK 0 (do first; mechanical, unblocks accurate reading): reconcile the
   state-of-record so you and successors aren't misled ──
  - docs/decision-map.md:231/:242 — slice D is MERGED (PR #18, 2026-07-26) and
    live, not "UNMERGED on branch slice-d-qwik".
  - docs/decision-map.md:220 — production /blog/ is LIVE (since 2026-07-19), not
    404ing pending a D1:Edit token.
  - docs/prototypes/finish-line-handoff-prompt.md:272 — the "OBLIGATIONS BOUND
    TO THE BENCHMARK-PUBLICATION ARC" pointer is dead; it's now the
    bench-accounting-fix ticket at decision-map.md:239.
  - workers/README.md:149 — the runbook's "goes green" promise is now a
    guaranteed red until the crate seed (PM_SNAPSHOT=crate baked vs fixture
    bucket); correct the step.
  - packages/data-contract/src/schema.ts:108 — SnapshotManifest.source can't
    express the fixture's true provenance (forced to claim api.discogs.com);
    decide whether to widen the literal (small ADR-0002 note).

── WHAT THIS UNIT IS NOT ──
No variant changes to make numbers nicer (that is rigging). No bench PUBLICATION
(the first batch, /_pm/lab/{surface}.json bundles, the methodology page, and the
home tense flips are the NEXT arc step). No new surfaces. No spec-layer
redesign. The blog/edge SECURITY findings (§B of this file) are a SEPARATE
track — do NOT fold them in here; Rob is deciding whether a security-hardening
session jumps the queue.

── STANDING DISCIPLINE (all load-bearing) ──
- Run the saved verify-slice workflow in the background while probing inline:
  Workflow({name:"verify-slice", args:{issue:"bench-accounting-fix",
  scratchDir, context, repoDir}}) — sequential lenses, disk-streamed, resume
  with resumeFromRunId + byte-identical args. On slice D it returned 20 findings
  and 14 were false/unqualified claims in that session's OWN receipt — expect
  the same of yourself; adopt or refute every finding against SOURCE, prove new
  assertions non-vacuous BY SABOTAGE.
- Prove locally in BOTH snapshot modes before committing: default (fixture) and
  PM_SEED_DIR=tools/snapshot-capture/crate. Fresh-worktree gotcha:
  tools/snapshot-capture/crate/img/ is git-ignored — copy it in (~3.6k files)
  or crate-mode seeding fails. Only tools/origin-suite/run-local.mjs builds
  every variant with the matching PM_SNAPSHOT selector; never trust a
  hand-started plane for ID/snapshot-sensitive checks.
- Every number/date/SHA in any artifact comes from a manifest, tray, or tool
  output — never typed. Verify tool/library behavior against installed source,
  never training recall.
- One commit per concern, explicit paths, NEVER git add -A (Rob drafts files
  in-tree in parallel). Update decision-map.md, build-log.md, the finish-line
  progress log, and memory. Push; report CI green (check the DEPLOY job's own
  conclusion); merging is Rob's call — then PR + gh pr merge --rebase, verify
  git diff <local> origin/main is empty, git reset --hard origin/main.
- Model: strongest available at high effort (Rob's standing call; no deadline).
- Long-running processes always in the background; reap orphaned workerd
  (pkill -9 workerd — run-local.mjs only cleans its own run's children).

For the full shape of everything after this, the roadmap artifact "The Remaining
Pressings" ⧉ https://claude.ai/code/artifact/53a5aa72-172a-4657-b985-7cb157e68d49
```
