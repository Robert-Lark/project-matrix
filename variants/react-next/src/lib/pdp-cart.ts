// The PDP's cart write (CART_CONTRACT's quantity clause: a surface WITH a
// quantity control adds the CHOSEN quantity — the PDP is the only writer of
// qty > 1).
//
// FULLY SELF-CONTAINED, deliberately — no import from cart.ts, not even the
// constants. Two measured reasons, both about editorial's published,
// SHA-pinned initial-JS cell:
//  1. extending cart.ts's addToCart with a qty parameter changed editorial's
//     served chunk bytes directly;
//  2. merely IMPORTING cart.ts's helpers from here changed them too — the
//     new importer kept `announce` and `CART_KEY` from being tree-shaken out
//     of editorial's chunk (+494 raw bytes across the two cart-adjacent
//     chunks, measured against the deployed plane, prettified-diff-verified).
// Duplication is the recorded cost of keeping editorial's wire bytes
// byte-identical to production; vanilla makes the same call one paradigm
// over (its pdp.js re-implements the contract rather than importing
// cart.js). The contract of record is packages/reference/render/shell.mjs
// CART_CONTRACT; the origin suite holds both implementations to it, so they
// cannot silently diverge (the same mechanism that keeps the seven read()
// implementations honest).
//
// The event names couple this module to CartCount/CartStatus (they listen on
// window) — pdp-controls.browser.test.ts proves the badge and announcement
// end-to-end per variant, so a drifted string fails a suite, not a visitor.

const CART_KEY = "pm:cart";
const CART_CHANGED_EVENT = "pm:cart-changed";
const CART_ANNOUNCE_EVENT = "pm:cart-announce";

interface CartItem {
  id: number;
  qty: number;
}

interface Cart {
  v: 1;
  items: CartItem[];
}

const EMPTY_CART: Cart = { v: 1, items: [] };

function isValidCart(value: unknown): value is Cart {
  if (value == null || typeof value !== "object") return false;
  const cart = value as { v?: unknown; items?: unknown };
  return (
    cart.v === 1 &&
    Array.isArray(cart.items) &&
    cart.items.every(
      (i): i is CartItem =>
        i != null &&
        typeof i === "object" &&
        Number.isInteger((i as CartItem).id) &&
        Number.isInteger((i as CartItem).qty) &&
        (i as CartItem).qty >= 1,
    ) &&
    // One entry per release id (contract) — the uniqueness clause, checked
    // in every read() implementation since 2026-08-15.
    new Set(cart.items.map((i) => (i as CartItem).id)).size === cart.items.length
  );
}

/** Recovery rule: a missing, unparseable, or schema-failing value is the
 *  EMPTY cart — the next successful add overwrites it. */
function readCart(): Cart {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CART_KEY) ?? "");
    if (isValidCart(parsed)) return parsed;
  } catch {
    /* fall through to the empty cart */
  }
  return EMPTY_CART;
}

/** Add `qty` units of `id`. Returns the new count, or `null` if storage
 *  failed (quota, storage off) — the contract: state unchanged, nothing
 *  announced. Immutable next-cart construction for the reason cart.ts's
 *  addToCart records (a failed setItem must change nothing). */
export function addToCartQty(id: number, title: string, qty: number): number | null {
  const current = readCart();
  const existing = current.items.find((i) => i.id === id);
  const cart: Cart = existing
    ? {
        v: 1,
        items: current.items.map((i) =>
          i.id === id ? { ...i, qty: i.qty + qty } : i,
        ),
      }
    : { v: 1, items: [...current.items, { id, qty }] };
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    return null;
  }
  const n = cart.items.reduce((sum, item) => sum + item.qty, 0);
  window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT, { detail: { count: n } }));
  window.dispatchEvent(
    new CustomEvent(CART_ANNOUNCE_EVENT, {
      detail: { message: `Added "${title}" to cart — ${n} in cart.` },
    }),
  );
  return n;
}
