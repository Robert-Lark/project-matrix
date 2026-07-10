/**
 * @pm/measurement — the shared measurement layer (ADR-0001).
 *
 * Contents: the versioned test-profile spec (profiles.ts), the beacon tag
 * contract + canonical knob vocabulary (beacon.ts), and the pinned
 * web-vitals client (client.ts — deliberately NOT exported here; it is a
 * standalone browser bundle, built to dist/measure.js and served from the
 * front Worker's /_pm/* instrumentation path).
 */
export {
  PROFILE_SPEC_VERSION,
  PROFILES,
  PROFILE_IDS,
  getProfile,
  kbpsToBytesPerSecond,
  type ProfileId,
  type ProfileNetwork,
  type ProfileViewport,
  type TestProfile,
} from "./profiles";
export {
  BEACON_TAG_KEYS,
  PLP_N,
  clampN,
  knobTags,
  type BeaconTagKey,
  type BeaconTags,
  type BeaconEvent,
} from "./beacon";
