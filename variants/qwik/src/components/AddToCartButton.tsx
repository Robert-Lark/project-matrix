import { component$, useContext } from "@builder.io/qwik";
import { CartContext, addToCart, announce } from "../lib/cart";

/**
 * The page's one interaction, as a resumable handler: the served markup carries
 * `on:click="<chunk>#<symbol>"`, so no listener is attached at load and the
 * BINDING is deferred.
 *
 * The BYTES are not, on this page, and the earlier version of this comment
 * claimed they were. Measured against the composed origin: a JS-on load of
 * `/qwik/editorial/` fetches 7 files totalling 26.83 kB encoded / 62.16 kB
 * decoded, and clicking this button then fetches **nothing** — the handler is
 * already down. The cause is a chain worth understanding rather than hiding:
 * the cart contract requires every shell page load to repopulate the masthead
 * count from storage (ADR-0004 §5, swap survival), `CartCount` does that in a
 * `useOnDocument("qinit", …)` QRL, resolving ANY QRL needs the framework core
 * (50,917 B here) — and rollup co-located `src/lib/cart.ts` such that the
 * qinit chunk statically imports the click chunk too. So resumability defers
 * the binding, and one contractual load-time storage read pulls the rest
 * forward.
 *
 * That is a genuine paradigm result on this surface, not a defect to paper
 * over: for comparison, in the same measurement run vanilla fetched 1.35 kB
 * and astro 0 requests (its bundle is inlined, which is itself the issue-#16
 * accounting problem), while react-next fetched 145.05 kB.
 *
 * `disabled` when nothing is for sale: the master's button is honest about
 * stock, and JS-off it is inert regardless.
 */
export const AddToCartButton = component$<{
  id: number;
  title: string;
  disabled: boolean;
}>(({ id, title, disabled }) => {
  const cart = useContext(CartContext);
  return (
    <div>
      <button
        class="pm-button"
        type="button"
        disabled={disabled}
        onClick$={() => {
          const count = addToCart(id);
          // Storage failed (quota, storage off): state unchanged, nothing
          // announced — the contract's own rule.
          if (count === null) return;
          cart.count = count;
          cart.message = announce(title, count);
        }}
      >
        Add to cart
      </button>
    </div>
  );
});
