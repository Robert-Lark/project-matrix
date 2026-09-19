// KV key-space ceiling for the PLP warm tier — MEASURED with the real query
// module for the adopted policy (n ∈ {24,240}); counted exactly and bytes
// ESTIMATED (lifted-set facet rule + applied) for the rejected n-free policy.
//   cacheable ⇔ q absent ∧ n ∈ warmed ∧ page ≤ totalPages (of the filtered set)
//   → keys exist only for NON-EMPTY (genre?,style?,format?) combos × 6 sorts × real pages.
// Usage: node docs/prototypes/plp-data-plane/kv-ceiling.mjs <snapshot dir>
import { readFileSync } from "node:fs";
import { applyPlpQuery, facetValueSets, PLP_SORTS } from "../../../packages/reference/render/plp-query.mjs";

const dir = process.argv[2];
const summaries = JSON.parse(readFileSync(`${dir}/summaries.json`, "utf8"));
const sets = facetValueSets(summaries);
const opts = (set) => [null, ...set];
const SORTS = [null, ...PLP_SORTS];
const WARMED = [24, 240];
const ALL_N = Array.from({ length: 240 }, (_, i) => i + 1);

let combos = 0;
let knobKeys = 0, knobBytes = 0, knobMaxKeyBytes = 0;
let freeKeys = 0, freeBytes = 0;
const enc = new TextEncoder();
const keyOf = (q) => {
  const p = new URLSearchParams();
  p.set("n", String(q.n)); p.set("page", String(q.page));
  for (const k of ["genre", "style", "format"]) if (q[k] !== null) p.set(k, q[k]);
  if (q.sort !== null) p.set("sort", q.sort);
  return `v2:/api/plp?${p.toString()}`;
};

for (const genre of opts(sets.genre)) for (const style of opts(sets.style)) for (const format of opts(sets.format)) {
  const probe = applyPlpQuery(summaries, { n: 240, page: 1, genre, style, format, sort: null, q: null });
  if (probe.total === 0) continue;
  combos++;
  const T = probe.total;
  // Adopted policy: build every payload and measure its bytes exactly.
  for (const sort of SORTS) for (const n of WARMED) {
    const pages = Math.ceil(T / n);
    for (let page = 1; page <= pages; page++) {
      const payload = applyPlpQuery(summaries, { n, page, genre, style, format, sort, q: null });
      const key = keyOf({ n, page, genre, style, format, sort });
      knobKeys++;
      knobBytes += enc.encode(JSON.stringify(payload)).length;
      knobMaxKeyBytes = Math.max(knobMaxKeyBytes, enc.encode(key).length);
    }
  }
  // Rejected policy (n free 1..240): exact key count; bytes from one measured
  // page-1 payload per sort (facets identical across pages; items ~ avg).
  const facetsAndApplied = enc.encode(JSON.stringify({ facets: probe.facets, applied: probe.applied })).length + 80;
  const avgItem = probe.items.reduce((a, s) => a + enc.encode(JSON.stringify(s)).length + 1, 0) / probe.items.length;
  for (const _sort of SORTS) {
    for (const n of ALL_N) {
      const pages = Math.ceil(T / n);
      freeKeys += pages;
      freeBytes += T * avgItem + pages * facetsAndApplied;
    }
  }
}

const usd = (x) => `$${x.toFixed(2)}`;
const gb = (b) => `${(b / 1e9).toFixed(3)} GB`;
console.log(JSON.stringify({
  snapshot: dir, releases: summaries.length,
  facetValues: { genre: sets.genre.size, style: sets.style.size, format: sets.format.size },
  nonEmptyFilterCombos: combos,
  adopted_n_in_24_240: {
    keys: knobKeys, storage: gb(knobBytes), avgValueBytes: Math.round(knobBytes / knobKeys), maxKeyBytes: knobMaxKeyBytes,
    fullEnumerationWrites: usd(knobKeys / 1e6 * 5), storagePerMonth: usd(knobBytes / 1e9 * 0.5),
  },
  rejected_n_free_1_240: {
    keys: freeKeys, storageEstimate: gb(freeBytes),
    fullEnumerationWrites: usd(freeKeys / 1e6 * 5), storagePerMonth: usd(freeBytes / 1e9 * 0.5),
  },
}, null, 2));
