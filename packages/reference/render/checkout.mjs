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
 */
import { page } from "./shell.mjs";

function field({ id, label, type = "text", autocomplete, inputmode, hint, span = "" }) {
  const hintId = hint ? `${id}-hint` : null;
  return `<div class="pm-field${span}">
              <label class="pm-field__label" for="${id}">${label}</label>
              <input class="pm-field__control" id="${id}" name="${id}" type="${type}"${
                autocomplete ? ` autocomplete="${autocomplete}"` : ""
              }${inputmode ? ` inputmode="${inputmode}"` : ""}${hintId ? ` aria-describedby="${hintId}"` : ""}>${
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
          <form class="pm-checkout__form" method="post" action="">
            <fieldset class="pm-checkout__section">
              <legend class="pm-checkout__legend">Contact</legend>
              ${field({ id: "email", label: "Email address", type: "email", autocomplete: "email", hint: "Used only to render the demo confirmation in this page — nothing is ever sent." })}
            </fieldset>
            <fieldset class="pm-checkout__section">
              <legend class="pm-checkout__legend">Shipping address</legend>
              ${field({ id: "name", label: "Full name", autocomplete: "name" })}
              ${field({ id: "address1", label: "Address", autocomplete: "address-line1" })}
              ${field({ id: "address2", label: "Apartment, suite, etc. (optional)", autocomplete: "address-line2" })}
              <div class="pm-checkout__row">
                ${field({ id: "city", label: "City", autocomplete: "address-level2" })}
                ${field({ id: "postal", label: "Postal code", autocomplete: "postal-code", inputmode: "numeric" })}
              </div>
              <div class="pm-checkout__row">
                ${field({ id: "region", label: "State / region", autocomplete: "address-level1" })}
                <div class="pm-field">
                  <label class="pm-field__label" for="country">Country</label>
                  <select class="pm-field__control" id="country" name="country" autocomplete="country-name">
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
              ${field({ id: "card", label: "Card number", autocomplete: "cc-number", inputmode: "numeric", hint: "Formats as you type — that formatting is part of what this page measures." })}
              ${field({ id: "cardname", label: "Name on card", autocomplete: "cc-name" })}
              <div class="pm-checkout__row">
                ${field({ id: "expiry", label: "Expiry (MM/YY)", autocomplete: "cc-exp", inputmode: "numeric" })}
                ${field({ id: "cvc", label: "Security code", autocomplete: "cc-csc", inputmode: "numeric" })}
              </div>
            </fieldset>
            <div><button class="pm-button" type="submit">Place order</button></div>
            <p class="pm-checkout__jsoff">With JavaScript off, every field here still works — labels, hints, native validation. Placing the order is the page's JavaScript moment; that cost is the comparison.</p>
          </form>
          <section class="pm-cart" aria-label="Order summary">
            <h2 class="pm-cart__title">Order summary</h2>
            <p class="pm-cart__empty">Your cart is empty — items appear here as you add them from the store.</p>
            <ul class="pm-cart__lines" role="list"></ul>
            <p class="pm-cart__total"><span>Total</span> <span class="pm-cart__price" data-pm-cart-total>—</span></p>
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
