// Writes node-bytes-2026-09-25.md beside this file from two runs of
// node-bytes.mjs — the map at the base commit (git show) and the map on
// disk — so the record is regenerated, never re-typed.
//   node docs/prototypes/decision-map-compaction/node-bytes-table.mjs [base=f66d464]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const base = process.argv[2] ?? "f66d464";
const COMPACTED = ["editorial-build", "bench-accounting-fix", "editorial-bench-batch", "bench-instrumentation-dilution", "pdp-build", "pdp-controls", "interaction-registry", "how-it-was-built", "checkout-vanilla", "plp-react-next", "plp-htmx", "plp-data-plane", "security-floor", "checkout-measure-prep", "workers-hardening", "a11y-section"];
const beforeText = execFileSync("git", ["-C", repo, "show", `${base}:docs/decision-map.md`], { encoding: "utf8", maxBuffer: 1 << 24 });
const afterText = readFileSync(join(repo, "docs", "decision-map.md"), "utf8");
const table = (text) => execFileSync("node", [join(here, "node-bytes.mjs"), "/dev/stdin"], { input: text, encoding: "utf8", maxBuffer: 1 << 24 });
const rows = (out) => out.split("\n").slice(1).filter((l) => /^\d+\t/.test(l)).map((l) => { const [b, , line, name, status] = l.split("\t"); return { bytes: +b, line: +line, name, status: status ?? "" }; });
const verdict = (s) => { const bare = s.replace(/^Status:\s*/, "").replace(/[*_`]/g, "").trimStart().toLowerCase(); return bare.split(/ — |\. |; /)[0] ?? bare; };
const isOpen = (s) => s === "" || /^(open|in[ -]progress)\b/.test(verdict(s)) || /\b(not (?:yet )?(?:built|merged|landed|verified|done|deployed)|unmerged|unbuilt|in build|in flight|sliced|prd(?:'d| published)|spec written|code[ -]complete|blocked)\b/.test(verdict(s));
const before = rows(table(beforeText)), after = rows(table(afterText));
const cap = Number(readFileSync(join(repo, "tools", "repo-checks", "test", "decision-map-node-cap.test.ts"), "utf8").match(/NODE_CAP_BYTES = (\d+)/)[1]);
const n = (x) => x.toLocaleString("en-US");
const res = (rs) => rs.filter((r) => !isOpen(r.status)).map((r) => r.bytes).sort((a, b) => a - b);
const med = (xs) => xs[(xs.length - 1) >> 1];
const byName = new Map(after.map((r) => [r.name, r]));
const maxOf = (rs) => rs.filter((r) => !isOpen(r.status)).sort((a, b) => b.bytes - a.bytes)[0];
const L = [];
L.push("# Decision-map node bytes — before and after compaction (unit 9, 2026-09-25)", "");
L.push(`Written by \`node-bytes-table.mjs\` beside this file over two runs of \`node-bytes.mjs\` (a node is its \`### \` heading line through the line before the next \`### \`, in UTF-8 bytes — the span the repo-checks leg \`decision-map-node-cap.test.ts\` measures). "Before" is the map at \`${base}\` (\`git show\`); "after" is the map on disk. Nothing here is typed: re-run \`node docs/prototypes/decision-map-compaction/node-bytes-table.mjs\` and the file is rewritten.`, "");
L.push("## Totals", "", "| measure | before | after |", "|---|---|---|");
L.push(`| \`wc -c docs/decision-map.md\` | ${n(Buffer.byteLength(beforeText))} B | ${n(Buffer.byteLength(afterText))} B |`);
L.push(`| nodes (\`grep -c '^### '\`) | ${before.length} | ${after.length} |`);
L.push(`| sum of node bytes | ${n(before.reduce((a, r) => a + r.bytes, 0))} B | ${n(after.reduce((a, r) => a + r.bytes, 0))} B |`);
L.push(`| the sixteen compacted nodes | ${n(before.filter((r) => COMPACTED.includes(r.name)).reduce((a, r) => a + r.bytes, 0))} B | ${n(after.filter((r) => COMPACTED.includes(r.name)).reduce((a, r) => a + r.bytes, 0))} B |`);
L.push(`| largest RESOLVED node | ${n(maxOf(before).bytes)} B (\`${maxOf(before).name}\`) | ${n(maxOf(after).bytes)} B (\`${maxOf(after).name}\`) |`);
L.push(`| median RESOLVED node | ${n(med(res(before)))} B | ${n(med(res(after)))} B |`);
L.push(`| resolved / open nodes | ${res(before).length} / ${before.length - res(before).length} | ${res(after).length} / ${after.length - res(after).length} |`);
L.push(`| cap (\`NODE_CAP_BYTES\`) | — | ${n(cap)} B |`);
L.push("", "## Per node, sorted by size before", "", "| node | status class | before | after | compacted |", "|---|---|---|---|---|");
for (const r of before) { const a = byName.get(r.name); L.push(`| \`${r.name}\` | ${isOpen(r.status) ? "open (exempt)" : "resolved"} | ${n(r.bytes)} | ${a ? n(a.bytes) : "—"} | ${COMPACTED.includes(r.name) ? "yes" : "—"} |`); }
L.push("", `Open nodes (exempt from the cap, untouched by this unit): ${after.filter((r) => isOpen(r.status)).map((r) => `\`${r.name}\``).join(", ")}.`, "");
writeFileSync(join(here, "node-bytes-2026-09-25.md"), L.join("\n"));
console.log(`node-bytes-2026-09-25.md rewritten: before ${Buffer.byteLength(beforeText)} B, after ${Buffer.byteLength(afterText)} B, largest resolved after ${maxOf(after).bytes} B (${maxOf(after).name}), median ${med(res(after))} B`);
