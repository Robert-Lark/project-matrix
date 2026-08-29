/**
 * The checkout's controls DO something — driven, not inspected.
 *
 * `pdp-controls-wired.test.ts` proves the enhancement can REACH every control
 * the master renders. Its own header is candid that this is the cheap half:
 * "this one would pass a script that mentions a class and does nothing with
 * it". For the PDP the expensive half is `pdp-controls.browser.test.ts` in the
 * origin suite — which needs a live plane, and therefore cannot gate a merge.
 *
 * Checkout has no browser leg at all yet (recorded as owed in this unit's
 * build log, alongside the missing cart leg). So rather than ship the cheap
 * half alone on a surface whose whole point is interaction, this file runs the
 * REAL `checkout.js` against the REAL served master in linkedom, before merge,
 * with no plane and no ports. It is in the 31, so it blocks a merge.
 *
 * What it CANNOT do, stated rather than implied — this is a DOM emulation, not
 * a browser, and three gaps matter:
 *  1. No layout, so nothing here says anything about CLS, focus rings, or the
 *     reserved geometry `cart-summary.css` provides.
 *  2. No timing, so nothing here is evidence about INP. The numbers this
 *     surface exists to publish come from the bench runner, never from here.
 *  3. linkedom has no selection API and no focus tracking on elements, and its
 *     `:checked` matches the ATTRIBUTE rather than the checkedness property
 *     (verified in this session). The first two are shimmed below and the
 *     shims are declared; the third is why `checkout.js` reads each radio's
 *     `.checked` instead of selecting `:checked` — both are correct in a
 *     browser, but only one of them is provable here.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const scriptPath = join(repoRoot, "variants", "vanilla", "src", "checkout.js");

interface CatalogueEntry {
  title: string;
  price: number | null;
  thumb: string;
}

let servedHtml: string;
let enhancement: string;
let catalogue: { v: number; items: Record<string, CatalogueEntry> };

beforeAll(async () => {
  // The SERVED document, from the variant's own renderer — the same call
  // `build.mjs` makes. Not a fixture written by hand: a hand-written copy is
  // the thing that silently stops matching what ships.
  const vanilla = await import(
    pathToFileURL(join(repoRoot, "variants", "vanilla", "render.mjs")).href
  );
  servedHtml = vanilla.renderCheckoutPage({ depth: 1 });
  enhancement = readFileSync(scriptPath, "utf8");

  // The catalogue, built the way `build.mjs` builds it, from the committed
  // fixture trays. Same reason: derive it, never re-type it.
  const summaries = JSON.parse(
    readFileSync(
      join(repoRoot, "tools", "snapshot-fixture", "snapshot", "summaries.json"),
      "utf8",
    ),
  ) as { id: number; title: string; priceFrom: { amount: number; currency: string } | null; cover: { src: string } }[];
  catalogue = {
    v: 1,
    items: Object.fromEntries(
      summaries.map((s) => [
        String(s.id),
        {
          title: s.title,
          price: s.priceFrom?.currency === "USD" ? s.priceFrom.amount : null,
          thumb: s.cover.src.replace(/\.avif$/, ".thumb.avif"),
        },
      ]),
    ),
  };
});

interface Env {
  document: Document;
  focused: () => unknown;
  settle: () => Promise<void>;
}

/** Run the real enhancement over the real served document. */
function run(stored: unknown = null, fetchBody: unknown = null): Env {
  const { document } = parseHTML(servedHtml) as unknown as { document: Document };
  const store = new Map<string, string>();
  if (stored !== null) store.set("pm:cart", JSON.stringify(stored));
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };

  // Shim 1: linkedom has no selection API on inputs. `checkout.js` recomputes
  // the caret from the digit count before it, so without this the formatter's
  // real code path could not run at all.
  const inputProto = Object.getPrototypeOf(document.createElement("input")) as Record<string, unknown>;
  if (!("selectionStart" in inputProto)) {
    Object.defineProperty(inputProto, "selectionStart", {
      configurable: true,
      get(this: { __sel?: number; value?: string }) {
        return this.__sel ?? (this.value ?? "").length;
      },
    });
    inputProto.setSelectionRange = function (this: { __sel?: number }, at: number) {
      this.__sel = at;
    };
  }
  // Shim 2: linkedom elements have no focus(). The invalid-submit contract is
  // half DOM and half FOCUS (ADR-0008 §7), so the focus half has to be
  // observable or this file would only be checking the easy half.
  let focused: unknown = null;
  const elProto = Object.getPrototypeOf(document.createElement("section")) as Record<string, unknown>;
  // A DOM method shim: `this` IS the element being focused, which is the whole
  // observation the invalid-submit contract needs.
  elProto.focus = function (this: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    focused = this;
  };

  const fetchStub = () => Promise.resolve({ ok: true, json: () => Promise.resolve(fetchBody) });
  new Function("document", "localStorage", "fetch", enhancement)(
    document,
    localStorage,
    fetchStub,
  );
  return {
    document,
    focused: () => focused,
    // The catalogue arrives on a resolved promise; one macrotask is enough.
    settle: () => new Promise<void>((r) => setTimeout(r, 0)),
  };
}

const fire = (el: unknown, type: string): void => {
  const node = el as { ownerDocument: { defaultView: { Event: typeof Event } }; dispatchEvent: (e: Event) => void };
  node.dispatchEvent(new node.ownerDocument.defaultView.Event(type, { bubbles: true }));
};
const $ = (env: Env, sel: string): Element => {
  const el = env.document.querySelector(sel);
  if (el === null) throw new Error(`no ${sel} in the served checkout`);
  return el;
};
const pricedIds = (): number[] =>
  Object.keys(catalogue.items)
    .filter((k) => typeof catalogue.items[k]!.price === "number")
    .slice(0, 2)
    .map(Number);

describe("the checkout's controls do what the markup says they do", () => {
  it("the card number formats as you type — the field's own hint promises it", () => {
    const env = run();
    const card = $(env, "#card") as HTMLInputElement;
    card.value = "4242424242424242";
    fire(card, "input");
    expect(card.value).toBe("4242 4242 4242 4242");
    // A 19-digit PAN is the maximum ISO/IEC 7812 allows; more is a typo, not
    // a card, and the field stops taking it rather than formatting nonsense.
    card.value = "42424242424242421234567";
    fire(card, "input");
    expect(card.value.replace(/\s/g, "")).toHaveLength(19);
  });

  it("the expiry formats to MM/YY", () => {
    const env = run();
    const expiry = $(env, "#expiry") as HTMLInputElement;
    expiry.value = "1226";
    fire(expiry, "input");
    expect(expiry.value).toBe("12/26");
  });

  it("blur validation writes aria-invalid and an error message, and clears both", () => {
    const env = run();
    const email = $(env, "#email") as HTMLInputElement;
    email.value = "not-an-email";
    fire(email, "blur");
    // The state field.css styles off, and the only one script can produce.
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(env.document.querySelector(".pm-field__error")?.textContent).toContain("email address");
    // The hint is not thrown away to make room for the error: a field with
    // both has both to say, and dropping the hint would be a silent loss for
    // exactly the users the description exists for.
    expect(email.getAttribute("aria-describedby")).toBe("email-hint email-error");

    email.value = "rob@example.com";
    fire(email, "blur");
    expect(email.getAttribute("aria-invalid")).toBeNull();
    expect(env.document.querySelector(".pm-field__error")).toBeNull();
    expect(email.getAttribute("aria-describedby")).toBe("email-hint");
  });

  it("an untouched field is not accused on blur", () => {
    // Tabbing through a form must not turn it red. The rule is deliberately
    // narrow — a field that has already failed IS re-checked, so a correction
    // clears immediately.
    const env = run();
    const name = $(env, "#name") as HTMLInputElement;
    fire(name, "blur");
    expect(name.getAttribute("aria-invalid")).toBeNull();
    expect(env.document.querySelector(".pm-field__error")).toBeNull();
  });

  it("an invalid submit renders the error summary and MOVES FOCUS to it", () => {
    // ADR-0008 §7's checkout contract, in full: "the error-summary region
    // (heading + links to each invalid field) renders and RECEIVES FOCUS —
    // identical DOM + focus work in every paradigm, so the flagship INP
    // comparison compares like work". Each clause is a line below.
    const env = run();
    fire($(env, ".pm-checkout__form"), "submit");

    const summary = $(env, ".pm-error-summary");
    expect(summary.getAttribute("tabindex")).toBe("-1");
    expect(summary.getAttribute("aria-labelledby")).toBe(
      $(env, ".pm-error-summary__title").id,
    );
    const links = [...env.document.querySelectorAll(".pm-error-summary__list a")];
    expect(links).toHaveLength(10);
    for (const link of links) {
      const target = link.getAttribute("href") ?? "";
      expect(target.startsWith("#")).toBe(true);
      // A summary that links nowhere is the WAI pattern's failure mode.
      expect(env.document.getElementById(target.slice(1)), `${target} hits nothing`).not.toBeNull();
    }
    expect(env.focused(), "focus did not move to the error summary").toBe(summary);
    expect($(env, "[data-pm-status]").textContent).toContain("10 problems");
    // It renders at the TOP of the form (error-summary.css's contract), not
    // wherever it happened to be appended.
    expect($(env, ".pm-checkout__form").firstElementChild).toBe(summary);
  });

  it("a second invalid submit does not stack a second summary", () => {
    const env = run();
    const form = $(env, ".pm-checkout__form");
    fire(form, "submit");
    fire(form, "submit");
    expect(env.document.querySelectorAll(".pm-error-summary")).toHaveLength(1);
  });

  it("a valid submit clears the summary and names the address the hint promised", () => {
    const env = run();
    // The email hint scopes what the address is for: "Used only to render the
    // demo confirmation in this page — nothing is ever sent." A confirmation
    // that never names it would make the hint false.
    const filled: Record<string, string> = {
      email: "rob@example.com", name: "Rob Lark", address1: "1 Long Decay Rd",
      city: "Portland", postal: "97201", region: "OR", card: "4242 4242 4242 4242",
      cardname: "R Lark", expiry: "12/26", cvc: "123",
    };
    for (const [id, value] of Object.entries(filled)) {
      (env.document.getElementById(id) as HTMLInputElement).value = value;
    }
    fire($(env, ".pm-checkout__form"), "submit");
    expect(env.document.querySelector(".pm-error-summary")).toBeNull();
    const status = $(env, "[data-pm-status]").textContent ?? "";
    expect(status).toContain("rob@example.com");
    expect(status).toContain("Standard");
    expect(status).toContain("nothing ships");
  });

  it("the order summary populates from the cart, and the shipping choice moves the total", async () => {
    const [first, second] = pricedIds();
    const env = run({ v: 1, items: [{ id: first, qty: 2 }, { id: second, qty: 1 }] }, catalogue);
    await env.settle();

    expect(env.document.querySelectorAll(".pm-cart__line")).toHaveLength(2);
    expect(($(env, ".pm-cart__empty") as HTMLElement).hidden).toBe(true);
    expect($(env, "[data-pm-cart-count]").textContent).toBe("3");
    expect($(env, ".pm-masthead__cart").getAttribute("aria-label")).toBe("Cart, 3 items");

    const subtotal =
      catalogue.items[String(first)]!.price! * 2 + catalogue.items[String(second)]!.price!;
    const shown = () => $(env, "[data-pm-cart-total]").textContent;
    expect(shown()).toBe(`$${subtotal.toFixed(2)}`);

    // The shipping group is a REAL choice — it is the only surviving consumer
    // of format-switch.css (ADR-0008 addendum A), and what makes it real is
    // that the total moves. Exactly $12.00, the number the option label states.
    const express = $(env, '.pm-format__input[value="express"]') as HTMLInputElement;
    (($(env, '.pm-format__input[value="standard"]')) as HTMLInputElement).checked = false;
    express.checked = true;
    fire(express, "change");
    expect(shown()).toBe(`$${(subtotal + 12).toFixed(2)}`);
  });

  it("a repeated release id is the EMPTY cart, on this surface too", async () => {
    // CART_CONTRACT's uniqueness clause (shell.mjs:73-83). It was stated for
    // months without being checked, and the two implementations then disagreed
    // about a value neither could write. This is the THIRD vanilla `read()`;
    // it must not be the one that reintroduces the disagreement.
    const [id] = pricedIds();
    const env = run({ v: 1, items: [{ id, qty: 1 }, { id, qty: 1 }] }, catalogue);
    await env.settle();
    expect($(env, "[data-pm-cart-count]").textContent).toBe("");
    expect(env.document.querySelectorAll(".pm-cart__line")).toHaveLength(0);
    expect($(env, ".pm-masthead__cart").getAttribute("aria-label")).toBeNull();
  });

  it("an id the served snapshot has lost states the absence instead of a wrong total", async () => {
    // Reachable without anyone misbehaving: the cart is same-origin storage
    // and outlives a crate re-freeze, so an id can simply stop existing. The
    // rule every unpublished number here follows applies — state the absence,
    // never show a number-shaped hole.
    const env = run({ v: 1, items: [{ id: 999_999_999, qty: 1 }] }, catalogue);
    await env.settle();
    expect($(env, ".pm-cart__what").textContent).toContain("no longer in this crate");
    const total = $(env, "[data-pm-cart-total]");
    expect(total.textContent).toContain("Total unavailable");
    // Named, not bare: a lone em dash announces as "em dash" or as silence.
    expect(total.querySelector('[aria-hidden="true"]')?.textContent).toBe("—");
    expect(total.querySelector(".pm-sr-only")).not.toBeNull();
  });

  it("the empty cart is left exactly as served, and asks for nothing", async () => {
    // The canonical SERVED state, and the one the instrument measures. If the
    // enhancement touched it, the drift gate and the bench would disagree
    // about what the page is.
    let fetched = 0;
    const { document } = parseHTML(servedHtml) as unknown as { document: Document };
    new Function("document", "localStorage", "fetch", enhancement)(
      document,
      { getItem: () => null, setItem: () => undefined },
      () => {
        fetched += 1;
        return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
      },
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(fetched, "the empty-cart page fetched the catalogue it does not need").toBe(0);
    expect(document.querySelectorAll(".pm-cart__line")).toHaveLength(0);
    expect((document.querySelector(".pm-cart__empty") as HTMLElement).hidden).toBe(false);
    expect(document.querySelector("[data-pm-cart-count]")?.textContent).toBe("");
  });

  it("a failed catalogue fetch changes nothing and claims nothing", async () => {
    const [id] = pricedIds();
    const { document } = parseHTML(servedHtml) as unknown as { document: Document };
    new Function("document", "localStorage", "fetch", enhancement)(
      document,
      {
        getItem: () => JSON.stringify({ v: 1, items: [{ id, qty: 1 }] }),
        setItem: () => undefined,
      },
      () => Promise.reject(new Error("offline")),
    );
    await new Promise((r) => setTimeout(r, 0));
    // The summary stays served-empty; the badge still reports what IS stored,
    // because that needs no catalogue.
    expect(document.querySelectorAll(".pm-cart__line")).toHaveLength(0);
    expect(document.querySelector("[data-pm-cart-count]")?.textContent).toBe("1");
  });

  it("the enhancement takes the validation handover the served markup withholds", () => {
    // checkout.mjs:9-12: no `novalidate` in the served markup, because JS-off
    // the browser's own constraint validation is the behaviour the page
    // claims on itself. It goes on here, and only here.
    expect(servedHtml).not.toContain("novalidate");
    const env = run();
    expect($(env, ".pm-checkout__form").hasAttribute("novalidate")).toBe(true);
  });
});
