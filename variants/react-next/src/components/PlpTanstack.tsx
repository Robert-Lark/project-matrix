"use client";

import { useCallback, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
  useQuery,
} from "@tanstack/react-query";
import type { PlpPage } from "@pm/data-contract";
import { PER_PAGE, PlpArticle } from "../lib/plp";
import {
  useNavigateOnError,
  usePopstateCondition,
  usePushWhenSettled,
} from "./usePlpNavigation";
import {
  PLP_STALE_TIME_MS,
  plpApiPath,
  plpCacheKey,
  plpHistoryUrl,
  type PlpCondition,
} from "../lib/plp-condition";

/**
 * Strategy 2 — **client cache, TanStack Query v5** (ADR-0005 §1's lead).
 *
 * The data layer lives in the BROWSER. Same page, same markup, same edge
 * bypass as `PlpPlain`; the only architectural move is that a query cache now
 * sits between the component and the network. That is the one-variable
 * discipline of ADR-0005 §1, and it is what makes cells 1 and 2 readable: on a
 * first visit this arm pays its library bytes and wins nothing (cell 1), and
 * on a revisit it answers from memory (cell 2).
 *
 * THE CONFIG IS PUBLISHED, NOT DEFAULT (ADR-0005 §4). `staleTime` is the
 * shared `PLP_STALE_TIME_MS` — five minutes — and the reason is measured, not
 * stylistic: under the library default (`staleTime: 0`, "consider cached data
 * as stale") a revisit paints instantly from cache but STILL refetches in the
 * background, which the prototype measured at 1 request / 11.6 KB. "Revisit =
 * 0 bytes" is only true of a stated config, so the config is stated — here, in
 * the ADR, and in the cell copy.
 *
 * SEEDED, NOT REFETCHED. The QueryClient is created once per mount and
 * primed with the server's tray under the served condition's key, so the very
 * first client render reads from cache rather than firing a request the
 * server already paid for.
 *
 * ASSERTED, not described. An earlier draft of this paragraph said "Measured:
 * `useQuery` returns `isPending: false, isFetching: false` during SSR", read
 * off a throwaway probe that no longer existed — and by this file's own
 * reasoning that is worth nothing: `renderToStaticMarkup` runs no effects, so
 * NO arm fires a request during it and an `isFetching` reading proves nothing
 * about a real mount either way. What decides whether a mount refetches in
 * the background is whether the cached entry is STALE, and the guard asserts
 * exactly that: not stale under the published window, stale under the
 * library's default — the difference ADR-0005 §4 exists to record.
 *
 * WHAT CANNOT BE MEASURED YET, STATED PLAINLY. This arm's headline cell — "a
 * client cache makes revisits free (0 requests / 0 bytes)" — is only
 * measurable through a named interaction-registry entry split into an
 * unmeasured priming prefix and a measured step (ADR-0005 §3). `INTERACTIONS`
 * (`tools/bench-runner/src/collect.ts:33`) is still the flat
 * `(page) => Promise<void>` shape and holds none of the six planned PLP ids.
 * The code below is built to that design so the entry has something real to
 * drive; the NUMBER is not approximated and the cell is not published.
 */
/** The cache key one condition occupies. Exported so the pre-merge guard can
 *  assert the SEED against the exact key the component reads — a guard that
 *  rebuilt the key itself would prove only that two copies agree. */
export function plpQueryKey(condition: PlpCondition): readonly unknown[] {
  return ["plp", plpCacheKey(condition)];
}

/** Build the client the island mounts, primed with the server's tray under the
 *  served condition's key. Exported for the same reason as the key: the seed is
 *  the whole mechanism behind "a revisit costs 0 requests", and the render path
 *  keeps `?? initial` as a FLOOR, which would silently mask a broken seed. The
 *  guard asserts this function's output directly. */
export function createSeededQueryClient(
  condition: PlpCondition,
  initial: PlpPage,
): QueryClient {
  const qc = new QueryClient({
    defaultOptions: { queries: { staleTime: PLP_STALE_TIME_MS, retry: false } },
  });
  qc.setQueryData(plpQueryKey(condition), initial);
  return qc;
}

/**
 * The EXACT options the component hands `useQuery`, as a function, so the
 * published config is checkable rather than merely written down. The seed leg
 * proves the client's DEFAULT `staleTime`; the component overrides it
 * per-query, so a per-query `staleTime: 0` — the library default whose
 * background refetch ADR-0005 §4 exists to rule out — passed every assertion
 * until this function existed (found by sabotage).
 */
export function plpQueryOptions(condition: PlpCondition) {
  return {
    queryKey: plpQueryKey(condition),
    staleTime: PLP_STALE_TIME_MS,
    // The previous page's grid stays on screen while a genuinely new one is in
    // flight, so a paginate click never blanks the catalogue. Presentation, not
    // caching: it changes what is shown DURING a fetch, not whether one happens.
    placeholderData: keepPreviousData,
  };
}

export function PlpTanstackInner({
  initial,
  condition,
}: {
  initial: PlpPage;
  condition: PlpCondition;
}) {
  const [current, setCurrent] = useState(condition);

  const query = useQuery({
    ...plpQueryOptions(current),
    queryFn: async () => {
      const res = await fetch(plpApiPath(current), {
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error(`GET ${plpApiPath(current)} -> ${res.status}`);
      return (await res.json()) as PlpPage;
    },
  });

  const goToPage = useCallback(
    (page: number) => {
      setCurrent({ ...current, page });
      // The push happens when the DATA lands, not here — see
      // usePushWhenSettled. Pushing on click made the URL and the
      // `aria-current` marker disagree for the whole in-flight window.
    },
    [current],
  );

  // `data` is present from the first render (seeded key) and on every later
  // cache hit; `initial` is the floor for the one frame a brand-new key has
  // nothing at all, which `keepPreviousData` otherwise covers.
  const displayed = query.data ?? initial;

  // Back/Forward: re-derive the condition the browser restored, or the grid
  // and the address bar describe different pages.
  usePopstateCondition(setCurrent);
  // The address bar moves when the CONTENT does — the cold arm's behaviour.
  usePushWhenSettled(current, plpHistoryUrl(current, PER_PAGE), displayed.page === current.page);
  // A failed page change falls back to the real navigation, instead of
  // painting the served page's grid under the new page's URL.
  useNavigateOnError(query.isError, plpHistoryUrl(current, PER_PAGE), current);

  return <PlpArticle payload={displayed} n={current.n} onSelectPage={goToPage} />;
}

export function PlpTanstack({
  initial,
  condition,
}: {
  initial: PlpPage;
  condition: PlpCondition;
}) {
  const [client] = useState(() => createSeededQueryClient(condition, initial));

  return (
    <QueryClientProvider client={client}>
      <PlpTanstackInner initial={initial} condition={condition} />
    </QueryClientProvider>
  );
}
