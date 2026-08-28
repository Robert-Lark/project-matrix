/**
 * One measured visit (ADR-0001 §2, §3, §5, §6): drive a composed-origin URL
 * in a real Chromium under an applied profile, and account for everything
 * the receipt needs — from the browser's own accounting, never estimates.
 *
 *  - Web vitals come from the injected chrome's own pinned web-vitals build
 *    (THE one ruler, §2), harvested by intercepting `POST /api/beacon`: the
 *    payload is recorded and the request is fulfilled locally with a 204,
 *    so LAB traffic never reaches the RUM collector (§1: lab and field have
 *    split roles — a bench run must not pollute field data).
 *  - Bytes are compressed transfer sizes from resource timing (§6), bucketed
 *    HTML/JS/CSS/fonts/images/data (§3), with every /_pm/* and /api/beacon
 *    byte stripped (the instrumentation-boundary contract,
 *    packages/switcher/README.md) — stripped but REPORTED, so the exclusion
 *    is visible and provably non-vacuous.
 *  - TTFB decomposes into travel vs server think-time from the navigation-
 *    timing sub-phases (§5), raw timestamps kept (§9: publish the arithmetic).
 *  - The scripted interaction is a registry id (reproducible by name); the
 *    resource-timing delta across it is the per-interaction byte cost (§3).
 */
import {
  brotliCompressSync,
  deflateSync,
  gzipSync,
  zstdCompressSync,
  constants as zlibConstants,
} from "node:zlib";
import type { Browser, Page } from "playwright";
import { kbpsToBytesPerSecond, type TestProfile } from "@pm/measurement";
import { type RunSampleT } from "./receipt";

/** Scripted interactions, reproducible from a receipt by id. */
export const INTERACTIONS: Readonly<
  Record<string, (page: Page) => Promise<void>>
> = {
  none: async () => {},
  /** The trivial interaction (issue #7: placeholders exercise it trivially):
   *  a real click on the page body — enough for the event-timing pipeline
   *  (INP) and a zero-byte per-interaction cost on static placeholders. */
  "body-click": async (page) => {
    await page.locator("main h1").first().click();
  },
  /** The editorial surface's ONE designed interaction (ADR-0008 §8): the
   *  featured release's Add to cart. Selected by accessible role + name —
   *  the canonical markup contract every variant must serve identically —
   *  and clicked with NO warm-up click before it, so the first click's
   *  latency is what the receipt records.
   *
   *  Stated precisely, because the harness bounds what this can claim: the
   *  runner deliberately settles post-load idle work BEFORE the click
   *  (ADR-0001 addendum I, so the initial/interaction byte split is
   *  deterministic). A paradigm that defers handler FETCHING to idle has
   *  therefore finished fetching by click time, and this number measures
   *  what remains at that moment — resolving and running the handler — not
   *  the download. The event-timing entry the INP pipeline needs exists
   *  either way, since the event registers regardless of when the handler
   *  resolves. */
  "editorial-add-to-cart": async (page) => {
    await page.getByRole("button", { name: "Add to cart" }).click();
  },
  /** The PDP's headline interaction (ADR-0008 §8; the pdp-build ticket names
   *  it "the interaction this surface genuinely owns, where the paradigms
   *  differ most — DOM swap vs state re-render vs resumed handler"): switch
   *  the gallery stage to another image.
   *
   *  `.nth(1)`, and the index is load-bearing. Thumb 0 is ALREADY the
   *  selected one (the master renders `aria-current="true"` on it and the
   *  stage carries `images[0]`), so clicking it re-assigns the same `src`,
   *  changes no state, and fetches nothing — while still recording a real
   *  INP entry, because the event registers regardless of what the handler
   *  does. That is a plausible-looking, meaningless cell, which is worse
   *  than a missing one.
   *
   *  Selected by CLASS, not by accessible name: the thumb's name is
   *  `View image N of M: {alt}` and the alt embeds the release title, so a
   *  name-based locator would break the day the bench slug changes. The
   *  class is the canonical markup contract all four variants must serve
   *  identically (packages/reference/render/pdp.mjs galleryBlock), and
   *  Playwright's strict mode makes a duplicate or missing node a loud
   *  failure rather than a silent mis-measurement.
   *
   *  **This interaction FETCHES, by design, and the receipt must say so.**
   *  Every variant's stage swaps to the FULL-size AVIF (`current.src`),
   *  a URL the load never requested because the thumb carries the 160 px
   *  `.thumb.avif` derivative (ADR-0008 §11). Measured on the deployed
   *  plane 2026-08-28: image 2 of release 896191 is 24,894 B, and the URL
   *  is byte-identical across all four paradigms — so this cell's bytes are
   *  IMAGE MASS, invariant by construction, and are never a paradigm
   *  difference. The INP half is the paradigm difference. */
  "pdp-gallery-switch": async (page) => {
    await page.locator(".pm-gallery__thumb").nth(1).click();
  },
  /** The PDP's add-to-cart — the controlled cross-surface twin of
   *  `editorial-add-to-cart` (same paradigm, same interaction, different
   *  surface), and the PDP's zero-fetch interaction: the handler writes
   *  `localStorage` and updates two slots, so nothing crosses the wire.
   *
   *  Selected by CLASS rather than editorial's `getByRole("button", {name:
   *  "Add to cart"})` idiom, which is NOT portable to this surface: the
   *  unpriced master (707725) renders the same button reading "None for
   *  sale" and disabled (pdp.mjs:117), so a name-based locator resolves ZERO
   *  nodes there. `.pm-pdp__buy button.pm-button` matches exactly one node
   *  on every master — the fenced live-origin plaque's button is a
   *  `pm-button--secondary` OUTSIDE `.pm-pdp__buy`.
   *
   *  **The class locator resolves on every master; it is only CLICKABLE on a
   *  priced one.** `pdp.mjs:117` renders that same button `disabled` when the
   *  release is sold out, and Playwright's actionability check then retries
   *  the enabled state until the 30 s default action timeout and throws — a
   *  batch pointed at the unpriced master would burn half an hour before
   *  saying anything useful, and the message it finally gave would name a
   *  locator timeout rather than the real constraint. So the constraint is
   *  checked here, immediately, and named (verify-slice, correctness lens).
   *
   *  The addendum-I caveat on `editorial-add-to-cart` applies here verbatim:
   *  the runner settles post-load idle work onto the INITIAL byte side
   *  before clicking, so a paradigm that defers handler FETCHING to idle has
   *  finished fetching by click time and this number measures resolving and
   *  running the handler, not downloading it. */
  "pdp-add-to-cart": async (page) => {
    const button = page.locator(".pm-pdp__buy button.pm-button");
    if (await button.isDisabled()) {
      throw new Error(
        `pdp-add-to-cart cannot be driven on this release: its buy button is disabled, which is what ` +
          `packages/reference/render/pdp.mjs renders when numForSale is 0 ("None for sale"). Bench a ` +
          `PRICED release, or drive pdp-gallery-switch — do not wait for the actionability timeout to ` +
          `report this as a locator problem`,
      );
    }
    await button.click();
  },
};

export interface ApplyResult {
  mechanism: string;
  latencyMs: number;
  downloadBytesPerSec: number;
  uploadBytesPerSec: number;
  cpuMultiplier: number;
}

/**
 * Apply the profile's network/CPU axes at the automation layer via CDP —
 * the pinned TARGET characteristics applied directly (the profile spec
 * documents that Lighthouse's own applied-throttling multipliers are its
 * business, not the spec's). Returns what was actually sent to the browser.
 */
export async function applyProfile(
  page: Page,
  profile: TestProfile,
): Promise<ApplyResult> {
  const cdp = await page.context().newCDPSession(page);
  const applied: ApplyResult = {
    mechanism: "cdp-applied (Network.emulateNetworkConditions + Emulation.setCPUThrottlingRate)",
    latencyMs: profile.network.rttMs,
    downloadBytesPerSec: kbpsToBytesPerSecond(profile.network.downloadKbps),
    uploadBytesPerSec: kbpsToBytesPerSecond(profile.network.uploadKbps),
    cpuMultiplier: profile.cpuMultiplier,
  };
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: applied.latencyMs,
    downloadThroughput: applied.downloadBytesPerSec,
    uploadThroughput: applied.uploadBytesPerSec,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: applied.cpuMultiplier });
  return applied;
}

/** Browser-context options for a profile's viewport axis — JS ON (the
 *  measurement client must run; contrast the drift gate's JS-off contexts). */
export function profileContextOptions(profile: TestProfile) {
  return {
    viewport: { width: profile.viewport.width, height: profile.viewport.height },
    deviceScaleFactor: profile.viewport.deviceScaleFactor,
    isMobile: profile.viewport.mobile,
    hasTouch: profile.viewport.mobile,
  };
}

interface ResourceEntry {
  name: string;
  transferSize: number;
}

/** The instrumentation boundary (packages/switcher/README.md): /_pm/*
 *  subresources and /api/beacon requests are the chrome's, not the page's. */
function isInstrumentation(url: string): boolean {
  const pathname = new URL(url).pathname;
  return pathname.startsWith("/_pm/") || pathname === "/api/beacon";
}

function bucketOf(url: string): keyof RunSampleT["kb"]["buckets"] {
  const pathname = new URL(url).pathname;
  if (pathname.startsWith("/api/")) return "data";
  const ext = pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "";
  if (["js", "mjs"].includes(ext)) return "js";
  if (ext === "css") return "css";
  if (["woff2", "woff", "ttf", "otf"].includes(ext)) return "fonts";
  if (["avif", "png", "jpg", "jpeg", "webp", "svg", "gif", "ico"].includes(ext)) {
    return "images";
  }
  return "other";
}

/**
 * The document response is ONE compressed stream, so its wire cost
 * (`transferSize`) cannot be split into per-part compressed sizes by
 * measurement — brotli is applied over the whole body at once. It is instead
 * ATTRIBUTED across four parts (ADR-0001 §3 addendum superseding addendum G,
 * 2026-08-15): `transferSize` stays the authority on the LEVEL, and the
 * between-part RATIOS come from leave-one-out brotli marginals at a
 * wire-calibrated quality — see the estimator note below. Three parts are
 * carved out of what would otherwise all land in the HTML bucket:
 *
 *  - INLINE EXECUTABLE `<script>` (no `src`, JS/module type) → the JS bucket
 *    and the initial-JS headline. Without this an inlined bundle (Astro inlines
 *    its ~1.2 KB cart module) reports "0 KB JS" against the no-runtime control —
 *    the defect the 2026-08-01 addendum settled (issue #16 defect 1).
 *  - INLINE NON-EXECUTABLE `<script>` (a `type` the browser will not run:
 *    application/json, qwik/json, importmap, …) → the DATA bucket. These are
 *    serialized payloads a paradigm ships (Astro's cart-item JSON, Qwik's
 *    resumability state) — data, not executable JS and not prose HTML.
 *    Attributing them to JS would inflate the headline a hostile reader is
 *    meant to trust (serialized state is not runtime); leaving them in HTML
 *    hides them in the prose cell.
 *  - INJECTED INSTRUMENTATION MARKUP — the front Worker's chrome subtree
 *    (`<aside id="pm-chrome">…`), its `/_pm/*` head links, and the measurement
 *    `<script src="/_pm/…">` tag — → instrumentation, STRIPPED from every
 *    bucket like the `/_pm/*` subresource PAYLOADS already are (ADR-0001 §6,
 *    packages/switcher/README.md). The document byte bucket must not carry the
 *    instrument's own markup (audit 2026-08-01, collect.ts:303).
 *
 * Which paradigm delivers its script inline vs external, executable vs
 * serialized data, IS the render-axis variable (ADR-0003 §2) — this split is
 * what makes that variable visible instead of hidden in the HTML total.
 *
 * THE ESTIMATOR (bench-instrumentation-dilution; supersedes addendum G's
 * uncompressed-share rule). Uncompressed share is exact only if every part
 * compresses at the document's average ratio, and the injected chrome
 * violates that hardest: it compresses far better than average, so it was
 * over-attributed and every OTHER bucket under-attributed — measured at
 * 40–47% on the smallest published JS cells, with the bias growing with the
 * chrome (astro's published cell moved 0.42→0.37 KB on a chrome-only
 * change). The rule now is:
 *
 *  1. LEVEL: the four parts still sum EXACTLY to `transferSize`
 *     (largest-remainder apportionment, unchanged).
 *  2. RATIOS: each part's weight is its leave-one-out marginal — the bytes
 *     the compressed document LOSES when exactly that part's regions are
 *     removed — computed with THE WIRE'S OWN CODEC at the setting that best
 *     reproduces the observed wire body (`encodedBodySize`; scan the
 *     codec's range, pick the minimum absolute residual, record it).
 *     Measured on the deployed plane: brotli q4 reproduces the br wire
 *     within 0.1–0.3% on all three delivery shapes (2026-08-15), and zstd
 *     level 2 reproduces the zstd wire Chromium actually negotiates within
 *     0.08% (2026-08-16). The calibration is re-derived per document rather
 *     than hard-coded, so the ruler follows the CDN — in codec as well as
 *     in setting.
 *  3. IDENTITY: a document served uncompressed needs no estimate — per-part
 *     wire cost IS the uncompressed size, and the rule degrades to exact
 *     truth (uncompressed share).
 *
 * Stated bias, so nobody re-derives it wrong: disjoint parts' marginals do
 * not sum to the whole (redundancy shared BETWEEN parts is saved only when
 * the second part goes, so it belongs to no single marginal) — the shortfall
 * measured 0.94–0.95× on the three real shapes, so normalisation scales
 * every part up ~×1.05–1.06, slightly over-crediting parts that share more
 * context than average. Validated against the two failure modes that killed
 * the old rule: a chrome-only change now moves the JS cell ≤0.3% (was
 * 14.1%), and an inlined copy of a real file attributes within ~2% of what
 * the identical file costs served externally (was −40.5%). The residual is
 * recorded per run in `attribution`, never assumed.
 */
export interface DocumentAttribution {
  /** Which rule attributed the document's wire bytes (see block comment).
   *  The two fallback labels are DISTINCT on purpose: "no-encoded-size"
   *  means the caller could not supply the compressed body size (so the
   *  headers-included transferSize was the only target and identity could
   *  not be verified); "fallback" means calibration ran and every
   *  leave-one-out marginal vanished on a degenerate document. An auditor
   *  must be able to tell them apart from the artifact alone. */
  estimator:
    | "loo-wire-normalised"
    | "uncompressed-share-identity"
    | "uncompressed-share-no-encoded-size"
    | "uncompressed-share-fallback"
    | "degraded-all-html";
  /**
   * The compression model the ratios were computed with — THE WIRE'S OWN
   * CODEC, selected from the response's content-encoding. The first
   * attested batch (2026-08-16) proved why this cannot be hard-coded:
   * Chromium negotiates zstd and Cloudflare serves it, while curl-shaped
   * br-only requests still get brotli — a brotli model fitted to that zstd
   * wire was caught by the publication gate on its first real run. zstd
   * level 2 reproduces Cloudflare's zstd wire within 0.08% (measured; the
   * body is committed in the estimator lab).
   */
  codec: "brotli" | "zstd" | "gzip" | "deflate" | null;
  /** Calibrated codec setting — brotli quality / zstd level / zlib level
   *  (loo-wire-normalised only, else null). */
  quality: number | null;
  /** The calibration target itself — the compressed body the model was
   *  fitted against — so the residual is judgeable from the artifact alone
   *  (a residual without its denominator is not a bound). */
  calibrationTargetBytes: number | null;
  /** WHAT the target was: the compressed body (the honest fit) or the
   *  headers-included transferSize fallback when the browser exposed no
   *  encodedBodySize. A fallback fit is labeled so the publication gate can
   *  refuse it — a header-padded target is not a body fit (loo only). */
  calibrationTargetSource: "encoded-body" | "transfer-size" | null;
  /** model(body, quality) − the calibration target, in bytes (loo only). */
  calibrationResidualBytes: number | null;
  /** The document response's content-encoding, recorded verbatim: the
   *  publication gate refuses a split whose model codec does not match the
   *  wire it claims to have calibrated against. */
  contentEncoding: string | null;
}

export interface DocumentBytes {
  html: number;
  js: number;
  data: number;
  instrumentation: number;
  /** How these four numbers were derived — recorded, never assumed. */
  attribution: DocumentAttribution;
}

// Inline `<script>` the browser EXECUTES as JS: an empty/absent type, or a
// JavaScript MIME type. Anything else carrying a type (application/json,
// qwik/json, importmap, speculationrules, application/ld+json, …) is a
// non-executed data payload.
const EXECUTABLE_SCRIPT_TYPES = new Set([
  "",
  "text/javascript",
  "application/javascript",
  "text/ecmascript",
  "application/ecmascript",
  "module",
]);

/**
 * Tokenize a start tag's attribute string into name→value, lowercasing names.
 * A proper tokenizer, not a per-name regex scan: a `\b${name}` or even a
 * whitespace-anchored scan can match a namespaced/hyphenated attribute
 * (`q:type`, `data-type`) or the same token appearing INSIDE another
 * attribute's quoted value — Qwik really emits
 * `<script type="module" q:type="preload">`, and a wrong `type` read there
 * misbooks executable JS as data. Consuming each quoted value atomically makes
 * a value that contains `type=` inert. First occurrence of a name wins.
 */
function parseAttrs(attrs: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const m of attrs.matchAll(re)) {
    const name = m[1]!.toLowerCase();
    if (!out.has(name)) out.set(name, m[3] ?? m[4] ?? m[5] ?? "");
  }
  return out;
}

const utf8Len = (s: string): number =>
  typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(s).length
    : Buffer.byteLength(s, "utf8");

type PartLabel = "html" | "js" | "data" | "instrumentation";
const PART_ORDER: readonly PartLabel[] = ["html", "js", "data", "instrumentation"];

/**
 * Split the served body into an ordered list of labeled segments covering
 * every byte exactly once. The three carve-outs are DISJOINT regions of the
 * served bytes (the chrome aside contains no `<script>`; the measurement
 * script is its sibling; the `/_pm/` links live in `<head>`), so nothing is
 * counted twice, and HTML is the remainder between them. Kept as ORDERED
 * segments (not mere byte counts) because the leave-one-out marginals below
 * compress the document with one part's regions removed, in document order.
 */
function segmentDocument(body: string): Array<{ label: PartLabel; text: string }> {
  const marks: Array<{ start: number; end: number; label: PartLabel }> = [];
  // Script content cannot contain "</script>" (the HTML tokenizer ends the
  // element there), so this non-greedy match is exact.
  for (const m of body.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = parseAttrs(m[1] ?? "");
    const src = attrs.get("src");
    let label: PartLabel;
    if (src !== undefined) {
      // External script: its PAYLOAD is counted from resource timing. Only the
      // instrument's own tag is stripped here (its /_pm/ payload is already
      // excluded); a variant's own external-script TAG stays HTML markup.
      if (!src.includes("/_pm/")) continue;
      label = "instrumentation";
    } else {
      const type = (attrs.get("type") ?? "").trim().toLowerCase();
      label = EXECUTABLE_SCRIPT_TYPES.has(type) ? "js" : "data";
    }
    marks.push({ start: m.index, end: m.index + m[0].length, label });
  }
  // Injected instrumentation markup: the chrome subtree + its `/_pm/` head
  // links (chrome has no nested <aside> and no inline <script>, so these
  // regions are disjoint from the script scan above).
  const chrome = body.match(/<aside\b[^>]*\bid="pm-chrome"[\s\S]*?<\/aside>/i);
  if (chrome?.index !== undefined) {
    marks.push({ start: chrome.index, end: chrome.index + chrome[0].length, label: "instrumentation" });
  }
  for (const m of body.matchAll(/<link\b[^>]*\/_pm\/[^>]*>/gi)) {
    marks.push({ start: m.index, end: m.index + m[0].length, label: "instrumentation" });
  }
  marks.sort((a, b) => a.start - b.start);
  const segments: Array<{ label: PartLabel; text: string }> = [];
  let pos = 0;
  for (const mark of marks) {
    // Disjoint by construction on real pages; a pathological overlap keeps
    // the FIRST mark rather than double-counting bytes.
    if (mark.start < pos) continue;
    if (mark.start > pos) segments.push({ label: "html", text: body.slice(pos, mark.start) });
    segments.push({ label: mark.label, text: body.slice(mark.start, mark.end) });
    pos = mark.end;
  }
  if (pos < body.length) segments.push({ label: "html", text: body.slice(pos) });
  return segments;
}

type WireCodec = "brotli" | "zstd" | "gzip" | "deflate";

interface CodecModel {
  codec: WireCodec;
  qualities: readonly number[];
  compress: (text: string, quality: number) => number;
}

const BROTLI_MODEL: CodecModel = {
  codec: "brotli",
  qualities: Array.from({ length: 12 }, (_, q) => q),
  compress: (text, quality) =>
    brotliCompressSync(Buffer.from(text, "utf8"), {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: quality },
    }).length,
};

/**
 * The compression model matching the wire's own content-encoding. The
 * calibration principle ("the setting that reproduces the observed wire")
 * only holds when the MODEL is the wire's codec: Chromium negotiates zstd
 * and Cloudflare serves it, so the bench browser's documents ride a zstd
 * wire while br-only clients still get brotli — a brotli model fitted to
 * the zstd byte count mislabels its own ratios (caught by the publication
 * gate on the first attested batch, 2026-08-16). Unknown encodings fall
 * back to the brotli model; the codec field then shows the mismatch and
 * the publication gate refuses it.
 */
function modelForEncoding(contentEncoding: string | null): CodecModel {
  // RFC 9110 §8.4.1: content-coding tokens are case-insensitive, and the
  // header is list-valued. Selection normalizes; the RECORDED value stays
  // verbatim. A multi-coding list ("gzip, br") deliberately falls through
  // to the default: no single model prices a double-coded wire, and the
  // publication gate then refuses it by the codec/wire mismatch rather
  // than by accident of string comparison.
  const token = contentEncoding === null ? null : contentEncoding.trim().toLowerCase();
  switch (token) {
    case "zstd":
      return {
        codec: "zstd",
        qualities: Array.from({ length: 19 }, (_, i) => i + 1),
        compress: (text, quality) =>
          zstdCompressSync(Buffer.from(text, "utf8"), {
            params: { [zlibConstants.ZSTD_c_compressionLevel]: quality },
          }).length,
      };
    case "gzip":
    case "x-gzip": // RFC 9110 §8.4.1.3: x-gzip is an alias for gzip
      return {
        codec: "gzip",
        qualities: Array.from({ length: 9 }, (_, i) => i + 1),
        compress: (text, quality) => gzipSync(Buffer.from(text, "utf8"), { level: quality }).length,
      };
    case "deflate":
      return {
        codec: "deflate",
        qualities: Array.from({ length: 9 }, (_, i) => i + 1),
        compress: (text, quality) =>
          deflateSync(Buffer.from(text, "utf8"), { level: quality }).length,
      };
    default:
      return BROTLI_MODEL;
  }
}

const compressedBytes = (model: CodecModel, text: string, quality: number): number =>
  text.length === 0 ? 0 : model.compress(text, quality);

/** The codec setting whose whole-document output best reproduces the
 *  observed wire bytes — scanned over the model's full range, smallest
 *  absolute residual wins (first winner on a tie, so the pick is
 *  deterministic). Calibrated per document rather than hard-coded so the
 *  ruler follows the CDN — in codec as well as in setting. */
function calibrateQuality(
  model: CodecModel,
  body: string,
  targetBytes: number,
): { quality: number; compressed: number } {
  let best: { quality: number; compressed: number } | null = null;
  for (const q of model.qualities) {
    const compressed = compressedBytes(model, body, q);
    if (!best || Math.abs(compressed - targetBytes) < Math.abs(best.compressed - targetBytes)) {
      best = { quality: q, compressed };
    }
  }
  return best!;
}

/**
 * Decompose one served HTML document's compressed `transferSize` into
 * html/js/data/instrumentation (see the block comment above): level from
 * `transferSize`, ratios from leave-one-out brotli marginals at the quality
 * calibrated against `encodedBodySize` (the compressed body the browser
 * actually received; falls back to `transferSize` — headers included, and
 * the recorded residual then shows it — when the caller has no body size).
 * `body` is the exact decoded bytes the browser received (chrome injection
 * already applied). An identity-encoded response (no compression on the
 * wire) uses uncompressed share, which is exact there, not an estimate.
 */
export function decomposeDocument(
  body: string,
  transferSize: number,
  encodedBodySize?: number,
  contentEncoding: string | null = null,
): DocumentBytes {
  const docBytes = utf8Len(body);
  if (docBytes === 0 || transferSize <= 0) {
    return {
      html: Math.max(transferSize, 0),
      js: 0,
      data: 0,
      instrumentation: 0,
      attribution: {
        estimator: "degraded-all-html",
        codec: null,
        quality: null,
        calibrationTargetBytes: null,
        calibrationTargetSource: null,
        calibrationResidualBytes: null,
        contentEncoding,
      },
    };
  }

  const segments = segmentDocument(body);
  const uncompressed: Record<PartLabel, number> = { html: 0, js: 0, data: 0, instrumentation: 0 };
  for (const s of segments) uncompressed[s.label] += utf8Len(s.text);

  // The identity claim needs the real compressed-body size: transferSize
  // includes response HEADER bytes (Resource Timing §4.6.2), so on a small
  // well-compressed document the fallback target can exceed docBytes and
  // would otherwise mislabel a compressed response as identity-encoded with
  // no recorded residual (verify-slice, this unit). Without encodedBodySize
  // the split still runs — labeled as the fallback it is, never as identity.
  const hasEncoded = encodedBodySize !== undefined && encodedBodySize > 0;
  const target = hasEncoded ? encodedBodySize : transferSize;
  let weights: number[];
  let attribution: DocumentAttribution;
  if (hasEncoded && target >= docBytes) {
    // Identity-encoded wire: per-part wire cost IS the uncompressed size.
    weights = PART_ORDER.map((p) => uncompressed[p]);
    attribution = {
      estimator: "uncompressed-share-identity",
      codec: null,
      quality: null,
      calibrationTargetBytes: null,
      calibrationTargetSource: null,
      calibrationResidualBytes: null,
      contentEncoding,
    };
  } else if (!hasEncoded && target >= docBytes) {
    weights = PART_ORDER.map((p) => uncompressed[p]);
    attribution = {
      estimator: "uncompressed-share-no-encoded-size",
      codec: null,
      quality: null,
      calibrationTargetBytes: null,
      calibrationTargetSource: null,
      calibrationResidualBytes: null,
      contentEncoding,
    };
  } else {
    const model = modelForEncoding(contentEncoding);
    const { quality, compressed } = calibrateQuality(model, body, target);
    // Leave-one-out marginal per part: what the compressed document loses
    // when that part's regions are removed (in document order — the
    // carve-outs are non-contiguous). Clamped at 0: a codec can in
    // principle shrink when bytes are ADDED back, and a negative weight
    // would be a negative byte attribution.
    weights = PART_ORDER.map((p) => {
      if (uncompressed[p] === 0) return 0;
      const without = segments
        .filter((s) => s.label !== p)
        .map((s) => s.text)
        .join("");
      return Math.max(0, compressed - compressedBytes(model, without, quality));
    });
    if (weights.some((w) => w > 0)) {
      attribution = {
        estimator: "loo-wire-normalised",
        codec: model.codec,
        quality,
        calibrationTargetBytes: target,
        calibrationTargetSource: hasEncoded ? "encoded-body" : "transfer-size",
        calibrationResidualBytes: compressed - target,
        contentEncoding,
      };
    } else {
      // Every marginal vanished (a degenerate document): fall back to the
      // uncompressed share rather than divide by zero — and say so.
      weights = PART_ORDER.map((p) => uncompressed[p]);
      attribution = {
        estimator: "uncompressed-share-fallback",
        codec: null,
        quality: null,
        calibrationTargetBytes: null,
        calibrationTargetSource: null,
        calibrationResidualBytes: null,
        contentEncoding,
      };
    }
  }

  // Apportion transferSize across the four buckets by weight via
  // LARGEST-REMAINDER (Hamilton): floor each share, then hand the leftover units
  // to the largest fractional parts. Exact (sums to transferSize) AND every
  // bucket ≥ 0. A plain per-bucket `Math.round` with HTML as the remainder can
  // drive HTML NEGATIVE when several tiny carve-outs each round up (verify-slice,
  // anti-rigging lens: transferSize=2 over 1 B js + 1 B data + 1 B chrome →
  // html = 2−1−1−1 = −1). A zero-weight part can never receive a leftover unit:
  // leftover equals the sum of the fractional parts, which is strictly smaller
  // than the count of parts with a positive fraction.
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map((w) => (transferSize * w) / totalWeight);
  const out = shares.map((s) => Math.floor(s));
  const leftover = transferSize - out.reduce((a, b) => a + b, 0);
  const byFraction = shares
    .map((s, i) => ({ i, frac: s - Math.floor(s) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < leftover; k++) out[byFraction[k]!.i]! += 1;
  return { html: out[0]!, js: out[1]!, data: out[2]!, instrumentation: out[3]!, attribution };
}

async function resourceEntries(page: Page): Promise<ResourceEntry[]> {
  return page.evaluate(() =>
    performance.getEntriesByType("resource").map((e) => ({
      name: e.name,
      transferSize: (e as PerformanceResourceTiming).transferSize,
    })),
  );
}

export interface VisitSpec {
  effectiveUrl: string;
  interactionId: string;
  /** Upper bound (ms) for the signal-based settle waits — see
   *  {@link SETTLE_CAP_MS}. Not a fixed wait. */
  settleMs?: number;
}

/**
 * The CEILING on the runner's signal-based settle waits — the interaction
 * byte boundary (network-idle) and the vitals-beacon flush (delivery
 * quiesces). It is a hang-guard, never the boundary itself: the boundary is
 * always the real signal (a fetch completing, a beacon arriving), and this cap
 * only bounds how long the runner waits for a signal that may never come —
 * which then surfaces honestly as absent bytes / a null vital for the suite to
 * judge, exactly as ADR-0001 §9 and tools/drift-gate/README.md's "wait for the
 * real signal, never a proxy" require. Replaces the former fixed 400 ms settle
 * that could crop a slow interaction fetch or a slow beacon flush silently.
 */
export const SETTLE_CAP_MS = 3000;

/**
 * The quiet window that defines "the network went idle" — 500 ms with nothing
 * in flight, the same window Playwright's own `networkidle` names, kept so the
 * boundary's DEFINITION is unchanged. Only the mechanism that measures it
 * changes (see {@link armNetworkQuiescence}).
 */
export const NETWORK_QUIET_MS = 500;

/**
 * Ceiling for the PRE-interaction quiescence waits (the initial byte
 * boundary). Deliberately far larger than {@link SETTLE_CAP_MS}: capping the
 * INITIAL side early would move `initialJsBytes` — the published headline —
 * whereas capping the interaction side only records `interactionSettled:
 * false`, which refuses publication instead of corrupting a number. Matches
 * the effective bound the superseded `waitForLoadState("networkidle")` calls
 * carried (Playwright's 30 s default navigation timeout), and a cap-out here
 * throws rather than degrading, exactly as those calls did.
 */
export const LOAD_QUIET_CAP_MS = 30_000;

/**
 * A GENUINE network-quiescence measurement, armed once per visit and awaited
 * wherever a boundary needs the network to be quiet.
 *
 * **Why this exists — `page.waitForLoadState("networkidle")` cannot do this
 * job, and the way it fails is silent.** It is a document-load-lifecycle
 * LATCH, not a measurement. Playwright's own typings say so:
 * "If the state has been already reached while loading current document, the
 * method resolves immediately" (playwright-core 1.61.1
 * `types/types.d.ts:5020`), and they mark `networkidle` **DISCOURAGED**. Once
 * the current document has reached networkidle — which the pre-interaction
 * settle loop below GUARANTEES — every later call on that document returns at
 * once, forever. No navigation happens across a scripted interaction, so the
 * post-click call could never observe anything.
 *
 * Measured on the deployed plane 2026-08-28, all four PDP variants: the
 * post-click call returned in **24–49 ms**, where any real 500 ms quiet window
 * cannot resolve in under 500 ms. So `pdp-gallery-switch`'s own 25,194 B image
 * fetch was still in flight at the boundary snapshot and landed in NEITHER
 * `interactionBytes` NOR `totalBytes` — while `interactionSettled` recorded
 * `true`, asserting that zero as VERIFIED. That is the precise failure
 * `interactionSettled` was added to make impossible (ADR-0001 addendum M), and
 * it defeated it: the flag proved only that a latch was already closed.
 *
 * The same latch made the pre-interaction loop's trailing wait vacuous too —
 * its comment claimed the wait "bridges the import + the preload cascade",
 * which it never did. That one turned out to cost nothing: measured across all
 * five editorial and all four PDP variants, a genuine quiescence wait after
 * the loop surfaces **0 new entries and 0 byte change**, because the
 * requestIdleCallback passes plus the entry-count stability check already give
 * the cascade its time. Recorded rather than assumed — it is why this fix
 * moves no published byte cell, and the claim is re-derivable by re-running
 * that probe.
 *
 * The mechanism: track in-flight requests from the page's OWN request/response
 * events, armed before the navigation so nothing is missed, and resolve only
 * after `quietMs` has elapsed with nothing in flight — measured from the call,
 * so each boundary gets a fresh window. Returns whether that window was
 * actually observed, so a cap-out is recorded rather than disguised.
 *
 * Stated limit, unchanged from the 500 ms convention it keeps: a request the
 * page starts MORE than `quietMs` after the last activity lands outside the
 * window. The measured margin is wide — the interaction fetch is dispatched
 * within ~30 ms of the click on every variant — but it is a bound, not a
 * proof, and it is the same bound `networkidle` always carried.
 */
export function armNetworkQuiescence(page: Page): {
  wait(quietMs: number, capMs: number): Promise<boolean>;
} {
  let inFlight = 0;
  let lastActivity = Date.now();
  // A routed-and-fulfilled request (the beacon) still emits request +
  // requestfinished, so it is accounted like any other — instrumentation is
  // stripped from the BYTES by known path, never from the quiescence signal.
  const onRequest = () => {
    inFlight += 1;
    lastActivity = Date.now();
  };
  const onDone = () => {
    // Floor at 0: a request that finishes after its own arming window (or a
    // duplicate terminal event) must not drive the counter negative, which
    // would make the "nothing in flight" test pass while something is.
    inFlight = Math.max(0, inFlight - 1);
    lastActivity = Date.now();
  };
  page.on("request", onRequest);
  page.on("requestfinished", onDone);
  page.on("requestfailed", onDone);
  return {
    async wait(quietMs: number, capMs: number): Promise<boolean> {
      const startedAt = Date.now();
      // The window is measured FROM THIS CALL, not from the last event
      // before it: a boundary asks "has the network been quiet since I
      // started watching", and inheriting an older idle stretch is exactly
      // the latch behaviour this replaces.
      lastActivity = Date.now();
      for (;;) {
        if (inFlight === 0 && Date.now() - lastActivity >= quietMs) return true;
        if (Date.now() - startedAt >= capMs) return false;
        await page.waitForTimeout(25);
      }
    },
  };
}

/**
 * Capture the chrome's vitals beacons WITHOUT taking the browser cache away
 * from the rest of the visit.
 *
 * **Why not `page.route`, which is what this replaced.** Lab/field isolation
 * requires that a measured visit never DELIVERS a beacon (ADR-0001 §6), and
 * that was done with a `page.route` glob over the beacon path. Playwright's
 * own typings state the price: "Enabling routing disables http cache"
 * (playwright-core 1.61.1 `types/types.d.ts:4063`). The routing is not
 * URL-scoped at the browser — every request is paused so the glob can be
 * matched in JS — so one beacon route took the HTTP cache away from the whole
 * visit, on every run this project has ever published.
 *
 * **That is a measurement defect, and it was measured, not reasoned.** Qwik's
 * PDP gallery re-writes `src` on all five thumbs with the value each already
 * has (9 mutations against react-next's 4; the nodes survive, so it is a
 * re-render, not a replacement). With the browser cache ON those writes are
 * served from memory and the click costs **25,194 B** — the stage image
 * alone, byte-identical to vanilla, react-next and astro. With the cache OFF
 * the same five no-op writes become five real downloads and the click reads
 * **52,032 B**. One variable, `page.route` on/off, reproduced on the local
 * crate plane and on the deployed plane (probe, 2026-08-28). The instrument
 * was manufacturing a 26,838 B paradigm difference no visitor can experience
 * — a number that would have published as qwik's cost.
 *
 * **The replacement pauses ONLY the beacon URL**, at the browser, through
 * CDP's own pattern filter, so every other request is served the way a real
 * first-time visitor's is: from a fresh context whose cache behaves normally.
 * That is what ADR-0001's "the browser HTTP cache is a held-constant" always
 * meant — held at what a first-time visitor has, not held at OFF, which is
 * no visitor at all. Verified to capture all five metrics
 * (TTFB/FCP/LCP/CLS/INP) and to leave the gallery switch at 25,194 B on all
 * four variants.
 *
 * A `sendBeacon` request never appears in resource timing in ANY of these
 * modes (measured: 0 `/api/beacon` entries with routing, with CDP
 * interception, and with no capture at all), so changing the capture
 * mechanism cannot move `instrumentationBytes` or the instrumentation
 * request count.
 *
 * Stated limit: `chrome-constant.ts` still routes, and must — it SERVES a
 * prefetched fragment, which needs interception by construction. Its figures
 * are a within-run A/B delta with the cache-off condition held identical in
 * both arms, and it never re-touches an already-loaded URL, so the artifact
 * above cannot reach it. Recorded here so the exception is visible rather
 * than discovered.
 */
async function armBeaconCapture(
  page: Page,
  beacons: Array<{ name?: string; value?: number }>,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  cdp.on("Fetch.requestPaused", (event) => {
    try {
      // `postDataEntries` FIRST, `postData` only as a fallback. CDP's
      // `Request.postData` is deprecated and Chromium omits it for bodies it
      // did not inline (setting `hasPostData` instead) — Playwright itself
      // reads the entries. Reading only the deprecated field would drop the
      // beacon silently: nothing throws, the request is still fulfilled, and
      // every vital in the run records as null while the arrival loop burns
      // its whole cap waiting for metrics that were captured and discarded
      // (verify-slice, conformance lens).
      const entries = (event.request as { postDataEntries?: { bytes?: string }[] })
        .postDataEntries;
      const body =
        entries && entries.length > 0
          ? entries
              .map((e) => (e.bytes ? Buffer.from(e.bytes, "base64").toString("utf8") : ""))
              .join("")
          : event.request.postData;
      if (typeof body === "string" && body.length > 0) beacons.push(JSON.parse(body));
    } catch {
      /* malformed payload — the assertion surface is the suite, not here */
    }
    // ALWAYS fulfil, whatever the parse did: a paused request never emits
    // `requestfinished`, so leaving one paused would wedge the quiescence
    // tracker that defines every byte boundary in this file — the failure
    // would surface as a cap-out on an unrelated measurement.
    void cdp
      .send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 204 })
      .catch(() => {
        /* the page went away under us; there is nothing left to answer */
      });
  });
  await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/beacon*" }] });
}

/**
 * Drive one visit and return the full per-run sample.
 *
 * Every visit gets a FRESH browser context: the browser HTTP cache is a
 * confound, not a measured axis (the cache columns measure the EDGE tier,
 * ADR-0002 §8) — on the deployed plane assets ship `immutable`/etags, so a
 * shared context would silently zero run 2+'s transfer sizes. A fresh
 * context makes every run a first-time visitor by construction.
 */
export async function measureVisit(
  browser: Browser,
  profile: TestProfile,
  spec: VisitSpec,
): Promise<{ sample: RunSampleT; applied: ApplyResult }> {
  // Object.hasOwn: a prototype key would resolve to an inherited function
  // and silently measure NO interaction (see batch.ts's matching guard).
  const interaction = Object.hasOwn(INTERACTIONS, spec.interactionId)
    ? INTERACTIONS[spec.interactionId]
    : undefined;
  if (!interaction) {
    throw new Error(`unknown interaction id: ${spec.interactionId}`);
  }
  const settleCapMs = spec.settleMs ?? SETTLE_CAP_MS;
  const context = await browser.newContext(profileContextOptions(profile));
  const page = await context.newPage();
  try {
    const applied = await applyProfile(page, profile);

    // Armed BEFORE the navigation, so every request of the visit is accounted
    // and no boundary can be judged against a counter that started mid-flight
    // (arming after `goto` would read "nothing in flight" while the page's own
    // subresources were still loading). One tracker serves every boundary
    // below; it is deliberately never detached — it must outlive the first
    // wait to serve the interaction boundary, and it dies with the page.
    const network = armNetworkQuiescence(page);

    // Lab/field isolation: capture the chrome's beacons, never deliver them.
    const beacons: Array<{ name?: string; value?: number }> = [];
    await armBeaconCapture(page, beacons);

    const response = await page.goto(spec.effectiveUrl, { waitUntil: "load" });
    const docCacheState = response?.headers()["x-pm-cache-state"] ?? null;
    // Recorded into the byte attribution: a brotli-calibrated split against
    // a non-brotli compressed wire must be visible in the artifact.
    const docContentEncoding = response?.headers()["content-encoding"] ?? null;
    // The exact decoded document bytes the browser received (chrome injection
    // already applied) — the raw material for the byte decomposition below. A
    // body that can't be retrieved degrades to "" (all document bytes stay in
    // the HTML bucket, the pre-decomposition behaviour), never throws.
    let servedBody = "";
    try {
      servedBody = (await response?.text()) ?? "";
    } catch {
      servedBody = "";
    }
    // Whether this page carries the instrument chrome — derived from the LIVE
    // DOM, NOT from servedBody: a body-read failure must degrade ONLY the byte
    // decomposition (to all-HTML), never silently skip the vitals-beacon flush
    // below and null the run's web-vitals — the two concerns were wrongly
    // coupled through servedBody (verify-slice, correctness + seams lenses).
    const hasChrome = await page.evaluate(
      () => document.getElementById("pm-chrome") !== null,
    );

    // A cap-out on the INITIAL side throws rather than degrading: the byte
    // boundary would otherwise fall at an arbitrary moment and the receipt
    // would not say so. Same fail-loud behaviour the superseded
    // `waitForLoadState("networkidle")` had here through its default timeout.
    const quietAfterLoad = async () => {
      if (!(await network.wait(NETWORK_QUIET_MS, LOAD_QUIET_CAP_MS))) {
        throw new Error(
          `the network never went quiet for ${NETWORK_QUIET_MS} ms within ${LOAD_QUIET_CAP_MS} ms of load ` +
            `(${spec.effectiveUrl}) — the initial byte boundary would be arbitrary, so the visit refuses ` +
            `rather than mint a sample whose initial/interaction split is undefined`,
        );
      }
    };
    await quietAfterLoad();
    // Defect 4 (issue #16): Qwik's preloader is the only post-load fetching
    // among the live variants, and it runs inside requestIdleCallback(…,
    // {timeout: 2000}) — under a throttled profile or on a loaded runner it can
    // be starved PAST the quiescence above, so the byte boundary would fall in
    // the MIDDLE of it and the same build would yield two different receipts.
    // Settle post-load idle work onto the INITIAL byte side before the snapshot.
    // The rIC only guarantees Qwik's load handler has DEQUEUED and kicked off
    // its async import(); the real settling is the trailing quiescence wait that
    // bridges the import + the preload cascade (each modulepreload's onload
    // triggers the next wave), so THAT wait is load-bearing, not redundant. Loop
    // rIC→quiesce until a pass surfaces no new resource-timing entries, so a
    // cascade gap wider than one quiet window cannot end the snapshot
    // mid-cascade — bounded so a page that never settles cannot hang here.
    //
    // Until 2026-08-28 the trailing wait here was
    // `waitForLoadState("networkidle")`, which is a document-lifecycle LATCH
    // and returned immediately every time (see armNetworkQuiescence) — so the
    // "bridges the cascade" claim above described a mechanism that did not
    // exist. It cost nothing, and that is measured, not assumed: a genuine
    // quiescence wait after this loop surfaces 0 new entries and 0 byte change
    // on all five editorial and all four PDP variants, because the rIC passes
    // plus the count-stability check already give the cascade its time. The
    // claim is true now for the reason it always stated.
    let priorCount = -1;
    for (let pass = 0; pass < 5; pass++) {
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            const rIC = globalThis.requestIdleCallback;
            if (rIC) rIC(() => resolve(), { timeout: 2000 });
            else setTimeout(resolve, 50);
          }),
      );
      await quietAfterLoad();
      const count = (await resourceEntries(page)).length;
      if (count === priorCount) break;
      priorCount = count;
    }

    const initialEntries = await resourceEntries(page);

    await interaction(page);
    // Interaction byte boundary (ADR-0001 §3): wait for the real signal — the
    // network going quiet — so an interaction-triggered fetch of ANY duration
    // is captured, not a fixed proxy window (a fetch slower than the old 400 ms
    // vanished from interactionBytes AND totalBytes). Bounded by settleCapMs so
    // a request wedged in flight surfaces as absent interaction bytes for the
    // suite to judge instead of hanging or being disguised.
    // Whether that wait actually reached idle, RECORDED. A timeout here and
    // a genuinely quiet interaction both yield zero interaction bytes, so
    // "nothing was fetched for the click" — the strongest empirical claim
    // the published fit line makes — was indistinguishable from "the runner
    // stopped waiting" in the artifact. It is a real distinction: requests
    // still in flight never appear in resource timing at all (verify-slice,
    // anti-rigging lens).
    //
    // This is the wait that was BROKEN, and the flag above is what made the
    // break invisible: `waitForLoadState("networkidle")` returned in 24–49 ms
    // (measured, all four PDP variants) because the latch had already closed
    // during load, so a 25,194 B interaction fetch was recorded as 0 B with
    // interactionSettled: true. A guard that can pass vacuously is not a guard
    // (ADR-0001 §9), and this one was passing vacuously on every run the
    // project has ever published.
    const interactionSettled = await network.wait(NETWORK_QUIET_MS, settleCapMs);
    const afterEntries = await resourceEntries(page);

    // Wait for the interaction's own event-timing entry to EXIST before
    // flushing, or INP is silently lost — a false-FAIL (and worse, a null
    // metric in a published receipt) traced to web-vitals' own source rather
    // than guessed:
    //
    //  - `initMetric` starts INP at -1 (initMetric.js: `value = -1`), and
    //    `bindReporter` gates every emission — INCLUDING a forced one — behind
    //    `if (metric.value >= 0)`. So an INP that was never computed is not
    //    reported as 0; nothing is sent at all and the run records null.
    //  - INP is only computed once an entry reaches the InteractionManager,
    //    and that hop runs inside `whenIdleOrHidden` — a requestIdleCallback
    //    while the page is still visible.
    //  - The `event` observer cannot supply that entry here: it uses
    //    web-vitals' default `durationThreshold: 40`, and a trivial click on a
    //    static page measures ~8ms (verified in Chromium: one `pointerdown`
    //    entry, duration 8). INP therefore depends ENTIRELY on the buffered
    //    `first-input` observation, which arrives asynchronously.
    //
    // A fixed settle window is the wrong instrument for that: on a loaded
    // machine (a CI runner, or a dev box running anything else) the browser
    // can still be producing the entry when the window elapses, and the visit
    // records INP: null with no error anywhere. Waiting on the entry itself is
    // deterministic — `first-input` IS retained in the performance timeline
    // (which is what makes web-vitals' `buffered: true` work), so it can be
    // polled directly.
    //
    // Placement is deliberate: AFTER the byte accounting above, so nothing
    // measured moves — this only widens the window the vitals flush gets. A
    // timeout is swallowed on purpose: if no interaction entry ever appears,
    // that is a real finding for the suite's assertions to report as
    // INP: null, not something to disguise by failing the visit here.
    // Waiting for the entry is necessary but NOT sufficient, and the second
    // half is the part that actually starves. web-vitals' observer callback
    // does not compute INP inline: it defers into `whenIdleOrHidden`, i.e. a
    // `requestIdleCallback`. Meanwhile the ONLY emission that can ever fire is
    // the forced `report(true)` inside INP's own visibility-hidden handler — a
    // non-forced `report()` with the default `reportAllChanges: false` emits
    // nothing at all (`bindReporter`: the inner `if (forceReport ||
    // reportAllChanges)`). And that forced report runs BEFORE the deferred
    // idle work in the case that matters, because `getVisibilityWatcher`'s
    // listener is registered first and therefore fires first. So if the idle
    // callback has not run by then, `metric.value` is still -1, the forced
    // report is dropped, and the entry we waited for changes nothing.
    //
    // Idle callbacks run in request order, so awaiting one requested HERE
    // proves the earlier-queued one has already run and `metric.value` is set
    // before the flush below. The `timeout` option bounds it: if the page never
    // goes idle the callback is invoked anyway, and a genuinely absent INP
    // still surfaces as null for the suite to judge rather than hanging here.
    if (spec.interactionId !== "none") {
      await page
        .waitForFunction(
          () => performance.getEntriesByType("first-input").length > 0,
          undefined,
          { timeout: 10_000 },
        )
        .catch(() => {
          /* no entry: let the receipt record null and the suite judge it */
        });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            const rIC: typeof globalThis.requestIdleCallback | undefined =
              globalThis.requestIdleCallback;
            if (rIC) rIC(() => resolve(), { timeout: 2000 });
            else setTimeout(resolve, 50);
          }),
      );
    }

    // Flush the measurement client (its own reporting trigger): final
    // values report on visibility-hidden.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    // Wait for the beacons to ARRIVE — not a fixed window, and NOT mere
    // quiescence. web-vitals sends each metric as its OWN sendBeacon, and on a
    // loaded runner the later ones (CLS/INP) can land >150 ms after the early
    // ones (TTFB/FCP/LCP), so a "no new beacon for a slice" check exits in that
    // gap and drops them — the exact null-vitals-shrinks-the-median failure this
    // wait exists to prevent (audit 2026-08-01, collect.ts:254; CI-confirmed).
    // Wait until every EXPECTED metric has arrived, bounded by settleCapMs so a
    // genuinely absent one still surfaces as null for the suite to judge rather
    // than hanging. A chromeless page fires no beacon by design — skip the wait.
    if (hasChrome) {
      const expected = ["TTFB", "FCP", "LCP", "CLS"];
      if (spec.interactionId !== "none") expected.push("INP");
      const deadline = Date.now() + settleCapMs;
      for (;;) {
        const arrived = new Set(
          beacons
            .map((b) => b.name)
            .filter((n): n is string => typeof n === "string"),
        );
        if (expected.every((m) => arrived.has(m))) break;
        if (Date.now() > deadline) break;
        await page.waitForTimeout(25);
      }
    }

    const nav = await page.evaluate(() => {
      const e = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (!e) return null;
      return {
        startTime: e.startTime,
        redirectCount: e.redirectCount,
        fetchStart: e.fetchStart,
        domainLookupStart: e.domainLookupStart,
        domainLookupEnd: e.domainLookupEnd,
        connectStart: e.connectStart,
        secureConnectionStart: e.secureConnectionStart,
        connectEnd: e.connectEnd,
        requestStart: e.requestStart,
        responseStart: e.responseStart,
        responseEnd: e.responseEnd,
        transferSize: e.transferSize,
        // The compressed body the browser received — the calibration target
        // for the document byte attribution (decomposeDocument).
        encodedBodySize: e.encodedBodySize,
      };
    });
    if (nav === null) {
      throw new Error(`no navigation timing entry for ${spec.effectiveUrl}`);
    }

    const vitals: Record<string, number | null> = {
      TTFB: null, FCP: null, LCP: null, CLS: null, INP: null,
    };
    for (const b of beacons) {
      if (typeof b.name === "string" && b.name in vitals && typeof b.value === "number") {
        vitals[b.name] = b.value;
      }
    }

    const buckets = { html: 0, js: 0, css: 0, fonts: 0, images: 0, data: 0, other: 0 };
    let instrumentationBytes = 0;
    let instrumentationRequests = 0;
    let counted = 0;
    for (const entry of afterEntries) {
      if (isInstrumentation(entry.name)) {
        instrumentationBytes += entry.transferSize;
        instrumentationRequests += 1;
        continue;
      }
      counted += 1;
      buckets[bucketOf(entry.name)] += entry.transferSize;
    }
    // The document itself: decomposed from its single compressed transferSize
    // into html/js/data plus STRIPPED instrumentation markup — level from
    // transferSize, ratios from wire-calibrated leave-one-out brotli
    // marginals (decomposeDocument). Counted as one request.
    const doc = decomposeDocument(
      servedBody,
      nav.transferSize,
      nav.encodedBodySize,
      docContentEncoding,
    );
    buckets.html += doc.html;
    buckets.js += doc.js;
    buckets.data += doc.data;
    instrumentationBytes += doc.instrumentation;
    counted += 1;

    // Initial JS is the external initial-snapshot JS PLUS the document's own
    // inline executable script (present at load) — which is why an inlined
    // bundle no longer reads as zero (issue #16 defect 1).
    const initialJsBytes =
      doc.js +
      initialEntries
        .filter((e) => !isInstrumentation(e.name) && bucketOf(e.name) === "js")
        .reduce((sum, e) => sum + e.transferSize, 0);
    // Resource-timing entries are append-only: everything past the initial
    // snapshot's length was fetched because of the interaction — including
    // RE-fetches of URLs the page already loaded (a name-keyed diff would
    // hide those and underreport the interaction cost).
    const interactionBytes = afterEntries
      .slice(initialEntries.length)
      .filter((e) => !isInstrumentation(e.name))
      .reduce((sum, e) => sum + e.transferSize, 0);

    const sample: RunSampleT = {
      docCacheState,
      interactionSettled,
      ttfb: {
        travelMs: nav.requestStart - nav.startTime,
        serverMs: nav.responseStart - nav.requestStart,
        raw: {
          startTime: nav.startTime,
          redirectCount: nav.redirectCount,
          fetchStart: nav.fetchStart,
          domainLookupStart: nav.domainLookupStart,
          domainLookupEnd: nav.domainLookupEnd,
          connectStart: nav.connectStart,
          secureConnectionStart: nav.secureConnectionStart,
          connectEnd: nav.connectEnd,
          requestStart: nav.requestStart,
          responseStart: nav.responseStart,
          responseEnd: nav.responseEnd,
        },
      },
      webVitals: {
        TTFB: vitals.TTFB ?? null,
        FCP: vitals.FCP ?? null,
        LCP: vitals.LCP ?? null,
        CLS: vitals.CLS ?? null,
        INP: vitals.INP ?? null,
      },
      kb: {
        buckets,
        initialJsBytes,
        interactionBytes,
        instrumentationBytes,
        totalBytes: Object.values(buckets).reduce((a, b) => a + b, 0),
        // Which estimator split the document's wire bytes, at what calibrated
        // quality, with what residual — the attribution is part of the
        // receipt, never assumed (ADR-0001 §3 addendum, 2026-08-15).
        docAttribution: doc.attribution,
      },
      requests: {
        counted,
        instrumentation: instrumentationRequests,
      },
    };
    return { sample, applied };
  } finally {
    await context.close();
  }
}
