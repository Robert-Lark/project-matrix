// Front routing Worker — the ADR-0004 §3/§7 mechanism, minimally.
// Dispatches /{variant}/* to the bound variant Worker, then injects the
// switcher/HUD chrome into #pm-chrome-slot via HTMLRewriter (text/html only).

const VARIANTS = {
  vanilla: 'VARIANT_STATIC',
  astro: 'VARIANT_NOSCRIPT',
  ssr: 'VARIANT_SSR',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const variant = url.pathname.split('/')[1];
    const bindingName = VARIANTS[variant];

    // Assets-first: this script only sees requests that did NOT match one of
    // the front Worker's own static assets (home lives in ./public).
    if (!bindingName) {
      return new Response(`front: no variant for ${url.pathname}\n`, {
        status: 404,
      });
    }

    let upstream;
    try {
      // Forward the ORIGINAL request untouched. Variant assets are nested
      // under /{variant}/ (the documented "serving a subdirectory" shape), so
      // no path rewriting is needed and asset-layer redirects stay correct.
      upstream = await env[bindingName].fetch(request);
    } catch (err) {
      return new Response(
        `front: upstream ${variant} failed: ${err.message}\n`,
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return upstream; // non-HTML passes through byte-identical
    }

    return new HTMLRewriter()
      .on('#pm-chrome-slot', {
        element(el) {
          el.setInnerContent(chromeHtml(variant, url), { html: true });
        },
      })
      .transform(upstream);
  },
};

// Anchor-link switcher (works JS-off) + HUD stub — ADR-0004 §7. Links rewrite
// only the {variant} path segment, keeping surface/id/query intact.
function chromeHtml(current, url) {
  const links = Object.keys(VARIANTS)
    .filter((v) => v !== current)
    .map((v) => {
      const parts = url.pathname.split('/');
      parts[1] = v;
      return `<a href="${parts.join('/')}${url.search}">${v}</a>`;
    })
    .join(' ');
  return `<nav data-pm-chrome="1">switch: ${links} <span data-pm-hud>hud-stub</span></nav>`;
}
