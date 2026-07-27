import { component$, useContext } from "@builder.io/qwik";
import { CartContext } from "../lib/cart";

/**
 * The shell's live region (WCAG 4.1.3) — a sibling of `<main>`, not inside it.
 * Starts empty (the canonical served state); a successful add sets
 * `cart.message`, and because this is the only component that reads that
 * property, Qwik re-renders this element and nothing else.
 *
 * The announcement reaches the DOM as a JSX text child, never as HTML — the
 * contract requires `textContent` semantics, and the release title is tray
 * data (ADR-0002: frozen data is still external data).
 */
export const CartStatus = component$(() => {
  const cart = useContext(CartContext);
  return (
    <p class="pm-status" role="status" data-pm-status>
      {cart.message}
    </p>
  );
});
