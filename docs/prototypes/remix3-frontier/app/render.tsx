import type { Router } from 'remix/router'
import { renderWith } from 'remix/middleware/render'
import { createHtmlResponse } from 'remix/response/html'
import type { RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'

// The template's render middleware, made host-agnostic: the official
// template imports node:path here (for a filename fallback only); this
// version derives the module basename by plain string-splitting on the
// entry id (sufficient for the two id shapes in play — import.meta.url
// file URLs and the literal fallback), so the same middleware runs on
// workerd and node without a compat flag.
export function render() {
  return renderWith(
    ({ request, router }) =>
      function render(node: RemixNode, init?: ResponseInit) {
        const stream = renderToStream(node, {
          frameSrc: request.url,
          signal: request.signal,
          resolveFrame: (src) => resolveFrame(router, request, src),
          // Client entries were prebuilt by build-client.mjs (esbuild) into
          // /assets/<module>.js — map the module id to that URL. The
          // template instead compiles them at runtime via createAssetServer,
          // which is Node-only (fs + esbuild); prebuilding is the
          // Workers-shaped equivalent and serves both hosts identically.
          resolveClientEntry(entryId, component) {
            const [idPart, hashExport] = entryId.split('#')
            const base = idPart!.split('/').pop()!.replace(/\.(tsx|ts|jsx|js|mjs)$/, '')
            return {
              href: `/assets/${base}.js`,
              // Same fallback chain as the template: explicit #export, then
              // the component's function name, then the file name
              // title-cased into a plausible identifier (a raw kebab-case
              // base could never match a real export).
              exportName: hashExport || component.name || titleCase(base),
            }
          },
        })

        return createHtmlResponse(stream, init)
      },
  )
}

function titleCase(fileBase: string): string {
  return fileBase
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join('')
}

// Verbatim from the official template: frames are resolved during SSR by an
// internal fetch through the same router — no network hop.
async function resolveFrame(router: Router, request: Request, src: string) {
  const url = new URL(src, request.url)

  const headers = new Headers()
  headers.set('Accept', 'text/html')

  const cookie = request.headers.get('Cookie')
  if (cookie) headers.set('Cookie', cookie)

  const response = await router.fetch(
    new Request(url, {
      method: 'GET',
      headers,
      signal: request.signal,
    }),
  )

  if (!response.ok) {
    return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
  }

  if (response.body) return response.body
  return await response.text()
}
