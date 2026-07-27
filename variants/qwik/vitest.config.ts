/**
 * Vitest through Qwik's own Vite pipeline. `qwikVite()` is what transforms
 * `component$()` boundaries into the QRL form the runtime expects, so a test
 * cannot render this variant's components without it (editorial-build slice D).
 *
 * This config lives in the VARIANT workspace rather than in `tools/repo-checks`
 * (where slices A and B put their pre-merge identity guards), for the reason
 * slice C recorded when it made the same call for Astro: hosting it in
 * repo-checks would route every repo-wide structural check through this one
 * variant's Vite plugin, so a framework upgrade could break guards that have
 * nothing to do with the framework. The guard is still reached pre-merge —
 * CI's `check` job runs `turbo run lint typecheck test`, which picks up this
 * workspace's `test` script, and `@pm/qwik#test` is declared `cache: false`
 * in turbo.json because its real inputs span the reference renderer and both
 * committed snapshots.
 */
/// <reference types="vitest/config" />
import { qwikVite } from "@builder.io/qwik/optimizer";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [qwikVite()],
  test: {
    include: ["test/**/*.test.ts"],
  },
});
