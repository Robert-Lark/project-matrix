// The hand-rolled Cloudflare Workers entry: the entire "adapter" is this
// file (ADR-0004 second addendum; the spike's worker/index.ts is the prior
// art — Remix 3 has no official Workers target, and the app router is
// fetch-shaped, which is exactly a Worker's fetch handler). Assets under
// /remix3/assets/* are served assets-first from dist/ and never reach this
// script; the front Worker forwards the ORIGINAL request untouched, so the
// /remix3/ prefix — routes, asset URLs, redirects — is this Worker's own
// duty.
//
// One deliberate deviation from the spike (recorded in DIFF-TO-STARTER.md):
// the response is DRAINED to a string before answering. renderToStream's
// document shell could otherwise commit a 200 and then fail mid-stream,
// which surfaces as a truncated page no status can describe — the branded
// 503 below (the plane's standing "never an unbranded failure page"
// contract, hardened by slice E's render-inside-the-guard finding) requires
// knowing the render finished before the first byte leaves. The exhibit is
// fenced from every number, so the buffering costs nothing measured; frames
// still stream over the wire on reload, which is the paradigm's flagship
// behavior.
import { createAppRouter } from "./router.tsx";
import type { Env } from "./lib/data.ts";
import { UNAVAILABLE_PAGE } from "./unavailable.ts";

const HTML = { "content-type": "text/html; charset=utf-8" };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // Every exit below that can answer a HEAD must not send content
    // (RFC 9110 §9.3.2) — hoisted here so no branch can forget it
    // (verify-slice finding: the 404/503 exits originally carried bodies
    // under an unverified "the platform strips it" premise). The 405 exit
    // needs no check: it fires only for methods that are neither GET nor
    // HEAD.
    const isHead = request.method === "HEAD";

    if (request.method !== "GET" && !isHead) {
      return new Response("method not allowed\n", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    // Normalize to the trailing-slash form, permanently (the qwik/htmx
    // suite-asserted shape). The Location is RELATIVE (RFC 9110 §10.2.2) so
    // the one composed origin stays host-agnostic; a redirect that dropped
    // the /remix3/ prefix would strand the visitor on a path the front
    // Worker routes nowhere.
    if (url.pathname === "/remix3/editorial") {
      return new Response(null, {
        status: 301,
        headers: { location: `/remix3/editorial/${url.search}` },
      });
    }

    try {
      // remix/routes `get()` matchers see the method, so a HEAD request is
      // routed as GET and answered without a body.
      const routed = isHead ? new Request(request.url, { headers: request.headers }) : request;

      const router = createAppRouter(env);
      const res = await router.fetch(routed);

      if (res.status === 404) {
        // An unbuilt path under this variant's own prefix is a clean 404 —
        // the router is reached and answers (the qwik/htmx suite precedent).
        return new Response(isHead ? null : "not found\n", { status: 404 });
      }

      // Drain BEFORE responding (header rationale above): a render-time
      // throw — say a malformed-but-200 tray interpolating undefined — lands
      // in the catch below instead of truncating a committed 200. A
      // framework-internal failure that answers ≥500 instead of throwing
      // takes the same branded exit.
      const body = await res.text();
      if (res.status >= 500) throw new Error(`router answered ${res.status}`);

      return new Response(isHead ? null : body, { status: res.status, headers: res.headers });
    } catch {
      // A live data-plane failure is a real runtime state for a
      // request-time variant (the slice-B/D/E precedent): stay inside the
      // store's own shell, answer 503, never an unbranded stack page.
      // UNAVAILABLE_PAGE is a static string, so the fallback cannot throw.
      return new Response(isHead ? null : UNAVAILABLE_PAGE, {
        status: 503,
        headers: HTML,
      });
    }
  },
};
