// The assets forwarder (spike hardening 1, ADR-0004 addendum): serving assets
// *through a service binding without a script* is undocumented, so every
// static variant ships this default handler — every hop in the composition
// is then a documented Cloudflare behavior.
//
// Plus ONE route of its own (checkout-measure-prep, 2026-09-24): a static
// site has to answer a form POST with something, and the assets binding
// answers every non-GET with a zero-length 405 — which is where a JS-off
// "Place order" ended until this line (measured on the held plane: status
// 405, 0 body bytes). The honest static-site shape is POST → 303 → a GET-able
// page: the browser lands on `checkout/placed/`, a committed master of the
// surface baked into dist like every other page here, and a refresh re-GETs
// it instead of re-posting.
//
// WHY THE FORM POSTS TO `place-order/` AND NOT TO ITSELF. A request whose
// path matches a static asset is answered by the assets layer before this
// script runs — the same assets-first rule the front Worker's own docblock
// records for its dist. The first draft of this route matched
// `POST /vanilla/checkout/`, and the held plane kept answering 405: the path
// has an index.html behind it, so the platform never invoked the script
// (the pre-merge pin on the route passed; the plane leg failed — the
// difference between a test that reads the source and one that sends the
// request). `/vanilla/checkout/place-order/` has nothing in dist, so it is
// the ONE request that reaches this function, and every page GET stays
// assets-first: the measured checkout page pays no script invocation for a
// JS-off path nobody measures. The alternative — `assets.run_worker_first`
// on the page path — would have put this script on every GET of
// `/vanilla/checkout/` to answer a POST; rejected for exactly that cost.
//
// Root-relative Location, so the same bytes are right behind the front's
// service binding locally and on the deployed hostname. The body is NEVER
// read: by the master's rule 1 it carries only `shipping=…`, and not reading
// it is the stronger version of the plaque's promise. A GET of the endpoint
// is not a page and falls through to the binding's 404. The 303 leaves
// through the front's security floor like every other response
// (workers/front/src/index.js); the suite pins all of it.
const PLACE_ORDER_PATH = "/vanilla/checkout/place-order/";
const PLACED_PATH = "/vanilla/checkout/placed/";

export default {
  fetch(request, env) {
    if (request.method === "POST" && new URL(request.url).pathname === PLACE_ORDER_PATH) {
      return new Response(null, { status: 303, headers: { location: PLACED_PATH } });
    }
    return env.ASSETS.fetch(request);
  },
};
