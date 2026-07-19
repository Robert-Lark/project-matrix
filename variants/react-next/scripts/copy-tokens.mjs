// Copies @pm/tokens' css + fonts into public/ before `next build` runs, so
// Next serves them as byte-identical static assets (ADR-0003 §8: fonts are
// a controlled constant; the origin suite's font-leg test compares served
// bytes to these sources directly). Deliberately NOT `import`ed as regular
// CSS: Next's bundler would hash/process the files, breaking byte identity
// with @pm/tokens — the placeholder-static mold every static-delivery
// variant follows, adapted to Next's public/ convention (vanilla's build.mjs
// is the same idea via cpSync into its own dist).
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tokensRoot = dirname(
  dirname(createRequire(join(root, "package.json")).resolve("@pm/tokens/css/tokens.css")),
);
const dest = join(root, "public", "assets", "pm");

mkdirSync(dest, { recursive: true });
cpSync(join(tokensRoot, "css"), join(dest, "css"), { recursive: true });
cpSync(join(tokensRoot, "fonts"), join(dest, "fonts"), { recursive: true });

console.log("react-next: @pm/tokens copied into public/assets/pm");
