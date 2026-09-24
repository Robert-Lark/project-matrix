/**
 * /vanilla/checkout/ and where its JS-off "Place order" lands, at the
 * composed-origin seam (checkout-measure-prep, 2026-09-24). Plain HTTP,
 * outside-in, no Worker internals. The behaviour in a real browser is
 * checkout.browser.test.ts; the served body vs the master is the drift
 * gate's leg (drift.browser.test.ts); the security floor on the new response
 * class is security-floor.test.ts's.
 *
 *  - The form page SERVES with the chrome injected for this surface and the
 *    JS-off statement the master carries — including the sentence this unit
 *    added, that Place order posts natively to a confirmation page.
 *  - The POST is answered. Until this unit a JS-off "Place order" posted to
 *    the form's own URL and met the assets binding's zero-length 405
 *    (measured on the held plane: status 405, 0 body bytes). The form now
 *    posts to a RELATIVE `place-order/` — a path with no asset behind it,
 *    the one request that reaches the variant's script — and gets a 303 to a
 *    page that exists. The endpoint is derived from the SERVED form's action
 *    exactly as the browser derives it, never typed twice. The Worker never
 *    reads the body, so an express body, a standard body and an EMPTY body
 *    all land on the same Location — pinned, because "the page cannot name
 *    the method chosen" is a claim the placed copy makes.
 *  - Why not the form's own URL, pinned as behaviour: a POST to the form
 *    page STILL meets the binding's 405 (an asset behind the path answers
 *    before the script runs — Cloudflare's routing page, fetched 2026-09-24:
 *    "Cloudflare will first attempt to serve static assets if one matches
 *    the incoming request"), and the first draft of the route sat unreached
 *    behind exactly that. A GET of the endpoint is not a page: 404.
 *  - What the browser would post: the served form carries exactly two
 *    `name=` attributes, both the shipping radios — the master's rule 1 on
 *    the wire, and the whole reason the 303 is safe to issue without reading.
 *  - The placed page: 200, chrome injected for THIS surface, `noindex`, no
 *    form, exactly the master's sheets in order, every linked asset 200 from
 *    the variant's own tree, the way back a link.
 *  - The registry: checkout serves in vanilla, with two planned, no lab
 *    bundle yet — no batch is minted by this unit, and the front build
 *    refuses the flag until one is.
 */
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { SURFACE_CONTROLS } from "@pm/switcher";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const get = (path: string, init?: RequestInit) => fetch(`${ORIGIN}${path}`, init);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

const FORM = "/vanilla/checkout/";
const PLACED = "/vanilla/checkout/placed/";

/** The POST endpoint, derived from the served form's `action` the way the
 *  browser derives it — resolved against the page URL. */
async function placeOrderPath(): Promise<string> {
  const body = await (await get(FORM)).text();
  const action = body.match(/<form class="pm-checkout__form" method="post" action="([^"]*)">/)?.[1];
  expect(action, "the served form has no action").toBeTruthy();
  return new URL(action!, `${ORIGIN}${FORM}`).pathname;
}

const post = (path: string, body: string | null) =>
  get(path, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

function sheetTails(html: string): string[] {
  return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => {
    const at = m[1]!.lastIndexOf("/css/");
    if (at === -1) throw new Error(`stylesheet href outside the css tree: ${m[1]}`);
    return m[1]!.slice(at + 1);
  });
}

/** The master's sheet list, rendered in-process (file URL, the drift gate's
 *  pattern) — never typed. */
async function masterSheets(which: "form" | "placed"): Promise<string[]> {
  const checkout = await import(
    pathToFileURL(join(repoRoot, "packages", "reference", "render", "checkout.mjs")).href
  );
  return sheetTails(which === "form" ? checkout.renderCheckout({}) : checkout.renderCheckoutPlaced({}));
}

describe("/vanilla/checkout/ — the form page, served", () => {
  it("the registry: served by vanilla, two planned, host vanilla, no lab bundle yet", () => {
    const controls = SURFACE_CONTROLS["checkout"]!;
    expect(controls.variants).toEqual(["vanilla"]);
    expect([...(controls.plannedVariants ?? [])].sort()).toEqual(["htmx", "react-next"]);
    expect(controls.host).toBe("vanilla");
    // No batch is minted by the measure-prep unit; the flag stays off until
    // the measurement pass mints one (the front build refuses it by name).
    expect(controls.labBundle).toBeUndefined();
  });

  it("serves 200 with the chrome injected for this surface and the JS-off statement the master carries", async () => {
    const res = await get(FORM);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("text/html");
    const body = await res.text();
    expect(body).toContain('<form class="pm-checkout__form" method="post" action="place-order/">');
    expect(body).not.toContain("novalidate");
    expect(count(body, 'data-pm-chrome="1"')).toBe(1);
    expect(body).toContain('data-pm-variant="vanilla"');
    expect(body).toContain('data-pm-surface="checkout"');
    // The JS-off statement, including what this unit made true.
    expect(body).toContain("a Place order that posts natively to a plain confirmation page");
    expect(body).toContain('<script src="../assets/checkout.js" defer>');
  });

  it("what a JS-off submit would carry: exactly two named controls, both the shipping radios", async () => {
    // The master's rule 1 (checkout.mjs) on the served bytes: a control with
    // no `name` is not a successful control, so the posted body is
    // `shipping=…` and nothing else. This is what makes a 303 that never
    // reads the body the complete answer.
    const body = await (await get(FORM)).text();
    const named = [...body.matchAll(/<(input|select|textarea|button)[^>]*\sname="([^"]+)"/g)].map((m) => m[2]);
    expect(named).toEqual(["shipping", "shipping"]);
  });
});

describe("the JS-off Place order is answered, not dead-ended", () => {
  it("the form's action resolves to a path nothing in dist serves — the one request that reaches the script", async () => {
    const endpoint = await placeOrderPath();
    expect(endpoint).toBe("/vanilla/checkout/place-order/");
    // Not a page: a GET of it is the binding's 404, never a document.
    expect((await get(endpoint)).status).toBe(404);
  });

  it("303 to the placed page, an empty body, regardless of the shipping method posted", async () => {
    const endpoint = await placeOrderPath();
    for (const body of ["shipping=standard", "shipping=express", ""]) {
      const res = await post(endpoint, body);
      expect(res.status, `body ${JSON.stringify(body)}`).toBe(303);
      expect(res.headers.get("location"), `body ${JSON.stringify(body)}`).toBe(PLACED);
      expect(await res.text(), `body ${JSON.stringify(body)}`).toBe("");
    }
  });

  it("a POST with no body at all is answered the same way — the Worker reads nothing", async () => {
    const res = await post(await placeOrderPath(), null);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(PLACED);
  });

  it("the route is one path and one method: a POST to any PAGE still meets the binding's 405, a non-POST to the endpoint its 404", async () => {
    // The pre-unit shape survives everywhere but the endpoint — including on
    // the form page itself, which is the proof that the script never sees a
    // request an asset answers (the mechanism the first draft ran into).
    for (const [path, method, status] of [
      [FORM, "POST", 405],
      [PLACED, "POST", 405],
      ["/vanilla/editorial/", "POST", 405],
      [FORM, "PUT", 405],
      [await placeOrderPath(), "PUT", 404],
      [await placeOrderPath(), "GET", 404],
    ] as const) {
      const res = await get(path, { method, redirect: "manual", body: method === "GET" ? null : "shipping=standard" });
      expect(res.status, `${method} ${path}`).toBe(status);
    }
  });

  it("following the redirect lands on a 200 HTML page — the browser's path, end to end", async () => {
    const res = await get(await placeOrderPath(), {
      method: "POST",
      redirect: "follow",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "shipping=standard",
    });
    expect(res.status).toBe(200);
    expect(res.redirected).toBe(true);
    expect(new URL(res.url).pathname).toBe(PLACED);
    expect(res.headers.get("content-type") ?? "").toContain("text/html");
  });
});

describe("/vanilla/checkout/placed/ — where the JS-off order lands", () => {
  it("serves 200 with the canonical shell, the chrome injected for the CHECKOUT surface, and noindex", async () => {
    const res = await get(PLACED);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("text/html");
    const body = await res.text();
    expect(body).toContain('class="pm-checkout pm-checkout--placed"');
    expect(body).toContain("Order placed");
    expect(body).toContain('<a class="pm-skip pm-button" href="#main">Skip to content</a>');
    // A confirmation reached by posting has no standalone meaning to index.
    expect(body).toContain('<meta name="robots" content="noindex">');
    // The chrome: exactly one, stamped for this surface — the second path
    // segment is `checkout`, so the switcher and the beacon tag read checkout.
    expect(count(body, 'data-pm-chrome="1"')).toBe(1);
    expect(body).toContain('data-pm-variant="vanilla"');
    expect(body).toContain('data-pm-surface="checkout"');
    // No form, no control: it collects nothing.
    expect(body.match(/<form|<input|<select|<textarea|<button/g)).toBeNull();
    // The page states what the request carried, and the way back is a link.
    expect(body).toContain("the only field it carries a name for is the shipping method");
    expect(body).toContain('<a class="pm-button" href="/react-next/plp/plain/">Back to the records</a>');
    // This variant's one script at this page's depth.
    expect(body).toContain('<script src="../../assets/checkout.js" defer>');
  });

  it("links exactly the master's stylesheets, in order, and every linked asset answers 200 from the variant's own tree", async () => {
    const body = await (await get(PLACED)).text();
    const own = sheetTails(body.replace(/<link rel="stylesheet" href="\/_pm\/chrome\.css">/, ""));
    expect(own).toEqual(await masterSheets("placed"));
    expect(own.length).toBeGreaterThan(5);
    const hrefs = [...body.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]!);
    for (const href of hrefs) {
      const res = await fetch(new URL(href, `${ORIGIN}${PLACED}`));
      expect(res.status, href).toBe(200);
    }
    const script = body.match(/<script src="([^"]+)"/)?.[1];
    expect(script).toBeDefined();
    expect((await fetch(new URL(script!, `${ORIGIN}${PLACED}`))).status).toBe(200);
  });

  it("the form page's sheets are the master's too, and the form page stays indexable", async () => {
    const body = await (await get(FORM)).text();
    const own = sheetTails(body.replace(/<link rel="stylesheet" href="\/_pm\/chrome\.css">/, ""));
    expect(own).toEqual(await masterSheets("form"));
    expect(body).not.toContain('name="robots"');
  });
});
