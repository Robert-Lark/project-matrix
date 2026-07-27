// Everything the qwik build needs that vite/qwik cannot produce
// (editorial-build slice D). Two jobs, both small:
//
//  1. Copy @pm/tokens' css + fonts into public/assets/pm. Vite copies
//     public/ verbatim — unprocessed, unhashed — into the client's public
//     output (dist/qwik/ here, because of vite's `base`), which is what
//     ADR-0003 §8 requires: font files byte-identical to the @pm/tokens
//     sources and the canonical loading markup shipped as written. The
//     alternative — importing the stylesheets so vite bundles them — hashes
//     the files and rewrites fonts.css's own @font-face URLs, failing both
//     halves of §8 (the slice-C finding, which applies unchanged here).
//     Resolved through this package's own declared dependency, the
//     placeholder-static/react-next/astro mold.
//
//  2. Write dist/.assetsignore. The starter's own copy lives in public/, and
//     with the /qwik/ prefix that lands at dist/qwik/.assetsignore — where
//     Workers Static Assets never reads it (the file is only honoured at the
//     assets-directory ROOT, which is dist/). Without it, dist/_worker.js —
//     written to the assets root by the adapter's generate() hook — is served
//     as a public file. Verified both ways against a scaffold: 404 with this
//     file present, 200 without it.
//
// Unlike slice C's prepare-build, this script bakes NO snapshot: qwik is a
// REQUEST-TIME variant (ADR-0002 §7), so there is no PM_SNAPSHOT selector and
// nothing snapshot-flavoured in the build output at all.
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const tokensRoot = dirname(
  dirname(createRequire(join(root, "package.json")).resolve("@pm/tokens/css/tokens.css")),
);
const assets = join(root, "public", "assets", "pm");
mkdirSync(assets, { recursive: true });
cpSync(join(tokensRoot, "css"), join(assets, "css"), { recursive: true });
cpSync(join(tokensRoot, "fonts"), join(assets, "fonts"), { recursive: true });

// THREE patterns, and none of the starter's four are decoration:
//  - `_worker.js`/`_routes.json` — the adapter writes both to the assets ROOT,
//    so without these the bundled Worker source is downloadable (measured both
//    ways: 200 without this file, 404 with it).
//  - `404.html` — qwik-city's SSG step emits it, nothing references it, and it
//    is reachable as a stray 200 HTML page under this variant's prefix
//    (`/qwik/404.html` 307s to `/qwik/404`, which served 200 text/html). It is
//    not the 404 BODY — the router builds that from
//    `@qwik-city-not-found-paths`, so ignoring the file changes no 404
//    behaviour, only removes an HTML surface that carries no chrome slot.
//  - `_headers`/`_redirects` are deliberately NOT listed: those files are gone
//    with the starter's public/ copies (DIFF-TO-STARTER.md point 9), so a
//    pattern for them would match nothing.
// gitignore syntax — a pattern with no slash matches at any depth — so these
// cover the files wherever in dist/ they land. Written before the vite build on
// purpose — the client build empties dist/qwik, not dist itself, and
// this file is inside @pm/qwik#build's declared outputs so a turbo cache hit
// restores it.
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, ".assetsignore"), "_worker.js\n_routes.json\n404.html\n");

console.log("qwik: @pm/tokens copied into public/assets/pm; dist/.assetsignore written");
