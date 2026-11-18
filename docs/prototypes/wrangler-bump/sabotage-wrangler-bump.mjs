// Sabotage runner, the wrangler bump (post-runbook unit 2, 2026-11-18).
// Copied from docs/prototypes/measurement-pass/sabotage-reprobe.mjs (2026-11-17)
// and re-rowed for a unit whose one code change is the lockfile: the
// frozen-lockfile install as the guard that holds it (a specifier moved
// without the lockfile; a resolution hash altered; the OLD lockfile written
// back, which the install admits and the suite passes on, the stated limit the
// brief asked to be shown), the private-details guard (a mirror host in a
// prototype lockfile; the same host in pnpm-lock.yaml, which the guard does not
// read; the registry pin in .npmrc, which nothing asserts; a consumer mailbox in
// this unit's record), then the node's cap and pointer legs, the glyph rule
// over this unit's records, the log ceiling and the masters' anchors. One
// deliberate defect per row; the owning guard must FAIL (non-zero exit);
// CONTROL rows must PASS. Backups fresh per row, restores verified by byte
// equality, guards under `bash -c`, exit codes printed, the summary line
// DERIVED from the verdicts; `caught=` counts only a plain CAUGHT. A row with an
// expected MISSED verdict says so in its defect text before it runs. A guard
// that never reaches a verdict scores RUNNER ERROR, never a catch; so does an
// edit that cannot be made, and the table goes on. A row that names an `expect`
// pattern scores CAUGHT only when the guard's output shows it (a non-zero exit
// for another reason is "CAUGHT, WRONG REASON", counted apart).
//
//   SCRATCH=<dir> node docs/prototypes/wrangler-bump/sabotage-wrangler-bump.mjs [rowId…]
//
// from the repo root, with NO plane running (the install rows touch
// node_modules), AFTER the new files are staged (`git add`): the em-dash and
// private-details guards walk `git ls-files`. Stated side effects: row F3
// leaves node_modules linked to wrangler 4.110.0 after its file restore, so it
// runs LAST and the table must be followed by `pnpm install --frozen-lockfile
// --offline` (printed as the final line); rows F1 and F2 abort before linking
// and leave node_modules as they found it (verified by the A0 re-run the
// record describes).
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const repo = process.env.REPO ?? process.cwd();
const only = process.argv.slice(2);
const backups = join(process.env.SCRATCH ?? "/tmp", "sabotage-wrangler-bump-backups");
mkdirSync(backups, { recursive: true });

const LOCK = "pnpm-lock.yaml";
const FRONT_PKG = "workers/front/package.json";
const PROTO_LOCK = "docs/prototypes/cf-composition/package-lock.json";
const NPMRC = ".npmrc";
const RECORD = "docs/prototypes/wrangler-bump/bump-2026-11-18.md";
const HANG = "docs/prototypes/wrangler-bump/hang-2026-11-18.md";
const MAP = "docs/decision-map.md";
const LOG = "docs/build-log.md";
const ENTRY = "The runtime that stopped answering, and the bump that made it say so (2026-11-18)";

const INSTALL = "pnpm install --frozen-lockfile --offline";
const PRIVATE = "pnpm --filter @pm/repo-checks exec vitest run test/no-private-details.test.ts";
const PRIVATE_LEG = (t) => `${PRIVATE} -t "${t}"`;
// The same guard by its own binary, so that a lockfile pnpm refuses to load does not
// score as the guard's catch (round 1's lesson, row R2).
const PRIVATE_DIRECT = "cd tools/repo-checks && ./node_modules/.bin/vitest run test/no-private-details.test.ts";
const NO_EM = "pnpm --filter @pm/repo-checks exec vitest run test/no-em-dashes.test.ts";
const CAP_TEST = "pnpm --filter @pm/repo-checks exec vitest run test/decision-map-node-cap.test.ts";
const CAP_LEG = (t) => `${CAP_TEST} -t "${t}"`;
const LINKS = "pnpm --filter @pm/repo-checks exec vitest run test/how-built-links-resolve.test.ts";
const LINKS_LEG = (t) => `${LINKS} -t "${t}"`;
const REF_TEST = "pnpm --filter @pm/reference exec vitest run";

const mustReplace = (s, from, to) => {
  if (!s.includes(from)) throw new Error(`anchor not found: ${from.slice(0, 80)}`);
  return s.replace(from, to);
};
const questionLineOf = (s, key) => {
  const i = s.indexOf(`\n### ${key}:`);
  if (i < 0) throw new Error(`no node ${key}`);
  const q = s.indexOf("\n**Question:**", i);
  const e = s.indexOf("\n", q + 1);
  return s.slice(q + 1, e);
};
// The old lockfile is the one origin/main carries, read from git so the row never
// embeds a 300 KB file: HEAD while the unit's commit is unmade, HEAD~1 after it
// (the first ref whose lockfile pins 4.110.0 wins; OLD_LOCK_REF overrides).
const oldLockfile = () => {
  const refs = process.env.OLD_LOCK_REF ? [process.env.OLD_LOCK_REF] : ["HEAD", "HEAD~1"];
  for (const ref of refs) {
    const s = execFileSync("git", ["show", `${ref}:${LOCK}`], { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (s.includes("wrangler@4.110.0")) return s;
  }
  throw new Error(`none of ${refs.join(", ")} pins wrangler 4.110.0 in ${LOCK}; set OLD_LOCK_REF`);
};
// Built from parts so this file never carries the shape the guard forbids.
const MAILBOX = ["someone", "@", "gma", "il", ".com"].join("");
const MIRROR = "https://mirror.internal.example/npm";

/** @type {{ id: string, defect: string, file?: string, files?: string[], fn?: (s: string, file: string) => string, guard: string, control?: boolean, expectMissed?: boolean, expect?: RegExp, ifCaught?: RegExp }[]} */
const ROWS = [
  // ── F: the lockfile, held by the frozen install ───────────────────────
  { id: "A0", control: true, defect: "CONTROL: `pnpm install --frozen-lockfile --offline` passes on the tree as committed (every package.json specifier agrees with the lockfile's importer entry; wrangler resolves to 4.164.0)", guard: INSTALL },
  { id: "F1", defect: "workers/front/package.json's wrangler specifier edited from ^4.110.0 to ^4.164.0 with the lockfile untouched (the eleven-file rewrite pnpm update made, restored in the unit, re-done for one file): the frozen install must refuse (ERR_PNPM_OUTDATED_LOCKFILE), which is what CI's three `pnpm install --frozen-lockfile` steps would hit", file: FRONT_PKG, fn: (s) => mustReplace(s, '"wrangler": "^4.110.0"', '"wrangler": "^4.164.0"'), guard: INSTALL, expect: /ERR_PNPM_OUTDATED_LOCKFILE/ },
  { id: "F2", defect: "the lockfile's wrangler@4.164.0 resolution integrity hash altered by one character (a tampered or mis-merged lockfile): the frozen offline install must refuse (no store entry under that hash: ERR_PNPM_NO_OFFLINE_TARBALL offline, an integrity failure online)", file: LOCK, fn: (s) => { const t = s.replace(/(^  wrangler@4\.164\.0:\n    resolution: \{integrity: sha512-)([A-Za-z0-9+/])/m, (_, p, c) => p + (c === "A" ? "B" : "A")); if (t === s) throw new Error("wrangler block not found"); return t; }, guard: INSTALL, expect: /ERR_PNPM_NO_OFFLINE_TARBALL|ERR_PNPM_TARBALL_INTEGRITY|integrity/ },
  // ── R: the private-details guard over the lockfiles and the records ────
  { id: "R0", control: true, defect: "CONTROL: the no-private-details guard passes over the staged tree (this unit's records included)", guard: PRIVATE },
  { id: "R1", defect: "one `resolved` entry in a prototype package-lock.json (cf-composition) rewritten from registry.npmjs.org to a mirror host: the lockfile leg must fail (the 2026-11-10 fault, re-planted)", file: PROTO_LOCK, fn: (s) => mustReplace(s, '"resolved": "https://registry.npmjs.org/', `"resolved": "${MIRROR}/`), guard: PRIVATE_LEG("every npm lockfile resolves"), expect: /× every npm lockfile resolves from the public registry/ },
  { id: "R2", defect: "the same mirror host planted into pnpm-lock.yaml as a `tarball:` resolution on the wrangler block: pnpm's OWN supply-chain policy check must refuse it (ERR_PNPM_TARBALL_URL_MISMATCH, \"Lockfile failed supply-chain policy check\"), at every pnpm invocation, so CI's frozen install would hit it; round 1 of this table had this row as a stated limit of the repo's guard and scored it CAUGHT only because that guard is invoked through `pnpm --filter`, which runs the policy check before vitest, so the catch was pnpm's and the row was re-aimed at the guard that holds it (R2b is the repo's guard, by its own binary)", file: LOCK, fn: (s) => mustReplace(s, "  wrangler@4.164.0:\n    resolution: {integrity: ", `  wrangler@4.164.0:\n    resolution: {tarball: ${MIRROR}/wrangler/-/wrangler-4.164.0.tgz, integrity: `), guard: INSTALL, expect: /ERR_PNPM_TARBALL_URL_MISMATCH/ },
  { id: "R2b", expectMissed: true, defect: "STATED LIMIT, expected MISSED: the same planted tarball host, with the repo's no-private-details guard run by its own vitest binary (not through pnpm): its lockfile rule names package-lock.json and npm-shrinkwrap.json only (`NPM_LOCKFILE` regex), so pnpm-lock.yaml is outside it; and a pnpm lockfile records registry packages by integrity alone (0 URLs in the file, `grep -c -E 'tarball:|resolved:'`), so an install through a mirror would leave no host in it to find; pnpm's policy check (R2) is what holds the workspace lockfile", file: LOCK, fn: (s) => mustReplace(s, "  wrangler@4.164.0:\n    resolution: {integrity: ", `  wrangler@4.164.0:\n    resolution: {tarball: ${MIRROR}/wrangler/-/wrangler-4.164.0.tgz, integrity: `), guard: PRIVATE_DIRECT, ifCaught: /× every npm lockfile resolves from the public registry/ },
  { id: "R3", expectMissed: true, defect: "STATED LIMIT, expected MISSED: the root .npmrc's `registry=` line pointed at the mirror host: no guard reads .npmrc, so the brief's \"keep it that way or the no-private-details guard bites\" is half right: the guard bites on a prototype lockfile minted through a mirror, not on the pin itself; the workspace's pin is held by review: `pnpm install --frozen-lockfile --offline` passes with .npmrc pointed at the mirror too (\"Already up to date\", tested by hand), and online the lockfile's integrity hashes would refuse a mirror serving different bytes and admit one serving the same", file: NPMRC, fn: (s) => mustReplace(s, "registry=https://registry.npmjs.org/", `registry=${MIRROR}/`), guard: PRIVATE_DIRECT, ifCaught: /× every npm lockfile resolves|× no tracked text file carries/ },
  { id: "R4", defect: "a consumer mailbox address planted into this unit's staged bump record (the address is built from parts in this runner): the mailbox leg must fail on it", file: RECORD, fn: (s) => mustReplace(s, "## The tree before anything", `## The tree before anything (write to ${MAILBOX})`), guard: PRIVATE_LEG("no tracked text file carries"), expect: /× no tracked text file carries a personal mailbox/ },
  // ── N: the node and its pointer ────────────────────────────────────────
  { id: "N0", control: true, defect: "CONTROL: the decision-map cap suite passes with the repo-hygiene node's dated 2026-11-18 clause and this unit's log title in its Status", guard: CAP_TEST },
  { id: "N1", defect: "the repo-hygiene node padded 2.5 KiB (from its size under the cap, about 6 KB, past the 7,168 B cap)", file: MAP, fn: (s) => { const q = questionLineOf(s, "repo-hygiene"); return mustReplace(s, q, q + " " + "x".repeat(2560)); }, guard: CAP_LEG("no RESOLVED node exceeds"), expect: /× no RESOLVED node exceeds/ },
  { id: "N2", defect: "the repo-hygiene Status quotes this unit's build-log title with one word changed (the pointer no longer names a heading)", file: MAP, fn: (s) => mustReplace(s, `"${ENTRY}"`, `"${ENTRY.replace("stopped answering", "stopped replying")}"`), guard: CAP_LEG("every Status line that cites"), expect: /× every Status line that cites build-log\.md/ },
  // ── E: the glyph rule over the new records (tracked by `git add` first) ─
  { id: "E0", control: true, defect: "CONTROL: the no-em-dashes guard passes over the staged tree (this unit's records included)", guard: NO_EM },
  { id: "E1", defect: "an em dash planted into the staged hang record (built from its code point, so this runner never carries it): the guard must fail", file: HANG, fn: (s) => mustReplace(s, "## What a hung run looks like", "## What a hung run looks like " + String.fromCharCode(0x2014) + " sabotaged"), guard: NO_EM, expect: /× every tracked text file outside the stated exemptions is free of the glyph/ },
  // ── C: the ceiling ─────────────────────────────────────────────────────
  { id: "C0", control: true, defect: "CONTROL: the build log is under the 917,504 B ceiling with this unit's entry in it", guard: LINKS_LEG("stays inside the size") },
  { id: "C1", defect: "128 KiB appended to the build log (past the ceiling): the ceiling leg must fail and ask for a re-observation", file: LOG, fn: (s) => s + "\n" + "y".repeat(131072) + "\n", guard: LINKS_LEG("stays inside the size"), expect: /× the build log stays inside the size/ },
  // ── L/H: the anchors the how-it-was-built masters pin ──────────────────
  { id: "L0", control: true, defect: "CONTROL: the how-built line anchors resolve on the regenerated master", guard: LINKS_LEG("every line anchor") },
  { id: "L1", defect: "one line inserted above `## Phase 15` in the log WITHOUT regenerating the master (the line anchors shift)", file: LOG, fn: (s) => mustReplace(s, "\n## Phase 15: ", "\nA line that shifts every anchor below it.\n\n## Phase 15: "), guard: LINKS_LEG("every line anchor"), expect: /× D4: every line anchor names the line/ },
  { id: "H0", control: true, defect: "CONTROL: @pm/reference's master regeneration test passes (the how-it-was-built index is pinned)", guard: REF_TEST },
  { id: "H1", defect: "the how-it-was-built master's phase-15 line anchor edited by hand (index and master disagree)", file: "packages/reference/surfaces/how-it-was-built/index.html", fn: (s) => { const t = s.replace(/(docs\/build-log\.md\?plain=1#L)(\d+)/, (_, p, n) => `${p}${Number(n) + 1}`); if (t === s) throw new Error("no line anchor"); return t; }, guard: REF_TEST, expect: /× renderAll\(fixture\) reproduces the committed masters byte-for-byte/ },
  // ── F3 last: the OLD version pinned back, the stated limit of a green run ─
  { id: "F3", expectMissed: true, defect: "STATED LIMIT, expected MISSED: origin/main's whole pnpm-lock.yaml written back (wrangler@4.110.0, workerd 1.20260708.1, miniflare 4.20260708.1, read from git): the frozen offline install admits it (exit 0, the store still holds the old tree), and the origin suite passes on it too (suite-runs-2026-11-18.md, the run on the old lockfile): neither the install nor a green suite can tell the versions apart, so a green run on 4.164.0 proves the suite still holds on it and nothing about the crash or the hang; the hang record is what speaks to those", file: LOCK, fn: () => oldLockfile(), guard: INSTALL, ifCaught: /ERR_PNPM_OUTDATED_LOCKFILE|supply-chain policy|ERR_PNPM_LOCKFILE/ },
];

const bytesOf = (p) => (existsSync(p) ? readFileSync(p) : null);
const results = [];
for (const row of ROWS) {
  if (only.length && !only.includes(row.id)) continue;
  const targets = row.files ?? [row.file].filter(Boolean);
  const saved = new Map();
  for (const t of targets) {
    const abs = join(repo, t);
    const b = join(backups, `${row.id}-${t.replaceAll("/", "__")}`);
    copyFileSync(abs, b);
    saved.set(t, b);
  }
  try {
    let edited = true;
    try {
      for (const t of targets) {
        const abs = join(repo, t);
        const before = readFileSync(abs, "utf8");
        const after = row.fn(before, t);
        if (after === before) throw new Error(`the edit changed nothing (anchor not found)`);
        writeFileSync(abs, after);
      }
    } catch (e) {
      // An edit that cannot be made is a runner fault, scored as one and the
      // table goes on (verify-slice, correctness lens: an uncaught throw here
      // used to lose every later row and the summary line).
      edited = false;
      results.push({ id: row.id, exit: -1, verdict: `RUNNER ERROR (edit failed: ${String(e.message).slice(0, 120)})`, defect: row.defect });
      console.log(`${row.id}\texit=-1\tRUNNER ERROR (edit failed: ${String(e.message).slice(0, 120)})\t${row.defect}`);
    }
    if (edited) {
      const run = spawnSync("bash", ["-c", row.guard], { cwd: repo, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 });
      const exit = run.status ?? -1;
      const runnerError = run.error || run.status === null;
      const out = (run.stdout ?? "") + (run.stderr ?? "");
      // A non-zero exit for a reason other than the planted defect is not the
      // guard's catch (round 1's R2 lesson): rows that name an `expect` pattern
      // must show it in the guard's output to score CAUGHT.
      const wrongReason = !runnerError && exit !== 0 && row.expect && !row.expect.test(out);
      // The mirror image for a stated limit (verify-slice, skeptic lens): an
      // expected-miss row whose guard exits non-zero is "the stated limit was
      // wrong" only when the output shows the guard itself refusing (`ifCaught`);
      // any other failure (a missing binary, a pruned store under --offline) is a
      // runner fault, so a limit cannot flip for a reason unrelated to the defect.
      const limitWrongForOtherReason = !runnerError && exit !== 0 && row.expectMissed && row.ifCaught && !row.ifCaught.test(out);
      const verdict = runnerError ? "RUNNER ERROR (guard did not reach a verdict)" : row.control ? (exit === 0 ? "control, PASSED as designed" : "CONTROL BROKE") : exit === 0 ? (row.expectMissed ? "MISSED, as stated in advance" : "MISSED") : wrongReason ? `CAUGHT, WRONG REASON (output lacks ${row.expect})` : limitWrongForOtherReason ? `RUNNER ERROR (non-zero exit, output lacks ${row.ifCaught})` : row.expectMissed ? "CAUGHT (expected MISSED, the stated limit was wrong)" : "CAUGHT";
      results.push({ id: row.id, exit, verdict, defect: row.defect });
      console.log(`${row.id}\texit=${exit}\t${verdict}\t${row.defect}`);
      if (exit !== 0) {
        const tail = out.split("\n").filter((l) => /FAIL|AssertionError|✗|×|Error:|ERR_PNPM|expected|past the|resolve from a host/.test(l)).slice(0, 3).join(" | ");
        console.log(`\t↳ ${tail.slice(0, 300)}`);
      }
    }
  } finally {
    for (const [t, b] of saved) {
      const abs = join(repo, t);
      copyFileSync(b, abs);
      if (!bytesOf(abs).equals(bytesOf(b))) throw new Error(`${row.id}: restore of ${t} does not match its backup`);
    }
  }
}
console.log("\n| row | defect | result | exit |\n|---|---|---|---|");
for (const r of results) console.log(`| ${r.id} | ${r.defect} | ${r.verdict} | ${r.exit} |`);
const count = (re) => results.filter((r) => re.test(r.verdict)).length;
console.log(
  `\nsummary: rows=${results.length} caught=${count(/^CAUGHT$/)} controls=${count(/^control, PASSED/)} ` +
    `missed=${count(/^MISSED$/)} expected-missed=${count(/^MISSED, as stated/)} control-broke=${count(/CONTROL BROKE/)} ` +
    `caught-expected-missed=${count(/expected MISSED, the stated limit/)} caught-wrong-reason=${count(/^CAUGHT, WRONG REASON/)} runner-error=${count(/^RUNNER ERROR/)}`,
);
if (results.some((r) => r.id === "F3")) console.log("\nF3 ran: node_modules is linked to the OLD lockfile's tree; run `pnpm install --frozen-lockfile --offline` now.");
