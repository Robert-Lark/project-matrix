// Sabotage runner, measurement pass PR-2 (unit 1), 2026-10-13.
// Copied from docs/prototypes/repo-hygiene/sabotage.mjs (unit 10) and
// re-rowed. One deliberate defect per row; the owning guard must FAIL
// (non-zero exit); CONTROL rows must PASS. Backups are taken FRESH per row
// and restores are verified by byte equality (unit 7's stale-backup lesson).
// Guards run under `bash -c` (unit 7: `bash -lc` handed node to a
// version-manager shim and every row read CAUGHT with exit 126 while nothing
// ran). Exit codes are printed for every row; verdicts are derived from
// them, never by eye. Rows with an expected MISSED verdict say so in their
// defect text BEFORE they run (a stated limit, not a surprise).
//
// New in this copy: a row may ADD a file for the guard's duration (`add:
// { path, from }`), removed afterwards, for the two rows that smuggle an
// evidence receipt into the published directory under a name of its own.
//
//   SCRATCH=<dir> node docs/prototypes/measurement-pass/sabotage.mjs [rowId…]
//
// from the repo root, on a tree with nothing else running. The front-build
// rows (B0, R1 to R5) each run the real front build, a few seconds each.
// Stated side effect: a caught front-build row leaves workers/front/dist as
// the refused build's partial output (build.mjs clears dist before it
// reads the receipts), so run `pnpm --filter @pm/front run build` after the
// table before serving or benchmarking from that tree; the origin suite's
// run-local rebuilds it anyway.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.env.REPO ?? process.cwd();
const only = process.argv.slice(2);
const backups = join(process.env.SCRATCH ?? "/tmp", "sabotage-backups");
mkdirSync(backups, { recursive: true });

const PUBLISH = "workers/front/lab/publish.mjs";
const GEN = "workers/front/test/fixtures/publish/generate.mjs";
const RECEIPTS = "workers/front/lab/receipts";
const ED_AVG = `${RECEIPTS}/editorial-avg-broadband-desktop.json`;
const ED_FAST = `${RECEIPTS}/editorial-fast-wifi-laptop.json`;
const ED_SLOW = `${RECEIPTS}/editorial-slow-4g-mid-phone.json`;
const PDP_AVG = `${RECEIPTS}/pdp-avg-broadband-desktop.json`;
const EVIDENCE_AVG = "workers/front/lab/unpublished/pdp-add-to-cart-avg-broadband-desktop.json";
const MAP = "docs/decision-map.md";
const LOG = "docs/build-log.md";
const OTHER_SHA = "0123456789abcdef0123456789abcdef01234567";

const REFUSALS = "pnpm --filter @pm/front exec vitest run test/publish-refusals.test.js";
const REFUSALS_LEG = (t) => `${REFUSALS} -t "${t}"`;
const FRONT_BUILD = "pnpm --filter @pm/front run build";
const FIXTURES_SCHEMA = "pnpm --filter @pm/bench-runner exec vitest run test/publish-fixtures.test.ts";
const NO_EM = "pnpm --filter @pm/repo-checks exec vitest run test/no-em-dashes.test.ts";
const CAP_TEST = "pnpm --filter @pm/repo-checks exec vitest run test/decision-map-node-cap.test.ts";
const CAP_LEG = (t) => `${CAP_TEST} -t "${t}"`;
const LINKS_LINE_LEG = 'pnpm --filter @pm/repo-checks exec vitest run test/how-built-links-resolve.test.ts -t "every line anchor"';
const REF_TEST = "pnpm --filter @pm/reference exec vitest run";

const mustReplace = (s, from, to) => {
  if (!s.includes(from)) throw new Error(`anchor not found: ${from.slice(0, 80)}`);
  return s.replace(from, to);
};
const editJson = (s, f) => {
  const o = JSON.parse(s);
  f(o);
  return JSON.stringify(o, null, 2) + "\n";
};
const questionLineOf = (s, key) => {
  const i = s.indexOf(`\n### ${key}:`);
  if (i < 0) throw new Error(`no node ${key}`);
  const q = s.indexOf("\n**Question:**", i);
  const e = s.indexOf("\n", q + 1);
  return s.slice(q + 1, e);
};
// The gate as written, anchored by its first and last lines so a row that
// deletes it fails loudly if the text ever drifts.
const GATE_HEAD = '  if (receipt.harness?.quiescence !== "in-flight-tracked") {\n    // refusal: no-quiescence-attestation\n';
const GATE_TAIL = '        `earned by nothing (ADR-0001 addendum R); not publishable`,\n    );\n  }\n';
const deleteGate = (s) => {
  const a = s.indexOf(GATE_HEAD);
  const b = s.indexOf(GATE_TAIL, a);
  if (a < 0 || b < 0) throw new Error("gate anchors not found");
  return s.slice(0, a) + s.slice(b + GATE_TAIL.length);
};

// A HEAD receipt (one of the three 1c543ac files this commit replaces), as
// git holds it, for the stated-limit row.
const headReceipt = (file) => JSON.parse(execFileSync("git", ["show", `HEAD:${file}`], { cwd: repo, encoding: "utf8" }));

/** @type {{ id: string, defect: string, file?: string, files?: string[], fn?: (s: string, file: string) => string, add?: { path: string, from: string }, guard: string, control?: boolean, expectMissed?: boolean }[]} */
const ROWS = [
  // ── A: the whole refusals suite on the fixed tree ────────────────────
  { id: "A0", control: true, defect: "CONTROL: no defect, the publication-gate refusals test passes on the fixed tree (62 rows, 48 throw sites)", guard: REFUSALS },
  // ── G: the gate itself, through its fixture rows ─────────────────────
  { id: "G1", defect: "the quiescence gate deleted from publish.mjs (the pre-PR-2 state): the no-quiescence-attestation fixture admits", file: PUBLISH, fn: deleteGate, guard: REFUSALS_LEG("no-quiescence-attestation") },
  { id: "G2", defect: "the gate weakened to a PRESENCE check (`=== undefined`): a receipt naming another mechanism admits", file: PUBLISH, fn: (s) => mustReplace(s, 'if (receipt.harness?.quiescence !== "in-flight-tracked") {', "if (receipt.harness?.quiescence === undefined) {"), guard: REFUSALS_LEG("quiescence-other-mechanism") },
  { id: "G3", defect: "the gate kept but its `// refusal:` marker deleted: the marker map leg must fail (a throw with no marker)", file: PUBLISH, fn: (s) => mustReplace(s, "    // refusal: no-quiescence-attestation\n", ""), guard: REFUSALS_LEG("every throw site") },
  { id: "G4", defect: "both new CASES rows deleted from generate.mjs while the throw keeps its marker: the map leg must fail (a throw's site has no row)", file: GEN, fn: (s) => s.replace(/  \{ id: "no-quiescence-attestation",[^\n]*\n/, "").replace(/  \{ id: "quiescence-other-mechanism",[^\n]*\n/, ""), guard: REFUSALS_LEG("every throw site") },
  { id: "G5", defect: "the second row's `schemaValid: false` flag removed: the runner-side schema leg must fail (a fixture the runner cannot mint, unflagged)", file: GEN, fn: (s) => mustReplace(s, '\\(found "networkidle"\\)/, schemaValid: false }', '\\(found "networkidle"\\)/ }'), guard: FIXTURES_SCHEMA },
  { id: "G6", defect: "the gate's refusal message reworded (`does not attest` → `lacks`): both rows' regexes must fail, a row proves the message, not only the throw", file: PUBLISH, fn: (s) => mustReplace(s, "does not attest harness.quiescence", "lacks harness.quiescence"), guard: REFUSALS_LEG("no-quiescence-attestation") },
  // ── R: the REAL front build over the committed receipts ──────────────
  { id: "B0", control: true, defect: "CONTROL: the front build publishes the six committed receipts and the evidence directory stays outside it", guard: FRONT_BUILD },
  { id: "R1", defect: "a published editorial receipt with `harness.quiescence` deleted (the 1c543ac shape): the front build must refuse by the attestation", file: ED_AVG, fn: (s) => editJson(s, (r) => { delete r.harness.quiescence; }), guard: FRONT_BUILD },
  { id: "R2", defect: "a published editorial receipt whose `commit.sha` is not the SHA the plane attested (originCommit.sha): the front build must refuse it as cross-tree", file: ED_FAST, fn: (s) => editJson(s, (r) => { r.commit.sha = OTHER_SHA; }), guard: FRONT_BUILD },
  { id: "R3", defect: "a published PDP receipt re-pinned to another SHA in BOTH commit and originCommit (self-consistent, but the surface's three receipts now span two SHAs)", file: PDP_AVG, fn: (s) => editJson(s, (r) => { r.commit.sha = OTHER_SHA; r.originCommit.sha = OTHER_SHA; }), guard: FRONT_BUILD },
  { id: "R4", defect: "an evidence receipt copied INTO lab/receipts/ under its own name (pdp-add-to-cart-avg-broadband-desktop.json): refused by filename before any value is read", add: { path: `${RECEIPTS}/pdp-add-to-cart-avg-broadband-desktop.json`, from: EVIDENCE_AVG }, guard: FRONT_BUILD },
  { id: "R5", defect: "the evidence receipt written OVER the published gallery-switch receipt (same filename, add-to-cart batch): the fit template's declared interaction must refuse it", file: PDP_AVG, fn: () => readFileSync(join(repo, EVIDENCE_AVG), "utf8"), guard: FRONT_BUILD },
  // The gate's STATED LIMIT, as a row rather than as silence (verify-slice,
  // skeptic lens): the attestation is the runner's word in the artifact, so
  // the three 1c543ac receipts restored from HEAD with the key added BY HAND
  // (one SHA, one date, one location, every other field as minted, all
  // three so the surface does not span two SHAs) admit through every check.
  // Nothing in a JSON file can prove which code wrote it; review and
  // `pnpm bench reproduce` are what hold this, not the gate.
  { id: "R6", expectMissed: true, defect: "STATED LIMIT, expected MISSED: the three 1c543ac receipts restored from HEAD with `harness.quiescence` added by hand (one SHA, one date, every other field as minted): the gate reads the runner's word, so the front build admits them", files: [ED_AVG, ED_FAST, ED_SLOW], fn: (_s, file) => { const r = headReceipt(file); r.harness.quiescence = "in-flight-tracked"; return JSON.stringify(r, null, 2) + "\n"; }, guard: FRONT_BUILD },
  // ── E: the em-dash guard, now that the receipts exemption is gone ────
  // The guard walks `git ls-files`, so on an uncommitted tree this control
  // covers the three TRACKED editorial receipts; the untracked new files
  // (the three PDP receipts, lab/unpublished/, this directory, the two new
  // fixtures) were grepped by hand (0 glyphs) and the guard re-run after
  // `git add`, before the commit (verify-slice, skeptic lens).
  { id: "E0", control: true, defect: "CONTROL: the no-em-dashes guard passes with the receipts exemption dropped (tracked files; the re-minted editorial receipts carry none)", guard: NO_EM },
  { id: "E1", defect: "an em dash planted into a published receipt's methodNotes: with the exemption dropped the guard must fail on it", file: ED_AVG, fn: (s) => editJson(s, (r) => { r.methodNotes[0] = r.methodNotes[0] + " \u2014 planted"; }), guard: NO_EM },
  // ── N: the map lines this unit edits ─────────────────────────────────
  { id: "N0", control: true, defect: "CONTROL: the decision-map cap leg passes with this unit's edits to the measurement-pass, interaction-registry and workers-hardening nodes", guard: CAP_TEST },
  { id: "N1", defect: "the RESOLVED interaction-registry node padded 1 KiB past the cap (the retired-obligation clause grown into narrative)", file: MAP, fn: (s) => { const q = questionLineOf(s, "interaction-registry"); return s.replace(q, q + "\n\n" + "narrative ".repeat(Math.ceil((7168 + 1024) / 10))); }, guard: CAP_LEG("no RESOLVED node exceeds") },
  { id: "N2", defect: "the measurement-pass Status quotes this unit's build-log title with one word changed (the pointer no longer names a heading)", file: MAP, fn: (s) => mustReplace(s, '"The receipts that earned their flags', '"The receipts that earned flags'), guard: CAP_LEG("quotes only titles that are headings") },
  // ── L/H: the existing guards this unit's log edit leans on ────────────
  { id: "L0", control: true, defect: "CONTROL: the how-built line anchors resolve on the regenerated master", guard: LINKS_LINE_LEG },
  { id: "L1", defect: "one line inserted above `## Phase 15` in the log WITHOUT regenerating the master (the line anchors shift)", file: LOG, fn: (s) => mustReplace(s, "\n## Phase 15: ", "\nA line that moves every later heading.\n\n## Phase 15: "), guard: LINKS_LINE_LEG },
  { id: "H0", control: true, defect: "CONTROL: @pm/reference's master regeneration test passes (the how-it-was-built index is pinned)", guard: REF_TEST },
  { id: "H1", defect: "the how-it-was-built master's phase-15 line anchor edited by hand (index and master disagree)", file: "packages/reference/surfaces/how-it-was-built/index.html", fn: (s) => s.replace(/build-log\.md\?plain=1#L(\d+)" rel="noopener">Phase 15/, (m, n) => m.replace(`#L${n}`, `#L${Number(n) + 1}`)), guard: REF_TEST },
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
  let added = null;
  try {
    for (const t of targets) {
      const abs = join(repo, t);
      const before = readFileSync(abs, "utf8");
      const after = row.fn(before, t);
      if (after === before) throw new Error(`${row.id}: the edit changed nothing (anchor not found)`);
      writeFileSync(abs, after);
    }
    if (row.add) {
      const abs = join(repo, row.add.path);
      if (existsSync(abs)) throw new Error(`${row.id}: ${row.add.path} already exists, refusing to clobber`);
      copyFileSync(join(repo, row.add.from), abs);
      added = abs;
    }
    const run = spawnSync("bash", ["-c", row.guard], { cwd: repo, encoding: "utf8", env: process.env });
    const exit = run.status ?? -1;
    const verdict = row.control ? (exit === 0 ? "control, PASSED as designed" : "CONTROL BROKE") : exit === 0 ? (row.expectMissed ? "MISSED, as stated in advance" : "MISSED") : row.expectMissed ? "CAUGHT (expected MISSED, the stated limit was wrong)" : "CAUGHT";
    results.push({ id: row.id, exit, verdict, defect: row.defect });
    console.log(`${row.id}\texit=${exit}\t${verdict}\t${row.defect}`);
    if (exit !== 0) {
      const tail = (run.stdout + run.stderr).split("\n").filter((l) => /FAIL|AssertionError|✗|×|Error:|expected|moved|front lab/.test(l)).slice(0, 3).join(" | ");
      console.log(`\t↳ ${tail.slice(0, 300)}`);
    }
  } finally {
    if (added) rmSync(added);
    for (const [t, b] of saved) {
      const abs = join(repo, t);
      copyFileSync(b, abs);
      if (!bytesOf(abs).equals(bytesOf(b))) throw new Error(`${row.id}: restore of ${t} does not match its backup`);
    }
  }
}
console.log("\n| row | defect | result | exit |\n|---|---|---|---|");
for (const r of results) console.log(`| ${r.id} | ${r.defect} | ${r.verdict} | ${r.exit} |`);
// The summary is DERIVED from the verdicts, never typed (the first table of
// this unit stated 15 caught and 7 controls by eye; the rows held 16 and 6).
const count = (re) => results.filter((r) => re.test(r.verdict)).length;
console.log(
  `\nsummary: rows=${results.length} caught=${count(/^CAUGHT/)} controls=${count(/^control, PASSED/)} ` +
    `missed=${count(/^MISSED$/)} expected-missed=${count(/^MISSED, as stated/)} control-broke=${count(/CONTROL BROKE/)} ` +
    `caught-expected-missed=${count(/expected MISSED, the stated limit/)}`,
);
