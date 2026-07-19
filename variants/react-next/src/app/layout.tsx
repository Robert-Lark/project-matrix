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
const CSS_FILES = [
  "fonts.css",
  "tokens.css",
  "surfaces/shell.css",
  "components/masthead.css",
  "components/footer.css",
  "components/button.css",
  "components/release-card.css",
  "components/prose.css",
  "surfaces/editorial.css",
];

export default function RootLayout({ children }: { children: ReactNode }) {
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
        {CSS_FILES.map((file) => (
          <link key={file} rel="stylesheet" href={`/react-next/assets/pm/css/${file}`} />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
