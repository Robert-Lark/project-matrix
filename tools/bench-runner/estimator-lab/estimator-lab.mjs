// Estimator lab for bench-instrumentation-dilution: compute candidate
// attribution estimators on the three real delivery shapes served by the
// deployed plane, plus two validity probes:
//   A. chrome-swap invariance — the recorded defect (astro 0.42→0.37 KB when
//      the chrome grew) must not survive the chosen estimator;
//   B. external recovery — an inlined copy of cart.js should attribute close
//      to what the identical file costs when served externally (its actual
//      Cloudflare wire bytes), since cross-variant comparability of exactly
//      that choice is what the JS cell exists for.
import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { readFileSync } from "node:fs";

const DIR = new URL("./bodies/", import.meta.url).pathname;
const read = (n) => readFileSync(DIR + n);
const dec = (n) => brotliDecompressSync(read(n)).toString("utf8");

const br = (s, q) =>
  brotliCompressSync(Buffer.from(s, "utf8"), {
    params: { [constants.BROTLI_PARAM_QUALITY]: q },
  }).length;

// ── Region segmentation: EXACTLY decomposeDocument's boundaries ──────────
const EXECUTABLE = new Set(["", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript", "module"]);
function parseAttrs(attrs) {
  const out = new Map();
  const re = /([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const m of attrs.matchAll(re)) {
    const name = m[1].toLowerCase();
    if (!out.has(name)) out.set(name, m[3] ?? m[4] ?? m[5] ?? "");
  }
  return out;
}
// Returns ordered segments [{label, text}] with label in html/js/data/instr.
function segment(body) {
  const marks = []; // {start, end, label}
  for (const m of body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = parseAttrs(m[1] ?? "");
    const src = attrs.get("src");
    let label;
    if (src !== undefined) {
      if (src.includes("/_pm/")) label = "instr";
      else continue; // external variant tag stays html
    } else {
      const type = (attrs.get("type") ?? "").trim().toLowerCase();
      label = EXECUTABLE.has(type) ? "js" : "data";
    }
    marks.push({ start: m.index, end: m.index + m[0].length, label });
  }
  const chrome = body.match(/<aside\b[^>]*\bid="pm-chrome"[\s\S]*?<\/aside>/i);
  if (chrome) marks.push({ start: chrome.index, end: chrome.index + chrome[0].length, label: "instr" });
  for (const m of body.matchAll(/<link\b[^>]*\/_pm\/[^>]*>/gi)) {
    marks.push({ start: m.index, end: m.index + m[0].length, label: "instr" });
  }
  marks.sort((a, b) => a.start - b.start);
  for (let i = 1; i < marks.length; i++) {
    if (marks[i].start < marks[i - 1].end) throw new Error("overlapping regions");
  }
  const segs = [];
  let pos = 0;
  for (const mk of marks) {
    if (mk.start > pos) segs.push({ label: "html", text: body.slice(pos, mk.start) });
    segs.push({ label: mk.label, text: body.slice(mk.start, mk.end) });
    pos = mk.end;
  }
  if (pos < body.length) segs.push({ label: "html", text: body.slice(pos) });
  return segs;
}
const PARTS = ["html", "js", "data", "instr"];
const concatOf = (segs, labels) => segs.filter((s) => labels.has(s.label)).map((s) => s.text).join("");
const uncompressed = (segs) => {
  const u = { html: 0, js: 0, data: 0, instr: 0 };
  for (const s of segs) u[s.label] += Buffer.byteLength(s.text, "utf8");
  return u;
};

// Largest-remainder apportion of T by weights (exactly the shipped Hamilton).
function apportion(T, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return weights.map(() => 0);
  const shares = weights.map((w) => (T * w) / total);
  const out = shares.map((s) => Math.floor(s));
  let leftover = T - out.reduce((a, b) => a + b, 0);
  const byFrac = shares.map((s, i) => ({ i, frac: s - Math.floor(s) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < leftover; k++) out[byFrac[k].i] += 1;
  return out;
}

// ── Estimators: return {html, js, data, instr} attributing T ─────────────
function E0(segs, T) {
  const u = uncompressed(segs);
  const vals = apportion(T, PARTS.map((p) => u[p]));
  return Object.fromEntries(PARTS.map((p, i) => [p, vals[i]]));
}
function E1(segs, T, q) {
  const w = PARTS.map((p) => {
    const c = concatOf(segs, new Set([p]));
    return c.length === 0 ? 0 : br(c, q);
  });
  const vals = apportion(T, w);
  return Object.fromEntries(PARTS.map((p, i) => [p, vals[i]]));
}
function E2(segs, T, q) {
  const full = br(concatOf(segs, new Set(PARTS)), q);
  const w = PARTS.map((p) => {
    const without = concatOf(segs, new Set(PARTS.filter((x) => x !== p)));
    const u = uncompressed(segs);
    if (u[p] === 0) return 0;
    return Math.max(0, full - br(without, q));
  });
  const vals = apportion(T, w);
  return Object.fromEntries(PARTS.map((p, i) => [p, vals[i]]));
}
function E3(segs, T, q) {
  const u = uncompressed(segs);
  const present = PARTS.filter((p) => u[p] > 0);
  const n = present.length;
  const v = new Map(); // bitmask over `present` -> compressed size
  for (let mask = 0; mask < 1 << n; mask++) {
    const labels = new Set(present.filter((_, i) => mask & (1 << i)));
    const c = concatOf(segs, labels);
    v.set(mask, c.length === 0 ? 0 : br(c, q));
  }
  const fact = [1, 1, 2, 6, 24];
  const phi = present.map(() => 0);
  for (let i = 0; i < n; i++) {
    for (let mask = 0; mask < 1 << n; mask++) {
      if (mask & (1 << i)) continue;
      const s = mask.toString(2).split("").filter((c) => c === "1").length;
      const weight = (fact[s] * fact[n - s - 1]) / fact[n];
      phi[i] += weight * (v.get(mask | (1 << i)) - v.get(mask));
    }
  }
  const w = PARTS.map((p) => {
    const idx = present.indexOf(p);
    return idx === -1 ? 0 : Math.max(0, phi[idx]);
  });
  const vals = apportion(T, w);
  return Object.fromEntries(PARTS.map((p, i) => [p, vals[i]]));
}

// ── Calibration: which q best reproduces the observed wire body ──────────
function calibrate(body, wire) {
  let best = { q: 11, diff: Infinity, size: 0 };
  const table = [];
  for (let q = 0; q <= 11; q++) {
    const size = br(body, q);
    table.push({ q, size });
    const diff = Math.abs(size - wire);
    if (diff < best.diff) best = { q, diff, size };
  }
  return { best, table };
}

const fmt = (o) => PARTS.map((p) => `${p}=${o[p]}`).join(" ");

function analyse(name, body, wire) {
  const segs = segment(body);
  const u = uncompressed(segs);
  const { best, table } = calibrate(body, wire);
  console.log(`\n═══ ${name} ═══ decoded=${Buffer.byteLength(body)} wire=${wire}`);
  console.log(`uncompressed regions: ${fmt(u)}`);
  console.log(`calibration: ${table.map((t) => `q${t.q}:${t.size}`).join(" ")}`);
  console.log(`→ q*=${best.q} (${best.size} B, off by ${best.size - wire >= 0 ? "+" : ""}${best.size - wire} = ${((100 * (best.size - wire)) / wire).toFixed(1)}%)`);
  const rows = [
    ["E0 uncomp-share      ", E0(segs, wire)],
    ["E1 isolated q11      ", E1(segs, wire, 11)],
    [`E1 isolated q${best.q}       `, E1(segs, wire, best.q)],
    ["E2 leave-one-out q11 ", E2(segs, wire, 11)],
    [`E2 leave-one-out q${best.q}  `, E2(segs, wire, best.q)],
    ["E3 shapley q11       ", E3(segs, wire, 11)],
    [`E3 shapley q${best.q}        `, E3(segs, wire, best.q)],
  ];
  for (const [label, r] of rows) console.log(`${label} ${fmt(r)}`);
  return { segs, u, qstar: best.q };
}

// ── The three real shapes ────────────────────────────────────────────────
const astro = dec("astro-editorial.br");
const vanilla = dec("vanilla-editorial.br");
const qwik = dec("qwik-editorial.br");
const wires = {
  astro: read("astro-editorial.br").length,
  vanilla: read("vanilla-editorial.br").length,
  qwik: read("qwik-editorial.br").length,
};
const A = analyse("astro (inlined)", astro, wires.astro);
analyse("vanilla (external-single)", vanilla, wires.vanilla);
analyse("qwik (external-many + qwik/json)", qwik, wires.qwik);

// Ticket cross-checks on astro at q11: isolated bundle ratio + sum ratio.
const astroJs = concatOf(A.segs, new Set(["js"]));
console.log(`\nastro inline bundle: ${Buffer.byteLength(astroJs)} B raw, isolated q11 ${br(astroJs, 11)} B (${(Buffer.byteLength(astroJs) / br(astroJs, 11)).toFixed(2)}x)`);
const isoSum = PARTS.reduce((s, p) => {
  const c = concatOf(A.segs, new Set([p]));
  return s + (c.length ? br(c, 11) : 0);
}, 0);
console.log(`sum of isolated q11 parts: ${isoSum} = ${(isoSum / wires.astro).toFixed(3)}x of wire`);

// ── Probe A: chrome-swap invariance (the recorded defect's shape) ────────
const pdpAside = dec("vanilla-pdp.br").match(/<aside\b[^>]*\bid="pm-chrome"[\s\S]*?<\/aside>/i)[0];
const popAside = astro.match(/<aside\b[^>]*\bid="pm-chrome"[\s\S]*?<\/aside>/i)[0];
const astroEmpty = astro.replace(popAside, pdpAside);
const astroNoChrome = astro.replace(popAside, "");
console.log(`\n─── Probe A: astro JS cell as the chrome changes (empty PDP aside=${Buffer.byteLength(pdpAside)} B vs populated=${Buffer.byteLength(popAside)} B) ───`);
console.log("T is simulated as brotli(doc, q*) both sides so only the estimator moves.");
for (const [label, fn] of [
  ["E0", (s, T) => E0(s, T)],
  ["E1 q11", (s, T) => E1(s, T, 11)],
  [`E1 q${A.qstar}`, (s, T) => E1(s, T, A.qstar)],
  ["E2 q11", (s, T) => E2(s, T, 11)],
  [`E2 q${A.qstar}`, (s, T) => E2(s, T, A.qstar)],
  ["E3 q11", (s, T) => E3(s, T, 11)],
  [`E3 q${A.qstar}`, (s, T) => E3(s, T, A.qstar)],
]) {
  const out = [];
  for (const [state, doc] of [["populated", astro], ["empty", astroEmpty], ["none", astroNoChrome]]) {
    const T = br(doc, A.qstar);
    out.push(`${state}:${fn(segment(doc), T).js}`);
  }
  const [p, e] = out.map((s) => parseInt(s.split(":")[1], 10));
  console.log(`${label.padEnd(8)} js → ${out.join("  ")}   drift pop→empty: ${(((e - p) / p) * 100).toFixed(1)}%`);
}

// ── Probe B: external recovery (vanilla + inlined cart.js) ───────────────
const cartWire = read("cart-js.br").length;
const cartSrc = dec("cart-js.br");
const vanillaInlined = vanilla.replace("</body>", `<script>${cartSrc}</script></body>`);
console.log(`\n─── Probe B: inline a copy of cart.js into vanilla — JS attribution vs the file's real external wire cost ───`);
console.log(`cart.js: ${Buffer.byteLength(cartSrc)} B raw, served externally at ${cartWire} B br (Cloudflare); isolated local q11=${br(cartSrc, 11)} q5=${br(cartSrc, 5)} q4=${br(cartSrc, 4)}`);
const segsB = segment(vanillaInlined);
for (const [label, r] of [
  ["E0", E0(segsB, br(vanillaInlined, A.qstar))],
  ["E1 q11", E1(segsB, br(vanillaInlined, A.qstar), 11)],
  [`E1 q${A.qstar}`, E1(segsB, br(vanillaInlined, A.qstar), A.qstar)],
  ["E2 q11", E2(segsB, br(vanillaInlined, A.qstar), 11)],
  [`E2 q${A.qstar}`, E2(segsB, br(vanillaInlined, A.qstar), A.qstar)],
  ["E3 q11", E3(segsB, br(vanillaInlined, A.qstar), 11)],
  [`E3 q${A.qstar}`, E3(segsB, br(vanillaInlined, A.qstar), A.qstar)],
]) {
  const errPct = (((r.js - cartWire) / cartWire) * 100).toFixed(1);
  console.log(`${label.padEnd(8)} js=${r.js}  vs external ${cartWire}  (${errPct}%)`);
}
