// The vanilla a11y section's enhancement (a11y-section build, 2026-09-03):
// the live-region demo's two buttons, the three mode-emulation toggles, an
// honest answer from every specimen control, and the masthead's cart badge.
// The canonical SERVED state is what the drift gate sees (JS-off, ADR-0008
// §7) and on this surface it is FULLY CONFORMANT on its own: every DS-OFF
// twin sits inside a closed <details> this script never opens, every toggle
// is served unpressed, and every demo box reads correctly with nothing
// running. Everything here is enhancement — JS-off, the demos are honestly
// static, and the live-region walkthrough says so on the page.
//
// What this script must never do, because the page promises it will not:
//  - Override the OS setting. The emulations are ADDITIVE and STAGE-SCOPED:
//    the only state written is each toggle's own `aria-pressed`, and
//    mode-demo.css applies the emulation to the ADJACENT stage from that one
//    attribute (one state, the accessible one — ADR-0003 §5). Nothing here
//    touches <html>, <body>, :root, a class, or an inline style; with a
//    toggle off no rule matches, so a real media query stays in force.
//  - Announce for the DS-OFF live-region twin. That twin writes the same text
//    into a plain element and is silent to assistive tech BY DESIGN — the
//    silence is the exhibit — so each demo writes into its OWN output slot,
//    never into the shell's status region.
//  - Touch the real cart. The demo buttons say "Add to cart" because the
//    specimen is the store's own component; the count here is the demo's and
//    the sentence says so. localStorage is READ for the badge, never written.
//
// The cart storage contract (packages/reference/render/shell.mjs
// CART_CONTRACT) is RE-IMPLEMENTED for the badge rather than imported from
// cart.js, for the reason pdp.js and checkout.js record: a component is a
// spec, not shared code (ADR-0003 §1), and this paradigm's real shape is one
// request, one script. The FOURTH vanilla `read()`; the uniqueness clause is
// checked here exactly as in the other three.
/* global document, localStorage */
(() => {
  const KEY = "pm:cart";

  /* ── The cart badge (CART_CONTRACT, read-only on this surface) ─────────
     "On every shell page load the enhancement populates each
     [data-pm-cart-count] slot" — the cart survives a swap onto this page
     too. Contract recovery rule: a missing, unparseable, or schema-failing
     value is the EMPTY cart. */
  const read = () => {
    try {
      const cart = JSON.parse(localStorage.getItem(KEY) ?? "");
      if (
        cart &&
        cart.v === 1 &&
        Array.isArray(cart.items) &&
        cart.items.every(
          (i) => i && Number.isInteger(i.id) && Number.isInteger(i.qty) && i.qty >= 1,
        ) &&
        // One entry per release id (contract). Unchecked until 2026-08-15,
        // which let a duplicate read as valid and then be counted differently
        // by different surfaces.
        new Set(cart.items.map((i) => i.id)).size === cart.items.length
      ) {
        return cart;
      }
    } catch {
      /* fall through to the empty cart */
    }
    return { v: 1, items: [] };
  };
  const count = (cart) => cart.items.reduce((n, item) => n + item.qty, 0);
  const renderCount = (n) => {
    for (const slot of document.querySelectorAll("[data-pm-cart-count]")) {
      slot.textContent = n > 0 ? (n > 9 ? "9+" : String(n)) : "";
    }
    for (const link of document.querySelectorAll(".pm-masthead__cart")) {
      if (n > 0) {
        link.setAttribute("aria-label", `Cart, ${n} ${n === 1 ? "item" : "items"}`);
      } else {
        link.removeAttribute("aria-label");
      }
    }
  };
  renderCount(count(read()));

  /** Answer in the pressed control's OWN section: a VISIBLE `role="status"`
   *  line, one per compare and per mode, so one write reaches a screen-reader
   *  user and a sighted pointer user alike AND lands where the presser is
   *  looking. Two defects the verification pass found, in order: the shell's
   *  `[data-pm-status]` is `.pm-sr-only` geometry (masthead.css: 1×1,
   *  clipped), so an answer routed there is silent to everyone who is looking
   *  rather than listening; and a single page-level line leaves the answer one
   *  to three viewports above the button — on the page whose subject is
   *  whether a control can be hit. No section-level line is a no-op rather
   *  than a fallback to the page: a silent write is the failure being fixed.
   *  textContent, never HTML. */
  const respond = (from, text) => {
    const slot = from.closest("section")?.querySelector("[data-pm-a11y-response]");
    if (slot) slot.textContent = text;
  };

  /* ── The live-region demo (element-demos) ─────────────────────────────
     Both buttons write the SAME sentence — the store's own announcement
     shape (CART_CONTRACT.announce), stated as a demo — into their own
     output slot. The DS-ON slot is role="status" and is announced; the
     DS-OFF slot is a plain element and is not. Same text, same moment; the
     only difference is the one the walkthrough names. */
  for (const button of document.querySelectorAll("[data-pm-demo]")) {
    const key = button.getAttribute("data-pm-demo");
    const out = document.querySelector(`[data-pm-demo-out="${key}"]`);
    if (!out) continue;
    let added = 0;
    button.addEventListener("click", () => {
      added += 1;
      out.textContent = `Added "A sample record" to the demo cart — ${added} in the demo cart.`;
    });
  }

  /* ── The mode toggles (mode-demos) ────────────────────────────────────
     A real toggle button: state lives on `aria-pressed`, the native
     attribute that is BOTH the accessible state and the selector
     mode-demo.css applies the emulation from, so the visual state cannot
     exist without the programmatic one. This is the whole of what the
     toggle does — the stage is never touched by script. */
  for (const toggle of document.querySelectorAll(".pm-mode__toggle[data-pm-mode-toggle]")) {
    toggle.addEventListener("click", () => {
      toggle.setAttribute(
        "aria-pressed",
        toggle.getAttribute("aria-pressed") === "true" ? "false" : "true",
      );
    });
  }

  /* ── Specimen controls ────────────────────────────────────────────────
     The focus, target-size and mode-stage demos render the store's own
     button as a SPECIMEN: the exhibit is how it renders — its ring, its
     target, its colours under a mode — not what it does. A button that does
     nothing when pressed is still a dead control by this repo's own
     standard (pdp-controls), and on an accessibility exhibit that is the
     worst possible bug, so pressing one gets an honest answer in the page's
     own VISIBLE status line — which is what makes "you hit it" true for the
     pointer users the target-size demo is about, rather than only for a
     screen reader. The live-region buttons are excluded: they have their own
     slots, and routing them here would announce the DS-OFF twin. */
  const SPECIMEN =
    ".pm-compare__box button.pm-button:not([data-pm-demo]), .pm-mode__stage button.pm-button";

  /** Which side of the pair a specimen is on.
   *
   *  Load-bearing: the two twins of the focus compare are the SAME component
   *  with the SAME label ("Add to cart") and they share one answer line, so a
   *  message built from the label alone is byte-identical for both — and a
   *  live region does not re-announce unchanged text, so the second press
   *  would say nothing at the exact moment the visitor is comparing them.
   *
   *  The DEMO's name is deliberately not in here. It was, while one shared
   *  line sat at the top of the page and a sentence had to say which
   *  comparison it came from; now the line lives inside the demo's own
   *  section, so repeating the heading above it is words the reader has
   *  already read — and length is not free: every character is height the
   *  line has to reserve, and unreserved height is a layout shift on the
   *  page whose own reflow demo is about layout. */
  const placeOf = (el) => {
    if (el.closest(".pm-compare__box--off")) return "DS-off";
    if (el.closest(".pm-compare__box")) return "DS-on";
    return "the stage";
  };

  for (const specimen of document.querySelectorAll(SPECIMEN)) {
    // Per-control press count. A live region does not re-announce text that
    // has not changed, and the target-size demo's own walkthrough invites
    // repeats ("try it on a phone, or with a tremor") — so a second press of
    // the SAME control has to say something new or it says nothing at all.
    // Counting is also the honest answer to "did that do anything?": no, and
    // here is how many times it has now not done it.
    let presses = 0;
    specimen.addEventListener("click", () => {
      presses += 1;
      // Every string here is authored master content, never tray data.
      const times = presses === 1 ? "" : ` (${presses} presses)`;
      respond(
        specimen,
        `Specimen: "${specimen.textContent.trim()}", ${placeOf(specimen)}. You hit it — nothing was added or saved.${times}`,
      );
    });
  }
})();
