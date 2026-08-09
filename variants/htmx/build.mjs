// Assemble the htmx variant's static assets. NOT snapshot-parameterized —
// this is a REQUEST-TIME variant (trays fetched through the edge Worker per
// request, ADR-0002 §7), so no PM_SNAPSHOT is declared anywhere for it and
// nothing baked here depends on a snapshot. What dist/ carries:
//
//  - the shared tokens css/fonts, copied verbatim (the paradigm's delivery
//    model, ADR-0003 §2 — resolved through this package's own declared
//    dependency, the placeholder-static mold);
//  - the PINNED htmx runtime, vendored from the htmx.org npm package into
//    the variant's own assets and served same-origin (the documented install
//    is a script tag; a CDN include would fail the suite's same-origin
//    request tracker — editorial-build ISSUE E);
//  - the cart enhancement (src/cart.js).
//
// The rendered page itself is NOT here: the Worker renders it per request.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, "package.json"));

const tokensRoot = dirname(dirname(require.resolve("@pm/tokens/css/tokens.css")));
// Resolved as a package subpath so the lockfile pin is the single source of
// the bytes — nothing is copied into git.
const htmxJs = require.resolve("htmx.org/dist/htmx.min.js");

const dist = join(root, "dist", "htmx");

rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(join(dist, "assets"), { recursive: true });

cpSync(join(tokensRoot, "css"), join(dist, "assets", "pm", "css"), { recursive: true });
cpSync(join(tokensRoot, "fonts"), join(dist, "assets", "pm", "fonts"), { recursive: true });
cpSync(htmxJs, join(dist, "assets", "htmx.min.js"));
cpSync(join(root, "src", "cart.js"), join(dist, "assets", "cart.js"));

console.log("htmx: assets assembled (tokens + vendored htmx runtime + cart enhancement)");
