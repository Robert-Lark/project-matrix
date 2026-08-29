import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// /react-next/ — the front Worker forwards every request untouched (never
// rewrites paths), so the app itself owns the prefix: routing, anchor
// hrefs, and static asset URLs all become basePath-aware (DIFF-TO-STARTER.md
// deviation from the starter's empty basePath). trailingSlash matches the
// canonical URL convention every other variant already serves
// (/vanilla/editorial/, not /vanilla/editorial).
const nextConfig: NextConfig = {
  basePath: "/react-next",
  trailingSlash: true,
  // OpenNext's Cloudflare bundler packages the self-contained Node.js
  // server output (.next/standalone/) into the Worker — required, not
  // optional (a bare `next build` without this never emits that directory,
  // which is what "opennextjs-cloudflare build" bundles).
  output: "standalone",
  turbopack: {
    resolveAlias: {
      // The fenced Apollo exhibit's REST glue is a pre-1.0 RC with a broken
      // package entry, and this is the second half of working around it (the
      // first is the `apollo-link-rest` packageExtensions entry in
      // pnpm-workspace.yaml, for an rxjs import it never declares).
      //
      // apollo-link-rest@0.10.0-rc.2 declares `"type": "module"` with
      // `"main": "bundle.umd.js"`, `"module": "index.js"` and NO `"exports"`
      // map. Turbopack honours `module` for the server graph but falls back to
      // `main` for the browser one, so the client build resolved the UMD
      // bundle and failed with "Export RestLink doesn't exist in target
      // module … The module has no exports at all" — the UMD wrapper reads
      // `global.apolloClient.utilities`, a global no bundler provides.
      // Measured in three resolvers this session, all the same way: Node's
      // ESM loader, vite's SSR resolver (hence vitest.config.ts's
      // `ssr.noExternal`), and Turbopack's browser condition.
      //
      // Aliasing the bare specifier to the ESM entry names the file the
      // package's own `module` field already points at — it does not patch or
      // vendor the library. ADR-0005 §7 pins the exact RC version precisely so
      // a bump re-runs this as its canary; this alias is what that canary
      // trips over if the packaging is ever fixed upstream.
      "apollo-link-rest": "apollo-link-rest/index.js",
    },
  },
};

export default async function config(phase: string) {
  // Lets `next dev` resolve Cloudflare bindings (getCloudflareContext)
  // without the full opennextjs-cloudflare build/preview cycle. Phase-gated:
  // this spins up a Miniflare platform proxy, and `initOpenNextCloudflareForDev`
  // doesn't itself check whether it's running under `next build` — calling
  // it unconditionally makes the OpenNext build's internal multi-phase next
  // build invocations each fight over the same proxy/port and fail (found by
  // running the real build locally: it looped, re-invoking the whole `pnpm
  // run build` repeatedly, only the "Building Next.js app" banner ever
  // printing — see DIFF-TO-STARTER.md).
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    initOpenNextCloudflareForDev();
  }
  return nextConfig;
}
