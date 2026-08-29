// The PLP's progressive enhancement — the half of "loaders + PE" that only
// exists once JavaScript is on, and the half that a partial swap makes
// NECESSARY rather than optional.
//
// With JS off, a page-flip is an ordinary navigation: the browser moves
// focus to the new document and announces the new page itself. `hx-boost`
// replaces that navigation with an in-place swap of `.pm-plp`, and in doing
// so it silently takes both of those away — the anchor the visitor just
// activated is inside the replaced subtree, so it is destroyed and focus
// falls to `<body>`, and nothing announces that the catalogue changed at
// all. A sighted mouse user sees new records; a keyboard user is dropped at
// the top of the document with no idea anything happened, and a screen
// reader says nothing (WCAG 2.4.3 focus order, 4.1.3 status messages).
//
// So this file is not decoration on the mechanism — it is the part of the
// mechanism that keeps the enhanced path as usable as the unenhanced one.
// The shell already carries the live region it needs
// (`<p class="pm-status" role="status" data-pm-status>`, shell.mjs:157), so
// the announcement costs no markup.
//
// `tabindex="-1"` is set HERE rather than rendered, deliberately: it is
// SCRIPT-ONLY STATE (the pdp-controls precedent). The served DOM must equal
// the master's, and the master renders no tabindex — a heading that is
// programmatically focusable only matters once the thing that focuses it
// exists, and with JS off it would be a focus stop that does nothing, which
// is the `pm-pdp__scroll` defect exactly.
/* global document, window */
(() => {
  /**
   * RE-ENTRANCY. This file runs a second time on every htmx history restore,
   * and its listeners are on `document`, which survives — so without this
   * flag they accumulate.
   *
   * The chain, read from the pinned runtime rather than assumed:
   * `cleanInnerHtmlForHistory` (htmx.js:3237-3248) strips only the request
   * class and `data-disabled-by-htmx` from the snapshot, so `<script>`
   * elements are KEPT; `restoreHistory` swaps that snapshot back in as
   * `innerHTML`; `makeFragment` runs `normalizeScriptTags` (:637) because
   * `allowScriptTags` defaults true (:160); and `duplicateScript` (:549)
   * builds a fresh `<script>` node the browser executes on insertion.
   *
   * One Back press therefore gives two `htmx:afterSwap` listeners, and every
   * later page-flip announces the range TWICE into a `role="status"` region
   * and calls `focus()` twice. Each Forward/Back cycle adds another. A file
   * whose entire job is a11y parity would then make the enhanced path worse
   * than the unenhanced one — the one direction this must never fail in.
   *
   * A `window` flag rather than a DOM attribute, so it stays script-only
   * state and the served markup is untouched.
   */
  if (window.__pmPlpEnhanced) return;
  window.__pmPlpEnhanced = 1;

  const BLOCK = ".pm-plp";
  const HEADING = ".pm-plp .pm-page__title";
  const COUNT = ".pm-plp .pm-toolbar__count";

  /**
   * Restore what the swap removed. Exported through nothing — the pre-merge
   * guard evaluates this file's real source against a linkedom document, so
   * what is tested is the bytes that ship, not a twin.
   */
  function afterSwap() {
    const block = document.querySelector(BLOCK);
    if (!block) return; // not our swap, or the swap failed — say nothing

    const heading = document.querySelector(HEADING);
    if (heading) {
      // Programmatically focusable, never tab-reachable: -1 keeps the
      // heading out of the tab order it was never in.
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }

    const status = document.querySelector("[data-pm-status]");
    const count = document.querySelector(COUNT);
    // textContent, never HTML (the cart contract's rule, same reason: this
    // string is built from tray-derived numbers).
    if (status && count) status.textContent = count.textContent.trim();
  }

  /**
   * A failed page-flip must not be a silent no-op, and by default it is.
   *
   * htmx's `responseHandling` maps a 4xx/5xx to `{ swap: false, error: true }`
   * (`htmx.org@2.0.10/dist/htmx.js:267`), so when the data plane is down the
   * boosted request changes NOTHING: the grid still shows the old page, the
   * URL is not pushed, and nothing says the click failed. With JavaScript
   * OFF the same click is a full navigation and the visitor gets the branded
   * 503 shell. ADR-0005 §1's "(works JS-off)" is a claim about parity, and
   * without this listener the enhanced path is the WORSE of the two — which
   * is the one direction a progressive enhancement must never fail in.
   *
   * `htmx:sendError` covers the network-level failure the response handler
   * never sees. Both write the same sentence into the live region the shell
   * already carries; nothing is swapped, because nothing was received.
   */
  function announceFailure() {
    const status = document.querySelector("[data-pm-status]");
    if (status) status.textContent = "Couldn't load that page — the list is unchanged.";
  }

  document.addEventListener("htmx:afterSwap", afterSwap);
  document.addEventListener("htmx:responseError", announceFailure);
  document.addEventListener("htmx:sendError", announceFailure);
})();
