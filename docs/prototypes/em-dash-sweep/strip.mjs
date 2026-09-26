// Strip every em dash from the tracked tree, deterministically, keeping the
// line count of every file identical (the build log is linked by line anchor).
//
//   node strip.mjs                  dry run: stats + residue to stdout
//   node strip.mjs --write <dir>    write the rewritten files into a mirror tree;
//                                   diff -u per file, then git apply (see README)
//
// Rules (markdown first, code second) are documented inline. Anything the rules
// do not cover is printed as RESIDUE for a hand pass.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { githubAnchors } from "../../../packages/reference/render/how-built.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const WRITE = process.argv.includes("--write");
const EM = "\u2014";

// Files the sweep must not touch, and why.
const KEEP = [
  /^pnpm-lock\.yaml$/,
  /^packages\/reference\/test\/fixtures\/github-heading-anchors\.json$/, // evidence of GitHub's slug rule for em-dash headings
  /^workers\/front\/lab\/receipts\/.*\.json$/, // minted receipts: Rob's call
  /^workers\/front\/test\/fixtures\/publish\/(receipts|chrome-constants)\//, // generated: regenerate from generate.mjs
  /^packages\/reference\/surfaces\/(?!sample\/).*\.html$/, // masters: regenerate from render/build.mjs (sample/ is hand-pinned)
  /^packages\/reference\/test\/reference\.test\.ts$/, // pins GitHub's slug rule for em-dash headings (evidence)
  /^tools\/snapshot-capture\/crate\//, // frozen snapshot (ADR-0002): Discogs' own copy, hashed
  /^tools\/snapshot-fixture\/snapshot\//, // generated: regenerate from its generate.mjs (pinned PRNG, byte-stable)
  /\.(png|jpe?g|gif|webp|avif|woff2?|ttf|otf|ico|pdf|zip|gz|br|mp4|webm)$/i,
];

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((f) => !KEEP.some((re) => re.test(f)));

const isMd = (f) => f.endsWith(".md");

// Sentence-lead words after which the dash reads as a clause break, so the
// break becomes a full stop and the next word is capitalised.
const SENTENCE_LEAD = /^(it|its|it's|this|these|those|there|there's|they|we|you|i|nothing|none|everything|each|both|neither|either|nobody|no one|what|here)\b/i;

function capitalize(s) {
  return s.replace(/^[a-z]/, (c) => c.toUpperCase());
}

/** Replace one ` \u2014 ` occurrence given the text after it (to end of sentence). */
function singleDash(after) {
  const m = after.match(SENTENCE_LEAD);
  if (m && /^[a-z]/.test(after)) return { sep: ". ", cap: true };
  return { sep: ", ", cap: false };
}

/**
 * Prose rule for one line: pairs inside a sentence become commas; a lone dash
 * becomes a comma, or a full stop when what follows reads as a new sentence.
 */
function prose(line) {
  if (!line.includes(` ${EM} `)) return line;
  // Split into sentence spans at ". " / "! " / "? " / "; " / ": " (rough).
  const spans = line.split(/(?<=[.!?;:]) (?=[A-Z`*"“(\d])/);
  return spans
    .map((span) => {
      const n = span.split(` ${EM} `).length - 1;
      if (n === 0) return span;
      if (n >= 2) return span.replaceAll(` ${EM} `, ", ");
      const i = span.indexOf(` ${EM} `);
      const before = span.slice(0, i);
      const after = span.slice(i + 3);
      const { sep, cap } = singleDash(after);
      return before + sep + (cap ? capitalize(after) : after);
    })
    .join(" ");
}

const LABEL_BULLET = /^(\s*(?:[-*+]|\d+\.)\s+(?:\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)))( ?\u2014 )/;
const STATUS = /^(Status:\s*\*\*[^*]+\*\*) \u2014 /;

function markdownLine(line, prev) {
  let out = line;
  let prevOut = prev;
  // Table cell that is only a dash: a placeholder for "no value".
  if (/^\s*\|/.test(out)) out = out.replace(/\|\s*\u2014\s*(?=\|)/g, "| – ");
  // Heading: first dash is a colon, the rest commas.
  if (/^#{1,6}\s/.test(out) && out.includes(` ${EM} `)) {
    out = out.replace(` ${EM} `, ": ").replaceAll(` ${EM} `, ", ");
  }
  // Status line of a decision-map node: verdict, full stop, narrative.
  if (STATUS.test(out)) {
    out = out.replace(STATUS, (_, v) => `${v}. `);
    out = out.replace(/^(Status:\s*\*\*[^*]+\*\*\. )([a-z])/, (_, a, c) => a + c.toUpperCase());
  }
  // Label bullets: "- **Label** \u2014 text" reads as a definition.
  out = out.replace(LABEL_BULLET, "$1: ");
  // Wrapped continuation that starts with the dash: join to the line above.
  const lead = out.match(/^(>\s*)?\u2014 (.*)$/);
  if (lead && prevOut !== undefined && prevOut.trim() !== "") {
    out = (lead[1] ?? "") + lead[2];
    if (!/[,.;:!?]$/.test(prevOut)) prevOut = prevOut + ",";
  }
  // Wrapped line that ends with the dash.
  out = out.replace(/ \u2014$/, (m, off) => (/[,.;:!?]$/.test(out.slice(0, off)) ? "" : ","));
  out = prose(out);
  return [out, prevOut];
}

function codeLine(line) {
  let out = line;
  // Placeholder glyph in a cell or a string.
  out = out.replace(/>\u2014</g, ">–<").replace(/(["'`])\u2014\1/g, "$1–$1");
  // Banner / bullet glyphs in strings: `"\u2014 X \u2014"`, `"\u2014 "`, `` `\u2014 text` ``.
  out = out.replace(/(["'`])\u2014 (.*?) \u2014\1/g, "$1-- $2 --$1").replace(/(["'`])\u2014 /g, "$1- ").replace(/ \u2014(["'`])/g, ":$1");
  out = out.replace(/ \u2014$/, ",");
  out = prose(out);
  return out;
}

const stats = { files: 0, replaced: 0, residueLines: [] };
const anchorMaps = new Map(); // md path -> Map(oldSlug -> newSlug)
const outputs = new Map(); // path -> new content

for (const f of tracked) {
  const abs = join(ROOT, f);
  let buf;
  try {
    buf = readFileSync(abs);
  } catch {
    continue;
  }
  if (buf.includes(0)) continue; // binary
  const src = buf.toString("utf8");
  if (!Buffer.from(src, "utf8").equals(buf)) continue; // not valid UTF-8: binary
  if (!src.includes(EM)) continue;
  const before = (src.match(/\u2014/g) ?? []).length;
  const lines = src.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (isMd(f)) {
      const [l, p] = markdownLine(lines[i], out[i - 1]);
      if (i > 0) out[i - 1] = p;
      out.push(l);
    } else {
      out.push(codeLine(lines[i]));
    }
  }
  const next = out.join("\n");
  if (next.split("\n").length !== lines.length) throw new Error(`line count changed: ${f}`);
  const after = (next.match(/\u2014/g) ?? []).length;
  stats.files++;
  stats.replaced += before - after;
  if (after > 0) {
    out.forEach((l, i) => {
      if (l.includes(EM)) stats.residueLines.push(`${f}:${i + 1}: ${l.trim().slice(0, 140)}`);
    });
  }
  if (isMd(f)) {
    const oldA = githubAnchors(src);
    const newA = githubAnchors(next);
    if (oldA.length !== newA.length) throw new Error(`heading count changed: ${f}`);
    const map = new Map();
    oldA.forEach((a, i) => {
      if (a.slug !== newA[i].slug) map.set(a.slug, newA[i].slug);
    });
    if (map.size) anchorMaps.set(f, map);
  }
  outputs.set(f, next);
}

// Anchor pass: every `<path>.md#slug`, `#slug` (same file) and GitHub blob URL
// whose slug moved is rewritten. Runs over EVERY tracked text file.
const anchorStats = { rewritten: 0, unresolved: [] };
const SLUG_REF = /((?:[\w./-]+\.md)(?:\?[^#\s)"'`]*)?|https:\/\/github\.com\/Robert-Lark\/project-matrix\/blob\/[\w.-]+\/[\w./-]+\.md(?:\?[^#\s)"'`]*)?)#([a-z0-9][a-z0-9\-_]*)/g;
const BARE_REF = /(?<=[(\s"'`])#([a-z0-9][a-z0-9\-_]*)(?=[)\s"'`,.]|$)/g;
for (const f of tracked) {
  const abs = join(ROOT, f);
  let src = outputs.get(f);
  if (src === undefined) {
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
  }
  if (!/\.md#|\/blob\/|#[a-z]/.test(src)) continue;
  let changed = false;
  let next = src.replace(SLUG_REF, (m, target, slug) => {
    if (/^#L\d+/.test(`#${slug}`)) return m;
    let path = target.replace(/\?.*$/, "");
    if (path.startsWith("https://")) path = path.replace(/^https:\/\/github\.com\/Robert-Lark\/project-matrix\/blob\/[\w.-]+\//, "");
    else path = relative(ROOT, resolve(dirname(abs), path));
    const map = anchorMaps.get(path);
    if (!map) return m;
    const to = map.get(slug);
    if (!to) {
      if (![...map.values()].includes(slug)) anchorStats.unresolved.push(`${f}: ${m}`);
      return m;
    }
    changed = true;
    anchorStats.rewritten++;
    return `${target}#${to}`;
  });
  if (isMd(f) && anchorMaps.has(f)) {
    const map = anchorMaps.get(f);
    next = next.replace(BARE_REF, (m, slug) => {
      const to = map.get(slug);
      if (!to) return m;
      changed = true;
      anchorStats.rewritten++;
      return `#${to}`;
    });
  }
  if (changed) outputs.set(f, next);
}

console.log(`files touched: ${outputs.size}; em dashes replaced: ${stats.replaced}; residue lines: ${stats.residueLines.length}`);
console.log(`anchors rewritten: ${anchorStats.rewritten}; unresolved: ${anchorStats.unresolved.length}`);
for (const u of anchorStats.unresolved) console.log(`UNRESOLVED ${u}`);
for (const r of stats.residueLines) console.log(`RESIDUE ${r}`);
console.log(`moved-anchor files: ${[...anchorMaps.keys()].length}`);

if (WRITE) {
  // Write into a mirror tree; the patch is made with diff and applied with git.
  const { mkdirSync } = await import("node:fs");
  const OUT = process.argv[process.argv.indexOf("--write") + 1];
  for (const [f, content] of outputs) {
    mkdirSync(dirname(join(OUT, f)), { recursive: true });
    writeFileSync(join(OUT, f), content);
  }
  console.log(`mirror written: ${OUT}`);
}
