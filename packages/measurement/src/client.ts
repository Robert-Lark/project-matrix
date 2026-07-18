/**
 * The measurement client (ADR-0001 §2, §8) — bundled to /_pm/measure.js and
 * injected identically into every variant by the front Worker. THE one ruler:
 * every variant's TTFB/FCP/LCP/CLS/INP come from this exact pinned
 * web-vitals build, and the bytes live on the known /_pm/* path so the
 * harness strips them from measured KB (ADR-0001 §6).
 *
 * Behavior: metrics stream into the HUD's live readout as they settle
 * (progressive enhancement — the page never depends on this script), and the
 * final values flush to the collector via `sendBeacon` when the page goes
 * hidden — the web-vitals library's own recommended reporting pattern.
 * Tags come from the injected chrome's data attributes; the tag spelling is
 * the shared BEACON_TAG_KEYS contract.
 */
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import type { BeaconEvent, BeaconTags } from "./beacon";

const chrome = document.getElementById("pm-chrome");
const ds = chrome?.dataset ?? {};
const tags: BeaconTags = {
  variant: ds.pmVariant ?? "unknown",
  surface: ds.pmSurface ?? "unknown",
  environment: ds.pmEnvironment ?? "unknown",
  cacheState: ds.pmCacheState ?? "unknown",
  location: ds.pmLocation ?? "unknown",
};

const pending = new Map<string, Metric>();

function display(metric: Metric): string {
  if (metric.name === "CLS") return metric.value.toFixed(3);
  return `${Math.round(metric.value)}ms`;
}

function record(metric: Metric): void {
  pending.set(metric.name, metric);
  // querySelectorAll: the redesigned chrome carries each vital twice (the
  // collapsed bar's mini readout + the panel's full set) — every slot updates.
  const slots = chrome?.querySelectorAll(`[data-pm-hud-live="${metric.name}"]`) ?? [];
  for (const slot of slots) slot.textContent = display(metric);
}

function flush(): void {
  for (const metric of pending.values()) {
    const event: BeaconEvent = {
      name: metric.name,
      value: metric.value,
      tags,
    };
    navigator.sendBeacon("/api/beacon", JSON.stringify(event));
  }
  pending.clear();
}

onTTFB(record);
onFCP(record);
onLCP(record);
onCLS(record);
onINP(record);

// Listen on document — visibilitychange TARGETS document, so this works for
// the real event and for synthetic dispatches alike (bubbling not assumed).
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flush();
});
// Safari < 14.5 never fires visibilitychange on unload; pagehide covers it.
addEventListener("pagehide", flush);
