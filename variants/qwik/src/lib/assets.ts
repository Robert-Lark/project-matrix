/**
 * The one place this variant's URL prefix is read, never typed.
 *
 * `import.meta.env.BASE_URL` is vite's own base-aware URL root, so
 * `base: "/qwik/"` in vite.config.ts is the single source of the prefix for
 * routes (qwik-city's basePathname), for the lazy-chunk base (`q:base`), for
 * the on-disk output layout, AND for these asset URLs. A disagreement between
 * any of them would serve HTML 200 with every stylesheet 404 — a silently
 * unstyled page — which is why editorial.test.ts dereferences every /qwik/…
 * URL the served page references rather than sampling a few (the slice-C
 * precedent).
 */
export const ASSET_BASE = `${import.meta.env.BASE_URL}assets/pm/`;
