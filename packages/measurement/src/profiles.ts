/**
 * The versioned test-profile spec — the ONE definition of the three published
 * test profiles (ADR-0001 §4). Every consumer reads THIS spec:
 *
 *   - the HUD's `?profile=` snapshot-selector ids (ADR-0004 §6)
 *   - the bench runner's network/CPU throttles (issue #7)
 *   - the drift gate's pixel-diff viewports (issue #6)
 *   - the receipt's `profile` field (ADR-0001 §9)
 *
 * so "three published profiles applied identically" holds by construction —
 * there is no second copy to drift.
 *
 * Deliberately dependency-free: the HUD ships this to the browser.
 *
 * Value provenance (verified against primary sources 2026-07-07, see the
 * per-profile notes): the mobile and desktop profiles pin Lighthouse's
 * published defaults (`mobileSlow4G` / `desktopDense4G` +
 * `screenEmulationMetrics` in GoogleChrome/lighthouse core/config/constants.js
 * and the Lantern simulation constants); the fast-wifi profile is
 * PROJECT-DEFINED because no widely-published preset exists (WebPageTest's
 * connectivity.ini has no WiFi profile — checked). Values are lab targets for
 * the automation layer; note Lighthouse's DevTools-applied throttling adjusts
 * these (rtt ×3.75, throughput ×0.9) — whether the runner uses simulated or
 * applied throttling is the bench runner's decision (issue #7), but the
 * TARGET characteristics are pinned here.
 *
 * Bump PROFILE_SPEC_VERSION on ANY value change — published receipts cite the
 * version they ran under, so numbers stay tied to the exact conditions.
 */

export const PROFILE_SPEC_VERSION = 1;

export type ProfileId =
  | "fast-wifi-laptop"
  | "avg-broadband-desktop"
  | "slow-4g-mid-phone";

export interface ProfileNetwork {
  /** Round-trip time target, ms. */
  rttMs: number;
  /**
   * Download throughput target, kilobits per second, where
   * **1 Kbps = 1024 bits/s** (the Lighthouse convention — the pinned values
   * are n×1024). CDP `Network.emulateNetworkConditions` takes bytes/sec:
   * use {@link kbpsToBytesPerSecond} (×128), never ×1000/8 (a silent ~2.4%
   * deviation from the pinned conditions).
   */
  downloadKbps: number;
  /** Upload throughput target, same unit as {@link ProfileNetwork.downloadKbps}. */
  uploadKbps: number;
}

/**
 * The one blessed Kbps→bytes/sec conversion (binary base, matching the pinned
 * values above): kbps × 1024 bits ÷ 8 = kbps × 128.
 */
export function kbpsToBytesPerSecond(kbps: number): number {
  return kbps * 128;
}

export interface ProfileViewport {
  width: number;
  height: number;
  deviceScaleFactor: number;
  /** Mobile emulation (touch, mobile UA hints) on or off. */
  mobile: boolean;
}

export interface TestProfile {
  id: ProfileId;
  /** Short human label, HUD-facing. */
  label: string;
  network: ProfileNetwork;
  /** Main-thread slowdown multiplier applied at the automation layer. */
  cpuMultiplier: number;
  viewport: ProfileViewport;
  /** Where these numbers come from — part of the anti-rigging receipt trail. */
  provenance: string;
}

export const PROFILES: Readonly<Record<ProfileId, TestProfile>> = {
  "fast-wifi-laptop": {
    id: "fast-wifi-laptop",
    label: "Fast WiFi · laptop",
    network: { rttMs: 10, downloadKbps: 30720, uploadKbps: 15360 },
    cpuMultiplier: 1,
    viewport: { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false },
    provenance:
      "Project-defined (no widely-published WiFi preset exists; WebPageTest's connectivity.ini was checked and has none): 30/15 Mbps, 10 ms RTT, hidpi laptop viewport.",
  },
  "avg-broadband-desktop": {
    id: "avg-broadband-desktop",
    label: "Average broadband · desktop",
    network: { rttMs: 40, downloadKbps: 10240, uploadKbps: 10240 },
    cpuMultiplier: 1,
    viewport: { width: 1350, height: 940, deviceScaleFactor: 1, mobile: false },
    provenance:
      "Lighthouse desktopDense4G (rttMs 40, throughputKbps 10*1024, cpuSlowdownMultiplier 1; upload unset by Lighthouse, pinned here to the same 10240) + Lighthouse DESKTOP_EMULATION_METRICS (1350×940 @1).",
  },
  "slow-4g-mid-phone": {
    id: "slow-4g-mid-phone",
    label: "Slow 4G · mid-range phone",
    network: { rttMs: 150, downloadKbps: 1638.4, uploadKbps: 750 },
    cpuMultiplier: 4,
    viewport: { width: 412, height: 823, deviceScaleFactor: 1.75, mobile: true },
    provenance:
      "Lighthouse mobileSlow4G (rttMs 150, throughputKbps 1.6*1024, uploadThroughputKbps 750, cpuSlowdownMultiplier 4) + Lighthouse moto g power (2022) screen emulation (412×823 @1.75).",
  },
};

export const PROFILE_IDS = Object.keys(PROFILES) as readonly ProfileId[];

/** Lookup that tolerates arbitrary strings (e.g. a raw `?profile=` value). */
export function getProfile(id: string): TestProfile | undefined {
  return (PROFILES as Record<string, TestProfile>)[id];
}
