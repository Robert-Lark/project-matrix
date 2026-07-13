/**
 * Strategy: cold / no caching — the naive baseline every cure is compared to.
 * Plain fetch on render and on every interaction; nothing is remembered.
 * This exact build is ALSO the edge-cache strategy's page: cold pins
 * ?cache=cold, edge-cache drops it — same code, one condition flip.
 */
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { Grid } from "./grid.jsx";
import { readKnobs, plpUrl } from "./knobs.js";

const knobs = readKnobs();

function App() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let live = true;
    setStatus("loading");
    fetch(plpUrl(knobs, page))
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        setData(d);
        setStatus("settled");
      });
    return () => {
      live = false;
    };
  }, [page]);

  return (
    <Grid
      data={data}
      page={page}
      status={status}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => p + 1)}
    />
  );
}

createRoot(document.getElementById("root")).render(<App />);
