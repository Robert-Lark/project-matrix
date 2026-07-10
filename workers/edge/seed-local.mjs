// Seed the frozen fixture snapshot into R2 (issue #4). Default: wrangler's
// LOCAL R2 emulation (state under this workspace's .wrangler/, shared with
// `wrangler dev`). `--remote` seeds the real pm-snapshot bucket (used by the
// CI deploy job; needs CLOUDFLARE_API_TOKEN/ACCOUNT_ID).
//
// Object layout mirrors the URL space: the contract's image paths ARE the R2
// keys (assets/img/...), and the tray files live under snapshot/.
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const remote = process.argv.includes("--remote");
const snapDir = join(
  dirname(
    createRequire(join(root, "package.json")).resolve(
      "@pm/snapshot-fixture/package.json",
    ),
  ),
  "snapshot",
);

const objects = [
  ["snapshot/manifest.json", join(snapDir, "manifest.json"), "application/json"],
  ["snapshot/summaries.json", join(snapDir, "summaries.json"), "application/json"],
  ["snapshot/details.json", join(snapDir, "details.json"), "application/json"],
  ...readdirSync(join(snapDir, "img")).map((f) => [
    `assets/img/${f}`,
    join(snapDir, "img", f),
    "image/avif",
  ]),
];

console.log(`seeding ${objects.length} snapshot objects into ${remote ? "REMOTE" : "local"} R2`);
for (const [key, file, contentType] of objects) {
  execFileSync(
    "pnpm",
    ["exec", "wrangler", "r2", "object", "put", `pm-snapshot/${key}`,
      "--file", file, "--content-type", contentType,
      remote ? "--remote" : "--local"],
    { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
  );
}
console.log("snapshot seeded");
