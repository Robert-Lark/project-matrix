/**
 * The fenced misapplication exhibit: Apollo Client 4 driving the same REST
 * tray through apollo-link-rest (the Apollo ecosystem's documented REST
 * path — 0.10.0-rc.2, a pre-1.0 release candidate; that status is itself
 * part of the fit evidence). Same page, same interactions as the other
 * client strategies — the exhibit's claim is measured bytes and machinery,
 * never a deliberately broken UX.
 */
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ApolloClient, InMemoryCache, gql } from "@apollo/client";
import { ApolloProvider, useQuery } from "@apollo/client/react";
// Subpath import of the package's ESM entry: its `main` is a UMD bundle
// with no exports (esbuild resolves it and RestLink comes out undefined),
// and it ships no `exports` map. Real integration friction — recorded as
// exhibit evidence in FINDINGS.md.
import { RestLink } from "apollo-link-rest/index.js";
import { Grid } from "./grid.jsx";
import { readKnobs, plpUrl } from "./knobs.js";

const knobs = readKnobs();

const client = new ApolloClient({
  link: new RestLink({ uri: "" }),
  cache: new InMemoryCache(),
});

const PLP = gql`
  query Plp($path: String!) {
    plp(path: $path) @rest(type: "PlpPage", path: "{args.path}") {
      page
      perPage
      total
      items @type(name: "ReleaseSummary") {
        id
        title
        artist
        year
        numForSale
        priceFrom @type(name: "Price") {
          amount
          currency
        }
      }
    }
  }
`;

function Plp() {
  const [page, setPage] = useState(1);
  const { data, loading } = useQuery(PLP, {
    variables: { path: plpUrl(knobs, page) },
  });

  return (
    <Grid
      data={data ? data.plp : null}
      page={page}
      status={loading || !data ? "loading" : "settled"}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => p + 1)}
    />
  );
}

createRoot(document.getElementById("root")).render(
  <ApolloProvider client={client}>
    <Plp />
  </ApolloProvider>,
);
