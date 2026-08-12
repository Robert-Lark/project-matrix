// Assemble the remix3 variant's static assets. NOT snapshot-parameterized —
// this is a REQUEST-TIME variant (trays fetched through the edge Worker per
// request, ADR-0002 §7), so no PM_SNAPSHOT is declared anywhere for it and
// nothing baked here depends on a snapshot. What dist/ carries:
//
//  - the prebuilt client runtime (src/client/entry.ts bundled by esbuild —
//    the template's runtime asset server is Node-only (fs + esbuild +
//    chokidar), so prebuilding is the Workers-shaped equivalent; the spike's
//    build-client.mjs is the prior art. No islands ship, so there is one
//    entry and no code-splitting concern);
//  - the shared tokens css/fonts, copied verbatim (the paradigm's delivery
//    model, ADR-0003 §2 — resolved through this package's own declared
//    dependency, the placeholder-static mold);
//  - the exhibit stylesheet (src/frontier.css) for the two fenced subtrees;
//  - the cart enhancement (src/cart.js).
//
// The rendered page itself is NOT here: the Worker renders it per request.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, "package.json"));

const tokensRoot = dirname(dirname(require.resolve("@pm/tokens/css/tokens.css")));

const dist = join(root, "dist", "remix3");

rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(join(dist, "assets"), { recursive: true });

await build({
  entryPoints: [join(root, "src", "client", "entry.ts")],
  bundle: true,
  format: "esm",
  outfile: join(dist, "assets", "entry.js"),
  target: "es2022",
  // Production posture (the template serves unminified dev builds through
  // its Node-only asset server; a real adapter would minify — recorded in
  // DIFF-TO-STARTER.md). The exhibit publishes no numbers either way.
  minify: true,
  sourcemap: false,
  logLevel: "warning",
});

cpSync(join(tokensRoot, "css"), join(dist, "assets", "pm", "css"), { recursive: true });
cpSync(join(tokensRoot, "fonts"), join(dist, "assets", "pm", "fonts"), { recursive: true });
cpSync(join(root, "src", "frontier.css"), join(dist, "assets", "frontier.css"));
cpSync(join(root, "src", "cart.js"), join(dist, "assets", "cart.js"));

console.log("remix3: assets assembled (prebuilt client runtime + tokens + exhibit css + cart)");
