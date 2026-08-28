import type { ReactNode } from "react";

// Fonts are a controlled constant (ADR-0003 §8): the canonical loading
// markup (packages/tokens/fonts/loading-markup.html) ships verbatim, only
// the base path differing. Rendered as plain <link> elements in an explicit
// <head> — not a CSS `import`, which Next's bundler would hash/process,
// breaking byte identity with the served files (scripts/copy-tokens.mjs
// copies them untouched into public/). Verified empirically: rendering
// these as children of <body> (the first attempt) does NOT get hoisted
// into <head> by React — they stay exactly where authored — so an explicit
// <head> sibling of <body> is what actually places them there. Next's own
// Metadata-API output (title, viewport meta) merges into this same <head>
// without conflict.
//
// One Document, one `css` parameter (pdp-build): the sheet list is the ONE
// thing the two surfaces' documents legitimately differ in, and the first
// draft hardcoded editorial's list in the root layout — the same defect
// astro's Shell solved with a `css` prop. Each route group's root layout
// passes its surface's list; the lists live beside the component so the
// pre-merge stylesheet-list guard can import them without rendering Next.

/** The shell's own sheets, in the master's order (shell.mjs head()). */
const SHELL_CSS = [
  "fonts.css",
  "tokens.css",
  "surfaces/shell.css",
  "components/masthead.css",
  "components/footer.css",
  "components/button.css",
] as const;

/** The editorial surface's full list (editorial.mjs `css`, after the shell's). */
export const EDITORIAL_CSS: readonly string[] = [
  ...SHELL_CSS,
  "components/release-card.css",
  "components/prose.css",
  "surfaces/editorial.css",
];

/** The PDP surface's full list (pdp.mjs `css`, after the shell's). */
export const PDP_CSS: readonly string[] = [
  ...SHELL_CSS,
  "components/gallery.css",
  "components/qty.css",
  "components/tracklist.css",
  "components/prose.css",
  "components/plaque.css",
  "surfaces/pdp.css",
];

/** The document skeleton every route group's root layout wraps itself in.
 *  Framework-neutral (type-only React import) so the pre-merge guard can
 *  render it with react-dom/server, exactly like Shell and the articles. */
export function Document({
  css,
  children,
}: {
  css: readonly string[];
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/react-next/assets/pm/fonts/FamiljenGrotesk.var.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/react-next/assets/pm/fonts/PMCrateSymbols.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        {css.map((file) => (
          <link key={file} rel="stylesheet" href={`/react-next/assets/pm/css/${file}`} />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
