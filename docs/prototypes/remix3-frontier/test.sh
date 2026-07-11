#!/usr/bin/env bash
# Asserts the Remix 3 frontier mechanisms against both running hosts:
#   worker: http://localhost:8931  (wrangler dev — the hand-rolled Workers entry)
#   node:   http://localhost:8932  (the official-template node:http shape)
# Start them first (two background jobs; `A && B & C` would background the
# build and block the shell on the Node leg):
#   npm run build:client
#   npm run dev:worker &
#   npm run dev:node &
#
# What curl can prove, curl proves here. The browser-only behaviors (island
# hydration, anchor-driven frame reload without a document reload, history
# traversal) were verified interactively — see FINDINGS.md §5.

set -u

WORKER="http://localhost:8931"
NODE="http://localhost:8932"

# Readiness wait: wrangler and the Node host take a moment to boot, and a
# verbatim README follow shouldn't race them.
for _ in $(seq 1 30); do
  if curl -sf -o /dev/null "$WORKER/" && curl -sf -o /dev/null "$NODE/"; then
    break
  fi
  sleep 1
done

pass=0
fail=0

check() {
  local desc="$1"
  local result="$2" # "ok" or anything else
  if [ "$result" = "ok" ]; then
    pass=$((pass + 1))
    printf 'PASS  %s\n' "$desc"
  else
    fail=$((fail + 1))
    printf 'FAIL  %s\n' "$desc"
  fi
}

contains() { # haystack contains needle
  case "$1" in *"$2"*) echo ok ;; *) echo no ;; esac
}

not_contains() {
  case "$1" in *"$2"*) echo no ;; *) echo ok ;; esac
}

for name in worker node; do
  if [ "$name" = worker ]; then base="$WORKER"; else base="$NODE"; fi

  home=$(curl -sf "$base/")
  check "$name: GET / returns a body" "$([ -n "$home" ] && echo ok)"

  ct=$(curl -sf -o /dev/null -w '%{content_type}' "$base/")
  check "$name: / is text/html" "$(contains "$ct" "text/html")"

  check "$name: server-HTML prose present" "$(contains "$home" "This week in the crate")"
  check "$name: frame resolved INLINE during SSR (rmx:f marker)" "$(contains "$home" "<!-- rmx:f:")"
  check "$name: frame content in the initial document (pick 0)" "$(contains "$home" "Max Richter")"
  check "$name: pre-release plaque present + fenced flag" "$(contains "$home" 'data-pm-fenced="true"')"
  check "$name: plaque says excluded from benchmark numbers" "$(contains "$home" "excluded from every benchmark number")"
  check "$name: chrome slot present for the composed origin" "$(contains "$home" 'id="pm-chrome-slot"')"
  check "$name: client entry script tag present" "$(contains "$home" '/assets/entry.js')"
  check "$name: island hydration data serialized (rmx-data)" "$(contains "$home" '"moduleUrl":"/assets/counter-button.js"')"
  check "$name: island exportName resolves to the real export" "$(contains "$home" '"exportName":"CounterButton"')"
  check "$name: frame hydration data serialized" "$(contains "$home" '"src":"/frames/staff-pick?pick=0"')"
  check "$name: anchor carries rmx-target for frame reload" "$(contains "$home" 'rmx-target="picks"')"

  partial=$(curl -sf "$base/frames/staff-pick?pick=2")
  check "$name: frame partial serves standalone" "$([ -n "$partial" ] && echo ok)"
  check "$name: partial has the right pick" "$(contains "$partial" 'data-pick="2"')"
  check "$name: partial is a fragment, not a document" "$(not_contains "$partial" "<html")"

  jsoff=$(curl -sf "$base/?pick=1")
  check "$name: JS-off fallback: ?pick=1 full page renders pick 1" "$(contains "$jsoff" 'data-pick="1"')"

  entry_code=$(curl -s -o /dev/null -w '%{http_code}' "$base/assets/entry.js")
  check "$name: /assets/entry.js -> 200" "$([ "$entry_code" = 200 ] && echo ok)"

  island_code=$(curl -s -o /dev/null -w '%{http_code}' "$base/assets/counter-button.js")
  check "$name: /assets/counter-button.js -> 200" "$([ "$island_code" = 200 ] && echo ok)"

  notfound=$(curl -s -o /dev/null -w '%{http_code}' "$base/no-such-route")
  check "$name: unknown route -> 404" "$([ "$notfound" = 404 ] && echo ok)"
done

# Cross-host: the same app must emit identical HTML from both hosts, modulo
# the per-render rmx instance ids (random per process, meaningless to diff).
normalize() {
  sed -E 's/rmx:(f|h):[a-z0-9]+/rmx:\1:ID/g; s/"[fh][a-z0-9]{8,10}"/"ID"/g'
}
# Non-empty guards: equality on two empty bodies (both hosts down) must
# FAIL, not pass vacuously.
w=$(curl -sf "$WORKER/" | normalize)
n=$(curl -sf "$NODE/" | normalize)
check "cross-host: / identical modulo rmx instance ids" "$([ -n "$w" ] && [ "$w" = "$n" ] && echo ok)"

wp=$(curl -sf "$WORKER/frames/staff-pick?pick=3")
np=$(curl -sf "$NODE/frames/staff-pick?pick=3")
check "cross-host: frame partial byte-identical" "$([ -n "$wp" ] && [ "$wp" = "$np" ] && echo ok)"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
