// prove-provenance.mjs <map-before> <map-after> <log-after> [header-lines=8]
//
// The whole-file proof that the 2026-09-25 compaction of docs/decision-map.md
// lost nothing and invented nothing — the rule every compacted node was
// written to, run over the whole file:
//  - every non-blank line REMOVED from the map is in the log verbatim;
//  - every line ADDED to the map is a header line (the first N lines), a
//    `Status:` line, or a contiguous SENTENCE-ALIGNED substring (≥ 40 chars)
//    of exactly one removed line — it starts at that line's start or after
//    sentence punctuation / an em dash / a bold marker, and ends at the line's
//    end or before a space or bold marker;
//  - every added `Status:` line: each `#NN`, 7–40-hex SHA, `YYYY-MM-DD` and
//    number in it appears in the map BEFORE (2026-09-25 and cited phase
//    numbers excepted), and each "quoted title" after `build-log.md` is the
//    exact text of a `##`/`###` heading in the log (with or without its
//    `Phase N — ` prefix and its trailing dated parenthetical), a pointer
//    that says "narrative moved from the decision map" naming the node's own
//    key.
//   node docs/prototypes/decision-map-compaction/prove-provenance.mjs \
//     <(git show f66d464:docs/decision-map.md) docs/decision-map.md docs/build-log.md
import { readFileSync } from "node:fs";
const [beforePath, afterPath, logPath, headerArg] = process.argv.slice(2);
const HEADER = Number(headerArg ?? 8);
const beforeText = readFileSync(beforePath, "utf8");
const before = beforeText.split("\n");
const after = readFileSync(afterPath, "utf8").split("\n");
const log = readFileSync(logPath, "utf8");
const logLines = new Set(log.split("\n"));
const headingForms = (h) => {
  const text = h.replace(/^#+\s+/, "").trim();
  const noPhase = text.replace(/^Phase \d+(?:\.\d+)? — /, "");
  const out = new Set();
  for (const t of [text, noPhase]) { out.add(t); out.add(t.replace(/\s\([^()]*\d{4}-\d{2}-\d{2}[^()]*\)$/, "")); }
  return [...out];
};
const forms = new Set(log.split("\n").filter((l) => /^#{2,3} /.test(l)).flatMap(headingForms));
const phaseNumbers = new Set(log.split("\n").map((l) => l.match(/^## Phase (\d+) /)?.[1]).filter(Boolean));
const beforeSet = new Set(before), afterSet = new Set(after);
const removed = before.filter((l) => l !== "" && !afterSet.has(l));
const added = after.map((l, i) => [l, i + 1]).filter(([l, i]) => l !== "" && !beforeSet.has(l));
const notInLog = removed.filter((l) => !logLines.has(l));
const isBoundaryStart = (line, i) => i === 0 || /(?:[.;:!?)\]]|\*\*|—|\()\s?$/.test(line.slice(Math.max(0, i - 3), i));
const isBoundaryEnd = (line, j) => j === line.length || /[.;:!?)\]`"*]$/.test(line.slice(0, j)) || line[j] === " ";
const badAdds = [], badStatus = [];
let statusLines = 0, substrings = 0;
const nodeKeyAt = (n) => { for (let k = n - 1; k >= 0; k--) if (after[k].startsWith("### ")) return after[k].slice(4).split(":")[0].trim(); return null; };
for (const [l, n] of added) {
  if (n <= HEADER) continue;
  if (l.startsWith("Status:")) {
    statusLines++;
    for (const t of l.match(/#\d+|\b[0-9a-f]{7,40}\b|\d{4}-\d{2}-\d{2}|\b\d[\d,.]*\b/g) ?? []) {
      if (t === "2026-09-25") continue;
      if (/^\d{1,2}$/.test(t) && l.includes(`Phase ${t}`) && phaseNumbers.has(t)) continue;
      if (!beforeText.includes(t)) badStatus.push(`L${n}: token "${t}" is not in the map before`);
    }
    const key = nodeKeyAt(n);
    const cite = l.indexOf("build-log.md");
    if (cite >= 0) for (const m of l.slice(cite).matchAll(/["“]([^"”]+)["”]/g)) {
      const q = m[1];
      if (!forms.has(q)) badStatus.push(`L${n}: "${q}" is not the exact text of a log heading`);
      if (q.includes("narrative moved from the decision map") && !q.startsWith(`\`${key}\` — `)) badStatus.push(`L${n}: moved-narrative pointer does not name ${key}`);
    }
    continue;
  }
  const hosts = removed.filter((r) => r.includes(l));
  if (hosts.length === 1 && l.length >= 40) {
    const host = hosts[0], i = host.indexOf(l), j = i + l.length;
    if (isBoundaryStart(host, i) && isBoundaryEnd(host, j)) { substrings++; continue; }
    badAdds.push(`L${n}: substring not sentence-aligned in its original line: ${l.slice(0, 100)}`);
    continue;
  }
  badAdds.push(`L${n}: ${l.slice(0, 120)}`);
}
console.log(JSON.stringify({
  removedLines: removed.length, removedBytes: removed.reduce((a, l) => a + Buffer.byteLength(l) + 1, 0),
  removedNotInLog: notInLog.length, addedLines: added.length, addedStatusLines: statusLines, addedAlignedSubstrings: substrings,
  addedUnexplained: badAdds.length, statusViolations: badStatus.length,
  mapBefore: Buffer.byteLength(beforeText), mapAfter: Buffer.byteLength(after.join("\n")), log: Buffer.byteLength(log),
}, null, 2));
if (notInLog.length) { console.log("\nREMOVED FROM THE MAP AND NOT IN THE LOG:"); for (const l of notInLog) console.log(`- ${l.slice(0, 140)}`); }
if (badAdds.length) { console.log("\nADDED TO THE MAP WITHOUT PROVENANCE:"); for (const l of badAdds) console.log(`- ${l}`); }
if (badStatus.length) { console.log("\nSTATUS LINE VIOLATIONS:"); for (const l of badStatus) console.log(`- ${l}`); }
process.exit(notInLog.length || badAdds.length || badStatus.length ? 1 : 0);
