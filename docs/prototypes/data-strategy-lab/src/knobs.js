/**
 * Shared URL-knob plumbing (ADR-0004 §5: query = the measurement condition).
 * Every strategy page forwards the SAME live request modifiers to the data
 * plane — n (volume), cache (edge bypass), run (harness isolation nonce) —
 * so the only thing that differs between pages is the access pattern.
 */
export function readKnobs(search = window.location.search) {
  const q = new URLSearchParams(search);
  return {
    n: q.get("n") ?? "",
    cache: q.get("cache") ?? "",
    run: q.get("run") ?? "",
    stale: q.get("stale") ?? "", // tanstack page only: staleTime override demo
  };
}

/** Build the tray URL for one page under the current knobs. */
export function plpUrl(knobs, page) {
  const q = new URLSearchParams();
  if (knobs.n) q.set("n", knobs.n);
  q.set("page", String(page));
  if (knobs.cache) q.set("cache", knobs.cache);
  if (knobs.run) q.set("run", knobs.run);
  return `/api/plp?${q.toString()}`;
}
