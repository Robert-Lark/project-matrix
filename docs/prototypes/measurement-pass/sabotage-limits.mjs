// Sabotage runner, the constant's two stated limits (post-runbook unit 1,
// 2026-11-01). Copied from sabotage-constant.mjs beside it (PR-3) and
// re-rowed. One deliberate defect per row; the owning guard must FAIL
// (non-zero exit); CONTROL rows must PASS. Backups fresh per row, restores
// verified by byte equality, guards under `bash -c`, exit codes printed, the
// summary line DERIVED from the verdicts. A row with an expected MISSED
// verdict says so in its defect text before it runs (a stated limit, not a
// surprise). A guard that never reaches a verdict scores RUNNER ERROR, never
// a catch (PR-3's lesson).
//
//   SCRATCH=<dir> node docs/prototypes/measurement-pass/sabotage-limits.mjs [rowId…]
//
// from the repo root, on a tree with nothing else running, AFTER the new
// files are staged (`git add`): the em-dash guard walks `git ls-files`, so
// an untracked record file is invisible to it (row E1 depends on it). Stated
// side effect, as before: a caught front-build row (P1 to P6) leaves
// workers/front/dist as the refused build's partial output, so run
// `pnpm --filter @pm/front run build` after the table.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.env.REPO ?? process.cwd();
const only = process.argv.slice(2);
const backups = join(process.env.SCRATCH ?? "/tmp", "sabotage-limits-backups");
mkdirSync(backups, { recursive: true });

const PUBLISH = "workers/front/lab/publish.mjs";
const GEN = "workers/front/test/fixtures/publish/generate.mjs";
const VALID_CC = "workers/front/test/fixtures/publish/chrome-constants/valid.json";
const PROBE = "tools/bench-runner/src/chrome-constant.ts";
const CONSTANT = "workers/front/lab/chrome-constant.json";
const RECORD = "docs/prototypes/measurement-pass/limits-2026-11-01.md";
const MAP = "docs/decision-map.md";
const LOG = "docs/build-log.md";
const ENTRY = "The gate the runs had been waiting for, and the visit the artifact never sees (2026-11-01)";

const REFUSALS = "pnpm --filter @pm/front exec vitest run test/publish-refusals.test.js";
const REFUSALS_LEG = (t) => `${REFUSALS} -t "${t}"`;
const FRONT_BUILD = "pnpm --filter @pm/front run build";
const RUNNER_TESTS = "pnpm --filter @pm/bench-runner exec vitest run";
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
const editJson = (s, f) => { const o = JSON.parse(s); f(o); return JSON.stringify(o, null, 2) + "\n"; };
const questionLineOf = (s, key) => {
  const i = s.indexOf(`\n### ${key}:`);
  if (i < 0) throw new Error(`no node ${key}`);
  const q = s.indexOf("\n**Question:**", i);
  const e = s.indexOf("\n", q + 1);
  return s.slice(q + 1, e);
};
// The reconciliation block as this unit leaves it, anchored by its first
// comment line and the line that closes its last refusal.
const RECON_HEAD = "  // The published delta must be the artifact's own runs' word. Until\n";
const RECON_TAIL = "a figure the runs do not support is not publishable`,\n        );\n      }\n    }\n  }\n";
const deleteReconciliation = (s) => {
  const a = s.indexOf(RECON_HEAD); const b = s.indexOf(RECON_TAIL, a);
  if (a < 0 || b < 0) throw new Error("reconciliation anchors not found");
  return s.slice(0, a) + s.slice(b + RECON_TAIL.length);
};
// The warm-up visit as this unit adds it, anchored the same way.
const WARMUP_HEAD = "    // One DISCARDED warm-up visit, without chrome, before any recorded run.\n";
const WARMUP_TAIL = "the delta would mix two fragments`,\n        );\n      }\n    }\n";
const deleteWarmup = (s) => {
  const a = s.indexOf(WARMUP_HEAD); const b = s.indexOf(WARMUP_TAIL, a);
  if (a < 0 || b < 0) throw new Error("warm-up anchors not found");
  return s.slice(0, a) + s.slice(b + WARMUP_TAIL.length);
};

/** @type {{ id: string, defect: string, file?: string, files?: string[], fn?: (s: string, file: string) => string, guard: string, control?: boolean, expectMissed?: boolean }[]} */
const ROWS = [
  { id: "A0", control: true, defect: "CONTROL: no defect, the publication-gate refusals test passes with the six reconciliation rows in it (68 rows, 52 throw sites)", guard: REFUSALS },
  // ── P: the real artifact through the real front build ───────────────
  { id: "B0", control: true, defect: "CONTROL: the front build admits the committed deployed-plane constant (its delta IS the delta of medians of its runs: 700 with, 628 without, 72)", guard: FRONT_BUILD },
  { id: "P1", defect: "PR-3's row P6, the stated limit this unit closes: deltaMedians.FCP hand-edited from 72 to 20 with the conditions runs untouched: the front build must refuse by delta mismatch", file: CONSTANT, fn: (s) => editJson(s, (c) => { c.deltaMedians.FCP = 20; }), guard: FRONT_BUILD },
  { id: "P2", defect: "the committed constant's with-chrome run 0 FCP edited from 1064 to 400 with the delta untouched (the median moves 700 to 696, the delta to 68): the front build must refuse by delta mismatch", file: CONSTANT, fn: (s) => editJson(s, (c) => { c.conditions.with.runs[0].FCP = 400; }), guard: FRONT_BUILD },
  { id: "P3", defect: "the committed constant's with-chrome run list shortened to six runs (the last popped) with runsPerCondition still 7: the front build must refuse by runs count", file: CONSTANT, fn: (s) => editJson(s, (c) => { c.conditions.with.runs.pop(); }), guard: FRONT_BUILD },
  { id: "P4", defect: "the committed constant's runsPerCondition edited from 7 to 9 with both run lists untouched: the front build must refuse by runs count", file: CONSTANT, fn: (s) => editJson(s, (c) => { c.runsPerCondition = 9; }), guard: FRONT_BUILD },
  { id: "P5", defect: "the committed constant's `conditions` deleted entirely (the pre-fixture shape, no runs to reconcile against): the front build must refuse by runs count, never admit on absence", file: CONSTANT, fn: (s) => editJson(s, (c) => { delete c.conditions; }), guard: FRONT_BUILD },
  { id: "P6", expectMissed: true, defect: "STATED LIMIT, expected MISSED: the committed constant's with-chrome run 0 FCP edited from 1064 to 900 (still the largest sample, so both medians and the delta are unchanged): the gate reconciles medians, not every run, and admits; a per-run edit that leaves both medians intact is invisible to it, as it is to any reader of the delta", file: CONSTANT, fn: (s) => editJson(s, (c) => { c.conditions.with.runs[0].FCP = 900; }), guard: FRONT_BUILD },
  // ── G: the guard's own guards ────────────────────────────────────────
  { id: "G1", defect: "the delta-mismatch check's `// refusal:` marker deleted: the marker map leg must fail (a throw with no marker)", file: PUBLISH, fn: (s) => mustReplace(s, "      // refusal: cc-delta-mismatch\n", ""), guard: REFUSALS_LEG("every throw site") },
  { id: "G2", defect: "the six reconciliation rows deleted from generate.mjs while the four throws keep their markers: the map leg must fail (a throw's site has no row)", file: GEN, fn: (s) => { const t = s.replace(/  \{ id: "cc-(runs-count|runs-absent|usable-samples|delta-mismatch|run-edited|stored-median)".*\n/g, ""); if (t === s) throw new Error("rows not found"); return t; }, guard: REFUSALS_LEG("every throw site") },
  { id: "G3", defect: "the reconciliation block deleted entirely from publish.mjs: the six fixtures admit and the marker map loses four sites, the refusals suite must fail", file: PUBLISH, fn: deleteReconciliation, guard: REFUSALS },
  { id: "G4", defect: "the VALID fixture constant's without-chrome run 3 edited by hand on disk (generate.mjs untouched): the byte-identity leg must fail (a fixture cannot drift from the table that describes it)", file: VALID_CC, fn: (s) => editJson(s, (c) => { c.conditions.without.runs[3].FCP = 700; }), guard: REFUSALS_LEG("byte-identical") },
  { id: "G5", defect: "the gate's median rule inverted to a MEAN (the recomputed delta on the fixture's runs becomes 751.71 − 628 = 123.71): the valid fixture and the control leg must refuse, the suite must fail", file: PUBLISH, fn: (s) => mustReplace(s, "    return present.length % 2 === 1 ? hi : (lo + hi) / 2;\n", "    return present.reduce((a, b) => a + b, 0) / present.length;\n"), guard: REFUSALS },
  // ── W: the probe's warm-up visit, which no test can exercise ─────────
  { id: "W1", expectMissed: true, defect: "STATED LIMIT, expected MISSED: the warm-up visit deleted from chrome-constant.ts (the method sentence left in place): the bench-runner suite has no leg that drives the probe's visit sequence (it needs a browser and an attested plane), so it passes; the re-probe after this unit deploys is the proof, by comparing run 0 against the four earlier artifacts", file: PROBE, fn: deleteWarmup, guard: RUNNER_TESTS },
  // ── N: the resolved node and its pointers ────────────────────────────
  { id: "N0", control: true, defect: "CONTROL: the decision-map cap suite passes with the measurement-pass node's dated 2026-11-01 clause in it", guard: CAP_TEST },
  { id: "N1", defect: "the RESOLVED measurement-pass node padded 1 KiB past the cap", file: MAP, fn: (s) => { const q = questionLineOf(s, "measurement-pass"); return mustReplace(s, q, q + " " + "x".repeat(1024)); }, guard: CAP_LEG("no RESOLVED node exceeds") },
  { id: "N2", defect: "the Status quotes this unit's build-log title with one word changed (the pointer no longer names a heading)", file: MAP, fn: (s) => mustReplace(s, `"${ENTRY}"`, `"${ENTRY.replace("never sees", "never saw")}"`), guard: CAP_LEG("every Status line that cites") },
  // ── E: the glyph rule over the new record (tracked by `git add` first) ─
  { id: "E0", control: true, defect: "CONTROL: the no-em-dashes guard passes over the staged tree (new record files included)", guard: NO_EM },
  { id: "E1", defect: "an em dash planted into the staged limits record: the guard must fail on it (it walks git ls-files, so the file must be staged for this row to mean anything)", file: RECORD, fn: (s) => mustReplace(s, "## The gate", "## The gate \u2014 sabotaged"), guard: NO_EM },
  // ── C: the ceiling this entry crossed ────────────────────────────────
  { id: "C0", control: true, defect: "CONTROL: the build log is under the raised 917,504 B ceiling with this unit's entry in it", guard: LINKS_LEG("stays inside the size") },
  { id: "C1", defect: "160 KiB appended to the build log (past the raised ceiling): the ceiling leg must fail and ask for a re-observation", file: LOG, fn: (s) => s + "\n" + "y".repeat(163840) + "\n", guard: LINKS_LEG("stays inside the size") },
  // ── L/H: the anchors the how-it-was-built masters pin ────────────────
  { id: "L0", control: true, defect: "CONTROL: the how-built line anchors resolve on the regenerated master", guard: LINKS_LEG("every line anchor") },
  { id: "L1", defect: "one line inserted above `## Phase 15` in the log WITHOUT regenerating the master (the line anchors shift)", file: LOG, fn: (s) => mustReplace(s, "\n## Phase 15: ", "\nA line that shifts every anchor below it.\n\n## Phase 15: "), guard: LINKS_LEG("every line anchor") },
  { id: "H0", control: true, defect: "CONTROL: @pm/reference's master regeneration test passes (the how-it-was-built index is pinned)", guard: REF_TEST },
  { id: "H1", defect: "the how-it-was-built master's phase-15 line anchor edited by hand (index and master disagree)", file: "packages/reference/surfaces/how-it-was-built/index.html", fn: (s) => { const t = s.replace(/(docs\/build-log\.md\?plain=1#L)(\d+)/, (_, p, n) => `${p}${Number(n) + 1}`); if (t === s) throw new Error("no line anchor"); return t; }, guard: REF_TEST },
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
    for (const t of targets) {
      const abs = join(repo, t);
      const before = readFileSync(abs, "utf8");
      const after = row.fn(before, t);
      if (after === before) throw new Error(`${row.id}: the edit changed nothing (anchor not found)`);
      writeFileSync(abs, after);
    }
    const run = spawnSync("bash", ["-c", row.guard], { cwd: repo, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 });
    const exit = run.status ?? -1;
    // A guard that never ran to a verdict is not a catch (PR-3's
    // verify-slice, correctness lens): a signal kill, an ENOENT or a
    // maxBuffer overflow is scored as its own verdict, never a pass.
    const runnerError = run.error || run.status === null;
    const verdict = runnerError ? "RUNNER ERROR (guard did not reach a verdict)" : row.control ? (exit === 0 ? "control, PASSED as designed" : "CONTROL BROKE") : exit === 0 ? (row.expectMissed ? "MISSED, as stated in advance" : "MISSED") : row.expectMissed ? "CAUGHT (expected MISSED, the stated limit was wrong)" : "CAUGHT";
    results.push({ id: row.id, exit, verdict, defect: row.defect });
    console.log(`${row.id}\texit=${exit}\t${verdict}\t${row.defect}`);
    if (exit !== 0) {
      const tail = (run.stdout + run.stderr).split("\n").filter((l) => /FAIL|AssertionError|✗|×|Error:|expected|moved|front lab|past the/.test(l)).slice(0, 3).join(" | ");
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
const count = (re) => results.filter((r) => re.test(r.verdict)).length;
console.log(
  `\nsummary: rows=${results.length} caught=${count(/^CAUGHT/)} controls=${count(/^control, PASSED/)} ` +
    `missed=${count(/^MISSED$/)} expected-missed=${count(/^MISSED, as stated/)} control-broke=${count(/CONTROL BROKE/)} ` +
    `caught-expected-missed=${count(/expected MISSED, the stated limit/)} runner-error=${count(/^RUNNER ERROR/)}`,
);
