/**
 * The per-surface control-set config (ADR-0004 §7): the switcher is
 * CONTEXTUAL — its control-set is a function of the surface — and SPARSE —
 * it offers only the variants a surface is actually built in, so it can
 * never offer a matrix cell that does not exist. Singleton surfaces get no
 * render-switcher at all.
 *
 * This build maps the placeholder surface only; each real surface build
 * registers its own entry (the sparse matrix rows in docs/decision-map.md).
 */
export interface SurfaceControls {
  /** Variant prefixes this surface is actually built in, in display order. */
  readonly variants: readonly string[];
}

export const SURFACE_CONTROLS: Readonly<Record<string, SurfaceControls>> = {
  sample: {
    variants: ["placeholder-static", "placeholder-ssr"],
  },
};
