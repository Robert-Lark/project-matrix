#!/usr/bin/env bash

set -euo pipefail

# dev.sh =======================================================================
# What it does:
# - Starts the four spike Workers as SEPARATE `wrangler dev` processes so the
#   local dev registry connects the service bindings between them
# - Waits until the front Worker answers, then keeps all four in the foreground
#
# Why not `wrangler dev -c a -c b ...` (single process, `npm run dev:single-process`)?
# Verified defect in that mode (wrangler 4.107.0, latest as of 2026-07-06):
# static ASSETS served through a service binding return a bare 500
# (html_handling redirects survive, asset content does not). Cross-process
# mode serves them correctly — see FINDINGS.md.

## Configuration ===============================================================

FRONT_PORT="${FRONT_PORT:-8787}"
STATIC_PORT=8788
NOSCRIPT_PORT=8789
SSR_PORT=8790
LOG_DIR="${LOG_DIR:-.wrangler/dev-logs}"
PIDS=()

## Script ======================================================================

if ! command -v npx > /dev/null; then
    echo "Error: npx not found — install Node.js first" >&2
    exit 1
fi

if [ ! -d node_modules ]; then
    echo "Error: node_modules missing — run 'npm install' first" >&2
    exit 1
fi

mkdir -p "${LOG_DIR}"

# Kill every child dev process when this script exits, however it exits.
trap 'echo "Stopping workers"; kill "${PIDS[@]}" 2> /dev/null || true' EXIT

# Each process needs a distinct --port AND --inspector-port (both collide on
# their defaults otherwise). Variants start first so the front Worker's
# bindings find them in the dev registry.
echo "Starting variant-static on :${STATIC_PORT} (logs: ${LOG_DIR}/variant-static.log)"
npx wrangler dev -c variant-static/wrangler.jsonc \
    --port "${STATIC_PORT}" --inspector-port 9231 \
    > "${LOG_DIR}/variant-static.log" 2>&1 &
PIDS+=($!)

echo "Starting variant-static-noscript on :${NOSCRIPT_PORT} (logs: ${LOG_DIR}/variant-static-noscript.log)"
npx wrangler dev -c variant-static-noscript/wrangler.jsonc \
    --port "${NOSCRIPT_PORT}" --inspector-port 9232 \
    > "${LOG_DIR}/variant-static-noscript.log" 2>&1 &
PIDS+=($!)

echo "Starting variant-ssr on :${SSR_PORT} (logs: ${LOG_DIR}/variant-ssr.log)"
npx wrangler dev -c variant-ssr/wrangler.jsonc \
    --port "${SSR_PORT}" --inspector-port 9233 \
    > "${LOG_DIR}/variant-ssr.log" 2>&1 &
PIDS+=($!)

echo "Starting front on :${FRONT_PORT} (logs: ${LOG_DIR}/front.log)"
npx wrangler dev -c front/wrangler.jsonc \
    --port "${FRONT_PORT}" --inspector-port 9230 \
    > "${LOG_DIR}/front.log" 2>&1 &
PIDS+=($!)

# Wait for the composed origin to answer
echo "Waiting for the front Worker at http://localhost:${FRONT_PORT}"
ATTEMPTS=0
until curl -s -o /dev/null "http://localhost:${FRONT_PORT}/"; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ "${ATTEMPTS}" -ge 45 ]; then
        echo "Error: front Worker not reachable after 45s — check ${LOG_DIR}/*.log" >&2
        exit 1
    fi
    sleep 1
done

echo "Composed origin ready: http://localhost:${FRONT_PORT} (Ctrl-C to stop all four workers)"
wait
