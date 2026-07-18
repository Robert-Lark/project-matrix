// Response helpers + the security-header floor (ADR-0009 §5, §7).
//
// Public pages: script-src 'self' keeps injected-markup XSS dead even though
// style-src allows inline styles (Shiki's highlighted spans carry style
// attributes — that is what 'unsafe-inline' buys, and scripts stay locked).
// Admin pages add connect-src (autosave fetch) and frame-src 'self' (the
// live preview iframe), and are never indexable.

export function esc(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const PUBLIC_CSP = [
  "default-src 'none'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "font-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const ADMIN_CSP = [
  "default-src 'none'",
  "img-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "font-src 'self'",
  "frame-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

function baseHeaders(csp) {
  return {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": csp,
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  };
}

export function publicPage(body, { status = 200, headers = {} } = {}) {
  return new Response(body, {
    status,
    headers: { ...baseHeaders(PUBLIC_CSP), ...headers },
  });
}

export function adminPage(body, { status = 200, headers = {} } = {}) {
  return new Response(body, {
    status,
    headers: {
      ...baseHeaders(ADMIN_CSP),
      "x-robots-tag": "noindex, nofollow",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

export function seeOther(location, headers = {}) {
  return new Response(null, { status: 303, headers: { location, ...headers } });
}

export function notFound() {
  return publicPage("<h1>Not found</h1>", { status: 404 });
}
