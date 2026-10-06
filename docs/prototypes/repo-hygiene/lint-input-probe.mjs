// Does editing <file> change turbo's `//#lint` hash? (repo hygiene, 2026-10-05)
// The mechanism behind one-liner 2: a file eslint lints but turbo does not
// hash replays a stale PASS when it changes. This appends one comment line to
// the file, reads the task hash before and after from turbo's own dry run,
// restores the file byte-for-byte, and exits 0 when the hash moved, 1 when it
// did not (the stale-PASS state). Used as a sabotage guard: with `.mts`
// missing from the task's inputs it must exit 1 against fit.d.mts.
//
//   node docs/prototypes/repo-hygiene/lint-input-probe.mjs workers/front/lab/fit.d.mts
//
// from the repo root (or REPO=<root>), on a tree with nothing else running.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.env.REPO ?? process.cwd();
const file = process.argv[2];
if (!file) throw new Error("usage: lint-input-probe.mjs <repo-relative file>");
const abs = join(repo, file);

const hash = () => {
  const run = spawnSync(join(repo, "node_modules/.bin/turbo"), ["run", "lint", "--dry=json"], { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) throw new Error(`turbo dry run exited ${run.status}: ${run.stderr}`);
  const task = JSON.parse(run.stdout).tasks.find((t) => t.taskId === "//#lint");
  if (!task) throw new Error("no //#lint task in the dry run");
  return { hash: task.hash, hashed: file in task.inputs };
};

const original = readFileSync(abs);
const before = hash();
try {
  writeFileSync(abs, Buffer.concat([original, Buffer.from("\n// lint-input-probe: one appended line\n")]));
  const after = hash();
  const moved = before.hash !== after.hash;
  console.log(JSON.stringify({ file, hashedAsInput: before.hashed, before: before.hash, after: after.hash, moved }));
  process.exitCode = moved ? 0 : 1;
} finally {
  writeFileSync(abs, original);
  if (!readFileSync(abs).equals(original)) throw new Error(`${file}: restore does not match the original bytes`);
}
