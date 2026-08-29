import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // `apollo-link-rest@0.10.0-rc.2` names its ESM entry only in `"module"` and
  // has no `"exports"` map, so vite's SSR resolver would externalise it and
  // Node would load the UMD bundle, which throws on import. Inlining it makes
  // vite resolve it the way a bundler does — the same reason next.config.ts
  // carries a `turbopack.resolveAlias` for it.
  ssr: { noExternal: ["apollo-link-rest"] },
  resolve: {
    alias: {
      // The app's own tsconfig `paths` mapping, so the guard can import the
      // route LAYOUTS and assert which stylesheet list each one actually
      // passes — a leg that asserted the two exported constants alone was
      // vacuous: swapping them in a layout changed nothing it could see.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
