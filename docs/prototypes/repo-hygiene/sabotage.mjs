// Sabotage runner, repo hygiene (unit 10), 2026-10-05.
// Copied from docs/prototypes/decision-map-compaction/sabotage.mjs (unit 9)
// and re-rowed. One deliberate defect per row; the owning guard must FAIL
// (non-zero exit); CONTROL rows must PASS. Backups are taken FRESH per row
// and restores are verified by byte equality (unit 7's stale-backup lesson).
// Guards run under `bash -c` (unit 7: `bash -lc` handed node to a
// version-manager shim and every row read CAUGHT with exit 126 while nothing
// ran). Exit codes are printed for every row; verdicts are derived from
// them, never by eye. Rows with an expected MISSED verdict say so in their
// defect text BEFORE they run (a stated limit, not a surprise).
//
//   SCRATCH=<dir> node docs/prototypes/repo-hygiene/sabotage.mjs [rowId…]
//
// from the repo root, on a tree with nothing else running.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.env.REPO ?? process.cwd();
const only = process.argv.slice(2);
const backups = join(process.env.SCRATCH ?? "/tmp", "sabotage-backups");
mkdirSync(backups, { recursive: true });

const ESLINT = "eslint.config.mjs";
const TURBO = "turbo.json";
const CI = ".github/workflows/ci.yml";
const RN = "variants/react-next/package.json";
const QWIK = "variants/qwik/package.json";
const HTMX = "variants/htmx/package.json";
const FRONT = "workers/front/package.json";
const QWIK_WRANGLER = "variants/qwik/wrangler.jsonc";
const MAP = "docs/decision-map.md";
const LOG = "docs/build-log.md";

const HYG_TEST = "pnpm --filter @pm/repo-checks exec vitest run test/repo-hygiene.test.ts";
const HYG_LEG = (t) => `${HYG_TEST} -t "${t}"`;
// The mechanism probe behind one-liner 2: exit 0 when an edit to the file moves `//#lint`'s hash, 1 when it does not.
const PROBE = "node docs/prototypes/repo-hygiene/lint-input-probe.mjs workers/front/lab/fit.d.mts";
const CAP_TEST = "pnpm --filter @pm/repo-checks exec vitest run test/decision-map-node-cap.test.ts";
const CAP_LEG = (t) => `${CAP_TEST} -t "${t}"`;
const LINKS_LINE_LEG = 'pnpm --filter @pm/repo-checks exec vitest run test/how-built-links-resolve.test.ts -t "every line anchor"';
const REF_TEST = "pnpm --filter @pm/reference exec vitest run";

const mustReplace = (s, from, to) => {
  if (!s.includes(from)) throw new Error(`anchor not found: ${from.slice(0, 80)}`);
  return s.replace(from, to);
};
const setScript = (s, name, value) => {
  const pkg = JSON.parse(s);
  pkg.scripts[name] = value;
  return JSON.stringify(pkg, null, 2) + "\n";
};
const questionLineOf = (s, key) => {
  const i = s.indexOf(`\n### ${key}:`);
  if (i < 0) throw new Error(`no node ${key}`);
  const q = s.indexOf("\n**Question:**", i);
  const e = s.indexOf("\n", q + 1);
  return s.slice(q + 1, e);
};

/** @type {{ id: string, defect: string, file?: string, fn?: (s: string) => string, guard: string, control?: boolean, expectMissed?: boolean }[]} */
const ROWS = [
  // ── A: the whole new guard file on the fixed tree ────────────────────
  { id: "A0", control: true, defect: "CONTROL: no defect, the repo-hygiene guard passes on the fixed tree", guard: HYG_TEST },
  // ── E: one-liner 1, eslint ignores .claude/worktrees/** ──────────────
  { id: "E1", defect: "the `.claude/worktrees/**` ignore deleted from eslint.config.mjs (the pre-unit state: a worktree file is linted)", file: ESLINT, fn: (s) => mustReplace(s, '      ".claude/worktrees/**",\n', ""), guard: HYG_LEG("linted AS a worktree path") },
  { id: "E2", defect: "the ignore misspelt (`.claude/worktree/**`, singular): a pattern that matches nothing", file: ESLINT, fn: (s) => mustReplace(s, '".claude/worktrees/**"', '".claude/worktree/**"'), guard: HYG_LEG("linted AS a worktree path") },
  { id: "E3", defect: "the ignore kept but scoped to one worktree (`.claude/worktrees/pdp-build/**`): every other worktree is linted again", file: ESLINT, fn: (s) => mustReplace(s, '".claude/worktrees/**"', '".claude/worktrees/pdp-build/**"'), guard: HYG_LEG("linted AS a worktree path") },
  // ── T: one-liner 2, //#lint inputs cover .mts/.cts ───────────────────
  { id: "T1", defect: "`,mts,cts` removed from every //#lint input glob (the pre-unit inputs): the two .d.mts files are linted and unhashed", file: TURBO, fn: (s) => s.split(",mts,cts}").join("}"), guard: HYG_LEG("every linted file is a hashed input") },
  { id: "T2", defect: "the same defect, judged by the MECHANISM: an edit to workers/front/lab/fit.d.mts must move //#lint's hash and does not (the stale PASS itself)", file: TURBO, fn: (s) => s.split(",mts,cts}").join("}"), guard: PROBE },
  { id: "T2c", control: true, defect: "CONTROL: on the fixed tree the same edit to fit.d.mts moves //#lint's hash, the probe must PASS", guard: PROBE },
  { id: "T3", defect: "the whole `workers/**` input line deleted: every linted Worker file is unhashed", file: TURBO, fn: (s) => mustReplace(s, '        "workers/**/*.{ts,tsx,js,mjs,cjs,mts,cts}",\n', ""), guard: HYG_LEG("every linted file is a hashed input") },
  // ── D: one-liner 3, variant deploy scripts build nothing ─────────────
  { id: "D1", defect: "react-next's deploy reverted to its pre-unit rebuild (`copy-tokens && opennextjs-cloudflare build && opennextjs-cloudflare deploy`)", file: RN, fn: (s) => setScript(s, "deploy", "node scripts/copy-tokens.mjs && opennextjs-cloudflare build && opennextjs-cloudflare deploy"), guard: HYG_LEG("one deploy command") },
  { id: "D2", defect: "qwik's deploy reverted to its pre-unit rebuild (`prepare-build && build.client && build.server && wrangler deploy`)", file: QWIK, fn: (s) => setScript(s, "deploy", "node scripts/prepare-build.mjs && pnpm run build.client && pnpm run build.server && wrangler deploy"), guard: HYG_LEG("one deploy command") },
  { id: "D3", defect: "a third variant (htmx) given a rebuild in deploy (`node build.mjs && wrangler deploy`)", file: HTMX, fn: (s) => setScript(s, "deploy", "node build.mjs && wrangler deploy"), guard: HYG_LEG("one deploy command") },
  { id: "D4", defect: "the front Worker's exempt deploy changed to bare `wrangler deploy` (the exemption goes dead and must be dropped)", file: FRONT, fn: (s) => setScript(s, "deploy", "wrangler deploy"), guard: HYG_LEG("every exemption is live") },
  { id: "D5", defect: "a deploy flag smuggled onto one command (`wrangler deploy --dry-run`): one command, but not a deploy", file: QWIK, fn: (s) => setScript(s, "deploy", "wrangler deploy --dry-run"), guard: HYG_LEG("one deploy command") },
  // ── P: one-liner 4, actions pinned by SHA on a pinned runner ─────────
  { id: "P1", defect: "one `actions/checkout` pin reverted to the mutable `@v4` tag", file: CI, fn: (s) => mustReplace(s, "actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0", "actions/checkout@v4"), guard: HYG_LEG("full commit SHA") },
  { id: "P2", defect: "one `runs-on: ubuntu-24.04` reverted to `ubuntu-latest`", file: CI, fn: (s) => mustReplace(s, "runs-on: ubuntu-24.04", "runs-on: ubuntu-latest"), guard: HYG_LEG("dated image label") },
  { id: "P3", defect: "one SHA truncated to 39 hex characters (a pin that cannot resolve)", file: CI, fn: (s) => mustReplace(s, "actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830 # v4.3.0", "actions/cache@0057852bfaa89a56745cba8c7296529d2fc3983 # v4.3.0"), guard: HYG_LEG("full commit SHA") },
  { id: "P4", defect: "one pin loses its release comment (a SHA nobody can renew by hand)", file: CI, fn: (s) => mustReplace(s, "pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4.3.0", "pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1"), guard: HYG_LEG("full commit SHA") },
  { id: "P5", defect: "one pin moved to a branch ref (`@main`) with the release comment kept", file: CI, fn: (s) => mustReplace(s, "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0", "actions/setup-node@main # v4.4.0"), guard: HYG_LEG("full commit SHA") },
  { id: "P6", defect: "the release comment names the moving major (`# v4`) instead of a release", file: CI, fn: (s) => mustReplace(s, "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2", "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4"), guard: HYG_LEG("full commit SHA") },
  // ── Round 2 (verify-slice folds): the routes the first legs could not see ──
  { id: "E4", defect: "the scoped `workers/front/generated/**` ignore deleted: eslint lints the front's generated module again while turbo does not hash it (needs a built tree)", file: ESLINT, fn: (s) => mustReplace(s, '      "workers/front/generated/**",\n', ""), guard: HYG_LEG("every linted file is a hashed input") },
  { id: "T4", defect: "the `!**/dist/**` negation deleted from the lint inputs: on a built tree turbo hashes every dist/ eslint ignores (the over-hashing verify-slice found)", file: TURBO, fn: (s) => mustReplace(s, '        "!**/dist/**",\n', ""), guard: HYG_LEG("every hashed input is a linted file") },
  { id: "T5", control: true, defect: "CONTROL: on the fixed, BUILT tree the hashed set equals the linted set apart from turbo's own two files", guard: HYG_LEG("every hashed input is a linted file") },
  { id: "D6", defect: "qwik gains a `predeploy` lifecycle script that builds (`pnpm run build`); its deploy line stays one command", file: QWIK, fn: (s) => setScript(s, "predeploy", "pnpm run build"), guard: HYG_LEG("another route") },
  { id: "D7", defect: "qwik's wrangler.jsonc gains a `build.command` (wrangler runs it on deploy); the deploy script stays one command", file: QWIK_WRANGLER, fn: (s) => mustReplace(s, '  "main": "./dist/_worker.js",', '  "main": "./dist/_worker.js",\n  "build": { "command": "pnpm run build" },'), guard: HYG_LEG("another route") },
  { id: "P7", defect: "a `-latest` runner hidden behind a trailing comment (`runs-on: ubuntu-latest # re-pin later`): the first extractor dropped the line", file: CI, fn: (s) => mustReplace(s, "runs-on: ubuntu-24.04", "runs-on: ubuntu-latest # re-pin later"), guard: HYG_LEG("dated image label") },
  { id: "P8", defect: "a runs-on in block form (`runs-on:` then `labels: ubuntu-24.04`): a form the leg cannot read must be reported, not skipped", file: CI, fn: (s) => mustReplace(s, "runs-on: ubuntu-24.04", "runs-on:\n      labels: ubuntu-24.04"), guard: HYG_LEG("dated image label") },
  { id: "P9", control: true, defect: "CONTROL: a local action step (`uses: ./.github/actions/setup`) added to the check job is pinned by the checkout and must PASS the uses leg", file: CI, fn: (s) => mustReplace(s, "      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0\n\n      - uses: pnpm/action-setup", "      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0\n\n      - uses: ./.github/actions/setup\n\n      - uses: pnpm/action-setup"), guard: HYG_LEG("full commit SHA") },
  // ── N: the records this unit adds to the map (round 2, after the records were written) ──
  { id: "N0", control: true, defect: "CONTROL: the decision-map leg passes with this unit's node and the domain-cutover lines in place", guard: CAP_TEST },
  { id: "N1", defect: "this unit's RESOLVED node padded 1 KiB past the cap (narrative belongs in the log)", file: MAP, fn: (s) => { const q = questionLineOf(s, "repo-hygiene"); return s.replace(q, q + "\n\n" + "narrative ".repeat(Math.ceil((7168 + 1024) / 10))); }, guard: CAP_LEG("no RESOLVED node exceeds") },
  { id: "N2", defect: "this unit's Status quotes a build-log title that is not a heading (one word changed)", file: MAP, fn: (s) => mustReplace(s, '"The sweep that measured its own waste', '"The sweep that measured its waste'), guard: CAP_LEG("quotes only titles that are headings") },
  // ── L: the existing guards this unit's log edit leans on ─────────────
  { id: "L0", control: true, defect: "CONTROL: the how-built line anchors resolve on the regenerated master", guard: LINKS_LINE_LEG },
  { id: "L1", defect: "one line inserted above `## Phase 15` in the log WITHOUT regenerating the master (the line anchors shift)", file: LOG, fn: (s) => mustReplace(s, "\n## Phase 15: ", "\nA line that moves every later heading.\n\n## Phase 15: "), guard: LINKS_LINE_LEG },
  { id: "R0", control: true, defect: "CONTROL: @pm/reference's master regeneration test passes (the how-it-was-built index is pinned)", guard: REF_TEST },
  { id: "R1", defect: "the how-it-was-built master's phase-15 line anchor edited by hand (index and master disagree)", file: "packages/reference/surfaces/how-it-was-built/index.html", fn: (s) => s.replace(/build-log\.md\?plain=1#L(\d+)" rel="noopener">Phase 15/, (m, n) => m.replace(`#L${n}`, `#L${Number(n) + 1}`)), guard: REF_TEST },
];

const bytesOf = (p) => (existsSync(p) ? readFileSync(p) : null);
const results = [];
for (const row of ROWS) {
  if (only.length && !only.includes(row.id)) continue;
  const targets = [row.file].filter(Boolean);
  const saved = new Map();
  for (const t of targets) {
    const abs = join(repo, t);
    const b = join(backups, `${row.id}-${t.replaceAll("/", "__")}`);
    copyFileSync(abs, b);
    saved.set(t, b);
  }
  try {
    if (row.file) {
      const abs = join(repo, row.file);
      const before = readFileSync(abs, "utf8");
      const after = row.fn(before);
      if (after === before) throw new Error(`${row.id}: the edit changed nothing (anchor not found)`);
      writeFileSync(abs, after);
    }
    const run = spawnSync("bash", ["-c", row.guard], { cwd: repo, encoding: "utf8", env: process.env });
    const exit = run.status ?? -1;
    const verdict = row.control ? (exit === 0 ? "control, PASSED as designed" : "CONTROL BROKE") : exit === 0 ? (row.expectMissed ? "MISSED, as stated in advance" : "MISSED") : row.expectMissed ? "CAUGHT (expected MISSED, the stated limit was wrong)" : "CAUGHT";
    results.push({ id: row.id, exit, verdict, defect: row.defect });
    console.log(`${row.id}\texit=${exit}\t${verdict}\t${row.defect}`);
    if (exit !== 0) {
      const tail = (run.stdout + run.stderr).split("\n").filter((l) => /FAIL|AssertionError|✗|×|Error:|expected|moved/.test(l)).slice(0, 3).join(" | ");
      console.log(`\t↳ ${tail.slice(0, 300)}`);
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
