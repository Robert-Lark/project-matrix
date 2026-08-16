// The vanilla PDP's enhancement (pdp-build) — gallery, quantity, add-to-cart,
// and the live-origin demonstration. The canonical SERVED state is what the
// drift gate sees (JS-off, ADR-0008 §7): everything here is enhancement, and
// with JS off the page is honestly static rather than falsely interactive.
//
// The cart storage contract (packages/reference/render/shell.mjs
// CART_CONTRACT) is RE-IMPLEMENTED here rather than imported from cart.js.
// That is the same rule the variants follow between themselves — a component
// is a spec, not shared code (ADR-0003 §1) — and it keeps this paradigm's
// real shape: one request, one script, no module graph on a no-runtime
// variant. The origin suite asserts BOTH implementations against the one
// contract, so they cannot silently diverge.
/* global document, localStorage, performance */
(() => {
  const KEY = "pm:cart";

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
    // textContent, never HTML — the title is tray data.
    if (status) status.textContent = text;
  };

  renderCount(count(read()));

  /* ── Gallery ───────────────────────────────────────────────────────────
     Thumbs are buttons (never links: they change the stage, they do not
     navigate). The stage is a fixed 1:1 mat, so swapping the image cannot
     move the buy panel — CLS 0 by construction (ADR-0008 §8). A 1-image
     release has no thumb list at all and this whole block is inert. */
  const stage = document.querySelector(".pm-gallery__main");
  const thumbs = [...document.querySelectorAll(".pm-gallery__thumb")];
  for (const [index, thumb] of thumbs.entries()) {
    thumb.addEventListener("click", () => {
      const img = thumb.querySelector("img");
      if (!stage || !img) return;
      // The thumb carries the 160 px derivative; the stage wants the full
      // image, which is the same URL without the .thumb infix (ADR-0008 §11's
      // URL convention, read backwards).
      stage.src = img.src.replace(/\.thumb\.avif$/, ".avif");
      // The stage's alt is the selected image's description. The thumb's own
      // <img> is alt="" (decorative — the button is named by its sr-only
      // span), so the accessible description comes from that span's text
      // after the "View image N of M: " prefix the contract fixes.
      const label = thumb.querySelector(".pm-sr-only")?.textContent ?? "";
      const described = label.replace(/^View image \d+ of \d+: /, "");
      if (described) stage.alt = described;
      for (const [i, other] of thumbs.entries()) {
        if (i === index) other.setAttribute("aria-current", "true");
        else other.removeAttribute("aria-current");
      }
    });
  }

  /* ── Zoom ──────────────────────────────────────────────────────────────
     A real toggle button. State lives on `aria-pressed` — a native attribute
     that is BOTH the accessible state and the selector gallery.css scales the
     stage from, so a visual state cannot exist without the programmatic one
     (ADR-0003 §5, the same rule the stepper and the thumbs follow).

     This shipped INERT on 500 deployed pages: the markup announced "Zoom,
     toggle button, not pressed" and nothing anywhere wrote the attribute
     (`aria-pressed` is not CSS-settable), so pressing it did nothing forever
     — WCAG 4.1.2 name/role/value. Zoom deliberately survives a thumb switch:
     the visitor asked to look closely, and swapping the image does not
     withdraw that request. */
  const zoom = document.querySelector(".pm-gallery__zoom");
  if (zoom) {
    zoom.addEventListener("click", () => {
      zoom.setAttribute(
        "aria-pressed",
        zoom.getAttribute("aria-pressed") === "true" ? "false" : "true",
      );
    });
  }

  /* ── Quantity ──────────────────────────────────────────────────────────
     The steppers drive the native number input and stay inside its own
     min/max, so keyboard, spinner and buttons cannot disagree. State lives
     on the input (a native attribute), never in a JS variable — the DS rule
     that a visual defect cannot exist without the programmatic one. */
  const qty = document.getElementById("qty");
  const steppers = [...document.querySelectorAll(".pm-qty__step")];
  const qtyMin = () => parseInt(qty?.min || "1", 10);
  const qtyMax = () => parseInt(qty?.max || "99", 10);
  // `max` does NOT constrain typed input — it only fails constraint
  // validation, and this input is in no form, so validation never runs
  // (MDN, input/number: "You can still manually enter a number outside
  // these bounds"). Clamping HERE is what makes the comment above true:
  // before this, typing 250 added 250 to the cart, and then pressing
  // "Increase quantity" DROPPED the field to 99.
  const qtyValue = () => {
    const parsed = parseInt(qty?.value ?? "1", 10);
    if (!Number.isFinite(parsed)) return qtyMin();
    return Math.min(qtyMax(), Math.max(qtyMin(), parsed));
  };
  if (qty && steppers.length === 2) {
    const step = (delta) => {
      qty.value = String(
        Math.min(qtyMax(), Math.max(qtyMin(), qtyValue() + delta)),
      );
    };
    steppers[0].addEventListener("click", () => step(-1));
    steppers[1].addEventListener("click", () => step(1));
    // A typed value out of range is normalised as soon as the field is
    // left, so what the visitor sees is what add-to-cart will use.
    qty.addEventListener("change", () => {
      qty.value = String(qtyValue());
    });
  }

  /* ── Add to cart ───────────────────────────────────────────────────────
     Unlike editorial's single-unit button, the PDP adds the CHOSEN quantity.
     The next cart is built immutably: a failed setItem must change nothing
     (contract), and the slice-D cart bug was exactly an in-place mutation
     surviving a failed write. */
  const itemEl = document.getElementById("pm-cart-item");
  const addButton = document.querySelector(".pm-pdp__buy button.pm-button");
  if (itemEl && addButton && !addButton.disabled) {
    const item = JSON.parse(itemEl.textContent);
    addButton.addEventListener("click", () => {
      const cart = read();
      const wanted = qtyValue();
      const items = cart.items.some((i) => i.id === item.id)
        ? cart.items.map((i) =>
            i.id === item.id ? { id: i.id, qty: i.qty + wanted } : { id: i.id, qty: i.qty },
          )
        : [...cart.items.map((i) => ({ id: i.id, qty: i.qty })), { id: item.id, qty: wanted }];
      const next = { v: 1, items };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        return; // storage unavailable: state unchanged, nothing announced
      }
      const n = count(next);
      renderCount(n);
      announce(`Added "${item.title}" to cart — ${n} in cart.`);
    });
  }

  /* ── The live-origin demonstration (ADR-0002 §3) ───────────────────────
     The ONLY serve-time Discogs call in the project, fenced from every
     number, and on demand only — never on load, so no measured path can
     touch it. The plaque's copy is the mandatory self-explaining text and is
     part of the canonical markup; this only wires its button.

     The endpoint is deliberately allowed not to exist yet: until the edge
     Worker's live route and its token secret are in place the demonstration
     says so plainly in its own output slot, which is the same rule every
     unpublished number on this site follows — state the absence, never show
     a number-shaped hole or a silent no-op. */
  const liveButton = document.querySelector(".pm-plaque--fenced button.pm-button");
  const liveOutput = document.querySelector("[data-pm-live-origin]");
  if (liveButton && liveOutput && itemEl) {
    const item = JSON.parse(itemEl.textContent);
    liveButton.addEventListener("click", async () => {
      liveButton.disabled = true;
      liveOutput.textContent = "Asking the live API…";
      const started = performance.now();
      try {
        const res = await fetch(`/api/live-price/${item.id}`, {
          headers: { accept: "application/json" },
        });
        const elapsed = Math.round(performance.now() - started);
        if (!res.ok) {
          liveOutput.textContent =
            res.status === 404
              ? `The live route is not deployed yet — nothing to show, and nothing faked (${elapsed} ms to find that out).`
              : `The live origin answered ${res.status} after ${elapsed} ms. That is the cost of a dynamic origin on a bad day.`;
          return;
        }
        const body = await res.json();
        liveOutput.textContent =
          body && body.formatted
            ? `Live: ${body.formatted} · ${elapsed} ms round trip, uncached, right now.`
            : `The live origin answered in ${elapsed} ms but carried no price for this release.`;
      } catch {
        liveOutput.textContent =
          "The live call failed. That is a real property of a dynamic origin — and why the numbers on this site never depend on one.";
      } finally {
        liveButton.disabled = false;
      }
    });
  }
})();
