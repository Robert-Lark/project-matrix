/**
 * @pm/measurement — the shared measurement layer (ADR-0001).
 *
 * This slice ships the versioned profile spec only. The pinned web-vitals
 * build + beacon wiring land with the chrome slice (issue #5), delivered from
 * the front Worker's /_pm/* instrumentation path so the bytes stay strippable.
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
  type BeaconTagKey,
  type BeaconTags,
  type BeaconEvent,
} from "./beacon";
