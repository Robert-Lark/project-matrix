// Vanilla add-to-cart — the first implementation of the cart storage
// contract (packages/reference/render/shell.mjs CART_CONTRACT is the
// contract of record; the origin suite asserts this file's behavior against
// it). The canonical SERVED state stays empty (ADR-0008 §7): everything here
// is client enhancement — JS-off, the button is honestly inert and the page
// states nothing false.
/* global document, localStorage */
(() => {
  const KEY = "pm:cart";

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
        )
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
    // Badge caps at "9+" (contract): the slot reserves min-width 2.4ch, so
    // an uncapped 3-digit count would shift layout on population. The exact
    // number rides the anchor's aria-label — the count span is aria-hidden.
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

  // The cart survives a swap (ADR-0004 §5, same-origin storage): every shell
  // page load populates the masthead slot from whatever is already stored.
  renderCount(count(read()));

  const itemEl = document.getElementById("pm-cart-item");
  const button = document.querySelector(".pm-editorial__feature button.pm-button");
  if (!itemEl || !button) return;
  const item = JSON.parse(itemEl.textContent);

  button.addEventListener("click", () => {
    const cart = read();
    const existing = cart.items.find((i) => i.id === item.id);
    if (existing) existing.qty += 1;
    else cart.items.push({ id: item.id, qty: 1 });
    try {
      localStorage.setItem(KEY, JSON.stringify(cart));
    } catch {
      return; // storage unavailable: state unchanged, nothing announced
    }
    const n = count(cart);
    renderCount(n);
    const status = document.querySelector("[data-pm-status]");
    // textContent, never HTML (contract; the title is tray data).
    if (status) status.textContent = `Added "${item.title}" to cart — ${n} in cart.`;
  });
})();
