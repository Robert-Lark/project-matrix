/**
 * Vitest through Astro's own Vite pipeline — `getViteConfig` is Astro's
 * documented way to make `.astro` components importable from a test, which is
 * what the Container API needs to render one (editorial-build slice C).
 *
 * This config exists in the VARIANT workspace rather than in
 * `tools/repo-checks` (where slices A and B put their pre-merge identity
 * guards) for one reason: loading a `.astro` file requires Astro's compiler.
 * Hosting this guard in repo-checks would mean routing every repo-wide
 * structural check through Astro's Vite plugin — coupling the shared guard
 * workspace to one variant's toolchain, so an Astro upgrade could break checks
 * that have nothing to do with Astro. The guard runs pre-merge either way:
 * `turbo run test` (the `check` CI job) picks up this workspace's `test`
 * script, and `@pm/astro#test` is declared `cache: false` in turbo.json
 * because its true inputs span the reference renderer and both committed
 * snapshots.
 */
/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
