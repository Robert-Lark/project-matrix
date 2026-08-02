/**
 * The document byte decomposition (issue #16 defect 1 + audit 2026-08-01
 * collect.ts:303), unit-tested directly. `decomposeDocument` splits one served
 * HTML document's single compressed transferSize into html/js/data plus
 * STRIPPED instrumentation markup by uncompressed content share (ADR-0001 §3
 * addendum). No browser: pure string → attribution, so the accounting rules are
 * pinned deterministically and the browser bench (bench.browser.test.ts) proves
 * only the integration.
 *
 * The load-bearing invariant is a PARTITION: the four parts sum EXACTLY to
 * transferSize (no double-counting, nothing lost), with instrumentation carved
 * OUT of the counted buckets (§6). The classification is delivery-faithful:
 * inline executable script is JS (Astro's inlined cart module is no longer
 * "0 KB JS"), inline non-executed script is data, the injected chrome markup +
 * its /_pm/ tags are instrumentation.
 */
import { describe, expect, it } from "vitest";
import { decomposeDocument } from "@pm/bench-runner";

const T = 1000; // an arbitrary compressed transferSize; only ratios matter

// A realistic injected chrome subtree + its /_pm/ tags, as the front Worker
// emits them into the slot / head.
const CHROME_ASIDE =
  `<aside id="pm-chrome" data-pm-chrome="1" data-pm-variant="astro" aria-label="Project Matrix instrument">` +
  `<div class="pm-chrome__bar"><span class="pm-chrome__mark">PM</span>` +
  `<nav class="pm-chrome__switch"><a class="pm-chrome__cell" href="/vanilla/editorial/">vanilla</a></nav>` +
  `<p>The instrument strip carries a fair bit of markup.</p></div></aside>` +
  `<script src="/_pm/measure.js" defer></script>`;
const PM_HEAD_LINKS =
  `<link rel="preload" href="/_pm/fonts/PMInstrumentMono.var.woff2" as="font" type="font/woff2" crossorigin>` +
  `<link rel="stylesheet" href="/_pm/chrome.css">`;

function page(headExtra: string, bodyExtra: string): string {
  return (
    `<!doctype html><html lang="en"><head>${PM_HEAD_LINKS}` +
    `<link rel="stylesheet" href="/astro/styles.css"><title>x</title></head>` +
    `<body><main><h1>Kind Of Blue</h1><p>Some prose about the record.</p></main>` +
    `<div id="pm-chrome-slot">${CHROME_ASIDE}</div>${bodyExtra}${headExtra}</body></html>`
  );
}

const sum = (d: { html: number; js: number; data: number; instrumentation: number }) =>
  d.html + d.js + d.data + d.instrumentation;

describe("decomposeDocument partitions the compressed document (ADR-0001 §3/§6)", () => {
  it("the four parts sum EXACTLY to transferSize, none negative", () => {
    const d = decomposeDocument(
      page(
        "",
        `<script type="application/json" id="pm-cart-item">{"id":123,"title":"Kind Of Blue"}</script>` +
          `<script type="module">import {mountCart} from "/astro/cart.js";mountCart();</script>`,
      ),
      T,
    );
    expect(sum(d)).toBe(T);
    for (const v of Object.values(d)) expect(v).toBeGreaterThanOrEqual(0);
  });

  it("inline EXECUTABLE script counts as JS — Astro's inlined bundle is not 0 KB (defect 1)", () => {
    const withModule = decomposeDocument(
      page("", `<script type="module">import {mountCart} from "/astro/cart.js";mountCart();</script>`),
      T,
    );
    expect(withModule.js).toBeGreaterThan(0);

    // Same document WITHOUT the module: the JS bucket collapses to zero and
    // those bytes land in HTML — i.e. the module is what the JS number reflects.
    const withoutModule = decomposeDocument(page("", ""), T);
    expect(withoutModule.js).toBe(0);
    expect(withoutModule.html).toBeGreaterThan(withModule.html);
  });

  it("inline NON-EXECUTABLE script counts as data, never JS", () => {
    const d = decomposeDocument(
      page("", `<script type="application/json" id="pm-cart-item">{"id":123,"title":"t"}</script>`),
      T,
    );
    expect(d.data).toBeGreaterThan(0);
    expect(d.js).toBe(0);
  });

  it("injected chrome markup + its /_pm/ tags are stripped to instrumentation (collect.ts:303)", () => {
    const withChrome = decomposeDocument(page("", ""), T);
    expect(withChrome.instrumentation).toBeGreaterThan(0);

    // A page with NO chrome/instrumentation puts every document byte in HTML —
    // so the chrome markup really is being carved out of the HTML bucket.
    const noChrome = decomposeDocument(
      `<!doctype html><html lang="en"><head><title>x</title></head><body><main><h1>h</h1><p>prose</p></main></body></html>`,
      T,
    );
    expect(noChrome.instrumentation).toBe(0);
    expect(noChrome.js).toBe(0);
    expect(noChrome.data).toBe(0);
    expect(noChrome.html).toBe(T);
  });

  it("a variant's OWN external script tag stays HTML markup (its payload is counted from resource timing)", () => {
    const d = decomposeDocument(
      `<!doctype html><html><head></head><body><p>x</p><script src="/qwik/build/q-abc.js" type="module"></script></body></html>`,
      T,
    );
    expect(d.js).toBe(0); // the TAG is not the payload
    expect(d.instrumentation).toBe(0); // not /_pm/
    expect(d.html).toBe(T);
  });

  it("classifies script types at the executable/data boundary", () => {
    const exec = (tag: string) =>
      decomposeDocument(`<!doctype html><body><p>prose</p>${tag}</body>`, T);
    // Executable → JS.
    expect(exec(`<script>console.log(1)</script>`).js).toBeGreaterThan(0);
    expect(exec(`<script type="text/javascript">x()</script>`).js).toBeGreaterThan(0);
    expect(exec(`<script type="module">import "x"</script>`).js).toBeGreaterThan(0);
    // Non-executed typed scripts → data (not JS).
    for (const type of ["application/json", "qwik/json", "importmap", "speculationrules"]) {
      const d = exec(`<script type="${type}">{"a":1}</script>`);
      expect(d.data, type).toBeGreaterThan(0);
      expect(d.js, type).toBe(0);
    }
  });

  it("degrades safely when the body is unavailable or transferSize is zero", () => {
    expect(decomposeDocument("", 500)).toEqual({
      html: 500,
      js: 0,
      data: 0,
      instrumentation: 0,
    });
    expect(decomposeDocument(page("", ""), 0)).toEqual({
      html: 0,
      js: 0,
      data: 0,
      instrumentation: 0,
    });
  });

  it("never yields a negative bucket, even when carve-outs dominate a tiny transferSize", () => {
    // A near-all-script/chrome document (little prose) compressed to a handful
    // of bytes: a per-bucket round-up with HTML as the remainder would drive
    // HTML negative (verify-slice, anti-rigging lens). Largest-remainder cannot.
    const body =
      `<!doctype html><html><body>` +
      `<script type="module">${"a".repeat(200)}</script>` +
      `<script type="application/json">${"b".repeat(200)}</script>` +
      CHROME_ASIDE +
      `</body></html>`;
    for (const t of [1, 2, 3, 5, 7, 11, 50, 999]) {
      const d = decomposeDocument(body, t);
      for (const [k, v] of Object.entries(d)) {
        expect(v, `${k} @ transferSize=${t}`).toBeGreaterThanOrEqual(0);
      }
      expect(sum(d), `sum @ transferSize=${t}`).toBe(t);
    }
  });
});
