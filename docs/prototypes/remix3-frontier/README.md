# remix3-frontier spike

Throwaway spike resolving the `remix3-frontier` ticket in
[`docs/decision-map.md`](../../decision-map.md): prove the minimum Remix 3
(beta) showcase mechanism — non-React server-HTML + frames — and decide its
hosting empirically. Research findings, citations, and the hosting decision
live in [FINDINGS.md](FINDINGS.md).

## What it proves

One host-agnostic app (`app/`) — an editorial page with a `<Frame>`-composed
staff-pick partial, anchor-driven partial reloads, one hydrated island, and
the pre-release fence plaque — served by **two hosts**:

- **`worker/`** — the hand-rolled Cloudflare Workers entry (~15 lines): the
  app router is fetch-shaped (`Request` in, `Response` out), which *is* a
  Worker's `fetch` handler. Runs on workerd with **no `nodejs_compat` flag**.
  This is the winning host (FINDINGS §4).
- **`server-node.ts`** — the official template's `node:http` +
  `remix/node-fetch-server` shape, kept as the comparison leg.

Both emit identical HTML (modulo per-render `rmx` instance ids) — asserted by
`test.sh` (42 checks), alongside: SSR-inline frame resolution (view-source
shows the pick), the standalone HTML partial, the JS-off full-page fallback,
island hydration data + export resolution, and prebuilt assets on both hosts.

Browser-verified interactively (see FINDINGS §5): island hydrates and holds
state; the "Next pick" anchor reloads *only the frame* over the wire (one
`fetch` of an HTML partial, no document reload — island state survives);
URL/history integrate via the Navigation API, including back/forward.

## Run it

```sh
npm install
npm run build:client   # esbuild → public/assets/ (entry + island + shared chunk)
npm run dev:worker &   # wrangler dev on :8931  (keep out of the repo's reserved ports)
npm run dev:node &     # node:http host on :8932
npm test               # asserts both hosts + cross-host identity
```

Requires Node ≥ 24.3 (the pinned beta's engines floor).

## Deliberate differences from the official template

- **Assets are prebuilt** (`build-client.mjs`), not compiled at request time:
  the template's `createAssetServer` is Node-only (fs + esbuild + watcher).
  Prebuilding is the Workers-shaped equivalent and both hosts serve the same
  bytes — Workers via Static Assets, Node via `staticFiles` middleware.
- **`render.tsx` drops the template's `node:path` import** (plain
  string-splitting of the entry id instead), making the render middleware
  host-agnostic.
- **Stable client-entry ID fallback**: workerd leaves the wrangler-bundled
  module's `import.meta` empty at runtime (`url === undefined` — probed),
  and `clientEntry()` throws on a missing ID (FINDINGS §4, friction #1).
- **Store components use plain `pm-` class markup + a stylesheet**, not the
  `css()` mixin — demonstrating the ADR-0003 canonical-markup contract renders
  without friction; `css()` appears once, on the exhibit-only island.

## Pinned versions

`remix@3.0.0-beta.5` (exact) — note the metapackage caret-ranges its
`@remix-run/*` sub-packages, so the committed `package-lock.json` is the
real pin. wrangler 4.110.x, Node 24.11 at spike time. The beta moves fast
and NOTHING here is expected to survive a beta bump unverified — re-run
`npm test` after any pin or lockfile change.
