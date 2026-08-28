import { Slot, component$, useContextProvider, useStore } from "@builder.io/qwik";
import { CartContext, type CartStore } from "../lib/cart";
import { HOSTS } from "../lib/hosts";
import { CartCount } from "./CartCount";
import { CartStatus } from "./CartStatus";

/**
 * The shared shell (`packages/reference/render/shell.mjs` `shell()`, ported):
 * skip link, chrome slot, masthead · main · status live region · footer.
 * `current` marks which masthead link is the surface being viewed — always
 * "editorial" in this slice, kept as a parameter so PDP/PLP can reuse this
 * component untouched.
 *
 * This is where the cart store is PROVIDED, and it deliberately does not READ
 * it. That matters for more than tidiness: Qwik subscribes a component to the
 * exact store properties its render function touches, so a cart change
 * re-renders `CartCount` and `CartStatus` and never this component — which is
 * what keeps the chrome the front Worker streams into `#pm-chrome-slot`
 * safe. Slice B lost that subtree on every slow-CPU load because react-dom's
 * hydration walk re-rendered the containing tree and discarded children React
 * had not authored (a real shipped CLS bug, found as a CI-only flake). Here
 * there is no hydration walk at all, and the containing component is not a
 * subscriber; a browser test asserts the injected children survive a click
 * rather than trusting that argument.
 */
export const Shell = component$<{ current?: "plp" | "editorial" }>(({ current }) => {
  useContextProvider(CartContext, useStore<CartStore>({ count: 0, message: "" }));

  return (
    <>
      <a class="pm-skip pm-button" href="#main">
        Skip to content
      </a>
      <div id="pm-chrome-slot"></div>
      <div class="pm-page">
        <header class="pm-masthead">
          <a class="pm-masthead__brand" href="/">
            {"Long Decay"}
            <span>{" Records"}</span>
          </a>
          <nav class="pm-masthead__nav" aria-label="Store">
            <a
              class="pm-masthead__link"
              href={HOSTS.plp}
              aria-current={current === "plp" ? "page" : undefined}
            >
              Records
            </a>
            <a
              class="pm-masthead__link"
              href={HOSTS.editorial}
              aria-current={current === "editorial" ? "page" : undefined}
            >
              Editorial
            </a>
          </nav>
          <CartCount />
        </header>
        <main id="main">
          <Slot />
        </main>
        <CartStatus />
        <footer class="pm-footer">
          <p class="pm-footer__fiction">
            A working store on frozen Discogs data — nothing ships, checkout is simulated.
          </p>
          <nav class="pm-footer__nav" aria-label="About this site">
            <a href="/">What is this?</a>
            <a href={HOSTS.a11y}>Accessibility, shown</a>
            <a href={HOSTS.howBuilt}>How it was built</a>
            <a href="https://github.com/Robert-Lark/project-matrix" rel="noopener">
              GitHub
            </a>
          </nav>
        </footer>
      </div>
    </>
  );
});
