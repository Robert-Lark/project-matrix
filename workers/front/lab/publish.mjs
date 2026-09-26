// The publication gate (ADR-0001 §9, addenda C/N/O/Q/R/T; ADR-0008 §3): every
// refusal that stands between a committed receipt and a published number,
// as ONE importable module. Until the workers-hardening unit (2026-09-25)
// these lived inline in build.mjs, enforced only by the one-time sabotage
// proofs the decision map records — nothing re-proved a single refusal
// fired, and the file's own history holds the failure class it guards
// against: a guard was REMOVED once because "an unfireable guard advertises
// coverage it lacks" (the duplicate-profile refusal, below). Now every
// refusal class has a committed malformed fixture that must throw with its
// own message (test/publish-refusals.test.js), so a refactor that inverts
// one condition fails a test instead of shipping.
//
// PURE by construction: no filesystem, no `node:` imports, no process. The
// build reads the files and hands the parsed objects in; the test hands the
// fixtures in. Anything that needs a runtime service (the fragment renderer,
// a hash) arrives as a dependency, so the gate's logic is the same object
// under both callers and neither can drift from the other.
//
// Every throw below sits under a `// refusal: <site>` marker
// naming the fixture row set that proves it (test/fixtures/publish/
// generate.mjs, `site`). The test holds the two lists equal in BOTH
// directions — a throw with no marker, a marker with no row, a row with no
// marker all fail — so the binding is a map, not a count (verify-slice,
// skeptic lens: a count of labels let 19 of 29 condition-level mutants
// through). What the map cannot do, stated: it binds a throw to a label,
// and the row's regex to the message that throw produces at runtime; a row
// whose regex proves an OLDER message under a NEW label is review's to
// catch.
//
// Typed with JSDoc and checked by `tsc --checkJs` under the front Worker's
// tsconfig (ADR-0004 addendum, 2026-09-25): the receipt typedef below names
// exactly the fields the gate READS — the runner's Zod schema
// (tools/bench-runner/src/receipt.ts) is the shape of record, and the
// fixtures are held to it by that workspace's own test.

/**
 * @typedef {object} DocAttribution
 * @property {string} estimator
 * @property {string | null} [codec]
 * @property {number | null} [quality]
 * @property {number | null} [calibrationTargetBytes]
 * @property {string | null} [calibrationTargetSource]
 * @property {number | null} calibrationResidualBytes
 * @property {string | null} [contentEncoding]
 */
/**
 * @typedef {object} WebVitals
 * @property {number | null} TTFB
 * @property {number | null} FCP
 * @property {number | null} LCP
 * @property {number | null} CLS
 * @property {number | null} INP
 */
/**
 * @typedef {object} RunSample
 * @property {boolean} [interactionSettled]
 * @property {WebVitals} webVitals
 * @property {{ initialJsBytes: number, interactionBytes: number, docAttribution?: DocAttribution }} kb
 */
/**
 * @typedef {object} Medians
 * @property {number | null} initialJsBytes
 * @property {number | null} interactionBytes
 * @property {WebVitals} webVitals
 */
/**
 * @typedef {object} Column
 * @property {RunSample[]} runs
 * @property {Medians} medians
 */
/**
 * @typedef {object} Target
 * @property {string} path
 * @property {string} variant
 * @property {string} surface
 * @property {string} interactionId
 * @property {{ cold: Column, warm: Column }} columns
 */
/**
 * A v1 pm-bench-receipt, as the gate reads it.
 * @typedef {object} Receipt
 * @property {string} kind
 * @property {number} receiptVersion
 * @property {string} date
 * @property {{ sha: string, dirty: boolean }} commit
 * @property {{ sha: string, dirty: boolean } | null} [originCommit]
 * @property {{ label: string }} runLocation
 * @property {{ id: string }} profile
 * @property {number} runsPerUrl
 * @property {Target[]} targets
 */
/** @typedef {import("./fit.mjs").FitSpec} FitSpec */
/** @typedef {import("@pm/switcher").PublishedReading} PublishedReading */
/** @typedef {import("@pm/switcher").ReadingMetric} ReadingMetric */
/** @typedef {import("@pm/switcher").LabReceipt} LabReceipt */
/**
 * What `bundleFromReceipt` returns: a SurfaceLabBundle without the
 * `surface`/`profile` identity fields, which the caller adds.
 * @typedef {object} PublishedBundle
 * @property {Record<string, Partial<Record<ReadingMetric, PublishedReading>>>} columns
 * @property {string} interactionId
 * @property {{ published: true } | { published: false, reason: string }} interactionTiming
 * @property {{ bytes: number, toleranceBytes?: number }} interactionFetch
 * @property {{ sentence: string, receipt: LabReceipt }} [fit]
 * @property {true} [bandsOverlap]
 */
/**
 * The chrome-constant artifact (ADR-0001 addenda F/L/N/P/Q), as the gate
 * reads it.
 * @typedef {object} ChromeConstant
 * @property {string} kind
 * @property {{ sha: string, dirty: boolean }} commit
 * @property {{ sha: string, dirty: boolean } | null} [originCommit]
 * @property {Record<string, number>} [deltaMedians]
 * @property {{ populated?: boolean, sha256?: string, bytes?: number, renderContext?: RenderContext }} [measuredChrome]
 */
/**
 * @typedef {object} RenderContext
 * @property {string} variant
 * @property {string} surface
 * @property {string} pathname
 * @property {string} search
 * @property {string} location
 */
/**
 * The switcher registry's shape as the gate reads it.
 * @typedef {{ variants: readonly string[], singleton?: boolean, labBundle?: boolean }} SurfaceEntry
 */

const KB = 1024;
/** @param {number} v @param {number} places */
const roundTo = (v, places) => Math.round(v * 10 ** places) / 10 ** places;

/**
 * Origin provenance (ADR-0001 addendum N hole 2): receipts minted before
 * the attestation existed carry no field and are grandfathered — but the
 * grandfather set is BOUNDED BY DATE, not by absence: absence-based
 * grandfathering would let any future batch (or a hand-stripped receipt)
 * opt out of provenance forever (verify-slice, interaction-registry). The
 * cutoff is the day the ruler landed.
 */
export const PROVENANCE_CUTOFF = "2026-08-16";

/** The estimator's model codec must be the wire's own (ADR-0001 addendum O).
 *  RFC 9110 §8.4.1.3: `x-gzip` is an alias, matching the runner. */
export const CODEC_FOR_ENCODING = Object.freeze({
  br: "brotli",
  zstd: "zstd",
  gzip: "gzip",
  "x-gzip": "gzip",
  deflate: "deflate",
});
const COMPRESSED_ENCODINGS = new Set(Object.keys(CODEC_FOR_ENCODING));

/**
 * The chrome constant is held to the SAME origin-provenance bar as receipts
 * (ADR-0001 addendum Q). ONE artifact is exempt by explicit pin — the
 * bootstrap constant minted against the pre-attestation plane, whose
 * identity is proven by the fragment hash instead (its originCommit is null
 * AS A PRESENT FIELD, so absence-based grandfathering cannot be forged onto
 * future artifacts). Remove the pin when the post-re-run deployed-plane
 * re-measure replaces it (addendum O runbook, step 3).
 */
export const BOOTSTRAP_CONSTANT_COMMIT = "49e00e51a991ee8002b24838c3bf245d2a0ce0c1";

/**
 * The lab-publishing surfaces are the `labBundle`-flagged entries of the
 * switcher registry — one registry for the build, the Worker's served
 * bundles, and the origin suite's per-surface bundle leg, so registering a
 * surface IS the wiring, not a reminder to wire.
 * @param {Readonly<Record<string, SurfaceEntry>>} surfaceControls
 * @returns {string[]}
 */
export function labSurfacesOf(surfaceControls) {
  const labSurfaces = Object.entries(surfaceControls)
    .filter(([, controls]) => controls.labBundle === true)
    .map(([surface]) => surface);
  // A SINGLETON is off the benchmarked matrix (ADR-0007 §5): its reading
  // section is a plain sentence and no lab snapshot will ever exist for it,
  // so flagging one for publication is a registry contradiction. Refused
  // here rather than serviced: the build would happily emit the bundle, and
  // the surface's own pages could never render it (verify-slice).
  for (const surface of labSurfaces) {
    if (surfaceControls[surface]?.singleton === true) {
      // refusal: registry-singleton
      throw new Error(
        `front lab: surface "${surface}" is both singleton and labBundle — a singleton is off the benchmarked matrix (ADR-0007 §5) and renders a plain sentence, never a lab table, so it can never show the bundle this would publish`,
      );
    }
  }
  if (labSurfaces.length === 0) {
    // refusal: registry-empty
    throw new Error(
      "front lab: no surface carries labBundle in SURFACE_CONTROLS — the pipeline would publish nothing anywhere, which is a registry accident, not a state",
    );
  }
  return labSurfaces;
}

/**
 * One receipt → one surface's per-profile bundle, or a refusal (ADR-0001
 * addendum C: every reading carries its receipt by construction, and a fit
 * sentence the receipts do not support REFUSES to build).
 * @param {Receipt} receipt
 * @param {FitSpec} fitSpec
 * @param {string} receiptUrl
 * @param {readonly string[]} surfaceVariants
 * @returns {PublishedBundle}
 */
export function bundleFromReceipt(receipt, fitSpec, receiptUrl, surfaceVariants) {
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
    // refusal: column-axis
    throw new Error(
      `front lab: this batch measured [${measured.join(", ")}] but the surface is registered as serving [${registered.join(", ")}] — a publication must cover exactly the surface's live variants, or the table publishes a column no receipt backs (ADR-0008 §3)`,
    );
  }
  // The column check above proves the target list is non-empty, and every
  // target's surface has already been checked to equal the filename's
  // (admitReceipt), so target 0's is THE surface.
  const surfaceName = /** @type {Target} */ (receipt.targets[0]).surface;
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
    // refusal: no-interaction-timing
    throw new Error(
      `front lab: FIT.${surfaceName} declares no interactionTiming — a surface publishes an INP row only ` +
        `by stating that the metric measures the same thing in every one of its columns ` +
        `({publish:true}), or by withholding it with a reason ({publish:false, reason}). Required for the ` +
        `same reason interactionFetch is: a declaration that can be omitted is a way to publish a timing ` +
        `cell without ever having judged it (ADR-0001 addendum T)`,
    );
  }
  if (timing.publish === false && !timing.reason) {
    // refusal: withheld-without-reason
    throw new Error(
      `front lab: FIT.${surfaceName} withholds its INP row but states no reason — withheld LOUDLY or not ` +
        `at all; the reason rides the row the reader is looking at`,
    );
  }
  /** @type {PublishedBundle["interactionTiming"]} */
  const bundleTiming = timing.publish
    ? { published: true }
    : { published: false, reason: timing.reason };
  if (!declaredOk) {
    // refusal: unusable-interaction-fetch
    throw new Error(
      `front lab: FIT.${surfaceName} declares no usable interactionFetch (got ${JSON.stringify(declared)}) — ` +
        `a surface publishes an interaction cell only by stating what the click costs on the wire: "none", or ` +
        `{kind:"constant", toleranceBytes:<finite, >= 0>}. A constant with no tolerance is not a looser check, ` +
        `it is no check: the spread comparison becomes NaN and passes for every batch`,
    );
  }

  /** @type {LabReceipt} */
  const receiptMeta = {
    profile: /** @type {LabReceipt["profile"]} */ (receipt.profile.id),
    date: receipt.date.slice(0, 10),
    commitSha: receipt.commit.sha,
    location: receipt.runLocation.label,
    url: receiptUrl,
  };
  // The min–max band across the batch's runs, rounded exactly as its
  // median is (ADR-0001 addendum C: cells publish the median WITH its
  // band). Derived from the same raw runs the overlap check reads — a
  // single measured run yields no band rather than a fake zero-width one.
  /**
   * @param {RunSample[]} runs
   * @param {(r: RunSample) => number | null | undefined} pick
   * @param {(v: number) => number} round
   */
  const bandOf = (runs, pick, round) => {
    const values = /** @type {number[]} */ (
      runs.map(pick).filter((v) => typeof v === "number" && Number.isFinite(v))
    );
    if (values.length < 2) return undefined;
    const min = round(Math.min(...values));
    const max = round(Math.max(...values));
    // A zero-width band carries no information — "0.42–0.42" says only what
    // the median already said — and 30 of them cost real bytes against the
    // fragment budget (ADR-0008 §5). Omitted: the cell is then the median
    // alone, which is exactly what a band of zero width means.
    return min === max ? undefined : { min, max };
  };
  /**
   * @param {number | null} value
   * @param {PublishedReading["unit"]} unit
   * @param {{ min: number, max: number } | undefined} band
   * @returns {PublishedReading | undefined}
   */
  const reading = (value, unit, band) =>
    value === null ? undefined : { value, unit, receipt: receiptMeta, ...(band ? { band } : {}) };
  /** @type {PublishedBundle["columns"]} */
  const columns = {};
  for (const target of receipt.targets) {
    // Warm/steady-state is the headline column (ADR-0001 §5); the receipt
    // the cell links carries the cold column beside it.
    const med = target.columns.warm.medians;
    const runs = target.columns.warm.runs;
    /** @type {Partial<Record<ReadingMetric, PublishedReading>>} */
    const cell = {};
    // The row names are the switcher's own `ReadingMetric` union, so a
    // literal the chrome does not iterate is a typecheck failure here, not
    // an em-dash on every surface (verify-slice, seams lens).
    /** @param {ReadingMetric} metric @param {PublishedReading | undefined} r */
    const put = (metric, r) => {
      if (r) cell[metric] = r;
    };
    /** @param {number} v */
    const kb = (v) => roundTo(v / KB, 2);
    put(
      "initial JS",
      reading(
        med.initialJsBytes === null ? null : kb(med.initialJsBytes),
        "KB",
        bandOf(runs, (r) => r.kb.initialJsBytes, kb),
      ),
    );
    /** @type {[ReadingMetric, keyof WebVitals][]} */
    const timed = [
      ["TTFB", "TTFB"],
      ["FCP", "FCP"],
      ["LCP", "LCP"],
      // The INP row publishes only where the surface declares the metric
      // like-for-like across its columns (ADR-0001 addendum T). Dropped at
      // BUNDLE time rather than hidden at render time: a value that must not
      // be read must not be in the artifact the reader can open either.
      ...(fitSpec.interactionTiming.publish ? [/** @type {[ReadingMetric, keyof WebVitals]} */ (["INP (scripted)", "INP"])] : []),
    ];
    for (const [metric, key] of timed) {
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
  // One batch, ONE interaction. The CLI applies a single `--interaction` per
  // batch and the receipt has one slot per (surface, profile), so a receipt
  // carrying two interaction families would render two different measurements
  // into one identically-labeled INP row, distinguishable only by downloading
  // the receipt — the "it's in the receipt" answer ADR-0001 addendum C
  // pre-rejected. Refused by name instead.
  const interactionIds = [...new Set(receipt.targets.map((t) => t.interactionId))];
  if (interactionIds.length !== 1) {
    // refusal: many-interactions
    throw new Error(
      `front lab: this batch drove more than one interaction [${interactionIds.join(", ")}] — one receipt ` +
        `publishes one interaction, or the reading table's INP row means a different thing in each column`,
    );
  }
  const interactionId = /** @type {string} */ (interactionIds[0]);
  // And it must be the one the SURFACE declares. Otherwise a batch driven with
  // the wrong `--interaction` passes every gate above — the id is registered,
  // there is one per receipt and one per surface, and a "none" declaration
  // holds for any click that fetches nothing — and the site publishes an INP
  // row for a heading click under prose describing the page's designed
  // interaction (verify-slice, anti-rigging lens).
  if (typeof fitSpec.interactionId !== "string") {
    // refusal: no-interaction-id
    throw new Error(
      `front lab: FIT.${surfaceName} names no interactionId — a surface publishes an interaction cell ` +
        `only by declaring WHICH interaction its batch drives, or any registered click can be published ` +
        `under its name`,
    );
  }
  if (interactionId !== fitSpec.interactionId) {
    // refusal: wrong-interaction
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
          // refusal: unsettled-run
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
    // refusal: missing-interaction-median
    throw new Error(
      `front lab: ${surfaceName} has no interaction-byte median for ` +
        `${missing.map((m) => `${m.variant}/${m.column}`).join(", ")} — an absent measurement cannot ` +
        `satisfy any interactionFetch declaration, and it is not a disagreement`,
    );
  }
  const values = /** @type {number[]} */ (interactionMedians.map((m) => m.bytes));
  const spread = () =>
    interactionMedians.map((m) => `${m.variant}/${m.column}=${m.bytes}`).join(", ");
  /** The per-run byte list, both columns, with its coordinates. */
  const perRun = () =>
    receipt.targets.flatMap((t) =>
      /** @type {const} */ (["warm", "cold"]).flatMap((column) =>
        t.columns[column].runs.map((run, i) => ({
          variant: t.variant,
          column,
          run: i,
          bytes: run.kb.interactionBytes,
        })),
      ),
    );
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
    const fetching = perRun().filter((r) => r.bytes !== 0);
    if (fetching.length > 0) {
      // refusal: none-but-fetched
      throw new Error(
        `front lab: FIT.${surfaceName} declares interactionFetch "none", but ` +
          `${fetching.map((r) => `${r.variant}/${r.column} run ${r.run} measured ${r.bytes} B`).join("; ")} — ` +
          `refusing to publish an unsupported claim (ADR-0001 addendum C / C2)`,
      );
    }
    interactionBytes = 0;
  } else {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max - min > declared.toleranceBytes) {
      // refusal: constant-spread
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
      // refusal: constant-zero
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
    const strays = perRun().filter(
      (r) => !Number.isFinite(r.bytes) || Math.abs(r.bytes - max) > declared.toleranceBytes,
    );
    if (strays.length > 0) {
      // refusal: constant-stray-run
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
    const warm = /** @type {number[]} */ (
      receipt.targets.map((t) => t.columns.warm.medians.interactionBytes)
    ).sort((a, b) => a - b);
    interactionBytes =
      warm.length % 2
        ? /** @type {number} */ (warm[(warm.length - 1) / 2])
        : (/** @type {number} */ (warm[warm.length / 2 - 1]) + /** @type {number} */ (warm[warm.length / 2])) / 2;
  }
  // The figure travels on the BUNDLE, not only inside the sentence — the
  // band-overlap early return below deletes the sentence, and on a surface
  // that also withholds its INP row that would leave the click with no
  // published figure at all.
  /** @type {PublishedBundle["interactionFetch"]} */
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
  /** @param {Target} t */
  const jsMedian = (t) => /** @type {number} */ (t.columns.warm.medians.initialJsBytes);
  /** @param {Target} t */
  const band = (t) => {
    const samples = /** @type {number[]} */ (
      t.columns.warm.runs
        .map((r) => r.kb.initialJsBytes)
        .filter((v) => typeof v === "number" && Number.isFinite(v))
    );
    // An empty or short run list must not silently pass the overlap test:
    // Math.min of nothing is Infinity, which reads as "no overlap" and
    // would publish a verdict backed by no samples at all.
    if (samples.length !== receipt.runsPerUrl) {
      // refusal: incomplete-run-set
      throw new Error(
        `front lab: ${t.variant} has ${samples.length} usable initial-JS samples but the batch ran ${receipt.runsPerUrl} — refusing to derive a band from an incomplete run set`,
      );
    }
    return { min: Math.min(...samples), max: Math.max(...samples) };
  };
  const ordered = [...receipt.targets].sort((a, b) => jsMedian(a) - jsMedian(b));
  for (let i = 1; i < ordered.length; i++) {
    const lower = band(/** @type {Target} */ (ordered[i - 1]));
    const upper = band(/** @type {Target} */ (ordered[i]));
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
    // refusal: requires-mismatch
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
    // refusal: unsubstituted-sentence
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

/**
 * Admit one committed receipt FILE to publication: the provenance,
 * estimator, identity and fence refusals that used to sit in build.mjs's
 * receipt loop, then the bundle. Throws with the refusal's own message.
 *
 * @param {string} file the receipt's filename, `{surface}-{profile}.json`
 * @param {Receipt} receipt the parsed JSON
 * @param {{
 *   labSurfaces: readonly string[],
 *   surfaceControls: Readonly<Record<string, SurfaceEntry>>,
 *   fit: Readonly<Record<string, FitSpec>>,
 *   fencedPathOf: (path: string) => string | null,
 * }} deps
 * @returns {{ surface: string, bundle: PublishedBundle }}
 */
export function admitReceipt(file, receipt, deps) {
  const { labSurfaces, surfaceControls, fit, fencedPathOf } = deps;
  if (receipt.kind !== "pm-bench-receipt" || receipt.receiptVersion !== 1) {
    // refusal: not-v1
    throw new Error(`front lab: ${file} is not a v1 pm-bench-receipt`);
  }
  // A published receipt must come from a CLEAN checkout — a dirty pin is
  // exactly what a hostile reader flags (ADR-0001 §9).
  if (receipt.commit.dirty !== false) {
    // refusal: dirty-tree
    throw new Error(`front lab: ${file} was minted from a dirty tree — not publishable`);
  }
  // Origin provenance (ADR-0001 addendum N hole 2): a receipt that RECORDS
  // what the plane attested must record agreement — a cross-tree or
  // unattested receipt is a legitimate measurement but not a publishable
  // one. The grandfather set is bounded by PROVENANCE_CUTOFF (above).
  const day = receipt.date.slice(0, 10);
  if (day >= PROVENANCE_CUTOFF) {
    if (receipt.originCommit === undefined) {
      // refusal: no-origin-commit
      throw new Error(
        `front lab: ${file} is dated ${day} but carries no originCommit — receipts minted after ${PROVENANCE_CUTOFF} must attest their origin (ADR-0001 addendum Q)`,
      );
    }
    for (const target of receipt.targets) {
      for (const column of [target.columns.cold, target.columns.warm]) {
        for (const run of column.runs) {
          if (run.kb.docAttribution === undefined) {
            // refusal: no-doc-attribution
            throw new Error(
              `front lab: ${file} is dated ${day} but a ${target.variant} run carries no docAttribution — receipts minted after ${PROVENANCE_CUTOFF} record their estimator (ADR-0001 addendum O)`,
            );
          }
        }
      }
    }
  }
  if (receipt.originCommit !== undefined) {
    const oc = receipt.originCommit;
    if (oc === null) {
      // refusal: unattested-origin
      throw new Error(
        `front lab: ${file} was minted against an origin that did not attest its build (originCommit: null) — not publishable`,
      );
    }
    if (oc.dirty !== false) {
      // refusal: dirty-origin
      throw new Error(`front lab: ${file} measured a plane built from a dirty tree — not publishable`);
    }
    if (oc.sha !== receipt.commit.sha) {
      // refusal: cross-tree
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
  for (const target of receipt.targets) {
    for (const column of [target.columns.cold, target.columns.warm]) {
      for (const run of column.runs) {
        const attribution = run.kb.docAttribution;
        if (attribution === undefined) continue; // pre-cutoff receipts, bounded above
        const ok =
          attribution.estimator === "loo-wire-normalised" ||
          attribution.estimator === "uncompressed-share-identity";
        if (!ok) {
          // refusal: degraded-estimator
          throw new Error(
            `front lab: ${file} has a ${target.variant} run whose document split ran as "${attribution.estimator}" — a degraded or fallback attribution cannot publish (ADR-0001 addendum O)`,
          );
        }
        // RFC 9110: content-coding tokens are case-insensitive — the lookup
        // normalizes exactly as the runner's model selection does, so a
        // legitimate "GZIP" cannot be refused by string accident.
        const encodingToken =
          typeof attribution.contentEncoding === "string"
            ? attribution.contentEncoding.trim().toLowerCase()
            : attribution.contentEncoding;
        // An IDENTITY claim on a wire that declared a compressed coding is
        // anomalous (a tiny or incompressible document where framing
        // outweighed compression): the label says exact truth, the header
        // says otherwise, and a contradiction does not publish.
        if (attribution.estimator === "uncompressed-share-identity") {
          if (encodingToken && COMPRESSED_ENCODINGS.has(encodingToken)) {
            // refusal: identity-compressed
            throw new Error(
              `front lab: ${file} has a ${target.variant} run labeled identity-encoded while the wire declared "${attribution.contentEncoding}" — a contradiction cannot publish (ADR-0001 addendum O)`,
            );
          }
        }
        if (attribution.estimator === "loo-wire-normalised") {
          const wanted = encodingToken
            ? CODEC_FOR_ENCODING[/** @type {keyof typeof CODEC_FOR_ENCODING} */ (encodingToken)]
            : undefined;
          if (!wanted || attribution.codec !== wanted) {
            // refusal: codec-mismatch
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
            // refusal: missing-calibration
            throw new Error(
              `front lab: ${file} has a ${target.variant} run whose loo attribution omits its calibration target/residual — a fit that cannot be judged cannot publish (ADR-0001 addendum O)`,
            );
          }
          const targetBytes = /** @type {number} */ (attribution.calibrationTargetBytes);
          const residual = /** @type {number} */ (attribution.calibrationResidualBytes);
          // The target must be the compressed BODY: the transfer-size
          // fallback includes response headers, so its "fit" pads the
          // denominator — honest for dev use, publishable never.
          if (attribution.calibrationTargetSource !== "encoded-body") {
            // refusal: transfer-size-calibration
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
          if (Math.abs(residual) > Math.max(64, 0.02 * targetBytes)) {
            // refusal: calibration-miss
            throw new Error(
              `front lab: ${file} has a ${target.variant} run whose calibration missed its wire by ${residual} B on ${targetBytes} B — ratios computed at a setting the wire disproves cannot publish (ADR-0001 addendum O)`,
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
  const surface = labSurfaces
    .filter((s) => file.startsWith(`${s}-`))
    .sort((a, b) => b.length - a.length)[0];
  if (!surface) {
    // refusal: no-lab-surface
    throw new Error(
      `front lab: ${file} names no lab surface — receipts are {surface}-{profile}.json with surface one of: ${labSurfaces.join(", ")} (a new surface registers by setting labBundle in SURFACE_CONTROLS)`,
    );
  }
  if (file !== `${surface}-${receipt.profile.id}.json`) {
    // refusal: filename-profile
    throw new Error(
      `front lab: ${file} should be named ${surface}-${receipt.profile.id}.json — the filename's profile half must be the receipt's own profile id`,
    );
  }
  for (const target of receipt.targets) {
    if (target.surface !== surface) {
      // refusal: target-surface
      throw new Error(
        `front lab: ${file} is filed under "${surface}" but its ${target.variant} target measured "${target.surface}" — a receipt cannot publish under a surface its own targets disprove`,
      );
    }
    // The fence, mirrored at ingest (ADR-0005 §7 / ADR-0008 §3: fenced
    // exhibits never get a column). The runner refuses to MINT a receipt
    // naming a fenced path (bench-runner batch.ts assertBenchableTarget);
    // the build refuses to PUBLISH one — same registry (SURFACE_CONTROLS
    // fencedExhibits + strategies[].fenced), same segment-level derivation
    // (@pm/switcher fencedPathOf), so a hand-edited or pre-fence receipt
    // cannot reach a table the chrome declares the exhibit excluded from.
    const fenced = fencedPathOf(target.path);
    if (fenced !== null) {
      // refusal: fenced-target
      throw new Error(
        `front lab: ${file} names ${target.path}, which falls under the fenced exhibit ${fenced} — fenced exhibits are excluded from every benchmark number (ADR-0005 §7; ADR-0008 §3), so a receipt naming one is refused, never published`,
      );
    }
  }
  // A surface publishes only once its fit template exists (ADR-0001
  // addendum C: the sentence is written WITH the surface's first batch,
  // against what that batch actually measured — never ahead of it).
  if (!Object.hasOwn(fit, surface)) {
    // refusal: no-fit-template
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
  const bundle = bundleFromReceipt(
    receipt,
    /** @type {FitSpec} */ (fit[surface]),
    `/_pm/lab/receipts/${file}`,
    /** @type {SurfaceEntry} */ (surfaceControls[surface]).variants,
  );
  return { surface, bundle };
}

/**
 * Batch integrity, PER SURFACE: every receipt in one surface's publication
 * shares one SHA, one date, one location, one batch shape and one
 * interaction — a mixed-SHA publication is not one publication. Never
 * across surfaces: editorial's batch and a later PDP batch are separate
 * publications minted on their own days.
 * @param {string} surface
 * @param {readonly Receipt[]} receipts
 */
export function assertBatchIntegrity(surface, receipts) {
  const first = receipts[0];
  if (!first) return;
  for (const r of receipts) {
    if (r.commit.sha !== first.commit.sha) {
      // refusal: batch-sha
      throw new Error(`front lab: published ${surface} receipts span more than one commit SHA`);
    }
    if (r.runsPerUrl !== first.runsPerUrl || r.targets.length !== first.targets.length) {
      // refusal: batch-shape
      throw new Error(`front lab: published ${surface} receipts disagree on batch shape`);
    }
    if (r.date.slice(0, 10) !== first.date.slice(0, 10)) {
      // refusal: batch-date
      throw new Error(`front lab: published ${surface} receipts span more than one date`);
    }
    if (r.runLocation.label !== first.runLocation.label) {
      // refusal: batch-location
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
    const firstTarget = /** @type {Target} */ (first.targets[0]);
    const target = /** @type {Target} */ (r.targets[0]);
    if (target.interactionId !== firstTarget.interactionId) {
      // refusal: batch-interaction
      throw new Error(
        `front lab: published ${surface} receipts drove different interactions ` +
          `(${first.profile.id} → ${firstTarget.interactionId}, ` +
          `${r.profile.id} → ${target.interactionId}) — one surface's publication is one batch, ` +
          `and its reading tables name one interaction`,
      );
    }
  }
}

/**
 * The chrome constant (ADR-0001 addendum F) is OPTIONAL-BUT-VALIDATED, and
 * deliberately so: it measures the cost of the POPULATED chrome, which only
 * exists once a build has produced the lab bundle — so the first build of a
 * new publication necessarily runs before its constant can be measured.
 * Rather than let that bootstrap tempt a hand-written placeholder, the page
 * renders a designed "not yet measured" statement when the artifact is
 * absent (C2 applied to the constant itself: no number without its
 * artifact), and applies the full refusal set when it is present — this
 * function. Throws with the refusal's own message.
 *
 * @param {ChromeConstant} chromeConstant
 * @param {{
 *   labBundles: Readonly<Record<string, Readonly<Record<string, object>>>>,
 *   renderChrome: (ctx: RenderContext & { lab: object | undefined }) => string,
 *   chromeFragmentOf: (html: string) => string,
 *   getProfile: (id: string) => { id: string } | undefined,
 *   defaultProfile: { id: string },
 *   sha256Hex: (text: string) => string,
 *   byteLength: (text: string) => number,
 * }} deps
 */
export function admitChromeConstant(chromeConstant, deps) {
  if (chromeConstant.kind !== "pm-chrome-constant" || chromeConstant.commit.dirty !== false) {
    // refusal: cc-malformed
    throw new Error("front lab: chrome-constant.json malformed or minted from a dirty tree");
  }
  // A missing measurement must refuse the build exactly as a dirty receipt
  // does: without this, a null delta (every run's metric null) substitutes as
  // "0 ms" and a renamed field as "NaN ms" — a measured-sounding constant for
  // something never measured, which the %% marker guard cannot see
  // (verify-slice, correctness lens).
  for (const metric of ["FCP", "LCP", "CLS", "longTaskMs"]) {
    if (!Number.isFinite(chromeConstant.deltaMedians?.[metric])) {
      // refusal: cc-nonfinite
      throw new Error(
        `front lab: chrome-constant delta for ${metric} is not a finite number — a constant that was never measured cannot publish`,
      );
    }
  }
  // The provenance bar (ADR-0001 addendum Q), with the one pinned exemption
  // (BOOTSTRAP_CONSTANT_COMMIT above).
  if (chromeConstant.commit.sha !== BOOTSTRAP_CONSTANT_COMMIT) {
    const oc = chromeConstant.originCommit;
    if (!oc || oc.dirty !== false || oc.sha !== chromeConstant.commit.sha) {
      // refusal: cc-provenance
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
    // refusal: cc-unpopulated
    throw new Error(
      "front lab: the chrome constant was measured against an UNPOPULATED chrome (no published readings in the fragment) — re-measure against a plane serving this publication",
    );
  }
  // The IDENTITY gate (ADR-0001 addendum N hole 1). `populated` cannot tell
  // the current fragment from a stale one: the build regenerates the chrome
  // from the receipts, so the fragment that ships is not necessarily the
  // fragment the probe hashed — 11,931 B against 12,023 B on the first
  // publication, 0.8% and unbounded, growing with every surface added to
  // the strip. So the build re-renders the fragment the Worker will serve —
  // the REAL renderer against the lab bundle built above, under the exact
  // renderContext the probe recorded — and REFUSES when the sha256 differs.
  // The discharge cycle this forces is the two-pass publish: build →
  // measure against a plane serving this publication (the deployed plane
  // once it ships; the local composed plane as the recorded interim when
  // the fragment itself changed) → commit the fresh artifact → rebuild.
  const mc = chromeConstant.measuredChrome;
  const rc = mc.renderContext;
  if (
    !rc ||
    typeof mc.sha256 !== "string" ||
    [rc.variant, rc.surface, rc.pathname, rc.search, rc.location].some((v) => typeof v !== "string")
  ) {
    // refusal: cc-no-render-context
    throw new Error(
      "front lab: the chrome constant records no renderContext, so the fragment it measured cannot be verified against the fragment this build ships (ADR-0001 addendum N hole 1) — re-measure with tools/bench-runner chrome-constant",
    );
  }
  // Profile resolution mirrors the Worker's labFor EXACTLY (getProfile ??
  // default; Object.hasOwn against client-controlled keys).
  const requested = new URLSearchParams(rc.search).get("profile") ?? "";
  const resolved = (deps.getProfile(requested) ?? deps.defaultProfile).id;
  const surfaceBundles = Object.hasOwn(deps.labBundles, rc.surface)
    ? deps.labBundles[rc.surface]
    : undefined;
  const lab =
    surfaceBundles && Object.hasOwn(surfaceBundles, resolved) ? surfaceBundles[resolved] : undefined;
  const fragment = deps.chromeFragmentOf(
    deps.renderChrome({
      variant: rc.variant,
      surface: rc.surface,
      pathname: rc.pathname,
      search: rc.search,
      location: rc.location,
      lab,
    }),
  );
  const builtSha = deps.sha256Hex(fragment);
  if (builtSha !== mc.sha256) {
    // refusal: cc-identity
    throw new Error(
      `front lab: the chrome constant describes a fragment this build does not ship — the probe hashed ` +
        `${mc.sha256.slice(0, 12)} (${mc.bytes} B) but this build renders ${builtSha.slice(0, 12)} ` +
        `(${deps.byteLength(fragment)} B) for ${rc.variant}/${rc.surface}${rc.search} at ${rc.location}. ` +
        `The constant is bound to the chrome that ships (ADR-0001 addendum N hole 1): re-measure against a ` +
        `plane serving THIS publication — the deployed plane once this ships, or the local composed plane ` +
        `(run-local, PM_HOLD=1) as the recorded interim — commit the fresh artifact, and rebuild.`,
    );
  }
}
