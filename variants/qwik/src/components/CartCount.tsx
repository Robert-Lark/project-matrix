import { $, component$, useContext, useOnDocument } from "@builder.io/qwik";
import { CartContext, badge, cartLabel, storedCount } from "../lib/cart";
import { HOSTS } from "../lib/hosts";

/**
 * The masthead cart anchor + count slot.
 *
 * Server-rendered with count 0 — empty slot, no `aria-label` — which is the
 * canonical served state (ADR-0008 §7) and, on this variant, is guaranteed
 * rather than arranged: nothing in this component runs on the server, and the
 * store it reads is initialised to 0 by `Shell`.
 *
 * The load-time read is `useOnDocument("qinit", …)`, not `useVisibleTask$`.
 * Both would work; the first is what Qwik's own lint rule
 * (`qwik/no-use-visible-task`, eslint-plugin-qwik) tells you to prefer, and
 * the difference is the paradigm's whole argument: a visible-task blocks
 * interaction until it has run, whereas this registers a declarative
 * `on-document:qinit` listener that the qwikloader fires once it has
 * initialised, after paint.
 *
 * It is worth being honest about what this costs, because it is the one place
 * resumability does not get to defer: the cart contract requires that "on
 * every shell page load the enhancement populates each [data-pm-cart-count]
 * slot" (CART_CONTRACT), because that is what makes the cart survive a variant
 * swap (ADR-0004 §5). Reading client storage at load is eager work by
 * definition.
 *
 * An earlier version of this comment called that "one lazy chunk at startup".
 * It is not, and the real number matters because the reading table will quote
 * it: measured against the composed origin, a JS-on load fetches **7 files,
 * 26.83 kB encoded / 62.16 kB decoded**, and the subsequent click fetches
 * nothing. Resolving this task's QRL requires the framework core (50,917 B),
 * and rollup co-located the cart module so the chunk behind this
 * `useOnDocument` statically imports the add-to-cart chunk as well. So the
 * honest statement is not "one chunk" but a causal chain: a contractual
 * load-time storage read pulls the framework core, and with it the page's whole
 * handler set, forward to load. `AddToCartButton` carries the same measurement
 * and the cross-variant comparison.
 */
export const CartCount = component$(() => {
  const cart = useContext(CartContext);

  useOnDocument(
    "qinit",
    $(() => {
      cart.count = storedCount();
    }),
  );

  const label = cartLabel(cart.count);

  return (
    <a class="pm-masthead__cart" href={HOSTS.checkout} aria-label={label ?? undefined}>
      Cart
      <span class="pm-masthead__cart-count" data-pm-cart-count aria-hidden="true">
        {badge(cart.count)}
      </span>
    </a>
  );
});
