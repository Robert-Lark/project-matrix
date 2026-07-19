// The cart storage contract (packages/reference/render/shell.mjs
// CART_CONTRACT is the contract of record, minted by editorial-build slice
// A). Re-implemented here as idiomatic React state plumbing rather than
// vanilla's direct DOM manipulation: two client islands (the masthead badge
// and the add-to-cart button) share cart state through this module plus a
// same-window CustomEvent, since they sit in unrelated branches of the tree
// (no common client ancestor to lift state into — the shell is a Server
// Component). The canonical SERVED state stays empty by construction: every
// island's initial useState reads nothing from localStorage (that only
// happens in an effect, after hydration), so server-rendered HTML always
// matches the master's empty masthead slot and status region.

export const CART_KEY = "pm:cart";

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
    )
  );
}

/** Recovery rule: a missing, unparseable, or schema-failing value is the
 *  EMPTY cart — the next successful add overwrites it. */
export function readCart(): Cart {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CART_KEY) ?? "");
    if (isValidCart(parsed)) return parsed;
  } catch {
    /* fall through to the empty cart */
  }
  return EMPTY_CART;
}

export function cartCount(cart: Cart): number {
  return cart.items.reduce((n, item) => n + item.qty, 0);
}

/** Caps at "9+": the slot reserves min-width 2.4ch (masthead.css); an
 *  uncapped 3-digit count would shift layout on population. */
export function badge(count: number): string {
  return count === 0 ? "" : count > 9 ? "9+" : String(count);
}

/** null at 0 = REMOVE the attribute (name falls back to the anchor text). */
export function cartLabel(count: number): string | null {
  return count === 0 ? null : `Cart, ${count} ${count === 1 ? "item" : "items"}`;
}

export function announce(title: string, count: number): string {
  return `Added "${title}" to cart — ${count} in cart.`;
}

/** Fired with `{ count }` whenever the stored cart changes. */
export const CART_CHANGED_EVENT = "pm:cart-changed";
/** Fired with `{ message }` after a successful add — the status region's cue. */
export const CART_ANNOUNCE_EVENT = "pm:cart-announce";

/** Add one unit of `id` to the cart. Returns the new count, or `null` if
 *  storage failed (quota, storage off) — the contract: state unchanged,
 *  nothing announced. */
export function addToCart(id: number, title: string): number | null {
  const cart = readCart();
  const existing = cart.items.find((i) => i.id === id);
  if (existing) existing.qty += 1;
  else cart.items.push({ id, qty: 1 });
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    return null;
  }
  const n = cartCount(cart);
  window.dispatchEvent(new CustomEvent(CART_CHANGED_EVENT, { detail: { count: n } }));
  window.dispatchEvent(
    new CustomEvent(CART_ANNOUNCE_EVENT, { detail: { message: announce(title, n) } }),
  );
  return n;
}
