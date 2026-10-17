// Sabotage runner, measurement pass PR-3 (unit 1, the chrome constant), 2026-10-17.
// Copied from sabotage.mjs beside it (PR-2) and re-rowed. One deliberate
// defect per row; the owning guard must FAIL (non-zero exit); CONTROL rows
// must PASS. Backups fresh per row, restores verified by byte equality,
// guards under `bash -c`, exit codes printed, the summary line DERIVED from
// the verdicts. A row with an expected MISSED verdict says so in its defect
// text before it runs (a stated limit, not a surprise).
//
//   SCRATCH=<dir> node docs/prototypes/measurement-pass/sabotage-constant.mjs [rowId…]
//
// from the repo root, on a tree with nothing else running, AFTER the new
// files are staged (`git add`): the em-dash guard walks `git ls-files`, so
// an untracked record file is invisible to it (PR-2's lesson, row E1 here
// depends on it). Stated side effect, as in PR-2: a caught front-build row
// (P1 to P4) leaves workers/front/dist as the refused build's partial
// output, so run `pnpm --filter @pm/front run build` after the table.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repo = process.env.REPO ?? process.cwd();
const only = process.argv.slice(2);
const backups = join(process.env.SCRATCH ?? "/tmp", "sabotage-constant-backups");
mkdirSync(backups, { recursive: true });

const PUBLISH = "workers/front/lab/publish.mjs";
const GEN = "workers/front/test/fixtures/publish/generate.mjs";
const CONSTANT = "workers/front/lab/chrome-constant.json";
const RECORD = "docs/prototypes/measurement-pass/constant-2026-10-17.md";
const MAP = "docs/decision-map.md";
const LOG = "docs/build-log.md";
const OTHER_SHA = "0123456789abcdef0123456789abcdef01234567";
const BOOTSTRAP_SHA = "49e00e51a991ee8002b24838c3bf245d2a0ce0c1";

const REFUSALS = "pnpm --filter @pm/front exec vitest run test/publish-refusals.test.js";
const REFUSALS_LEG = (t) => `${REFUSALS} -t "${t}"`;
const FRONT_BUILD = "pnpm --filter @pm/front run build";
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
// The provenance check as PR-3 leaves it, anchored by its first and last lines.
const PROV_HEAD = "  const oc = chromeConstant.originCommit;\n  if (!oc || oc.dirty !== false || oc.sha !== chromeConstant.commit.sha) {\n    // refusal: cc-provenance\n";
const PROV_TAIL = "(ADR-0001 addendum Q)\",\n    );\n  }\n";
const deleteProvenance = (s) => {
  const a = s.indexOf(PROV_HEAD); const b = s.indexOf(PROV_TAIL, a);
  if (a < 0 || b < 0) throw new Error("provenance anchors not found");
  return s.slice(0, a) + s.slice(b + PROV_TAIL.length);
};
// The pre-PR-3 shape: the same check wrapped in the bootstrap exemption.
const reintroducePin = (s) => {
  const a = s.indexOf(PROV_HEAD); const b = s.indexOf(PROV_TAIL, a);
  if (a < 0 || b < 0) throw new Error("provenance anchors not found");
  const block = s.slice(a, b + PROV_TAIL.length);
  return s.slice(0, a) + `  if (chromeConstant.commit.sha !== "${BOOTSTRAP_SHA}") {\n` + block + "  }\n" + s.slice(b + PROV_TAIL.length);
};
const bootstrapShaped = (s) => editJson(s, (c) => { c.commit.sha = BOOTSTRAP_SHA; c.originCommit = null; });

/** @type {{ id: string, defect: string, file?: string, files?: string[], fn?: (s: string, file: string) => string, guard: string, control?: boolean, expectMissed?: boolean }[]} */
const ROWS = [
  { id: "A0", control: true, defect: "CONTROL: no defect, the publication-gate refusals test passes on the tree with the pin removed (62 rows, 48 throw sites)", guard: REFUSALS },
  // ── P: the real artifact through the real front build ───────────────
  { id: "B0", control: true, defect: "CONTROL: the front build admits the committed deployed-plane constant (identity gate and unconditional provenance both pass)", guard: FRONT_BUILD },
  { id: "P1", defect: "the committed constant's originCommit.sha set to another tree (cross-tree): the front build must refuse by provenance", file: CONSTANT, fn: (s) => editJson(s, (c) => { c.originCommit.sha = OTHER_SHA; }), guard: FRONT_BUILD },
  { id: "P2", defect: "the committed constant re-pinned to the bootstrap SHA with originCommit null (the exact shape the pin admitted): the front build must refuse by provenance now that the pin is gone", file: CONSTANT, fn: bootstrapShaped, guard: FRONT_BUILD },
  { id: "P3", defect: "the committed constant's originCommit.dirty flipped to true: the front build must refuse by provenance", file: CONSTANT, fn: (s) => editJson(s, (c) => { c.originCommit.dirty = true; }), guard: FRONT_BUILD },
  { id: "P4", defect: "the committed constant's measuredChrome.sha256 edited (first hex digit flipped): the identity gate must refuse a constant describing a fragment this build does not ship", file: CONSTANT, fn: (s) => editJson(s, (c) => { c.measuredChrome.sha256 = (c.measuredChrome.sha256[0] === "0" ? "1" : "0") + c.measuredChrome.sha256.slice(1); }), guard: FRONT_BUILD },
  { id: "P6", expectMissed: true, defect: "STATED LIMIT, expected MISSED: deltaMedians.FCP hand-edited from 72 to 20 with the conditions runs untouched: no gate reconciles the published delta with the artifact's own runs (the R6 shape for the constant), the build admits and the page prints the edited figure beside bands from the runs", file: CONSTANT, fn: (s) => editJson(s, (c) => { c.deltaMedians.FCP = 20; }), guard: FRONT_BUILD },
  { id: "P5", expectMissed: true, defect: "STATED LIMIT, expected MISSED: the pin RE-INTRODUCED in publish.mjs (the pre-PR-3 shape) with a bootstrap-shaped constant (P2's edit): the build admits, which is what the pin permitted and PR-3 removes", files: [PUBLISH, CONSTANT], fn: (s, f) => (f === PUBLISH ? reintroducePin(s) : bootstrapShaped(s)), guard: FRONT_BUILD },
  // ── G: the guard's own guards ────────────────────────────────────────
  { id: "G1", defect: "the provenance check's `// refusal:` marker deleted: the marker map leg must fail (a throw with no marker)", file: PUBLISH, fn: (s) => mustReplace(s, "    // refusal: cc-provenance\n", ""), guard: REFUSALS_LEG("every throw site") },
  { id: "G2", defect: "the three cc-provenance rows deleted from generate.mjs while the throw keeps its marker: the map leg must fail (a throw's site has no row)", file: GEN, fn: (s) => { const t = s.replace(/  \{ id: "cc-(cross-tree|dirty-origin|unattested)".*\n/g, ""); if (t === s) throw new Error("rows not found"); return t; }, guard: REFUSALS_LEG("every throw site") },
  { id: "G3", defect: "the provenance check deleted entirely from publish.mjs: the three cc-provenance fixtures admit and the marker map loses a site, the refusals suite must fail", file: PUBLISH, fn: deleteProvenance, guard: REFUSALS },
  // ── N: the resolved node and its pointers ────────────────────────────
  { id: "N0", control: true, defect: "CONTROL: the decision-map cap suite passes with the measurement-pass node RESOLVED and compacted", guard: CAP_TEST },
  { id: "N1", defect: "the now-RESOLVED measurement-pass node padded 1 KiB past the cap (the exemption it had while open is gone)", file: MAP, fn: (s) => { const q = questionLineOf(s, "measurement-pass"); return mustReplace(s, q, q + " " + "x".repeat(2048)); }, guard: CAP_LEG("no RESOLVED node exceeds") },
  { id: "N2", defect: "the Status quotes PR-3's build-log title with one word changed (the pointer no longer names a heading)", file: MAP, fn: (s) => mustReplace(s, '"The constant that waited for its plane, and the pin that left with it (2026-10-17)"', '"The constant that waited for its plane, and the pin that went with it (2026-10-17)"'), guard: CAP_LEG("every Status line that cites") },
  // Round 1 ran this row against the "every moved-narrative sub-entry" leg
  // alone and it was MISSED: that leg keys both sets by NODE NAME and treats
  // the date as a wildcard, so a re-dated sub-entry still pairs with its
  // node. The date lives in the exactness leg ("every Status line that
  // cites build-log.md quotes only titles that are headings"), which the
  // whole cap suite runs; the row now runs the suite, and the limit of the
  // completeness leg on its own is recorded in the table.
  { id: "N3", defect: "the moved-narrative sub-entry's heading in the LOG re-dated: the exactness leg must fail (the Status quote no longer names a heading); the completeness leg alone would not, it keys on the node name", file: LOG, fn: (s) => mustReplace(s, "### `measurement-pass`: narrative moved from the decision map (2026-10-17)", "### `measurement-pass`: narrative moved from the decision map (2026-10-18)"), guard: CAP_TEST },
  // ── E: the glyph rule over the new record (tracked by `git add` first) ─
  { id: "E0", control: true, defect: "CONTROL: the no-em-dashes guard passes over the staged tree (new record files included)", guard: NO_EM },
  { id: "E1", defect: "an em dash planted into the staged constant record: the guard must fail on it (it walks git ls-files, so the file must be staged for this row to mean anything)", file: RECORD, fn: (s) => mustReplace(s, "## The probe", "## The probe \u2014 sabotaged"), guard: NO_EM },
  // ── C: the ceiling the entry was written under ───────────────────────
  { id: "C0", control: true, defect: "CONTROL: the build log is under the 786,432 B observed ceiling with this unit's entry and sub-entry in it", guard: LINKS_LEG("stays inside the size") },
  { id: "C1", defect: "20 KiB appended to the build log (past the ceiling): the ceiling leg must fail and ask for a re-observation", file: LOG, fn: (s) => s + "\n" + "y".repeat(20480) + "\n", guard: LINKS_LEG("stays inside the size") },
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
    const run = spawnSync("bash", ["-c", row.guard], { cwd: repo, encoding: "utf8", env: process.env });
    const exit = run.status ?? -1;
    // A guard that never ran to a verdict is not a catch (verify-slice,
    // correctness lens, round 1): spawnSync reports a signal kill, an
    // ENOENT or a maxBuffer overflow as status null or run.error, which the
    // old rule scored as CAUGHT because -1 is non-zero. Scored as its own
    // verdict, counted in the summary, and never a pass.
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
