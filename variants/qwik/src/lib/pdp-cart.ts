/**
 * The PDP's cart write (CART_CONTRACT's quantity clause: a surface WITH a
 * quantity control adds the CHOSEN quantity — the PDP is the only writer of
 * qty > 1).
 *
 * FULLY SELF-CONTAINED — no import from lib/cart.ts, the unit's standing
 * byte-freeze rule (react-next's pdp-cart.ts measured why: a new importer
 * of the shared module changed its retained exports inside EDITORIAL's
 * served chunks, and editorial's published initial-JS cell is pinned at its
 * measurement SHA; on this variant cart.ts rides editorial's chunk graph the
 * same way). Storage only: the shared UI state (the masthead badge, the
 * status region) lives in the CartContext store, which the CALLING component
 * updates — qwik's flow, no window events (lib/cart.ts's header records the
 * paradigm difference).
 */

const KEY = "pm:cart";

interface CartItem {
  id: number;
  qty: number;
}

interface Cart {
  v: 1;
  items: CartItem[];
}

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
    // One entry per release id (contract) — the uniqueness clause.
    new Set(cart.items.map((i) => (i as CartItem).id)).size === cart.items.length
  );
}

/** Recovery rule: a missing, unparseable, or schema-failing value is the
 *  EMPTY cart — the next successful add overwrites it. */
function readCart(): Cart {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "");
    if (isValidCart(parsed)) return parsed;
  } catch {
    /* fall through to the empty cart */
  }
  return { v: 1, items: [] };
}

/** Add `qty` units of `id`. Returns the new count, or `null` if storage
 *  failed (quota, storage off) — the contract: state unchanged, nothing
 *  announced. Immutable next-cart construction: a failed setItem must
 *  change nothing. */
export function addToCartQty(id: number, qty: number): number | null {
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
    localStorage.setItem(KEY, JSON.stringify(cart));
  } catch {
    return null;
  }
  return cart.items.reduce((n, i) => n + i.qty, 0);
}
