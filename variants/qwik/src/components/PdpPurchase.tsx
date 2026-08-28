import { component$, useContext, useSignal } from "@builder.io/qwik";
import { CartContext } from "../lib/cart";
import { addToCartQty } from "../lib/pdp-cart";

/**
 * The quantity stepper + add-to-cart. The input is UNCONTROLLED (the DS
 * rule: state lives on the native attribute, never a framework variable),
 * and the clamp rides qwik's `onChange$` — which IS the native commit event
 * (Enter, the spinner, leaving the field), the vanilla-parity semantics the
 * react-next slice had to attach by hand after verify-slice reproduced its
 * blur-only draft diverging on Enter-commit.
 *
 * `max` does NOT constrain typed input (the field is in no form, so
 * constraint validation never runs) — the clamp is this enhancement's.
 * A successful add updates the shared CartContext store (badge + status),
 * exactly as editorial's AddToCartButton does; a failed setItem changes
 * nothing and announces nothing (the contract).
 */
// Exported, not for consumers: an identifier captured inside a `$` scope
// must be importable by the QRL chunk the optimizer extracts it into.
export const clamp = (el: HTMLInputElement): number => {
  const min = parseInt(el.min || "1", 10);
  const max = parseInt(el.max || "99", 10);
  const parsed = parseInt(el.value ?? "1", 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min;
};

export const PdpPurchase = component$<{ id: number; title: string; sold: boolean }>(
  ({ id, title, sold }) => {
    const cart = useContext(CartContext);
    const input = useSignal<HTMLInputElement>();

    return (
      <>
        <div class="pm-qty">
          <label class="pm-qty__label" for="qty">
            Quantity
          </label>
          <div class="pm-qty__group">
            <button
              class="pm-qty__step"
              type="button"
              onClick$={() => {
                const el = input.value;
                if (!el) return;
                const min = parseInt(el.min || "1", 10);
                el.value = String(Math.max(min, clamp(el) - 1));
              }}
            >
              <span aria-hidden="true">−</span>
              <span class="pm-sr-only">Decrease quantity</span>
            </button>
            <input
              ref={input}
              class="pm-qty__input"
              id="qty"
              name="qty"
              type="number"
              {...{ inputmode: "numeric" }}
              min="1"
              max="99"
              value="1"
              onChange$={(_, el) => {
                el.value = String(clamp(el));
              }}
            />
            <button
              class="pm-qty__step"
              type="button"
              onClick$={() => {
                const el = input.value;
                if (!el) return;
                const max = parseInt(el.max || "99", 10);
                el.value = String(Math.min(max, clamp(el) + 1));
              }}
            >
              <span aria-hidden="true">+</span>
              <span class="pm-sr-only">Increase quantity</span>
            </button>
          </div>
        </div>
        <div>
          <button
            class="pm-button"
            type="button"
            disabled={sold}
            onClick$={() => {
              const el = input.value;
              if (sold || !el) return;
              const wanted = clamp(el);
              const count = addToCartQty(id, wanted);
              // Storage failed (quota, storage off): state unchanged,
              // nothing announced — the contract's own rule.
              if (count === null) return;
              cart.count = count;
              cart.message = `Added "${title}" to cart — ${count} in cart.`;
            }}
          >
            {sold ? "None for sale" : "Add to cart"}
          </button>
        </div>
      </>
    );
  },
);
