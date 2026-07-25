// Everything `astro build` needs that Astro itself cannot produce
// (editorial-build slice C).
//
// Runs before every BUILD — and deliberately NOT before deploy. `deploy` is
// bare `wrangler deploy` on purpose: CI's "Deploy service-bound Workers" step
// runs `pnpm --filter … run deploy` outside turbo and does NOT set
// PM_SNAPSHOT (that env is scoped to the earlier "Build worker dists" step),
// so re-running this script there would resolve `fixture` from the default
// below and overwrite the crate-baked output moments before upload —
// publishing the fixture's "the fixture never leaves CI" prose to the crate
// plane. Do not "align" this with slice B's deploy shape: react-next needed
// that because its token copy was an undeclared, git-ignored INPUT a turbo
// cache hit never recreated, whereas everything this script produces ends up
// inside @pm/astro#build's declared outputs and IS restored on a cache hit.
// DIFF-TO-STARTER.md point 9 records the full reasoning.
//
// Two jobs:
//
//  1. Copy @pm/tokens' css + fonts into public/assets/pm. Astro serves
//     public/ verbatim — unprocessed, unhashed — which is what ADR-0003 §8
//     requires: the font files must arrive byte-identical to the @pm/tokens
//     sources and the canonical loading markup must ship as written. Astro's
//     other CSS route (importing stylesheets so Vite bundles them) would
//     hash the files and rewrite the @font-face URLs inside fonts.css,
//     breaking both. Resolved through this package's own declared
//     dependency, the placeholder-static/react-next mold.
//
//  2. Bake the snapshot. PM_SNAPSHOT (the selector minted by slice A) picks
//     which committed snapshot the page renders from — `fixture` by default
//     (the CI build, always), `crate` on the deploy job so the plane serves
//     pages baked from the snapshot it actually serves (ADR-0002 §7 /
//     ADR-0008 §9). The resolved payload is written where a component can
//     statically import it; the selector and the tray files are declared to
//     turbo (env + inputs on @pm/astro#build), because the origin job and
//     the deploy job share the turbo-origin-* cache family and an
//     undeclared selector would replay the origin job's fixture-flavored
//     dist straight onto the crate plane (turbo.json documents the mode).
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEditorialData } from "./resolve-snapshot.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const tokensRoot = dirname(
  dirname(
    createRequire(join(root, "package.json")).resolve("@pm/tokens/css/tokens.css"),
  ),
);
const assets = join(root, "public", "assets", "pm");
mkdirSync(assets, { recursive: true });
cpSync(join(tokensRoot, "css"), join(assets, "css"), { recursive: true });
cpSync(join(tokensRoot, "fonts"), join(assets, "fonts"), { recursive: true });

const name = process.env.PM_SNAPSHOT ?? "fixture";
const data = resolveEditorialData(name);
const dataDir = join(root, "src", "data");
mkdirSync(dataDir, { recursive: true });
// Trailing newline + 2-space indent: this file is git-ignored generated
// output, but a stable serialization keeps `git status`/diff noise out of a
// developer's way if they ever un-ignore it to look.
writeFileSync(join(dataDir, "snapshot.json"), `${JSON.stringify(data, null, 2)}\n`);

console.log(
  `astro: @pm/tokens copied into public/assets/pm; editorial baked from the ${name} snapshot`,
);
