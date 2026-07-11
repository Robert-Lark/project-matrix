// Prebuild the browser assets: the runtime bootstrap (entry.ts) and each
// clientEntry island module. Code splitting keeps remix/ui's runtime in a
// shared chunk so the entry and the islands hydrate against the SAME module
// instances (one frame registry, one style manager) — the invariant the
// official template gets from serving node_modules through its runtime
// asset server.
import { build } from 'esbuild'

await build({
  entryPoints: ['app/client/entry.ts', 'app/client/counter-button.tsx'],
  bundle: true,
  format: 'esm',
  splitting: true,
  outdir: 'public/assets',
  chunkNames: 'chunks/[name]-[hash]',
  jsx: 'automatic',
  jsxImportSource: 'remix/ui',
  target: 'es2022',
  minify: false,
  sourcemap: false,
  logLevel: 'info',
})
