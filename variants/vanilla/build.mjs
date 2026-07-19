// Assemble the vanilla variant's dist: static HTML, no runtime — the build
// script IS the paradigm (a hand-rolled static site generator over the frozen
// trays). Snapshot-parameterized via PM_SNAPSHOT (fixture default — the CI
// build, always; the deploy job sets `crate` so the plane serves pages baked
// from the snapshot it actually serves, ADR-0002 §7 / ADR-0008 §9). The
// selector and the tray files are declared to turbo (env + inputs on
// @pm/vanilla#build) — an undeclared selector would replay the origin job's
// fixture-flavored dist straight onto the crate plane (turbo.json documents
// the failure mode).
//
// Copying @pm/tokens into the variant's own assets is the paradigm's
// delivery model (ADR-0003 §2), resolved through this package's own declared
// dependency — the placeholder-static mold.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { renderEditorialPage } from "./render.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(root, "..", "..");

const SNAPSHOTS = {
  fixture: join(repoRoot, "tools", "snapshot-fixture", "snapshot"),
  crate: join(repoRoot, "tools", "snapshot-capture", "crate"),
};

const name = process.env.PM_SNAPSHOT ?? "fixture";
const snapDir = SNAPSHOTS[name];
if (!snapDir) {
  console.error(`PM_SNAPSHOT=${name} is not a known snapshot (fixture|crate)`);
  process.exit(1);
}

const read = (f) => JSON.parse(readFileSync(join(snapDir, f), "utf8"));
const snapshot = {
  name,
  manifest: read("manifest.json"),
  summaries: read("summaries.json"),
  details: read("details.json"),
};

// The featured release: the fixture's curation.json names it; the crate's
// frozen curation predates the field, so the crate pick is a design constant
// (ADR-0008 §9: editorial 953800 — a curated choice, like the crate itself).
const featuredId =
  name === "crate" ? 953800 : read("curation.json").featured;
if (featuredId == null) throw new Error(`${name}: no featured release id`);

const tokensRoot = dirname(
  dirname(
    createRequire(join(root, "package.json")).resolve(
      "@pm/tokens/css/tokens.css",
    ),
  ),
);
const dist = join(root, "dist", "vanilla");

rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(join(dist, "editorial"), { recursive: true });

writeFileSync(
  join(dist, "editorial", "index.html"),
  renderEditorialPage(snapshot, featuredId),
);
cpSync(join(tokensRoot, "css"), join(dist, "assets", "pm", "css"), {
  recursive: true,
});
cpSync(join(tokensRoot, "fonts"), join(dist, "assets", "pm", "fonts"), {
  recursive: true,
});
cpSync(join(root, "src", "cart.js"), join(dist, "assets", "cart.js"));

console.log(`vanilla: editorial rendered from the ${name} snapshot`);
