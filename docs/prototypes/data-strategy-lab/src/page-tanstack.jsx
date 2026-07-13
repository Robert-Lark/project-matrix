/**
 * Strategy: client cache — TanStack Query v5 (@tanstack/react-query), the
 * REST-native client cache. Same page as plain; ONLY the data layer differs.
 *
 * Published config, not silent defaults (the fairness rule): staleTime is
 * 5 minutes — the production-defensible choice for a catalog whose only
 * volatile field is a price aggregate. Within a measured interaction
 * sequence (seconds), a revisited query key is fresh-in-cache: zero
 * requests, zero bytes. The library DEFAULT is staleTime 0 ("consider
 * cached data as stale" — tanstack.com important-defaults): instant paint
 * from cache plus a background refetch. `?stale=0` runs that default so
 * the difference is a demonstrated fact, not a tuning secret.
 */
import { createRoot } from "react-dom/client";
import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  keepPreviousData,
} from "@tanstack/react-query";
import { Grid } from "./grid.jsx";
import { readKnobs, plpUrl } from "./knobs.js";

const knobs = readKnobs();
const staleTime = knobs.stale === "" ? 5 * 60 * 1000 : Number(knobs.stale);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime } },
});

function Plp() {
  const [page, setPage] = useState(1);
  const { data, isFetching } = useQuery({
    queryKey: ["plp", { n: knobs.n, cache: knobs.cache, run: knobs.run, page }],
    queryFn: () => fetch(plpUrl(knobs, page)).then((r) => r.json()),
    placeholderData: keepPreviousData,
  });

  return (
    <Grid
      data={data}
      page={page}
      status={!data || isFetching ? "loading" : "settled"}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => p + 1)}
    />
  );
}

createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <Plp />
  </QueryClientProvider>,
);
