// Assemble the front Worker's static assets: the throwaway index plus the
// /_pm/* instrumentation files (ADR-0001 §6, ADR-0004 §7) — the chrome
// stylesheet from @pm/switcher and the pinned web-vitals client bundle from
// @pm/measurement. Instrumentation bytes live ONLY on this known path so the
// harness strips them precisely from measured KB.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, "package.json"));
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "_pm"), { recursive: true });

cpSync(join(root, "public"), dist, { recursive: true });
cpSync(
  require.resolve("@pm/switcher/chrome.css"),
  join(dist, "_pm", "chrome.css"),
);
// The measurement bundle is a built artifact; resolve the package root via
// its manifest, then take dist/measure.js (built by @pm/measurement's build,
// ordered ahead of this one by turbo's ^build).
cpSync(
  join(dirname(require.resolve("@pm/measurement/package.json")), "dist", "measure.js"),
  join(dist, "_pm", "measure.js"),
);

console.log("front: dist assembled (index + /_pm instrumentation)");
