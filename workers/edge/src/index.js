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
// results are not cached). Images are deliberately OUTSIDE the warm tier:
// the cache axis is the tray API's measurement variable; image bytes are
// immutable R2 reads (see workers/README.md).
//
// KV keys are built from the EFFECTIVE measurement condition — the parsed,
// clamped knobs (n, page, id) plus the documented `run` isolation knob —
// never from raw client query strings. That makes the key bijective with the
// payload (no encoding aliasing, no junk-param key minting, bounded length;
// all three were demonstrated failure modes of raw-query keys).
//
// No Discogs credential exists anywhere here (ADR-0002 §1): the Worker only
// ever reads the frozen snapshot.
import { BEACON_TAG_KEYS, clampN } from "@pm/measurement";

const SNAPSHOT_KEYS = {
  summaries: "snapshot/summaries.json",
  details: "snapshot/details.json",
};
const MAX_TAG_BYTES = 96; // AE index limit; verified against workerd source

function log(level, event, fields) {
  const line = JSON.stringify({ level, worker: "pm-edge", event, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

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
 */
function runKnob(url) {
  const run = url.searchParams.get("run") ?? "";
  return /^[A-Za-z0-9._-]{1,64}$/.test(run) ? run : "";
}

/**
 * Serve a data endpoint through the warm tier under an explicit canonical
 * key. `compute` builds the payload from R2; null means not-found (never
 * cached, no cache-state — the caller owns the 4xx).
 */
async function serveData(url, env, key, compute) {
  const bypass = url.searchParams.get("cache") === "cold";

  if (!bypass) {
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
  if (!bypass) await env.WARM.put(key, body); // write-through: one priming request warms this URL
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-pm-cache-state": bypass ? "bypass" : "miss",
    },
  });
}

async function readSnapshot(env, key) {
  const obj = await env.SNAPSHOT.get(key);
  if (!obj) throw new Error(`snapshot object missing from R2: ${key}`);
  return obj.json();
}

/** Facet buckets computed from what is actually stored — never precomputed. */
function computeFacets(summaries) {
  const count = (getValues) => {
    const buckets = new Map();
    for (const s of summaries) {
      for (const v of getValues(s)) buckets.set(v, (buckets.get(v) ?? 0) + 1);
    }
    return [...buckets.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([value, n]) => ({ value, count: n }));
  };
  return {
    genres: count((s) => s.genres),
    styles: count((s) => s.styles),
    // Format descriptors ride in the summary's format string ("Vinyl, LP,
    // Album, Reissue"); the LEADING carrier token is not a facet — dropped
    // positionally, never by a hardcoded carrier name.
    formats: count((s) => s.format.split(", ").slice(1)),
  };
}

async function handlePlp(url, env) {
  // clampN is the shared canonical knob (ADR-0002 §5) — the same clamp the
  // chrome's environment tag applies, so tag and served condition agree.
  const n = clampN(url.searchParams.get("n"));
  const page = Math.max(parseInt(url.searchParams.get("page") ?? "", 10) || 1, 1);
  const run = runKnob(url);
  const key = `v1:/api/plp?n=${n}&page=${page}${run ? `&run=${run}` : ""}`;

  return serveData(url, env, key, async () => {
    const summaries = await readSnapshot(env, SNAPSHOT_KEYS.summaries);
    const total = summaries.length;
    const start = (page - 1) * n;
    return {
      items: summaries.slice(start, start + n),
      page,
      perPage: n,
      total,
      totalPages: Math.ceil(total / n),
      facets: computeFacets(summaries),
    };
  });
}

async function handlePdp(url, env, rawId) {
  if (!/^\d{1,15}$/.test(rawId)) {
    return json({ error: "release id must be numeric" }, 400, {
      "x-pm-cache-state": "none",
    });
  }
  const id = Number(rawId); // canonical form: leading-zero aliases collapse
  const run = runKnob(url);
  const key = `v1:/api/pdp/${id}${run ? `?run=${run}` : ""}`;

  const response = await serveData(url, env, key, async () => {
    const details = await readSnapshot(env, SNAPSHOT_KEYS.details);
    return details.find((d) => d.id === id) ?? null;
  });
  return (
    response ??
    json({ error: "release not found" }, 404, { "x-pm-cache-state": "none" })
  );
}

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

async function handleBeacon(request, env) {
  let event;
  try {
    event = await request.json();
  } catch {
    return json({ error: "body must be JSON" }, 400);
  }
  const tags = event?.tags ?? {};
  const missing = BEACON_TAG_KEYS.filter(
    (t) => typeof tags[t] !== "string" || tags[t].length === 0,
  );
  if (missing.length > 0) {
    return json({ error: `missing required tags: ${missing.join(", ")}` }, 400);
  }
  // Analytics Engine throws TypeError synchronously on shape violations
  // (verified against workerd source: 1 index ≤ 96 bytes, ≤ 20 blobs,
  // ≤ 16 KB cumulative). EVERY client-controlled blob — the five tags AND
  // the metric name — is bounded here, so oversized input is a 400, never a
  // production 500 the local no-op emulation can't catch.
  const encoder = new TextEncoder();
  const name = typeof event.name === "string" ? event.name : "";
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
    doubles: [typeof event.value === "number" && Number.isFinite(event.value) ? event.value : 0],
  });
  return new Response(null, { status: 204 });
}

/** Path-first routing: a known resource with a wrong method is a 405, not a 404. */
function methodGate(request, allowed) {
  if (allowed.includes(request.method)) return null;
  return json(
    { error: "method not allowed" },
    405,
    { allow: allowed.join(", ") },
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/plp") {
        return methodGate(request, ["GET", "HEAD"]) ?? (await handlePlp(url, env));
      }

      const pdpMatch = url.pathname.match(/^\/api\/pdp\/([^/]+)$/);
      if (pdpMatch) {
        return (
          methodGate(request, ["GET", "HEAD"]) ??
          (await handlePdp(url, env, pdpMatch[1]))
        );
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
        message: err.message,
        stack: err.stack,
      });
      return json({ error: "internal error" }, 500);
    }
  },
};
