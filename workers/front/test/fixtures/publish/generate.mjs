// The publication gate's fixtures (workers-hardening, 2026-09-25): one
// committed malformed artifact per refusal class in lab/publish.mjs, plus the
// VALID controls they are derived from. Run `node generate.mjs` from this
// directory to (re)write receipts/*.json and chrome-constants/*.json; the
// test holds the committed files byte-identical to what this file produces
// (the reference masters' regeneration rule), so a fixture cannot be edited
// by hand into something this table does not describe.
//
// WHY a table beside a generator, not thirty hand-written files: every
// fixture is the valid control with ONE field turned wrong, and the field is
// the class. Written by hand, the thirty copies drift from each other and
// from the runner's receipt shape; derived, the one BASE is held to the
// runner's own Zod schema by tools/bench-runner's test, and each row names
// exactly what it broke. The rows carry the expected message too, so the
// mutation and the refusal it must produce sit on one line — a row whose
// mutation stops producing its message is the test going red.
//
// Shapes mirror a real committed receipt (lab/receipts/editorial-*.json)
// field for field, with three runs per column and small round numbers. The
// surface is the PDP (four registered variants, a `constant` interaction
// declaration) because that surface exercises every clause the editorial
// `"none"` declaration does not.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SHA = "b7e2c3d4e5f60718293a4b5c6d7e8f9012345678";
const OTHER_SHA = "0123456789abcdef0123456789abcdef01234567";
export const DATE = "2026-09-20T10:00:00.000Z";
export const SURFACE = "pdp";
export const INTERACTION = "pdp-gallery-switch";
/** Every run in every column fetches exactly this much: the gallery's
 *  full-size AVIF, image mass in all four paradigms (FIT.pdp). */
const INTERACTION_BYTES = 25194;
/** initial-JS per variant: [run 0, run 1, run 2] — four bands that do not
 *  overlap, so the valid control publishes a sentence. THREE runs, so a
 *  median can hide one stray run (the mechanism two refusal classes are
 *  about) while staying the honest median of its own runs. */
const INITIAL_JS = {
  vanilla: [2000, 2010, 2020],
  "react-next": [90000, 90100, 90200],
  astro: [5000, 5050, 5100],
  qwik: [20000, 20100, 20200],
};
const RUNS_PER_URL = 3;
const VARIANTS = Object.keys(INITIAL_JS);

const clone = (v) => JSON.parse(JSON.stringify(v));
/** The median of an odd run count: the middle value. */
const medianOf = (values) => [...values].sort((a, b) => a - b)[(values.length - 1) / 2];

function run(variant, i, column) {
  const initialJsBytes = INITIAL_JS[variant][i];
  return {
    docCacheState: column === "cold" ? "bypass" : "hit",
    interactionSettled: true,
    ttfb: {
      travelMs: 70 + i,
      serverMs: 50 + i,
      raw: { startTime: 0, requestStart: 70 + i, responseStart: 120 + 2 * i, responseEnd: 140 },
    },
    webVitals: { TTFB: 120 + 2 * i, FCP: 280 + 4 * i, LCP: 440 + 4 * i, CLS: 0, INP: 24 },
    kb: {
      buckets: { html: 2500, js: initialJsBytes, css: 15000, fonts: 28000, images: 9600, data: 0, other: 0 },
      initialJsBytes,
      interactionBytes: INTERACTION_BYTES,
      instrumentationBytes: 22000,
      totalBytes: 55100 + initialJsBytes,
      docAttribution: {
        estimator: "loo-wire-normalised",
        codec: "zstd",
        quality: 3,
        calibrationTargetBytes: 5000,
        calibrationTargetSource: "encoded-body",
        calibrationResidualBytes: 0,
        contentEncoding: "zstd",
      },
    },
    requests: { counted: 15, instrumentation: 3 },
  };
}

function column(variant, name, profileId) {
  const runs = Array.from({ length: RUNS_PER_URL }, (_, i) => run(variant, i, name));
  const med = (pick) => medianOf(runs.map(pick));
  return {
    effectiveUrl: `http://127.0.0.1:8787/${variant}/pdp/fixture-release/?run=fixture-${profileId}${name === "cold" ? "&cache=cold" : ""}`,
    runs,
    medians: {
      ttfbTravelMs: med((r) => r.ttfb.travelMs),
      ttfbServerMs: med((r) => r.ttfb.serverMs),
      webVitals: {
        TTFB: med((r) => r.webVitals.TTFB),
        FCP: med((r) => r.webVitals.FCP),
        LCP: med((r) => r.webVitals.LCP),
        CLS: 0,
        INP: 24,
      },
      totalBytes: med((r) => r.kb.totalBytes),
      initialJsBytes: med((r) => r.kb.initialJsBytes),
      interactionBytes: INTERACTION_BYTES,
      requests: 15,
    },
    resourceProfile: {
      cpuMs: { value: 12, source: "cdp Performance.getMetrics TaskDuration (serving-path attribution)" },
      bytes: { value: med((r) => r.kb.totalBytes), source: "resource timing transferSize, instrumentation stripped" },
      requests: { value: 15, source: "resource timing entry count, instrumentation stripped" },
    },
  };
}

/** The VALID receipt for one profile — the control every row starts from. */
export function baseReceipt(profileId = "avg-broadband-desktop") {
  return {
    kind: "pm-bench-receipt",
    receiptVersion: 1,
    date: DATE,
    commit: { sha: SHA, dirty: false },
    origin: "http://127.0.0.1:8787",
    originCommit: { sha: SHA, dirty: false },
    runLocation: { label: "local-dev", source: "unpinned developer machine (fixture)" },
    profile: {
      id: profileId,
      specVersion: 1,
      applied: {
        mechanism: "cdp Network.emulateNetworkConditions + Emulation.setCPUThrottlingRate",
        latencyMs: 40,
        downloadBytesPerSec: 1250000,
        uploadBytesPerSec: 750000,
        cpuMultiplier: 1,
        viewport: { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false },
      },
    },
    environment: { n: 24, runNonce: `fixture-${profileId}` },
    runsPerUrl: RUNS_PER_URL,
    harness: { browser: "chromium", browserVersion: "fixture", settleMs: 500, quiescence: "in-flight-tracked" },
    methodNotes: ["fixture receipt for the publication gate's refusal tests — never minted, never published"],
    targets: VARIANTS.map((variant) => ({
      path: `/${variant}/pdp/fixture-release/`,
      variant,
      surface: SURFACE,
      interactionId: INTERACTION,
      columns: { cold: column(variant, "cold", profileId), warm: column(variant, "warm", profileId) },
    })),
  };
}

/** The fragment the test's stand-in renderer produces: the identity gate is
 *  proven against THIS, so the generator and the test share the function. */
export function fixtureFragment(ctx) {
  return `<div data-pm-chrome="fixture">${ctx.variant}/${ctx.surface}${ctx.search}@${ctx.location}:${ctx.lab ? "populated" : "empty"}</div>`;
}
export const CC_CONTEXT = {
  variant: "vanilla",
  surface: SURFACE,
  pathname: "/vanilla/pdp/fixture-release/",
  search: "",
  location: "local",
};
const sha256Hex = (text) => createHash("sha256").update(text).digest("hex");

/** The VALID chrome constant — its sha256 is the stand-in renderer's own
 *  output for CC_CONTEXT with a populated lab. */
export function baseChromeConstant() {
  const fragment = fixtureFragment({ ...CC_CONTEXT, lab: {} });
  return {
    kind: "pm-chrome-constant",
    date: DATE,
    commit: { sha: SHA, dirty: false },
    originCommit: { sha: SHA, dirty: false },
    deltaMedians: { FCP: 76, LCP: 76, CLS: 0, longTaskMs: 0 },
    measuredChrome: {
      populated: true,
      sha256: sha256Hex(fragment),
      bytes: Buffer.byteLength(fragment, "utf8"),
      renderContext: clone(CC_CONTEXT),
    },
  };
}

const everyRun = (receipt, f) => {
  for (const t of receipt.targets) for (const c of ["cold", "warm"]) for (const r of t.columns[c].runs) f(r, t, c);
};

/**
 * One row per refusal class. `site` names the throw site in publish.mjs
 * (several rows may share one site when one `if` guards two conditions);
 * `expect` is matched against the thrown message. `kind` says which gate
 * function the test drives and what the fixture is:
 *  - receipt: receipts/<id>.json through admitReceipt as `admitAs`
 *  - batch:   receipts/<id>.json as the SECOND receipt beside the valid one,
 *             through assertBatchIntegrity
 *  - chrome-constant: chrome-constants/<id>.json through admitChromeConstant
 *  - fit:     the VALID receipt through admitReceipt with `fit` mutating
 *             FIT.pdp (a template is code — its malformation lives here)
 *  - registry: labSurfacesOf over `registry`
 * `outcome` rows do not throw: the gate answers with a refused-to-publish
 * bundle shape instead (the band rule), asserted by `check`.
 */
export const CASES = [
  // ── admitReceipt: provenance and estimator ─────────────────────────────
  { id: "not-a-v1-receipt", kind: "receipt", site: "not-v1", mutate: (r) => { r.receiptVersion = 2; }, expect: /is not a v1 pm-bench-receipt/, schemaValid: false },
  { id: "wrong-kind", kind: "receipt", site: "not-v1", mutate: (r) => { r.kind = "pm-chrome-constant"; }, expect: /is not a v1 pm-bench-receipt/, schemaValid: false },
  { id: "dirty-tree", kind: "receipt", site: "dirty-tree", mutate: (r) => { r.commit.dirty = true; }, expect: /minted from a dirty tree/ },
  { id: "no-origin-commit-after-cutoff", kind: "receipt", site: "no-origin-commit", mutate: (r) => { delete r.originCommit; }, expect: /carries no originCommit/ },
  // The cutoff DAY itself is inside the rule (`>=`): a receipt dated
  // 2026-08-16 with no attestation is refused (skeptic lens, mutant `>=` → `>`).
  { id: "no-origin-commit-on-cutoff-day", kind: "receipt", site: "no-origin-commit", mutate: (r) => { r.date = "2026-08-16T00:00:00.000Z"; delete r.originCommit; }, expect: /is dated 2026-08-16 but carries no originCommit/ },
  { id: "no-doc-attribution-after-cutoff", kind: "receipt", site: "no-doc-attribution", mutate: (r) => { delete r.targets[1].columns.warm.runs[1].kb.docAttribution; }, expect: /carries no docAttribution/ },
  { id: "unattested-origin", kind: "receipt", site: "unattested-origin", mutate: (r) => { r.originCommit = null; }, expect: /did not attest its build/ },
  { id: "dirty-origin", kind: "receipt", site: "dirty-origin", mutate: (r) => { r.originCommit.dirty = true; }, expect: /plane built from a dirty tree/ },
  { id: "cross-tree", kind: "receipt", site: "cross-tree", mutate: (r) => { r.originCommit.sha = OTHER_SHA; }, expect: /a cross-tree receipt is not publishable/ },
  { id: "degraded-estimator", kind: "receipt", site: "degraded-estimator", mutate: (r) => { r.targets[0].columns.cold.runs[0].kb.docAttribution.estimator = "degraded-all-html"; }, expect: /a degraded or fallback attribution cannot publish/ },
  { id: "identity-on-compressed-wire", kind: "receipt", site: "identity-compressed", mutate: (r) => { const a = r.targets[2].columns.warm.runs[0].kb.docAttribution; a.estimator = "uncompressed-share-identity"; a.codec = null; a.contentEncoding = "br"; }, expect: /labeled identity-encoded while the wire declared/ },
  { id: "codec-mismatch", kind: "receipt", site: "codec-mismatch", mutate: (r) => { r.targets[3].columns.warm.runs[1].kb.docAttribution.codec = "brotli"; }, expect: /must be priced by the wire's own codec/ },
  { id: "missing-calibration", kind: "receipt", site: "missing-calibration", mutate: (r) => { r.targets[0].columns.warm.runs[0].kb.docAttribution.calibrationResidualBytes = null; }, expect: /omits its calibration target\/residual/ },
  { id: "transfer-size-calibration", kind: "receipt", site: "transfer-size-calibration", mutate: (r) => { r.targets[1].columns.cold.runs[0].kb.docAttribution.calibrationTargetSource = "transfer-size"; }, expect: /only a compressed-body fit publishes/ },
  { id: "calibration-miss", kind: "receipt", site: "calibration-miss", mutate: (r) => { r.targets[2].columns.cold.runs[1].kb.docAttribution.calibrationResidualBytes = 101; }, expect: /calibration missed its wire by 101 B on 5000 B/ },
  // ── admitReceipt: surface identity, the fence, the template ───────────
  { id: "no-lab-surface", kind: "receipt", site: "no-lab-surface", admitAs: "checkout-avg-broadband-desktop.json", mutate: () => {}, expect: /names no lab surface/ },
  { id: "filename-profile-mismatch", kind: "receipt", site: "filename-profile", admitAs: "pdp-slow-4g-mid-phone.json", mutate: () => {}, expect: /should be named pdp-avg-broadband-desktop\.json/ },
  { id: "target-surface-mismatch", kind: "receipt", site: "target-surface", mutate: (r) => { r.targets[1].surface = "editorial"; }, expect: /a receipt cannot publish under a surface its own targets disprove/ },
  { id: "fenced-target", kind: "receipt", site: "fenced-target", mutate: (r) => { r.targets[1].path = "/remix3/pdp/fixture-release/"; }, expect: /falls under the fenced exhibit/ },
  { id: "no-fit-template", kind: "fit", site: "no-fit-template", fit: () => undefined, expect: /has no FIT\.pdp template/ },
  // ── bundleFromReceipt: the column axis and the template's declarations ─
  { id: "column-axis", kind: "receipt", site: "column-axis", mutate: (r) => { r.targets.pop(); }, expect: /a publication must cover exactly the surface's live variants/ },
  // EXACT, not subset, in the other direction: a fifth variant the surface
  // does not register is refused before the band rule can swallow it
  // (skeptic lens, mutant exact → subset admitted five columns).
  { id: "column-axis-extra-variant", kind: "receipt", site: "column-axis", mutate: (r) => { const extra = clone(r.targets[0]); extra.variant = "htmx"; extra.path = "/htmx/pdp/fixture-release/"; r.targets.push(extra); }, expect: /this batch measured \[astro, htmx, qwik, react-next, vanilla\] but the surface is registered as serving \[astro, qwik, react-next, vanilla\]/ },
  { id: "no-interaction-timing", kind: "fit", site: "no-interaction-timing", fit: (f) => ({ ...f, interactionTiming: undefined }), expect: /declares no interactionTiming/ },
  { id: "withheld-without-reason", kind: "fit", site: "withheld-without-reason", fit: (f) => ({ ...f, interactionTiming: { publish: false } }), expect: /withholds its INP row but states no reason/ },
  { id: "unusable-interaction-fetch", kind: "fit", site: "unusable-interaction-fetch", fit: (f) => ({ ...f, interactionFetch: { kind: "constant" } }), expect: /declares no usable interactionFetch/ },
  // A tolerance of Infinity is a number the declaration's type admits and a
  // check that never fires (`max - min > Infinity` is false for every
  // spread): refused as unusable, not accepted as loose (skeptic lens).
  { id: "unusable-interaction-fetch-infinite", kind: "fit", site: "unusable-interaction-fetch", fit: (f) => ({ ...f, interactionFetch: { kind: "constant", toleranceBytes: Number.POSITIVE_INFINITY } }), expect: /declares no usable interactionFetch/ },
  { id: "many-interactions", kind: "receipt", site: "many-interactions", mutate: (r) => { r.targets[3].interactionId = "pdp-add-to-cart"; }, expect: /drove more than one interaction/ },
  { id: "no-interaction-id", kind: "fit", site: "no-interaction-id", fit: (f) => ({ ...f, interactionId: undefined }), expect: /names no interactionId/ },
  { id: "wrong-interaction", kind: "receipt", site: "wrong-interaction", mutate: (r) => { for (const t of r.targets) t.interactionId = "body-click"; }, expect: /but this batch drove "body-click"/ },
  { id: "unsettled-run", kind: "receipt", site: "unsettled-run", mutate: (r) => { r.targets[0].columns.cold.runs[1].interactionSettled = false; }, expect: /did not record reaching network quiescence/ },
  // ABSENT is unverified, not true: the runner's schema makes the flag
  // optional and says absent means unrecorded (receipt.ts), so the gate's
  // `!== true` must refuse it — a `=== false` would admit (skeptic lens).
  { id: "unsettled-run-absent", kind: "receipt", site: "unsettled-run", mutate: (r) => { delete r.targets[0].columns.cold.runs[1].interactionSettled; }, expect: /interactionSettled=undefined/ },
  { id: "missing-interaction-median", kind: "receipt", site: "missing-interaction-median", mutate: (r) => { r.targets[2].columns.cold.medians.interactionBytes = null; }, expect: /has no interaction-byte median for astro\/cold/ },
  { id: "none-but-fetched", kind: "fit", site: "none-but-fetched", fit: (f) => ({ ...f, interactionFetch: "none" }), expect: /declares interactionFetch "none", but vanilla\/warm run 0 measured 25194 B/ },
  { id: "constant-spread", kind: "receipt", site: "constant-spread", mutate: (r) => { const c = r.targets[3].columns.warm; for (const run of c.runs) run.kb.interactionBytes += 65; c.medians.interactionBytes += 65; }, expect: /but the batch spans 65 B/ },
  { id: "constant-zero", kind: "receipt", site: "constant-zero", mutate: (r) => { everyRun(r, (run) => { run.kb.interactionBytes = 0; }); for (const t of r.targets) { t.columns.warm.medians.interactionBytes = 0; t.columns.cold.medians.interactionBytes = 0; } }, expect: /measured 0 B everywhere — declare "none"/ },
  { id: "constant-stray-run", kind: "receipt", site: "constant-stray-run", mutate: (r) => { r.targets[1].columns.warm.runs[0].kb.interactionBytes = 0; }, expect: /individual runs do not: react-next\/warm run 0 measured 0 B/ },
  // A null run value is a receipt the runner cannot mint (its schema says
  // number) — a hand-edited artifact, flagged so the schema leg expects it.
  { id: "incomplete-run-set", kind: "receipt", site: "incomplete-run-set", mutate: (r) => { r.targets[0].columns.warm.runs[1].kb.initialJsBytes = null; }, expect: /has 2 usable initial-JS samples but the batch ran 3/, schemaValid: false },
  // astro's third warm run lands inside qwik's band; astro's median (its
  // middle run) is unchanged, so the receipt stays the honest median of its
  // own runs and only the BAND rule answers.
  { id: "band-overlap", kind: "receipt", site: null, mutate: (r) => { r.targets[2].columns.warm.runs[2].kb.initialJsBytes = 20050; }, outcome: "bandsOverlap" },
  // TOUCHING bands overlap too: astro's top run lands exactly on qwik's
  // bottom run, so the rule's `>=` is the boundary this row holds
  // (verify-slice, skeptic lens: mutant `>=` → `>` published a ranking).
  { id: "band-touching", kind: "receipt", site: null, mutate: (r) => { r.targets[2].columns.warm.runs[2].kb.initialJsBytes = 20000; }, outcome: "bandsOverlap" },
  { id: "requires-mismatch", kind: "fit", site: "requires-mismatch", fit: (f) => ({ ...f, requires: ["vanilla", "react-next", "astro"] }), expect: /the fit sentence names \[astro,react-next,vanilla\] but this batch measured/ },
  { id: "unsubstituted-sentence", kind: "fit", site: "unsubstituted-sentence", fit: (f) => ({ ...f, sentence: (kb) => `islands ${kb["solid"]} KB` }), expect: /the fit sentence contains an unsubstituted value/ },
  // ── assertBatchIntegrity: the second receipt of one publication ────────
  { id: "batch-span-sha", kind: "batch", site: "batch-sha", mutate: (r) => { r.commit.sha = OTHER_SHA; r.originCommit.sha = OTHER_SHA; }, expect: /span more than one commit SHA/ },
  { id: "batch-shape-runs", kind: "batch", site: "batch-shape", mutate: (r) => { r.runsPerUrl = RUNS_PER_URL + 2; }, expect: /disagree on batch shape/ },
  { id: "batch-shape-targets", kind: "batch", site: "batch-shape", mutate: (r) => { r.targets.pop(); }, expect: /disagree on batch shape/ },
  { id: "batch-span-date", kind: "batch", site: "batch-date", mutate: (r) => { r.date = "2026-09-21T10:00:00.000Z"; }, expect: /span more than one date/ },
  { id: "batch-span-location", kind: "batch", site: "batch-location", mutate: (r) => { r.runLocation.label = "pinned-runner"; }, expect: /span more than one run location/ },
  { id: "batch-interactions-differ", kind: "batch", site: "batch-interaction", mutate: (r) => { for (const t of r.targets) t.interactionId = "pdp-add-to-cart"; }, expect: /drove different interactions/ },
  // ── admitChromeConstant ────────────────────────────────────────────────
  { id: "cc-wrong-kind", kind: "chrome-constant", site: "cc-malformed", mutate: (c) => { c.kind = "pm-bench-receipt"; }, expect: /chrome-constant\.json malformed or minted from a dirty tree/ },
  { id: "cc-dirty-tree", kind: "chrome-constant", site: "cc-malformed", mutate: (c) => { c.commit.dirty = true; }, expect: /chrome-constant\.json malformed or minted from a dirty tree/ },
  { id: "cc-nonfinite-delta", kind: "chrome-constant", site: "cc-nonfinite", mutate: (c) => { c.deltaMedians.LCP = null; }, expect: /chrome-constant delta for LCP is not a finite number/ },
  { id: "cc-nonfinite-longtask", kind: "chrome-constant", site: "cc-nonfinite", mutate: (c) => { c.deltaMedians.longTaskMs = null; }, expect: /chrome-constant delta for longTaskMs is not a finite number/ },
  { id: "cc-cross-tree", kind: "chrome-constant", site: "cc-provenance", mutate: (c) => { c.originCommit.sha = OTHER_SHA; }, expect: /an unattested or cross-tree constant is not publishable/ },
  { id: "cc-dirty-origin", kind: "chrome-constant", site: "cc-provenance", mutate: (c) => { c.originCommit.dirty = true; }, expect: /an unattested or cross-tree constant is not publishable/ },
  { id: "cc-unattested", kind: "chrome-constant", site: "cc-provenance", mutate: (c) => { c.originCommit = null; }, expect: /an unattested or cross-tree constant is not publishable/ },
  { id: "cc-unpopulated", kind: "chrome-constant", site: "cc-unpopulated", mutate: (c) => { c.measuredChrome.populated = false; }, expect: /measured against an UNPOPULATED chrome/ },
  { id: "cc-populated-absent", kind: "chrome-constant", site: "cc-unpopulated", mutate: (c) => { delete c.measuredChrome.populated; }, expect: /measured against an UNPOPULATED chrome/ },
  { id: "cc-no-render-context", kind: "chrome-constant", site: "cc-no-render-context", mutate: (c) => { delete c.measuredChrome.renderContext; }, expect: /records no renderContext/ },
  { id: "cc-identity", kind: "chrome-constant", site: "cc-identity", mutate: (c) => { c.measuredChrome.sha256 = "0".repeat(64); }, expect: /describes a fragment this build does not ship/ },
  // ── labSurfacesOf: the registry ────────────────────────────────────────
  { id: "registry-singleton-lab", kind: "registry", site: "registry-singleton", registry: { a11y: { variants: ["vanilla"], singleton: true, labBundle: true } }, expect: /is both singleton and labBundle/ },
  { id: "registry-empty", kind: "registry", site: "registry-empty", registry: { a11y: { variants: ["vanilla"], singleton: true } }, expect: /no surface carries labBundle/ },
];

/** Receipt JSON with every LEAF object (all-primitive values: a run's
 *  webVitals, its docAttribution, a commit pin) on one line — the receipts'
 *  two-space shape without one number per line, so a fixture reads as a
 *  receipt and a diff reads as its one changed field. */
const isLeaf = (o) =>
  o !== null && typeof o === "object" && !Array.isArray(o) &&
  Object.values(o).every((x) => x === null || typeof x !== "object");
function pretty(v, depth = 0) {
  const pad = "  ".repeat(depth);
  const pad1 = "  ".repeat(depth + 1);
  if (Array.isArray(v)) {
    return v.length === 0 ? "[]" : `[\n${v.map((x) => pad1 + pretty(x, depth + 1)).join(",\n")}\n${pad}]`;
  }
  if (v !== null && typeof v === "object") {
    if (isLeaf(v)) return JSON.stringify(v).replaceAll('":', '": ').replaceAll(',"', ', "');
    return `{\n${Object.entries(v).map(([k, x]) => `${pad1}${JSON.stringify(k)}: ${pretty(x, depth + 1)}`).join(",\n")}\n${pad}}`;
  }
  return JSON.stringify(v);
}

/** relative path → file text, for every on-disk fixture (controls first). */
export function fixtures() {
  const out = new Map();
  const text = (v) => pretty(v) + "\n";
  out.set("receipts/valid.json", text(baseReceipt()));
  out.set("receipts/valid-second-profile.json", text(baseReceipt("slow-4g-mid-phone")));
  out.set("chrome-constants/valid.json", text(baseChromeConstant()));
  for (const c of CASES) {
    if (c.kind === "receipt") {
      const r = baseReceipt();
      c.mutate(r);
      out.set(`receipts/${c.id}.json`, text(r));
    } else if (c.kind === "batch") {
      const r = baseReceipt("slow-4g-mid-phone");
      c.mutate(r);
      out.set(`receipts/${c.id}.json`, text(r));
    } else if (c.kind === "chrome-constant") {
      const cc = baseChromeConstant();
      c.mutate(cc);
      out.set(`chrome-constants/${c.id}.json`, text(cc));
    }
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const [rel, body] of fixtures()) {
    mkdirSync(dirname(join(here, rel)), { recursive: true });
    writeFileSync(join(here, rel), body);
  }
  console.log(`wrote ${fixtures().size} fixtures (${CASES.length} cases)`);
}
