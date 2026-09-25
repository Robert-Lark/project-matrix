// The cold PDP read's cost, measured (workers-hardening, unit 8; 2026-08-29
// audit priority 5, task 3). `GET /api/pdp/:id?cache=cold` fetches and
// parses the WHOLE details tray from R2 to serve one release; a warm hit
// returns from KV. This probe times both on a HELD local plane, ten each,
// against the edge Worker directly (port 8790 — the Worker whose parse it
// is; the composed origin at 8787 adds the front hop) and reports medians.
//
//   PM_SEED_DIR=tools/snapshot-capture/crate PM_HOLD=1 node tools/origin-suite/run-local.mjs
//   node docs/prototypes/workers-hardening/probe-pdp-cold.mjs [id] [origin]
//
// Node's fetch resolves when the response HEADERS arrive, so the timed
// span is time-to-first-byte from this process: the Worker's read + parse
// + find, plus loopback. The body is then read separately so the timing
// does not include streaming the (small) release payload.
const origin = process.argv[3] ?? "http://127.0.0.1:8790";
const manifest = await (await fetch(`${origin}/api/snapshot`)).json();
const summaries = await (await fetch(`${origin}/api/plp?n=1`)).json();
const id = process.argv[2] || String(summaries.items[0].id);
const run = `probe-${Date.now().toString(36)}`;

const time = async (url) => {
  const t0 = performance.now();
  const res = await fetch(url);
  const ttfb = performance.now() - t0;
  const body = await res.text();
  return { ttfb, state: res.headers.get("x-pm-cache-state"), bytes: body.length, status: res.status };
};
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[(s.length - 1) >> 1]; };
const round = (v) => Math.round(v * 10) / 10;

const cold = [];
for (let i = 0; i < 10; i++) cold.push(await time(`${origin}/api/pdp/${id}?cache=cold`));
// One priming miss under a fresh nonce, then ten hits.
const miss = await time(`${origin}/api/pdp/${id}?run=${run}`);
const warm = [];
for (let i = 0; i < 10; i++) warm.push(await time(`${origin}/api/pdp/${id}?run=${run}`));

const states = (xs) => [...new Set(xs.map((x) => x.state))].join(",");
console.log(`plane: crate "${manifest.crate}" · id ${id} · release payload ${cold[0].bytes} B`);
console.log(`cold  (?cache=cold, R2 read + whole-tray parse): states=${states(cold)} median ${round(median(cold.map((x) => x.ttfb)))} ms  min ${round(Math.min(...cold.map((x) => x.ttfb)))}  max ${round(Math.max(...cold.map((x) => x.ttfb)))}`);
console.log(`miss  (first request under a fresh ?run=): state=${miss.state} ${round(miss.ttfb)} ms`);
console.log(`warm  (KV hit):                                 states=${states(warm)} median ${round(median(warm.map((x) => x.ttfb)))} ms  min ${round(Math.min(...warm.map((x) => x.ttfb)))}  max ${round(Math.max(...warm.map((x) => x.ttfb)))}`);
console.log(`cold − warm median: ${round(median(cold.map((x) => x.ttfb)) - median(warm.map((x) => x.ttfb)))} ms`);
