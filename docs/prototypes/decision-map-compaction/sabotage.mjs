// Sabotage runner — decision-map compaction (unit 9), 2026-09-25.
// Copied from docs/prototypes/workers-hardening/sabotage.mjs (unit 8) and
// re-rowed. One deliberate defect per row; the owning guard must FAIL
// (non-zero exit); CONTROL rows must PASS. Backups are taken FRESH per row
// and restores are verified by byte equality (unit 7's stale-backup lesson).
// Guards run under `bash -c` (unit 7: `bash -lc` handed node to a
// version-manager shim and every row read CAUGHT with exit 126 while nothing
// ran). Exit codes are printed for every row; verdicts are derived from
// them, never by eye. Rows with an expected MISSED verdict say so in their
// defect text BEFORE they run (a stated limit, not a surprise).
//
//   SCRATCH=<dir> node docs/prototypes/decision-map-compaction/sabotage.mjs [rowId…]
//
// from the repo root, on a tree with nothing else running.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = process.env.REPO ?? process.cwd();
const only = process.argv.slice(2);
const backups = join(process.env.SCRATCH ?? "/tmp", "sabotage-backups");
mkdirSync(backups, { recursive: true });

const MAP = "docs/decision-map.md";
const LOG = "docs/build-log.md";
const CAP_TEST = "pnpm --filter @pm/repo-checks exec vitest run test/decision-map-node-cap.test.ts";
const CAP_LEG = (t) => `${CAP_TEST} -t "${t}"`;
const LINKS_LINE_LEG = 'pnpm --filter @pm/repo-checks exec vitest run test/how-built-links-resolve.test.ts -t "every line anchor"';
const REF_TEST = "pnpm --filter @pm/reference exec vitest run";

// The narrative that used to sit in a node — read back out of the log's own
// "narrative moved from the decision map" sub-entry for that node, so the
// runner depends on nothing outside the repo.
const narrativeOf = (key) => {
  const log = readFileSync(join(repo, LOG), "utf8");
  const h = `### \`${key}\` — narrative moved from the decision map (2026-09-25)`;
  const i = log.indexOf(h);
  if (i < 0) throw new Error(`no moved-narrative sub-entry for ${key}`);
  const rest = log.slice(i + h.length);
  const end = rest.search(/\n##+ /);
  return rest.slice(0, end < 0 ? undefined : end);
};
// A node's `**Question:**` line is kept verbatim by the compaction, so it is a stable anchor.
const questionLineOf = (s, key) => {
  const i = s.indexOf(`\n### ${key}:`);
  if (i < 0) throw new Error(`no node ${key}`);
  const q = s.indexOf("\n**Question:**", i);
  const e = s.indexOf("\n", q + 1);
  return s.slice(q + 1, e);
};
// The last node must be RESOLVED for the S1 rows to mean anything (skeptic lens: the row text named the wrong node).
const assertLastResolved = (s, start) => {
  const head = s.slice(start).split("\n")[0];
  const st = s.slice(start).split("\n").find((l) => l.startsWith("Status:")) ?? "";
  const v = st.replace(/^Status:\s*/, "").replace(/[*_`]/g, "").trimStart().toLowerCase().split(/ — |\. |; /)[0];
  if (/^(open|in[ -]progress)\b/.test(v) || !/\b(resolved|merged|closed|landed|built|deployed|done|shipped)\b/.test(v)) throw new Error(`last node is not RESOLVED: ${head}`);
  console.log(`\t(last node: ${head.slice(4, 60)})`);
};
const statusLineOf = (s, key) => {
  const i = s.indexOf(`\n### ${key}:`);
  if (i < 0) throw new Error(`no node ${key}`);
  const q = s.indexOf("\nStatus:", i);
  const e = s.indexOf("\n", q + 1);
  return s.slice(q + 1, e);
};

/** @type {{ id: string, defect: string, file?: string, fn?: (s: string) => string, guard: string, control?: boolean, expectMissed?: boolean }[]} */
const ROWS = [
  // ── N: the node cap leg ──────────────────────────────────────────────
  { id: "N0", control: true, defect: "CONTROL: no defect — the decision-map leg passes on the compacted tree", guard: CAP_TEST },
  { id: "N1", defect: "the plp-htmx narrative pasted back into its RESOLVED node (the prompt's own Done-means sabotage)", file: MAP, fn: (s) => { const q = questionLineOf(s, "plp-htmx"); return s.replace(q, q + "\n\n" + narrativeOf("plp-htmx").trim()); }, guard: CAP_LEG("no RESOLVED node exceeds") },
  { id: "N2", defect: "a smaller paste: 1 KiB over the cap into security-floor (the cap is a line, not a cliff)", file: MAP, fn: (s) => { const q = questionLineOf(s, "security-floor"); const nodeStart = s.indexOf("\n### security-floor:"); const nodeEnd = s.indexOf("\n### ", nodeStart + 1); const bytes = Buffer.byteLength(s.slice(nodeStart + 1, nodeEnd + 1)); const need = CAP + 1024 - bytes; return s.replace(q, q + "\n\n" + "narrative ".repeat(Math.ceil(need / 10))); }, guard: CAP_LEG("no RESOLVED node exceeds") },
  { id: "N3", control: true, defect: "CONTROL: an OPEN node (domain-cutover) padded 8 KiB past the cap — exempt by design, the leg must PASS", file: MAP, fn: (s) => { const q = questionLineOf(s, "domain-cutover"); return s.replace(q, q + "\n\n" + "active work ".repeat(Math.ceil((CAP + 8192) / 12))); }, guard: CAP_TEST },
  { id: "N4", expectMissed: true, defect: "the N1 paste PLUS the node's Status flipped to `open` — the exemption trusts the Status line; expected MISSED, stated limit", file: MAP, fn: (s) => { const q = questionLineOf(s, "plp-htmx"); const st = statusLineOf(s, "plp-htmx"); return s.replace(st, "Status: open").replace(q, q + "\n\n" + narrativeOf("plp-htmx").trim()); }, guard: CAP_LEG("no RESOLVED node exceeds") },
  { id: "N5", defect: "every Status line flipped to `open` (the exemption swallows the rule): the minority leg", file: MAP, fn: (s) => s.replace(/^Status:.*$/gm, "Status: open"), guard: CAP_LEG("resolved nodes exist") },
  { id: "N6", defect: "every `### ` heading demoted to `#### ` (zero nodes): the non-vacuity floor", file: MAP, fn: (s) => s.replace(/^### /gm, "#### "), guard: CAP_LEG("real number of nodes") },
  { id: "N7", defect: "security-floor loses its Status line (a node that names no status is neither open nor resolved)", file: MAP, fn: (s) => s.replace(statusLineOf(s, "security-floor") + "\n", ""), guard: CAP_LEG("every node names a status") },
  { id: "N8", defect: "a NEW resolved node appended, one byte over the cap", file: MAP, fn: (s) => { const head = "### zz-new-unit: a node that landed its narrative in the map\nStatus: **RESOLVED (2026-09-25)**\nType: implement\n**Question:** x\n**Answer.** "; const body = "y".repeat(CAP + 1 - Buffer.byteLength(head) - 1); return s.replace(/\n*$/, "\n\n" + head + body + "\n"); }, guard: CAP_LEG("no RESOLVED node exceeds") },
  // ── H: the header leg ────────────────────────────────────────────────
  { id: "H1", defect: "the header's stale size figure re-inserted (\"at ~182 KB\")", file: MAP, fn: (s) => s.replace("which is what makes its size a real cost", "which is what makes its size a real cost: at ~182 KB it is roughly 45k tokens"), guard: CAP_LEG("states no size figure") },
  { id: "H2", defect: "the header's size command removed", file: MAP, fn: (s) => s.replace(/`git cat-file -s HEAD:docs\/decision-map\.md`/, "the usual command").replace(/`wc -c docs\/decision-map\.md`/, "it"), guard: CAP_LEG("states no size figure") },
  // ── P: the build-log pointer leg ─────────────────────────────────────
  { id: "P1", defect: "the plp-htmx moved-narrative sub-entry's heading reworded in the log (the map's pointer now dangles)", file: LOG, fn: (s) => s.replace("### `plp-htmx` — narrative moved from the decision map (2026-09-25)", "### `plp-htmx` — narrative moved from the map (2026-09-25)"), guard: CAP_LEG("quotes only titles that are headings") },
  { id: "P2", defect: "a compacted node's Status quotes a phase entry title that does not exist", file: MAP, fn: (s) => { const st = statusLineOf(s, "security-floor"); return s.replace(st, st.replace("The floor the blog already had, and the roster the collector never checked", "The floor the blog already had")); }, guard: CAP_LEG("quotes only titles that are headings") },
  // ── Round 2 (verify-slice, correctness lens): the vocabulary, the exact pointer, the wider figure regex, the last-node byte ──
  { id: "V1", defect: "security-floor's verdict replaced by a word nobody classified (\"wrapped up\"): the vocabulary leg", file: MAP, fn: (s) => { const st = statusLineOf(s, "security-floor"); return s.replace(st, st.replace("**BUILT AND VERIFIED (2026-09-18)**", "**WRAPPED UP (2026-09-18)**")); }, guard: CAP_LEG("every status verdict is in the vocabulary") },
  { id: "V2", control: true, defect: "CONTROL: security-floor relabelled an IN-FLIGHT verdict (CODE COMPLETE, NOT MERGED) and padded 8 KiB past the cap — active work is exempt, the leg must PASS", file: MAP, fn: (s) => { const st = statusLineOf(s, "security-floor"); const q = questionLineOf(s, "security-floor"); return s.replace(st, st.replace("**BUILT AND VERIFIED (2026-09-18)**", "**CODE COMPLETE, NOT MERGED**")).replace(q, q + "\n\n" + "active work ".repeat(Math.ceil((CAP + 8192) / 12))); }, guard: CAP_TEST },
  { id: "P3", defect: "plp-htmx's moved-narrative pointer renamed to plp-react-next's sub-entry (a real heading, the wrong node)", file: MAP, fn: (s) => { const st = statusLineOf(s, "plp-htmx"); return s.replace(st, st.replace("\"`plp-htmx` — narrative moved", "\"`plp-react-next` — narrative moved")); }, guard: CAP_LEG("quotes only titles that are headings") },
  { id: "P4", defect: "security-floor's Status quotes the fragment \"Phase 15\" in place of the entry title (a substring of a real heading)", file: MAP, fn: (s) => { const st = statusLineOf(s, "security-floor"); return s.replace(st, st.replace("\"The floor the blog already had, and the roster the collector never checked (2026-09-18)\"", "\"Phase 15\"")); }, guard: CAP_LEG("quotes only titles that are headings") },
  { id: "H3", defect: "the header's stale size figure re-inserted in the unit the regex used to miss (\"at 253,385 bytes\")", file: MAP, fn: (s) => s.replace("which is what makes its size a real cost", "which is what makes its size a real cost: at 253,385 bytes"), guard: CAP_LEG("states no size figure") },
  { id: "S1", defect: "the LAST node (whichever `### ` is last — asserted RESOLVED by the row) padded to exactly one byte over the cap — the last-node span is measured without the file's final newline", file: MAP, fn: (s) => { const start = s.lastIndexOf("\n### ") + 1; assertLastResolved(s, start); const bytes = Buffer.byteLength(s.slice(start).replace(/\n+$/, "\n")); const need = CAP + 1 - bytes; if (need <= 0) throw new Error("last node already over"); return s.replace(/\n+$/, "\n") + "x".repeat(need - 1) + "\n"; }, guard: CAP_LEG("no RESOLVED node exceeds") },
  { id: "S1b", control: true, defect: "CONTROL: the LAST node padded to EXACTLY the cap — must PASS (an off-by-one would fail it)", file: MAP, fn: (s) => { const start = s.lastIndexOf("\n### ") + 1; assertLastResolved(s, start); const bytes = Buffer.byteLength(s.slice(start).replace(/\n+$/, "\n")); const need = CAP - bytes; return s.replace(/\n+$/, "\n") + "x".repeat(need - 1) + "\n"; }, guard: CAP_LEG("no RESOLVED node exceeds") },
  // ── Round 3 (verify-slice, conformance lens): the pointer leg was vacuous for a node that quotes nothing ──
  { id: "P5", defect: "security-floor's Status loses its moved-narrative pointer clause entirely (a node that quotes nothing passed the old leg)", file: MAP, fn: (s) => { const st = statusLineOf(s, "security-floor"); const cut = st.replace(/; the prose this node carried until 2026-09-25 is there too, under "[^"]+"\./, "."); if (cut === st) throw new Error("clause not found"); return s.replace(st, cut); }, guard: CAP_LEG("both directions") },
  { id: "P6", defect: "security-floor's moved-narrative sub-entry heading deleted from the log (its paragraphs left behind, orphaned under the previous entry)", file: LOG, fn: (s) => s.replace("### `security-floor` — narrative moved from the decision map (2026-09-25)\n", ""), guard: CAP_LEG("both directions") },
  { id: "P7", defect: "every moved-narrative pointer deleted from every Status AND every sub-entry heading deleted from the log (the lens's mutation: the old file stayed green)", file: MAP, fn: (s) => s.replace(/; the prose this node carried until 2026-09-25[^\n]*?under "[^"]+"\./g, "."), guard: CAP_LEG("both directions") },
  // ── Round 4 (verify-slice, skeptic lens): the bare-phrase pointer, the unmeasured preamble ──
  { id: "P8", defect: "plp-htmx's moved-narrative pointer rewritten UNQUOTED and naming plp-react-next (the phrase alone used to satisfy the both-directions leg)", file: MAP, fn: (s) => { const st = statusLineOf(s, "plp-htmx"); const cut = st.replace(/under "`plp-htmx` — narrative moved from the decision map \(2026-09-25\)"\./, "under `plp-react-next` — narrative moved from the decision map (2026-09-25)."); if (cut === st) throw new Error("pointer not found"); return s.replace(st, cut); }, guard: CAP_LEG("both directions") },
  { id: "N9", defect: "20 KB of narrative pasted under `## Notes` (before the first `### `): the preamble cap", file: MAP, fn: (s) => s.replace("\n## Tickets\n", "\n" + "narrative that belongs in the log ".repeat(600) + "\n\n## Tickets\n"), guard: CAP_LEG("the preamble") },
  // ── L: the existing guards this unit's log edit leans on ─────────────
  { id: "L0", control: true, defect: "CONTROL: the how-built line anchors resolve on the regenerated master", guard: LINKS_LINE_LEG },
  { id: "L1", defect: "one line inserted above `## Phase 15` in the log WITHOUT regenerating the master (the line anchors shift)", file: LOG, fn: (s) => s.replace("\n## Phase 15 — ", "\nA line that moves every later heading.\n\n## Phase 15 — "), guard: LINKS_LINE_LEG },
  { id: "R0", control: true, defect: "CONTROL: @pm/reference's master regeneration test passes (the how-it-was-built index is pinned)", guard: REF_TEST },
  { id: "R1", defect: "the how-it-was-built master's phase-15 line anchor edited by hand (index and master disagree)", file: "packages/reference/surfaces/how-it-was-built/index.html", fn: (s) => s.replace(/build-log\.md\?plain=1#L(\d+)" rel="noopener">Phase 15/, (m, n) => m.replace(`#L${n}`, `#L${Number(n) + 1}`)), guard: REF_TEST },
];

const CAP = Number(process.env.CAP ?? readFileSync(join(repo, "tools/repo-checks/test/decision-map-node-cap.test.ts"), "utf8").match(/NODE_CAP_BYTES = ([\d_]+)/)[1].replace(/_/g, ""));
console.log(`cap read from the test: ${CAP} B; repo ${repo}`);

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
    const verdict = row.control ? (exit === 0 ? "control — PASSED as designed" : "CONTROL BROKE") : exit === 0 ? (row.expectMissed ? "MISSED — as stated in advance" : "MISSED") : row.expectMissed ? "CAUGHT (expected MISSED — the stated limit was wrong)" : "CAUGHT";
    results.push({ id: row.id, exit, verdict, defect: row.defect });
    console.log(`${row.id}\texit=${exit}\t${verdict}\t${row.defect}`);
    if (exit !== 0) {
      const tail = (run.stdout + run.stderr).split("\n").filter((l) => /FAIL|AssertionError|✗|×|Error:|expected/.test(l)).slice(0, 3).join(" | ");
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
