"use client";

import { useCallback, useState } from "react";
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";
import { ApolloProvider, useQuery } from "@apollo/client/react";
import { RestLink } from "apollo-link-rest";
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
  plpHistoryUrl,
  type PlpCondition,
} from "../lib/plp-condition";

/**
 * The MISAPPLICATION EXHIBIT — Apollo Client 4 + `apollo-link-rest` over the
 * REST tray (ADR-0005 §7). FENCED: labeled on-surface by the plaque the route
 * renders, excluded from the four-strategy cells by
 * `SURFACE_CONTROLS.plp.strategies[4].fenced`, and never a reading-table
 * column.
 *
 * It is deliberately the WRONG tool and deliberately NOT a strawman: this is
 * the Apollo ecosystem's own documented REST path, configured the way its docs
 * configure it. It does NOT hold the lead's published window — Apollo ships no
 * `staleTime` at all, so its cache is unbounded where the lead's is five
 * published minutes (see APOLLO_CACHE_WINDOW below; an earlier draft of THIS
 * HEADER claimed parity, and a header is the first thing another variant's
 * author reads). What is held equal is the POLICY SHAPE — cache-first, seeded
 * from the server, no hand-rolled TTL on either side — so the comparison is a
 * library one rather than a tuning one. The claim is "the wrong tool works —
 * you pay in bytes and machinery", which is only evidence if the exhibit is
 * fair.
 *
 * THE MACHINERY, ITEMISED, because it IS the exhibit. A REST endpoint that
 * `PlpPlain` reads with one `fetch` needs here: a GraphQL document describing
 * a shape the server never had; a `@rest` directive to map it back onto the
 * URL; a `@type(name:)` on every nested object so the normalizing cache knows
 * what it is holding; and `__typename` stamped through the server's payload
 * before it can be written into that cache at all (`withTypenames` below).
 * None of that buys anything the plain arm lacks.
 *
 * A REAL PACKAGING DEFECT, MEASURED THIS SESSION, not recalled:
 * `apollo-link-rest@0.10.0-rc.2` declares `"type": "module"` with
 * `"main": "bundle.umd.js"` and NO `"exports"` map, so Node's ESM resolver
 * picks the UMD bundle and it throws `TypeError: Cannot read properties of
 * undefined (reading 'utilities')` on import. Its ESM entry (`index.js`, named
 * only by `"module"`) then uses extensionless relative imports (`./restLink`),
 * which Node ESM also refuses. The package is loadable only through a bundler
 * that honours `module` AND resolves extensionless paths — Next's does; plain
 * `node` does not, and neither does vitest without `ssr.noExternal`, which is
 * why `vitest.config.ts` carries that one line. ADR-0005 §7 predicted exactly
 * this class ("a pre-1.0 RC whose package entry broke the build once").
 */

/** The document. `path` is passed whole rather than reassembled from
 *  `{args.n}`/`{args.page}` fragments so this file cannot become a second
 *  opinion about what URL a condition maps to — `plpApiPath` stays the one
 *  derivation, exactly as it is for the other two strategies. */
const PLP_QUERY = gql`
  query Plp($path: String!) {
    plp(path: $path) @rest(type: "PlpPage", path: "{args.path}") {
      page
      perPage
      total
      totalPages
      items @type(name: "ReleaseSummary") {
        id
        slug
        title
        artist
        format
        year
        numForSale
        genres
        styles
        cover @type(name: "Image") {
          src
          width
          height
          alt
        }
        priceFrom @type(name: "Price") {
          amount
          currency
        }
      }
      facets @type(name: "PlpFacets") {
        genres @type(name: "FacetBucket") {
          value
          count
        }
        styles @type(name: "FacetBucket") {
          value
          count
        }
        formats @type(name: "FacetBucket") {
          value
          count
        }
      }
    }
  }
`;

/** Stamp the `__typename`s the normalizing cache needs onto the server's
 *  plain tray. This function exists ONLY because a GraphQL cache is being
 *  pointed at data that was never GraphQL — it is the exhibit's cost made
 *  literal, and it is why the plaque says what it says. */
function withTypenames(payload: PlpPage): Record<string, unknown> {
  const bucket = (b: { value: string; count: number }) => ({
    __typename: "FacetBucket",
    value: b.value,
    count: b.count,
  });
  return {
    plp: {
      __typename: "PlpPage",
      page: payload.page,
      perPage: payload.perPage,
      total: payload.total,
      totalPages: payload.totalPages,
      items: payload.items.map((s) => ({
        __typename: "ReleaseSummary",
        id: s.id,
        slug: s.slug,
        title: s.title,
        artist: s.artist,
        format: s.format,
        year: s.year,
        numForSale: s.numForSale,
        genres: s.genres,
        styles: s.styles,
        cover: { __typename: "Image", ...s.cover },
        priceFrom:
          s.priceFrom == null ? null : { __typename: "Price", ...s.priceFrom },
      })),
      facets: {
        __typename: "PlpFacets",
        genres: payload.facets.genres.map(bucket),
        styles: payload.facets.styles.map(bucket),
        formats: payload.facets.formats.map(bucket),
      },
    },
  };
}

/** Build the client the island mounts, with the cache primed for the served
 *  condition. Exported so the pre-merge guard can assert the SEED directly:
 *  the render path keeps `?? initial` as a FLOOR, which would otherwise mask a
 *  cache that never held anything — and "the exhibit's UX matches the lead"
 *  (ADR-0005 §7) is a claim about the cache, not about the fallback. */
export function createSeededApolloClient(
  condition: PlpCondition,
  initial: PlpPage,
): ApolloClient {
  const cache = new InMemoryCache();
  cache.writeQuery({
    query: PLP_QUERY,
    variables: { path: plpApiPath(condition) },
    data: withTypenames(initial),
  });
  return new ApolloClient({
    // Same-origin: the front Worker dispatches /api/* to the edge Worker
    // (workers/front/src/index.js:83-86), so an empty base plus the tray path
    // is the whole endpoint.
    link: new RestLink({ uri: "" }),
    cache,
    // `cache-first` on watched queries too, so the hook and the client agree.
    // NOT "the lead's published window": Apollo ships no staleTime equivalent
    // (see APOLLO_CACHE_WINDOW below) — this comment claimed parity until the
    // verification pass caught it, and the difference is now stated rather
    // than asserted away.
    defaultOptions: { watchQuery: { fetchPolicy: "cache-first" } },
    ssrMode: typeof window === "undefined",
  });
}

/** Exported for the guard: the document the seed is written under and read
 *  back through must be the same one. */
export { PLP_QUERY };

/**
 * The EXACT options the component hands `useQuery`. Same reason as the lead's
 * `plpQueryOptions`: `APOLLO_CACHE_WINDOW` below merely DESCRIBES the policy,
 * and a literal-vs-literal assertion on a description proves nothing about the
 * call — swapping the hook to `network-only` (which would make the exhibit
 * fetch on every render and lose the "the wrong tool still works" claim) passed
 * every assertion until this function existed. Found by sabotage.
 */
export function plpApolloQueryOptions(condition: PlpCondition) {
  return {
    variables: { path: plpApiPath(condition) },
    // `cache-first` is Apollo's documented default: serve from the cache when
    // it holds the query, go to network only when it does not.
    fetchPolicy: "cache-first" as const,
  };
}

export function PlpApolloInner({
  initial,
  condition,
}: {
  initial: PlpPage;
  condition: PlpCondition;
}) {
  const [current, setCurrent] = useState(condition);
  const { data, previousData, error } = useQuery(
    PLP_QUERY,
    plpApolloQueryOptions(current),
  );

  const goToPage = useCallback(
    (page: number) => {
      setCurrent({ ...current, page });
      // The push happens when the DATA lands, not here — see
      // usePushWhenSettled. Pushing on click made the URL and the
      // `aria-current` marker disagree for the whole in-flight window.
    },
    [current],
  );

  // The same three duties the lead owes (see usePlpNavigation): restore on
  // Back/Forward, fall back to a real navigation on failure rather than
  // painting the served page under the new page's URL, and move the address
  // bar when the CONTENT moves rather than when the click happens.
  usePopstateCondition(setCurrent);
  useNavigateOnError(error !== undefined, plpHistoryUrl(current, PER_PAGE), current);

  // `previousData` is Apollo's own documented equivalent of the lead's
  // `keepPreviousData`: while a genuinely new page is in flight, keep the last
  // grid on screen instead of snapping back. Without it the exhibit would
  // flash the SERVED page's data mid-navigation while the lead did not — an
  // asymmetry that would punish the exhibit for something that is not its data
  // layer, which ADR-0005 §7's "not a strawman rig" forbids.
  const payload =
    (data as { plp?: PlpPage } | undefined)?.plp ??
    (previousData as { plp?: PlpPage } | undefined)?.plp ??
    initial;

  // The address bar moves when the CONTENT does — the cold arm's behaviour,
  // and the third duty of usePlpNavigation. Declared here because it needs
  // `payload`, which is what is actually on screen.
  usePushWhenSettled(current, plpHistoryUrl(current, PER_PAGE), payload.page === current.page);

  return <PlpArticle payload={payload} n={current.n} onSelectPage={goToPage} />;
}

export function PlpApollo({
  initial,
  condition,
}: {
  initial: PlpPage;
  condition: PlpCondition;
}) {
  const [client] = useState(() => createSeededApolloClient(condition, initial));

  return (
    <ApolloProvider client={client}>
      <PlpApolloInner initial={initial} condition={condition} />
    </ApolloProvider>
  );
}

/**
 * THE ONE PLACE THE TWO CLIENT CACHES GENUINELY DIFFER, stated rather than
 * papered over.
 *
 * The lead publishes `staleTime: 5min` (ADR-0005 §4) because TanStack Query's
 * default would refetch a revisit in the background and quietly erase the
 * strategy's headline win. **Apollo has no such knob.** Verified this session
 * rather than recalled: `grep -rl staleTime` across the installed
 * `@apollo/client@4.2.12` returns NOTHING. Its cache window under
 * `cache-first` is unbounded — the entry lives until something evicts it.
 *
 * So this exhibit does NOT hold "the same published window"; an earlier draft
 * of this file exported a constant claiming it did, asserted it equal to the
 * lead's, and wired it to nothing — a true statement with no mechanism under
 * it, which is the exact class this repo keeps paying for.
 *
 * Manufacturing a 5-minute window in Apollo (a `nextFetchPolicy` dance, or
 * timed cache eviction) was rejected: ADR-0005 §4's fairness rule is that
 * "idiomatic, documented, published configuration is fair; hand-tuning is
 * configuration that exists only to win a cell", and a hand-rolled TTL is
 * hand-tuning in the flattering direction. The honest exhibit runs the
 * library's documented default and SAYS the window is different.
 *
 * Consequence for the cells, so nobody has to rediscover it: on the revisit
 * sequence both arms answer from cache, but they are not the same claim — the
 * lead's is "free for five minutes, by published config", the exhibit's is
 * "free until eviction, by library default".
 */
export const APOLLO_CACHE_WINDOW = {
  policy: "cache-first" as const,
  /** Apollo exposes no staleTime equivalent; null is that absence, stated. */
  staleTimeMs: null,
  /** The lead's, carried here only so the guard can assert they DIFFER. */
  leadStaleTimeMs: PLP_STALE_TIME_MS,
};
