#!/usr/bin/env bash

set -euo pipefail

# test.sh ======================================================================
# What it does:
# - Waits for the spike dev server (npm run dev) to answer
# - Asserts the ADR-0004 composition behaviors end to end:
#   path-prefix dispatch via service bindings, prefix-nested static assets,
#   HTMLRewriter chrome injection into #pm-chrome-slot, non-HTML passthrough,
#   trailing-slash redirects through a binding, request-forwarding fidelity,
#   and the assets-first bypass on the front Worker's own home page
# - Probes (without failing) whether an assets-ONLY Worker can serve through
#   a service binding

## Configuration ===============================================================

BASE_URL="${BASE_URL:-http://localhost:8787}"
FAILURES=0

## Helpers (each used 3+ times below) ==========================================

expect_status() {
    # expect_status <path> <status> <description>
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}$1")
    if [ "${code}" = "$2" ]; then
        echo "PASS: $3"
    else
        echo "FAIL: $3 — expected HTTP $2 for $1, got ${code}" >&2
        FAILURES=$((FAILURES + 1))
    fi
}

expect_contains() {
    # expect_contains <path> <fixed-string> <description>
    local body
    body=$(curl -s "${BASE_URL}$1")
    if echo "${body}" | grep -qF "$2"; then
        echo "PASS: $3"
    else
        echo "FAIL: $3 — expected '$2' in body of $1" >&2
        FAILURES=$((FAILURES + 1))
    fi
}

expect_not_contains() {
    # expect_not_contains <path> <fixed-string> <description>
    local body
    body=$(curl -s "${BASE_URL}$1")
    if echo "${body}" | grep -qF "$2"; then
        echo "FAIL: $3 — did NOT expect '$2' in body of $1" >&2
        FAILURES=$((FAILURES + 1))
    else
        echo "PASS: $3"
    fi
}

## Script ======================================================================

# Wait for the dev server to answer (npm run dev must be running)
echo "Waiting for dev server at ${BASE_URL}"
ATTEMPTS=0
until curl -s -o /dev/null "${BASE_URL}/"; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ "${ATTEMPTS}" -ge 30 ]; then
        echo "Error: dev server not reachable after 30s — run 'npm run dev' first" >&2
        exit 1
    fi
    sleep 1
done
echo "Dev server is up"

echo ""
echo "— Front Worker: own assets (home) —"
expect_status "/" 200 "home page served"
expect_not_contains "/" "data-pm-chrome" \
    "home bypasses the front script (assets-first): no chrome injected"

echo ""
echo "— Static variant through service binding —"
expect_status "/vanilla/pdp/1/" 200 "prefix-nested asset served via binding"
expect_contains "/vanilla/pdp/1/" "vanilla variant — pdp 1" \
    "correct nested asset content"
expect_contains "/vanilla/pdp/1/" "data-pm-chrome" \
    "chrome injected into static variant HTML"
expect_contains "/vanilla/pdp/1/" 'href="/ssr/pdp/1/"' \
    "switcher anchor rewrites the variant path segment"
expect_status "/vanilla/pdp/1" 307 \
    "html_handling trailing-slash redirect passes through the binding"

REDIRECT_URL=$(curl -s -o /dev/null -w '%{redirect_url}' "${BASE_URL}/vanilla/pdp/1")
if echo "${REDIRECT_URL}" | grep -qF "/vanilla/pdp/1/"; then
    echo "PASS: redirect Location keeps the variant prefix (${REDIRECT_URL})"
else
    echo "FAIL: redirect Location lost the prefix: '${REDIRECT_URL}'" >&2
    FAILURES=$((FAILURES + 1))
fi

echo ""
echo "— Non-HTML passthrough (content-type guard) —"
expect_status "/vanilla/styles.css" 200 "CSS asset served via binding"
expect_contains "/vanilla/styles.css" "passthrough probe" "CSS content intact"
expect_not_contains "/vanilla/styles.css" "data-pm-chrome" \
    "CSS untouched by HTMLRewriter"

echo ""
echo "— SSR variant through service binding —"
expect_status "/ssr/pdp/1/" 200 "SSR variant reachable via binding"
expect_contains "/ssr/pdp/1/?n=240&cache=warm" "n=240" \
    "query param n forwarded intact"
expect_contains "/ssr/pdp/1/?n=240&cache=warm" "cache=warm" \
    "query param cache forwarded intact"
expect_contains "/ssr/pdp/1/" 'data-echo-path>/ssr/pdp/1/' \
    "path forwarded to SSR worker unmodified"
expect_contains "/ssr/pdp/1/" "data-pm-chrome" \
    "chrome injected into SSR variant HTML"

SSR_HEADER=$(curl -s -o /dev/null -w '%header{x-pm-ssr}' "${BASE_URL}/ssr/pdp/1/")
if [ "${SSR_HEADER}" = "1" ]; then
    echo "PASS: upstream response header x-pm-ssr survives front + rewriter"
else
    echo "FAIL: x-pm-ssr header missing or wrong: '${SSR_HEADER}'" >&2
    FAILURES=$((FAILURES + 1))
fi

echo ""
echo "— Front 404 for unknown prefixes —"
expect_status "/nope/x" 404 "unknown variant prefix rejected by front script"

echo ""
echo "— PROBE (informational, never fails the suite) —"
# Assets-only Worker (no script) as a service-binding target. Either outcome
# is a documented finding; the fallback pattern is variant-static's one-line
# ASSETS forwarder script.
PROBE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/astro/editorial/")
PROBE_BODY=$(curl -s "${BASE_URL}/astro/editorial/")
if echo "${PROBE_BODY}" | grep -qF "assets-only variant"; then
    echo "PROBE RESULT: assets-only Worker IS servable through a service binding (HTTP ${PROBE_STATUS})"
else
    echo "PROBE RESULT: assets-only Worker NOT served through a service binding (HTTP ${PROBE_STATUS})"
    echo "PROBE BODY (first 200 chars): ${PROBE_BODY:0:200}"
fi

echo ""
if [ "${FAILURES}" -gt 0 ]; then
    echo "${FAILURES} assertion(s) FAILED" >&2
    exit 1
fi
echo "All assertions passed"
