"use client";

import { useEffect, useState } from "react";
import { CART_CHANGED_EVENT, badge, cartCount, cartLabel, readCart } from "../lib/cart";

/** The masthead cart anchor + count slot. Populates from storage on mount
 *  (the contract: every shell page load reflects whatever is already
 *  stored, which is what makes the cart survive a variant swap) and again
 *  whenever another island changes the cart. Server-rendered with count 0
 *  (no aria-label, empty slot) — the canonical served state. */
export function CartCount({ checkoutHref }: { checkoutHref: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(cartCount(readCart()));
    sync();
    window.addEventListener(CART_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const label = cartLabel(count);

  return (
    <a className="pm-masthead__cart" href={checkoutHref} aria-label={label ?? undefined}>
      Cart
      <span className="pm-masthead__cart-count" data-pm-cart-count="" aria-hidden="true">
        {badge(count)}
      </span>
    </a>
  );
}
