# cf-composition-spike — Findings

Resolves the `cf-composition-spike` ticket in [`docs/decision-map.md`](../../decision-map.md).
Verifies the [ADR-0004](../../adr/0004-deployment-topology-and-contextual-switcher.md)
single-origin composition mechanism against (a) a runnable local spike (this
directory, see [README](README.md)) and (b) Cloudflare/vendor **primary docs** —
7 research areas, every claim re-fetched and re-checked by an independent
verifier agent: **73/73 claims CONFIRMED, 0 contradicted** (2026-07-06).

**Verdict: the ADR-0004 mechanism holds.** No decision needs reversal. Three
hardenings and one local-dev caveat below; one pre-release fact narrows the
`remix3-frontier` ticket.

---

## 1. Empirical spike results (local, wrangler 4.107.0 / latest)

All 18 assertions in [`test.sh`](test.sh) pass when the four Workers run as
separate `wrangler dev` processes ([`dev.sh`](dev.sh)):

| ADR-0004 behavior | Result |
|---|---|
| §3 path-prefix dispatch via service bindings (`front/src/index.js`) | PASS |
| §3 prefix-nested static assets served through a binding | PASS |
| §7 HTMLRewriter chrome injected into `#pm-chrome-slot` (static + SSR HTML) | PASS |
| §7 non-HTML passes through the rewriter byte-identical (content-type guard) | PASS |
| §5 path + query params + upstream response headers survive binding + rewriter | PASS |
| `html_handling` trailing-slash 307 passes through the binding, prefix intact | PASS |
| Assets-first: front Worker's own home served without invoking its script | PASS |
| Unknown variant prefix → 404 from the front script | PASS |
| **Probe:** assets-ONLY Worker (no `main`) served through a service binding | **works** (local) |

### Local-dev defect: single-process multi-config mode

`wrangler dev -c front -c v1 -c v2 ...` (one process) **fails this shape**:
any static asset fetched through a service binding returns a bare `500`
(empty body, no log output; `html_handling` redirects survive, asset content
does not). The same requests succeed (a) when the target Worker is hit
directly, and (b) in cross-process mode (one `wrangler dev` per Worker,
distinct `--port` **and** `--inspector-port`, dev-registry connected).
Reproduce with `npm run dev:single-process`. Consistent with the docs labeling
the mode experimental: "Support for running multiple Workers at once with one
Wrangler command is experimental, and subject to change" — per
<https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/>.
Cross-process is equally documented: "Workers run in different dev commands but
can still communicate with each other via service bindings" — per
<https://developers.cloudflare.com/workers/local-development/multi-workers/>.

**Consequence for the monorepo:** dev orchestration = one `wrangler dev` per
Worker (fits one Turborepo `dev` task per workspace), not the multi-`-c` form.

## 2. Composition primitives — doc-verified

**Service bindings** (all per
<https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/>
and <https://developers.cloudflare.com/workers/platform/limits/>):

- Off-internet, zero-overhead: "there is zero overhead or added latency. By
  default, both Workers run on the same thread of the same Cloudflare server."
- A forwarded `Request` goes to the target's `fetch()` handler; the docs never
  itemize field-level preservation — **the spike closes that gap empirically**
  (path/query/headers verified intact).
- Limits are comfortable: "A single request has a maximum of 32 Worker
  invocations, and each call to a Service binding counts towards this limit"
  (we use 2 per page view). Binding calls don't consume open-connection slots,
  but "Workers triggered via Service bindings share the same connection limit"
  (6 simultaneous, measured from the top-level request) — **identical for every
  variant, so a control, not a confound; relevant if a variant ever fans out
  6+ parallel origin fetches.**

**Workers Static Assets** (per
<https://developers.cloudflare.com/workers/static-assets/> and subpages):

- Assets-first routing confirmed (script only on asset miss);
  `run_worker_first` defaults false and is path-scopable.
- `html_handling` default `auto-trailing-slash`; 307 redirects (behavior-table
  evidence, matches the spike's observed 307).
- Assets-only Workers (no `main`) are documented; asset miss without a script
  → 404.
- `env.ASSETS.fetch()` is documented, accepts Request/URL/string, and "the
  assets binding ignores the hostname; only the URL pathname is used" — per
  <https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/>
  and <https://developers.cloudflare.com/workers/static-assets/binding/>.
- Serving a site nested under a URL prefix is a documented shape — per
  <https://developers.cloudflare.com/workers/static-assets/routing/advanced/serving-a-subdirectory/>.
- **Documentation gap (the probe's question):** no official page states whether
  a service-binding fetch to an asset-hosting Worker traverses the target's
  asset-routing layer. The spike shows it working in local cross-process dev,
  but local ≠ prod. **Hardening 1** below removes the dependency on this
  undocumented behavior entirely.

**HTMLRewriter** (per
<https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/>):

- Selector list confirmed; `setInnerContent(content, {html: true})` confirmed;
  zero-copy streaming parse confirmed ("the transformed body being partially
  streamed back to the client" — Errors section). Status/header preservation is
  not stated in prose docs but is confirmed in workerd source (Response-as-init
  copies status/headers) *and* by the spike (`x-pm-ssr` survives).
- **Documented selector forms are `E#myid` (e.g. `div#user_info`); a bare
  `#id` is not in the table.** The spike's bare `#pm-chrome-slot` worked
  locally, but see Hardening 2.
- Reading a body means the runtime decompresses and recompresses automatically
  (per <https://developers.cloudflare.com/workers/runtime-apis/fetch/>) — no
  content-encoding trap for the rewriter path.

## 3. Per-paradigm adapters — doc-verified

- **Next.js → `@opennextjs/cloudflare` (OpenNext) on Workers.**
  `@cloudflare/next-on-pages` is deprecated and its repo archived (read-only
  since 2025-09-29) — per <https://github.com/cloudflare/next-on-pages>;
  Cloudflare's current guide never mentions it — per
  <https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/>.
  OpenNext supports Next 14/15/16, App Router, SSR, ISR, middleware (Node-mode
  middleware not yet), runs on the Workers Node.js runtime, and builds a normal
  Worker (`main: .open-next/worker.js` + `assets` dir + ASSETS binding); its own
  get-started config declares a service binding targeting itself
  (`WORKER_SELF_REFERENCE`), proving binding-target compatibility — per
  <https://opennext.js.org/cloudflare> and <https://opennext.js.org/cloudflare/get-started>.
- **Qwik → official `cloudflare-workers` adapter** in Qwik City
  (`npm run qwik add cloudflare-workers`); emits a standard Worker
  (`dist/_worker.js` default `fetch` export + Workers Assets). Qwik v1 stable
  (1.20.0, 2026-05-22), v2 in beta; actively maintained — per
  <https://qwik.dev/docs/deployments/cloudflare-workers/> and
  <https://github.com/QwikDev/qwik/releases>.
- **Astro → `@astrojs/cloudflare` v14 — Workers only.** "The Cloudflare adapter
  no longer supports deployment on Cloudflare Pages... you should migrate to
  Cloudflare Workers" — per
  <https://docs.astro.build/en/guides/integrations-guide/cloudflare/>. Fully
  static builds need **no adapter** (plain Workers Static Assets) — per
  <https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/>.
  Astro v7 current; `@astrojs/svelte` v9 official (Svelte 5 islands) — per
  <https://docs.astro.build/en/guides/integrations-guide/svelte/>.
- **HTMX / vanilla:** no adapter question — server-HTML from a plain Worker and
  static assets respectively, both first-class shapes (see §2).
- **Remix 3 → beta, NO official Cloudflare target.** `remix@3.0.0-beta.5`
  (2026-07-01) ships only under the npm `next` dist-tag; the team says it is
  not production ready — per <https://remix.run/blog/remix-3-beta-preview> and
  <https://registry.npmjs.org/remix>. The only official app template is a Node
  `node:http` server requiring Node ≥ 24.3.0 — per
  <https://raw.githubusercontent.com/remix-run/remix/main/template/server.ts>.
  Workers support exists as a README portability claim plus sub-package demos
  (`fetch-router` + D1, `multipart-parser` + R2), not a framework deployment
  path. Direction intact otherwise: frames/server-HTML confirmed in the beta;
  the Preact fork was dropped for their own `ui` package — per
  <https://remix.run/blog/wake-up-remix> (strikethrough edit) and repo contents.

## 4. Hardenings adopted (no ADR-0004 decision reversed)

1. **Every static variant carries the one-line ASSETS-forwarder script**
   (`variant-static/src/index.js`: `env.ASSETS.fetch(request)`). This makes
   every hop documented — binding → target *script* (documented) → own ASSETS
   binding (documented) — instead of relying on the undocumented
   binding→asset-layer path that only the probe supports. Cost: one line per
   variant.
2. **Chrome slot selector uses the documented `E#id` form** —
   `div#pm-chrome-slot`, not bare `#pm-chrome-slot` — when the real switcher is
   built. The slot element is already a `div` everywhere.
3. **Monorepo local dev = one `wrangler dev` process per Worker** with distinct
   `--port`/`--inspector-port` (the multi-`-c` single-process mode is
   experimental and demonstrably broken for assets-through-bindings).

**Residual risk (accepted, cheap to retire):** production behavior of the
composed origin is verified by docs + local runtime (workerd) but not yet by a
real deploy. First monorepo deploy should re-run `test.sh` against the
deployed origin as a smoke test — noted in the decision map.

## 5. Confidence

- Composition mechanism (dispatch, assets, rewriter, fidelity): **high** —
  runnable spike + documented primitives + 73/73 adversarially confirmed cites.
- Adapters (Next/Qwik/Astro): **high** — current official docs, cross-checked
  vendor + Cloudflare sides.
- Remix 3 facts: **high for 2026-07-06, decays fast** — beta cadence is weekly;
  re-verify at `remix3-frontier` build time (already the ticket's instruction).
- Assets-only-Worker-via-binding in production: **low/unknown** — undocumented;
  Hardening 1 removes the dependency.
