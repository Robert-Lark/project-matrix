# Measurement pass — executable runbook (2026-09-01)

Corrects `measurement-pass-prompt.md`. Every `file:line` below was opened with `sed -n` on
2026-09-01 at HEAD `360f90a`; anything not opened is marked **unverified**. Re-open before acting.

## What changed since the prompt

1. **It is three PRs, not one session.** `tools/bench-runner/src/origin-commit.ts:77-84` refuses any mint whose checkout SHA differs from the SHA the plane attests at `/_pm/build.json` ("the origin is serving X but this checkout is Y — the receipt would name a tree the plane is not running"). So code must be merged and deployed BEFORE a receipt can carry it, and the chrome constant must be probed AFTER the receipts deploy (identity gate `workers/front/build.mjs:947-949`).
2. **Tree state:** local `main` = `360f90a` (unpushed, one commit ahead: "Commit the unit prompt files as build record", 29 files). `origin/main` = deployed plane = `26d66d0` (`curl /_pm/build.json` → `26d66d05…`, `dirty:false`). Branch `measurement-pass` is also at `360f90a`. `git status --porcelain | wc -l` = 0. Task 0.2 (clean the tree) is done.
3. **Task 3 forces code-first.** The false cold/warm sentence is minted into every receipt from `tools/bench-runner/src/batch.ts:350` (`methodNotes[4]`: "the cold/warm columns measure the edge tier"). It must be on the plane's SHA before minting, or the re-run repeats the disagreement.
4. **Gate and receipts land together, in PR-2.** `tools/bench-runner/src/git.ts:13` flips `dirty` on ANY porcelain output (staged or untracked), so the gate cannot be staged before minting. An unconditional gate cannot merge alone either — it fails the build over the old `1c543ac` receipts. Receipts go to the gitignored `tools/bench-runner/receipts/` (`.gitignore:8`) during minting; the tree stays clean across batches.
5. **TLS interception.** Node `fetch` on this Mac fails with `SELF_SIGNED_CERT_IN_CHAIN` (reproduced today; curl works because it uses the keychain). Every Node command that talks to the plane needs `NODE_EXTRA_CA_CERTS=/opt/homebrew/etc/ca-certificates/cert.pem`. `ls -la` confirms the file exists (289,060 B, Jul 23). With it, the same fetch returns `ok 26d66d0`. `origin-commit.ts:31-41` names this in its error.
6. **Branch names.** Use the existing `measurement-pass` for PR-1. Later branches are `measurement-pass-receipts` and `measurement-pass-constant` (hyphens). `measurement-pass/receipts` cannot be created — git refuses a ref nested under an existing ref (refuter reproduced: "cannot lock ref").
7. **No `watch` on this machine** (`which watch` → not found). Use an `until … sleep` loop.
8. **UTC-date guard.** `build.mjs:769-770` refuses a surface whose receipts span two UTC dates. Start a surface's three profile batches only with ≥1.5 h before 00:00 UTC (17:00 PDT).
9. **Fence must key on resolved segments.** `variants/react-next/next.config.ts:13` sets `trailingSlash: true`; `/react-next/plp/apollo` 308s to `/react-next/plp/apollo/`, so an exact-string fence is bypassable.
10. **Wall clock, honestly:** ~80–115 min of machine time (mint ~30–60, local gates ~25–30 run twice, CI ~8.5 min × 3 — CI figure from the understand phase, **unverified**) plus three Rob review/merge waits. Not "one session, mostly runbook".
11. **The implementation supersedes the step sketches below (PR-1 as built, 2026-09-01).** `fencedPathOf` lives in `@pm/switcher` (`packages/switcher/src/config.ts`) and `batch.ts` imports it — not a `SURFACE_CONTROLS` import in `batch.ts`; the minted method note states cold≡warm-by-construction only for vanilla/astro and describes the request-time targets as two samples of one serving path; and both fence walls percent-decode each segment before comparing (`/react-next/plp/%61pollo/` is refused).

Constants used below:

```sh
export O=https://pm-front.robresearch87.workers.dev
export CA=/opt/homebrew/etc/ca-certificates/cert.pem   # ls -la "$CA" must succeed first
```

---

## PR-1 — arm the runner and correct the record (code + docs, no receipts)

Branch: `measurement-pass` (exists, HEAD `360f90a`).

### Preconditions

```sh
cd /Users/roblark/Work/project-matrix
git branch --show-current                                  # measurement-pass
git rev-parse --short HEAD main origin/main                # 360f90a 360f90a 26d66d0
git status --porcelain | wc -l                             # 0
ls -la "$CA"                                               # exists
NODE_EXTRA_CA_CERTS=$CA node -e "fetch('$O/_pm/build.json').then(r=>r.json()).then(j=>console.log(j.sha.slice(0,7),j.dirty))"
                                                           # 26d66d0 false — plane != HEAD, so no mint is possible from this tree yet
```

### Ordered steps

**1. Task 0.1 — fix the map.**
- `docs/decision-map.md:376` says "CODE COMPLETE, NOT MERGED". Flip to: merged as PR #35 `ae97f8e` 2026-08-28.
- `:404` re-head from "gated on Rob's merge call" to "unblocked".
- `:433` already lists "interaction-registry (done)" — make `:376` agree with it.
- Drop the prompt's Task 0.2 (tree is clean; the 29 prompt files are committed in `360f90a`).

Done-check: `grep -c 'CODE COMPLETE, NOT MERGED' docs/decision-map.md` → 0.

**2. Task 3(b) — reword the cold/warm claim everywhere it is minted or echoed.** Every echo (repo-wide grep, excluding `docs/prototypes/`):

| Where | Line | Current claim |
|---|---|---|
| `tools/bench-runner/src/batch.ts` | `:9-10` (header comment) | "R2 every time, KV never touched, so cold stays cold" |
| `tools/bench-runner/src/batch.ts` | `:350` (**minted into receipts**) | "the cold/warm columns measure the edge tier (ADR-0002 §8)" |
| `tools/bench-runner/README.md` | `:23` | "cold stays cold for all N runs" |
| `workers/front/methodology/index.html` | `:95-96` | "separate columns measuring the edge data tier" |
| `docs/decision-map.md` | `:88` | "cold = bypass to R2" |
| `docs/decision-map.md` | `:514` | forwarding-leg paragraph — mark explicitly superseded |
| `docs/decision-map.md` | `:528` | "`/htmx/plp/` is the first PAGE path in the repo that reaches KV" — false; request-time editorial pages have read KV server-side since slice B |

Mechanism (verified): `workers/edge/src/index.js:62` keys the bypass on the TRAY url's own `cache=cold`; `:64-72` reads KV otherwise. Server-side tray fetches carry no query string: react-next `src/lib/edge.ts:12-15` (edgeFetch), `:25`, `:35`; qwik `src/lib/edge.ts:25-27`, `:85`, `:146`; htmx `src/index.js:88`, `:94`, `:99`. Only the htmx PLP forwards knobs (`variants/htmx/src/index.js:146` `PLP_KNOBS`).

Replacement text for `batch.ts:350` (adapt the same meaning at `:9-10`, README `:23`, methodology `:95-96`, map `:88`):

> every run is a fresh browser context (first-time visitor): the browser HTTP cache is a held-constant, not a measured axis. `?cache=cold` bypasses the KV warm tier only for tray fetches the BROWSER issues with that param forwarded (the react-next PLP strategies). Server-side tray fetches (react-next, qwik, htmx) carry no query string and read the canonical KV key in both columns; build-time variants (vanilla, astro) make no runtime data fetch. On the editorial and PDP surfaces the cold column therefore exercises the edge data tier for NO target — cold and warm are two timings of the same path there — and the reading table publishes warm (ADR-0001 §5).

Label cold≡warm-by-construction for all five editorial and all four PDP targets, not only vanilla/astro. (Refuter finding: the only browser-issued `/api/` fetch on those surfaces is the fenced live-price path, driven by neither scripted interaction — verified 2026-09-01, all four are click handlers; cites in the verification ledger.)

ADR-0002 `:122-124` ("Cold = bypass the edge cache and read R2") — add a dated addendum rather than rewriting the intent. Rob's call (gate below).

Done-check:
```sh
grep -rn 'R2 every time\|KV never\|measuring the edge data tier\|cold stays cold\|bypass to R2\|measure the edge tier' \
  --include='*.md' --include='*.ts' --include='*.html' --include='*.mjs' . | grep -v node_modules | grep -v '.claude/worktrees' | grep -v 'docs/prototypes/'
# → 0 unqualified hits; batch.ts:350 names the per-target scope
```

**3. Task 2 (docs half) — the `/methodology/` disclosure sentence.** In the batches section of `workers/front/methodology/index.html`, add one sentence: quiescence has been measured since 2026-08-28 by tracking in-flight requests and requiring a fresh 500 ms window with nothing in flight; before that date it was Playwright's `networkidle` latch, which had already closed during load, so pre-date receipts' `interactionSettled` was earned by nothing. Source wording: `batch.ts:346` (`methodNotes[0]`).

Done-check: `grep -c 'latch\|networkidle\|quiescence' workers/front/methodology/index.html` → ≥1 (0 today).

**4. Task 5 — path-level fence, keyed on resolved segments, derived from the registry.**

`batch.ts:111` `FENCED_VARIANT_PREFIXES = new Set(["remix3"])` keys on the variant segment only (`:125-136` `assertBenchableTarget`), so `/react-next/plp/apollo/` — registered fenced at `packages/switcher/src/config.ts:160` — is benchable today. Its own standard at `:103-107`: "a receipt naming it must be impossible to mint".

`@pm/switcher` is already a bench-runner devDependency (`tools/bench-runner/package.json`) and `chrome-constant.ts:52` already imports it — the drift test's comment at `bench.browser.test.ts:395-398` ("would invert the dependency") is stale; rewrite it. Do not hardcode a second registry.

In `batch.ts`, beside `:111`:
```ts
import { SURFACE_CONTROLS } from "@pm/switcher";
const FENCED_PATH_SEGMENTS: string[][] = Object.values(SURFACE_CONTROLS)
  .flatMap((c) => c.strategies ?? [])
  .filter((s) => s.fenced)
  .map((s) => resolvedPathSegments(s.path).filter(Boolean));
```
In `assertBenchableTarget`, after the prefix check:
```ts
const seg = resolvedPathSegments(path).filter(Boolean);
for (const fenced of FENCED_PATH_SEGMENTS) {
  if (seg.slice(0, fenced.length).join("/") === fenced.join("/")) {
    throw new Error(`${path}: "/${fenced.join("/")}/" is a fenced exhibit path — the runner refuses the target so no receipt can ever carry it`);
  }
}
```
Drift test (`tools/origin-suite/suite/bench.browser.test.ts:394-406` iterates `fencedExhibits` only): add, for every `SURFACE_CONTROLS[*].strategies?.filter(s => s.fenced)`, `expect(() => assertBenchableTarget(s.path)).toThrowError(/fenced/)`, plus the alias shapes mirroring `:386-387`: `/react-next/plp/apollo`, `react-next/plp/apollo/`, `/./react-next/plp/apollo/`, `/react-next/plp/apollo//` — all must throw.

Mirror in `workers/front/build.mjs`: in the per-file loop (`:718` `for (const target of receipt.targets)`), refuse any target whose resolved path segments start with a fenced strategy path. Today `grep -c -i fenced workers/front/build.mjs` → 0. Note: `plp` has no `labBundle`, so `:709-711` already refuses any `plp-*` receipt filename; this mirror is defence in depth. (The receipt target's path field name was **not opened** — check `tools/bench-runner/src/receipt.ts`.)

Done-check (offline — `assertBenchableTarget` at `batch.ts:158` runs before `verifyOriginCommit` at `:179`):
```sh
pnpm bench run --origin http://127.0.0.1:8787 --targets /react-next/plp/apollo --profile fast-wifi-laptop 2>&1 | grep -i fenced   # refuses, no origin fetch
grep -c -i fenced workers/front/build.mjs   # >= 1
```

**5. Local gates.** `pnpm check` is `turbo run lint typecheck test` (root `package.json`) and `workers/front` has no `test` script — so it never runs `build.mjs`. Run the front build and both origin-suite modes as well. (Another agent runs these after this doc; listed for the operator.)
```sh
pnpm check
pnpm --filter @pm/front run build          # old 1c543ac receipts must still publish — PR-1 carries no gate
pnpm origin-suite                          # local mode
PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs   # crate mode
```

**6. Commit — explicit paths, one commit.**
```sh
git add docs/adr/0002-data-contract-and-frozen-snapshot.md docs/decision-map.md \
  docs/prototypes/measurement-pass-runbook-2026-09-01.md \
  packages/switcher/src/config.ts packages/switcher/src/index.ts \
  tools/bench-runner/README.md tools/bench-runner/src/batch.ts \
  tools/origin-suite/suite/bench.browser.test.ts \
  workers/front/build.mjs workers/front/methodology/index.html
git commit -m 'Arm the runner and correct the record before the re-run'
```
Once local `main` (`360f90a`) is pushed (Rob gate below), the branch is one commit over `origin/main`. Do not amend into `360f90a` — it is then a pushed `main` commit.

### Done-check for PR-1

```sh
X=$(git rev-parse origin/main)   # after merge + fetch; X is the squash SHA
until [ "$(curl -s $O/_pm/build.json | jq -r .sha)" = "$X" ]; do sleep 60; done
curl -s $O/_pm/build.json | jq -r .dirty   # false
```

### Rob gates (PR-1)

- Push local `main` (`360f90a`) first — `git push origin main` — so the PR diff is only these ten files. Skip this and the 29 prompt files in `360f90a` ride into the PR.
- Then push `measurement-pass`, open PR, merge. Only a merge to `main` deploys (`.github/workflows/ci.yml:80-82`).
- Task 3: option (b) as recommended (see Decisions). Confirm.
- ADR-0002 `:122-124`: dated addendum, or leave the disclosure in receipt + methodology only.
- Amend into one commit, or accept squash-merge.

---

## PR-2 — mint the receipts at X, land gate + receipts in ONE commit

Branch: `measurement-pass-receipts`, created AT the attested SHA X.

### Preconditions

```sh
git fetch origin && git switch -c measurement-pass-receipts origin/main
test "$(git rev-parse HEAD)" = "$(curl -s $O/_pm/build.json | jq -r .sha)" && echo SHA-OK
git status --porcelain | wc -l                        # 0
ls -la "$CA"
NODE_EXTRA_CA_CERTS=$CA node -e "fetch('$O/_pm/build.json').then(r=>r.json()).then(j=>console.log(j.sha.slice(0,7)))"   # == X
pnpm bench                                            # rebuilds dist via turbo, prints usage, exit 2 — expected
test "$(date -u +%H%M)" -le 2230 && echo TIME-OK      # ≥1.5 h before 00:00 UTC (17:00 PDT); else wait
```
Chromium: Playwright 1.61.1 → `browsers.json` chromium 1228 = `149.0.7827.55` (same as the old receipts' `harness.browserVersion`).

### Ordered steps

**1. Editorial re-run.** One nonce. Pre-warm the 10 effective URLs until each serves `content-encoding: br` (ADR-0001 discipline; effective URL order n, run, cache — `decision-map.md:514` citing `batch.ts:78-80`). Receipts write to the gitignored dir so the tree stays clean for batches 2 and 3. Hold merges to `main` during the window: `batch.ts:289-301` aborts if the attested build changes mid-batch.
```sh
NONCE=editorial-batch4-$(date -u +%Y-%m-%d)
T5=/vanilla/editorial/,/react-next/editorial/,/astro/editorial/,/qwik/editorial/,/htmx/editorial/
for p in vanilla react-next astro qwik htmx; do for c in '' '&cache=cold'; do
  curl -s -o /dev/null -D - -H 'accept-encoding: br' "$O/$p/editorial/?n=24&run=$NONCE$c" | grep -i content-encoding
done; done      # repeat until every line says br (refuter reports first hits already br on 2026-09-01 — unverified here)

# optional 1-run throwaway
NODE_EXTRA_CA_CERTS=$CA pnpm bench run --origin $O --targets $T5 --profile fast-wifi-laptop --runs 1 --n 24 \
  --interaction editorial-add-to-cart --nonce warmup-$NONCE --out tools/bench-runner/receipts/throwaway.json \
  && rm tools/bench-runner/receipts/throwaway.json

for prof in avg-broadband-desktop fast-wifi-laptop slow-4g-mid-phone; do
  NODE_EXTRA_CA_CERTS=$CA pnpm bench run --origin $O --targets $T5 --profile $prof --runs 7 --n 24 \
    --interaction editorial-add-to-cart --nonce $NONCE --out tools/bench-runner/receipts/editorial-$prof.json || break
done
```
Flags are real: `cli.ts:73-95` (`--origin --targets --profile --runs --n --interaction --nonce --out`); `--targets` is comma-split at `cli.ts:108`. Profile ids: `packages/measurement/src/profiles.ts:83,92,101`. Interaction ids: `collect.ts:58,90,137`.

Done-check:
```sh
for f in tools/bench-runner/receipts/editorial-*.json; do jq -c '{q:.harness.quiescence,bv:.harness.browserVersion,d:.commit.dirty,c:.commit.sha[0:7],o:.originCommit.sha[0:7],od:.originCommit.dirty,date,settled:([.targets[].columns[].runs[].interactionSettled]|map(select(.==true))|length)}' $f; done
# 3 receipts: q in-flight-tracked; d false; c == o == X; settled 70/70 (5 targets x 2 cols x 7); od false
jq -r '.date[0:10]' tools/bench-runner/receipts/editorial-*.json | sort -u | wc -l   # 1 (one UTC date)
git status --porcelain | wc -l                                                       # still 0
```

**2. PDP batches.** `fit.mjs:104` requires `vanilla, react-next, astro, qwik` (htmx has no PDP). Release `896191` (ADR-0008 `:198`: priced, 5 images; slug from `tools/snapshot-capture/crate/summaries.json`). `pdp-add-to-cart` throws at once if the buy button is disabled (`collect.ts:139-146`) — cheap to discover. Re-check the UTC guard first.
```sh
test "$(date -u +%H%M)" -le 2230 && echo TIME-OK
S=896191-explosions-in-the-sky-all-of-a-sudden-i-miss-everyone
T4=/vanilla/pdp/$S/,/react-next/pdp/$S/,/astro/pdp/$S/,/qwik/pdp/$S/
PN=pdp-batch1-$(date -u +%Y-%m-%d)
for p in vanilla react-next astro qwik; do for c in '' '&cache=cold'; do
  curl -s -o /dev/null -D - -H 'accept-encoding: br' "$O/$p/pdp/$S/?n=24&run=$PN$c" | grep -i content-encoding
done; done
for prof in avg-broadband-desktop fast-wifi-laptop slow-4g-mid-phone; do
  NODE_EXTRA_CA_CERTS=$CA pnpm bench run --origin $O --targets $T4 --profile $prof --runs 7 \
    --interaction pdp-gallery-switch --nonce $PN --out tools/bench-runner/receipts/pdp-$prof.json || break
done

PN2=pdp-add-to-cart-$(date -u +%Y-%m-%d)
# repeat the pre-warm loop with $PN2
for prof in avg-broadband-desktop fast-wifi-laptop slow-4g-mid-phone; do
  NODE_EXTRA_CA_CERTS=$CA pnpm bench run --origin $O --targets $T4 --profile $prof --runs 7 \
    --interaction pdp-add-to-cart --nonce $PN2 --out tools/bench-runner/receipts/pdp-add-to-cart-$prof.json || break
done
```
Done-check:
```sh
for f in tools/bench-runner/receipts/pdp*.json; do jq -c '{f:input_filename,id:.targets[0].interactionId,q:.harness.quiescence,c:.commit.sha[0:7],o:.originCommit.sha[0:7],settled:([.targets[].columns[].runs[].interactionSettled]|map(select(.==true))|length)}' $f; done
# 6 receipts; settled 56/56 each (4 x 2 x 7); c == o == X; one interactionId per file
jq -r '.date[0:10]' tools/bench-runner/receipts/pdp-avg*.json tools/bench-runner/receipts/pdp-fast*.json tools/bench-runner/receipts/pdp-slow*.json | sort -u | wc -l   # 1
git status --porcelain | wc -l   # 0
```

**3. Land the gate.** In `workers/front/build.mjs`, inside `bundleFromReceipt`, immediately before the `interactionSettled` loop at `:297`:
```js
if (receipt.harness?.quiescence !== "in-flight-tracked") {
  throw new Error(`front lab: receipt lacks harness.quiescence "in-flight-tracked" — its interactionSettled flags were produced by the pre-2026-08-28 networkidle latch and are unearned; not publishable`);
}
```
Unconditional. The old receipts' `harness` keys are exactly `[browser, browserVersion, settleMs]` (jq over `workers/front/lab/receipts/*.json` today), so this refuses `1c543ac` and accepts the re-run (`batch.ts:343` sets the field). Rewrite `tools/bench-runner/src/receipt.ts:230-232` — it currently says a gate "treats its ABSENCE as the weaker pre-fix guarantee", which contradicts this gate.

**4. Copy receipts.** Publishable ones into `lab/receipts/` (filenames must be `{surface}-{profile}.json`, `build.mjs:709-716`; the three editorial files overwrite the old ones). Evidence receipts go OUTSIDE `lab/receipts/` — `build.mjs:543` reads every `*.json` there and `:714` would refuse the `pdp-add-to-cart-*` name.
```sh
cp tools/bench-runner/receipts/editorial-*.json workers/front/lab/receipts/
cp tools/bench-runner/receipts/pdp-avg-broadband-desktop.json tools/bench-runner/receipts/pdp-fast-wifi-laptop.json tools/bench-runner/receipts/pdp-slow-4g-mid-phone.json workers/front/lab/receipts/
mkdir -p workers/front/lab/unpublished && cp tools/bench-runner/receipts/pdp-add-to-cart-*.json workers/front/lab/unpublished/
# write workers/front/lab/unpublished/README.md naming decision-map.md:392 (INP row withheld; one interaction per surface) as the reason
ls workers/front/lab/receipts/*.json | wc -l                       # 6
jq -r .date workers/front/lab/receipts/*.json | sort | head -1      # >= 2026-08-28
jq -r .commit.sha workers/front/lab/receipts/*.json | sort -u       # one line, == X
```
Record in `docs/decision-map.md`: X is the mint SHA, Y (this PR's merge) is the publish SHA — a receipt pins the tree it was measured from, never the commit that carries it. `build.mjs` never compares `receipt.commit.sha` to HEAD (only `:591` receipt==originCommit and `:763` one SHA per surface). Update `:402` "what main publishes today". Record nonces, date, and the Task 3 decision.

**5. Prove the gate bites, then passes.**
```sh
git stash push -- workers/front/lab/receipts && (pnpm --filter @pm/front run build; echo exit=$?); git stash pop
# stash restores the tracked 1c543ac editorial files (untracked pdp-* stay); sorted readdir hits editorial-avg first → expect non-zero exit naming quiescence
pnpm --filter @pm/front run build     # passes; /_pm/lab/pdp bundle now non-empty
pnpm check
pnpm origin-suite
PM_SEED_DIR=tools/snapshot-capture/crate node tools/origin-suite/run-local.mjs
```

**6. Commit — one commit, explicit paths.**
```sh
git add workers/front/build.mjs tools/bench-runner/src/receipt.ts workers/front/lab/receipts workers/front/lab/unpublished docs/decision-map.md
git commit -m 'Publish the post-ruler receipts and require their attestation'
```

### Done-check for PR-2 (after merge, deploy at Y)

```sh
Y=$(git fetch origin && git rev-parse origin/main)
until [ "$(curl -s $O/_pm/build.json | jq -r .sha)" = "$Y" ]; do sleep 60; done
curl -s $O/_pm/lab/editorial.json | grep -c "${X:0:12}"     # >= 1 (bundle carries mint SHA X; JSON shape unverified — grep, don't jq a path)
curl -s -o /dev/null -w '%{http_code}\n' $O/_pm/lab/pdp.json  # 200 (path per understand phase; unverified)
```
Local post-deploy smoke must run from a checkout whose HEAD == Y — `bench.browser.test.ts:80-100` calls `runBatch` without `allowCrossTree` and `:107-111` asserts `receipt.commit.sha == git rev-parse HEAD`:
```sh
git fetch origin && git switch --detach origin/main && test "$(git rev-parse HEAD)" = "$(curl -s $O/_pm/build.json | jq -r .sha)" \
  && NODE_EXTRA_CA_CERTS=$CA PM_ORIGIN=$O PM_EXPECT_BROTLI=1 pnpm --filter @pm/origin-suite exec vitest run
```
Or skip it and read CI's identical post-deploy smoke (`ci.yml:229-235`).

### Rob gates (PR-2)

- Push, PR, merge → deploys Y.
- **No merges to `main` during the mint windows** (~10–20 min editorial, ~16–32 min PDP). A mid-batch deploy aborts the batch (`batch.ts:289-301`).
- Gate semantics: unconditional (see Decisions). Confirm.
- Evidence location `workers/front/lab/unpublished/` — no existing convention found. Confirm.

---

## PR-3 — chrome constant, probed on the deployed plane at Y

Branch: `measurement-pass-constant`, created AT Y.

### Preconditions

```sh
git fetch origin && git switch -c measurement-pass-constant origin/main
test "$(git rev-parse HEAD)" = "$(curl -s $O/_pm/build.json | jq -r .sha)" && echo SHA-OK
git status --porcelain | wc -l   # 0
ls -la "$CA"
ls workers/front/lab/chrome-constant.json 2>&1   # No such file — absent on main today (lab/ holds fit.mjs, fit.d.mts, receipts/)
```

### Ordered steps

**1. Probe.** `pnpm bench` rebuilds BOTH `dist/cli.mjs` and `dist/chrome-constant.mjs` (`tools/bench-runner/package.json` build: `esbuild src/cli.ts src/chrome-constant.ts …`). The explicit build below is belt-and-braces, not required. Flags: `chrome-constant.ts:428-441`. The probe verifies the attested SHA before anything measures (`:467-471`) and re-checks after the last visit (`:529-543`) — hold merges during the ~2–5 min window.
```sh
pnpm --filter @pm/bench-runner build
NODE_EXTRA_CA_CERTS=$CA node tools/bench-runner/dist/chrome-constant.mjs --origin $O --target /vanilla/editorial/ \
  --profile slow-4g-mid-phone --runs 7 --out tools/bench-runner/receipts/chrome-constant.json
jq -c '{kind,c:.commit.sha[0:7],d:.commit.dirty,o:.originCommit.sha[0:7],cal:.measuredChrome.wireCalibrated,pop:.measuredChrome.populated,delta:.deltaMedians}' tools/bench-runner/receipts/chrome-constant.json
# kind pm-chrome-constant; c == o == Y; d false; wireCalibrated true; populated true (Y ships the receipts);
# deltaMedians finite, in the deployed band (~+76..+104 ms per decision-map.md:396 as read in the understand phase — not the local ~+236)
```

**2. Land it; remove the bootstrap pin.** `build.mjs:874` `BOOTSTRAP_CONSTANT_COMMIT = "49e00e51…"`; its comment at `:872-873` says remove it once the deployed-plane re-measure lands. Collapse `:875-881` to the unconditional attestation check.
```sh
cp tools/bench-runner/receipts/chrome-constant.json workers/front/lab/chrome-constant.json
pnpm --filter @pm/front run build
grep -c 'not been published for the current chrome' workers/front/dist/methodology/index.html   # 0 (absent-state copy is build.mjs:1220-1221)
pnpm check
```
The identity gate `build.mjs:947-949` hashes `renderChrome({variant, surface, pathname, search, location, lab})` (`:938-944`). The constant is not an input, so committing it cannot move the fragment hash — this resolves the prompt's "will the constant move the chrome" unknown from source. If the gate still refuses, stop and report; do not force.

**3. Commit.**
```sh
git add workers/front/lab/chrome-constant.json workers/front/build.mjs docs/decision-map.md
git commit -m 'Publish the chrome constant measured on the deployed plane'
```

### Done-check for PR-3 (after merge, deploy at Z) — the prompt's "Done means"

```sh
Z=$(git fetch origin && git rev-parse origin/main)
until [ "$(curl -s $O/_pm/build.json | jq -r .sha)" = "$Z" ]; do sleep 60; done
curl -s $O/methodology/ | grep -c 'not been published for the current chrome'   # 0
curl -s $O/methodology/ | grep -c 'quiescence\|in-flight'                       # >= 1
curl -s -o /dev/null -w '%{http_code}\n' $O/_pm/lab/chrome-constant.json         # 200 (path unverified)
jq -r .date workers/front/lab/receipts/*.json | sort | head -1                    # >= 2026-08-28
```
Smoke: same detached-checkout rule as PR-2, or read CI.

### Rob gates (PR-3)

- Push, PR, merge → deploys Z.
- No merges to `main` during the probe window.

---

## Decisions taken

**Cold column: option (b) — scope the claim, do not forward the knobs.** Both options cost one Rob merge + deploy before any receipt can mint: (a) because the plane must run the forwarding fix; (b) because `batch.ts:350` must be on the attested SHA (`origin-commit.ts:77`, `build.mjs:591`). At equal cycle cost, (b) is one string plus docs. (a) touches three variants' server data paths on the byte-receipted editorial surface (react-next `lib/edge.ts:12-15,:25,:35`; qwik `lib/edge.ts:25-27,:85,:146`; htmx `index.js:88,:94,:99`), needs `run`/`cache` validation so junk cannot reach pm-edge, and buys tier information for a column no published cell reads (`build.mjs:1032-1036`: "WARM only"). What (b) gives up: the cold column carries no edge-tier information for any editorial or PDP target; per-run nonce isolation is false for server-side fetches; ADR-0002 §8's cold=R2 intent stays unmeasured. (a) is the truer instrument and stays open as a later unit — rejected on cost, not correctness.

**Gate semantics: unconditional.** Refuse any receipt without `harness.quiescence === "in-flight-tracked"`. The absence-tolerant reading at `receipt.ts:230-232` would let `1c543ac` keep publishing — the exact receipts this pass exists to retire. Rewrite that comment in PR-2.

**Three PRs, not one.** Forced by `origin-commit.ts:77-84` (mint SHA must equal plane SHA), `git.ts:13` (any staged change dirties the pin), and `build.mjs:947-949` (constant must describe the chrome the plane ships, which needs the receipts deployed first).

**Fast path rejected:** mint today from a clean worktree at `26d66d0` (one merge fewer). The receipts would embed the false `methodNotes[4]` — Task 3 says the disagreement must not survive the re-run.

**Branch names:** `measurement-pass` (PR-1, exists), `measurement-pass-receipts`, `measurement-pass-constant`. Each later branch starts at the SHA the plane attests, never "latest main".

**Evidence receipts:** `workers/front/lab/unpublished/` with a README. Not under `lab/receipts/` (`build.mjs:543`, `:714`).

## Open unknowns

- Whether `main` moves between phases from other merges. Mitigation: branch from the attested SHA and re-check `SHA-OK` before every mint.
- Whether the `build.mjs` fence mirror is reachable today (`plp` has no `labBundle`; `:709-711` refuses first). Bounded; ship it as defence in depth.
- Whether `?n=24` appended to PDP URLs (`batch.ts:170` always appends `PLP_N.default`, `beacon.ts:35`) affects PDP rendering. Assumed inert.
- Deploy latency after merge (~8.5 min reported by the understand phase; not measured here). Secrets are set: the plane attests `26d66d0 dirty:false` today, so the deploy path (`ci.yml:111-121` credentials check) is live.
- Refuter observation, out of scope: vanilla `?cache=cold` was served as a Cloudflare cache HIT, so the cold DOCUMENT leg for build-time variants may never reach the Worker. Not verified here; a later unit.
- Whether Rob wants an ADR-0002 `:122-124` addendum or only the receipt + methodology disclosure.
- Receipt target path field name (for the `build.mjs` mirror) and the `/_pm/lab/*.json` response shapes — not opened this session.
- Chromium: expect `149.0.7827.55` (Playwright 1.61.1 `browsers.json`, revision 1228). A Playwright bump changes it; the receipts record whatever ran.

## Verification ledger (this session, 2026-09-01)

Opened and confirmed: `origin-commit.ts:31-41, :77-84`; `git.ts:13`; `.gitignore:8`; `build.mjs:297-306, :535, :543, :551-552, :591, :709-716, :718, :769-770, :872-881, :938-949, :1032-1036, :1220-1221`; `batch.ts:9-10, :103-111, :121-136, :158, :170, :179, :187, :289-301, :306, :343, :350`; `receipt.ts:225-226, :230-234`; `next.config.ts:13`; `config.ts:160`; `bench.browser.test.ts:80-100, :107-111, :386-406`; `chrome-constant.ts:52, :428-441, :467-471, :478, :529-543, :588-592`; `cli.ts:37, :73-95, :108`; `ci.yml:80-82, :111-121, :229-235`; `methodology/index.html:95-100, :180`; `README.md:22-25`; `decision-map.md:88, :376, :392, :394, :396 (first 400 chars), :402, :404, :433, :488, :514, :528`; `collect.ts:58, :90, :137-146`; `profiles.ts:83,92,101`; `fit.mjs:87, :104`; `edge/src/index.js:62-72, :84`; react-next/qwik/htmx edge fetch lines as cited; ADR-0002 `:122-124`; ADR-0008 `:198`; `stamp-build.mjs:37`; `beacon.ts:35`; the four `/api/live-price/` browser call sites, each inside a click handler: `variants/astro/src/scripts/pdp.ts:204` (listener `:199`), `variants/qwik/src/components/LiveOriginDemo.tsx:27` (`onClick$` `:22`), `variants/react-next/src/components/LiveOriginButton.tsx:27` (`ask` `:22`, bound `onClick={ask}` `:60`), `variants/vanilla/src/pdp.js:195` (listener `:190`); live `/_pm/build.json`; Node fetch fails without / succeeds with `NODE_EXTRA_CA_CERTS`; `which watch` → not found; lab receipts: 3 files, `1c543ac`, dated 2026-08-17, no `quiescence` key.

Not opened (marked unverified above): `batch.ts:77-81` URL order; `decision-map.md:396` beyond 400 chars (+76..+104 band); `/_pm/lab/*.json` shapes; CI duration; the git nested-ref refusal (refuter reproduction).
