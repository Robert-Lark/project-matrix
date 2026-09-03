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
import { stampBuild } from "./stamp-build.mjs";
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
const KB = 1024;
const roundTo = (v, places) => Math.round(v * 10 ** places) / 10 ** places;

function bundleFromReceipt(receipt, fitSpec, receiptUrl, surfaceVariants) {
  // The COLUMN AXIS check, tied to the registry rather than to the fit
  // template. It runs FIRST because the two checks that used to be the only
  // variant-set validation both sit past early returns: `fitSpec.requires`
  // is compared only after the band-overlap branch has had its chance to
  // `return`, so a batch that measured 3 of a surface's 4 variants and whose
  // bands overlapped would publish a partial column set with nothing
  // comparing it to anything — every page then rendering a full-width table
  // with a permanently em-dashed column under the line "Every number above
  // links its receipt", which is C2 stated over cells that have none.
  // Exact, not subset, in both directions (verify-slice, anti-rigging).
  const measured = receipt.targets.map((t) => t.variant).sort();
  const registered = [...surfaceVariants].sort();
  if (measured.join(",") !== registered.join(",")) {
    throw new Error(
      `front lab: this batch measured [${measured.join(", ")}] but the surface is registered as serving [${registered.join(", ")}] — a publication must cover exactly the surface's live variants, or the table publishes a column no receipt backs (ADR-0008 §3)`,
    );
  }
  const surfaceName = receipt.targets[0].surface;
  const declared = fitSpec.interactionFetch;
  // The PAYLOAD is validated, not just the tag. `{kind:"constant"}` with a
  // missing or misspelled `toleranceBytes` would pass a tag-only guard, and
  // then `max - min > undefined` is a NaN comparison — FALSE for every spread
  // — so the constancy check silently never fires and the surface publishes
  // the exact false claim the declaration exists to prevent (verify-slice,
  // correctness lens). Defaulting the missing value to 0 was rejected: that
  // invents a policy the surface never declared, which is the same class of
  // error one layer down.
  const declaredOk =
    declared === "none" ||
    (declared?.kind === "constant" &&
      Number.isFinite(declared.toleranceBytes) &&
      declared.toleranceBytes >= 0);
  const timing = fitSpec.interactionTiming;
  if (typeof timing?.publish !== "boolean") {
    throw new Error(
      `front lab: FIT.${surfaceName} declares no interactionTiming — a surface publishes an INP row only ` +
        `by stating that the metric measures the same thing in every one of its columns ` +
        `({publish:true}), or by withholding it with a reason ({publish:false, reason}). Required for the ` +
        `same reason interactionFetch is: a declaration that can be omitted is a way to publish a timing ` +
        `cell without ever having judged it (ADR-0001 addendum T)`,
    );
  }
  if (timing.publish === false && !timing.reason) {
    throw new Error(
      `front lab: FIT.${surfaceName} withholds its INP row but states no reason — withheld LOUDLY or not ` +
        `at all; the reason rides the row the reader is looking at`,
    );
  }
  const bundleTiming = timing.publish
    ? { published: true }
    : { published: false, reason: timing.reason };
  if (!declaredOk) {
    throw new Error(
      `front lab: FIT.${surfaceName} declares no usable interactionFetch (got ${JSON.stringify(declared)}) — ` +
        `a surface publishes an interaction cell only by stating what the click costs on the wire: "none", or ` +
        `{kind:"constant", toleranceBytes:<finite, >= 0>}. A constant with no tolerance is not a looser check, ` +
        `it is no check: the spread comparison becomes NaN and passes for every batch`,
    );
  }

  const receiptMeta = {
    profile: receipt.profile.id,
    date: receipt.date.slice(0, 10),
    commitSha: receipt.commit.sha,
    location: receipt.runLocation.label,
    url: receiptUrl,
  };
  // The min–max band across the batch's runs, rounded exactly as its
  // median is (ADR-0001 addendum C: cells publish the median WITH its
  // band). Derived from the same raw runs the overlap check reads — a
  // single measured run yields no band rather than a fake zero-width one.
  const bandOf = (runs, pick, round) => {
    const values = runs.map(pick).filter((v) => typeof v === "number" && Number.isFinite(v));
    if (values.length < 2) return undefined;
    const min = round(Math.min(...values));
    const max = round(Math.max(...values));
    // A zero-width band carries no information — "0.42–0.42" says only what
    // the median already said — and 30 of them cost real bytes against the
    // fragment budget (ADR-0008 §5). Omitted: the cell is then the median
    // alone, which is exactly what a band of zero width means.
    return min === max ? undefined : { min, max };
  };
  const reading = (value, unit, band) =>
    value === null ? undefined : { value, unit, receipt: receiptMeta, ...(band ? { band } : {}) };
  const columns = {};
  for (const target of receipt.targets) {
    // Warm/steady-state is the headline column (ADR-0001 §5); the receipt
    // the cell links carries the cold column beside it.
    const med = target.columns.warm.medians;
    const runs = target.columns.warm.runs;
    const cell = {};
    const put = (metric, r) => {
      if (r) cell[metric] = r;
    };
    const kb = (v) => roundTo(v / KB, 2);
    put(
      "initial JS",
      reading(
        med.initialJsBytes === null ? null : kb(med.initialJsBytes),
        "KB",
        bandOf(runs, (r) => r.kb.initialJsBytes, kb),
      ),
    );
    for (const [metric, key] of [
      ["TTFB", "TTFB"],
      ["FCP", "FCP"],
      ["LCP", "LCP"],
      // The INP row publishes only where the surface declares the metric
      // like-for-like across its columns (ADR-0001 addendum T). Dropped at
      // BUNDLE time rather than hidden at render time: a value that must not
      // be read must not be in the artifact the reader can open either.
      ...(fitSpec.interactionTiming.publish ? [["INP (scripted)", "INP"]] : []),
    ]) {
      const v = med.webVitals[key];
      put(
        metric,
        reading(
          v === null ? null : Math.round(v),
          "ms",
          bandOf(runs, (r) => r.webVitals[key], Math.round),
        ),
      );
    }
    put(
      "CLS",
      reading(
        med.webVitals.CLS === null ? null : roundTo(med.webVitals.CLS, 3),
        "",
        bandOf(runs, (r) => r.webVitals.CLS, (v) => roundTo(v, 3)),
      ),
    );
    columns[target.variant] = cell;
  }

  // ── The interaction-fetch clause, DECLARED by the surface ──────────────
  // This was a hardcoded "every median must be 0" until 2026-08-28, which
  // made a surface that legitimately fetches unpublishable by construction
  // rather than publishable WITH THE FETCH STATED. It is now driven by the
  // fit template, and REQUIRED there: a surface that omits the declaration is
  // refused, because an optional clause is not a generalisation of a check,
  // it is a way to opt out of one (ADR-0001 addendum R).
  // Every target's surface has already been checked to equal the filename's
  // (the receipt loop below), so target 0's is THE surface, and the column
  // check above proves the target list is non-empty.
  // One batch, ONE interaction. The CLI applies a single `--interaction` per
  // batch and the receipt has one slot per (surface, profile), so a receipt
  // carrying two interaction families would render two different measurements
  // into one identically-labeled INP row, distinguishable only by downloading
  // the receipt — the "it's in the receipt" answer ADR-0001 addendum C
  // pre-rejected. Refused by name instead.
  const interactionIds = [...new Set(receipt.targets.map((t) => t.interactionId))];
  if (interactionIds.length !== 1) {
    throw new Error(
      `front lab: this batch drove more than one interaction [${interactionIds.join(", ")}] — one receipt ` +
        `publishes one interaction, or the reading table's INP row means a different thing in each column`,
    );
  }
  const interactionId = interactionIds[0];
  // And it must be the one the SURFACE declares. Otherwise a batch driven with
  // the wrong `--interaction` passes every gate above — the id is registered,
  // there is one per receipt and one per surface, and a "none" declaration
  // holds for any click that fetches nothing — and the site publishes an INP
  // row for a heading click under prose describing the page's designed
  // interaction (verify-slice, anti-rigging lens).
  if (typeof fitSpec.interactionId !== "string") {
    throw new Error(
      `front lab: FIT.${surfaceName} names no interactionId — a surface publishes an interaction cell ` +
        `only by declaring WHICH interaction its batch drives, or any registered click can be published ` +
        `under its name`,
    );
  }
  if (interactionId !== fitSpec.interactionId) {
    throw new Error(
      `front lab: FIT.${surfaceName} declares the interaction "${fitSpec.interactionId}" but this batch ` +
        `drove "${interactionId}" — re-run the batch with the declared interaction, or change the ` +
        `declaration deliberately and rewrite the sentence with it`,
    );
  }

  // The ATTESTATION binds every interaction claim, whatever the declaration
  // says: a byte figure only means "this is what the click cost" if the
  // runner actually reached network quiescence after it. A capped-out wait
  // and a genuinely quiet one are indistinguishable in the byte column, so
  // an unrecorded boundary counts as unverified.
  for (const t of receipt.targets) {
    for (const column of [t.columns.warm, t.columns.cold]) {
      for (const run of column.runs) {
        if (run.interactionSettled !== true) {
          throw new Error(
            `front lab: a ${t.variant} run did not record reaching network quiescence after the click ` +
              `(interactionSettled=${String(run.interactionSettled)}) — its interaction bytes are unverified, ` +
              `so no interaction claim can publish from this batch`,
          );
        }
      }
    }
  }

  const interactionMedians = receipt.targets.flatMap((t) => [
    { variant: t.variant, column: "warm", bytes: t.columns.warm.medians.interactionBytes },
    { variant: t.variant, column: "cold", bytes: t.columns.cold.medians.interactionBytes },
  ]);
  // A null median is "the batch produced no value here", which is a DIFFERENT
  // failure from a disagreement and must not reach the comparisons below:
  // `Math.min(null, 25194)` coerces null to 0, so a missing measurement would
  // be reported as a 25,194 B paradigm spread and the operator would go
  // looking for the wrong thing.
  const missing = interactionMedians.filter((m) => !Number.isFinite(m.bytes));
  if (missing.length > 0) {
    throw new Error(
      `front lab: ${surfaceName} has no interaction-byte median for ` +
        `${missing.map((m) => `${m.variant}/${m.column}`).join(", ")} — an absent measurement cannot ` +
        `satisfy any interactionFetch declaration, and it is not a disagreement`,
    );
  }
  const spread = () =>
    interactionMedians.map((m) => `${m.variant}/${m.column}=${m.bytes}`).join(", ");
  let interactionBytes;
  if (declared === "none") {
    // Per RUN, not per median. "None of them fetches another byte for the
    // click" is the site's strongest claim, and a median hides up to
    // floor(n/2) fetching runs behind it: at runsPerUrl 7, three runs that
    // fetched still publish a median of 0 (verify-slice, correctness lens).
    // Intermittency is exactly what the genuine quiescence wait makes
    // observable for the first time, so this is the moment to check it. The
    // `constant` branch keeps medians, where run-to-run spread is legitimate
    // noise rather than a contradiction of the claim.
    const fetching = receipt.targets.flatMap((t) =>
      ["warm", "cold"].flatMap((column) =>
        t.columns[column].runs
          .map((run, i) => ({ variant: t.variant, column, run: i, bytes: run.kb.interactionBytes }))
          .filter((r) => r.bytes !== 0),
      ),
    );
    if (fetching.length > 0) {
      throw new Error(
        `front lab: FIT.${surfaceName} declares interactionFetch "none", but ` +
          `${fetching.map((r) => `${r.variant}/${r.column} run ${r.run} measured ${r.bytes} B`).join("; ")} — ` +
          `refusing to publish an unsupported claim (ADR-0001 addendum C / C2)`,
      );
    }
    interactionBytes = 0;
  } else {
    const values = interactionMedians.map((m) => m.bytes);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max - min > declared.toleranceBytes) {
      throw new Error(
        `front lab: FIT.${surfaceName} declares the interaction a cross-variant constant within ` +
          `${declared.toleranceBytes} B, but the batch spans ${max - min} B (${spread()}) — either the paradigms ` +
          `genuinely differ here, in which case the sentence must name them separately, or the instrument is ` +
          `manufacturing the difference; publish neither until it is known which`,
      );
    }
    // A constant of zero IS the "none" claim, and declaring it the loose way
    // would quietly retire the site's strongest guard. Refuse the loosening.
    if (max === 0) {
      throw new Error(
        `front lab: FIT.${surfaceName} declares a constant interaction fetch but the batch measured ` +
          `0 B everywhere — declare "none" and get the stronger check, rather than a constant clause that ` +
          `cannot distinguish itself from it`,
      );
    }
    // Per RUN as well as per median, for the same reason the "none" branch is
    // per run: a median hides up to floor(n/2) runs, and the run this hides is
    // the dangerous one — a run that captured NOTHING (0 B, because the fetch
    // dispatched after the quiet window closed, the tracker's own stated
    // residual limit) publishes as "the same bytes in every column" while
    // having measured no bytes at all (verify-slice, anti-rigging lens).
    const strays = receipt.targets.flatMap((t) =>
      ["warm", "cold"].flatMap((column) =>
        t.columns[column].runs
          .map((run, i) => ({ variant: t.variant, column, run: i, bytes: run.kb.interactionBytes }))
          .filter((r) => !Number.isFinite(r.bytes) || Math.abs(r.bytes - max) > declared.toleranceBytes),
      ),
    );
    if (strays.length > 0) {
      throw new Error(
        `front lab: FIT.${surfaceName} declares the interaction a cross-variant constant, and the medians ` +
          `agree — but individual runs do not: ` +
          `${strays.map((r) => `${r.variant}/${r.column} run ${r.run} measured ${r.bytes} B`).join("; ")} ` +
          `against ${max} B. A run that captured nothing is hidden by its own median, and it is the run ` +
          `that means the boundary missed the fetch`,
      );
    }
    // The published figure is the WARM column's own median across variants —
    // the headline column (ADR-0001 §5), the same one the reading table's
    // cells come from, so the sentence and the table cannot disagree.
    const warm = receipt.targets
      .map((t) => t.columns.warm.medians.interactionBytes)
      .sort((a, b) => a - b);
    interactionBytes =
      warm.length % 2
        ? warm[(warm.length - 1) / 2]
        : (warm[warm.length / 2 - 1] + warm[warm.length / 2]) / 2;
  }
  // The figure travels on the BUNDLE, not only inside the sentence — the
  // band-overlap early return below deletes the sentence, and on a surface
  // that also withholds its INP row that would leave the click with no
  // published figure at all.
  const bundleFetch =
    declared === "none"
      ? { bytes: 0 }
      : { bytes: interactionBytes, toleranceBytes: declared.toleranceBytes };

  // The fit line (ADR-0001 addendum C): comparative framing only when the
  // compared byte bands do not overlap. The sentence enumerates EVERY
  // variant, so every variant's band must be separable — checking only the
  // min and max pair would be near-vacuous (the extremes of a spread are
  // the one pair that can hardly overlap) while the sentence still implies
  // an order for the three columns between them (verify-slice,
  // anti-rigging lens). Bands are min–max over the raw warm runs, never the
  // medians.
  const jsMedian = (t) => t.columns.warm.medians.initialJsBytes;
  const band = (t) => {
    const values = t.columns.warm.runs
      .map((r) => r.kb.initialJsBytes)
      .filter((v) => typeof v === "number" && Number.isFinite(v));
    // An empty or short run list must not silently pass the overlap test:
    // Math.min of nothing is Infinity, which reads as "no overlap" and
    // would publish a verdict backed by no samples at all.
    if (values.length !== receipt.runsPerUrl) {
      throw new Error(
        `front lab: ${t.variant} has ${values.length} usable initial-JS samples but the batch ran ${receipt.runsPerUrl} — refusing to derive a band from an incomplete run set`,
      );
    }
    return { min: Math.min(...values), max: Math.max(...values) };
  };
  const ordered = [...receipt.targets].sort((a, b) => jsMedian(a) - jsMedian(b));
  for (let i = 1; i < ordered.length; i++) {
    const lower = band(ordered[i - 1]);
    const upper = band(ordered[i]);
    if (lower.max >= upper.min && upper.max >= lower.min) {
      return {
        columns,
        interactionId,
        interactionTiming: bundleTiming,
        interactionFetch: bundleFetch,
        bandsOverlap: true,
      };
    }
  }
  const kb = Object.fromEntries(
    receipt.targets.map((t) => [t.variant, roundTo(jsMedian(t) / KB, 2)]),
  );
  // The template names specific variants; the batch must carry exactly
  // those. Exact, not subset — a sixth variant also invalidates a sentence
  // that enumerates five.
  const have = Object.keys(kb).sort().join(",");
  const want = [...fitSpec.requires].sort().join(",");
  if (have !== want) {
    throw new Error(
      `front lab: the fit sentence names [${want}] but this batch measured [${have}] — rewrite the template rather than publish a sentence about variants it did not measure`,
    );
  }
  // The template gets the receipt-derived interaction facts too, so a surface
  // whose headline IS the interaction can put the measured figure IN the
  // sentence rather than leaving the reader to open the receipt for it.
  const sentence = fitSpec.sentence(kb, {
    interactionId,
    interactionBytes,
    interactionKb: roundTo(interactionBytes / KB, 2),
  });
  // Belt over mechanism: any unsubstituted value reaching the one line the
  // site publishes as a verdict refuses the build.
  if (/undefined|NaN/.test(sentence)) {
    throw new Error(`front lab: the fit sentence contains an unsubstituted value: ${sentence}`);
  }
  return {
    columns,
    interactionId,
    interactionTiming: bundleTiming,
    interactionFetch: bundleFetch,
    fit: { sentence, receipt: receiptMeta },
  };
}

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
const LAB_SURFACES = Object.entries(switcherMod.SURFACE_CONTROLS)
  .filter(([, controls]) => controls.labBundle === true)
  .map(([surface]) => surface);
// A SINGLETON is off the benchmarked matrix (ADR-0007 §5): its reading
// section is a plain sentence and no lab snapshot will ever exist for it, so
// flagging one for publication is a registry contradiction. Refused here
// rather than serviced: the build would happily emit the bundle, and the
// surface's own pages could never render it (verify-slice).
for (const surface of LAB_SURFACES) {
  if (switcherMod.SURFACE_CONTROLS[surface].singleton === true) {
    throw new Error(
      `front lab: surface "${surface}" is both singleton and labBundle — a singleton is off the benchmarked matrix (ADR-0007 §5) and renders a plain sentence, never a lab table, so it can never show the bundle this would publish`,
    );
  }
}
if (LAB_SURFACES.length === 0) {
  throw new Error(
    "front lab: no surface carries labBundle in SURFACE_CONTROLS — the pipeline would publish nothing anywhere, which is a registry accident, not a state",
  );
}

const labDir = join(root, "lab");
const labReceiptsDir = join(labDir, "receipts");
// Per-surface accumulation: a receipt joins its surface's publication, and
// each surface's batch discipline is checked against ITS OWN batch below —
// two surfaces may legitimately publish batches minted on different days at
// different SHAs (each is one publication; the mixed-batch refusals are
// per-surface, never cross-surface).
const profilesBySurface = Object.fromEntries(LAB_SURFACES.map((s) => [s, {}]));
const receiptsBySurface = Object.fromEntries(LAB_SURFACES.map((s) => [s, []]));
for (const file of readdirSync(labReceiptsDir).sort()) {
  if (!file.endsWith(".json")) continue;
  const receipt = JSON.parse(readFileSync(join(labReceiptsDir, file), "utf8"));
  if (receipt.kind !== "pm-bench-receipt" || receipt.receiptVersion !== 1) {
    throw new Error(`front lab: ${file} is not a v1 pm-bench-receipt`);
  }
  // A published receipt must come from a CLEAN checkout — a dirty pin is
  // exactly what a hostile reader flags (ADR-0001 §9).
  if (receipt.commit.dirty !== false) {
    throw new Error(`front lab: ${file} was minted from a dirty tree — not publishable`);
  }
  // Origin provenance (ADR-0001 addendum N hole 2): a receipt that RECORDS
  // what the plane attested must record agreement — a cross-tree or
  // unattested receipt is a legitimate measurement but not a publishable
  // one. Receipts minted before the attestation existed carry no field and
  // are grandfathered — but the grandfather set is BOUNDED BY DATE, not by
  // absence: absence-based grandfathering would let any future batch
  // (or a hand-stripped receipt) opt out of provenance forever
  // (verify-slice, this unit). The cutoff is the day the ruler landed.
  const PROVENANCE_CUTOFF = "2026-08-16";
  if (receipt.date.slice(0, 10) >= PROVENANCE_CUTOFF) {
    if (receipt.originCommit === undefined) {
      throw new Error(
        `front lab: ${file} is dated ${receipt.date.slice(0, 10)} but carries no originCommit — receipts minted after ${PROVENANCE_CUTOFF} must attest their origin (ADR-0001 addendum Q)`,
      );
    }
    for (const target of receipt.targets) {
      for (const column of [target.columns.cold, target.columns.warm]) {
        for (const run of column.runs) {
          if (run.kb.docAttribution === undefined) {
            throw new Error(
              `front lab: ${file} is dated ${receipt.date.slice(0, 10)} but a ${target.variant} run carries no docAttribution — receipts minted after ${PROVENANCE_CUTOFF} record their estimator (ADR-0001 addendum O)`,
            );
          }
        }
      }
    }
  }
  if (receipt.originCommit !== undefined) {
    const oc = receipt.originCommit;
    if (oc === null) {
      throw new Error(
        `front lab: ${file} was minted against an origin that did not attest its build (originCommit: null) — not publishable`,
      );
    }
    if (oc.dirty !== false) {
      throw new Error(`front lab: ${file} measured a plane built from a dirty tree — not publishable`);
    }
    if (oc.sha !== receipt.commit.sha) {
      throw new Error(
        `front lab: ${file} measured a plane serving ${oc.sha.slice(0, 12)} but pins ${receipt.commit.sha.slice(0, 12)} — a cross-tree receipt is not publishable`,
      );
    }
  }
  // The estimator that split each run's document bytes must be one the
  // publication can stand behind (ADR-0001 addendum O). "degraded-all-html"
  // is the served-body-unavailable fallback — it resurrects the exact
  // issue-#16 "0 KB JS" defect, honestly labeled, and honest labels do not
  // publish as cells (the interactionSettled precedent). The fallback
  // shares likewise cannot publish, and a leave-one-out split whose MODEL
  // CODEC does not match the wire it claims to have calibrated against is
  // a mis-modeled ratio the artifact must not launder — the very first
  // attested batch was refused here, fitted with brotli against the zstd
  // wire Chromium negotiates (verify-slice + the 2026-08-16 batch).
  const CODEC_FOR_ENCODING = {
    br: "brotli",
    zstd: "zstd",
    gzip: "gzip",
    "x-gzip": "gzip", // RFC 9110 §8.4.1.3 alias, matching the runner
    deflate: "deflate",
  };
  const COMPRESSED_ENCODINGS = new Set(Object.keys(CODEC_FOR_ENCODING));
  for (const target of receipt.targets) {
    for (const column of [target.columns.cold, target.columns.warm]) {
      for (const run of column.runs) {
        const attribution = run.kb.docAttribution;
        if (attribution === undefined) continue; // pre-cutoff receipts, bounded above
        const ok =
          attribution.estimator === "loo-wire-normalised" ||
          attribution.estimator === "uncompressed-share-identity";
        if (!ok) {
          throw new Error(
            `front lab: ${file} has a ${target.variant} run whose document split ran as "${attribution.estimator}" — a degraded or fallback attribution cannot publish (ADR-0001 addendum O)`,
          );
        }
        // An IDENTITY claim on a wire that declared a compressed coding is
        // anomalous (a tiny or incompressible document where framing
        // outweighed compression): the label says exact truth, the header
        // says otherwise, and a contradiction does not publish.
        if (attribution.estimator === "uncompressed-share-identity") {
          const encodingToken =
            typeof attribution.contentEncoding === "string"
              ? attribution.contentEncoding.trim().toLowerCase()
              : attribution.contentEncoding;
          if (encodingToken && COMPRESSED_ENCODINGS.has(encodingToken)) {
            throw new Error(
              `front lab: ${file} has a ${target.variant} run labeled identity-encoded while the wire declared "${attribution.contentEncoding}" — a contradiction cannot publish (ADR-0001 addendum O)`,
            );
          }
        }
        if (attribution.estimator === "loo-wire-normalised") {
          // RFC 9110: content-coding tokens are case-insensitive — the
          // lookup normalizes exactly as the runner's model selection does,
          // so a legitimate "GZIP" cannot be refused by string accident.
          const encodingToken =
            typeof attribution.contentEncoding === "string"
              ? attribution.contentEncoding.trim().toLowerCase()
              : attribution.contentEncoding;
          const wanted = CODEC_FOR_ENCODING[encodingToken];
          if (!wanted || attribution.codec !== wanted) {
            throw new Error(
              `front lab: ${file} has a ${target.variant} run whose "${attribution.codec}" model was fitted to a "${attribution.contentEncoding}" wire — the ratios must be priced by the wire's own codec (ADR-0001 addendum O)`,
            );
          }
          // A loo attribution ALWAYS carries its calibration numbers by
          // construction, so absence here is a stripped or malformed
          // artifact — REQUIRED, not skipped: an absence-skippable bound
          // is an opt-out (verify-slice, this slice).
          if (
            !Number.isFinite(attribution.calibrationTargetBytes) ||
            !Number.isFinite(attribution.calibrationResidualBytes)
          ) {
            throw new Error(
              `front lab: ${file} has a ${target.variant} run whose loo attribution omits its calibration target/residual — a fit that cannot be judged cannot publish (ADR-0001 addendum O)`,
            );
          }
          // The target must be the compressed BODY: the transfer-size
          // fallback includes response headers, so its "fit" pads the
          // denominator — honest for dev use, publishable never.
          if (attribution.calibrationTargetSource !== "encoded-body") {
            throw new Error(
              `front lab: ${file} has a ${target.variant} run calibrated against "${attribution.calibrationTargetSource}" — only a compressed-body fit publishes (ADR-0001 addendum O)`,
            );
          }
          // Codec identity and fit quality are independent axes: the wrong
          // codec can fit within ~1%, and a codec-matched wire the local
          // model cannot reproduce (a future dictionary-zstd, a nonstandard
          // gzip flavor) can miss by far more — so a matched codec with a
          // bad fit is refused too. Bound: 2% of the recorded target, with
          // a 64 B floor for tiny documents.
          if (
            Math.abs(attribution.calibrationResidualBytes) >
            Math.max(64, 0.02 * attribution.calibrationTargetBytes)
          ) {
            throw new Error(
              `front lab: ${file} has a ${target.variant} run whose calibration missed its wire by ${attribution.calibrationResidualBytes} B on ${attribution.calibrationTargetBytes} B — ratios computed at a setting the wire disproves cannot publish (ADR-0001 addendum O)`,
            );
          }
        }
      }
    }
  }
  // Surface identity, three ways that must agree (this replaces the old
  // hardcoded `editorial-` filename gate). The filename names the surface
  // (registry-validated) AND the profile; the receipt's own targets each
  // carry a `surface` field — a receipt filed under a surface its targets
  // disprove is refused rather than published under the wrong table.
  // LONGEST match, not first: with a first-match scan, registering a surface
  // whose name extends another (`pdp` and a later `pdp-compare`) would parse
  // `pdp-compare-avg-broadband-desktop.json` as surface `pdp` and then refuse
  // it with an instruction to rename a correctly-named file to a WRONG one —
  // a false-fail whose error message actively misleads (verify-slice).
  const surface = LAB_SURFACES.filter((s) => file.startsWith(`${s}-`)).sort(
    (a, b) => b.length - a.length,
  )[0];
  if (!surface) {
    throw new Error(
      `front lab: ${file} names no lab surface — receipts are {surface}-{profile}.json with surface one of: ${LAB_SURFACES.join(", ")} (a new surface registers by setting labBundle in SURFACE_CONTROLS)`,
    );
  }
  if (file !== `${surface}-${receipt.profile.id}.json`) {
    throw new Error(
      `front lab: ${file} should be named ${surface}-${receipt.profile.id}.json — the filename's profile half must be the receipt's own profile id`,
    );
  }
  for (const target of receipt.targets) {
    if (target.surface !== surface) {
      throw new Error(
        `front lab: ${file} is filed under "${surface}" but its ${target.variant} target measured "${target.surface}" — a receipt cannot publish under a surface its own targets disprove`,
      );
    }
    // The fence, mirrored at ingest (ADR-0005 §7 / ADR-0008 §3: fenced
    // exhibits never get a column). The runner refuses to MINT a receipt
    // naming a fenced path (bench-runner batch.ts assertBenchableTarget);
    // the build refuses to PUBLISH one — same registry (SURFACE_CONTROLS
    // fencedExhibits + strategies[].fenced), same segment-level derivation
    // (@pm/switcher fencedPathOf, bundled above), so a hand-edited or
    // pre-fence receipt cannot reach a table the chrome declares the
    // exhibit excluded from.
    const fenced = switcherMod.fencedPathOf(target.path);
    if (fenced !== null) {
      throw new Error(
        `front lab: ${file} names ${target.path}, which falls under the fenced exhibit ${fenced} — fenced exhibits are excluded from every benchmark number (ADR-0005 §7; ADR-0008 §3), so a receipt naming one is refused, never published`,
      );
    }
  }
  // A surface publishes only once its fit template exists (ADR-0001
  // addendum C: the sentence is written WITH the surface's first batch,
  // against what that batch actually measured — never ahead of it).
  if (!Object.hasOwn(FIT, surface)) {
    throw new Error(
      `front lab: ${file} publishes surface "${surface}" but lab/fit.mjs has no FIT.${surface} template — write the fit sentence with this surface's first batch, then publish`,
    );
  }
  // The old code carried a duplicate-profile refusal here. It is GONE rather
  // than kept as a dead branch: the filename check two blocks up forces
  // `file === ${surface}-${receipt.profile.id}.json`, so two DISTINCT files
  // from one readdirSync can no longer collide on (surface, profile) — F1 and
  // F2 would both have to equal the same string. A guard that cannot fire
  // cannot be sabotage-proven, and keeping it would advertise coverage the
  // filename check actually provides (verify-slice: it was reachable under
  // the old prefix-only gate, and stopped being when the gate got stricter).
  profilesBySurface[surface][receipt.profile.id] = {
    surface,
    profile: receipt.profile.id,
    ...bundleFromReceipt(
      receipt,
      FIT[surface],
      `/_pm/lab/receipts/${file}`,
      switcherMod.SURFACE_CONTROLS[surface].variants,
    ),
  };
  receiptsBySurface[surface].push(receipt);
  cpSync(join(labReceiptsDir, file), join(dist, "_pm", "lab", "receipts", file));
}
// Batch integrity, PER SURFACE: every receipt in one surface's publication
// shares one SHA, one date, one location, and one batch shape — a mixed-SHA
// publication is not one publication. Checked for every surface with
// receipts (the old code only checked when the editorial publication
// existed), and never across surfaces: editorial's batch and a later PDP
// batch are separate publications minted on their own days.
for (const surface of LAB_SURFACES) {
  const receipts = receiptsBySurface[surface];
  for (const r of receipts) {
    if (r.commit.sha !== receipts[0].commit.sha) {
      throw new Error(`front lab: published ${surface} receipts span more than one commit SHA`);
    }
    if (r.runsPerUrl !== receipts[0].runsPerUrl || r.targets.length !== receipts[0].targets.length) {
      throw new Error(`front lab: published ${surface} receipts disagree on batch shape`);
    }
    if (r.date.slice(0, 10) !== receipts[0].date.slice(0, 10)) {
      throw new Error(`front lab: published ${surface} receipts span more than one date`);
    }
    if (r.runLocation.label !== receipts[0].runLocation.label) {
      throw new Error(`front lab: published ${surface} receipts span more than one run location`);
    }
    // One surface, ONE interaction, across every profile. `bundleFromReceipt`
    // already forces one interaction per RECEIPT, but each profile is its own
    // `bench` invocation with its own `--interaction`, so a surface could hold
    // three receipts driving three different clicks and still agree on sha,
    // date, shape and location. The methodology page then publishes ONE
    // interaction id for the whole surface, read arbitrarily from the first
    // file, and two of the three reading tables name a click they were not
    // driven by (verify-slice, correctness lens).
    if (r.targets[0].interactionId !== receipts[0].targets[0].interactionId) {
      throw new Error(
        `front lab: published ${surface} receipts drove different interactions ` +
          `(${receipts[0].profile.id} → ${receipts[0].targets[0].interactionId}, ` +
          `${r.profile.id} → ${r.targets[0].interactionId}) — one surface's publication is one batch, ` +
          `and its reading tables name one interaction`,
      );
    }
  }
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

// The chrome constant (ADR-0001 addendum F) is OPTIONAL-BUT-VALIDATED, and
// deliberately so: it measures the cost of the POPULATED chrome, which only
// exists once this build has produced the lab bundle above — so the first
// build of a new publication necessarily runs before its constant can be
// measured. Rather than let that bootstrap tempt a hand-written placeholder,
// the page renders a designed "not yet measured" statement when the artifact
// is absent (C2 applied to the constant itself: no number without its
// artifact), and applies the full refusal set when it is present.
const chromeConstantPath = join(labDir, "chrome-constant.json");
const chromeConstant = existsSync(chromeConstantPath)
  ? JSON.parse(readFileSync(chromeConstantPath, "utf8"))
  : null;
if (chromeConstant) {
  if (chromeConstant.kind !== "pm-chrome-constant" || chromeConstant.commit.dirty !== false) {
    throw new Error("front lab: chrome-constant.json malformed or minted from a dirty tree");
  }
// A missing measurement must refuse the build exactly as a dirty receipt
// does: without this, a null delta (every run's metric null) substitutes as
// "0 ms" and a renamed field as "NaN ms" — a measured-sounding constant for
// something never measured, which the %% marker guard cannot see
// (verify-slice, correctness lens).
  for (const metric of ["FCP", "LCP", "CLS", "longTaskMs"]) {
    if (!Number.isFinite(chromeConstant.deltaMedians?.[metric])) {
      throw new Error(
        `front lab: chrome-constant delta for ${metric} is not a finite number — a constant that was never measured cannot publish`,
      );
    }
  }
  // The constant is held to the SAME origin-provenance bar as receipts
  // (ADR-0001 addendum Q): unattested, dirty, or cross-tree constants do
  // not publish. ONE artifact is exempt by explicit pin — the bootstrap
  // constant this unit minted against the pre-attestation plane, whose
  // identity is proven by the fragment hash below instead (its originCommit
  // is null AS A PRESENT FIELD, so absence-based grandfathering cannot be
  // forged onto future artifacts). Remove the pin when the post-re-run
  // deployed-plane re-measure replaces it (addendum O runbook, step 3).
  const BOOTSTRAP_CONSTANT_COMMIT = "49e00e51a991ee8002b24838c3bf245d2a0ce0c1";
  if (chromeConstant.commit.sha !== BOOTSTRAP_CONSTANT_COMMIT) {
    const oc = chromeConstant.originCommit;
    if (!oc || oc.dirty !== false || oc.sha !== chromeConstant.commit.sha) {
      throw new Error(
        "front lab: the chrome constant's origin attestation is missing, dirty, or names a different tree than its commit pin — an unattested or cross-tree constant is not publishable (ADR-0001 addendum Q)",
      );
    }
  }
  // The constant must describe the chrome that SHIPS. The strip's cost
  // scales with what it renders, and the populated state (receipt anchors +
  // the fit sentence) is ~3 KB larger than the empty state — so a constant
  // measured against a plane carrying no publication understates the
  // shipping chrome (verify-slice, anti-rigging lens).
  if (chromeConstant.measuredChrome?.populated !== true) {
    throw new Error(
      "front lab: the chrome constant was measured against an UNPOPULATED chrome (no published readings in the fragment) — re-measure against a plane serving this publication",
    );
  }
  // The IDENTITY gate (ADR-0001 addendum N hole 1). `populated` cannot tell
  // the current fragment from a stale one: this build regenerates the chrome
  // from the receipts above, so the fragment that ships is not necessarily
  // the fragment the probe hashed — 11,931 B against 12,023 B on the first
  // publication, 0.8% and unbounded, growing with every surface added to
  // the strip. So the build re-renders the fragment the Worker will serve —
  // the REAL renderer against the lab bundle built above, under the exact
  // renderContext the probe recorded — and REFUSES when the sha256 differs.
  // The discharge cycle this forces is the two-pass publish: build →
  // measure against a plane serving this publication (the deployed plane
  // once it ships; the local composed plane as the recorded interim when
  // the fragment itself changed) → commit the fresh artifact → rebuild.
  {
    const mc = chromeConstant.measuredChrome;
    const rc = mc?.renderContext;
    if (
      !rc ||
      typeof mc.sha256 !== "string" ||
      [rc.variant, rc.surface, rc.pathname, rc.search, rc.location].some((v) => typeof v !== "string")
    ) {
      throw new Error(
        "front lab: the chrome constant records no renderContext, so the fragment it measured cannot be verified against the fragment this build ships (ADR-0001 addendum N hole 1) — re-measure with tools/bench-runner chrome-constant",
      );
    }
    // The REAL renderer — the switcher bundle hoisted above (esbuild over
    // the TypeScript source). The lab bundles are read back from the
    // artifacts written above: the Worker imports those very files, so the
    // comparison rides the exact objects it will serve — every registered
    // surface, because the probe's renderContext may name any of them.
    const mod = switcherMod;
    const LAB_BUNDLES = Object.fromEntries(
      LAB_SURFACES.map((s) => {
        const servedLab = JSON.parse(readFileSync(join(dist, "_pm", "lab", `${s}.json`), "utf8"));
        return [servedLab.surface, servedLab.profiles];
      }),
    );
    // Profile resolution mirrors the Worker's labFor EXACTLY (getProfile ??
    // default; Object.hasOwn against client-controlled keys).
    const requested = new URLSearchParams(rc.search).get("profile") ?? "";
    const resolved = (mod.getProfile(requested) ?? mod.PROFILES["avg-broadband-desktop"]).id;
    const lab =
      Object.hasOwn(LAB_BUNDLES, rc.surface) && Object.hasOwn(LAB_BUNDLES[rc.surface], resolved)
        ? LAB_BUNDLES[rc.surface][resolved]
        : undefined;
    const fragment = mod.chromeFragmentOf(
      mod.renderChrome({
        variant: rc.variant,
        surface: rc.surface,
        pathname: rc.pathname,
        search: rc.search,
        location: rc.location,
        lab,
      }),
    );
    const builtSha = createHash("sha256").update(fragment).digest("hex");
    if (builtSha !== mc.sha256) {
      throw new Error(
        `front lab: the chrome constant describes a fragment this build does not ship — the probe hashed ` +
          `${mc.sha256.slice(0, 12)} (${mc.bytes} B) but this build renders ${builtSha.slice(0, 12)} ` +
          `(${Buffer.byteLength(fragment, "utf8")} B) for ${rc.variant}/${rc.surface}${rc.search} at ${rc.location}. ` +
          `The constant is bound to the chrome that ships (ADR-0001 addendum N hole 1): re-measure against a ` +
          `plane serving THIS publication — the deployed plane once this ships, or the local composed plane ` +
          `(run-local, PM_HOLD=1) as the recorded interim — commit the fresh artifact, and rebuild.`,
      );
    }
  }
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
  "front: dist assembled (home + methodology + how-it-was-built + /pm fonts + /_pm instrumentation + lab bundle)",
);
