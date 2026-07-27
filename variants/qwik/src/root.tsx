import { component$ } from "@builder.io/qwik";
import { QwikCityProvider, RouterOutlet } from "@builder.io/qwik-city";
import { RouterHead } from "./components/router-head/router-head";
import { ASSET_BASE } from "./lib/assets";

/** Qwik passes attribute NAMES through to the serialized HTML verbatim
 *  (measured: `dateTime` emits `dateTime`, `datetime` emits `datetime` — no
 *  DOM-property translation), but its JSX types expose only the DOM-property
 *  spelling `crossOrigin`. The canonical font-loading markup that ADR-0003 §8
 *  requires VERBATIM uses the HTML spelling, so it has to be authored that way
 *  and reach JSX through a spread. Typed as a props bag rather than cast at the
 *  use site so there is exactly one place to read this from — and
 *  editorial.test.ts asserts the served bytes either way. */
const CROSSORIGIN: Record<string, boolean> = { crossorigin: true };

/**
 * The document root. QwikCityProvider first, then `<head>` and `<body>` —
 * Qwik emits the `<html>` element itself from `entry.ssr.tsx`'s container
 * attributes, which is why `lang` is set there and not here.
 *
 * ── slice-D deviations from the starter ──
 *  - `<body>` carries NO `lang`. The starter writes `<body lang="en">`, which
 *    would be a second, competing language declaration AND an attribute the
 *    editorial master's `<body>` does not have — and `<body>`'s own
 *    attributes are contract surface for the drift gate (normalize.ts §4).
 *  - The design system is loaded here as plain `<link>` elements to
 *    unprocessed files (ADR-0003 §8; scripts/prepare-build.mjs copies them
 *    into public/ untouched). Importing them so vite bundles them would hash
 *    the files and rewrite fonts.css's @font-face URLs.
 *  - The starter's `<link rel="manifest">` is gone with public/manifest.json:
 *    a per-variant PWA manifest under /qwik/ is meaningless on a composed
 *    origin, and it is one more request on a byte-measured plane.
 *  - `global.css` is not imported: the design system IS the stylesheet set,
 *    and an extra vite-bundled sheet would inject styles no other variant has.
 */
export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charset="utf-8" />
        <RouterHead />
        {/* The canonical font-loading markup, verbatim modulo base path
            (packages/tokens/fonts/loading-markup.html): both first-paint
            files preloaded, the @font-face sheet after them. PMWarnGlyph is
            served but deliberately NOT preloaded. */}
        <link
          rel="preload"
          href={`${ASSET_BASE}fonts/FamiljenGrotesk.var.woff2`}
          as="font"
          type="font/woff2"
          {...CROSSORIGIN}
        />
        <link
          rel="preload"
          href={`${ASSET_BASE}fonts/PMCrateSymbols.woff2`}
          as="font"
          type="font/woff2"
          {...CROSSORIGIN}
        />
        {/* fonts.css is authored HERE, next to the preloads, rather than in
            the list below: the three of them together ARE the canonical
            font-loading markup, and ADR-0003 §8 requires it to ship verbatim
            modulo base path. Measured reason it cannot ride the list — Qwik
            reorders an element's attributes and stamps a generated `q:key` on
            it when the element is an ARRAY child, so inside `.map()` the same
            link serializes as `<link href=… rel="stylesheet" q:key=…>` and
            stops being the canonical line. Authored directly it keeps the
            written order. (No JSX `key` on anything the drift gate compares,
            either: Qwik serializes one as a `q:key` ATTRIBUTE where React's
            does not render at all, and neither of the body's lists is ever
            reordered. `RouterHead`'s head.meta/head.links loops DO keep theirs
            — those are dynamic lists, and `<head>` is a declared serialization
            freedom the normalizer drops whole.) */}
        <link rel="stylesheet" href={`${ASSET_BASE}css/fonts.css`} />
        {STYLESHEETS.map((file) => (
          <link rel="stylesheet" href={`${ASSET_BASE}css/${file}`} />
        ))}
      </head>
      <body>
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});

/** The REMAINING sheets the editorial master's own `<head>` loads, in its
 *  order — fonts.css is authored above, with the preloads it belongs to.
 *  ADR-0003 §8 pins the fonts only; these eight arrive as unbundled files by
 *  CHOICE, matching slices A–C so the four editorial columns stay comparable
 *  (variants/astro/DIFF-TO-STARTER.md point 4 records the cross-variant
 *  bundling question that raises, which belongs to the benchmark-publication
 *  arc rather than to any one slice). */
const STYLESHEETS = [
  "tokens.css",
  "surfaces/shell.css",
  "components/masthead.css",
  "components/footer.css",
  "components/button.css",
  "components/release-card.css",
  "components/prose.css",
  "surfaces/editorial.css",
];
