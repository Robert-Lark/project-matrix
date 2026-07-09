# workers/

The Cloudflare Workers that compose the canonical plane (ADR-0004 §2):

- `front` — the front routing Worker: path-prefix dispatch over service bindings,
  chrome injection, the `/_pm/*` instrumentation path (issue #3).
- `edge` — the data plane: R2 read API, KV warm tier, image serving, beacon
  collection (issue #4).

Empty in this slice.
