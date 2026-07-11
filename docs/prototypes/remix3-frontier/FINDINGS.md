# remix3-frontier — Findings

Resolves the `remix3-frontier` ticket in [`docs/decision-map.md`](../../decision-map.md)
(issue [#10](https://github.com/Robert-Lark/project-matrix/issues/10)).
Two jobs: (1) re-verify Remix 3's status at build time against primary
sources, and (2) decide the fenced frontier showcase's hosting — hand-rolled
Cloudflare Workers entry vs off-plane Node host — by prototyping, not
doc-reading. Research ran as 4 areas, every claim re-fetched by an
independent adversarial verifier: **54/54 claims CONFIRMED, 0 contradicted**
(2026-07-11) — the full claim set (claim + verbatim quote + URL + verdict +
verifier evidence) is committed at
[`research/claims.json`](research/claims.json) so the number is auditable,
not asserted. The spike in this directory is the empirical leg
([README](README.md); `test.sh` 42/42 across both hosts).

**Verdict: the showcase is hosted on the canonical plane via a hand-rolled
Workers entry.** The full Remix 3 render path — `@remix-run/ui` streaming
SSR + frames + render-middleware + fetch-router — runs on workerd without
`nodejs_compat`, emitting HTML identical to the official Node host's
(modulo per-render instance ids). ADR-0004 §1 survives intact; an addendum
records the decision. Two sub-questions (ADR-0003 contract; labeling)
resolved in §6–§7.

---

## 1. Status re-verified (2026-07-11): unchanged since 2026-07-06, still fenced-beta

- **`3.0.0-beta.5` is the newest v3 anywhere.** npm `next` dist-tag →
  `"next": "3.0.0-beta.5"`, published `"2026-07-01T19:04:05.918Z"`; the
  registry's `modified` timestamp coincides with that publish, so nothing
  newer exists package-wide — per <https://registry.npmjs.org/remix>.
  GitHub agrees: the matching-refs query for `remix@3*` returns exactly
  alpha.0–6 + beta.0–5, no RC, no stable — per
  <https://api.github.com/repos/remix-run/remix/git/matching-refs/tags/remix@3>.
- **Still "not production ready."** "This is still a pre-release. It is not
  production ready yet, and there is still a lot to do." — per
  <https://remix.run/blog/remix-3-beta-preview> (2026-04-30). No newer post
  retracts it; the newest (React Router v8, 2026-06-17) still says "check
  out the Remix 3 beta" — per <https://remix.run/blog/react-router-v8>.
- **Cadence:** betas landed 04-30 / 05-20 ×2 / 05-29 / 06-05 / 07-01 — the
  beta.4→beta.5 gap widened to ~26 days (registry `time` field). The fence
  stays mandatory; the weekly-breakage risk is real but not accelerating.
- **Gap (recorded, not extrapolated):** no RC timeline exists in any fetched
  source.

## 2. The paradigm, confirmed from the shipped beta

- **Non-React, own component model.** "That means no critical dependencies,
  not even React." — per <https://remix.run/blog/wake-up-remix>. The 2025
  Preact-fork direction is literally struck through in that post:
  "`<del>`We're starting with a fork of Preact…`</del>` Instead, we're
  building our own component model". Components take a `Handle` and return
  a render closure; state is "plain JavaScript variables … explicit
  updates" — per <https://remix.run/blog/remix-3-beta-preview>.
- **Frames are the flagship mechanism.** "A frame is server-rendered UI
  with a `src`. The client can load it, navigate it, or reload it
  independently while the server keeps rendering HTML. It's server/client
  communication that feels like the web: URLs, requests, responses, and
  markup instead of a separate RPC layer." — per
  <https://remix.run/blog/remix-3-beta-preview>. The shipped primitive:
  "A `<Frame>` renders server content into the page. Frames can stream in
  after the initial HTML, nest inside other frames, contain client entries,
  and be reloaded from the client without a full page navigation." — per
  <https://raw.githubusercontent.com/remix-run/remix/main/packages/ui/docs/frames.md>.
- **Render pipeline:** `renderToStream` (`remix/ui/server`) with a
  `resolveFrame` hook; `render-middleware` puts `context.render()` on the
  router context; `run()` boots client hydration. The spike exercises all
  of it. (`html-template` is a separate lower-level tool, not the component
  renderer.)
- **Declarative frame navigation** (read from the shipped
  `@remix-run/ui@0.4.0` dist, `runtime/navigation.js`): `run()` starts a
  Navigation API listener; plain `<a href>` clicks are intercepted and
  routed through frame reloads, steered by `rmx-target` / `rmx-src` /
  `rmx-document` anchor attributes. With JS off the anchors are ordinary
  links — progressive enhancement is the default posture.

## 3. Deployment story, re-verified: still no official Workers target

- The only official template is Node: `node:http` +
  `createRequestListener` from `remix/node-fetch-server`, Node ≥ 24.3,
  run via `node --import remix/node-tsx` — per
  <https://raw.githubusercontent.com/remix-run/remix/main/template/server.ts>
  and its package.json.
- Workers remain a README portability claim — "Remix packages work
  seamlessly across Node.js, Bun, Deno, Cloudflare Workers, and other
  environments" — per
  <https://raw.githubusercontent.com/remix-run/remix/main/README.md> — plus
  two sub-package demos (`fetch-router`+D1, `multipart-parser`+R2), both
  still present on main. A maintainer deliberately scoped the demo: "For
  this project we're keeping it really simple and just showing how
  `fetch-router` works on Cloudflare Workers" — per
  <https://api.github.com/repos/remix-run/remix/issues/10834/comments>.
  That demo runs with **no compatibility flags** (wrangler.jsonc sets only
  a compatibility_date).
- Cloudflare's framework guide covers "React Router (formerly Remix)" v8,
  not Remix 3 — per
  <https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/>.
- **The decisive gap:** *no official example runs the full v3 render path
  (`@remix-run/ui` + render-middleware) on Workers, and no maintainer
  statement covers it either way.* Doc-side, the core packages are
  promising — `fetch-router` documents "Node.js, Bun, Deno, Cloudflare
  Workers, and browsers"; `ui`, `render-middleware`, `response` (except
  `./compress`), `headers`, `html-template` publish no `engines` field and
  their dists contain **zero `node:` imports** (registry + dist
  inspection). Node-bound packages are cleanly separated: `assets`
  (fs/watcher/toolchain), `static-middleware` (fs), `node-fetch-server`,
  `node-tsx`, `response/compress` (zlib). The spike closes the gap
  empirically. ↓

## 4. The spike: full render path on workerd — PASS

One app, two hosts (README has the run steps). `test.sh`: **42/42**.

| Mechanism | worker (:8931, wrangler 4.110) | node (:8932, template shape) |
|---|---|---|
| Streamed document SSR (`renderToStream` → `createHtmlResponse`) | PASS | PASS |
| Frame resolved INLINE during SSR (`resolveFrame` via internal `router.fetch`; content in view-source) | PASS | PASS |
| Standalone HTML partial at the frame's `src` | PASS | PASS |
| JS-off fallback: same content as a full page (`/?pick=n`) | PASS | PASS |
| Island (`clientEntry`) hydration data serialized; prebuilt module URLs resolve | PASS | PASS |
| Prebuilt assets served (Workers Static Assets / `staticFiles`) | PASS | PASS |
| 404 on unknown route | PASS | PASS |
| Cross-host: `/` identical modulo per-render `rmx` instance ids; partial byte-identical | PASS | — |

**No `nodejs_compat` flag.** The Worker config sets only a
compatibility_date — the same shape as the maintainers' fetch-router demo,
now proven for the full UI render path.

Frictions hit (both small, both recorded):

1. **`clientEntry()` needs a stable ID on workerd.** The template's
   `clientEntry(import.meta.url, …)` idiom throws
   `clientEntry() requires an entry ID` at Worker startup: workerd leaves
   the wrangler-bundled module's `import.meta` **empty at runtime** —
   probed inside the running Worker: `url === undefined`, zero keys —
   while the bundle itself preserves the `import.meta.url` expression
   verbatim (verified in the emitted bundle), so this is runtime behavior,
   not a bundler transform. Fix: a literal fallback ID
   (`import.meta.url || 'file:///app/client/….tsx'`) — the ID is an opaque
   key mapped through `resolveClientEntry`. A real adapter would inject
   these at build time.
2. **No runtime asset server on Workers.** The template compiles client
   entries per-request via `createAssetServer` (Node-only: fs + esbuild +
   chokidar). Workers-shaped equivalent: prebuild with esbuild
   (`build-client.mjs`, code-splitting so entry + islands share one runtime
   chunk — required so they see the same module instances) and serve via
   Workers Static Assets. ~30 lines of build script.

Browser leg — see §5. Sizes, as spike facts (not benchmarks): entry.js
520 B + island 756 B + shared `remix/ui` runtime chunk 163.5 KB
*unminified, dev build*. The exhibit publishes no numbers (fenced).

## 5. Browser-verified behaviors (system Chrome via devtools, Workers host)

- **Island hydrates**: counter button responds to clicks.
- **Anchor-driven frame reload**: clicking "Next pick →" produced exactly
  one network request — a `fetch` of `/frames/staff-pick?pick=1`
  (`text/html`) — no document navigation. The island's counter state
  **survived the swap** (the page demonstrably did not reload), and the
  URL updated to `/?pick=1` via the Navigation API.
- **Repeated cycling** works (frame content carries its own next-anchor).
- **History integration**: browser Back restored the previous frame content
  — again without a document reload (counter state still intact).
- Console: zero messages/errors throughout.
- JS-off anchor fallback is plain-HTML semantics (`<a href>` navigates);
  the server side of it — full page rendering any `?pick=` state — is
  asserted by `test.sh` on both hosts.

## 6. Hosting decision — Workers entry on the canonical plane

**Chosen: the hand-rolled Workers entry** (the ~15-line `worker/index.ts`).
Grounds:

- **It works, verified end-to-end** (§4–§5), with zero compat flags and no
  patched packages — the beta's core is genuinely web-standard, matching
  its stated design ("Build on Web APIs … Religiously Runtime").
- **ADR-0004 §1 holds without an exception.** The exhibit stays on the
  canonical plane, co-located with the data plane, behind the same front
  Worker (it emits a normal Worker — a service-binding target like every
  other variant, per the cf-composition findings), inside the one-SHA
  monorepo and the composed origin's URL scheme. The chrome slot works
  (the spike's Document carries `#pm-chrome-slot`).
- **"Idiomatic default, not hand-tuned" is not violated.** That rule
  presumes an official adapter exists; Remix 3 has *no* deployment story
  beyond a Node template. For a fetch-native router whose own README lists
  Workers, a plain `fetch` handler *is* the idiomatic Workers shape — and
  the entry does nothing tuned (no caching, no precomputation; it calls
  `router.fetch`).

**Rejected: fenced off-plane Node host.** It was acceptable in principle
(the frontier is already fenced from core numbers), but it buys nothing the
fence doesn't already excuse, while costing: a second hosting provider +
deploy pipeline for one exhibit; a different transport stack; the exhibit
falling outside the composed origin (switcher would need an off-origin
navigation; cart/localStorage don't cross origins); and a *weaker* story —
"the frontier couldn't run where everything else runs" — when empirically
it can. Revisit trigger: if a future beta pin breaks the Workers entry in a
way a pinned version can't hold (e.g. the render path grows a hard Node
dependency), the off-plane Node host is the recorded fallback, and the
fence already covers it.

**Risk accepted (and contained):** this hosting shape is unofficial — no
upstream support, and a beta bump may break it any week. Containment:
exact-pin `remix@3.0.0-beta.5` **plus the committed lockfile — the
metapackage caret-ranges every `@remix-run/*` sub-package (e.g. `ui`:
`^0.4.0`), so the lockfile is what actually pins the render path**; the
spike's `test.sh` is the canary to re-run on any bump; the exhibit is
fenced, so a breakage can never block the benchmarked matrix or its
deploys.

## 7. Sub-questions resolved against the ADRs

**(a) Does the fenced showcase owe the ADR-0003 canonical-markup/shared-CSS
contract? Yes.** "Fenced" fences *numbers* (ADR-0002 §3, ADR-0004 §1
vocabulary) — it has never meant visual exemption, and the showcase renders
store components on a store surface (the Editorial spine). Visual identity
is what makes the exhibit legible as "the same store, different paradigm."
The spike shows the contract is cheap to honor: Remix 3 renders plain
`pm-` class markup + an external stylesheet without friction; its `css()`
mixin is opt-in per element (used once here, on exhibit-only chrome — never
on store components, where it would fork the markup contract).

**(b) Does the drift gate cover it? Yes — but advisory, not blocking.**
ADR-0003 §6's gate exists to make the zero-bias guarantee un-riggable *for
the benchmarked variants*; Remix 3 is in no number, so a drift there
defrauds no comparison. But an unwatched exhibit rots silently. Judgment:
the Editorial build wires the remix3 surface into the same
normalized-DOM + pixel checks with its paradigm noise registered (the
`rmx:f`/`rmx:h` comment markers, the `#rmx-data` script, the
`<style data-rmx>` element the runtime injects into `<head>`, and
`rmxc-*` classes on non-store chrome) — and reports drift as a **warning
that never fails CI**. A weekly-cadence beta must not be able to block the matrix's deploy;
a broken-beyond-repair exhibit is handled by the fence label, not by
holding the pipeline hostage. This is an application of ADR-0003 §6's
purpose, not a reversal — flagged loudly: an ADR-0003 addendum carries the
carve-out so the ADR of record can't be read as contradicted, and ADR-0004's
second addendum records the propagation.

**(c) How does the labeling meet every-surface-self-explains?** Three
layers, all machine-checkable:
1. **On-surface plaque** (the spike demonstrates it, asserted by
   `test.sh`): names the exact version, "pre-release", and "excluded from
   every benchmark number", with `data-pm-fenced="true"` as the
   machine-readable hook (for the chrome, the drift normalizer, and any
   auditor). Final copy is the Editorial build's job; the mechanism is
   proven.
2. **Chrome**: the Editorial render-switcher lists remix3 with a
   pre-release tag in the control itself, and the HUD on the remix3
   variant shows the visitor's own RUM but **no published lab snapshot** —
   there is none by policy, and displaying one would contradict the fence.
3. **Receipts**: the bench runner's variant set excludes remix3 — today
   that is policy, not mechanism; the Editorial build must enforce it with
   a guard (e.g. the runner refusing a remix3 variant id) when the exhibit
   lands. The variant prefix keeps any URL self-identifying either way.

## 8. Confidence

- Release status / production-readiness: **high** — registry + tags +
  blog, adversarially re-fetched (54/54); but **decays fast by design** —
  re-verify at Editorial-build time (the pin's `test.sh` is the canary).
- Paradigm (frames/server-HTML/non-React): **high** — blog + shipped docs
  + shipped dist all agree, and the spike exercises the whole path.
- Workers hosting feasibility: **high for the pinned beta.5** — runnable
  spike, 42/42 + browser leg; **unknown for future betas** (unofficial
  shape, no upstream guarantee — the accepted §6 risk).
- Advisory-drift + labeling decisions: **judgment calls recorded here**,
  reviewable before the Editorial build consumes them.
- Not exercised (out of minimum scope, named so the Editorial build can't
  inherit them silently):
  - **Prefix-mounting under the composed origin** — the real exhibit lives
    at `/remix3/{surface}/…` behind the front Worker; the spike serves at
    `/`. Route mapping, frame `src`/`rmx-src` generation, anchor `href`s,
    and asset URLs all need to be prefix-aware there. cf-composition proved
    the *platform* side (prefix-nested assets, binding dispatch); the
    *app-level* URL generation under a prefix is this exhibit's largest
    unexercised seam.
  - **Browser behaviors have no committed automated check** — §5 was
    verified interactively (devtools); `test.sh` covers only the
    HTTP-observable side. Automated browser coverage belongs to the
    Editorial build's gate wiring.
  - Frame `fallback` streaming (non-blocking frames), nested frames,
    `remix/ui` behavior primitives (popover/menu/…), sessions/cookies
    middleware on workerd, and a real `wrangler deploy` (local workerd
    only — same accepted residual as the cf-composition spike, retired by
    the exhibit's first deploy).
