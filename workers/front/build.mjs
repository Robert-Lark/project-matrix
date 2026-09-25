// Assemble the front Worker's static assets: the home surface plus the
// /_pm/* instrumentation files (ADR-0001 §6, ADR-0004 §7) — the chrome
// stylesheet from @pm/switcher and the pinned web-vitals client bundle from
// @pm/measurement. Instrumentation bytes live ONLY on this known path so the
// harness strips them precisely from measured KB.
//
// The home surface (home-surface ticket, ADR-0007) is composed at build time:
//  - %%PM_TOKENS_CSS%% / %%PM_HOME_CSS%% inline the render-critical CSS from
//    the REAL @pm/tokens sources (single source of truth; the singleton paints
//    in one round trip — it is off the benchmarked matrix, so the variants'
//    canonical delivery contract is not in play, while the font loading
//    markup stays canonical per @pm/tokens/fonts/loading-markup.html).
//  - %%SNAP_*%% fields come from the committed crate SnapshotManifest — the
//    same document served live at /api/snapshot — so the page's on-surface
//    receipts (release count, freeze date, commit) structurally cannot drift
//    from the plane's. Hand-typing them is how a wrong SHA ships.
//
// The published-runs artifacts (first editorial bench batch, ADR-0008 §3's
// owner obligation) are built here too: the per-surface lab bundle at
// /_pm/lab/{surface}.json is GENERATED from the committed receipts under
// lab/receipts/ — the served file and the bundle the Worker imports and
// hands renderChrome are the SAME artifact, so they cannot drift — and the
// methodology page (ADR-0001 §9) is composed like home, every number on it
// substituted from a committed artifact, never typed.
//
// The how-it-was-built page (ADR-0008 §8; docs/prds/how-it-was-built-build.md)
// is NOT composed here: it is the committed master's own renderer
// (@pm/reference) under this Worker's head, written by stampBuild() at the
// end of this build — and again by every re-stamp — so its deep links pin the
// exact SHA /_pm/build.json attests. See how-built-page.mjs and
// stamp-build.mjs.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { FIT } from "./lab/fit.mjs";
import {
  admitChromeConstant,
  admitReceipt,
  assertBatchIntegrity,
  labSurfacesOf,
} from "./lab/publish.mjs";
import { stampBuild } from "./stamp-build.mjs";
import { headersFileText } from "./src/security-floor.js";
// The real @pm/tokens sources + the head-colour/escape helpers, shared with
// how-built-page.mjs (the how-it-was-built page is composed at stamp time).
import { buttonCss, esc, token, tokensCss, tokensRoot, uriHex } from "./tokens-source.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(root, "package.json"));
const dist = join(root, "dist");

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "_pm", "lab", "receipts"), { recursive: true });
mkdirSync(join(dist, "pm", "css"), { recursive: true });
mkdirSync(join(dist, "pm", "fonts"), { recursive: true });
mkdirSync(join(dist, "methodology"), { recursive: true });

// The security-header floor for the assets-first paths (src/security-floor.js
// — ONE definition with the Worker's own floor). Workers Static Assets parse
// a `_headers` file at the assets root and never serve it; it applies ONLY to
// asset responses (Cloudflare docs, fetched 2026-09-18), which is exactly the
// set the script never sees: /, /methodology/, /how-it-was-built/, /_pm/*,
// /pm/*. Written first, so no later step can assemble a dist without it.
writeFileSync(join(dist, "_headers"), headersFileText());

// ── Shared substitution plumbing ────────────────────────────────────────
const manifest = JSON.parse(
  readFileSync(
    join(root, "..", "..", "tools", "snapshot-capture", "crate", "manifest.json"),
    "utf8",
  ),
);
// Fail loudly on a missing/renamed manifest field: String(undefined) would
// otherwise pass esc() and the %% guard, shipping "FROZEN undefined" as a
// receipt (and the receipts test, reading the same manifest, would agree).
if (
  typeof manifest.releaseCount !== "number" ||
  !/^\d{4}-\d{2}-\d{2}$/.test(manifest.capturedAt ?? "") ||
  !/^[0-9a-f]{40}$/.test(manifest.commitSha ?? "") ||
  typeof manifest.source !== "string" ||
  manifest.source.length === 0
) {
  throw new Error(
    "front: crate manifest is missing or malformed in a receipt field (releaseCount / capturedAt / commitSha / source)",
  );
}
// Home's Product-page row href (repo-shopfront): the crate's featured PDP,
// whose slug is READ from the committed summaries tray rather than typed — a
// typed slug is the hand-typed-SHA failure one field over. The id is a
// constant of the DESIGN (`CRATE_FEATURED.pdp`, packages/reference/render/
// lib.mjs — the crate predates curation.json's `featured` field; the vanilla
// build carries the editorial twin the same way). summaries.json is declared
// as a turbo input beside the manifest for the same cache reason.
const CRATE_FEATURED_PDP_ID = 896191;
const crateSummaries = JSON.parse(
  readFileSync(
    join(root, "..", "..", "tools", "snapshot-capture", "crate", "summaries.json"),
    "utf8",
  ),
);
const featuredSummary = Array.isArray(crateSummaries)
  ? crateSummaries.find((s) => s?.id === CRATE_FEATURED_PDP_ID)
  : undefined;
if (typeof featuredSummary?.slug !== "string" || !/^[a-z0-9-]+$/.test(featuredSummary.slug)) {
  throw new Error(
    `front: crate summaries carry no usable slug for the featured PDP id ${CRATE_FEATURED_PDP_ID} — home's Product page row cannot link a product it cannot name`,
  );
}
const pdpFeaturedHref = `/vanilla/pdp/${featuredSummary.slug}/`;

// ── /_pm/lab/* — the published-runs artifacts (ADR-0008 §3; ADR-0001 §9) ──
// Inputs are COMMITTED: lab/receipts/{surface}-{profile}.json (raw batch
// receipts) + lab/chrome-constant.json (the addendum-F probe artifact) +
// lab/fit.mjs (the fit templates). C2 as build mechanism: every reading
// carries its receipt by construction, and a fit sentence the receipts do
// not support REFUSES to build (ADR-0001 addendum C).
//
// The REFUSALS live in lab/publish.mjs (workers-hardening, 2026-09-25) — a
// pure module this file composes and test/publish-refusals.test.js drives
// with one committed malformed fixture per refusal class. This file reads
// the artifacts, hands them to the gate, and writes what the gate admits;
// it decides nothing about publishability itself.
const roundTo = (v, places) => Math.round(v * 10 ** places) / 10 ** places;

// The switcher is TypeScript source and this build runs in plain node, so
// esbuild bundles the exports the build needs in-process (the mechanism the
// chrome-constant identity gate introduced; hoisted here because the surface
// registry drives the receipt loop too). The lab-publishing surfaces are the
// `labBundle`-flagged entries of SURFACE_CONTROLS — one registry for the
// build, the Worker's served bundles, and the origin suite's per-surface
// bundle leg, so registering a surface IS the wiring, not a reminder to wire.
const switcherBundle = buildSync({
  stdin: {
    contents:
      'export { renderChrome, chromeFragmentOf, SURFACE_CONTROLS, fencedPathOf } from "@pm/switcher"; export { getProfile, PROFILES } from "@pm/measurement";',
    resolveDir: root,
    loader: "js",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const switcherMod = await import(
  "data:text/javascript;base64," +
    Buffer.from(switcherBundle.outputFiles[0].contents).toString("base64")
);
// The registry refusals (singleton-and-labBundle, an empty roster) are the
// gate's (publish.mjs labSurfacesOf).
const LAB_SURFACES = labSurfacesOf(switcherMod.SURFACE_CONTROLS);

const labDir = join(root, "lab");
const labReceiptsDir = join(labDir, "receipts");
// Per-surface accumulation: a receipt joins its surface's publication, and
// each surface's batch discipline is checked against ITS OWN batch below —
// two surfaces may legitimately publish batches minted on different days at
// different SHAs (each is one publication; the mixed-batch refusals are
// per-surface, never cross-surface).
const profilesBySurface = Object.fromEntries(LAB_SURFACES.map((s) => [s, {}]));
const receiptsBySurface = Object.fromEntries(LAB_SURFACES.map((s) => [s, []]));
const gateDeps = {
  labSurfaces: LAB_SURFACES,
  surfaceControls: switcherMod.SURFACE_CONTROLS,
  fit: FIT,
  fencedPathOf: switcherMod.fencedPathOf,
};
for (const file of readdirSync(labReceiptsDir).sort()) {
  if (!file.endsWith(".json")) continue;
  const receipt = JSON.parse(readFileSync(join(labReceiptsDir, file), "utf8"));
  // Every refusal between this file and a published cell — provenance,
  // estimator, surface identity, the fence, the fit template, the
  // interaction clauses, the band rule — is the gate's (publish.mjs
  // admitReceipt → bundleFromReceipt), each with its fixture.
  const { surface, bundle } = admitReceipt(file, receipt, gateDeps);
  profilesBySurface[surface][receipt.profile.id] = {
    surface,
    profile: receipt.profile.id,
    ...bundle,
  };
  receiptsBySurface[surface].push(receipt);
  cpSync(join(labReceiptsDir, file), join(dist, "_pm", "lab", "receipts", file));
}

// Batch integrity, PER SURFACE (publish.mjs assertBatchIntegrity): one SHA,
// one date, one location, one shape, one interaction per publication, and
// never across surfaces.
for (const surface of LAB_SURFACES) {
  assertBatchIntegrity(surface, receiptsBySurface[surface]);
}

// No committed receipts is a LEGITIMATE state, not an error: it is the
// state every unbuilt surface is in, and the state a surface is in
// between a code change and the batch that re-measures it. The bundle still
// builds (empty), the chrome renders its designed empty states everywhere,
// and the pages that quote lab numbers say so plainly — the same rule as
// every other number here: none without its artifact.
const editorialReceipts = receiptsBySurface.editorial ?? [];
const published = editorialReceipts.length > 0;
for (const surface of LAB_SURFACES) {
  writeFileSync(
    join(dist, "_pm", "lab", `${surface}.json`),
    JSON.stringify({ surface, profiles: profilesBySurface[surface] }, null, 2) + "\n",
  );
}

// The Worker's embed half, GENERATED from the same roster that emitted the
// bundles above. A hand-maintained import list in src/index.js was this
// slice's first draft, and verify-slice killed it unanimously: nothing tied
// it to the registry, so flagging a surface and forgetting its import line
// left every guard green while the surface's pages rendered the empty state
// over a fully published bundle — the exact serve/embed drift the file's own
// comment promises is impossible. Deleting BOTH import lines passed all 478
// legs, which made the slice's own Worker change unguarded.
//
// It lands OUTSIDE dist/ on purpose: dist is served assets-first, so a module
// written there would be downloadable bytes on the measured plane. Gitignored
// and declared in turbo's @pm/front#build outputs (the astro src/data
// precedent), because an undeclared build output feeds the build's own input
// hash and a cache replay would restore a dist without it.
const generatedDir = join(root, "generated");
mkdirSync(generatedDir, { recursive: true });
writeFileSync(
  join(generatedDir, "lab-bundles.js"),
  "// GENERATED by workers/front/build.mjs — do not edit.\n" +
    "// One entry per labBundle-flagged surface in SURFACE_CONTROLS. Each bundle\n" +
    "// is imported from the very file served at /_pm/lab/{surface}.json, so the\n" +
    "// embedded object and the served artifact cannot drift.\n" +
    LAB_SURFACES.map(
      (s, i) => `import s${i} from "../dist/_pm/lab/${s}.json";\n`,
    ).join("") +
    "\nexport const LAB_BUNDLES = {\n" +
    LAB_SURFACES.map((_, i) => `  [s${i}.surface]: s${i}.profiles,\n`).join("") +
    "};\n",
);

// The chrome constant (ADR-0001 addendum F) is OPTIONAL-BUT-VALIDATED —
// absent, the methodology page renders its designed "not yet measured"
// statement; present, it meets the full refusal set in publish.mjs
// admitChromeConstant (kind/dirty, finite deltas, provenance with the
// bootstrap pin, populated, renderContext, and the addendum-N hole-1
// IDENTITY gate: the build re-renders the fragment the Worker will serve —
// the REAL renderer against the lab bundles written above, under the exact
// renderContext the probe recorded — and refuses when the sha256 differs).
const chromeConstantPath = join(labDir, "chrome-constant.json");
const chromeConstant = existsSync(chromeConstantPath)
  ? JSON.parse(readFileSync(chromeConstantPath, "utf8"))
  : null;
if (chromeConstant) {
  // The lab bundles are read back from the artifacts written above: the
  // Worker imports those very files, so the identity comparison rides the
  // exact objects it will serve — every registered surface, because the
  // probe's renderContext may name any of them.
  const labBundles = Object.fromEntries(
    LAB_SURFACES.map((s) => {
      const servedLab = JSON.parse(readFileSync(join(dist, "_pm", "lab", `${s}.json`), "utf8"));
      return [servedLab.surface, servedLab.profiles];
    }),
  );
  admitChromeConstant(chromeConstant, {
    labBundles,
    renderChrome: switcherMod.renderChrome,
    chromeFragmentOf: switcherMod.chromeFragmentOf,
    getProfile: switcherMod.getProfile,
    defaultProfile: switcherMod.PROFILES["avg-broadband-desktop"],
    sha256Hex: (text) => createHash("sha256").update(text).digest("hex"),
    byteLength: (text) => Buffer.byteLength(text, "utf8"),
  });
  cpSync(chromeConstantPath, join(dist, "_pm", "lab", "chrome-constant.json"));
}

// The default-profile bundle backs home's build-derived numbers (the chrome
// itself defaults to avg-broadband-desktop — packages/switcher chrome.ts).
let labFacts = null;
if (published) {
  // Home's spread quotes the EDITORIAL surface by design (ADR-0007 §4/§5:
  // the front door's measured row is the editorial batch) — this read stays
  // surface-specific on purpose; it is content, not pipeline.
  const defaultBundle = profilesBySurface.editorial["avg-broadband-desktop"];
  if (!defaultBundle) {
    throw new Error("front lab: no receipt for the default profile (avg-broadband-desktop)");
  }
  const defaultJsCells = Object.values(defaultBundle.columns).map(
    (cell) => cell["initial JS"],
  );
  if (defaultJsCells.some((c) => typeof c?.value !== "number")) {
    throw new Error("front lab: a default-profile column lacks an initial-JS reading");
  }
  const defaultJsKb = defaultJsCells.map((c) => c.value);
  labFacts = {
    date: editorialReceipts[0].date.slice(0, 10),
    sha7: editorialReceipts[0].commit.sha.slice(0, 7),
    runs: editorialReceipts[0].runsPerUrl,
    location: editorialReceipts[0].runLocation.label,
    profileCount: editorialReceipts.length,
    variantCount: editorialReceipts[0].targets.length,
    jsMin: Math.min(...defaultJsKb),
    jsMax: Math.max(...defaultJsKb),
    // The receipt behind home's spread — taken from the readings themselves,
    // never composed from a filename.
    receiptUrl: defaultJsCells[0].receipt.url,
  };
  // Batch integrity (one SHA / one date / one location / one shape per
  // publication) is enforced in the per-surface loop above — it moved there
  // when the pipeline generalised off `editorial-`, so it now runs for EVERY
  // surface with receipts rather than only when the editorial publication
  // exists. The statements labFacts publishes ("ran <date>", "labeled in
  // every receipt as <location>") are backed by that loop.
}

// ── The home surface ────────────────────────────────────────────────────
const homeCss = readFileSync(join(root, "home", "home.css"), "utf8");

// Composed statements rather than bare number markers, so a page never has a
// number-shaped hole to fill when nothing is published. Same rule as the
// chrome's own empty states: say what is true, or say that nothing is.
const homeSpread = labFacts
  ? `Measured on average broadband: <a class="quiet-link" href="${esc(labFacts.receiptUrl)}">` +
    `<span class="num">${esc(labFacts.jsMin)}–${esc(labFacts.jsMax)}&nbsp;KB</span></a> of JavaScript ` +
    `for the same article, published <span class="num">${esc(labFacts.date)}</span>.`
  : `The five builds are public; their measured readings publish with the next batch.`;

// The INP-comparability claim on /methodology/ is about the site's OWN
// PUBLISHED cells, so it is DERIVED from the receipts rather than typed. The
// first draft typed "all five variants read 24 ms across every profile", and
// the served bundle one click away falsified it: react-next's warm median is
// 32 ms on average broadband, and runs span 24-32 (verify-slice, conformance
// lens). A hand-typed number the site's own artifact contradicts is the exact
// class this pipeline exists to make impossible — and it would have gone stale
// again at the next editorial batch even if it had been right.
const inpSpread = (() => {
  const receipts = receiptsBySurface.editorial ?? [];
  if (receipts.length === 0) {
    return `No editorial batch is published, so this page states no spread for it.`;
  }
  const cells = receipts.flatMap((r) =>
    r.targets.flatMap((t) => [t.columns.warm, t.columns.cold]),
  );
  const runs = cells
    .flatMap((c) => c.runs.map((run) => run.webVitals.INP))
    .filter((v) => typeof v === "number" && Number.isFinite(v));
  // WARM only. The reading table publishes the warm column (ADR-0001 §5), so
  // "the published medians" has to mean those: a cold median outside the warm
  // range would otherwise widen a sentence about cells that do not exist
  // anywhere on the site — the same class of error this sentence replaced,
  // one abstraction up (verify-slice, anti-rigging lens).
  const medians = receipts
    .flatMap((r) => r.targets.map((t) => t.columns.warm.medians.webVitals.INP))
    .filter((v) => typeof v === "number" && Number.isFinite(v));
  if (runs.length === 0 || medians.length === 0) {
    throw new Error(
      "front lab: the editorial receipts carry no usable INP values, so the methodology page cannot state a spread it claims to derive",
    );
  }
  return (
    `Every one of the <span class="num">${esc(runs.length)}</span> runs that produced a value, in both cache ` +
    `columns, falls between ` +
    `<span class="num">${esc(Math.min(...runs))}</span> and <span class="num">${esc(Math.max(...runs))}</span>&nbsp;ms, ` +
    `and the published (warm) medians span <span class="num">${esc(Math.min(...medians))}</span>–` +
    `<span class="num">${esc(Math.max(...medians))}</span>&nbsp;ms — one narrow band, every column inside it.`
  );
})();

// ── /methodology/'s batch statements, PER SURFACE ───────────────────────
// These were derived from `editorialReceipts` alone, which was true while
// editorial was the only publishing surface and became a correctness bug the
// moment a second one published: a reader on a PDP page follows the
// methodology link and reads a description of a batch that is not the one
// behind the numbers they just read — falsified by the receipt links on those
// very cells. Per-surface batches are legal by design (the integrity loop
// above runs per surface, never across them: editorial's batch and the PDP's
// are separate publications minted on their own days), so the statement has
// to be too.
const surfaceBatchFacts = LAB_SURFACES.map((surface) => {
  const receipts = receiptsBySurface[surface] ?? [];
  if (receipts.length === 0) return null;
  return {
    surface,
    date: receipts[0].date.slice(0, 10),
    sha7: receipts[0].commit.sha.slice(0, 7),
    runs: receipts[0].runsPerUrl,
    location: receipts[0].runLocation.label,
    profileCount: receipts.length,
    variantCount: receipts[0].targets.length,
    interactionId: receipts[0].targets[0].interactionId,
  };
}).filter(Boolean);

// `%%LAB_RUNS%%` sits inside running prose ("the median of N runs"), so it
// can only be a bare number while every published surface agrees on one. When
// they diverge it names them, because "the median of seven runs" printed over
// a five-run batch is exactly the kind of quietly-wrong sentence the receipts
// exist to make impossible.
const runCounts = [...new Set(surfaceBatchFacts.map((f) => f.runs))];
const labRuns =
  surfaceBatchFacts.length === 0
    ? "seven"
    : runCounts.length === 1
      ? String(runCounts[0])
      : surfaceBatchFacts.map((f) => `${f.runs} (${f.surface})`).join(" and ");

const batchStatement =
  surfaceBatchFacts.length === 0
    ? `No batch is published for any surface right now, so no reading table on this site carries a ` +
      `number — the cells show an em-dash until one does.`
    : surfaceBatchFacts
        .map(
          (f) =>
            `The published <span class="num">${esc(f.surface)}</span> batch ran ` +
            `<span class="num">${esc(f.date)}</span> at commit <span class="num">${esc(f.sha7)}</span>: ` +
            `${esc(f.variantCount)} variants × ${esc(f.profileCount)} profiles × two cache columns × ` +
            `${esc(f.runs)} runs, driving <span class="num">${esc(f.interactionId)}</span> as its scripted ` +
            `interaction, against the live plane from a quiet, single-purpose local machine — labeled ` +
            `honestly in every receipt as <span class="num">${esc(f.location)}</span>, an unpinned ` +
            `developer machine.`,
        )
        .join(" ") +
      (surfaceBatchFacts.length > 1
        ? ` Each surface is its own publication: they may differ in date, commit and shape, and each ` +
          `cell links the receipt of the batch that produced it.`
        : ``);

// Function replacements: with a string replacement, `$'`/`$&`/`$$` in the
// CSS would be replacement patterns — a future `[href$='…']` selector would
// silently duplicate the document tail past the %% guard.
const home = readFileSync(join(root, "home", "index.html"), "utf8")
  .replace("/*%%PM_TOKENS_CSS%%*/", () => `${tokensCss}\n${buttonCss}`)
  .replace("/*%%PM_HOME_CSS%%*/", () => homeCss)
  .replaceAll("%%SNAP_COUNT%%", () => esc(manifest.releaseCount))
  .replaceAll("%%SNAP_DATE%%", () => esc(manifest.capturedAt))
  .replaceAll("%%SNAP_SHA7%%", () => esc(manifest.commitSha.slice(0, 7)))
  .replaceAll("%%SNAP_SOURCE%%", () => esc(manifest.source))
  // ADR-0001 §9: every published number links its receipt — including the
  // one on the front door. The whole clause is composed above from the same
  // bundle the values come from, so the href cannot drift from what it backs.
  .replaceAll("%%LAB_ED_SPREAD%%", () => homeSpread)
  // The Product-page row's link: the crate's featured PDP, slug read from the
  // committed summaries tray above (never typed, same rule as the receipts).
  .replaceAll("%%PDP_FEATURED_HREF%%", () => esc(pdpFeaturedHref))
  .replaceAll("%%TOKEN_PAPER%%", () => token("--pm-neutral-0"))
  .replaceAll("%%TOKEN_VINYL_URI%%", () => uriHex(token("--pm-neutral-950")))
  .replaceAll("%%TOKEN_PAPER_SUNK_URI%%", () => uriHex(token("--pm-neutral-50")));
if (home.includes("%%")) {
  throw new Error("front: unsubstituted %% marker left in home/index.html");
}
writeFileSync(join(dist, "index.html"), home);

// ── The methodology page (ADR-0001 §9) ──────────────────────────────────
// A static singleton like home; every number substituted from a committed
// artifact (the chrome-constant probe, the published receipts, the crate
// manifest). Signed deltas render their own sign so the copy cannot claim a
// direction the artifact doesn't.
const signedMs = (v) => {
  // Throw rather than fall through to the negative branch: a non-number
  // reaching here would render "−NaN ms" as a measured constant.
  if (!Number.isFinite(v)) throw new Error(`front: non-finite chrome-constant delta (${v})`);
  return v === 0 ? "0" : v > 0 ? `+${roundTo(v, 1)}` : `−${roundTo(-v, 1)}`;
};
const methodologyCss = readFileSync(join(root, "methodology", "methodology.css"), "utf8");
const cc = chromeConstant;
// One composed statement, so the page has no number-shaped hole to fill when
// the constant has not been measured yet (C2 applied to the constant: the
// page states its absence rather than printing a zero).
const ccLocal = cc ? /^https?:\/\/(127\.0\.0\.1|localhost|\[?::1\]?)(:|\/|$)/.test(cc.origin) : false;
// Addendum-N band rule, applied to the constant's own cells: the long-task
// MEDIAN can hide a one-sided signal (N: two with-chrome runs at 55/64 ms
// behind a "0 ms" median), and the paint deltas ride real run-to-run spread
// — so the statement composes across-runs ranges from the artifact's own
// runs. Both band bounds are DERIVED, never typed (a hard-coded 0 floor is
// a number the artifact may not contain — verify-slice, this unit).
const ccRuns = (condition, metric) =>
  cc ? cc.conditions[condition].runs.map((r) => r[metric]).filter((v) => Number.isFinite(v)) : [];
const ltAll = cc ? [...ccRuns("with", "longTaskMs"), ...ccRuns("without", "longTaskMs")] : [];
const ltMax = ltAll.length ? Math.max(...ltAll) : 0;
const ltMin = ltAll.length ? Math.min(...ltAll) : 0;
const ltClause =
  cc && ltMax > 0
    ? ` (${esc(roundTo(ltMin, 1))}–${esc(roundTo(ltMax, 1))}&nbsp;ms across the runs` +
      (ccRuns("without", "longTaskMs").every((v) => v === 0) &&
      ccRuns("with", "longTaskMs").some((v) => v > 0)
        ? `, every non-zero sample in the with-chrome condition`
        : ``) +
      `)`
    : ``;
// Paint bands: each condition's across-runs range, so the published delta
// of medians is readable against the spread it came from (a zero-width
// range says nothing and is omitted, the bandOf rule above).
const paintBand = (metric, label) => {
  const w = ccRuns("with", metric);
  const wo = ccRuns("without", metric);
  if (w.length < 2 || wo.length < 2) return "";
  const fmt = (values) => {
    const lo = Math.round(Math.min(...values));
    const hi = Math.round(Math.max(...values));
    return lo === hi ? `${lo}` : `${lo}–${hi}`;
  };
  return `${label} ${fmt(w)}&nbsp;ms with the chrome against ${fmt(wo)}&nbsp;ms without`;
};
const paintBands = cc
  ? [paintBand("FCP", "first paint ran"), paintBand("LCP", "largest paint")]
      .filter(Boolean)
      .join("; ")
  : "";
const paintBandClause = paintBands
  ? ` The medians ride real spread — ${paintBands} across the runs behind them.`
  : "";
const ccStatement = cc
  ? `It is stated as a constant: <strong>${esc(signedMs(cc.deltaMedians.FCP))}&nbsp;ms first paint, ` +
    `${esc(signedMs(cc.deltaMedians.LCP))}&nbsp;ms largest paint, ${esc(roundTo(cc.deltaMedians.CLS, 3))} layout shift, ` +
    `${esc(signedMs(cc.deltaMedians.longTaskMs))}&nbsp;ms of long tasks</strong>${ltClause}, plus ` +
    `<strong>${esc(cc.measuredChrome.wireBytesBrotli)}&nbsp;bytes</strong> on the wire` +
    (cc.measuredChrome.wireCalibrated
      ? ` — priced at the brotli quality that reproduces the plane's own compressed serving of this page ` +
        `(quality ${esc(cc.measuredChrome.wireQuality)}, residual ${esc(cc.measuredChrome.calibrationResidualBytes)}&nbsp;B ` +
        `on ${esc(cc.measuredChrome.encodedBodySize)}&nbsp;B)`
      : ` — priced at an uncalibrated default quality, because the measured plane served the page uncompressed; ` +
        `the deployed-plane re-measure replaces this figure`) +
    `.${paintBandClause} The figures come from ` +
    `${esc(cc.runsPerCondition)} runs per condition under the ` +
    `<span class="num">${esc(cc.profile.id)}</span> profile, measured ${esc(cc.date.slice(0, 10))} at commit ` +
    `<span class="num">${esc(cc.commit.sha.slice(0, 7))}</span> on <span class="num">${esc(cc.target)}</span> ` +
    `(<a href="/_pm/lab/chrome-constant.json">the raw probe artifact</a>). The two halves are kept apart on ` +
    `purpose: both conditions are padded to identical document bytes so the timing figure is the chrome's ` +
    `processing and subresource cost — a render-blocking stylesheet, a preloaded mono, and the ruler — ` +
    `while what it adds to the document on the wire is the byte figure beside it.` +
    (ccLocal
      ? ` It was measured on the local composed origin rather than the live plane, for a reason worth stating: ` +
        `the constant has to describe the chrome that ships, readings and all, and the live plane cannot render ` +
        `that chrome until this publication is deployed to it. Re-measuring there is a recorded obligation. ` +
        `Local first paint is not a production number; the difference between the two conditions is what is ` +
        `published, and both conditions ran on the same plane under the same emulated network.`
      : ``)
  : `That measurement has not been published for the current chrome yet, so no constant is stated here — ` +
    `the same rule the reading tables follow: no number without its artifact.`;
const methodology = readFileSync(join(root, "methodology", "index.html"), "utf8")
  .replace("/*%%PM_TOKENS_CSS%%*/", () => `${tokensCss}\n${buttonCss}`)
  .replace("/*%%PM_METHODOLOGY_CSS%%*/", () => methodologyCss)
  .replaceAll("%%SNAP_COUNT%%", () => esc(manifest.releaseCount))
  .replaceAll("%%SNAP_DATE%%", () => esc(manifest.capturedAt))
  .replaceAll("%%CC_STATEMENT%%", () => ccStatement)
  .replaceAll("%%LAB_BATCH_STATEMENT%%", () => batchStatement)
  .replaceAll("%%LAB_RUNS%%", () => esc(labRuns))
  .replaceAll("%%LAB_INP_SPREAD%%", () => inpSpread)
  .replaceAll("%%TOKEN_PAPER%%", () => token("--pm-neutral-0"))
  .replaceAll("%%TOKEN_VINYL_URI%%", () => uriHex(token("--pm-neutral-950")))
  .replaceAll("%%TOKEN_PAPER_SUNK_URI%%", () => uriHex(token("--pm-neutral-50")));
if (methodology.includes("%%")) {
  throw new Error("front: unsubstituted %% marker left in methodology/index.html");
}
writeFileSync(join(dist, "methodology", "index.html"), methodology);

// Canonical font loading (ADR-0003 §8): the identical files, served from this
// Worker's own assets at /pm/* — only the base path differs per consumer.
cpSync(join(tokensRoot, "css", "fonts.css"), join(dist, "pm", "css", "fonts.css"));
for (const f of [
  "FamiljenGrotesk.var.woff2",
  "PMWarnGlyph.U26A0.woff2",
  "PMCrateSymbols.woff2",
  "LICENSE-OFL.txt",
  "LICENSE-OFL-Inter.txt",
]) {
  cpSync(join(tokensRoot, "fonts", f), join(dist, "pm", "fonts", f));
}

// ── /_pm/* instrumentation ──────────────────────────────────────────────
cpSync(
  require.resolve("@pm/switcher/chrome.css"),
  join(dist, "_pm", "chrome.css"),
);
// The chrome-owned instrument mono (surface-design session): served from the
// /_pm/* excluded path — chrome bytes, never variant bytes (ADR-0001 §6).
for (const f of ["PMInstrumentMono.var.woff2", "LICENSE-OFL-JetBrainsMono.txt"]) {
  cpSync(
    join(dirname(require.resolve("@pm/switcher/package.json")), "fonts", f),
    join(dist, "_pm", "fonts", f),
  );
}
// The measurement bundle is a built artifact; resolve the package root via
// its manifest, then take dist/measure.js (built by @pm/measurement's build,
// ordered ahead of this one by turbo's ^build).
cpSync(
  join(dirname(require.resolve("@pm/measurement/package.json")), "dist", "measure.js"),
  join(dist, "_pm", "measure.js"),
);

// The build attestation (ADR-0001 addendum N hole 2) — re-stamped by the
// deploy script and run-local against turbo cache replays; see
// stamp-build.mjs for why all three call sites exist.
stampBuild();

console.log(
  "front: dist assembled (home + methodology + how-it-was-built + /pm fonts + /_pm instrumentation + lab bundle + _headers)",
);
