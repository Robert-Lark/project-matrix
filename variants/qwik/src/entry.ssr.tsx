/**
 * WHAT IS THIS FILE?
 *
 * SSR entry point, in all cases the application is rendered outside the
 * browser, this entry point will be the common one.
 *
 * - Server (express, cloudflare...)
 * - npm run start
 * - npm run preview
 * - npm run build
 *
 * ── slice-D deviation ──
 * `containerAttributes.lang` is "en", not the starter's "en-us". Qwik
 * serializes container attributes onto the `<html>` ELEMENT, and the drift
 * gate treats the document element's own attributes as contract surface
 * (tools/drift-gate/src/normalize.ts §4 — a dropped or altered `lang` is
 * pixel-neutral a11y drift, so it is compared, not stripped). The editorial
 * master serves `<html lang="en">`, so that is what this must be.
 */
import { renderToStream, type RenderToStreamOptions } from "@builder.io/qwik/server";
import Root from "./root";

export default function (opts: RenderToStreamOptions) {
  return renderToStream(<Root />, {
    ...opts,
    containerAttributes: {
      lang: "en",
      ...opts.containerAttributes,
    },
    serverData: {
      ...opts.serverData,
    },
  });
}
