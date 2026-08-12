// The branded fallback for a live failure (the slice-B/D/E precedent: this
// is a request-time variant, so an edge error is a real runtime state).
// Deliberately a STATIC STRING, not a Remix render: the fallback must not be
// able to throw, and must not depend on the very machinery whose failure it
// reports. Keeps the visitor inside Long Decay Records' own shell — chrome
// slot included, so the instrument still frames the failure — and keeps the
// exhibit's fence label present even on the failure page (every surface
// self-explains, including broken ones).
const ASSETS = "/remix3/assets";

const CSS = [
  "tokens.css",
  "surfaces/shell.css",
  "components/masthead.css",
  "components/footer.css",
  "components/button.css",
  "components/plaque.css",
].map((f) => `<link rel="stylesheet" href="${ASSETS}/pm/css/${f}">`);

export const UNAVAILABLE_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>This page couldn't load — Long Decay Records</title>
  <link rel="stylesheet" href="${ASSETS}/pm/css/fonts.css">
  ${CSS.join("\n  ")}
</head>
<body>
  <a class="pm-skip pm-button" href="#main">Skip to content</a>
  <div id="pm-chrome-slot"></div>
  <div class="pm-page">
    <header class="pm-masthead">
      <a class="pm-masthead__brand" href="/">Long Decay<span> Records</span></a>
      <nav class="pm-masthead__nav" aria-label="Store">
        <a class="pm-masthead__link" href="/react-next/plp/plain/">Records</a>
        <a class="pm-masthead__link" href="/vanilla/editorial/" aria-current="page">Editorial</a>
      </nav>
      <a class="pm-masthead__cart" href="/vanilla/checkout/">Cart<span class="pm-masthead__cart-count" data-pm-cart-count aria-hidden="true"></span></a>
    </header>
    <main id="main">
      <aside class="pm-plaque pm-plaque--fenced" data-pm-fenced="true">
        <p class="pm-plaque__kicker">Fenced exhibit</p>
        <p class="pm-plaque__name"><strong>Remix 3 — a frontier preview</strong></p>
        <p class="pm-plaque__claim">This page is served by a pre-release framework and is excluded from every benchmark number on this site.</p>
      </aside>
      <div class="pm-editorial">
        <p class="pm-page__kicker">Staff pick</p>
        <h1>This page couldn&#39;t load</h1>
        <p>The store&#39;s data plane didn&#39;t answer. This is a simulated demo storefront — nothing was ordered, nothing was lost.</p>
      </div>
    </main>
    <p class="pm-status" role="status" data-pm-status></p>
    <footer class="pm-footer">
      <p class="pm-footer__fiction">A working store on frozen Discogs data — nothing ships, checkout is simulated.</p>
      <nav class="pm-footer__nav" aria-label="About this site">
        <a href="/">What is this?</a>
        <a href="/vanilla/a11y/">Accessibility, shown</a>
        <a href="/how-it-was-built/">How it was built</a>
        <a href="https://github.com/Robert-Lark/project-matrix" rel="noopener">GitHub</a>
      </nav>
    </footer>
  </div>
</body>
</html>
`;
