"use client";

import { addToCart } from "../lib/cart";

/** The page's one interaction. Consumes the cart contract via idiomatic
 *  React state: a click writes through `addToCart`, which dispatches the
 *  shared events the masthead badge and the status region listen for. */
export function AddToCartButton({
  id,
  title,
  disabled,
}: {
  id: number;
  title: string;
  disabled: boolean;
}) {
  return (
    <div>
      <button
        className="pm-button"
        type="button"
        disabled={disabled}
        onClick={() => addToCart(id, title)}
      >
        Add to cart
      </button>
    </div>
  );
}
