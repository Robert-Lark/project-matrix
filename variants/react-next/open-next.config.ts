import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental-cache override: this variant has no ISR/SSG routes (the
// editorial page is force-dynamic SSR) — see wrangler.jsonc.
const config = defineCloudflareConfig();

// `defineCloudflareConfig`'s parameter type only accepts Cloudflare-specific
// overrides (incrementalCache/tagCache/...) — `buildCommand` isn't among
// them, so it must be set on the returned object directly. Without it,
// @opennextjs/aws's buildNextjsApp() shells out to `${packager} build` —
// for pnpm that's literally `pnpm build`, i.e. THIS package's own "build"
// script (`... && opennextjs-cloudflare build`) — which recurses infinitely
// (found by running the build locally: it kept re-invoking itself, only
// ever printing the "Building Next.js app" banner before failing — see
// DIFF-TO-STARTER.md).
config.buildCommand = "pnpm exec next build";

export default config;
