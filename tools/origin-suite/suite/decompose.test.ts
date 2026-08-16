/**
 * The document byte decomposition (issue #16 defect 1 + audit 2026-08-01
 * collect.ts:303; estimator superseded by bench-instrumentation-dilution,
 * ADR-0001 §3 addendum 2026-08-15), unit-tested directly. `decomposeDocument`
 * splits one served HTML document's single compressed transferSize into
 * html/js/data plus STRIPPED instrumentation markup — the LEVEL from
 * `transferSize`, the RATIOS from leave-one-out brotli marginals at the
 * quality calibrated against the observed compressed body. No browser: pure
 * string → attribution, so the accounting rules are pinned deterministically
 * and the browser bench (bench.browser.test.ts) proves only the integration.
 *
 * The load-bearing invariants:
 *  - PARTITION: the four parts sum EXACTLY to transferSize (no
 *    double-counting, nothing lost), with instrumentation carved OUT of the
 *    counted buckets (§6), and no part ever negative.
 *  - CLASSIFICATION is delivery-faithful: inline executable script is JS,
 *    inline non-executed script is data, the injected chrome markup + its
 *    /_pm/ tags are instrumentation.
 *  - THE DILUTION DEFECT IS DEAD: a chrome-only change must not move the JS
 *    attribution the way uncompressed share did (astro's published cell
 *    moved 0.42→0.37 KB when the chrome grew, ~14% under the old rule).
 *  - HONEST DEGRADATION: an uncompressed document uses exact uncompressed
 *    share (no estimate needed); the estimator that ran is recorded in
 *    `attribution`, never assumed.
 */
import { brotliCompressSync, constants as zlibConstants } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decomposeDocument } from "@pm/bench-runner";

const T = 1000; // an arbitrary compressed transferSize; only ratios matter

const brotli = (s: string, q: number) =>
  brotliCompressSync(Buffer.from(s, "utf8"), {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: q },
  }).length;

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
    for (const [k, v] of Object.entries(d)) {
      if (k === "attribution") continue;
      expect(v).toBeGreaterThanOrEqual(0);
    }
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
    const empty = decomposeDocument("", 500);
    expect(empty).toMatchObject({ html: 500, js: 0, data: 0, instrumentation: 0 });
    expect(empty.attribution.estimator).toBe("degraded-all-html");
    const zero = decomposeDocument(page("", ""), 0);
    expect(zero).toMatchObject({ html: 0, js: 0, data: 0, instrumentation: 0 });
  });

  it("never yields a negative bucket, even when carve-outs dominate a tiny transferSize", () => {
    // A near-all-script/chrome document (little prose) compressed to a handful
    // of bytes: a per-bucket round-up with HTML as the remainder would drive
    // HTML negative (verify-slice, anti-rigging lens). Largest-remainder cannot
    // — and a zero-weight bucket can never receive a leftover unit.
    const body =
      `<!doctype html><html><body>` +
      `<script type="module">${"a".repeat(200)}</script>` +
      `<script type="application/json">${"b".repeat(200)}</script>` +
      CHROME_ASIDE +
      `</body></html>`;
    for (const t of [1, 2, 3, 5, 7, 11, 50, 999]) {
      const d = decomposeDocument(body, t);
      for (const [k, v] of Object.entries(d)) {
        if (k === "attribution") continue;
        expect(v, `${k} @ transferSize=${t}`).toBeGreaterThanOrEqual(0);
      }
      expect(sum(d), `sum @ transferSize=${t}`).toBe(t);
    }
  });
});

describe("the estimator (ADR-0001 §3 addendum 2026-08-15, superseding addendum G)", () => {
  // A fixture large and mixed enough that compression ratios differ per
  // part, the way real pages do: repetitive chrome (compresses well),
  // mixed-content prose, and a code-like inline module.
  const bigChrome =
    `<aside id="pm-chrome" data-pm-chrome="1" data-pm-variant="astro" aria-label="Project Matrix instrument">` +
    `<table>${`<tr><td class="pm-chrome__td"><a class="pm-chrome__reading" href="/_pm/lab/receipts/editorial-x.json">0.37&nbsp;KB</a></td></tr>`.repeat(30)}</table>` +
    `</aside><script src="/_pm/measure.js" defer></script>`;
  const jsModule =
    `<script type="module">const cart=new Map();export function add(id,qty){const k=String(id);` +
    `cart.set(k,(cart.get(k)??0)+qty);document.querySelector("[data-cart-count]").textContent=` +
    `String([...cart.values()].reduce((a,b)=>a+b,0));}add(953800,1);add(896191,2);</script>`;
  const prose = `<main><h1>Kind Of Blue</h1>${
    `<p>Recorded in two sessions at Columbia's 30th Street Studio, the album's modal framework left the sextet room to phrase against scales rather than chords.</p>`.repeat(8)
  }</main>`;
  const doc = `<!doctype html><html><head>${PM_HEAD_LINKS}<title>x</title></head><body>${prose}<div id="pm-chrome-slot">${bigChrome}</div>${jsModule}</body></html>`;

  it("records the estimator that ran: leave-one-out at a calibrated quality when the wire was compressed", () => {
    const encoded = brotli(doc, 4);
    const d = decomposeDocument(doc, encoded + 300, encoded);
    expect(d.attribution.estimator).toBe("loo-brotli-normalised");
    // The calibration must land on (or immediately beside) the quality that
    // actually produced the wire bytes, and say how far off it was.
    expect(d.attribution.quality).not.toBeNull();
    expect(Math.abs(d.attribution.quality! - 4)).toBeLessThanOrEqual(1);
    expect(Math.abs(d.attribution.calibrationResidualBytes!)).toBeLessThan(encoded * 0.02);
    expect(sum(d)).toBe(encoded + 300);
  });

  it("an UNCOMPRESSED document needs no estimate: exact uncompressed share, and it says so", () => {
    const docBytes = Buffer.byteLength(doc, "utf8");
    const d = decomposeDocument(doc, docBytes + 300, docBytes);
    expect(d.attribution.estimator).toBe("uncompressed-share-identity");
    expect(d.attribution.quality).toBeNull();
    expect(sum(d)).toBe(docBytes + 300);
  });

  it("kills the dilution defect: a chrome-only change no longer drags the JS cell (the 0.42→0.37 shape)", () => {
    // The same page under a small chrome and a ~4× larger one — the shape of
    // the recorded defect (empty vs populated strip). Under uncompressed
    // share the JS attribution moved ~14% on the real pages; the estimator
    // must hold it within noise. Wire sizes are simulated at one quality on
    // both sides so ONLY the attribution rule is under test.
    const withSmall = doc.replace(bigChrome, CHROME_ASIDE);
    const q = 4;
    const dSmall = decomposeDocument(withSmall, brotli(withSmall, q), brotli(withSmall, q));
    const dBig = decomposeDocument(doc, brotli(doc, q), brotli(doc, q));
    expect(dSmall.js).toBeGreaterThan(0);
    expect(dBig.js).toBeGreaterThan(0);
    const drift = Math.abs(dBig.js - dSmall.js) / dSmall.js;
    expect(drift, `js moved ${dSmall.js} → ${dBig.js} on a chrome-only change`).toBeLessThan(0.05);
  });

  it("attributes the repetitive chrome LESS than its uncompressed share — the direction the defect ran", () => {
    // The chrome compresses far better than the document average, so
    // uncompressed share OVER-attributed it and under-attributed everyone
    // else (the dilution). The marginal estimator must price it below its
    // uncompressed share.
    const encoded = brotli(doc, 4);
    const d = decomposeDocument(doc, encoded, encoded);
    const docBytes = Buffer.byteLength(doc, "utf8");
    const instrUncompressed =
      Buffer.byteLength(bigChrome, "utf8") + Buffer.byteLength(PM_HEAD_LINKS, "utf8");
    const uncompressedShare = (encoded * instrUncompressed) / docBytes;
    expect(d.instrumentation).toBeLessThan(uncompressedShare);
    // And the JS cell gains what the chrome gave up: strictly more than the
    // old rule granted it.
    const jsUncompressedShare = (encoded * Buffer.byteLength(jsModule, "utf8")) / docBytes;
    expect(d.js).toBeGreaterThan(jsUncompressedShare);
  });
});
