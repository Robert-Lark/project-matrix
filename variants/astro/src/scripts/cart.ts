/**
 * Astro's add-to-cart — this variant's implementation of the cart storage
 * contract (`packages/reference/render/shell.mjs` CART_CONTRACT is the contract
 * of record; `tools/origin-suite/suite/cart.browser.test.ts` asserts this
 * file's behavior against the imported constant, for every live variant).
 *
 * The canonical SERVED state is EMPTY (ADR-0008 §7): everything here is client
 * enhancement. With JS off the button is honestly inert and the page states
 * nothing false. The cart survives a variant swap because `localStorage` is
 * same-origin and every variant agrees on one key and one value shape
 * (ADR-0004 §5) — five independent inventions would break that silently.
 *
 * Astro bundles this module into the page's one `<script>` (TypeScript, import
 * resolution, `type="module"`). It is deliberately not an island — see
 * DIFF-TO-STARTER.md.
 */
const KEY = "pm:cart";
const VERSION = 1;

interface CartItem {
  id: number;
  qty: number;
}
interface Cart {
  v: number;
  items: CartItem[];
}

const EMPTY: Cart = { v: VERSION, items: [] };

/**
 * Contract recovery rule: a missing, unparseable, or schema-failing value IS
 * the empty cart — the next successful add overwrites it. Never throws, so a
 * corrupt value can't take the masthead down with it.
 */
function read(): Cart {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return { ...EMPTY, items: [] };
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as Cart).v === VERSION &&
      Array.isArray((parsed as Cart).items) &&
      (parsed as Cart).items.every(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          Number.isInteger(item.id) &&
          Number.isInteger(item.qty) &&
          item.qty >= 1,
      ) &&
      // One entry per release id (contract). Unchecked until 2026-08-15,
      // which let a duplicate read as valid and then be counted differently
      // by different surfaces.
      new Set((parsed as Cart).items.map((item) => item.id)).size ===
        (parsed as Cart).items.length
    ) {
      return parsed as Cart;
    }
  } catch {
    /* fall through to the empty cart */
  }
  return { ...EMPTY, items: [] };
}

const total = (cart: Cart): number => cart.items.reduce((n, item) => n + item.qty, 0);

/**
 * Contract Badge + Label. The badge caps at "9+" because the slot reserves
 * `min-width: 2.4ch` (masthead.css) and an uncapped three-digit count would
 * widen it — a layout shift the shell must never manufacture. The exact number
 * still reaches assistive tech through the anchor's accessible name, since the
 * count span itself is `aria-hidden`.
 */
function renderCount(count: number): void {
  const badge = count === 0 ? "" : count > 9 ? "9+" : String(count);
  for (const slot of document.querySelectorAll("[data-pm-cart-count]")) {
    slot.textContent = badge;
  }
  for (const link of document.querySelectorAll(".pm-masthead__cart")) {
    if (count === 0) {
      // Count 0 REMOVES the attribute: the accessible name falls back to the
      // anchor's own text.
      link.removeAttribute("aria-label");
    } else {
      link.setAttribute("aria-label", `Cart, ${count} ${count === 1 ? "item" : "items"}`);
    }
  }
}

/** The release this page's button adds, from the JSON hook the document ships. */
function cartItem(): { id: number; title: string } | null {
  const el = document.getElementById("pm-cart-item");
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as { id: number; title: string };
  } catch {
    return null;
  }
}

export function mountCart(): void {
  // Every shell page load repopulates the masthead from whatever is already
  // stored — this is the mechanism that makes the cart survive a swap.
  renderCount(total(read()));

  const item = cartItem();
  const button = document.querySelector<HTMLButtonElement>(
    ".pm-editorial__feature button.pm-button",
  );
  if (item === null || button === null) return;

  button.addEventListener("click", () => {
    const cart = read();
    const existing = cart.items.find((entry) => entry.id === item.id);
    if (existing) existing.qty += 1;
    else cart.items.push({ id: item.id, qty: 1 });
    try {
      localStorage.setItem(KEY, JSON.stringify(cart));
    } catch {
      return; // storage unavailable: state unchanged, nothing announced
    }
    const count = total(cart);
    renderCount(count);
    const status = document.querySelector("[data-pm-status]");
    // textContent, never HTML (contract) — the title is tray data.
    if (status) status.textContent = `Added "${item.title}" to cart — ${count} in cart.`;
  });
}
