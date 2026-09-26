// Per-node byte table for docs/decision-map.md: a node is a `### ` heading
// line plus every line up to the next `### ` (or EOF); bytes are UTF-8 —
// the span tools/repo-checks/test/decision-map-node-cap.test.ts measures.
//   node docs/prototypes/decision-map-compaction/node-bytes.mjs docs/decision-map.md
import { readFileSync } from "node:fs";
const file = process.argv[2];
const text = readFileSync(file, "utf8");
const lines = text.split("\n");
// A file ending in "\n" splits into a trailing "" that is not a line of the last node.
if (lines.length && lines[lines.length - 1] === "") lines.pop();
const nodes = [];
let cur = null;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.startsWith("### ")) { cur = { line: i + 1, heading: l, body: [] }; nodes.push(cur); continue; }
  if (cur) cur.body.push(l);
}
const rows = nodes.map((n) => {
  const chunk = [n.heading, ...n.body].join("\n") + "\n";
  const status = n.body.find((l) => l.startsWith("Status:")) ?? "";
  return { bytes: Buffer.byteLength(chunk), chars: chunk.length, line: n.line, name: n.heading.slice(4).split(":")[0], status: status.replace(/\*/g, "").slice(0, 70) };
});
rows.sort((a, b) => b.bytes - a.bytes);
console.log("bytes\tchars\tline\tname\tstatus(70)");
for (const r of rows) console.log(`${r.bytes}\t${r.chars}\t${r.line}\t${r.name}\t${r.status}`);
const pre = lines.slice(0, nodes[0].line - 1).join("\n") + "\n";
console.log(`\npreamble bytes=${Buffer.byteLength(pre)} nodes=${rows.length} sumNodes=${rows.reduce((a, r) => a + r.bytes, 0)} file=${Buffer.byteLength(text)}`);
