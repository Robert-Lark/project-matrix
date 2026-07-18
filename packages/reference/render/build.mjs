/**
 * Render the surface golden masters (ADR-0003 §6; surface-design session).
 *
 *   node render/build.mjs                 → fixture masters into surfaces/
 *                                           (the COMMITTED spec of record —
 *                                           CI-visible; regeneration-checked
 *                                           by reference.test.ts)
 *   node render/build.mjs --snapshot crate [--origin https://…]
 *                                         → crate renders into .local/
 *                                           (git-excluded design boards; the
 *                                           post-deploy drift leg re-renders
 *                                           from the served snapshot instead)
 *
 * `renderAll` is the pure seam the regeneration test consumes: same snapshot
 * in → same {relPath: html} map out, no filesystem writes. The CLI below is
 * the only writer.
 *
 * The sample surface (issue #6) predates the renderer and stays hand-pinned.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadSnapshot } from "./lib.mjs";
import { renderEditorial } from "./editorial.mjs";
import { renderPdp } from "./pdp.mjs";
import { renderPlp } from "./plp.mjs";
import { renderCheckout } from "./checkout.mjs";
import { renderA11yIndex, renderA11yElementDemos, renderA11yModeDemos } from "./a11y.mjs";
import { renderHowBuilt } from "./how-built.mjs";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export const SURFACE_PAGES = {
  "editorial/index.html": (s, o) => renderEditorial(s, o),
  "pdp/index.html": (s, o) => renderPdp(s, o),
  "plp/index.html": (s, o) => renderPlp(s, o),
  "checkout/index.html": (s, o) => renderCheckout(o),
  "a11y/index.html": (s, o) => renderA11yIndex(o),
  "a11y/element-demos/index.html": (s, o) => renderA11yElementDemos(o),
  "a11y/mode-demos/index.html": (s, o) => renderA11yModeDemos(o),
  "how-it-was-built/index.html": (s, o) => renderHowBuilt(o),
};

/**
 * Render every surface master from one loaded snapshot (lib.mjs
 * `loadSnapshot`). Returns { "editorial/index.html": "<!doctype html>…", … }
 * — exactly the bytes the CLI writes, so the regeneration test can hold the
 * committed masters to `renderAll(loadSnapshot("fixture"))` byte-for-byte.
 */
export function renderAll(snapshot, { origin = "", extraDepth = 0 } = {}) {
  return Object.fromEntries(
    Object.entries(SURFACE_PAGES).map(([rel, render]) => [
      rel,
      render(snapshot, { origin, extraDepth }),
    ]),
  );
}

// CLI (the only filesystem writer) — guarded so importing this module (the
// regeneration test does) renders nothing and writes nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const snapArg = process.argv.indexOf("--snapshot");
  const snapshotName = snapArg !== -1 ? process.argv[snapArg + 1] : "fixture";
  const originArg = process.argv.indexOf("--origin");
  const origin = originArg !== -1 ? process.argv[originArg + 1] : "";

  const snapshot = loadSnapshot(snapshotName);
  const outRoot =
    snapshotName === "fixture" ? join(pkgRoot, "surfaces") : join(pkgRoot, ".local", snapshotName);

  const pages = renderAll(snapshot, {
    origin,
    extraDepth: snapshotName === "fixture" ? 0 : 1,
  });
  for (const [rel, html] of Object.entries(pages)) {
    const out = join(outRoot, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    console.log(`rendered ${rel} (${snapshotName}${origin ? `, origin ${origin}` : ""})`);
  }
}
