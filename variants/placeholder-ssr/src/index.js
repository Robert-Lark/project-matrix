// Throwaway SSR placeholder: renders the SAME canonical sample markup as
// placeholder-static (the ADR-0003 §1 markup contract — each paradigm
// re-implements it), wrapped in representative PERMITTED paradigm noise so
// the drift gate (issue #6) can prove its normalizer strips exactly the
// ADR-0003 §6 permitted classes rather than passing vacuously:
//   1. hydration-marker attribute  data-ph-hydrate="idle"
//   2. comment nodes               <!-- ph:ssr-boundary -->
//   3. scoping hash                the ph-x7f3a2 class + data-ph-scope attr
//
// Request-fidelity evidence rides in RESPONSE HEADERS (x-pm-echo-*), not the
// body, so the rendered DOM stays canonical-markup + permitted-noise only.

function samplePage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sample surface — Project Matrix placeholder</title>
  <link rel="preload" href="../assets/pm/fonts/FamiljenGrotesk.var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../assets/pm/css/fonts.css">
  <link rel="stylesheet" href="../assets/pm/css/tokens.css">
  <link rel="stylesheet" href="../assets/pm/css/components/release-card.css">
</head>
<body>
  <div id="pm-chrome-slot"></div>

  <main>
    <h1>Sample surface</h1>
    <!-- ph:ssr-boundary -->
    <ul class="pm-grid ph-x7f3a2" role="list" data-ph-scope="x7f3a2" data-ph-hydrate="idle">
      <li class="pm-release-card ph-x7f3a2">
        <img class="pm-release-card__media" width="600" height="600"
             alt="Miles Davis — Kind Of Blue, front cover"
             src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'%3E%3Crect width='600' height='600' fill='%23eceef0'/%3E%3Ccircle cx='300' cy='300' r='210' fill='%23d9dde1'/%3E%3Ccircle cx='300' cy='300' r='58' fill='%239aa2ab'/%3E%3C/svg%3E">
        <div class="pm-release-card__body">
          <h3 class="pm-release-card__title">Kind Of Blue</h3>
          <p class="pm-release-card__artist">Miles Davis</p>
          <p class="pm-release-card__meta">Vinyl, LP, Album, Reissue, 180 Gram · 1959</p>
          <div class="pm-release-card__foot">
            <span class="pm-release-card__price">$21.50</span>
            <span class="pm-release-card__stock">58 for sale</span>
          </div>
        </div>
      </li>
      <li class="pm-release-card ph-x7f3a2">
        <img class="pm-release-card__media" width="600" height="600"
             alt="John Coltrane — A Love Supreme, front cover"
             src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'%3E%3Crect width='600' height='600' fill='%23eceef0'/%3E%3Ccircle cx='300' cy='300' r='210' fill='%23d9dde1'/%3E%3Ccircle cx='300' cy='300' r='58' fill='%239aa2ab'/%3E%3C/svg%3E">
        <div class="pm-release-card__body">
          <h3 class="pm-release-card__title">A Love Supreme</h3>
          <p class="pm-release-card__artist">John Coltrane</p>
          <p class="pm-release-card__meta">Vinyl, LP, Album, Reissue · 1965</p>
          <div class="pm-release-card__foot">
            <span class="pm-release-card__price">$28.00</span>
            <span class="pm-release-card__stock">34 for sale</span>
          </div>
        </div>
      </li>
    </ul>
    <!-- ph:ssr-boundary-end -->
  </main>
</body>
</html>
`;
}

function log(level, event, fields) {
  const line = JSON.stringify({
    level,
    worker: "pm-placeholder-ssr",
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else console.log(line);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      // Mirror the asset layer's trailing-slash canonicalization so both
      // placeholders behave identically at the composed origin.
      if (url.pathname === "/placeholder-ssr/sample") {
        return Response.redirect(`${url.origin}/placeholder-ssr/sample/${url.search}`, 307);
      }

      if (url.pathname === "/placeholder-ssr/sample/boom") {
        // Deliberate failure hook (throwaway, like the variant itself): lets
        // the origin suite assert unexpected errors return a generic message
        // with details logged server-side — at the seam, not via unit tests.
        throw new Error("deliberate placeholder failure (boom)");
      }

      if (url.pathname === "/placeholder-ssr/sample/") {
        return new Response(samplePage(), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "x-pm-ssr": "1",
            // Fidelity evidence: what this Worker actually received through
            // the front hop (ADR-0004 §5 — the URL is the measurement
            // condition; nothing may be lost in transit).
            "x-pm-echo-path": url.pathname,
            "x-pm-echo-search": url.search,
            "x-pm-echo-probe": request.headers.get("x-pm-probe") ?? "",
          },
        });
      }

      // Everything else — the variant's own assets included — goes to the
      // ASSETS binding explicitly (spike hardening 1): whether a service-
      // binding fetch traverses the target's asset-routing layer is
      // UNDOCUMENTED (it happens to work locally), so this script never
      // relies on it. The chain stays binding → script → own ASSETS binding,
      // every hop documented; misses get the asset layer's 404.
      return env.ASSETS.fetch(request);
    } catch (err) {
      log("error", "unhandled", {
        path: url.pathname,
        message: err.message,
        stack: err.stack,
      });
      return new Response("internal error\n", { status: 500 });
    }
  },
};
