// Assemble dist for Workers Static Assets. Assets nest under /blog/ because
// pm-front forwards the ORIGINAL request untouched (ADR-0009 §1) — the URL
// path IS the dist path. esbuild bundles the CM6 editor as split ESM
// (grammar chunks load on demand); the worker script itself is bundled by
// wrangler.
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist", "blog");

rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(join(dist, "static"), { recursive: true });
mkdirSync(join(dist, "admin", "static"), { recursive: true });

copyFileSync(
  join(root, "src", "public", "styles.css"),
  join(dist, "static", "blog.css"),
);
// The footnote-popover enhancement (CSP script-src 'self': a real file).
copyFileSync(
  join(root, "src", "public", "notes.js"),
  join(dist, "static", "notes.js"),
);
copyFileSync(
  join(root, "src", "admin", "styles.css"),
  join(dist, "admin", "static", "admin.css"),
);

// Self-hosted faces (ADR-0009 §7): latin variable subsets only, straight out
// of the Fontsource packages — blog.css owns the @font-face declarations.
mkdirSync(join(dist, "static", "fonts"), { recursive: true });
const FONTS = [
  ["@fontsource-variable/fraunces", "fraunces-latin-opsz-normal.woff2"],
  ["@fontsource-variable/literata", "literata-latin-wght-normal.woff2"],
  ["@fontsource-variable/literata", "literata-latin-wght-italic.woff2"],
  ["@fontsource/fragment-mono", "fragment-mono-latin-400-normal.woff2"],
];
for (const [pkg, file] of FONTS) {
  copyFileSync(
    join(root, "node_modules", pkg, "files", file),
    join(dist, "static", "fonts", file),
  );
}

await build({
  entryPoints: [join(root, "src", "admin", "editor", "main.js")],
  outdir: join(dist, "admin", "static", "editor"),
  bundle: true,
  format: "esm",
  splitting: true,
  minify: true,
  sourcemap: false,
  entryNames: "[name]",
  chunkNames: "chunk-[hash]",
  logLevel: "warning",
});

console.log("blog: dist assembled");
