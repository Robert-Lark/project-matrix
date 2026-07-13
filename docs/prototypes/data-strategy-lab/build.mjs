/**
 * Build the three client bundles (same grid, data layer swapped) and report
 * MEASURED sizes — raw / gzip / brotli — into dist/sizes.json. The byte
 * comparison is tool-verified output of real builds, never quoted from
 * anyone's marketing page.
 */
import { build } from "esbuild";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const pages = ["plain", "tanstack", "apollo"];

await mkdir(join(ROOT, "dist"), { recursive: true });
await mkdir(join(ROOT, "vendor"), { recursive: true });

for (const page of pages) {
  await build({
    entryPoints: [join(ROOT, `src/page-${page}.jsx`)],
    outfile: join(ROOT, `dist/${page}.js`),
    bundle: true,
    minify: true,
    format: "esm",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "warning",
  });
}

// htmx is the server-loaders leg's whole client data layer — vendor it so
// its bytes sit in the same measured table.
await copyFile(
  join(ROOT, "node_modules/htmx.org/dist/htmx.min.js"),
  join(ROOT, "vendor/htmx.min.js"),
);

const sizes = {};
for (const [name, file] of [
  ...pages.map((p) => [p, `dist/${p}.js`]),
  ["htmx", "vendor/htmx.min.js"],
]) {
  const buf = await readFile(join(ROOT, file));
  sizes[name] = {
    rawBytes: buf.length,
    gzipBytes: gzipSync(buf, { level: 9 }).length,
    brotliBytes: brotliCompressSync(buf).length,
  };
}

// The data-layer delta: each React bundle minus the shared plain baseline
// (same React, same grid — the remainder is the data library).
for (const p of ["tanstack", "apollo"]) {
  sizes[p].dataLayerDeltaBrotli = sizes[p].brotliBytes - sizes.plain.brotliBytes;
}

await writeFile(join(ROOT, "dist/sizes.json"), JSON.stringify(sizes, null, 2));
console.table(
  Object.fromEntries(
    Object.entries(sizes).map(([k, v]) => [
      k,
      {
        raw: v.rawBytes,
        gzip: v.gzipBytes,
        brotli: v.brotliBytes,
        "Δ data layer (br)": v.dataLayerDeltaBrotli ?? "",
      },
    ]),
  ),
);
