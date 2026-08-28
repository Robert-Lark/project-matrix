/**
 * The astro PDP's enhancement — gallery, zoom, quantity, add-to-cart, and the
 * live-origin demonstration, bundled by Astro into the PDP page's one
 * `<script>` exactly as the editorial page's cart is (the framework's
 * documented way to add interactivity without a UI framework; an island
 * would wrap content in an <astro-island> ELEMENT the master has no
 * equivalent for — DIFF-TO-STARTER).
 *
 * The cart storage contract (packages/reference/render/shell.mjs
 * CART_CONTRACT) is RE-IMPLEMENTED here rather than imported from
 * src/scripts/cart.ts, for a measured reason recorded once already on the
 * react-next side of this unit (pdp-cart.ts): editorial's published
 * initial-JS cell is pinned at its measurement SHA, and a shared import can
 * change how the bundler shapes EDITORIAL's inlined script (a module shared
 * between two entries is a candidate for extraction into a chunk both pages
 * would then fetch). Vanilla's pdp.js records the same call one paradigm
 * over. The origin suite asserts every implementation against the one
 * contract, so they cannot silently diverge.
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

/** Contract recovery rule: a missing, unparseable, or schema-failing value
 *  IS the empty cart — the next successful add overwrites it. */
function read(): Cart {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) {
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
        // One entry per release id (contract) — the uniqueness clause.
        new Set((parsed as Cart).items.map((item) => item.id)).size ===
          (parsed as Cart).items.length
      ) {
        return parsed as Cart;
      }
    }
  } catch {
    /* fall through to the empty cart */
  }
  return { v: VERSION, items: [] };
}

const total = (cart: Cart): number => cart.items.reduce((n, item) => n + item.qty, 0);

/** Badge caps at "9+" (masthead.css reserves 2.4ch); count 0 REMOVES the
 *  cart anchor's aria-label so the name falls back to the anchor text. */
function renderCount(count: number): void {
  const badge = count === 0 ? "" : count > 9 ? "9+" : String(count);
  for (const slot of document.querySelectorAll("[data-pm-cart-count]")) {
    slot.textContent = badge;
  }
  for (const link of document.querySelectorAll(".pm-masthead__cart")) {
    if (count === 0) {
      link.removeAttribute("aria-label");
    } else {
      link.setAttribute("aria-label", `Cart, ${count} ${count === 1 ? "item" : "items"}`);
    }
  }
}

function announce(text: string): void {
  const status = document.querySelector("[data-pm-status]");
  // textContent, never HTML — the title is tray data.
  if (status) status.textContent = text;
}

/** The release this page's buttons act on, from the JSON hook the document
 *  ships (delivery, not contract — ADR-0008's freedoms name `script`). */
function cartItem(): { id: number; title: string } | null {
  const el = document.getElementById("pm-cart-item");
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as { id: number; title: string };
  } catch {
    return null;
  }
}

export function mountPdp(): void {
  renderCount(total(read()));

  /* ── Gallery: thumbs switch the stage (src + alt + exclusive
        aria-current); the stage's width/height stay the first image's — the
        fixed 1:1 mat means a switch can never move the buy panel. */
  const stage = document.querySelector<HTMLImageElement>(".pm-gallery__main");
  const thumbs = [...document.querySelectorAll<HTMLButtonElement>(".pm-gallery__thumb")];
  for (const [index, thumb] of thumbs.entries()) {
    thumb.addEventListener("click", () => {
      const img = thumb.querySelector("img");
      if (!stage || !img) return;
      // The thumb carries the 160 px derivative; the stage wants the full
      // image — the same URL without the .thumb infix (ADR-0008 §11's URL
      // convention, read backwards).
      stage.src = img.src.replace(/\.thumb\.avif$/, ".avif");
      const label = thumb.querySelector(".pm-sr-only")?.textContent ?? "";
      const described = label.replace(/^View image \d+ of \d+: /, "");
      if (described) stage.alt = described;
      for (const [i, other] of thumbs.entries()) {
        if (i === index) other.setAttribute("aria-current", "true");
        else other.removeAttribute("aria-current");
      }
    });
  }

  /* ── Zoom: a real toggle — aria-pressed is BOTH the accessible state and
        the selector gallery.css scales from. Survives a thumb switch. */
  const zoom = document.querySelector(".pm-gallery__zoom");
  if (zoom) {
    zoom.addEventListener("click", () => {
      zoom.setAttribute(
        "aria-pressed",
        zoom.getAttribute("aria-pressed") === "true" ? "false" : "true",
      );
    });
  }

  /* ── Quantity: steppers drive the native input inside its own min/max;
        state lives on the input, never a JS variable. `max` does not
        constrain typed input (no form → no constraint validation), so the
        change-normalise is what keeps the displayed value the value
        add-to-cart will use. */
  const qty = document.getElementById("qty") as HTMLInputElement | null;
  const steppers = [...document.querySelectorAll<HTMLButtonElement>(".pm-qty__step")];
  const qtyMin = () => parseInt(qty?.min || "1", 10);
  const qtyMax = () => parseInt(qty?.max || "99", 10);
  const qtyValue = () => {
    const parsed = parseInt(qty?.value ?? "1", 10);
    if (!Number.isFinite(parsed)) return qtyMin();
    return Math.min(qtyMax(), Math.max(qtyMin(), parsed));
  };
  if (qty && steppers.length === 2) {
    const step = (delta: number) => {
      qty.value = String(Math.min(qtyMax(), Math.max(qtyMin(), qtyValue() + delta)));
    };
    steppers[0]!.addEventListener("click", () => step(-1));
    steppers[1]!.addEventListener("click", () => step(1));
    qty.addEventListener("change", () => {
      qty.value = String(qtyValue());
    });
  }

  /* ── Add to cart: the CHOSEN quantity (CART_CONTRACT's quantity clause —
        the PDP is the only writer of qty > 1). Immutable next cart: a failed
        setItem must change nothing. Not wired when disabled (unpriced). */
  const item = cartItem();
  const addButton = document.querySelector<HTMLButtonElement>(".pm-pdp__buy button.pm-button");
  if (item && addButton && !addButton.disabled) {
    addButton.addEventListener("click", () => {
      const cart = read();
      const wanted = qtyValue();
      const items = cart.items.some((i) => i.id === item.id)
        ? cart.items.map((i) =>
            i.id === item.id ? { id: i.id, qty: i.qty + wanted } : { id: i.id, qty: i.qty },
          )
        : [...cart.items.map((i) => ({ id: i.id, qty: i.qty })), { id: item.id, qty: wanted }];
      const next = { v: VERSION, items };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        return; // storage unavailable: state unchanged, nothing announced
      }
      const n = total(next);
      renderCount(n);
      announce(`Added "${item.title}" to cart — ${n} in cart.`);
    });
  }

  /* ── The live-origin demonstration (ADR-0002 §3): on demand only, fenced
        from every number; the endpoint is allowed not to exist yet and the
        output says so plainly (vanilla's copy verbatim). */
  const liveButton = document.querySelector<HTMLButtonElement>(
    ".pm-plaque--fenced button.pm-button",
  );
  const liveOutput = document.querySelector("[data-pm-live-origin]");
  if (liveButton && liveOutput && item) {
    liveButton.addEventListener("click", async () => {
      liveButton.disabled = true;
      liveOutput.textContent = "Asking the live API…";
      const started = performance.now();
      try {
        const res = await fetch(`/api/live-price/${item.id}`, {
          headers: { accept: "application/json" },
        });
        const elapsed = Math.round(performance.now() - started);
        if (!res.ok) {
          liveOutput.textContent =
            res.status === 404
              ? `The live route is not deployed yet — nothing to show, and nothing faked (${elapsed} ms to find that out).`
              : `The live origin answered ${res.status} after ${elapsed} ms. That is the cost of a dynamic origin on a bad day.`;
          return;
        }
        const body = (await res.json()) as { formatted?: string } | null;
        liveOutput.textContent =
          body && body.formatted
            ? `Live: ${body.formatted} · ${elapsed} ms round trip, uncached, right now.`
            : `The live origin answered in ${elapsed} ms but carried no price for this release.`;
      } catch {
        liveOutput.textContent =
          "The live call failed. That is a real property of a dynamic origin — and why the numbers on this site never depend on one.";
      } finally {
        liveButton.disabled = false;
      }
    });
  }
}
