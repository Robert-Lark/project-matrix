// Front routing Worker — the ADR-0004 §3 composition, this slice.
//
// Assets-first: requests matching this Worker's own static assets (the
// throwaway index at /) never reach this script. Everything else dispatches
// by path prefix over a service binding, forwarding the ORIGINAL request
// untouched — variant assets are nested under /{variant}/ (the documented
// "serving a subdirectory" shape), so no path rewriting happens and
// asset-layer redirects stay correct (spike-verified).
//
// /api/* and /assets/* dispatch to the edge Worker (the ADR-0002 §8 data
// plane, issue #4). NOT here yet (issue #5 owns them): HTMLRewriter chrome
// injection + the /_pm/* instrumentation path. Until the rewriter exists
// every response — HTML or not — passes through byte-identical by
// construction.

const VARIANTS = {
  "placeholder-static": "PLACEHOLDER_STATIC",
  "placeholder-ssr": "PLACEHOLDER_SSR",
};

// Structured JSON logs (Workers Logs ingests console output; PRD story 42).
function log(level, event, fields) {
  const line = JSON.stringify({ level, worker: "pm-front", event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const prefix = url.pathname.split("/")[1];

    // The data plane (ADR-0002 §8): trays + beacons under /api/*, the frozen
    // self-hosted images under /assets/* — both served by the edge Worker.
    const bindingName =
      prefix === "api" || prefix === "assets" ? "EDGE" : VARIANTS[prefix];
    const variant = bindingName === "EDGE" ? "edge" : prefix;

    if (!bindingName) {
      log("info", "unknown-prefix", { path: url.pathname });
      return new Response("not found\n", { status: 404 });
    }

    try {
      const upstream = await env[bindingName].fetch(request);
      log("info", "dispatch", {
        variant,
        path: url.pathname,
        status: upstream.status,
      });
      return upstream;
    } catch (err) {
      // Generic message out; details stay server-side (security.md: never
      // present raw exceptions to the user).
      log("error", "upstream-failure", {
        variant,
        path: url.pathname,
        message: err.message,
        stack: err.stack,
      });
      return new Response("upstream unavailable\n", { status: 502 });
    }
  },
};
