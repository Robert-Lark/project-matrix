"use client";

import { useEffect, useRef } from "react";
import { readPlpCondition, sameCondition, type PlpCondition } from "../lib/plp-condition";

/**
 * The two things every strategy island owes the address bar, shared so all
 * three owe them identically.
 *
 * Both were found by the verification pass, and both are URL-as-receipt
 * defects (ADR-0004 §5) rather than cosmetics: a URL that does not describe
 * what is on screen is a receipt for a measurement that did not happen.
 */

/**
 * BACK AND FORWARD. Three islands called `history.pushState` and NOTHING
 * listened for `popstate` — so pressing Back moved the address bar while every
 * island's `useState` kept its last value, leaving the URL and the grid
 * describing different pages with nothing to reconcile them. Next's own docs
 * for this version (`node_modules/next/dist/docs/01-app/02-guides/single-page-applications.md`)
 * say raw `pushState` integrates with the router and updates the stack
 * "without reloading the page", so Back is a client-side restore, not a
 * document load — there is no reload to save us.
 *
 * The condition is re-derived with `readPlpCondition`, the same function the
 * server route uses, so a restored page cannot disagree with a served one
 * about what its URL means.
 *
 * The handler is held in a ref so the effect subscribes ONCE: an island's
 * callback closes over its own state and is a new function every render, and
 * a naive dependency on it would add and remove a listener on every keystroke
 * of work the page does.
 */
export function usePopstateCondition(onRestore: (condition: PlpCondition) => void): void {
  const handler = useRef(onRestore);
  handler.current = onRestore;
  useEffect(() => {
    const restore = () => {
      handler.current(readPlpCondition(new URLSearchParams(window.location.search)));
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
}

/**
 * THE ERROR FLOOR. When a client-side page change fails, fall back to the real
 * navigation the anchor would have done unaided — ADR-0005 §8's "the
 * anchor-link core stays JS-off functional", applied to the case where JS is
 * on and did not work.
 *
 * The cold arm has had this from the start. The two CACHE arms did not: they
 * push the new URL on click and render `data ?? initial`, so a failed fetch
 * silently painted the SERVED page's grid under the new page's URL — the page
 * looked fine and the receipt was a lie, which is worse than an error. A real
 * navigation to the URL already in the bar re-renders it server-side, and if
 * the data plane is still down the route's error boundary says so honestly.
 *
 * Fires once per failure (`failed` is the trigger, not the render count) so a
 * re-render cannot re-issue the navigation.
 */
export function useNavigateOnError(
  failed: boolean,
  href: string,
  condition?: PlpCondition,
): void {
  const done = useRef(false);
  useEffect(() => {
    if (!failed || done.current) return;
    done.current = true;
    navigateOrReload(href, condition);
  }, [failed, href, condition]);
}

/**
 * `assign()` when the target is somewhere else; `reload()` when it is where we
 * already are.
 *
 * `location.assign` ALWAYS adds a session-history entry, including for the URL
 * already in the bar. That matters on the Back path: a visitor presses Back to
 * `?run=abc`, the restore re-fetches, the fetch fails, and an unconditional
 * `assign` of the re-derived URL appends a duplicate entry — so the browser
 * moves FORWARD out of the history position the visitor just navigated to, and
 * Back is dead. The failure is invisible on the click path, where the target
 * genuinely is somewhere new, which is why it survived the first draft of both
 * hooks and of `PlpPlain`'s restore.
 *
 * Compares against `location.search` rather than the full href because
 * `plpHistoryUrl` emits a query-only URL, and the bare condition renders as
 * "?" where the browser shows an empty search.
 */
export function navigateOrReload(href: string, condition?: PlpCondition): void {
  // Conditions, not strings, for the same reason as above — a URL spelled
  // differently is still where we already are, and treating it as somewhere
  // else turns a `reload()` back into the `assign()` that appends a history
  // entry and moves the visitor forward off the page they are on.
  const shown = readPlpCondition(new URLSearchParams(window.location.search));
  const here =
    condition !== undefined
      ? sameCondition(shown, condition)
      : (window.location.search === "" ? "?" : window.location.search) === href;
  if (here) {
    window.location.reload();
    return;
  }
  window.location.assign(href);
}

/**
 * THE ADDRESS BAR MOVES WITH THE CONTENT, not with the click.
 *
 * The two cache arms used to `pushState` synchronously in the click handler.
 * The grid does not move synchronously: under `keepPreviousData` (and Apollo's
 * `previousData`) it keeps painting the PREVIOUS page until the new one
 * arrives, and `PlpArticle` derives its whole pagination — the window, the
 * `--current` marker, the Next target — from the payload it is handed. So for
 * the entire in-flight window the URL said page 2 while `aria-current="page"`
 * said page 1: a wrong receipt AND a wrong announcement, on a surface whose
 * subject is receipts.
 *
 * Worse, it compounded. The "2" link is still live during that window, so a
 * visitor who sees nothing change and clicks again pushes the SAME url a
 * second time — `pushState` adds an entry unconditionally (MDN: it "adds an
 * entry to the browser's session history stack", unlike a hash assignment,
 * which only adds one if the hash differs). Back then lands on the duplicate
 * and appears dead until pressed twice. On the cold profile the window is long
 * enough that this is the normal path, not an edge case.
 *
 * The cold arm never had either problem — it pushes after the payload commits
 * (`PlpPlain`'s `paginate`) — and ADR-0005 §1's discipline is that the arms
 * differ by exactly ONE architectural move. Differing in when the address bar
 * moves is a second one. This hook gives the cache arms the baseline's
 * behaviour: push when the displayed page is the requested page, and never
 * push a URL the bar already shows.
 */
export function usePushWhenSettled(
  condition: PlpCondition,
  href: string,
  settled: boolean,
): void {
  const navigated = useRef(false);
  useEffect(() => {
    if (!settled) return;
    // MOUNT LATCH. The seeded cache resolves on the first render, so `settled`
    // is true immediately — and the first draft of this hook therefore pushed
    // on MOUNT, for a page nobody navigated to. It compared strings, and the
    // served `?n=24&run=bench-abc&cache=cold` is not the string
    // `?cache=cold&run=bench-abc` even though it is the same condition, so
    // every bench-measured load of the two cache arms rewrote its own URL and
    // took TWO history entries where the cold baseline takes one. A second
    // architectural difference between the arms, introduced by the fix for the
    // first one, and caught only because a lens went looking.
    if (!navigated.current) {
      navigated.current = true;
      return;
    }
    // And compare CONDITIONS, not strings: a URL is not a canonical spelling
    // of its condition (param order, dropped defaults), so string equality
    // reports "different" for two spellings of the same served state.
    const shown = readPlpCondition(new URLSearchParams(window.location.search));
    if (sameCondition(shown, condition)) return;
    window.history.pushState(null, "", href);
  }, [condition, href, settled]);
}
