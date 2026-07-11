import type { Handle, RemixNode } from 'remix/ui'

export interface DocumentProps {
  children?: RemixNode
  title?: string
}

// Deliberately plain class-based markup + one stylesheet, NOT remix/ui's
// css() mixin, for the store components: the ADR-0003 canonical markup
// contract is `pm-` classes + shared CSS, and this spike demonstrates that
// Remix 3 renders that contract without friction. css() stays available for
// exhibit-only chrome (see the island), where the contract doesn't reach.
export function Document(handle: Handle<DocumentProps>) {
  return () => {
    const { children, title = 'Remix 3 frontier spike' } = handle.props

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{title}</title>
          <link rel="stylesheet" href="/assets/spike.css" />
        </head>
        <body>
          {/* The composed origin's chrome slot (ADR-0004 §7): the front
              Worker injects switcher/HUD here. Empty in the spike. */}
          <div id="pm-chrome-slot"></div>

          {/* The fence, self-explained on-surface (decision-map: every
              surface self-explains). Placeholder copy; final copy is the
              Editorial build's job. */}
          <aside class="pm-frontier-plaque" data-pm-fenced="true">
            <strong>Frontier exhibit.</strong> This page is rendered by Remix
            3 (<code>3.0.0-beta.5</code>), a pre-release framework. It is
            shown as a preview of a coming paradigm and is{' '}
            <strong>excluded from every benchmark number</strong> on this
            site — pre-release software can change or break week to week.
          </aside>

          {children}
          <script type="module" src="/assets/entry.js"></script>
        </body>
      </html>
    )
  }
}
