/**
 * Checkout — INP under real pressure. Every behavior is work a real checkout
 * genuinely does; the canonical SERVED state is the empty cart (client
 * state, ADR-0004 §5) with reserved geometry. The simulation notice is a
 * BASE plaque — checkout IS measured (panel finding; --fenced is reserved
 * for number-exclusions). Field wiring is the DS default: label-for,
 * autocomplete, inputmode, aria-describedby hints; invalid submit renders
 * the pm-error-summary and moves focus to it (registry:
 * checkout-submit-invalid). No `novalidate` in the served markup: JS-off,
 * native constraint validation is the real behavior the page claims; a
 * paradigm adds novalidate at hydration when its own validation takes over
 * (verify-slice, conformance lens).
 *
 * TWO RULES MAKE THE PLAQUE TRUE RATHER THAN ASPIRATIONAL, and both are
 * structural — a later variant cannot opt out of them without failing the
 * master-identity gate:
 *
 *  1. NO INPUT CARRIES `name`. The plaque says "what you type never leaves
 *     your browser", and the form is a real `method="post"` form, so JS off
 *     (or blocked, or a deferred script that failed) natively submits it.
 *     A submittable control with no `name` is not serialized — proven in
 *     Chromium: after typing into an unnamed input, `new FormData(form)`
 *     still yields only the named controls. So the claim holds on the
 *     JS-off path too, which is the only path where it was ever at risk.
 *     `name="shipping"` survives on the radio group ALONE, because radios
 *     group by name and without it both options can be checked at once;
 *     its value is a shipping tier, not something anyone types.
 *  2. THE PAYMENT FIELDS DO NOT SOLICIT A REAL CARD. `cc-number`/`cc-exp`/
 *     `cc-csc` are exactly the tokens that make a browser offer a saved
 *     card, and this page is a demonstration — it has no business putting
 *     a real PAN in its DOM. They carry `autocomplete="off"`. ADR-0008 §8's
 *     "every field with label/autocomplete/inputmode" is still satisfied:
 *     `off` is the correct token for a field that must not be autofilled.
 *
 * `required`/`pattern` mirror `checkout.js`'s RULES one-for-one, so the
 * JS-off validation the page advertises is the same validation the
 * enhancement performs — not a weaker cousin of it. They are inert once JS
 * loads (the hydration `novalidate` handover above), and they work on
 * unnamed controls: constraint validation does not consult `name`.
 *
 * THE FORM POSTS TO `place-order/`, RELATIVE — not to its own URL
 * (checkout-measure-prep, 2026-09-24). Relative, so each variant answers its
 * own: `/vanilla/checkout/place-order/`, `/react-next/checkout/place-order/`.
 * Not the page's own URL, because on a static-assets Worker a request whose
 * path matches an asset is answered by the assets layer BEFORE the script
 * runs — a POST to `/vanilla/checkout/` met the binding's zero-length 405
 * with a route for it sitting unreached in the script (measured on the held
 * plane; the pre-merge pin on that route passed, the plane leg failed). A
 * path with no asset behind it reaches the script, and only that request
 * does: every page GET stays assets-first, so the measured page pays no
 * script invocation for a JS-off path nobody measures. The paradigm answers
 * with a 303 to `checkout/placed/` (renderCheckoutPlaced below).
 */
import { namedGlyph, page } from "./shell.mjs";

function field({
  id,
  label,
  type = "text",
  autocomplete,
  inputmode,
  hint,
  span = "",
  required = false,
  pattern,
  title,
}) {
  const hintId = hint ? `${id}-hint` : null;
  // No `name`, by rule 1 above — deliberately not an opt-in flag, so a new
  // field cannot be added in a named (submittable) state by omission.
  return `<div class="pm-field${span}">
              <label class="pm-field__label" for="${id}">${label}</label>
              <input class="pm-field__control" id="${id}" type="${type}"${
                autocomplete ? ` autocomplete="${autocomplete}"` : ""
              }${inputmode ? ` inputmode="${inputmode}"` : ""}${required ? " required" : ""}${
                pattern ? ` pattern="${pattern}"` : ""
              }${title ? ` title="${title}"` : ""}${hintId ? ` aria-describedby="${hintId}"` : ""}>${
                hint ? `\n              <span class="pm-field__hint" id="${hintId}">${hint}</span>` : ""
              }
            </div>`;
}

export function renderCheckout({ extraDepth = 0 } = {}) {
  const content = `      <div class="pm-checkout">
        <h1 class="pm-page__title">Checkout</h1>
        <aside class="pm-plaque">
          <p class="pm-plaque__kicker">Simulated commerce</p>
          <p class="pm-plaque__name"><strong>This checkout is a demonstration.</strong></p>
          <p class="pm-plaque__claim">No payment is processed, nothing ships, and what you type never leaves your browser — this page sends only the same anonymous timing beacons every page here sends. The form is real so the measurement is real.</p>
        </aside>
        <div class="pm-checkout__body">
          <form class="pm-checkout__form" method="post" action="place-order/">
            <fieldset class="pm-checkout__section">
              <legend class="pm-checkout__legend">Contact</legend>
              ${field({ id: "email", label: "Email address", type: "email", autocomplete: "email", required: true, hint: "Used only to render the demo confirmation in this page — nothing is ever sent." })}
            </fieldset>
            <fieldset class="pm-checkout__section">
              <legend class="pm-checkout__legend">Shipping address</legend>
              ${field({ id: "name", label: "Full name", autocomplete: "name", required: true })}
              ${field({ id: "address1", label: "Address", autocomplete: "address-line1", required: true })}
              ${field({ id: "address2", label: "Apartment, suite, etc. (optional)", autocomplete: "address-line2" })}
              <div class="pm-checkout__row">
                ${field({ id: "city", label: "City", autocomplete: "address-level2", required: true })}
                ${field({ id: "postal", label: "Postal code", autocomplete: "postal-code", inputmode: "numeric", required: true })}
              </div>
              <div class="pm-checkout__row">
                ${field({ id: "region", label: "State / region", autocomplete: "address-level1", required: true })}
                <div class="pm-field">
                  <label class="pm-field__label" for="country">Country</label>
                  <select class="pm-field__control" id="country" autocomplete="country-name">
                    <option selected>United States</option>
                    <option>Canada</option>
                    <option>United Kingdom</option>
                    <option>Germany</option>
                    <option>Japan</option>
                  </select>
                </div>
              </div>
            </fieldset>
            <fieldset class="pm-checkout__section">
              <legend class="pm-checkout__legend">Shipping method</legend>
              <label class="pm-format__option">
                <input class="pm-format__input" type="radio" name="shipping" value="standard" checked>
                <span class="pm-format__label">Standard — free, 5–8 days</span>
              </label>
              <label class="pm-format__option">
                <input class="pm-format__input" type="radio" name="shipping" value="express">
                <span class="pm-format__label">Express — $12.00, 2 days</span>
              </label>
            </fieldset>
            <fieldset class="pm-checkout__section">
              <legend class="pm-checkout__legend">Payment</legend>
              <p class="pm-checkout__jsoff">Demo card fields — type anything; nothing you enter is stored or sent.</p>
              ${field({ id: "card", label: "Card number", autocomplete: "off", inputmode: "numeric", required: true, pattern: "\\d{13,19}", title: "13 to 19 digits", hint: "Formats as you type — that formatting is part of what this page measures." })}
              ${field({ id: "cardname", label: "Name on card", autocomplete: "off", required: true })}
              <div class="pm-checkout__row">
                ${field({ id: "expiry", label: "Expiry (MM/YY)", autocomplete: "off", inputmode: "numeric", required: true, pattern: "(0[1-9]|1[0-2])/\\d{2}", title: "Two digits for the month, then two for the year, as MM/YY" })}
                ${field({ id: "cvc", label: "Security code", autocomplete: "off", inputmode: "numeric", required: true, pattern: "\\d{3,4}", title: "3 or 4 digits" })}
              </div>
            </fieldset>
            <div><button class="pm-button" type="submit">Place order</button></div>
            <p class="pm-checkout__jsoff">With JavaScript off, every field here still works — labels, hints, native validation that gates the submit, and a Place order that posts natively to a plain confirmation page. Live card formatting and the error summary are what JavaScript adds; placing the order in the page is its JavaScript moment, and that cost is the comparison.</p>
          </form>
          <section class="pm-cart" aria-label="Order summary">
            <h2 class="pm-cart__title">Order summary</h2>
            <p class="pm-cart__empty">Your cart is empty — items appear here as you add them from the store.</p>
            <ul class="pm-cart__lines" role="list"></ul>
            <p class="pm-cart__total"><span>Total</span> <span class="pm-cart__price" data-pm-cart-total>${namedGlyph("—", "No total yet")}</span></p>
          </section>
        </div>
      </div>`;

  return page({
    title: "Checkout — Long Decay Records",
    depth: 2 + extraDepth,
    css: [
      "components/field.css",
      "components/format-switch.css",
      "components/cart-summary.css",
      "components/error-summary.css",
      "components/plaque.css",
      "surfaces/checkout.css",
    ],
    current: null,
    content,
  });
}

/**
 * The order-placed page (checkout-measure-prep, 2026-09-24) — where a JS-OFF
 * "Place order" lands. The form above is a real `method="post"`, so with
 * JavaScript off (or blocked, or a deferred script that never ran) the
 * browser submits it natively; until this page existed that request ended on
 * the assets Worker's zero-length 405 — a dead end on the one path the
 * variant exists to prove. The paradigm answers the POST with a 303 to THIS
 * page (variants/vanilla/src/index.js), a second master of the same surface
 * at `checkout/placed/`, so every checkout variant lands the same document
 * and the drift gate holds them to it.
 *
 * What the page may say is bounded by what the request carried. Rule 1 above
 * (no input carries `name`) means the posted body is `shipping=standard` or
 * `shipping=express` and nothing else — measured in Chromium, JS off, the
 * form filled with a real-looking card and address — and the Worker never
 * reads the body, so this page cannot and does not name the method chosen.
 * It states exactly that. `noindex`: a confirmation reached only by posting
 * has no standalone meaning to index.
 *
 * No order summary here, on purpose: cart is client state (ADR-0008 §7) and
 * a JS-off page cannot read it; a served summary would be the empty state
 * with a "Total" row, which on a confirmation page reads as "you bought
 * nothing". The masthead's cart link still carries the badge for a JS-on
 * visitor (the same `checkout.js` renders it and then finds no form).
 */
export function renderCheckoutPlaced({ extraDepth = 0 } = {}) {
  const content = `      <div class="pm-checkout pm-checkout--placed">
        <h1 class="pm-page__title">Order placed</h1>
        <aside class="pm-plaque">
          <p class="pm-plaque__kicker">Simulated commerce</p>
          <p class="pm-plaque__name"><strong>This was a demonstration.</strong></p>
          <p class="pm-plaque__claim">Nothing ships, nothing was charged, and nothing was kept. The form posted the way a form does without JavaScript, and the only field it carries a name for is the shipping method — the card and address fields have none, so what you typed never left your browser.</p>
        </aside>
        <p class="pm-checkout__jsoff">With JavaScript on, this moment happens inside the checkout itself: the same form validates as you type and announces the order without leaving the page. This page is what the same form does with JavaScript off — a real request and a real answer.</p>
        <p><a class="pm-button" href="/react-next/plp/plain/">Back to the records</a></p>
      </div>`;

  return page({
    title: "Order placed — Long Decay Records",
    depth: 3 + extraDepth,
    css: ["components/plaque.css", "surfaces/checkout.css"],
    current: null,
    content,
    noindex: true,
  });
}
