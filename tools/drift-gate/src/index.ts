export {
  PAGE_NORMALIZE,
  PERMITTED_NOISE,
  NO_NOISE,
  firstDomDivergence,
  type NoiseSpec,
} from "./normalize";
export { comparePixels, type PixelComparison } from "./pixels";
export { startRepoServer, type StaticServer } from "./server";
export {
  profileContextOptions,
  extractNormalizedDom,
  neutralizeChrome,
  captureStablePixels,
} from "./gate";
