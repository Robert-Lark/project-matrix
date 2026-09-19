/**
 * The beacon roster (security floor, 2026-09-18) is a published contract
 * like the profile spec above it: the edge collector refuses what is not on
 * it, so its contents are pinned here and its shape held to the collector's
 * own bounds.
 */
import { describe, expect, it } from "vitest";
import {
  BEACON_SURFACES,
  BEACON_VARIANTS,
  HOME_TAGS,
  SMOKE_TAG,
  SURFACE_NAMES,
  VARIANT_PREFIXES,
} from "../src/beacon";

describe("the beacon roster", () => {
  it("variant prefixes are URL path segments: lower-case slugs, unique", () => {
    for (const prefix of VARIANT_PREFIXES) {
      expect(prefix).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(VARIANT_PREFIXES).size).toBe(VARIANT_PREFIXES.length);
  });

  it("surface names are path segments too, and unique", () => {
    for (const name of SURFACE_NAMES) {
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(SURFACE_NAMES).size).toBe(SURFACE_NAMES.length);
  });

  it("every roster value fits the collector's 96-byte Analytics Engine index bound", () => {
    const encoder = new TextEncoder();
    for (const value of [...BEACON_VARIANTS, ...BEACON_SURFACES]) {
      expect(encoder.encode(value).length).toBeLessThanOrEqual(96);
    }
  });

  it("the rosters are the derivation, not a copy: prefixes ∪ home ∪ smoke, names ∪ home ∪ smoke", () => {
    expect([...BEACON_VARIANTS].sort()).toEqual(
      [...VARIANT_PREFIXES, HOME_TAGS.variant, SMOKE_TAG].sort(),
    );
    expect([...BEACON_SURFACES].sort()).toEqual(
      [...SURFACE_NAMES, HOME_TAGS.surface, SMOKE_TAG].sort(),
    );
  });

  it("the sentinels are not real prefixes or surfaces (they can never collide with a dispatched page)", () => {
    expect((VARIANT_PREFIXES as readonly string[]).includes(HOME_TAGS.variant)).toBe(false);
    expect((VARIANT_PREFIXES as readonly string[]).includes(SMOKE_TAG)).toBe(false);
    expect((SURFACE_NAMES as readonly string[]).includes(HOME_TAGS.surface)).toBe(false);
    expect((SURFACE_NAMES as readonly string[]).includes(SMOKE_TAG)).toBe(false);
  });

  it("the client's 'unknown' fallback is on neither roster", () => {
    expect(BEACON_VARIANTS.has("unknown")).toBe(false);
    expect(BEACON_SURFACES.has("unknown")).toBe(false);
  });
});
