// The build attestation the plane serves at /_pm/build.json (ADR-0001
// addendum N hole 2): the bench runner and the chrome-constant probe fetch
// it, record it beside the local commit pin, and REFUSE to measure a plane
// whose attested SHA disagrees with the checkout driving the browser.
//
// Stamped in three places, deliberately: at the end of build.mjs (a bare
// build produces a complete dist), by the `deploy` script immediately
// before wrangler (turbo replays a cached dist when the package's inputs
// are unchanged, and a replayed dist carries the SHA of the commit that
// BUILT it — the re-stamp makes the attestation describe the tree actually
// deploying), and by run-local.mjs after its turbo build (same replay, same
// reason, for the local plane). The runner's verification then makes any
// path this misses a loud refusal rather than a silent lie.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export function stampBuild() {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const out = join(root, "dist", "_pm", "build.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify(
      {
        kind: "pm-build",
        sha: git("rev-parse", "HEAD"),
        // An honest attestation admits an unclean tree, exactly like the
        // receipt's commit pin (ADR-0001 §9).
        dirty: git("status", "--porcelain").length > 0,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("front: stamped dist/_pm/build.json");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  stampBuild();
}
