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
import {
  brotliCompressSync,
  brotliDecompressSync,
  gzipSync,
  zstdCompressSync,
  zstdDecompressSync,
  constants as zlibConstants,
} from "node:zlib";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decomposeDocument } from "@pm/bench-runner";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const T = 1000; // an arbitrary compressed transferSize; only ratios matter

const brotli = (s: string, q: number) =>
  brotliCompressSync(Buffer.from(s, "utf8"), {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: q },
  }).length;
const zstdBytes = (s: string, level: number) =>
  zstdCompressSync(Buffer.from(s, "utf8"), {
    params: { [zlibConstants.ZSTD_c_compressionLevel]: level },
  }).length;
const gzipBytes = (s: string, level: number) =>
  gzipSync(Buffer.from(s, "utf8"), { level }).length;

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
    expect(d.attribution.estimator).toBe("loo-wire-normalised");
    expect(d.attribution.codec).toBe("brotli");
    // The calibration must land on (or immediately beside) the quality that
    // actually produced the wire bytes, and say how far off it was.
    expect(d.attribution.quality).not.toBeNull();
    expect(Math.abs(d.attribution.quality! - 4)).toBeLessThanOrEqual(1);
    expect(Math.abs(d.attribution.calibrationResidualBytes!)).toBeLessThan(encoded * 0.02);
    expect(sum(d)).toBe(encoded + 300);
  });

  it("calibrates with the WIRE'S OWN codec: a zstd wire gets a zstd model, at the level that produced it", () => {
    // The first attested batch was refused for exactly this: Chromium
    // negotiates zstd, so the bench browser's documents ride a zstd wire
    // while br-only clients still get brotli — a brotli model fitted to
    // that byte count mislabels its own ratios.
    const encoded = zstdBytes(doc, 2);
    const d = decomposeDocument(doc, encoded + 300, encoded, "zstd");
    expect(d.attribution.estimator).toBe("loo-wire-normalised");
    expect(d.attribution.codec).toBe("zstd");
    expect(d.attribution.contentEncoding).toBe("zstd");
    expect(Math.abs(d.attribution.quality! - 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(d.attribution.calibrationResidualBytes!)).toBeLessThan(encoded * 0.02);
    expect(d.attribution.calibrationTargetSource).toBe("encoded-body");
    expect(sum(d)).toBe(encoded + 300);
    // And the split itself stays in family with the brotli-wire split: the
    // codecs may differ, the attribution principle must not.
    const br4 = brotli(doc, 4);
    const viaBr = decomposeDocument(doc, br4, br4, "br");
    const drift = Math.abs(d.js / (encoded + 300) - viaBr.js / br4) / (viaBr.js / br4);
    expect(drift, "zstd-priced and brotli-priced JS shares diverged").toBeLessThan(0.1);
  });

  it("the level knobs are ALIVE: distant-level targets calibrate to distinct settings (the dead-knob class)", () => {
    // If a codec's level option went dead (an API change silently ignoring
    // params), every scanned level would produce one size and calibration
    // would always land on the FIRST candidate — making the ±1 pins above
    // pass vacuously against a level-1-flavored target. Distant targets
    // must calibrate apart, or the knob is not turning.
    const zLow = decomposeDocument(doc, zstdBytes(doc, 2), zstdBytes(doc, 2), "zstd");
    const zHigh = decomposeDocument(doc, zstdBytes(doc, 19), zstdBytes(doc, 19), "zstd");
    expect(zLow.attribution.quality, "zstd level knob is dead").not.toBe(zHigh.attribution.quality);
    const gLow = decomposeDocument(doc, gzipBytes(doc, 1), gzipBytes(doc, 1), "gzip");
    const gHigh = decomposeDocument(doc, gzipBytes(doc, 9), gzipBytes(doc, 9), "gzip");
    expect(gLow.attribution.quality, "gzip level knob is dead").not.toBe(gHigh.attribution.quality);
  });

  it("the transfer-size fallback fit is labeled as such — a header-padded target is not a body fit", () => {
    const wire = brotli(doc, 4);
    const d = decomposeDocument(doc, wire + 700); // no encodedBodySize; headers inflate the target
    expect(d.attribution.estimator).toBe("loo-wire-normalised");
    expect(d.attribution.calibrationTargetSource).toBe("transfer-size");
    // The publication gate refuses this source; the split still runs for
    // dev use and says exactly what it fitted against.
    expect(d.attribution.calibrationTargetBytes).toBe(wire + 700);
  });

  it("an UNCOMPRESSED document needs no estimate: exact uncompressed share, and it says so", () => {
    const docBytes = Buffer.byteLength(doc, "utf8");
    const d = decomposeDocument(doc, docBytes + 300, docBytes);
    expect(d.attribution.estimator).toBe("uncompressed-share-identity");
    expect(d.attribution.quality).toBeNull();
    expect(sum(d)).toBe(docBytes + 300);
  });

  it("never claims IDENTITY from the transferSize fallback — headers can outweigh compression on a small doc", () => {
    // transferSize includes response header bytes, so for a small
    // well-compressed document the fallback target can exceed the decoded
    // size — which must label itself as the fallback it is, never as a
    // verified identity encoding (verify-slice, this unit).
    const small = `<!doctype html><body><p>tiny</p><script>x()</script></body>`;
    const docBytes = Buffer.byteLength(small, "utf8");
    const d = decomposeDocument(small, docBytes + 700);
    // Distinct from "uncompressed-share-fallback" (calibration ran, every
    // marginal vanished): an auditor must be able to tell "the caller had
    // no compressed body size" apart from "the document was degenerate".
    expect(d.attribution.estimator).toBe("uncompressed-share-no-encoded-size");
    expect(sum(d)).toBe(docBytes + 700);
  });

  it("records the wire's content-encoding verbatim, so a non-brotli wire cannot hide behind a brotli calibration", () => {
    const encoded = brotli(doc, 4);
    const asBr = decomposeDocument(doc, encoded + 300, encoded, "br");
    expect(asBr.attribution.contentEncoding).toBe("br");
    const asGzip = decomposeDocument(doc, encoded + 300, encoded, "gzip");
    expect(asGzip.attribution.contentEncoding).toBe("gzip");
    // A gzip wire gets the gzip model — codec and encoding stay in lockstep
    // so the publication gate's model-matches-wire rule can hold.
    expect(asGzip.attribution.estimator).toBe("loo-wire-normalised");
    expect(asGzip.attribution.codec).toBe("gzip");
    // RFC 9110: coding tokens are case-insensitive — "GZIP" selects the
    // same model instead of falling through to brotli-by-accident.
    expect(decomposeDocument(doc, encoded + 300, encoded, "GZIP").attribution.codec).toBe("gzip");
  });

  it("the gzip model honors its level — calibration reproduces a gzip-produced target (the typo'd-options class)", () => {
    // gzipSync({ leve: 6 }) would compress at the default with no error and
    // every scanned "level" would produce one size — this pin makes a dead
    // level knob fail loudly, the way the zstd pin does for zstd.
    const target = gzipBytes(doc, 6);
    const d = decomposeDocument(doc, target + 300, target, "gzip");
    expect(d.attribution.codec).toBe("gzip");
    expect(Math.abs(d.attribution.quality! - 6)).toBeLessThanOrEqual(1);
    expect(Math.abs(d.attribution.calibrationResidualBytes!)).toBeLessThan(target * 0.02);
    expect(d.attribution.calibrationTargetBytes).toBe(target);
  });

  it("the committed zstd evidence re-derives: sha256, decode, and the +4 B level-2 fit (ADR-0001 addendum O coda)", () => {
    // The manifest's claim must be CI-checkable, not a one-session
    // observation: read the committed wire body, verify its manifest hash,
    // and reproduce the calibration the coda cites. Bounds are loose enough
    // to survive a node zstd-build drift, tight enough that a corrupted
    // fixture or a broken model fails.
    const labDir = join(pkgRoot, "..", "bench-runner", "estimator-lab");
    const manifest = JSON.parse(readFileSync(join(labDir, "manifest.json"), "utf8")) as {
      bodies: Array<{ file: string; sha256: string; wireBytes: number }>;
    };
    const entry = manifest.bodies.find((b) => b.file === "bodies/vanilla-editorial.zst")!;
    expect(entry).toBeDefined();
    const raw = readFileSync(join(labDir, entry.file));
    expect(raw.length).toBe(entry.wireBytes);
    expect(createHash("sha256").update(raw).digest("hex")).toBe(entry.sha256);
    const body = zstdDecompressSync(raw).toString("utf8");
    const level2 = zstdBytes(body, 2);
    expect(Math.abs(level2 - entry.wireBytes)).toBeLessThan(entry.wireBytes * 0.01);
    // The "same page" claim is pinned, not assumed: the zstd wire and the
    // brotli wire must decode to the identical document (they were fetched
    // a day apart, straddling a deploy — verified identical, now asserted).
    const brBody = brotliDecompressSync(
      readFileSync(join(labDir, "bodies", "vanilla-editorial.br")),
    ).toString("utf8");
    expect(body === brBody, "the zstd and brotli evidence bodies are not the same page").toBe(true);
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
