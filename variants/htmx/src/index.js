// The htmx variant Worker: hypermedia — the server renders complete HTML per
// request (editorial-build slice E). Assets under /htmx/assets/* are served
// assets-first from dist/ and never reach this script; everything else lands
// here. The front Worker forwards the ORIGINAL request untouched, so the
// /htmx/ prefix — routes, asset URLs, redirects — is this Worker's own duty.
import {
  renderEditorialPage,
  renderPlpFragment,
  renderPlpPage,
  renderUnavailablePage,
} from "./render.mjs";
import { featuredIdFor, isFixtureCrate } from "./snapshot.mjs";

const HTML = { "content-type": "text/html; charset=utf-8" };

/** The PLP answers the SAME URL two ways — the whole document, or the
 *  `.pm-plp` partial when htmx asks (see `wantsPartial`) — so the request
 *  headers that decide are cache-key inputs. Without this a shared cache
 *  may hand a bare fragment to a cold browser navigation, or a whole
 *  document to a swap. Costs one response header; the alternative is a
 *  correctness bug that only appears once something caches. */
const HTML_VARY_HX = { ...HTML, vary: "HX-Request, HX-History-Restore-Request" };

/**
 * The partial's response headers. `x-pm-partial` is a DECLARATION, and it is
 * inert until the front Worker honours it — deliberately, because that file
 * is not this unit's to edit.
 *
 * The front Worker injects the switcher/HUD chrome into `div#pm-chrome-slot`
 * via HTMLRewriter on any `text/html` response, and asserts SLOT CARDINALITY
 * of exactly one, logging `chrome-slot-count` as an ERROR otherwise
 * (workers/front/src/index.js:147-183). A partial has no slot by design — it
 * is HTML that is not a page — so every htmx page-flip would log an error
 * against a Worker that is behaving correctly. That file already anticipates
 * this exact build: remix3's frame partials are passed through by a
 * variant-scoped path check, and the comment at :126-128 says the exception
 * is "deliberately variant-scoped … the PLP build (htmx loaders+PE) should
 * generalize this deliberately when it does."
 *
 * This is that generalization's variant half: the response DECLARES that it
 * is a partial, so the front Worker's rule can be one variant-agnostic line
 * (`if (upstream.headers.get("x-pm-partial")) return upstream;`) instead of a
 * second hardcoded path prefix, and any later surface serving partials gets
 * it for free. The exact front-Worker diff is in this unit's handoff note.
 */
const HTML_PARTIAL = { ...HTML_VARY_HX, "x-pm-partial": "1" };

/**
 * Whether THIS request wants the partial — and the second condition is not
 * defensive padding, it is the whole reason this is a function.
 *
 * htmx keeps a sessionStorage cache of visited pages so the Back button can
 * restore one without a round trip. On a cache MISS — storage blocked, the
 * quota shed, or the entry evicted past `historyCacheSize` (10) — it
 * re-fetches the URL and swaps the answer into `getHistoryElement()`, which
 * is `document.body` unless the page declares `[hx-history-elt]` (this one
 * does not), with `swapStyle: 'innerHTML'`. And it sends that request with
 * **`HX-Request: true`**, because `historyRestoreAsHxRequest` defaults to
 * true. Branching on `HX-Request` alone therefore answers a full-page
 * restore with the bare `.pm-plp` block, and htmx writes it over the entire
 * body: skip link, chrome slot, masthead, footer and every script gone,
 * leaving a grid with no navigation and no runtime for the next click.
 *
 * htmx's own config documentation says exactly this, at
 * `htmx.org@2.0.10/dist/htmx.js:277`: "This should always be disabled when
 * using HX-Request header to optionally return partial responses". The
 * disabling it refers to is a CLIENT setting
 * (`htmx.config.historyRestoreAsHxRequest = false`); the check below is the
 * server-side half, preferred because a server's correctness must not depend
 * on a client file having loaded. Both would work; only this one holds when
 * the enhancement script 404s.
 *
 * The distinguishing header is `HX-History-Restore-Request`, which htmx sets
 * unconditionally on that request (`htmx.js` `loadHistoryFromServer`) and on
 * no other.
 */
function wantsPartial(request) {
  return (
    request.headers.get("HX-Request") !== null &&
    request.headers.get("HX-History-Restore-Request") === null
  );
}

/** The host in the URL is unused by pm-edge's router (path-only dispatch);
 *  it exists only because `fetch` requires an absolute URL (the slice-B/D
 *  request-time precedent: this Worker binds pm-edge ITSELF — the front
 *  Worker's own EDGE binding does not reach a variant server-side). */
const edgeFetch = (env, path) => env.EDGE.fetch(`https://pm-edge${path}`);

/** The editorial page's whole data dependency, resolved per request: the
 *  served manifest (the dateline IS its freeze date, and its `crate` field
 *  picks the honest essay) plus the featured release's detail tray. */
async function loadEditorialData(env) {
  const manifestRes = await edgeFetch(env, "/api/snapshot");
  if (!manifestRes.ok) throw new Error(`GET /api/snapshot -> ${manifestRes.status}`);
  const manifest = await manifestRes.json();

  const id = featuredIdFor(manifest.crate);
  const detailRes = await edgeFetch(env, `/api/pdp/${id}`);
  if (!detailRes.ok) throw new Error(`GET /api/pdp/${id} -> ${detailRes.status}`);
  const featured = await detailRes.json();

  return {
    isFixture: isFixtureCrate(manifest.crate),
    capturedAt: manifest.capturedAt,
    featured,
  };
}

/**
 * The knobs this Worker forwards from the visitor's URL to the data plane,
 * and the reason the list is a WHITELIST rather than `url.search` passed
 * through.
 *
 * All four are knobs `workers/edge` actually implements
 * (`handlePlp`/`serveData`/`runKnob`, workers/edge/src/index.js:51-54,
 * 121-127), and forwarding them is not cosmetic — it is what makes this
 * arm's published numbers mean what their labels say:
 *
 *  - `cache` — the switcher preset for this surface is
 *    `/htmx/plp/?cache=cold` (ADR-0005 §2) and the bench runner sets it on
 *    every cold-column visit (tools/bench-runner/src/batch.ts:80). Dropping
 *    it would have the edge serve the KV warm tier under a column labelled
 *    cold: the server-rendered arm would read faster than it is, which is
 *    rigging in the FLATTERING direction (ADR-0001 §9).
 *  - `run` — the batch's cache-isolation nonce (batch.ts:79). Dropped, this
 *    surface's warm column would be contaminated by every previous run's KV
 *    state instead of the one priming visit the column is defined by.
 *  - `n` — the data-volume knob (`nKnob: [24, 240]`), cell 5's variable.
 *  - `page` — pagination, the one navigation the data plane implements.
 *
 * Deliberately ABSENT: the five canonical facet params ADR-0005 §5 makes
 * "the PLP build's contract" — `genre`, `style`, `format`, `sort`, `q`.
 * The edge Worker has none of them today (verified: no such parameter is
 * read anywhere in workers/edge/src/index.js), so the master's facet
 * links, search form and sort select are live markup with nothing behind
 * them. Forwarding names that would not make them work; it would only hide
 * which half is missing. The gap is reported in this unit's handoff, not
 * papered over here.
 *
 * NOTE the effective values are read back off the RESPONSE (`perPage`,
 * `page`), never re-derived here: `clampN` and the page floor live in the
 * edge Worker, and two implementations of one clamp is how the served page
 * and the beacon's environment tag come to disagree.
 */
const PLP_KNOBS = ["n", "page", "cache", "run"];

async function loadPlpData(env, url) {
  const params = new URLSearchParams();
  for (const knob of PLP_KNOBS) {
    const value = url.searchParams.get(knob);
    if (value !== null) params.set(knob, value);
  }
  const query = params.toString();
  const path = query ? `/api/plp?${query}` : "/api/plp";
  const res = await edgeFetch(env, path);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  const data = await res.json();
  assertPlpPayload(path, data);
  // The cache-state rides back out with the data — see CACHE_STATE below for
  // why dropping it would make this arm's published columns unfalsifiable.
  return { data, cacheState: res.headers.get("x-pm-cache-state") };
}

/**
 * The tray's SHAPE, checked where the data enters — because a
 * malformed-but-200 payload is the one failure this Worker's branded
 * boundary could not see.
 *
 * The editorial route already learned this: its `try` wraps the render
 * precisely so a degenerate tray throws inside the guard instead of
 * escaping as pm-front's plain-text 502. The PLP's render does NOT throw on
 * a bad payload — it interpolates. MEASURED: a payload identical to
 * `handlePlp`'s except `perPage` renamed renders a **200** page carrying
 * `Showing NaN–NaN of 240 releases` and every pagination href as
 * `?page=N&n=undefined`. Nothing throws, so the 503 never fires; `plp.js`
 * then reads that same string and announces "Showing NaN to NaN" to a
 * screen reader; and the edge clamps `n=undefined` back to 24
 * (`clampN` → `parseInt("undefined")` is NaN → `|| 24`), so a visitor on
 * `?n=240` is silently reset by clicking "2".
 *
 * The pre-merge guard cannot catch it: the test assembles this payload
 * itself, so every identity leg passes by construction whatever
 * `workers/edge` actually returns. This check holds at RUNTIME, against the
 * deployed plane, which is where the seam is.
 *
 * EXPORTED so the guard can drive it directly, and that is not incidental.
 * Driven only through `fetch`, the facets clauses are not independently
 * provable — every malformed-`facets` payload ALSO throws during template
 * interpolation, so the route answers 503 either way and a sabotage that
 * deletes those clauses produces no failure at all (measured; it is why
 * they are asserted here instead). Reached directly, each clause is a
 * defect a test can see. The numeric and `items` clauses do change the
 * route's behaviour on their own: without them a renamed key renders 200.
 */
export function assertPlpPayload(path, data) {
  const finite = (v) => typeof v === "number" && Number.isFinite(v);
  const ok =
    data !== null &&
    typeof data === "object" &&
    Array.isArray(data.items) &&
    finite(data.page) &&
    finite(data.perPage) &&
    finite(data.total) &&
    finite(data.totalPages) &&
    data.facets !== null &&
    typeof data.facets === "object" &&
    Array.isArray(data.facets.genres) &&
    Array.isArray(data.facets.styles) &&
    Array.isArray(data.facets.formats);
  if (!ok) throw new Error(`GET ${path} -> payload does not match the PLP tray contract`);
}

/**
 * ADR-0005's ONE named obligation on this Worker, quoted from its
 * Consequences section (docs/adr/0005-plp-data-strategy-comparison.md:203-205):
 *
 *   "The x-pm-cache-state **pass-through** onto server-rendered HTML is the
 *    HTMX variant Worker's obligation (proven in the prototype's loaders
 *    leg)."
 *
 * Why it is load-bearing rather than tidy. The bench runner reads the
 * DOCUMENT response's header into every receipt
 * (`tools/bench-runner/src/collect.ts:928` → `docCacheState`, schema'd at
 * `receipt.ts:51-52`). On every OTHER arm of the comparison the tray fetch
 * is client-side, so the edge tier's state is visible in the network log on
 * its own. On THIS arm the fetch happens inside the Worker, where nothing
 * external can see it — so the document header is the only place the served
 * condition can surface at all. Without it every htmx PLP receipt records
 * `docCacheState: null`, and the cold/warm split rests on the runner having
 * ASKED for a condition with no evidence it GOT one.
 *
 * That is the same failure the knob whitelist above exists to prevent, one
 * layer further out: forwarding `?cache=` makes the condition real, and this
 * makes it CHECKABLE. A condition that cannot be falsified from the artifact
 * is not a measurement (ADR-0001 §9), and shipping the first without the
 * second would have been arguing for rigour and then removing the receipt.
 * The prototype's loaders leg does exactly this
 * (`docs/prototypes/data-strategy-lab/server.mjs:110-111`).
 */
const CACHE_STATE = "x-pm-cache-state";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed\n", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    // Normalize to the trailing-slash form, permanently — the same shape
    // qwik-city's router uses (its 301 is asserted in the origin suite);
    // a redirect that dropped the /htmx/ prefix would strand the visitor
    // on a path the front Worker routes nowhere. The Location is RELATIVE
    // (RFC 9110 §10.2.2) so the one composed origin stays host-agnostic —
    // an absolute URL here would bake in whichever host the front Worker
    // was reached on.
    if (url.pathname === "/htmx/editorial" || url.pathname === "/htmx/plp") {
      return new Response(null, {
        status: 301,
        headers: { location: `${url.pathname}/${url.search}` },
      });
    }

    if (url.pathname === "/htmx/editorial/") {
      try {
        const data = await loadEditorialData(env);
        return new Response(renderEditorialPage(data), { headers: HTML });
      } catch {
        // A live data-plane failure is a real runtime state for a
        // request-time variant (the slice-B/D precedent): stay inside the
        // store's own shell, answer 503, never an unbranded stack page.
        // The RENDER sits inside the same guard (verify-slice finding): a
        // malformed-but-200 tray — say a future re-freeze shipping the
        // featured detail with zero images — would otherwise throw during
        // template interpolation and surface as pm-front's plain-text 502,
        // exactly the unbranded page this branch exists to prevent.
        // renderUnavailablePage takes no data, so the fallback cannot
        // itself throw.
        return new Response(renderUnavailablePage(), { status: 503, headers: HTML });
      }
    }

    // The catalogue grid — this variant's arm of the data-strategy
    // comparison (ADR-0005 §1, "server loaders + PE"). The server does the
    // whole data fetch and returns finished HTML; the pagination links are
    // real links that htmx enhances into a partial swap, so an
    // htmx-originated request gets the `.pm-plp` block alone and everything
    // else gets the document. Same branded-503 boundary as editorial, and
    // for the same reason: an exception escaping the service binding
    // surfaces as pm-front's unbranded plain-text 502.
    if (url.pathname === "/htmx/plp/") {
      try {
        const { data, cacheState } = await loadPlpData(env, url);
        const partial = wantsPartial(request);
        const body = partial ? renderPlpFragment(data) : renderPlpPage(data);
        const headers = { ...(partial ? HTML_PARTIAL : HTML_VARY_HX) };
        // Only when the edge actually sent one: inventing a value would be
        // worse than the absence it replaces.
        if (cacheState) headers[CACHE_STATE] = cacheState;
        return new Response(body, { headers });
      } catch {
        // `current: "plp"` — the fallback marks the surface the visitor is
        // actually on. Editorial's own 503 above keeps the default and stays
        // byte-identical to what its receipts were measured against.
        return new Response(renderUnavailablePage({ current: "plp" }), {
          status: 503,
          headers: HTML,
        });
      }
    }

    // An unbuilt path under this variant's own prefix is a clean 404 — the
    // router is reached and answers (the qwik-block suite precedent).
    return new Response("not found\n", { status: 404 });
  },
};
