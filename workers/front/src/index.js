// Front routing Worker — the ADR-0004 §3 composition, this slice.
//
// Assets-first: requests matching this Worker's own static assets (the home
// surface at /, ADR-0007) never reach this script. Everything else dispatches
// by path prefix over a service binding, forwarding the ORIGINAL request
// untouched — variant assets are nested under /{variant}/ (the documented
// "serving a subdirectory" shape), so no path rewriting happens and
// asset-layer redirects stay correct (spike-verified).
//
// /api/* and /assets/* dispatch to the edge Worker (the ADR-0002 §8 data
// plane, issue #4). Variant HTML gets the switcher/HUD chrome injected into
// the documented `div#pm-chrome-slot` via HTMLRewriter (ADR-0004 §7, spike
// hardening 2) — HTML only, content-type guarded; everything else passes
// through byte-identical. The /_pm/* instrumentation path (chrome.css +
// the pinned measurement bundle) is served assets-first from this Worker's
// own dist, so instrumentation bytes stay strippable by known path
// (ADR-0001 §6).

import { renderChrome } from "@pm/switcher";

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

      // Chrome injection: variant HTML only. The edge Worker's JSON/images
      // and every non-HTML response pass through byte-identical — the
      // content-type guard IS the non-HTML guarantee.
      const contentType = upstream.headers.get("content-type") ?? "";
      if (bindingName === "EDGE" || !contentType.includes("text/html")) {
        return upstream;
      }

      const chrome = renderChrome({
        variant,
        surface: url.pathname.split("/")[2] ?? "",
        pathname: url.pathname,
        search: url.search,
        // Where this response was served from — the beacon's location tag.
        // cf is absent in local dev.
        location: request.cf?.colo ?? "local",
      });
      // Slot cardinality is a page CONTRACT (exactly one): zero slots ships
      // an unmeasured, switcher-less page; two double-inject the measurement
      // script and double-count RUM. The stream has already left when the
      // count is known, so the violation is logged, not blocked — Workers
      // Logs makes it observable (verified failure modes in workerd).
      let slotCount = 0;
      return new HTMLRewriter()
        .on("div#pm-chrome-slot", {
          element(el) {
            slotCount += 1;
            el.setInnerContent(chrome, { html: true });
          },
        })
        .onDocument({
          end() {
            if (slotCount !== 1) {
              log("error", "chrome-slot-count", {
                variant,
                path: url.pathname,
                count: slotCount,
              });
            }
          },
        })
        .transform(upstream);
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
