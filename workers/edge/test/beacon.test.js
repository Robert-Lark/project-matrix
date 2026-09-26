/**
 * The beacon collector's ROSTER (security floor, 2026-09-18; 2026-08-29
 * audit priority 4, task 2). Before this, `handleBeacon` checked the five
 * tags for presence and byte length only, then used `tags.variant` as the
 * Analytics Engine INDEX — so any string became a sampling key. The roster
 * is `@pm/measurement`'s: the variant prefixes the front Worker dispatches,
 * the switcher registry's surface names, the home HUD's `singleton`/`home`,
 * and the suite's reserved `ci-smoke`. Everything else is a 400 that names
 * the tag, and no point is written.
 *
 * Driven in-process with a RECORDING Analytics Engine stub, so "no point
 * written" is asserted on the dataset, not inferred from the status.
 */
import { describe, expect, it } from "vitest";
import {
  BEACON_SURFACES,
  BEACON_VARIANTS,
  HOME_TAGS,
  SMOKE_TAG,
  SURFACE_NAMES,
  VARIANT_PREFIXES,
} from "@pm/measurement";
import worker from "../src/index.js";

function stubEnv() {
  const points = [];
  return {
    points,
    env: { BEACONS: { writeDataPoint: (point) => points.push(point) } },
  };
}

const post = (env, event) => postRaw(env, JSON.stringify(event));
/** The body as TEXT: JSON has no NaN or Infinity literal, and
 *  `JSON.stringify` writes both as `null` — so the non-finite half of the
 *  value check can only be reached with a raw out-of-range literal, which
 *  `JSON.parse` turns into ±Infinity (verify-slice, correctness lens: the
 *  first draft's "NaN" and "Infinity" legs sent null on the wire and proved
 *  the `typeof` half twice). */
const postRaw = (env, text) =>
  worker.fetch(
    new Request("https://plane.test/api/beacon", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: text,
    }),
    env,
  );

const event = (tags) => ({
  name: "LCP",
  value: 1234.5,
  tags: {
    variant: "vanilla",
    surface: "editorial",
    environment: "n=24|cache=default",
    cacheState: "default",
    location: "LHR",
    ...tags,
  },
});

describe("the roster is exactly what the plane can emit", () => {
  it("variants: every dispatched prefix, the home HUD's singleton, the smoke sentinel — nothing else", () => {
    expect([...BEACON_VARIANTS].sort()).toEqual(
      [...VARIANT_PREFIXES, HOME_TAGS.variant, SMOKE_TAG].sort(),
    );
    expect(BEACON_VARIANTS.size).toBe(VARIANT_PREFIXES.length + 2);
  });

  it("surfaces: every registered surface, home, the smoke sentinel — nothing else", () => {
    expect([...BEACON_SURFACES].sort()).toEqual(
      [...SURFACE_NAMES, HOME_TAGS.surface, SMOKE_TAG].sort(),
    );
    expect(BEACON_SURFACES.size).toBe(SURFACE_NAMES.length + 2);
  });

  it("the client's own 'unknown' fallback is NOT on either roster", () => {
    expect(BEACON_VARIANTS.has("unknown")).toBe(false);
    expect(BEACON_SURFACES.has("unknown")).toBe(false);
  });
});

describe("the collector accepts the roster", () => {
  it("every variant prefix indexes the point under its own name", async () => {
    for (const variant of VARIANT_PREFIXES) {
      const { env, points } = stubEnv();
      const res = await post(env, event({ variant }));
      expect(res.status, variant).toBe(204);
      expect(points).toHaveLength(1);
      expect(points[0].indexes).toEqual([variant]);
      expect(points[0].blobs[0]).toBe(variant);
    }
  });

  it("every registered surface is accepted as the surface blob", async () => {
    for (const surface of SURFACE_NAMES) {
      const { env, points } = stubEnv();
      const res = await post(env, event({ surface }));
      expect(res.status, surface).toBe(204);
      expect(points[0].blobs[1]).toBe(surface);
    }
  });

  it("the home HUD's singleton/home pair is accepted", async () => {
    const { env, points } = stubEnv();
    expect((await post(env, event({ ...HOME_TAGS }))).status).toBe(204);
    expect(points[0].indexes).toEqual([HOME_TAGS.variant]);
  });

  it("the suite's reserved ci-smoke pair is accepted", async () => {
    const { env, points } = stubEnv();
    expect((await post(env, event({ variant: SMOKE_TAG, surface: SMOKE_TAG }))).status).toBe(204);
    expect(points).toHaveLength(1);
  });
});

describe("the collector refuses everything off the roster, and writes nothing", () => {
  it("an unknown variant is a 400 naming the tag; no point reaches the dataset", async () => {
    const { env, points } = stubEnv();
    const res = await post(env, event({ variant: "not-a-variant" }));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("variant");
    expect(points).toHaveLength(0);
  });

  it("an unknown surface is a 400 naming the tag; no point reaches the dataset", async () => {
    const { env, points } = stubEnv();
    const res = await post(env, event({ surface: "not-a-surface" }));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("surface");
    expect(points).toHaveLength(0);
  });

  it("the client's 'unknown' fallback — a chrome that lost its data attributes — is refused", async () => {
    const { env, points } = stubEnv();
    expect((await post(env, event({ variant: "unknown" }))).status).toBe(400);
    expect((await post(env, event({ surface: "unknown" }))).status).toBe(400);
    expect(points).toHaveLength(0);
  });

  it("the match is exact: a case variant of a real prefix is not the prefix", async () => {
    const { env, points } = stubEnv();
    expect((await post(env, event({ variant: "Vanilla" }))).status).toBe(400);
    expect((await post(env, event({ surface: "Editorial" }))).status).toBe(400);
    expect(points).toHaveLength(0);
  });

  it("a variant far over the byte bound is refused by the roster first, and the message still names the tag", async () => {
    const { env, points } = stubEnv();
    const res = await post(env, event({ variant: "x".repeat(200) }));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("variant");
    expect(points).toHaveLength(0);
  });

  it("a missing tag is still the presence 400 it always was, naming the tag", async () => {
    const { env, points } = stubEnv();
    const tags = event({}).tags;
    delete tags.surface;
    const res = await post(env, { name: "LCP", value: 1, tags });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("surface");
    expect(points).toHaveLength(0);
  });
});

describe("the value is a finite number, or the point is refused (workers-hardening, 2026-09-25)", () => {
  // Before this, `doubles: [finite ? value : 0]` wrote a fabricated 0 for
  // every shape below and answered 204 — a dashboard row that never
  // happened. Asserted on the dataset: no point, not just a status.
  for (const [label, value] of [
    ["absent", undefined],
    ["null", null],
    ["a string", "1234"],
    ["an object", { v: 1 }],
  ]) {
    it(`a value that is ${label} is a 400 naming the field, and nothing is written`, async () => {
      const { env, points } = stubEnv();
      const body = { name: "LCP", tags: event({}).tags };
      if (value !== undefined) body.value = value;
      const res = await post(env, body);
      expect(res.status).toBe(400);
      expect(await res.text()).toContain("value");
      expect(points).toHaveLength(0);
    });
  }

  for (const [label, literal] of [
    ["Infinity (the out-of-range literal 1e999)", "1e999"],
    ["-Infinity (-1e999)", "-1e999"],
  ]) {
    it(`a value that parses to ${label} is a 400 naming the field, and nothing is written`, async () => {
      const { env, points } = stubEnv();
      const tags = JSON.stringify(event({}).tags);
      const res = await postRaw(env, `{"name":"LCP","value":${literal},"tags":${tags}}`);
      expect(res.status).toBe(400);
      expect(await res.text()).toContain("value");
      expect(points).toHaveLength(0);
    });
  }

  it("NaN cannot arrive over JSON at all: a raw NaN literal is the body-must-be-JSON 400", async () => {
    const { env, points } = stubEnv();
    const res = await postRaw(env, `{"name":"LCP","value":NaN,"tags":${JSON.stringify(event({}).tags)}}`);
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("JSON");
    expect(points).toHaveLength(0);
  });

  it("CONTROL: zero is a real value — a measured 0 (CLS on a still page) is written as 0", async () => {
    const { env, points } = stubEnv();
    const res = await post(env, { ...event({}), name: "CLS", value: 0 });
    expect(res.status).toBe(204);
    expect(points).toHaveLength(1);
    expect(points[0].doubles).toEqual([0]);
  });

  it("CONTROL: a finite value is written as itself, never rounded or coerced", async () => {
    const { env, points } = stubEnv();
    expect((await post(env, event({}))).status).toBe(204);
    expect(points[0].doubles).toEqual([1234.5]);
  });
});
