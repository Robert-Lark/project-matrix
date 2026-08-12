// The canonical shell (packages/reference/render/shell.mjs is the contract
// of record): skip link FIRST, then the chrome slot (variants only), then
// .pm-page — masthead · main · status region · footer. Cross-surface links
// absolute to each surface's designated host. Re-implemented as Remix 3
// Handle components (ADR-0003 §1: a component is a spec, re-implemented per
// paradigm; the spike proved the pm- markup contract renders frictionlessly).
//
// Delivery notes (all inside ADR-0008's serialization freedoms):
//  - createHtmlResponse emits the doctype; this component starts at <html>.
//  - remix/ui's css() mixin is deliberately unused on every served element,
//    so the compared DOM carries no rmxc-* class and no <style data-rmx> —
//    the measured-clean outcome the drift registry records (the astro/htmx
//    "earned emptiness" precedent).
//  - The plaque/demo stylesheet (frontier.css) is variant-owned delivery for
//    the two fenced subtrees only; store components use the shared CSS.
import type { Handle, RemixNode } from "remix/ui";

/** The asset base is ABSOLUTE (`/remix3/assets`): the Worker renders pages
 *  and frame partials at more than one path depth, so relative asset paths
 *  would be a latent trap; the front Worker never rewrites paths, so the
 *  /remix3/ prefix is this variant's own duty (FINDINGS §8's named seam). */
export const ASSETS = "/remix3/assets";

const CSS = [
  "tokens.css",
  "surfaces/shell.css",
  "components/masthead.css",
  "components/footer.css",
  "components/button.css",
  "components/release-card.css",
  "components/prose.css",
  "surfaces/editorial.css",
  // Exhibit-only addition to the canonical editorial list (a <link> is an
  // ADR-0008 delivery freedom): the fenced plaque IS the DS plaque
  // component, and its module ships with the copied css tree — without
  // this link the boundary label renders unstyled, and NOTHING else can
  // catch that: the fenced subtrees are by construction the one region
  // every comparison drops (verify-slice finding, conformance lens — the
  // origin suite now asserts this link for exactly that reason).
  "components/plaque.css",
];

export interface DocumentProps {
  title: string;
  children?: RemixNode;
  /** Paradigm scripts, rendered at the END of body (the shell contract's ✂
   *  placement for variant script additions; script elements are delivery,
   *  not contract — ADR-0008 freedoms). */
  scripts?: RemixNode;
}

/** The canonical font-loading markup (@pm/tokens/fonts/loading-markup.html)
 *  verbatim modulo the base path — ADR-0003 §8: fonts are a controlled
 *  constant, only the asset base may differ per consumer. Two framework-
 *  shaped serialization deltas, both spec-equivalent to the canonical file
 *  and tolerated by the suite's font leg like react-next's JSX form:
 *  `crossorigin="anonymous"` for the bare `crossorigin` (remix's type only
 *  admits the two named states; the canonical bare attribute IS the
 *  empty-value form, and per the HTML spec the EMPTY value default and
 *  "anonymous" both select the Anonymous CORS state — a MISSING attribute
 *  would be the No CORS state instead, so never delete it: a no-CORS
 *  preload can't serve the CORS-mode @font-face fetch and both fonts would
 *  download twice), and self-closed voids. */
function FontMarkup(_handle: Handle) {
  return () => (
    <>
      <link
        rel="preload"
        href={`${ASSETS}/pm/fonts/FamiljenGrotesk.var.woff2`}
        as="font"
        type="font/woff2"
        crossorigin="anonymous"
      />
      <link
        rel="preload"
        href={`${ASSETS}/pm/fonts/PMCrateSymbols.woff2`}
        as="font"
        type="font/woff2"
        crossorigin="anonymous"
      />
      <link rel="stylesheet" href={`${ASSETS}/pm/css/fonts.css`} />
    </>
  );
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    const { title, children, scripts } = handle.props;

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title}</title>
          <FontMarkup />
          {CSS.map((f) => (
            <link rel="stylesheet" href={`${ASSETS}/pm/css/${f}`} />
          ))}
          <link rel="stylesheet" href={`${ASSETS}/frontier.css`} />
        </head>
        <body>
          <a class="pm-skip pm-button" href="#main">
            {"Skip to content"}
          </a>
          <div id="pm-chrome-slot"></div>
          <div class="pm-page">
            <header class="pm-masthead">
              <a class="pm-masthead__brand" href="/">
                {"Long Decay"}
                <span>{" Records"}</span>
              </a>
              <nav class="pm-masthead__nav" aria-label="Store">
                <a class="pm-masthead__link" href="/react-next/plp/plain/">
                  {"Records"}
                </a>
                <a class="pm-masthead__link" href="/vanilla/editorial/" aria-current="page">
                  {"Editorial"}
                </a>
              </nav>
              <a class="pm-masthead__cart" href="/vanilla/checkout/">
                {"Cart"}
                <span class="pm-masthead__cart-count" data-pm-cart-count aria-hidden="true"></span>
              </a>
            </header>
            <main id="main">{children}</main>
            <p class="pm-status" role="status" data-pm-status></p>
            <footer class="pm-footer">
              <p class="pm-footer__fiction">
                {"A working store on frozen Discogs data — nothing ships, checkout is simulated."}
              </p>
              <nav class="pm-footer__nav" aria-label="About this site">
                <a href="/">{"What is this?"}</a>
                <a href="/vanilla/a11y/">{"Accessibility, shown"}</a>
                <a href="/how-it-was-built/">{"How it was built"}</a>
                <a href="https://github.com/Robert-Lark/project-matrix" rel="noopener">
                  {"GitHub"}
                </a>
              </nav>
            </footer>
          </div>
          {scripts}
        </body>
      </html>
    );
  };
}
