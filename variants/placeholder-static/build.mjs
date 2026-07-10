// Throwaway build: assemble the static variant's dist from source + the
// shared design system. Copying @pm/tokens into the variant's own assets IS
// the paradigm's delivery model (ADR-0003 §2 — each paradigm delivers the
// shared CSS its native way; a static site ships copies).
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
// .../@pm/tokens/css/tokens.css → .../@pm/tokens (resolved through this
// package's own declared dependency — isolation-honest).
const tokensRoot = dirname(
  dirname(
    createRequire(join(root, "package.json")).resolve(
      "@pm/tokens/css/tokens.css",
    ),
  ),
);
const dist = join(root, "dist", "placeholder-static");

rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(join(dist, "sample"), { recursive: true });

cpSync(join(root, "pages", "sample.html"), join(dist, "sample", "index.html"));
cpSync(join(tokensRoot, "css"), join(dist, "assets", "pm", "css"), {
  recursive: true,
});
cpSync(join(tokensRoot, "fonts"), join(dist, "assets", "pm", "fonts"), {
  recursive: true,
});

console.log("placeholder-static: dist assembled");
