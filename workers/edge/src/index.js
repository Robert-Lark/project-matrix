// Edge data plane (ADR-0002 §8, issue #4). Thin read API over the frozen
// snapshot in R2, KV warm tier with HARNESS-DRIVEN cache state, self-hosted
// image serving, and the beacon collector.
//
// Cache semantics (the reproducible cold/warm columns, ADR-0001 §4):
//   ?cache=cold  → BYPASS: read R2, never touch KV (cold stays repeatable)
//   otherwise    → read KV: HIT serves the warm tier; MISS computes from R2
//                  and writes through, so one priming request warms any URL.
// Tray responses carry x-pm-cache-state: bypass | miss | hit; 4xx data
// responses carry `none` (they never traverse the warm tier — negative
// results are not cached), and so does the one 200 that IS a negative
// result: a PLP page past the last real one (see `handlePlp`). Images are
// deliberately OUTSIDE the warm tier:
// the cache axis is the tray API's measurement variable; image bytes are
// immutable R2 reads (see workers/README.md).
//
// KV keys are built from the EFFECTIVE measurement condition — the parsed,
// clamped knobs (n, page, id) plus the documented `run` isolation knob —
// never from raw client query strings. That makes the key bijective with the
// payload (no encoding aliasing, no junk-param key minting, bounded length;
// all three were demonstrated failure modes of raw-query keys).
//
// THE KEY-CARDINALITY POLICY (ADR-0005 §5 + its 2026-09-04 addendum). A key
// is WRITTEN only for a condition the warm tier can hold a FINITE number of:
//   cacheable ⇔ `q` absent  ∧  n ∈ {24, 240}  ∧  page ≤ totalPages
// Everything else is still SERVED — from R2, marked `x-pm-cache-state: none`
// ("not a warm-tier resource") — and never stored.
//  - `q` is free text: no finite key space exists, so search is computed per
//    request (one R2 read + CPU, bounded per request, nothing accretes).
//  - `n` is warmed only at the two published knob values (PLP_N.default /
//    PLP_N.max — SURFACE_CONTROLS.plp.nKnob): every n in 1..240 is a real
//    served condition, but warming all 240 multiplies the key space ~120×
//    for conditions the instrument never names (the ceiling, computed from
//    the real crate with kv-ceiling.mjs, 2026-09-04, re-run 2026-09-18 —
//    the table of record is the ADR-0005 addendum: 4,548,342 keys / ~19.7 GB
//    / $22.74 of writes at $5/M / $9.87 per month at $0.50/GB-mo with n free,
//    vs 37,182 keys / 0.162 GB / $0.19 / $0.08 per month with n at the knobs).
//  - `page` has a floor (1) and a numeric cap (Number.MAX_SAFE_INTEGER —
//    `parseInt` of 309+ digits is Infinity, which JSON writes as null) but no
//    ceiling in the sense that matters: it cannot know `totalPages` before
//    the snapshot is read, and reading R2 before the KV lookup would put
//    ~400 ms of origin on every warm hit — so the ceiling is applied on the way OUT:
//    a page past `totalPages` (of the FILTERED set) is served as the honest
//    empty page every arm renders as "0", and never stored. Before this,
//    `for p in $(seq 1 1000000); do curl "?page=$p"; done` minted one
//    immortal ~10 KB entry per integer (2026-08-29 audit). An empty result
//    (a filter combination matching nothing) has totalPages 0, so its page 1
//    is past the end too: no key for a negative result.
//  - Facet values are validated against the snapshot's REAL facet sets, exact
//    match: junk is a 400 (`none`), never a key. `sort` against PLP_SORTS.
//    Validation needs the snapshot, so it runs AFTER the lookup — a junk key
//    can never hit because it is never written — but a value too long to be
//    real is refused BEFORE the lookup so the key can never approach KV's
//    512-byte limit (longest real facet value: 37 characters).
// The residual cost of a junk or uncacheable request is one KV read-miss
// ($0.50/M) plus one R2 read per request — bounded per request, zero storage.
//
// No Discogs credential exists anywhere here (ADR-0002 §1): the Worker only
// ever reads the frozen snapshot.
import {
  BEACON_SURFACES,
  BEACON_TAG_KEYS,
  BEACON_VARIANTS,
  clampN,
  plpWarmable,
} from "@pm/measurement";
// The PLP query semantics are the reference package's OWN pure module — the
// spec's function serves the data, so the Worker cannot disagree with the
// master about what a filtered page contains (ADR-0004 §2 addendum,
// 2026-09-04). Import-free and platform-neutral by construction; wrangler
// bundles it like any module.
import {
  PLP_FACET_PARAMS,
  PLP_TRAY_VERSION,
  applyPlpQuery,
  clampPage,
  facetValueSets,
  isPlpSort,
  normalizeQ,
} from "@pm/reference/render/plp-query.mjs";

// Checked as JS (tsconfig.json `checkJs`; ADR-0004 addendum, 2026-09-25):
// `Env` is wrangler's generated binding interface (cloudflare-env.d.ts —
// WARM, SNAPSHOT, BEACONS), the tray shapes are the query module's own
// typedefs, and the beacon contract is @pm/measurement's.
/** @typedef {import("@pm/reference/render/plp-query.mjs").PlpQuery} PlpQuery */
/** @typedef {import("@pm/reference/render/plp-query.mjs").PlpSummary} PlpSummary */
/** @typedef {import("@pm/reference/render/plp-query.mjs").PlpPage} PlpPage */
/** @typedef {import("@pm/measurement").BeaconTags} BeaconTags */

const SNAPSHOT_KEYS = {
  manifest: "snapshot/manifest.json",
  summaries: "snapshot/summaries.json",
  details: "snapshot/details.json",
};
const MAX_TAG_BYTES = 96; // AE index limit; verified against workerd source

/** @param {"info" | "error"} level @param {string} event @param {Record<string, unknown>} fields */
function log(level, event, fields) {
  const line = JSON.stringify({ level, worker: "pm-edge", event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

/** @param {unknown} body @param {number} status @param {Record<string, string>} [extraHeaders] */
function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
  });
}

/**
 * The documented harness isolation knob: a well-formed ?run= value becomes
 * part of the warm key, so a suite/bench run can mint fresh cache state
 * without touching other runs'. Malformed values are ignored (treated as the
 * junk params they are).
 * @param {URL} url
 * @returns {string}
 */
function runKnob(url) {
  const run = url.searchParams.get("run") ?? "";
  return /^[A-Za-z0-9._-]{1,64}$/.test(run) ? run : "";
}

/**
 * Serve a data endpoint through the warm tier under an explicit canonical
 * key. `compute` builds the payload from R2; null means not-found (never
 * cached, no cache-state — the caller owns the 4xx).
 *
 * `cacheable(payload)` decides, AFTER compute, whether this condition may be
 * written through. It is a predicate on the payload rather than on the URL
 * because the one fact it needs — is this a real page — exists only once R2
 * has been read; the lookup above it stays a single KV read, and an
 * uncacheable condition can never HIT because it is never written. Such a
 * response carries `x-pm-cache-state: none`: it is not a warm-tier resource.
 * @template T
 * @param {URL} url
 * @param {Env} env
 * @param {string} key
 * @param {() => Promise<T | null>} compute
 * @param {{ cacheable?: (payload: T) => boolean, tiered?: boolean }} [options]
 * @returns {Promise<Response | null>}
 */
async function serveData(url, env, key, compute, { cacheable = () => true, tiered = true } = {}) {
  const bypass = url.searchParams.get("cache") === "cold";

  // `tiered: false` — the condition is known UNCACHEABLE before compute (a
  // search, an unwarmed n): skip the lookup too, since nothing could be
  // there, and save the read.
  if (!bypass && tiered) {
    const warm = await env.WARM.get(key);
    if (warm !== null) {
      return new Response(warm, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "x-pm-cache-state": "hit",
        },
      });
    }
  }

  const payload = await compute();
  if (payload === null) return null;
  const body = JSON.stringify(payload);
  const store = !bypass && tiered && cacheable(payload);
  // Write-through: one priming request warms this URL. A `?run=`-keyed
  // entry exists only to isolate one harness run (suite/bench), so it
  // expires instead of accreting in deployed KV forever; visitor-facing
  // (un-nonced) entries keep the frozen-data infinite TTL.
  if (store) {
    await env.WARM.put(key, body, runKnob(url) ? { expirationTtl: 3600 } : undefined);
  }
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-pm-cache-state": bypass ? "bypass" : store ? "miss" : "none",
    },
  });
}

/** A tray from R2, parsed. The caller names the shape it expects — the
 *  frozen snapshot is the contract's (ADR-0002), and the guards that hold
 *  it to that contract are the capture tool's, not this Worker's.
 *  @param {Env} env @param {string} key @returns {Promise<unknown>} */
async function readSnapshot(env, key) {
  const obj = await env.SNAPSHOT.get(key);
  if (!obj) throw new Error(`snapshot object missing from R2: ${key}`);
  return obj.json();
}

/** A request the data plane refuses: the caller answers 400 with
 *  `x-pm-cache-state: none` (never cached, no key minted). */
class BadRequest extends Error {}

/** The one facet value length the plane will even look up. Longest real
 *  value in either snapshot: 37 characters (`jq` over summaries.json,
 *  2026-09-04). Bounding the ENCODED length keeps the KV key far below the
 *  512-byte limit whatever alphabet the junk arrives in. */
const FACET_VALUE_ENCODED_MAX = 96;

/** The length a value contributes to the KEY — measured with the key's own
 *  encoder. `plpKey` spells the key with `URLSearchParams`, whose
 *  application/x-www-form-urlencoded serializer percent-encodes `! ' ( ) ~`
 *  (3 bytes each) where `encodeURIComponent` leaves them as 1: the first
 *  draft bounded with the latter, so 96 `!`s passed the bound and two of
 *  them handed `WARM.get` a 613-byte key — KV refuses keys over 512 bytes on
 *  GET as well as PUT, so a junk URL answered 500 where the policy promises
 *  400 (verify-slice, 2026-09-18). `v=` is the two-character prefix. */
/** @param {string} value */
const formEncodedLength = (value) => new URLSearchParams({ v: value }).toString().length - 2;

/** KV's key limit (developers.cloudflare.com/kv/platform/limits/: "512
 *  bytes", fetched 2026-09-04). The per-value bound above keeps every real
 *  key far below it; this is the belt over those braces — the KEY is what
 *  KV measures, so the key is what is refused, whatever alphabet, sort,
 *  page or nonce the junk arrives in. */
const KV_KEY_MAX_BYTES = 512;

/**
 * The served PLP condition, parsed and clamped from the URL. Empty values are
 * ABSENT, not junk: `?sort=` and `?q=` are what a GET form submits for an
 * untouched select and an empty search box. Facet VALUES are validated later,
 * against the snapshot (`validateFacets`); here only their length is.
 * @param {URL} url
 * @returns {PlpQuery}
 */
function plpQuery(url) {
  const n = clampN(url.searchParams.get("n"));
  const page = clampPage(url.searchParams.get("page"));
  /** @type {PlpQuery} */
  const query = { n, page, genre: null, style: null, format: null, sort: null, q: null };
  for (const param of PLP_FACET_PARAMS) {
    const raw = url.searchParams.get(param);
    if (raw === null || raw === "") continue;
    if (formEncodedLength(raw) > FACET_VALUE_ENCODED_MAX) {
      throw new BadRequest(`unknown ${param}`);
    }
    query[param] = raw;
  }
  const sort = url.searchParams.get("sort");
  if (sort !== null && sort !== "") {
    if (!isPlpSort(sort)) throw new BadRequest("unknown sort");
    query.sort = sort;
  }
  query.q = normalizeQ(url.searchParams.get("q"));
  return query;
}

/** Exact-match validation against what the snapshot actually holds.
 *  @param {PlpQuery} query @param {readonly PlpSummary[]} summaries */
function validateFacets(query, summaries) {
  const sets = facetValueSets(summaries);
  for (const param of PLP_FACET_PARAMS) {
    if (query[param] !== null && !sets[param].has(query[param])) {
      throw new BadRequest(`unknown ${param}`);
    }
  }
}

/** The canonical warm key: fixed param order, defaults omitted,
 *  `URLSearchParams` spelling — one condition, one key. `q` never appears
 *  because a search is never stored. The prefix is the TRAY's shape version
 *  (plp-query.mjs PLP_TRAY_VERSION): a shape change under a kept prefix
 *  would serve pre-deploy entries the renderers cannot read — un-nonced
 *  entries never expire, so a prefix bump is the only mechanism that
 *  retires them.
 *  @param {PlpQuery} query @param {string} run */
function plpKey(query, run) {
  const params = new URLSearchParams();
  params.set("n", String(query.n));
  params.set("page", String(query.page));
  for (const param of PLP_FACET_PARAMS) {
    if (query[param] !== null) params.set(param, query[param]);
  }
  if (query.sort !== null) params.set("sort", query.sort);
  if (run) params.set("run", run);
  return `v${PLP_TRAY_VERSION}:/api/plp?${params.toString()}`;
}

/** @param {URL} url @param {Env} env @returns {Promise<Response>} */
async function handlePlp(url, env) {
  /** @type {PlpQuery} */
  let query;
  try {
    query = plpQuery(url);
  } catch (err) {
    if (err instanceof BadRequest) {
      return json({ error: err.message }, 400, { "x-pm-cache-state": "none" });
    }
    throw err;
  }
  const run = runKnob(url);
  const key = plpKey(query, run);
  // Refused BEFORE any lookup: a key KV would reject (>512 bytes) must be
  // the policy's 400 `none`, never the runtime's 414 surfacing as a 500.
  if (new TextEncoder().encode(key).length > KV_KEY_MAX_BYTES) {
    return json({ error: "unknown filter" }, 400, { "x-pm-cache-state": "none" });
  }

  try {
    const served = await serveData(
      url,
      env,
      key,
      async () => {
        const summaries = /** @type {PlpSummary[]} */ (
          await readSnapshot(env, SNAPSHOT_KEYS.summaries)
        );
        validateFacets(query, summaries);
        return applyPlpQuery(summaries, query);
      },
      {
        // The policy in the file header. A search and an unwarmed n are
        // known uncacheable from the URL alone — `plpWarmable` is the SAME
        // derivation the chrome's cacheState tag uses (@pm/measurement), so
        // what the tier does and what RUM says it did cannot disagree. A
        // page past the end is known only after compute.
        tiered: plpWarmable(url.searchParams),
        /** @param {PlpPage} p */
        cacheable: (p) => p.page <= p.totalPages,
      },
    );
    // `serveData` answers null only for a null compute, and `applyPlpQuery`
    // always returns a page (an empty condition is the honest empty page,
    // never not-found) — stated as a throw rather than a cast, so a future
    // compute that CAN return null meets a 500 here instead of a null
    // response (found by the typecheck, workers-hardening 2026-09-25).
    if (served === null) throw new Error("plp: compute returned null for a condition that always has a page");
    return served;
  } catch (err) {
    if (err instanceof BadRequest) {
      return json({ error: err.message }, 400, { "x-pm-cache-state": "none" });
    }
    throw err;
  }
}

/** @param {URL} url @param {Env} env @param {string} rawId */
async function handlePdp(url, env, rawId) {
  if (!/^\d{1,15}$/.test(rawId)) {
    return json({ error: "release id must be numeric" }, 400, {
      "x-pm-cache-state": "none",
    });
  }
  const id = Number(rawId); // canonical form: leading-zero aliases collapse
  const run = runKnob(url);
  const key = `v1:/api/pdp/${id}${run ? `?run=${run}` : ""}`;

  // KNOWN COST, recorded rather than removed (workers-hardening, 2026-09-25;
  // 2026-08-29 audit priority 5, task 3): a cold read — `?cache=cold`, or
  // the first request for an id under a `?run=` nonce — fetches and parses
  // the WHOLE details tray from R2 to serve one release: 967,527 B on the
  // crate, 345,236 B on the fixture (`wc -c` on the committed trays). The
  // alternative is a per-release object written at seed time
  // (`snapshot/details/{id}.json`, seed-local.mjs), which is one small R2
  // read per cold request instead — but every plane must be re-seeded
  // before the Worker can read it, the deployed bucket's re-seed is a
  // credentialed manual step (workers/README.md), and until it ran every
  // cold PDP read would answer 404. Left as it is because the cost is
  // bounded and off the published path: the warm column never reaches R2
  // (a KV hit returns above), the PDP's request-time variants fetch their
  // tray server-side without forwarding `?cache=` (decision map,
  // measurement-pass), so no published PDP cell is priced by this parse.
  // Measured on the local plane 2026-09-25 (the decision-map node carries
  // the numbers): the cold read's server time against a warm hit's.
  const response = await serveData(url, env, key, async () => {
    // The detail tray: the Worker reads one field of it (`id`) and serves
    // the element whole; its shape is the contract's (ADR-0002 §6).
    const details = /** @type {{ id: number }[]} */ (
      await readSnapshot(env, SNAPSHOT_KEYS.details)
    );
    return details.find((d) => d.id === id) ?? null;
  });
  return (
    response ??
    json({ error: "release not found" }, 404, { "x-pm-cache-state": "none" })
  );
}

/** @param {Env} env */
async function handleSnapshot(env) {
  // Provenance, not measurement (ADR-0002 §1): the dated SnapshotManifest
  // names which frozen snapshot this plane serves. The origin suite reads it
  // to pick WHICH committed snapshot's artifacts to assert against (issue
  // #11) — so it sits deliberately outside the warm tier and carries no
  // cache-state marker.
  const obj = await env.SNAPSHOT.get(SNAPSHOT_KEYS.manifest);
  if (!obj) return json({ error: "snapshot manifest not found" }, 404);
  return new Response(obj.body, {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/** @param {URL} url @param {Env} env */
async function handleImage(url, env) {
  // /assets/img/x.avif → R2 key assets/img/x.avif (the contract's image
  // paths ARE the R2 keys). Deliberately not warm-tier cached: the cache
  // axis belongs to the tray API; images are immutable R2 reads.
  const key = url.pathname.slice(1);
  const obj = await env.SNAPSHOT.get(key);
  if (!obj) return new Response("not found\n", { status: 404 });
  return new Response(obj.body, {
    headers: {
      // The seeder's stored metadata is authoritative — never assume avif.
      "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      // Frozen snapshot — immutable by definition.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

/** @param {Request} request @param {Env} env */
async function handleBeacon(request, env) {
  // Untrusted JSON: every field is checked before it is read as a type.
  /** @type {{ name?: unknown, value?: unknown, tags?: unknown }} */
  let event;
  try {
    event = /** @type {typeof event} */ (await request.json());
  } catch {
    return json({ error: "body must be JSON" }, 400);
  }
  const rawTags = /** @type {Record<string, unknown>} */ (
    event !== null && typeof event === "object" && event.tags !== null && typeof event.tags === "object"
      ? event.tags
      : {}
  );
  const missing = BEACON_TAG_KEYS.filter((t) => {
    const v = rawTags[t];
    return typeof v !== "string" || v.length === 0;
  });
  if (missing.length > 0) {
    return json({ error: `missing required tags: ${missing.join(", ")}` }, 400);
  }
  // Every key is a non-empty string from here on — proven by the filter.
  const tags = /** @type {BeaconTags} */ (rawTags);
  // The VALUE is required and must be a finite number (workers-hardening,
  // 2026-09-25; 2026-08-29 audit priority 5, task 3). Until this check the
  // write below coerced a missing, null, NaN or non-numeric value to 0 and
  // recorded the point — a fabricated 0 ms LCP is a lie in a dashboard, and
  // a dashboard's p75 over a row of zeros is a lie that looks like a
  // finding. The measurement client always sends the metric's own number
  // (packages/measurement/src/client.ts), so a real beacon never meets this;
  // a hand-made one does, and gets the 400 that names the field.
  if (typeof event.value !== "number" || !Number.isFinite(event.value)) {
    return json({ error: "value must be a finite number" }, 400);
  }
  // The ROSTER (security floor, 2026-09-18; @pm/measurement). `variant` is
  // the AE index — the sampling key — and `surface` the first blob every
  // dashboard groups by. Until this check any string that fit in 96 bytes
  // became a sampling key (2026-08-29 audit, priority 4 task 2: RUM-dashboard
  // pollution — published numbers were never at risk, they come from
  // committed lab bundles). Exact match, refused BEFORE the byte bound so the
  // message names the tag. Rate limiting stays deferred to domain-cutover
  // (workers/README.md); this is the part a rate limit cannot do.
  if (!BEACON_VARIANTS.has(tags.variant)) {
    return json({ error: "unknown variant: not on the roster" }, 400);
  }
  if (!BEACON_SURFACES.has(tags.surface)) {
    return json({ error: "unknown surface: not on the roster" }, 400);
  }
  // Analytics Engine throws TypeError synchronously on shape violations
  // (verified against workerd source: 1 index ≤ 96 bytes, ≤ 20 blobs,
  // ≤ 16 KB cumulative). EVERY client-controlled blob — the five tags AND
  // the metric name — is bounded here, so oversized input is a 400, never a
  // production 500 the local no-op emulation can't catch.
  const encoder = new TextEncoder();
  const name = typeof event.name === "string" ? event.name : "";
  /** @type {string[]} */
  const oversized = BEACON_TAG_KEYS.filter(
    (t) => encoder.encode(tags[t]).length > MAX_TAG_BYTES,
  );
  if (encoder.encode(name).length > MAX_TAG_BYTES) oversized.push("name");
  if (oversized.length > 0) {
    return json(
      { error: `fields exceed ${MAX_TAG_BYTES} bytes: ${oversized.join(", ")}` },
      400,
    );
  }

  // writeDataPoint is fire-and-forget by design ("you do not need to await
  // writeDataPoint() — it will return immediately", per the AE docs);
  // "success" here means the call completed without throwing — the point
  // passed validation and was handed to the runtime's background pipeline
  // (PRD story 26). Locally it is a documented no-op. Field packing: one
  // indexed dimension (variant, the sampling key), the five tags + metric
  // name as blobs, the metric value as a double.
  env.BEACONS.writeDataPoint({
    indexes: [tags.variant],
    blobs: [
      tags.variant,
      tags.surface,
      tags.environment,
      tags.cacheState,
      tags.location,
      name,
    ],
    doubles: [event.value],
  });
  return new Response(null, { status: 204 });
}

/** Path-first routing: a known resource with a wrong method is a 405, not a 404.
 *  @param {Request} request @param {readonly string[]} allowed */
function methodGate(request, allowed) {
  if (allowed.includes(request.method)) return null;
  return json(
    { error: "method not allowed" },
    405,
    { allow: allowed.join(", ") },
  );
}

export default {
  /** @param {Request} request @param {Env} env */
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/plp") {
        return methodGate(request, ["GET", "HEAD"]) ?? (await handlePlp(url, env));
      }

      const pdpMatch = url.pathname.match(/^\/api\/pdp\/([^/]+)$/);
      if (pdpMatch) {
        // One capture group, so a match always carries it.
        const rawId = /** @type {string} */ (pdpMatch[1]);
        return methodGate(request, ["GET", "HEAD"]) ?? (await handlePdp(url, env, rawId));
      }

      if (url.pathname === "/api/snapshot") {
        return methodGate(request, ["GET", "HEAD"]) ?? (await handleSnapshot(env));
      }

      if (url.pathname === "/api/beacon") {
        return methodGate(request, ["POST"]) ?? (await handleBeacon(request, env));
      }

      if (url.pathname.startsWith("/assets/img/")) {
        return methodGate(request, ["GET", "HEAD"]) ?? (await handleImage(url, env));
      }

      return new Response("not found\n", { status: 404 });
    } catch (err) {
      // Generic message out; details server-side only (security.md).
      log("error", "unhandled", {
        path: url.pathname,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return json({ error: "internal error" }, 500);
    }
  },
};
