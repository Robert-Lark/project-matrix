// @ts-check
import { defineConfig } from "astro/config";

// The astro variant (editorial-build slice C): islands, STATIC output —
// adapter-free on Workers (docs/prototypes/cf-composition/FINDINGS.md §3:
// "Fully static builds need no adapter (plain Workers Static Assets)"). The
// editorial surface has no request-time data need at all (trays are baked in
// by scripts/prepare-build.mjs), so @astrojs/cloudflare would add an SSR
// runtime this paradigm's real shape on this surface does not call for.
//
// https://astro.build/config
export default defineConfig({
  // Explicit though it IS the default: this variant's whole claim is that
  // nothing renders per request.
  output: "static",
  // The front Worker forwards every request UNTOUCHED (it never rewrites
  // paths), so the app owns its own prefix. `base` prefixes every URL Astro
  // generates — per the config reference, "Astro will use this path as the
  // root for your pages and assets both in development and in production
  // build". It does NOT change the on-disk layout, which is why outDir below
  // carries the prefix too.
  base: "/astro",
  // `astro build` writes pages at the outDir root, so the prefix has to be
  // part of the output PATH for wrangler's asset directory (./dist) to serve
  // them at /astro/editorial/ — the same nested shape vanilla's build.mjs
  // produces by hand (dist/vanilla/editorial/index.html).
  outDir: "./dist/astro",
  // /astro/editorial/ — the URL convention every other variant serves.
  trailingSlash: "always",
  build: {
    // The default, made explicit: emits editorial/index.html, not
    // editorial.html.
    format: "directory",
  },
});
