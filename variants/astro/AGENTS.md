## Development — do NOT run `astro dev`

This is the starter's file with its Development section REPLACED (recorded in
`DIFF-TO-STARTER.md`). It is symlinked as `CLAUDE.md`, so it auto-loads as
project instructions — and the starter's advice, followed here, would produce
confidently wrong results.

This variant is never served by Astro's dev server. It is one Worker inside a
composed origin (ADR-0004 §3): the front Worker injects the switcher/HUD chrome
into `div#pm-chrome-slot`, serves the `/_pm/*` instrumentation, and routes
`/assets/img/*` and `/api/*` to the edge Worker. `astro dev` provides none of
that, so a page loaded from it has no chrome, no measurement client, and every
image 404s — while looking superficially fine. Any "it works" claim made
against it is meaningless for this project.

Run one of these instead, from the repo root:

```sh
pnpm run origin-suite   # build + start every Worker + run the suite + tear down
pnpm run dev            # every Worker under `wrangler dev` (astro: 8794/9237)
```

The variant serves at `/astro/editorial/` on `http://127.0.0.1:8787` — note
`127.0.0.1`, not `localhost` (slice B found a real transport-parity difference
between the two). `pnpm run build` here is fine and is what `astro build`
should be reached through, because it runs `scripts/prepare-build.mjs` first to
copy the design system in and bake the snapshot `PM_SNAPSHOT` selects.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
