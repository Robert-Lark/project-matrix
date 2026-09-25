// Response helpers + the security-header floor (ADR-0009 §5, §7).
//
// Public pages: script-src 'self' keeps injected-markup XSS dead even though
// style-src allows inline styles (Shiki's highlighted spans carry style
// attributes — that is what 'unsafe-inline' buys, and scripts stay locked).
// Admin pages add connect-src (autosave fetch) and frame-src 'self' (the
// live preview iframe), and are never indexable.

// The FIVE characters, like the repo's six other escapers (reference
// lib.mjs, switcher chrome.ts, front tokens-source.mjs, the vanilla, htmx
// and astro renderers). Until the workers-hardening unit (2026-09-25) this
// one skipped the single quote; every call site was in a double-quoted
// attribute or text content (audited 2026-08-29 and again 2026-09-25 —
// no `='${…}'` in workers/blog/src), so nothing was exploitable, and it is
// aligned as defense in depth: the next single-quoted attribute a template
// grows is not a security review.
/** @param {unknown} text */
export function esc(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

/** @param {string} csp @returns {Record<string, string>} */
function baseHeaders(csp) {
  return {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": csp,
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  };
}

/** @typedef {{ status?: number, headers?: Record<string, string> }} ResponseOptions */
/** @param {string} body @param {ResponseOptions} [options] */
export function publicPage(body, { status = 200, headers = {} } = {}) {
  return new Response(body, {
    status,
    headers: { ...baseHeaders(PUBLIC_CSP), ...headers },
  });
}

/** @param {string} body @param {ResponseOptions} [options] */
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

/** @param {unknown} data @param {ResponseOptions} [options] */
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

/** @param {string} location @param {Record<string, string>} [headers] */
export function seeOther(location, headers = {}) {
  return new Response(null, { status: 303, headers: { location, ...headers } });
}

export function notFound() {
  return publicPage("<h1>Not found</h1>", { status: 404 });
}
