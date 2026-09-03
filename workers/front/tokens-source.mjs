// The REAL @pm/tokens sources this Worker's build composes from, resolved
// through this package's own dependency graph (isolation-honest, the same
// shape as the variant builds). One module, two consumers: build.mjs (home,
// methodology) and how-built-page.mjs (the how-it-was-built page, written at
// build attestation by stamp-build.mjs) — so head colours, the escape rule
// and the token lookup have one definition rather than one per page.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, "package.json"));

export const tokensRoot = dirname(dirname(require.resolve("@pm/tokens/css/tokens.css")));

/** A stylesheet from @pm/tokens by its path under css/. */
export const tokensCssFile = (rel) => readFileSync(join(tokensRoot, "css", rel), "utf8");

export const tokensCss = tokensCssFile("tokens.css");
export const buttonCss = tokensCssFile("components/button.css");

export const esc = (v) =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Head colors (theme-color, favicon) cannot read CSS custom properties, so
// they are substituted from the REAL token file at build — a re-pour of the
// primitive tier moves them with it, same anti-drift rule as the receipts.
export const token = (name) => {
  const m = tokensCss.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`front: token ${name} not found in tokens.css`);
  return m[1];
};
export const uriHex = (hex) => hex.replace("#", "%23");

/** The favicon every front singleton carries: the disc, from the tokens. */
export const faviconHref = () =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='48' fill='${uriHex(token("--pm-neutral-950"))}'/%3E%3Ccircle cx='50' cy='50' r='17' fill='${uriHex(token("--pm-neutral-50"))}'/%3E%3Ccircle cx='50' cy='50' r='3' fill='${uriHex(token("--pm-neutral-950"))}'/%3E%3C/svg%3E`;
