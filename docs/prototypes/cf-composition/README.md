# cf-composition spike

Throwaway spike verifying the [ADR-0004](../../adr/0004-deployment-topology-and-contextual-switcher.md)
Cloudflare single-origin composition mechanism, per the `cf-composition-spike`
ticket in [`docs/decision-map.md`](../../decision-map.md). Doc-verification
results and the full findings live in [FINDINGS.md](FINDINGS.md).

## What it proves

A front routing Worker (`front/`) composes three stand-in variant Workers into
one origin, exercising every mechanism ADR-0004 assumes:

- **Path-prefix dispatch via service bindings** — `/{variant}/...` forwarded
  untouched to the bound Worker (`front/src/index.js`).
- **Prefix-nested Workers Static Assets** — the static variant serves assets
  nested under `/vanilla/` (the documented "serve a subdirectory" shape), so no
  path rewriting is needed anywhere.
- **HTMLRewriter chrome injection** — switcher/HUD injected into
  `#pm-chrome-slot` on `text/html` responses only; non-HTML passes through
  byte-identical.
- **Request fidelity** — path, query params, and upstream response headers
  survive the binding + rewriter (the URL is the measurement condition,
  ADR-0004 §5).
- **`html_handling` redirects** — trailing-slash 307s pass through the binding
  with the variant prefix intact.
- **Assets-first front** — the front Worker's own home page bypasses its script
  (no chrome injected); `run_worker_first` is the lever if that ever changes.
- **Probe:** an assets-ONLY Worker (no `main` script) IS servable through a
  service binding (belt-and-braces fallback: the one-line `ASSETS` forwarder in
  `variant-static/src/index.js`).

## Run it

```sh
npm install
npm run dev     # starts all four workers via dev.sh (see caveat below)
npm test        # asserts all of the above against localhost:8787
```

## Caveat: local dev needs one process per Worker

`npm run dev` uses `dev.sh` — four separate `wrangler dev` processes (distinct
`--port` and `--inspector-port` each) connected by wrangler's local dev
registry.

The single-process alternative (`npm run dev:single-process`, multiple `-c`
flags) is **broken for this shape** in wrangler 4.107.0 (latest as of
2026-07-06): static assets fetched *through a service binding* return a bare
`500` with an empty body (`html_handling` redirects survive; asset content does
not). Same requests succeed in cross-process mode, and the target Worker serves
the same assets fine when hit directly. Local-dev defect only — kept
reproducible via `npm run dev:single-process`.
