import { component$ } from "@builder.io/qwik";
import { useDocumentHead } from "@builder.io/qwik-city";

/**
 * The RouterHead component is placed inside of the document `<head>` element.
 *
 * ── slice-D deviations from the starter ──
 *  - No `<link rel="icon" href="/favicon.svg">`. That href is NOT base-aware
 *    (a real prefix bug in the starter), so on the composed origin it points
 *    at `/favicon.svg` — a path this variant does not own and the front
 *    Worker does not serve, i.e. a guaranteed 404 request on every page load.
 *    public/favicon.svg went with it.
 *  - No `<link rel="canonical">`. `useLocation().url.href` is the ORIGIN's
 *    URL, and this page is served from three places during a slice (local
 *    dev, CI's composed origin, the deployed plane), so the emitted canonical
 *    would differ per environment — a per-environment byte difference in a
 *    variant whose whole job is byte-identical output. Nothing on the matrix
 *    publishes a canonical link today.
 *  - `head.styles` / `head.scripts` are not rendered: this surface sets
 *    neither, and both branches carry `dangerouslySetInnerHTML`, which is
 *    exactly the kind of unexercised HTML-injection path a slice should not
 *    leave lying in a variant.
 *  - `<meta name="viewport">` is the master's own string
 *    ("width=device-width, initial-scale=1", no trailing `.0`).
 */
export const RouterHead = component$(() => {
  const head = useDocumentHead();

  return (
    <>
      <title>{head.title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      {head.meta.map((m) => (
        <meta key={m.key} {...m} />
      ))}
      {head.links.map((l) => (
        <link key={l.key} {...l} />
      ))}
    </>
  );
});
