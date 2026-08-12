// The render middleware — the spike's host-agnostic form of the official
// template's (docs/prototypes/remix3-frontier/app/render.tsx is the prior
// art): renderToStream with SSR-inline frame resolution through the SAME
// router (no network hop). Two deviations from the template, both recorded
// in DIFF-TO-STARTER.md:
//  - no resolveClientEntry: this exhibit ships NO clientEntry island (the
//    cart is a page-level plain script — see src/cart.js), so the hook and
//    the template's workerd stable-id friction never engage;
//  - no node:path import (the template uses it for a filename fallback the
//    omitted hook needed) — the middleware runs identically on workerd and
//    under the pre-merge guard's plain-Node vitest.
import type { Router } from "remix/router";
import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import type { RemixNode } from "remix/ui";
import { renderToStream } from "remix/ui/server";

export function render() {
  return renderWith(
    ({ request, router }) =>
      function render(node: RemixNode, init?: ResponseInit) {
        const stream = renderToStream(node, {
          frameSrc: request.url,
          signal: request.signal,
          resolveFrame: (src) => resolveFrame(router, request, src),
        });

        return createHtmlResponse(stream, init);
      },
  );
}

// Verbatim from the official template: frames are resolved during SSR by an
// internal fetch through the same router — no network hop.
async function resolveFrame(router: Router, request: Request, src: string) {
  const url = new URL(src, request.url);

  const headers = new Headers();
  headers.set("Accept", "text/html");

  const cookie = request.headers.get("Cookie");
  if (cookie) headers.set("Cookie", cookie);

  const response = await router.fetch(
    new Request(url, {
      method: "GET",
      headers,
      signal: request.signal,
    }),
  );

  if (!response.ok) {
    return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`;
  }

  if (response.body) return response.body;
  return await response.text();
}
