"use client";

import { useRef } from "react";
import { addToCartQty } from "../lib/pdp-cart";

/**
 * The quantity stepper + add-to-cart. The input is UNCONTROLLED on purpose:
 * the DS rule (and vanilla's precedent) is that state lives on the native
 * attribute, never in a JS variable — keyboard, spinner and buttons cannot
 * disagree, and a programmatic `.value` write (the browser suite's priming)
 * behaves identically to a visitor's typing.
 *
 * `max` does NOT constrain typed input — it only fails constraint
 * validation, and this input is in no form, so validation never runs.
 * Normalising on the NATIVE change event — the commit event (Enter, the
 * spinner, leaving the field) — is what makes the displayed value the value
 * add-to-cart will use. Deliberately not React's onChange (the input event,
 * which would clamp per keystroke) and not onBlur alone: verify-slice
 * reproduced the blur-only draft diverging from vanilla on Enter-commit
 * (vanilla clamped a typed 2501 to 99 on Enter; this stayed at 2501 until
 * blur), so the listener is attached natively, exactly as vanilla's is.
 */
export function PdpPurchase({
  id,
  title,
  sold,
}: {
  id: number;
  title: string;
  sold: boolean;
}) {
  const qtyRef = useRef<HTMLInputElement>(null);

  const qtyMin = () => parseInt(qtyRef.current?.min || "1", 10);
  const qtyMax = () => parseInt(qtyRef.current?.max || "99", 10);
  const qtyValue = () => {
    const parsed = parseInt(qtyRef.current?.value ?? "1", 10);
    if (!Number.isFinite(parsed)) return qtyMin();
    return Math.min(qtyMax(), Math.max(qtyMin(), parsed));
  };
  const step = (delta: number) => {
    const input = qtyRef.current;
    if (!input) return;
    input.value = String(Math.min(qtyMax(), Math.max(qtyMin(), qtyValue() + delta)));
  };
  const normalise = () => {
    const input = qtyRef.current;
    if (input) input.value = String(qtyValue());
  };

  return (
    <>
      <div className="pm-qty">
        <label className="pm-qty__label" htmlFor="qty">
          Quantity
        </label>
        <div className="pm-qty__group">
          <button className="pm-qty__step" type="button" onClick={() => step(-1)}>
            <span aria-hidden="true">−</span>
            <span className="pm-sr-only">Decrease quantity</span>
          </button>
          <input
            ref={(el) => {
              qtyRef.current = el;
              if (!el) return;
              el.addEventListener("change", normalise);
              return () => el.removeEventListener("change", normalise);
            }}
            className="pm-qty__input"
            id="qty"
            name="qty"
            type="number"
            inputMode="numeric"
            min="1"
            max="99"
            defaultValue="1"
          />
          <button className="pm-qty__step" type="button" onClick={() => step(1)}>
            <span aria-hidden="true">+</span>
            <span className="pm-sr-only">Increase quantity</span>
          </button>
        </div>
      </div>
      <div>
        {/* Unlike editorial's single-unit button, the PDP adds the CHOSEN
            quantity (CART_CONTRACT's quantity clause). addToCartQty announces
            through the shared events on success and stays silent on a
            failed write — state unchanged, nothing announced. */}
        <button
          className="pm-button"
          type="button"
          disabled={sold}
          onClick={sold ? undefined : () => addToCartQty(id, title, qtyValue())}
        >
          {sold ? "None for sale" : "Add to cart"}
        </button>
      </div>
    </>
  );
}
