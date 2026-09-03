// The build attestation the plane serves at /_pm/build.json (ADR-0001
// addendum N hole 2): the bench runner and the chrome-constant probe fetch
// it, record it beside the local commit pin, and REFUSE to measure a plane
// whose attested SHA disagrees with the checkout driving the browser. Since
// the how-it-was-built build (2026-09-02) the same stamp also writes
// dist/how-it-was-built/index.html, whose deep links pin that SHA — see the
// note inside stampBuild.
//
// Stamped everywhere dist can go stale against HEAD, deliberately: at the
// end of build.mjs (a bare build produces a complete dist); by run-local
// after its turbo build and by the `dev` script before wrangler dev (turbo
// replays a cached dist when the package's inputs are unchanged, and a
// replayed dist carries the SHA of the commit that BUILT it). The `deploy`
// script does NOT merely re-stamp — it re-runs the full build first: a
// bare stamp would write the current HEAD onto whatever stale dist was
// lying around, a false attestation worse than none (verify-slice, this
// unit; front's build is not snapshot-parameterized, so a rebuild inside
// deploy is safe where the variants' would not be). The runner's
// verification then makes any path this misses a loud refusal rather than
// a silent lie.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { howBuiltPage } from "./how-built-page.mjs";

const root = dirname(fileURLToPath(import.meta.url));

export function stampBuild() {
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const build = {
    kind: "pm-build",
    sha: git("rev-parse", "HEAD"),
    // An honest attestation admits an unclean tree, exactly like the
    // receipt's commit pin (ADR-0001 §9).
    dirty: git("status", "--porcelain").length > 0,
  };
  // The how-it-was-built page is an attestation artifact too (ADR-0008 §8;
  // docs/prds/how-it-was-built-build.md Decision 1): every deep link on it
  // pins the sha this file attests, or falls back to `main` when the tree is
  // dirty. It is written HERE, from the same {sha, dirty}, rather than in
  // build.mjs's main body, for the reason this whole file exists — a turbo
  // cache replay restores a dist whose page names the commit that BUILT it,
  // and the re-stamp must move the page with the attestation or the two
  // disagree on every replay. Same renderer as the committed master
  // (how-built-page.mjs → @pm/reference); the origin suite holds the served
  // body byte-identical to a fresh render at this attestation.
  //
  // RENDER FIRST, write second. The render can throw (a malformed
  // attestation, a moved docs directory, a missing token); if build.json were
  // already on disk by then, a failed stamp would leave a fresh attestation
  // beside a stale or absent page — the one disagreement this arrangement
  // exists to make impossible (design review, 2026-09-02).
  const html = howBuiltPage({ sha: build.sha, dirty: build.dirty });

  const out = join(root, "dist", "_pm", "build.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(build, null, 2) + "\n");
  const page = join(root, "dist", "how-it-was-built", "index.html");
  mkdirSync(dirname(page), { recursive: true });
  writeFileSync(page, html);
  console.log(
    `front: stamped dist/_pm/build.json and dist/how-it-was-built/index.html (${build.sha.slice(0, 7)}${build.dirty ? ", dirty" : ""})`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  stampBuild();
}
