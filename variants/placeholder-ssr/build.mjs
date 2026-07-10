// Throwaway build: copy the shared design system into this variant's assets.
// Same delivery model note as placeholder-static's build.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const tokensRoot = dirname(
  dirname(
    createRequire(join(root, "package.json")).resolve(
      "@pm/tokens/css/tokens.css",
    ),
  ),
);
const dist = join(root, "dist", "placeholder-ssr");

rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

cpSync(join(tokensRoot, "css"), join(dist, "assets", "pm", "css"), {
  recursive: true,
});
cpSync(join(tokensRoot, "fonts"), join(dist, "assets", "pm", "fonts"), {
  recursive: true,
});

console.log("placeholder-ssr: dist assembled");
