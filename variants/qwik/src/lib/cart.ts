/**
 * The cart storage contract for this variant
 * (`packages/reference/render/shell.mjs` CART_CONTRACT is the contract of
 * record, minted by editorial-build slice A; the origin suite asserts this
 * implementation against the imported constant).
 *
 * Re-implemented as pure functions over `localStorage`, with the SHARED state
 * living in a Qwik store behind a context id (see `Shell`). That is the whole
 * paradigm difference on this surface and it is worth stating plainly:
 * react-next needed a same-window `CustomEvent` bus, because its cart pieces
 * are separate hydration islands with no common client ancestor; vanilla
 * needed `document.querySelectorAll`, because it has no component model at
 * all. Qwik's components are one resumable tree, so the masthead badge, the
 * button, and the live region simply read and write the same store — no event
 * bus, no DOM queries, and no cross-island wiring to keep in sync.
 *
 * The canonical SERVED state stays empty by construction (ADR-0008 §7):
 * nothing here runs on the server. The store starts at count 0 / message "",
 * which is exactly the master's empty masthead slot and empty status region,
 * and storage is read only from the load-time task in `CartCount`.
 */

import { createContextId } from "@builder.io/qwik";

export const CART_KEY = "pm:cart";

interface CartItem {
  id: number;
  qty: number;
}

interface Cart {
  v: 1;
  items: CartItem[];
}

/** The shared, resumable cart state. `count` and `message` are separate
 *  properties so Qwik's per-property subscriptions re-render only the badge
 *  or only the live region — never the shell that hosts the chrome slot. */
export interface CartStore {
  count: number;
  message: string;
}

/** Provided by `Shell`, consumed by the badge, the button, and the live
 *  region. A context id rather than a module-level singleton because Qwik
 *  resumes state per container, and a module singleton would be shared across
 *  containers in the same document. */
export const CartContext = createContextId<CartStore>("pm.editorial.cart");

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

/** null at 0 = REMOVE the attribute (the accessible name falls back to the
 *  anchor text). */
export function cartLabel(count: number): string | null {
  return count === 0 ? null : `Cart, ${count} ${count === 1 ? "item" : "items"}`;
}

export function announce(title: string, count: number): string {
  return `Added "${title}" to cart — ${count} in cart.`;
}

/** The stored count as of now — what the load-time task publishes into the
 *  store so the cart survives a variant swap (ADR-0004 §5). */
export function storedCount(): number {
  return cartCount(readCart());
}

/** Add one unit of `id`. Returns the new count, or `null` if storage failed
 *  (quota, storage off) — the contract: state unchanged, nothing announced. */
export function addToCart(id: number): number | null {
  const cart = readCart();
  const existing = cart.items.find((i) => i.id === id);
  const next: Cart = existing
    ? { v: 1, items: cart.items.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)) }
    : { v: 1, items: [...cart.items, { id, qty: 1 }] };
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(next));
  } catch {
    return null;
  }
  return cartCount(next);
}
