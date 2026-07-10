# @pm/switcher

The contextual switcher + HUD chrome ([ADR-0004 §5–§7](../../docs/adr/0004-deployment-topology-and-contextual-switcher.md)):
the per-surface **sparse control-set config** and the **chrome HTML** the front
Worker injects into `div#pm-chrome-slot` of every variant page. Chrome is
**instrumentation** — byte-identical across variants by construction, never
part of any variant's build.

- `src/config.ts` — surface → variants map. Each real surface build registers
  its entry; singleton surfaces get no render-switcher.
- `src/chrome.ts` — the renderer: plain-anchor switcher (rewrites only the
  variant path segment; works JS-off), the HUD (`?profile=` snapshot selector
  from the `@pm/measurement` spec + the visitor's live readout), and the
  beacon tag stamps (`data-pm-*`, canonicalized via `knobTags`). Everything
  interpolated is HTML-escaped.
- `src/chrome.css` — served from `/_pm/chrome.css`; consumes the page's
  SEMANTIC tokens only (every variant loads the shared tokens by contract).

## The instrumentation-boundary contract (for issues #6 and #7)

Everything the chrome adds to a page is identifiable, by construction:

1. **Markup**: every injected byte lives INSIDE the `div#pm-chrome-slot`
   subtree (the slot element itself survives injection and wraps the chrome —
   asserted at the composed-origin seam). Exactly one slot per page is the
   page contract; the front Worker logs a `chrome-slot-count` error when a
   page violates it.
2. **Subresources**: `/_pm/chrome.css` and `/_pm/measure.js` — the reserved
   path prefix (ADR-0001 §6).
3. **Requests it emits**: `POST /api/beacon` (up to one per settled metric,
   fired on visibility-hidden by the measurement client).

**Issue #7 (bench runner) strips instrumentation as:** all `/_pm/*`
subresource bytes/requests + the `div#pm-chrome-slot` subtree's bytes within
the HTML document + `/api/beacon` requests excluded from request/byte
accounting (and from any Workers-side request/CPU harvests).

**Issue #6 (drift gate) neutralizes the chrome as:** DOM check — drop the
`div#pm-chrome-slot` subtree before normalized-DOM comparison; pixel check —
the chrome participates in normal document flow, so REMOVE or `display:none`
the slot subtree before screenshotting (region-masking is not enough — the
chrome shifts everything below it).

The reference render has no chrome slot; variants do. Both facts are part of
the contract above.
