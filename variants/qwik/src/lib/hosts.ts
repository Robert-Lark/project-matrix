/** Designated hosts for cross-surface entry links (spec of record;
 *  `packages/reference/render/shell.mjs` HOSTS, ported verbatim —
 *  SURFACE_CONTROLS carries them too). Absolute by contract: canonical markup
 *  must be byte-identical across variants, and a relative cross-surface link
 *  would 404 on a sparse matrix cell. Targets that are not built yet 404 by
 *  design, and no suite assertion dereferences them. */
export const HOSTS = {
  plp: "/react-next/plp/plain/",
  pdp: (slug: string) => `/vanilla/pdp/${slug}/`,
  editorial: "/vanilla/editorial/",
  checkout: "/vanilla/checkout/",
  a11y: "/vanilla/a11y/",
  howBuilt: "/how-it-was-built/",
};
