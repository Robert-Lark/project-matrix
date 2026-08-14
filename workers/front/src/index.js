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
// the pinned measurement bundle + the published lab receipts and bundles
// under /_pm/lab/) is served assets-first from this Worker's own dist, so
// instrumentation bytes stay strippable by known path (ADR-0001 §6). The
// methodology page (/methodology/, ADR-0001 §9) rides the same assets-first
// path as home — static singletons, no injected chrome.

import { renderChrome } from "@pm/switcher";
import { getProfile, PROFILES } from "@pm/measurement";
// The published-runs bundle (ADR-0008 §3: the front build hands the bundle
// to renderChrome — nothing fetches). Imported from the BUILT artifact in
// dist/_pm/lab/, i.e. the very file served at /_pm/lab/editorial.json: the
// embedded bundle and the served receipt artifact are one object and cannot
// drift. build.mjs generates it from the committed receipts under lab/.
import editorialLab from "../dist/_pm/lab/editorial.json";

const LAB_BUNDLES = {
  [editorialLab.surface]: editorialLab.profiles,
};

/** The per-surface, per-profile published bundle for this request, or
 *  undefined (the chrome renders its designed empty states). Profile
 *  resolution mirrors the chrome's own reading-section selector EXACTLY
 *  (getProfile(param) ?? default) — a mismatch would render one profile's
 *  numbers under another profile's selected cell. Object.hasOwn throughout:
 *  surface and profile are client-controlled (the repo's recurring
 *  prototype-key class). */
function labFor(surface, search) {
  if (!Object.hasOwn(LAB_BUNDLES, surface)) return undefined;
  const bundles = LAB_BUNDLES[surface];
  const requested = new URLSearchParams(search).get("profile") ?? "";
  const resolved = (getProfile(requested) ?? PROFILES["avg-broadband-desktop"]).id;
  return Object.hasOwn(bundles, resolved) ? bundles[resolved] : undefined;
}

const VARIANTS = {
  "placeholder-static": "PLACEHOLDER_STATIC",
  "placeholder-ssr": "PLACEHOLDER_SSR",
  vanilla: "VANILLA",
  "react-next": "REACT_NEXT",
  astro: "ASTRO",
  qwik: "QWIK",
  htmx: "HTMX",
  // The fenced frontier exhibit (editorial-build slice F): dispatched and
  // chrome-injected like any variant — the fence excludes NUMBERS, not the
  // composed origin's mechanics (ADR-0004 second addendum). The bench
  // runner refuses /remix3/* targets; the switcher renders it as a fenced
  // cell, never a reading-table column.
  remix3: "REMIX3",
};

// Sibling planes (ADR-0009 §1): same prefix dispatch, but responses pass
// through byte-identical like EDGE — no chrome, no HUD, no receipts. The
// blog is outside every measurement fence.
const SIBLINGS = {
  blog: "BLOG",
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
      prefix === "api" || prefix === "assets"
        ? "EDGE"
        : Object.hasOwn(SIBLINGS, prefix)
          ? SIBLINGS[prefix]
          : Object.hasOwn(VARIANTS, prefix) // bare lookups resolve prototype keys
            ? VARIANTS[prefix]              // ("constructor" 502'd instead of 404)
            : undefined;
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

      // Chrome injection: variant HTML only. The edge Worker's JSON/images,
      // sibling planes (the blog), and every non-HTML response pass through
      // byte-identical — the content-type guard IS the non-HTML guarantee.
      const contentType = upstream.headers.get("content-type") ?? "";
      if (
        bindingName === "EDGE" ||
        bindingName === "BLOG" ||
        !contentType.includes("text/html")
      ) {
        return upstream;
      }

      // remix3's frame PARTIALS are HTML that is not a page (editorial-build
      // slice F): server-rendered fragments the exhibit's frames reload over
      // the wire. The slot contract is a PAGE contract — injecting chrome
      // into a fragment or error-logging its designed slotlessness would
      // both be wrong — so partials pass through byte-identical (the
      // q-data.json precedent from slice D). Deliberately variant-scoped,
      // not a plane-wide "/frames/" convention: no other variant serves HTML
      // partials today; the PLP build (htmx loaders+PE) should generalize
      // this deliberately when it does.
      if (variant === "remix3" && url.pathname.startsWith("/remix3/editorial/frames/")) {
        return upstream;
      }

      const surface = url.pathname.split("/")[2] ?? "";
      const chrome = renderChrome({
        variant,
        surface,
        pathname: url.pathname,
        search: url.search,
        // Where this response was served from — the beacon's location tag.
        // cf is absent in local dev.
        location: request.cf?.colo ?? "local",
        // Published readings, when this surface has them under the selected
        // profile. A fenced exhibit's page passes the same bundle: its
        // reading table reads the BENCHMARKED variants (ADR-0008 §3).
        lab: labFor(surface, url.search),
      });
      // Slot cardinality is a page CONTRACT (exactly one): zero slots ships
      // an unmeasured, switcher-less page; two double-inject the measurement
      // script and double-count RUM. The stream has already left when the
      // count is known, so the violation is logged, not blocked — Workers
      // Logs makes it observable (verified failure modes in workerd).
      let slotCount = 0;
      return new HTMLRewriter()
        // chrome.css rides in <head> (surface-design session): an in-body
        // stylesheet at the top of every measured page either blocks paint of
        // everything after it or flashes an unstyled strip — head placement
        // kills both, and the preload starts the instrument mono without a
        // late 3-hop chain. Both files live on /_pm/* (stripped from measured
        // KB by known path, ADR-0001 §6).
        .on("head", {
          element(el) {
            el.append(
              `<link rel="preload" href="/_pm/fonts/PMInstrumentMono.var.woff2" as="font" type="font/woff2" crossorigin>` +
                `<link rel="stylesheet" href="/_pm/chrome.css">`,
              { html: true },
            );
          },
        })
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
