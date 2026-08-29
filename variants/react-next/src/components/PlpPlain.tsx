"use client";

import { useCallback, useRef, useState } from "react";
import type { PlpPage } from "@pm/data-contract";
import { PER_PAGE, PlpArticle } from "../lib/plp";
import { plpApiPath, plpHistoryUrl, type PlpCondition } from "../lib/plp-condition";
import { navigateOrReload, usePopstateCondition } from "./usePlpNavigation";

/**
 * Strategy 1 — **no caching (cold)**. ADR-0005 §1's judgment-free default:
 * "plain client fetch on render and on every interaction, edge tier bypassed".
 *
 * The data layer lives NOWHERE. There is no cache object, no library, and no
 * revisit shortcut: every page change is a fresh `fetch`, including a return
 * to a page this session already showed. That is the honest baseline the other
 * strategies are measured against, and it is deliberately the cheapest code on
 * the surface — cold's win is simplicity (ADR-0005 §6 cell 6).
 *
 * This same module serves BOTH the "No caching (cold)" and "Edge cache — KV"
 * presets: they are the same shipped code and differ only by `?cache=`, which
 * rides in the condition and reaches the Worker. That is what makes cell 3 the
 * purest single-variable comparison on the site — the serving tier flips and
 * nothing else does.
 *
 * WHAT THE FIRST PAINT IS, AND WHAT THAT COSTS THE PUBLISHED CELLS. The grid
 * is SERVER-rendered from the tray the route already fetched, on every
 * strategy, and the initial payload is handed to this island as a prop.
 * ADR-0005 §1 describes cold as a client fetch "on render", and §6 cell 4
 * contrasts "finished HTML in one trip" against "shell-then-data in two" — a
 * shape the canonical markup contract forbids here, because the served DOM of
 * every variant must equal the PLP master (ADR-0003 §1) and a shell does not.
 * The contract wins; the strategy axis moves entirely onto the interaction
 * path, where ADR-0005 §3 already put the client-warmth claim. Recorded as a
 * real consequence rather than absorbed silently: cell 4's round-trip framing
 * no longer separates these arms from the loaders arm on FIRST load.
 */
/**
 * One paginate request, from click to committed state — extracted from the
 * component so it can be DRIVEN by a test. The ordering rule below is the
 * whole reason it exists as a function: React state and `fetch` are not
 * reachable from `renderToStaticMarkup`, so an inline version of this would be
 * an untested claim about the arm the benchmark measures.
 *
 * `isCurrent` answers "is this still the newest click?". Every commit path —
 * success AND the navigation fallback — is gated on it.
 */
export async function paginate(
  next: PlpCondition,
  href: string,
  isCurrent: () => boolean,
  io: {
    fetchTray: (path: string) => Promise<Response>;
    commit: (condition: PlpCondition, payload: PlpPage) => void;
    push: (href: string) => void;
    navigate: (href: string) => void;
  },
): Promise<void> {
  const path = plpApiPath(next);
  try {
    // No cache lookup, by design — this is the arm whose whole claim is that
    // it has nowhere to look.
    const res = await io.fetchTray(path);
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
    const payload = (await res.json()) as PlpPage;
    // A superseded response is dropped rather than painted: it already cost
    // its bytes, and the byte cell is what this arm is measured on, so nothing
    // is hidden by not rendering it.
    if (!isCurrent()) return;
    io.commit(next, payload);
    io.push(href);
  } catch {
    // A failed enhancement falls back to the real navigation the anchor would
    // have done unaided — the JS-off core is the floor, never a dead click
    // (ADR-0005 §8). Superseded failures do NOT navigate: a stale error must
    // not yank the visitor off the page they asked for last.
    if (!isCurrent()) return;
    io.navigate(href);
  }
}

export function PlpPlain({
  initial,
  condition,
}: {
  initial: PlpPage;
  condition: PlpCondition;
}) {
  const [state, setState] = useState({ condition, payload: initial });

  /**
   * Which request is the newest. Without it, two quick paginate clicks race
   * and the LAST RESPONSE wins rather than the last click — so clicking 2 then
   * 3 can land on page 2, with the URL pushed to match. Not a caching
   * shortcut, and not a thumb on the scale: the fetch still happens every
   * time, which is this arm's whole claim. It is here because the other two
   * arms get request ordering FREE from their libraries (both re-key on the
   * condition and render whatever the current key holds), and leaving cold
   * without it would make the baseline look worse for a reason that is not its
   * data strategy — rigging in the punishing direction, which ADR-0001 §9
   * forbids exactly as much as the flattering kind.
   */
  const latest = useRef(0);

  const goToPage = useCallback(
    (page: number) => {
      const next: PlpCondition = { ...state.condition, page };
      const href = plpHistoryUrl(next, PER_PAGE);
      const ticket = ++latest.current;
      void paginate(next, href, () => ticket === latest.current, {
        fetchTray: (path) => fetch(path, { headers: { accept: "application/json" } }),
        commit: (nextCondition, payload) => setState({ condition: nextCondition, payload }),
        push: (url) => window.history.pushState(null, "", url),
        navigate: navigateOrReload,
      });
    },
    [state.condition],
  );

  // Back/Forward. This arm has no cache, so a restore is a fetch like any
  // other — the same `paginate` path, with `push` a no-op because the browser
  // has already moved the address bar.
  usePopstateCondition(
    useCallback((restored: PlpCondition) => {
      const ticket = ++latest.current;
      void paginate(restored, plpHistoryUrl(restored, PER_PAGE), () => ticket === latest.current, {
        fetchTray: (path) => fetch(path, { headers: { accept: "application/json" } }),
        commit: (nextCondition, payload) => setState({ condition: nextCondition, payload }),
        push: () => {},
        // `navigateOrReload`, not `assign`: on the Back path the browser is
        // ALREADY at this URL, and `assign` would append a duplicate entry —
        // moving forward out of the position the visitor just navigated to.
        navigate: navigateOrReload,
      });
    }, []),
  );

  return (
    <PlpArticle payload={state.payload} n={state.condition.n} onSelectPage={goToPage} />
  );
}
