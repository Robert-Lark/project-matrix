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
