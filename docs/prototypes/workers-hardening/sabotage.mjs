// Sabotage runner — workers-hardening (unit 8), 2026-09-25.
// One deliberate defect per row; the owning guard must FAIL (non-zero exit);
// CONTROL rows must PASS. Backups are taken FRESH per row and restores are
// verified by byte equality (unit 7's stale-backup lesson). Guards run under
// `bash -c` (unit 7: `bash -lc` handed node to a version-manager shim and
// every row read CAUGHT with exit 126 while nothing ran). Exit codes are
// printed for every row; verdicts are derived from them, never by eye.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repo = "/Users/roblark/Work/project-matrix";
const only = process.argv.slice(2); // optional row ids
const backups = join(process.env.SCRATCH ?? "/tmp", "sabotage-backups");
mkdirSync(backups, { recursive: true });

const V = "pnpm --filter @pm/front exec vitest run test/publish-refusals.test.js";
const TC = (w) => `pnpm --filter @pm/${w} exec tsc --noEmit`;

/** @type {{ id: string, defect: string, file?: string, edits?: [string, string][], create?: string, remove?: string, guard: string, control?: boolean }[]} */
const ROWS = [
  // ── A: the publication gate ──────────────────────────────────────────
  { id: "A0", control: true, defect: "CONTROL: no defect — the refusal suite passes", guard: V },
  { id: "A1", defect: "publish.mjs: dirty-tree refusal INVERTED (a clean tree is refused, a dirty one admitted)", file: "workers/front/lab/publish.mjs", edits: [["if (receipt.commit.dirty !== false) {", "if (receipt.commit.dirty === false) {"]], guard: V },
  { id: "A2", defect: "publish.mjs: cross-tree refusal removed", file: "workers/front/lab/publish.mjs", edits: [["if (oc.sha !== receipt.commit.sha) {", "if (false && oc.sha !== receipt.commit.sha) {"]], guard: V },
  { id: "A3", defect: "publish.mjs: constant-spread comparison flipped (> becomes <)", file: "workers/front/lab/publish.mjs", edits: [["if (max - min > declared.toleranceBytes) {", "if (max - min < declared.toleranceBytes) {"]], guard: V },
  { id: "A4", defect: "publish.mjs: batch-integrity SHA check removed", file: "workers/front/lab/publish.mjs", edits: [["if (r.commit.sha !== first.commit.sha) {", "if (false) {"]], guard: V },
  { id: "A5", defect: "publish.mjs: chrome-constant identity gate INVERTED", file: "workers/front/lab/publish.mjs", edits: [["if (builtSha !== mc.sha256) {", "if (builtSha === mc.sha256) {"]], guard: V },
  { id: "A6", defect: "publish.mjs: unattested-origin (originCommit: null) refusal removed", file: "workers/front/lab/publish.mjs", edits: [["if (oc === null) {", "if (oc === null && false) {"]], guard: V },
  { id: "A7", defect: "publish.mjs: a NEW refusal added with no fixture row (non-vacuity: throw-site count)", file: "workers/front/lab/publish.mjs", edits: [["export function assertBatchIntegrity(surface, receipts) {", "export function assertBatchIntegrity(surface, receipts) {\n  if (receipts.length > 99) throw new Error(\"front lab: too many receipts\");"]], guard: V },
  { id: "A8", defect: "a committed fixture deleted from disk (receipts/dirty-tree.json)", remove: "workers/front/test/fixtures/publish/receipts/dirty-tree.json", guard: V },
  { id: "A9", defect: "a committed fixture edited by hand (valid.json: runsPerUrl 3 → 4)", file: "workers/front/test/fixtures/publish/receipts/valid.json", edits: [["\"runsPerUrl\": 3,", "\"runsPerUrl\": 4,"]], guard: V },
  { id: "A10", defect: "generate.mjs: the cross-tree row deleted from CASES (file left behind)", file: "workers/front/test/fixtures/publish/generate.mjs", edits: [["  { id: \"cross-tree\", kind: \"receipt\", site: \"cross-tree\", mutate: (r) => { r.originCommit.sha = OTHER_SHA; }, expect: /a cross-tree receipt is not publishable/ },\n", ""]], guard: V },
  { id: "A11", defect: "build.mjs: the composer no longer calls assertBatchIntegrity (the gate bypassed by its caller)", file: "workers/front/build.mjs", edits: [["  assertBatchIntegrity(surface, receiptsBySurface[surface]);", "  void surface;"]], guard: V },
  { id: "A12", defect: "generate.mjs: a fixture row's mutation made a no-op (dirty-tree sets dirty=false)", file: "workers/front/test/fixtures/publish/generate.mjs", edits: [["mutate: (r) => { r.commit.dirty = true; }, expect: /minted from a dirty tree/", "mutate: (r) => { r.commit.dirty = false; }, expect: /minted from a dirty tree/"]], guard: V },
  // ── B: the typecheck ─────────────────────────────────────────────────
  { id: "B0", control: true, defect: "CONTROL: all three Worker typechecks green", guard: `${TC("edge")} && ${TC("front")} && ${TC("blog")} && ${TC("blog")} -p tsconfig.browser.json` },
  { id: "B1", defect: "db.js: savePost's result-union field renamed (updated_at → updatedAt) — the prompt's Done-means typo", file: "workers/blog/src/db.js", edits: [["    updated_at: /** @type {string} */ (fields.updated_at ?? post.updated_at),", "    updatedAt: /** @type {string} */ (fields.updated_at ?? post.updated_at),"]], guard: TC("blog") },
  { id: "B2", defect: "edge index.js: a binding name typo (env.WARM → env.WARN)", file: "workers/edge/src/index.js", edits: [["const warm = await env.WARM.get(key);", "const warm = await env.WARN.get(key);"]], guard: TC("edge") },
  { id: "B3", defect: "front: generated/ deleted, tsc run WITHOUT turbo (the dependsOn is load-bearing: ts(2307))", remove: "workers/front/generated", guard: TC("front") },
  { id: "B3b", control: true, defect: "CONTROL: front: generated/ deleted, typecheck run THROUGH turbo (build runs first)", remove: "workers/front/generated", guard: "pnpm exec turbo run typecheck --filter=@pm/front --force" },
  { id: "B4", defect: "fit.d.mts: interactionId removed again (the drift the unit found)", file: "workers/front/lab/fit.d.mts", edits: [["  interactionId: string;\n", ""]], guard: TC("front") },
  { id: "B5", defect: "fit.mjs: FIT.pdp gains a field the declaration lacks (interactionFetchh)", file: "workers/front/lab/fit.mjs", edits: [["    interactionFetch: { kind: \"constant\", toleranceBytes: 64 },", "    interactionFetch: { kind: \"constant\", toleranceBytes: 64 },\n    interactionFetchh: \"none\","]], guard: TC("front") },
  { id: "B6", defect: "edge: a NEW src file with an implicit-any parameter and no pragma (checkJs is tsconfig-wide)", create: "workers/edge/src/extra.js", guard: TC("edge") },
  { id: "B7", defect: "blog editor main.js: a dialog method called on a plain element (mediaDialog cast removed)", file: "workers/blog/src/admin/editor/main.js", edits: [["const mediaDialog = /** @type {HTMLDialogElement} */ (el(\"media-library\"));", "const mediaDialog = el(\"media-library\");"]], guard: `${TC("blog")} -p tsconfig.browser.json` },
  // ── C: the three small fixes ─────────────────────────────────────────
  { id: "C0", control: true, defect: "CONTROL: edge + blog unit suites pass", guard: "pnpm --filter @pm/edge exec vitest run && pnpm --filter @pm/blog exec vitest run test/units.test.js" },
  { id: "C1", defect: "edge: the beacon value check removed, the old 0-coercion restored", file: "workers/edge/src/index.js", edits: [["  if (typeof event.value !== \"number\" || !Number.isFinite(event.value)) {\n    return json({ error: \"value must be a finite number\" }, 400);\n  }", ""], ["    doubles: [event.value],", "    doubles: [typeof event.value === \"number\" && Number.isFinite(event.value) ? event.value : 0],"]], guard: "pnpm --filter @pm/edge exec vitest run test/beacon.test.js" },
  { id: "C2", defect: "blog html.js: esc() drops the single quote again", file: "workers/blog/src/html.js", edits: [["    .replaceAll('\"', \"&quot;\")\n    .replaceAll(\"'\", \"&#39;\");", "    .replaceAll('\"', \"&quot;\");"]], guard: "pnpm --filter @pm/blog exec vitest run test/units.test.js" },
  // ── E: the schema leg ────────────────────────────────────────────────
  { id: "E0", control: true, defect: "CONTROL: the bench-runner schema leg passes", guard: "pnpm --filter @pm/bench-runner exec vitest run test/publish-fixtures.test.ts" },
  { id: "E1", defect: "valid.json loses a field the runner's schema requires (runLocation)", file: "workers/front/test/fixtures/publish/receipts/valid.json", edits: [["  \"runLocation\": {\"label\": \"local-dev\", \"source\": \"unpinned developer machine (fixture)\"},\n", ""]], guard: "pnpm --filter @pm/bench-runner exec vitest run test/publish-fixtures.test.ts" },
  { id: "E2", defect: "valid.json gains an INVENTED field (interactionSettledd) — Zod strips unknown keys: expected MISSED, stated", file: "workers/front/test/fixtures/publish/receipts/valid.json", edits: [["\"interactionSettled\": true,", "\"interactionSettledd\": true,\n        \"interactionSettled\": true,"]], guard: "pnpm --filter @pm/bench-runner exec vitest run test/publish-fixtures.test.ts" },
];

const sha = (p) => existsSync(p) ? readFileSync(p) : null;
const results = [];
for (const row of ROWS) {
  if (only.length && !only.includes(row.id)) continue;
  const targets = [row.file, row.create, row.remove].filter(Boolean);
  const saved = new Map();
  // Fresh backup per row.
  for (const t of targets) {
    const abs = join(repo, t);
    if (existsSync(abs)) {
      const b = join(backups, `${row.id}-${t.replaceAll("/", "__")}`);
      if (t === "workers/front/generated") {
        spawnSync("cp", ["-R", abs, b]);
      } else copyFileSync(abs, b);
      saved.set(t, b);
    }
  }
  try {
    if (row.file) {
      const abs = join(repo, row.file);
      let s = readFileSync(abs, "utf8");
      for (const [a, b] of row.edits) {
        if (!s.includes(a)) throw new Error(`${row.id}: edit anchor not found: ${a.slice(0, 60)}`);
        s = s.replace(a, b);
      }
      writeFileSync(abs, s);
    }
    if (row.create) writeFileSync(join(repo, row.create), "export function f(x) {\n  return x.y;\n}\n");
    if (row.remove) rmSync(join(repo, row.remove), { recursive: true, force: true });
    const run = spawnSync("bash", ["-c", row.guard], { cwd: repo, encoding: "utf8", env: process.env });
    const exit = run.status ?? -1;
    const verdict = row.control ? (exit === 0 ? "control — PASSED as designed" : "CONTROL BROKE") : exit === 0 ? "MISSED" : "CAUGHT";
    results.push({ id: row.id, exit, verdict, defect: row.defect });
    console.log(`${row.id}\texit=${exit}\t${verdict}\t${row.defect}`);
    if (!row.control && exit !== 0) {
      const tail = (run.stdout + run.stderr).split("\n").filter((l) => /FAIL|error TS|✗|×|Error:/.test(l)).slice(0, 3).join(" | ");
      console.log(`\t↳ ${tail.slice(0, 300)}`);
    }
  } finally {
    // Restore, and PROVE the restore.
    for (const t of targets) {
      const abs = join(repo, t);
      if (saved.has(t)) {
        const b = saved.get(t);
        if (t === "workers/front/generated") { rmSync(abs, { recursive: true, force: true }); spawnSync("cp", ["-R", b, abs]); }
        else copyFileSync(b, abs);
        if (t !== "workers/front/generated" && !sha(abs).equals(sha(b))) throw new Error(`${row.id}: restore of ${t} does not match its backup`);
      } else if (row.create && t === row.create) rmSync(abs, { force: true });
    }
  }
}
console.log("\n| row | defect | result | exit |\n|---|---|---|---|");
for (const r of results) console.log(`| ${r.id} | ${r.defect} | ${r.verdict} | ${r.exit} |`);
