export {
  PAGE_NORMALIZE,
  PERMITTED_NOISE,
  NO_NOISE,
  firstDomDivergence,
  type NoiseSpec,
} from "./normalize";
export { comparePixels, solidPng, type PixelComparison } from "./pixels";
export { startRepoServer, type StaticServer } from "./server";
export {
  profileContextOptions,
  extractNormalizedDom,
  neutralizeChrome,
  neutralizeFenced,
  captureStablePixels,
} from "./gate";
