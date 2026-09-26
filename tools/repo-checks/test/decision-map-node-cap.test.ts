/**
 * The decision map stays a map (decision-map compaction, 2026-09-25; the
 * 2026-08-29 audit's priority 8, runbook unit 9).
 *
 * `docs/decision-map.md` is loaded in full into every session, and its own
 * header rule — one node per unit carrying the QUESTION, the ANSWER as
 * decisions with their tradeoffs, and what is OWED; evidence, narrative and
 * measured numbers in `build-log.md`, LINKED and never repeated — was
 * restated on 2026-08-29 because nothing enforced it and every unit since
 * the editorial build had broken it. By 2026-09-25 the file was 253,385 B
 * (35 nodes; the eleven heaviest resolved nodes 9.6–21.9 KB each, read at
 * the start of every session). This guard is the enforcement the header
 * asked for, landed with the compaction that made it satisfiable.
 *
 * The rule: a RESOLVED node is at most NODE_CAP_BYTES, measured as the
 * heading line through the line before the next `### ` (UTF-8 bytes, the
 * span `awk` over `^### ` boundaries reports). OPEN nodes are exempt: active
 * work grows its node until it resolves, and the header's rule is about what
 * a node keeps once the account of the work has gone to the log.
 *
 * Which is which is a CHECKED VOCABULARY, not a guess (verify-slice,
 * correctness lens: the map's own history holds `PRD published`, `sliced`,
 * `SPEC WRITTEN, NOT BUILT`, `CODE COMPLETE, NOT MERGED`, `in-progress`, all
 * of them active work). The `Status:` line's leading clause — up to its first
 * ` — `, `. ` or `; ` — is read: it is OPEN when it begins `open` or
 * `in progress`, or names an in-flight state (`not yet built`, `not merged`,
 * `unmerged`, `in build`, `sliced`, `PRD published`, `spec written`, `code
 * complete`, `blocked`); it is RESOLVED when it carries a settled word
 * (`resolved`, `merged`, `closed`, `landed`, `built`, `deployed`, `done`,
 * `shipped`); a clause that says neither FAILS the leg by name, so a status
 * cannot fall into the exemption by using a word nobody classified.
 *
 * The cap is derived, not chosen — see NODE_CAP_BYTES.
 *
 * Non-vacuity, four ways: zero resolved nodes FAILS (an empty set passes
 * every cap); the exemption cannot swallow the rule (open nodes must be the
 * minority); every node names a status except the ones listed by name; and
 * the classifier, the cap and the header/pointer legs are proven live
 * against literal fixtures. A stated limit: the exemption trusts the
 * `Status:` line the way every registry guard here trusts its registry —
 * flipping a resolved node to `open` to dodge the cap is a one-line diff on
 * a status line, which a reviewer reads (sabotage row N4 records the miss).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const MAP = join(repoRoot, "docs", "decision-map.md");
const LOG = join(repoRoot, "docs", "build-log.md");

/**
 * NODE_CAP_BYTES — derived on 2026-09-25 from the compacted file: 7,168 B (7 KiB). The largest RESOLVED node after compaction is 6,707 B (`checkout-measure-prep`, whose six changes each carry a rejected alternative and a stated cost — the first cap tried, 6 KiB, would have forced dropping those, and a cap that removes decisions is the wrong cap); 7 KiB is the smallest whole KiB above it, leaving 461 B there. Of the sixteen nodes this unit compacted, 15 would fail it at their pre-compaction size (6,365–21,937 B; the exception, `how-it-was-built` at 6,365 B, was compacted for the same reason and sits at 4,486 B). The median resolved node after compaction is 4,113 B, so the cap is about 1.7× the median. Bytes here are what `splitNodes` measures: the heading line through the blank line before the next `### `, UTF-8. Numbers from `docs/prototypes/decision-map-compaction/node-bytes-2026-09-25.md` (derived by its `node-bytes.mjs`, never typed).
 */
export const NODE_CAP_BYTES = 7168;

/**
 * PREAMBLE_CAP_BYTES — everything before the first `### ` (the header, Notes,
 * the matrix table, the Tickets lead). The skeptic lens pasted 20 KB of prose
 * under `## Notes` and every leg stayed green: the node cap never read that
 * region. Derived the same way: 7,655 B on 2026-09-26 (6,255 B before this
 * unit; the header's third paragraph is the growth) → the smallest whole KiB
 * above it, 8 KiB, 537 B of headroom. A decision that belongs in the header
 * fits; narrative does not.
 */
export const PREAMBLE_CAP_BYTES = 8192;

/** Nodes allowed to carry no `Status:` line, by exact key. */
const NO_STATUS_BY_DESIGN = ["(fog) remaining per-surface builds"];

const OPEN_LEAD = /^(open|in[ -]progress)\b/;
const OPEN_WORDS = /\b(not (?:yet )?(?:built|merged|landed|verified|done|deployed)|unmerged|unbuilt|in build|in flight|sliced|prd(?:'d| published)|spec written|code[ -]complete|blocked)\b/;
const RESOLVED_WORDS = /\b(resolved|merged|closed|landed|built|deployed|done|shipped)\b/;

export type MapNode = { key: string; heading: string; line: number; status: string | null; bytes: number };

/** Bytes before the first `### ` line (the whole file when there is none). */
export function preambleBytes(markdown: string): number {
  const i = markdown.search(/^### /m);
  return Buffer.byteLength(i < 0 ? markdown : markdown.slice(0, i), "utf8");
}
export type StatusClass = "open" | "resolved" | "unclassified";

/** One node = its `### ` heading line through the line before the next `### `. */
export function splitNodes(markdown: string): MapNode[] {
  const lines = markdown.split("\n");
  // A file that ends in "\n" splits into a trailing "" that is not a line of
  // the last node (it would count one byte twice — verify-slice).
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const nodes: MapNode[] = [];
  let cur: { key: string; heading: string; line: number; body: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const chunk = [cur.heading, ...cur.body].join("\n") + "\n";
    const status = cur.body.find((l) => l.startsWith("Status:")) ?? null;
    nodes.push({ key: cur.key, heading: cur.heading, line: cur.line, status, bytes: Buffer.byteLength(chunk, "utf8") });
  };
  lines.forEach((l, i) => {
    if (l.startsWith("### ")) {
      flush();
      cur = { key: (l.slice(4).split(":")[0] ?? "").trim(), heading: l, line: i + 1, body: [] };
    } else if (cur) cur.body.push(l);
  });
  flush();
  return nodes;
}

/** The status's leading clause, markdown emphasis stripped, lower-cased. */
export function statusVerdict(status: string): string {
  const bare = status.replace(/^Status:\s*/, "").replace(/[*_`]/g, "").trimStart().toLowerCase();
  return bare.split(/ — |\. |; /)[0] ?? bare;
}

export function classify(status: string | null): StatusClass {
  if (status === null) return "open";
  const v = statusVerdict(status);
  if (OPEN_LEAD.test(v) || OPEN_WORDS.test(v)) return "open";
  if (RESOLVED_WORDS.test(v)) return "resolved";
  return "unclassified";
}

export function overCap(nodes: MapNode[], cap: number): MapNode[] {
  return nodes.filter((n) => classify(n.status) === "resolved" && n.bytes > cap);
}

/**
 * Every form a Status line may quote a log heading in: the heading's text
 * after its `#`s, with or without a leading `Phase N — ` / `Phase N.M — `
 * and with or without a trailing ` (date…)` parenthetical.
 */
export function headingForms(headingLine: string): string[] {
  const text = headingLine.replace(/^#+\s+/, "").trim();
  const noPhase = text.replace(/^Phase \d+(?:\.\d+)? — /, "");
  const forms = new Set<string>();
  for (const t of [text, noPhase]) {
    forms.add(t);
    forms.add(t.replace(/\s\([^()]*\d{4}-\d{2}-\d{2}[^()]*\)$/, ""));
  }
  return [...forms];
}

const map = readFileSync(MAP, "utf8");
const nodes = splitNodes(map);

describe("the decision map stays a map: resolved nodes under the byte cap (compaction, 2026-09-25)", () => {
  it("splits the map into a real number of nodes, the same number grep -c '^### ' reports", () => {
    expect(nodes.length).toBeGreaterThan(20);
    expect(nodes.length).toBe(map.split("\n").filter((l) => l.startsWith("### ")).length);
  });

  it("every node names a status, except the ones listed by name", () => {
    const without = nodes.filter((n) => n.status === null).map((n) => n.key);
    expect(without.sort()).toEqual([...NO_STATUS_BY_DESIGN].sort());
  });

  it("every status verdict is in the vocabulary (a status cannot dodge the cap with a word nobody classified)", () => {
    const unknown = nodes.filter((n) => classify(n.status) === "unclassified").map((n) => `${n.key}: "${statusVerdict(n.status!)}"`);
    expect(unknown, "status verdicts that say neither open/in-flight nor resolved/merged/closed/landed/built/deployed/done/shipped").toEqual([]);
  });

  it("resolved nodes exist, and the open exemption is the minority (non-vacuity)", () => {
    const open = nodes.filter((n) => classify(n.status) === "open");
    const resolved = nodes.filter((n) => classify(n.status) === "resolved");
    expect(resolved.length, "zero resolved nodes would pass every cap").toBeGreaterThan(0);
    expect(open.length, `${open.length} open of ${nodes.length}: the exemption has swallowed the rule`).toBeLessThan(resolved.length);
  });

  it(`no RESOLVED node exceeds ${NODE_CAP_BYTES} B`, () => {
    const over = overCap(nodes, NODE_CAP_BYTES).map((n) => `${n.key} (${n.bytes} B at line ${n.line})`);
    expect(
      over,
      `resolved nodes over the cap — the map carries the question, the decisions with their tradeoffs and what is owed; move the narrative, the numbers and the verification record to docs/build-log.md under the node's phase (a "narrative moved from the decision map" sub-entry, verbatim) and link it from the Status line`,
    ).toEqual([]);
  });

  it(`the preamble (everything before the first \`### \`) stays under ${PREAMBLE_CAP_BYTES} B`, () => {
    const bytes = preambleBytes(map);
    expect(bytes, "an empty preamble means the header is gone").toBeGreaterThan(1000);
    expect(bytes, "the header, Notes and Tickets lead carry decisions; narrative goes to docs/build-log.md").toBeLessThanOrEqual(PREAMBLE_CAP_BYTES);
    expect(preambleBytes(`# T\n\n${"x".repeat(PREAMBLE_CAP_BYTES)}\n\n### a: b\nStatus: resolved\n`)).toBeGreaterThan(PREAMBLE_CAP_BYTES);
    expect(preambleBytes("# T\n\n### a: b\n")).toBe(Buffer.byteLength("# T\n\n"));
  });

  it("the classifier and the cap are live (literal fixtures)", () => {
    expect(classify("Status: open")).toBe("open");
    expect(classify("Status: **IN PROGRESS (2026-09-01)** — PR-1 is this commit")).toBe("open");
    expect(classify("Status: in-progress (slice B)")).toBe("open");
    expect(classify("Status: open, and **not a conformance failure** (found 2026-09-03)")).toBe("open");
    expect(classify("Status: **CODE COMPLETE, NOT MERGED** — branch x, nine commits")).toBe("open");
    expect(classify("Status: **SPEC WRITTEN, NOT BUILT** (2026-08-28)")).toBe("open");
    expect(classify("Status: PRD published (2026-07-07)")).toBe("open");
    expect(classify("Status: sliced — slices A + B landed")).toBe("open");
    expect(classify(null)).toBe("open");
    expect(classify("Status: resolved")).toBe("resolved");
    expect(classify("Status: **BUILT AND VERIFIED (2026-09-18)** — branch `x`")).toBe("resolved");
    expect(classify("Status: **MERGED — PR #35 (`ae97f8e`, 2026-08-28).**")).toBe("resolved");
    expect(classify("Status: **RESOLVED (2026-08-15)** — the opening question is closed")).toBe("resolved");
    expect(classify("Status: **ALL SIX SLICES LANDED — the editorial build is CLOSED**")).toBe("resolved");
    expect(classify("Status: **CLOSED (2026-08-17)** — ruler landed")).toBe("resolved");
    expect(classify("Status: finished")).toBe("unclassified");
    expect(classify("Status: wrapped up (2026-01-01) — nearly")).toBe("unclassified");
    // A resolved status whose PROSE mentions an in-flight word after its verdict stays resolved: only the leading clause is read.
    expect(classify("Status: **RESOLVED (2026-08-29)** — PR #39; the JS-on half the pre-merge tree left not merged ran green")).toBe("resolved");
    const pad = "x".repeat(NODE_CAP_BYTES);
    const fixture = `# T\n\n### a: resolved and fat\nStatus: resolved\n${pad}\n\n### b: open and fat\nStatus: open\n${pad}\n\n### c: resolved and thin\nStatus: **RESOLVED (2026-01-01)**\nfine\n\n### d: in flight and fat\nStatus: **CODE COMPLETE, NOT MERGED**\n${pad}\n`;
    const split = splitNodes(fixture);
    expect(overCap(split, NODE_CAP_BYTES).map((n) => n.key)).toEqual(["a"]);
    // The last node's bytes are its span, not its span plus the file's final newline.
    expect(split[split.length - 1]!.bytes).toBe(Buffer.byteLength(fixture.slice(fixture.lastIndexOf("### d"))));
  });
});

describe("the map's header and its build-log pointers stay true", () => {
  const header = map.split("\n## Notes\n")[0]!;
  const capPhrase = `${NODE_CAP_BYTES.toLocaleString("en-US")} bytes`;
  const SIZE_FIGURE = /\b\d[\d,.]*\s?(?:B|bytes?|KB|kB|KiB|MB|MiB|kilobytes|k tokens|tokens)\b/;

  it("the header names the size command and states no size figure (a figure goes stale by its own command)", () => {
    expect(header).toMatch(/git cat-file -s HEAD:docs\/decision-map\.md|wc -c docs\/decision-map\.md/);
    expect(header, `the header must state the cap it enforces ("${capPhrase}")`).toContain(capPhrase);
    expect(header.split(capPhrase).join(""), "a byte, KB or token figure in the header").not.toMatch(SIZE_FIGURE);
  });

  it("the size-figure check is live: bytes, KB, KiB and tokens are all figures; the cap sentence is not", () => {
    for (const s of ["at 253,385 bytes it is", "at ~182 KB", "247 KiB", "182 kilobytes", "roughly 45k tokens", "7,168 B"]) expect(s, s).toMatch(SIZE_FIGURE);
    expect(`over ${capPhrase}`.split(capPhrase).join("")).not.toMatch(SIZE_FIGURE);
  });

  it("every Status line that cites build-log.md quotes only titles that are headings in the log, exactly, and its moved-narrative pointer names its own node", () => {
    const forms = new Set(readFileSync(LOG, "utf8").split("\n").filter((l) => /^#{2,3} /.test(l)).flatMap(headingForms));
    const citing = nodes.filter((n) => n.status !== null && n.status.includes("build-log.md"));
    expect(citing.length, "no Status line cites build-log.md — the compacted nodes must").toBeGreaterThan(10);
    const bad: string[] = [];
    for (const n of citing) {
      const after = n.status!.slice(n.status!.indexOf("build-log.md"));
      for (const m of after.matchAll(/["“]([^"”]+)["”]/g)) {
        const q = m[1]!;
        if (!forms.has(q)) bad.push(`${n.key}: "${q}" is not the exact text of a heading in docs/build-log.md`);
        if (q.includes("narrative moved from the decision map") && !q.startsWith(`\`${n.key}\` — `)) bad.push(`${n.key}: its moved-narrative pointer names "${q.split(" — ")[0]}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every moved-narrative sub-entry in the log is pointed at by its node, and every such pointer has its sub-entry (both directions, non-empty)", () => {
    // The pointer leg above only judges quotes that EXIST: with every pointer
    // deleted from the map and every sub-entry cut from the log it stayed
    // green (verify-slice, conformance lens). This leg is the OWED
    // completeness shape: the set of nodes the log holds a sub-entry for and
    // the set of nodes whose Status cites one must be equal and non-empty.
    const inLog = new Set(
      [...readFileSync(LOG, "utf8").matchAll(/^### `([^`]+)` — narrative moved from the decision map \(\d{4}-\d{2}-\d{2}\)$/gm)].map((m) => m[1]!),
    );
    const POINTER = /^`([^`]+)` — narrative moved from the decision map \(\d{4}-\d{2}-\d{2}\)$/;
    const inMap = new Set<string>();
    const bare: string[] = [];
    for (const n of nodes) {
      if (n.status === null || !/narrative moved from the decision map/.test(n.status)) continue;
      // The pointer counts only as an exact quoted sub-entry title naming THIS node (skeptic lens: a bare, unquoted phrase naming another node passed).
      const quoted = [...n.status.matchAll(/["“]([^"”]+)["”]/g)].map((m) => m[1]!).filter((q) => POINTER.test(q));
      if (quoted.some((q) => q.match(POINTER)![1] === n.key)) inMap.add(n.key);
      else bare.push(n.key);
    }
    expect(bare, "Status lines that mention a moved narrative without quoting their own sub-entry's exact title").toEqual([]);
    expect(inLog.size, "no moved-narrative sub-entries in the log").toBeGreaterThan(0);
    expect([...inLog].filter((k) => !inMap.has(k)), "sub-entries in the log that no node's Status points at").toEqual([]);
    expect([...inMap].filter((k) => !inLog.has(k)), "Status pointers to a sub-entry the log does not carry").toEqual([]);
    expect([...inMap].filter((k) => !nodes.some((n) => n.key === k)), "pointers on nodes that do not exist").toEqual([]);
  });

  it("the pointer check is live: a fragment, a reworded title and another node's sub-entry all fail it", () => {
    const forms = new Set(["## Phase 15 — The instrument was the thing that was wrong (2026-08-28)", "### `plp-htmx` — narrative moved from the decision map (2026-09-25)"].flatMap(headingForms));
    expect(forms.has("The instrument was the thing that was wrong (2026-08-28)")).toBe(true);
    expect(forms.has("The instrument was the thing that was wrong")).toBe(true);
    expect(forms.has("Phase 15 — The instrument was the thing that was wrong (2026-08-28)")).toBe(true);
    expect(forms.has("Phase 15")).toBe(false);
    // Curly quotes are extracted too (seams lens): a “Phase 15” fragment must reach the lookup and fail it.
    const curly = [...'Narrative: `build-log.md` Phase 15, “Phase 15”; and “The instrument was the thing that was wrong (2026-08-28)”'.matchAll(/["“]([^"”]+)["”]/g)].map((m) => m[1]!);
    expect(curly).toEqual(["Phase 15", "The instrument was the thing that was wrong (2026-08-28)"]);
    expect(curly.filter((q) => !forms.has(q))).toEqual(["Phase 15"]);
    expect(forms.has("The instrument was the thing")).toBe(false);
    expect(forms.has("The instrument was the thing that was wrong (2026-08-29)")).toBe(false);
    expect(forms.has("`plp-htmx` — narrative moved from the decision map (2026-09-25)")).toBe(true);
    expect(forms.has("`plp-react-next` — narrative moved from the decision map (2026-09-25)")).toBe(false);
  });
});
