// The how-it-was-built page, composed for THIS Worker's delivery (ADR-0008 §8;
// docs/prds/how-it-was-built-build.md). Assets-first static singleton like
// home and /methodology/: no injected chrome, no in-page HUD, zero JavaScript.
//
// ONE renderer, two heads (PRD Decision 4): the body is `renderHowBuilt` from
// @pm/reference — the very function that renders the committed master — so
// the served page cannot drift from the spec; only the <head> is this
// Worker's, in the home delivery shape (ADR-0007 §6): render-critical CSS
// inlined from the real @pm/tokens sources, canonical font markup on the
// /pm/ base path. Re-implementing the body behind %% markers, the way home
// and methodology are built, was rejected — two renderers over one source is
// this repo's recurring failure.
//
// Called from stamp-build.mjs with the build attestation, so every deep link
// on the page pins the SAME sha /_pm/build.json attests, or falls back to
// `main` and says so when the tree is dirty (PRD Decision 1, D9).
// The BARE specifier matters twice: turbo hashes a declared workspace
// dependency's files into this package's build key (@pm/reference#topo), so
// a renderer edit misses the cache — the suite's file-URL import pattern
// would leave the renderer OUT of the key; and the deep path resolves only
// because @pm/reference declares no `exports` map (tools/repo-checks
// no-component-runtime forbids one that names runtime code — it must never
// gain one). Build-time spec consumption, the @pm/tokens class (ADR-0007 §6),
// not a component runtime: nothing from @pm/reference ships to a visitor.
import { renderHowBuilt } from "@pm/reference/render/how-built.mjs";
import { faviconHref, token, tokensCss, tokensCssFile } from "./tokens-source.mjs";

// The sheets the master links (packages/reference/render/shell.mjs head() +
// how-built.mjs css list), inlined in the same order.
const SHEETS = [
  "surfaces/shell.css",
  "components/masthead.css",
  "components/footer.css",
  "components/button.css",
  "components/prose.css",
  "surfaces/how-built.css",
];

/** @param {{sha: string, dirty: boolean}} build the attestation */
export function howBuiltPage(build) {
  // The description is the one hand-written head sentence about the page's
  // links, and the head is exempt from the served-vs-master compare — so it
  // is derived from the same attestation as the build line, or a dirty
  // build would tell crawlers every link is pinned while the body says they
  // point at main (verify-slice, three lenses).
  const linkClause = build.dirty
    ? "each link pointing at the repository's main branch, because the tree was unclean when this page was built"
    : "each link pinned to the commit this page was built from";
  const head = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>How it was built — Project Matrix</title>`,
    `<meta name="description" content="The decision record behind Project Matrix, indexed from the repository itself: every architecture decision record and its later corrections, the build log's phases, the adversarial reviews, and the methodology — ${linkClause}.">`,
    `<meta name="theme-color" content="${token("--pm-neutral-0")}">`,
    `<link rel="icon" href="${faviconHref()}">`,
    `<link rel="preload" href="/pm/fonts/FamiljenGrotesk.var.woff2" as="font" type="font/woff2" crossorigin>`,
    `<link rel="stylesheet" href="/pm/css/fonts.css">`,
    `<style>\n${tokensCss}\n${SHEETS.map(tokensCssFile).join("\n")}\n  </style>`,
  ].join("\n  ");
  return renderHowBuilt({ head, build });
}
