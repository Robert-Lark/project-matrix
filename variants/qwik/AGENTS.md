## Development — do NOT run a framework dev server, and never judge this variant alone

The Qwik starter ships no `AGENTS.md`, so unlike the astro and react-next
variants this file is not a correction of starter prose — it exists because this
variant has a failure mode that reads as an application bug when it is actually a
missing neighbour. Symlinked as `CLAUDE.md`, so it auto-loads as project
instructions.

This variant is never served by `vite --mode ssr`. It is one Worker inside a
composed origin (ADR-0004 §3): the front Worker injects the switcher/HUD chrome
into `div#pm-chrome-slot`, serves the `/_pm/*` instrumentation, and routes
`/assets/img/*` and `/api/*` to the edge Worker. A framework dev server provides
none of that — no chrome, no measurement client, every image 404ing — while
looking superficially fine. The starter's `dev`/`preview`/`start` scripts are
gone for that reason (DIFF-TO-STARTER.md point 1); `pnpm run dev` here is
`wrangler dev`, matching every other variant.

**The 503 you will hit, and what it means.** This is a REQUEST-TIME variant: the
editorial route fetches trays per request through its own `pm-edge` service
binding. Run `wrangler dev` for `pm-qwik` on its own and the binding has no
target, so the route's `routeLoader$` fails and returns a branded
`fail(503, …)` page — Long Decay Records' own chrome around "This page
couldn't load". That page is correct behaviour for an unreachable data plane, not
a bug in this variant. **pm-edge must be running.** Run one of these from the
repo root instead:

```sh
pnpm run origin-suite   # build + start every Worker + run the suite + tear down
pnpm run dev            # every Worker under `wrangler dev` (qwik: 8795/9238)
```

The variant serves at `/qwik/editorial/` on `http://127.0.0.1:8787` — note
`127.0.0.1`, not `localhost` (slice B found a real transport-parity difference
between the two). `pnpm run build` is the right entry point for building, because
it runs `scripts/prepare-build.mjs` first to copy the design system into
`public/` untouched (ADR-0003 §8) and to write `dist/.assetsignore`.

## Two things about this codebase that are easy to get wrong

- **`base: "/qwik/"` in `vite.config.ts` is the ONLY place the URL prefix is
  declared.** qwik-city's router `basePathname`, the client's on-disk output
  directory, the served `q:base`, and `src/lib/assets.ts`'s asset root are all
  derived from it. Do not add a second literal `/qwik/` anywhere.
- **The served DOM is a contract, not a preference.** `packages/reference/surfaces/editorial/index.html`
  is the master; the drift gate compares this variant's normalized DOM and
  pixels against it. Anything Qwik adds to the markup (`q:*`, `on:*`,
  `on-document:*`) must be registered in `PERMITTED_NOISE["qwik"]`
  (`tools/drift-gate/src/normalize.ts`), and `variants/qwik/test/` proves the
  rendered components still equal the master for BOTH committed snapshots
  before merge. If a change makes the gate fail, the change is wrong — not the
  gate.

## Documentation

Full documentation: https://qwik.dev/docs/

Consult these guides before working on related tasks:

- [Components and `component$`](https://qwik.dev/docs/components/overview/)
- [Inline components (used here for the article + card)](https://qwik.dev/docs/components/overview/#inline-components)
- [Routing and `routeLoader$`](https://qwik.dev/docs/routing/)
- [State: `useSignal`, `useStore`, context](https://qwik.dev/docs/components/state/)
- [Tasks and lifecycle (`useOnDocument`, `useVisibleTask$`)](https://qwik.dev/docs/components/tasks/)
- [Deploying to Cloudflare Workers](https://qwik.dev/docs/deployments/cloudflare-workers/)
