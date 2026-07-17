// Assemble the front Worker's static assets: the home surface plus the
// /_pm/* instrumentation files (ADR-0001 §6, ADR-0004 §7) — the chrome
// stylesheet from @pm/switcher and the pinned web-vitals client bundle from
// @pm/measurement. Instrumentation bytes live ONLY on this known path so the
// harness strips them precisely from measured KB.
//
// The home surface (home-surface ticket, ADR-0007) is composed at build time:
//  - %%PM_TOKENS_CSS%% / %%PM_HOME_CSS%% inline the render-critical CSS from
//    the REAL @pm/tokens sources (single source of truth; the singleton paints
//    in one round trip — it is off the benchmarked matrix, so the variants'
//    canonical delivery contract is not in play, while the font loading
//    markup stays canonical per @pm/tokens/fonts/loading-markup.html).
//  - %%SNAP_*%% fields come from the committed crate SnapshotManifest — the
//    same document served live at /api/snapshot — so the page's on-surface
//    receipts (release count, freeze date, commit) structurally cannot drift
//    from the plane's. Hand-typing them is how a wrong SHA ships.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, "package.json"));
const dist = join(root, "dist");

// Resolve the @pm/tokens package root through this package's own dependency
// graph (isolation-honest, same shape as the variant builds).
const tokensRoot = dirname(
  dirname(require.resolve("@pm/tokens/css/tokens.css")),
);

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "_pm"), { recursive: true });
mkdirSync(join(dist, "pm", "css"), { recursive: true });
mkdirSync(join(dist, "pm", "fonts"), { recursive: true });

// ── The home surface ────────────────────────────────────────────────────
const manifest = JSON.parse(
  readFileSync(
    join(root, "..", "..", "tools", "snapshot-capture", "crate", "manifest.json"),
    "utf8",
  ),
);
// Fail loudly on a missing/renamed manifest field: String(undefined) would
// otherwise pass esc() and the %% guard, shipping "FROZEN undefined" as a
// receipt (and the receipts test, reading the same manifest, would agree).
if (
  typeof manifest.releaseCount !== "number" ||
  !/^\d{4}-\d{2}-\d{2}$/.test(manifest.capturedAt ?? "") ||
  !/^[0-9a-f]{40}$/.test(manifest.commitSha ?? "") ||
  typeof manifest.source !== "string" ||
  manifest.source.length === 0
) {
  throw new Error(
    "front: crate manifest is missing or malformed in a receipt field (releaseCount / capturedAt / commitSha / source)",
  );
}
const esc = (v) =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const tokensCss = readFileSync(join(tokensRoot, "css", "tokens.css"), "utf8");
const buttonCss = readFileSync(
  join(tokensRoot, "css", "components", "button.css"),
  "utf8",
);
const homeCss = readFileSync(join(root, "home", "home.css"), "utf8");

// Head colors (theme-color, favicon) cannot read CSS custom properties, so
// they are substituted from the REAL token file at build — a re-pour of the
// primitive tier moves them with it, same anti-drift rule as the receipts.
const token = (name) => {
  const m = tokensCss.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`front: token ${name} not found in tokens.css`);
  return m[1];
};
const uriHex = (hex) => hex.replace("#", "%23");

// Function replacements: with a string replacement, `$'`/`$&`/`$$` in the
// CSS would be replacement patterns — a future `[href$='…']` selector would
// silently duplicate the document tail past the %% guard.
const home = readFileSync(join(root, "home", "index.html"), "utf8")
  .replace("/*%%PM_TOKENS_CSS%%*/", () => `${tokensCss}\n${buttonCss}`)
  .replace("/*%%PM_HOME_CSS%%*/", () => homeCss)
  .replaceAll("%%SNAP_COUNT%%", () => esc(manifest.releaseCount))
  .replaceAll("%%SNAP_DATE%%", () => esc(manifest.capturedAt))
  .replaceAll("%%SNAP_SHA7%%", () => esc(manifest.commitSha.slice(0, 7)))
  .replaceAll("%%SNAP_SOURCE%%", () => esc(manifest.source))
  .replaceAll("%%TOKEN_PAPER%%", () => token("--pm-neutral-0"))
  .replaceAll("%%TOKEN_VINYL_URI%%", () => uriHex(token("--pm-neutral-950")))
  .replaceAll("%%TOKEN_PAPER_SUNK_URI%%", () => uriHex(token("--pm-neutral-50")));
if (home.includes("%%")) {
  throw new Error("front: unsubstituted %% marker left in home/index.html");
}
writeFileSync(join(dist, "index.html"), home);

// Canonical font loading (ADR-0003 §8): the identical files, served from this
// Worker's own assets at /pm/* — only the base path differs per consumer.
cpSync(join(tokensRoot, "css", "fonts.css"), join(dist, "pm", "css", "fonts.css"));
for (const f of [
  "FamiljenGrotesk.var.woff2",
  "PMWarnGlyph.U26A0.woff2",
  "LICENSE-OFL.txt",
  "LICENSE-OFL-Inter.txt",
]) {
  cpSync(join(tokensRoot, "fonts", f), join(dist, "pm", "fonts", f));
}

// ── /_pm/* instrumentation (unchanged) ──────────────────────────────────
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

console.log("front: dist assembled (home surface + /pm fonts + /_pm instrumentation)");
