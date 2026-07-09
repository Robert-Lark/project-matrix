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
