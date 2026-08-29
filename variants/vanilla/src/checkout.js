// The vanilla checkout's enhancement (checkout-vanilla) — order summary,
// shipping method, card/expiry formatting, per-field validation, and the
// invalid-submit error summary. This is the surface whose measured question
// is INP under main-thread load, so every behavior here is work a real
// checkout genuinely does; none of it is padding added to make a number.
//
// The canonical SERVED state is what the drift gate sees (JS-off, ADR-0008
// §7): a pristine form and an EMPTY order summary with reserved geometry
// (cart-summary.css `min-block-size: 12rem`). Everything below is
// enhancement — with JS off the fields, labels, hints and the browser's own
// constraint validation still work, which is what the page says on itself.
//
// The cart storage contract (packages/reference/render/shell.mjs
// CART_CONTRACT) is RE-IMPLEMENTED here rather than imported from cart.js,
// for the reason pdp.js records: a component is a spec, not shared code
// (ADR-0003 §1), and this paradigm's real shape is one request, one script,
// no module graph. That makes this the THIRD vanilla `read()`; the
// uniqueness clause is checked here exactly as it is in the other two.
/* global document, localStorage */
(() => {
  const KEY = "pm:cart";
  /** Express shipping, in the same units the trays price in (USD). The
   *  served markup states "$12.00" in the option label; this constant and
   *  that label are the same number in two places, and the pre-merge guard
   *  asserts they agree so they cannot drift apart. */
  const EXPRESS_SHIPPING = 12;

  /* ── The cart contract (CART_CONTRACT) ───────────────────────────────── */

  // Contract recovery rule: a missing, unparseable, or schema-failing value
  // is the EMPTY cart — the next successful add overwrites it.
  const read = () => {
    try {
      const cart = JSON.parse(localStorage.getItem(KEY) ?? "");
      if (
        cart &&
        cart.v === 1 &&
        Array.isArray(cart.items) &&
        cart.items.every(
          (i) => i && Number.isInteger(i.id) && Number.isInteger(i.qty) && i.qty >= 1,
        ) &&
        // One entry per release id (contract). Unchecked until 2026-08-15,
        // which let a duplicate read as valid and then be counted differently
        // by different surfaces.
        new Set(cart.items.map((i) => i.id)).size === cart.items.length
      ) {
        return cart;
      }
    } catch {
      /* fall through to the empty cart */
    }
    return { v: 1, items: [] };
  };
  const count = (cart) => cart.items.reduce((n, item) => n + item.qty, 0);
  const renderCount = (n) => {
    for (const slot of document.querySelectorAll("[data-pm-cart-count]")) {
      slot.textContent = n > 0 ? (n > 9 ? "9+" : String(n)) : "";
    }
    for (const link of document.querySelectorAll(".pm-masthead__cart")) {
      if (n > 0) {
        link.setAttribute("aria-label", `Cart, ${n} ${n === 1 ? "item" : "items"}`);
      } else {
        link.removeAttribute("aria-label");
      }
    }
  };
  const announce = (text) => {
    const status = document.querySelector("[data-pm-status]");
    // textContent, never HTML — catalogue titles are tray data.
    if (status) status.textContent = text;
  };

  const cart = read();
  renderCount(count(cart));

  /** Canonical price formatting (lib.mjs rules of record), re-implemented:
   *  "$" + two decimals + "," thousands for USD. `Intl.NumberFormat` is
   *  deliberately not used — the reference rules are what every surface
   *  renders, and Intl drifts on the first four-digit total. */
  const formatUsd = (amount) => {
    const [int, frac] = amount.toFixed(2).split(".");
    return `$${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
  };

  /* ── The order summary ────────────────────────────────────────────────
     Cart is localStorage, so NO paradigm can serve cart contents (ADR-0008
     §7) — every checkout variant has to look the ids up client-side. This
     one fetches a build-time index of the served snapshot, and ONLY when
     the cart is non-empty: the canonical served state is the empty cart,
     which is the state the instrument measures, so the measured page pays
     nothing for this. Baking the index INTO the page was rejected for
     exactly that reason — 38,968 B of crate catalogue on the flagship INP
     page, spent on a state the measurement never enters, would have
     manufactured a paradigm cost the way the routed vitals capture
     manufactured qwik's (PR #35).

     Reserved geometry means population cannot shift the form beside it, so
     arriving late is a correctness question, not a layout one. */
  const lines = document.querySelector(".pm-cart__lines");
  const empty = document.querySelector(".pm-cart__empty");
  const totalSlot = document.querySelector("[data-pm-cart-total]");
  /** null until the catalogue resolves; then id → { title, price, thumb }. */
  let catalogue = null;

  /** The chosen shipping method.
   *
   *  Reads each radio's CHECKEDNESS rather than selecting `:checked`, and the
   *  difference is verifiability, not correctness: both are right in a
   *  browser, but `:checked` is only provable on a live plane, and checkout
   *  has no browser leg in the origin suite yet (this unit's build log
   *  records that as owed). Walking the group is exactly as honest and can
   *  be proven in-process before merge, which is the standard this repo
   *  holds every other claim to. */
  const selectedShipping = () => {
    for (const radio of document.querySelectorAll(".pm-format__input")) {
      if (radio.checked) return radio.value;
    }
    return "standard"; // the served default; a group with nothing checked is not reachable
  };
  const shippingCost = () => (selectedShipping() === "express" ? EXPRESS_SHIPPING : 0);

  const renderSummary = () => {
    if (!lines || !totalSlot) return;
    if (cart.items.length === 0) return; // canonical served state; leave it
    if (catalogue === null) return; // not resolved yet, or unavailable

    lines.textContent = "";
    let subtotal = 0;
    let incomplete = false;
    for (const item of cart.items) {
      const entry = catalogue[String(item.id)];
      const li = document.createElement("li");
      li.className = "pm-cart__line";
      const img = document.createElement("img");
      img.width = 44;
      img.height = 44;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      if (entry && entry.thumb) img.src = entry.thumb;
      const what = document.createElement("span");
      what.className = "pm-cart__what";
      // An id the served snapshot does not carry is stated, never guessed:
      // the cart survives a snapshot change (same-origin storage outlives
      // a re-freeze), so this arm is reachable without anyone misbehaving.
      what.textContent = entry
        ? `${entry.title} × ${item.qty}`
        : `Release ${item.id} × ${item.qty} — no longer in this crate`;
      const price = document.createElement("span");
      price.className = "pm-cart__price";
      if (entry && typeof entry.price === "number") {
        subtotal += entry.price * item.qty;
        price.textContent = formatUsd(entry.price * item.qty);
      } else {
        // The named-glyph rule (lib.mjs namedGlyph): a lone em dash
        // announces as "em dash" or as silence, so absent data and a
        // rendering fault would sound alike.
        incomplete = true;
        const glyph = document.createElement("span");
        glyph.setAttribute("aria-hidden", "true");
        glyph.textContent = "—";
        const named = document.createElement("span");
        named.className = "pm-sr-only";
        named.textContent = "No price listed";
        price.append(glyph, named);
      }
      li.append(img, what, price);
      lines.append(li);
    }
    if (empty) empty.hidden = true;

    totalSlot.textContent = "";
    if (incomplete) {
      // State the absence rather than publish a total that silently omits
      // an unpriced line — the same rule every unpublished number here
      // follows.
      const glyph = document.createElement("span");
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = "—";
      const named = document.createElement("span");
      named.className = "pm-sr-only";
      named.textContent = "Total unavailable — an item in this cart has no price";
      totalSlot.append(glyph, named);
    } else {
      totalSlot.textContent = formatUsd(subtotal + shippingCost());
    }
  };

  if (cart.items.length > 0 && lines) {
    fetch("../assets/cart-catalogue.json", { headers: { accept: "application/json" } })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        catalogue = body && body.v === 1 && body.items ? body.items : null;
        renderSummary();
      })
      .catch(() => {
        // The summary stays in its served empty state and says nothing
        // false; the masthead count still shows what is stored.
      });
  }

  /* ── Shipping method ──────────────────────────────────────────────────
     A real choice, and the surviving consumer of format-switch.css
     (ADR-0008 addendum A). The browser owns the exclusive selection; what
     this owes is the consequence — the total moves. With an empty cart the
     recompute is correctly a no-op: there is no order to price yet. */
  for (const radio of document.querySelectorAll(".pm-format__input")) {
    radio.addEventListener("change", renderSummary);
  }

  /* ── The form ─────────────────────────────────────────────────────────── */

  const form = document.querySelector(".pm-checkout__form");
  if (!form) return;
  // The served markup carries NO `novalidate`, deliberately: JS-off, native
  // constraint validation is the real behavior the page claims
  // (checkout.mjs:9-12). This is the hydration moment where this paradigm's
  // own validation takes over, so the attribute goes on now — never in the
  // master, where it would disable the JS-off behavior the page states.
  //
  // This line is what lets the master carry `required`/`pattern` at all: they
  // would otherwise fire BEFORE the submit handler below and the error
  // summary would never render. Order matters — this runs before the card
  // formatter binds at :253, so the spaced value the formatter produces
  // ("4111 1111 1111 1111") is never measured against `pattern="\d{13,19}"`.
  form.setAttribute("novalidate", "");

  /* ── Card and expiry formatting ───────────────────────────────────────
     The card field's own hint promises this ("Formats as you type — that
     formatting is part of what this page measures"), so it is contract, not
     decoration. The caret is recomputed from the DIGIT count before it, not
     parked at the end: typing into the middle of a saved card number is the
     ordinary case, and jumping the caret would be a defect nobody would
     see in a benchmark trace. */
  const formatCard = (digits) => (digits.match(/.{1,4}/g) ?? []).join(" ");
  const formatExpiry = (digits) =>
    digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;

  const bindFormatter = (el, maxDigits, format) => {
    if (!el) return;
    el.addEventListener("input", () => {
      const before = el.value.slice(0, el.selectionStart ?? el.value.length);
      const digitsBefore = (before.match(/\d/g) ?? []).length;
      const digits = (el.value.match(/\d/g) ?? []).join("").slice(0, maxDigits);
      const next = format(digits);
      if (next === el.value) return;
      el.value = next;
      // Walk forward past separators until `digitsBefore` digits are behind
      // the caret — the position the same number of keystrokes would reach.
      let seen = 0;
      let at = 0;
      while (at < next.length && seen < digitsBefore) {
        if (/\d/.test(next[at])) seen += 1;
        at += 1;
      }
      el.setSelectionRange(at, at);
    });
  };
  bindFormatter(document.getElementById("card"), 19, formatCard);
  bindFormatter(document.getElementById("expiry"), 4, formatExpiry);

  /* ── Validation ───────────────────────────────────────────────────────
     Rules are the enhancement's, and the served markup now expresses the
     SAME set: every id below carries `required` in the master, and the three
     with a shape test (card, expiry, cvc) carry the matching `pattern`. So
     JS-off validation is this list, not a thinner cousin of it — the earlier
     asymmetry (email's shape and nothing else) was the page claiming "native
     validation" while gating nothing, and it is gone.

     What JavaScript still adds, and what the comparison is actually about:
     per-field messages in the page's own words, `aria-invalid` wiring, the
     error summary with its focus move, and live card formatting. Native
     validation gates; the enhancement explains.

     The error state styles off `[aria-invalid]` and never off a class
     (field.css:7-8), so the visual defect cannot exist without the
     programmatic one — which makes `aria-invalid` the script-only state
     this surface owes, exactly as `aria-pressed` was the PDP's. */
  const RULES = [
    { id: "email", message: "Enter an email address", test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) },
    { id: "name", message: "Enter the name this ships to" },
    { id: "address1", message: "Enter a street address" },
    { id: "city", message: "Enter a city" },
    { id: "postal", message: "Enter a postal code" },
    { id: "region", message: "Enter a state or region" },
    {
      id: "card",
      message: "Enter a card number of 13 to 19 digits",
      test: (v) => /^\d{13,19}$/.test(v.replace(/\s/g, "")),
    },
    { id: "cardname", message: "Enter the name on the card" },
    {
      id: "expiry",
      message: "Enter an expiry date as MM/YY",
      test: (v) => /^(0[1-9]|1[0-2])\/\d{2}$/.test(v),
    },
    { id: "cvc", message: "Enter the 3- or 4-digit security code", test: (v) => /^\d{3,4}$/.test(v) },
  ];

  /** The field's own error paragraph, created on first failure and reused. */
  const errorSlotFor = (input) => {
    const row = input.closest(".pm-field");
    if (!row) return null;
    let slot = row.querySelector(".pm-field__error");
    if (!slot) {
      slot = document.createElement("p");
      slot.className = "pm-field__error";
      slot.id = `${input.id}-error`;
      row.append(slot);
    }
    return slot;
  };

  /** Point the control's description at its error while one stands, and put
   *  the hint back when it clears — a field with a hint has both to say. */
  const describedBy = (input, errorId) => {
    const hint = document.getElementById(`${input.id}-hint`) ? `${input.id}-hint` : null;
    const parts = [hint, errorId].filter(Boolean);
    if (parts.length > 0) input.setAttribute("aria-describedby", parts.join(" "));
    else input.removeAttribute("aria-describedby");
  };

  const checkField = (rule) => {
    const input = document.getElementById(rule.id);
    if (!input) return null;
    const value = input.value.trim();
    const ok = value !== "" && (rule.test ? rule.test(value) : true);
    const slot = errorSlotFor(input);
    if (ok) {
      input.removeAttribute("aria-invalid");
      if (slot) slot.remove();
      describedBy(input, null);
      return null;
    }
    input.setAttribute("aria-invalid", "true");
    if (slot) slot.textContent = rule.message;
    describedBy(input, slot ? slot.id : null);
    return { id: rule.id, message: rule.message };
  };

  // Validate on BLUR, never on every keystroke: telling someone their email
  // is invalid while they are still typing it is the standard way this
  // pattern goes wrong.
  //
  // Bound by walking the form's OWN controls rather than by looking each
  // rule's id up, so a field that gains a rule is wired by existing, and a
  // field with no rule (`address2` is optional, `country` is a select with a
  // default) is still visibly accounted for here rather than absent.
  for (const input of form.querySelectorAll(".pm-field__control")) {
    const rule = RULES.find((r) => r.id === input.id);
    if (!rule) continue;
    input.addEventListener("blur", () => {
      // Only re-check a field the visitor has actually filled or already
      // failed — blurring an untouched field should not accuse it.
      if (input.value.trim() !== "" || input.getAttribute("aria-invalid") === "true") {
        checkField(rule);
      }
    });
  }

  /* ── Invalid submit ───────────────────────────────────────────────────
     The contract (ADR-0008 §7, error-summary.css): the error-summary region
     renders at the top of the form with a heading and a link per invalid
     field, and RECEIVES FOCUS. Identical DOM + focus work in every
     paradigm, so the flagship INP comparison compares like work. */
  const ERROR_SUMMARY_ID = "checkout-errors";
  const renderErrorSummary = (failures) => {
    document.querySelector(".pm-error-summary")?.remove();
    const section = document.createElement("section");
    section.className = "pm-error-summary";
    section.tabIndex = -1;
    section.setAttribute("aria-labelledby", ERROR_SUMMARY_ID);
    const title = document.createElement("h2");
    title.className = "pm-error-summary__title";
    title.id = ERROR_SUMMARY_ID;
    title.textContent = "Before you place the order";
    const list = document.createElement("ul");
    list.className = "pm-error-summary__list";
    list.setAttribute("role", "list");
    for (const failure of failures) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${failure.id}`;
      link.textContent = failure.message;
      li.append(link);
      list.append(li);
    }
    section.append(title, list);
    form.prepend(section);
    section.focus();
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault(); // nothing is submitted anywhere; the page says so
    const failures = RULES.map(checkField).filter(Boolean);
    if (failures.length > 0) {
      renderErrorSummary(failures);
      announce(
        `${failures.length} ${failures.length === 1 ? "problem" : "problems"} to fix before placing the order.`,
      );
      return;
    }
    document.querySelector(".pm-error-summary")?.remove();
    // The email field's own hint promises this and scopes it: "Used only to
    // render the demo confirmation in this page — nothing is ever sent." So
    // the address has to actually appear here, and it has to stay in the
    // page. textContent, never HTML: this is the one string on the surface
    // built from something a visitor typed.
    const to = document.getElementById("email")?.value.trim() ?? "";
    const method = selectedShipping() === "express" ? "Express" : "Standard";
    announce(
      `Order placed — a demonstration, so nothing ships and nothing was sent. ` +
        `${method} shipping; a confirmation would go to ${to}.`,
    );
  });
})();
