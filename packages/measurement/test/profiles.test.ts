/**
 * The profile spec is a published measurement condition (ADR-0001 §4): its
 * values are pinned EXACTLY, so any change is a deliberate, version-bumped
 * decision — never an accidental edit. Receipts cite the spec version.
 */
import { describe, expect, it } from "vitest";
import {
  PROFILE_IDS,
  PROFILE_SPEC_VERSION,
  PROFILES,
  getProfile,
  kbpsToBytesPerSecond,
} from "../src/profiles";
import { PLP_N, clampN, knobTags, plpWarmable } from "../src/beacon";

describe("the versioned profile spec", () => {
  it("is version 1 with exactly the three published profiles", () => {
    expect(PROFILE_SPEC_VERSION).toBe(1);
    expect([...PROFILE_IDS].sort()).toEqual([
      "avg-broadband-desktop",
      "fast-wifi-laptop",
      "slow-4g-mid-phone",
    ]);
  });

  it("ids are URL-safe slugs (they ride in ?profile=)", () => {
    for (const id of PROFILE_IDS) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(PROFILES[id].id).toBe(id);
    }
  });

  it("every profile states its provenance (anti-rigging trail)", () => {
    for (const id of PROFILE_IDS) {
      expect(PROFILES[id].provenance.length).toBeGreaterThan(20);
    }
  });

  it("getProfile resolves known ids and rejects unknown ?profile= values", () => {
    expect(getProfile("slow-4g-mid-phone")?.cpuMultiplier).toBe(4);
    expect(getProfile("not-a-profile")).toBeUndefined();
  });

  it("Kbps→bytes/sec uses the binary base the pinned values assume (×128)", () => {
    // 1638.4 Kbps (mobileSlow4G) = 1.6 * 1024 * 1024 bits/s = 209715.2 B/s.
    expect(kbpsToBytesPerSecond(1638.4)).toBeCloseTo(209715.2, 5);
    expect(kbpsToBytesPerSecond(10240)).toBe(1310720);
  });
});

describe("the canonical knob vocabulary (shared by tag and served condition)", () => {
  it("clampN collapses aliases and junk onto the effective value", () => {
    expect(clampN("240")).toBe(240);
    expect(clampN("0240")).toBe(240);
    expect(clampN("99999")).toBe(240);
    expect(clampN("0")).toBe(24);
    expect(clampN("-5")).toBe(1);
    expect(clampN("abc")).toBe(24);
    expect(clampN(null)).toBe(24);
    expect(clampN("x".repeat(500))).toBe(24);
  });

  it("the environment tag wire format is pinned: n=<effective>|cache=<cold|default>", () => {
    expect(knobTags("?n=240&cache=cold")).toEqual({
      environment: "n=240|cache=cold",
      cacheState: "cold",
    });
    expect(knobTags("")).toEqual({
      environment: "n=24|cache=default",
      cacheState: "default",
    });
    // Bounded regardless of input — a junk ?n= can never push the tag past
    // the collector's 96-byte limit (silent-RUM-loss guard).
    const junk = knobTags(`?n=${"9".repeat(300)}`);
    expect(junk.environment.length).toBeLessThan(30);
  });

  it("cacheState is `none` for a condition the warm tier never holds — a search, or an unwarmed n", () => {
    // The PLP data plane's key-cardinality policy (ADR-0005 addendum,
    // 2026-09-04): free-text search is never stored, and n is warmed only at
    // the two published knob values. A RUM point for such a page tagged
    // `default` would blend an R2 read into the KV column it never reached.
    expect(knobTags("?q=ambient").cacheState).toBe("none");
    expect(knobTags("?n=48").cacheState).toBe("none");
    // The REQUESTED column in `environment` is unchanged — it names what was
    // asked for; `cacheState` names what could be served.
    expect(knobTags("?n=48")).toEqual({ environment: "n=48|cache=default", cacheState: "none" });
    // Cold is cold whatever the condition: the bypass was asked for and given.
    expect(knobTags("?q=ambient&cache=cold").cacheState).toBe("cold");
    // An EMPTY search box is not a search (a GET form submits `q=` untouched).
    expect(knobTags("?q=").cacheState).toBe("default");
    expect(knobTags("?q=%20%20").cacheState).toBe("default");
    // Facet and sort params do not affect warmability: they have finite key spaces.
    expect(knobTags("?genre=Jazz&sort=title").cacheState).toBe("default");
  });

  it("plpWarmable is the one derivation, and the knob set is the switcher's two values", () => {
    expect([...PLP_N.warmed]).toEqual([PLP_N.default, PLP_N.max]);
    expect(plpWarmable(new URLSearchParams(""))).toBe(true);
    expect(plpWarmable(new URLSearchParams("n=240"))).toBe(true);
    expect(plpWarmable(new URLSearchParams("n=0240"))).toBe(true); // clamps to 240
    expect(plpWarmable(new URLSearchParams("n=99999"))).toBe(true); // clamps to 240
    expect(plpWarmable(new URLSearchParams("n=1"))).toBe(false);
    expect(plpWarmable(new URLSearchParams("n=239"))).toBe(false);
    expect(plpWarmable(new URLSearchParams("q=x"))).toBe(false);
  });
});

describe("pinned values (version 1)", () => {
  it("slow-4g-mid-phone pins Lighthouse mobileSlow4G + moto g power screen", () => {
    expect(PROFILES["slow-4g-mid-phone"]).toMatchObject({
      network: { rttMs: 150, downloadKbps: 1638.4, uploadKbps: 750 },
      cpuMultiplier: 4,
      viewport: { width: 412, height: 823, deviceScaleFactor: 1.75, mobile: true },
    });
  });

  it("avg-broadband-desktop pins Lighthouse desktopDense4G + desktop screen", () => {
    expect(PROFILES["avg-broadband-desktop"]).toMatchObject({
      network: { rttMs: 40, downloadKbps: 10240, uploadKbps: 10240 },
      cpuMultiplier: 1,
      viewport: { width: 1350, height: 940, deviceScaleFactor: 1, mobile: false },
    });
  });

  it("fast-wifi-laptop pins the project-defined fast profile", () => {
    expect(PROFILES["fast-wifi-laptop"]).toMatchObject({
      network: { rttMs: 10, downloadKbps: 30720, uploadKbps: 15360 },
      cpuMultiplier: 1,
      viewport: { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false },
    });
  });
});
