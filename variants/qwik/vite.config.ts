/**
 * Base vite config for the qwik variant (the adapter config extends this).
 *
 * Trimmed from the starter's version: its `errorOnDuplicatesPkgDeps` guard,
 * which reads `./package.json` at config time and throws if any qwik package
 * sits in `dependencies` rather than `devDependencies`. That guards a REAL
 * constraint — in `dependencies` the SSR build treats the framework as
 * external and the `@qwik-city-plan` virtual module then fails to resolve — so
 * the guard is dropped as config-time scaffolding and the invariant it asserted
 * is recorded here instead: both `@builder.io/*` packages belong in
 * `devDependencies`. An earlier version of this comment justified the removal
 * by claiming `tools/repo-checks` enforces the same thing repo-wide. It does
 * not: `workspace-isolation.test.ts` pins the ROOT devDependency set and
 * asserts the root has no `dependencies`, and nothing inspects a variant's
 * placement. Corrected rather than left as a comfortable-sounding reason (a
 * verify-slice finding). The commented-out `ssr` noExternal/external block went
 * with the guard: this variant's only runtime dependency is the framework
 * itself, and the Workers build bundles everything.
 *
 * `vite-tsconfig-paths` is dropped too, and that one was measured rather than
 * tidied away: nothing here imports through the starter's `~/*` alias (relative
 * imports throughout), so the plugin's only effect was to drag in `tsconfck`,
 * which wants `typescript@^5`, into a workspace that pins ^6 like the rest of
 * the repo — an unmet peer warning bought for an alias no file uses. The
 * `paths` entry left `tsconfig.json` with it, so the alias cannot typecheck
 * green and then fail at build.
 */
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import { defineConfig, type UserConfig } from "vite";

export default defineConfig((): UserConfig => {
  return {
    // The front Worker forwards every request UNTOUCHED and never rewrites
    // paths (ADR-0004 §3), so this app owns its own prefix. `base` is the
    // SINGLE source of it: qwik-city derives its router `basePathname` from
    // vite's base when none is given (lib/vite/index.mjs: `opts.basePathname
    // = viteBasePath`), the optimizer derives the client's public output
    // directory from it (`clientPublicOutDir = path.join(clientOutDir,
    // viteConfig.base)`, dist/optimizer.mjs), and the served container's
    // `q:base` follows — so routes, on-disk layout, and the lazy-chunk base
    // URL cannot disagree. Verified against a scaffold before this variant
    // was written: `q:base="/qwik/build/"`, chunks resolve at
    // /qwik/build/q-*.js. (Slice C had to keep astro's `base` and `outDir`
    // in agreement by hand — Qwik does that part itself.)
    base: "/qwik/",
    plugins: [qwikCity(), qwikVite()],
    optimizeDeps: {
      exclude: [],
    },
    server: {
      headers: {
        "Cache-Control": "public, max-age=0",
      },
    },
    preview: {
      headers: {
        "Cache-Control": "public, max-age=600",
      },
    },
  };
});
