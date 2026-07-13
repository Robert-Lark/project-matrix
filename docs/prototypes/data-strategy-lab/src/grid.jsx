/**
 * The ONE grid component every client strategy page renders (the prototype's
 * zero-bias move: identical page, only the data layer swapped — so the built
 * bundles differ ONLY by the data library, and the byte delta is the library).
 *
 * Text-only on purpose: image delivery is strategy-invariant (outside the
 * warm tier, identical bytes everywhere), so the prototype keeps it out of
 * the per-interaction deltas.
 */
export function Grid({ data, page, status, onPrev, onNext }) {
  return (
    <main>
      <h1>data-strategy-lab</h1>
      <p>
        <button id="prev" onClick={onPrev} disabled={page <= 1}>
          prev
        </button>{" "}
        page {page}{" "}
        <button id="next" onClick={onNext}>
          next
        </button>
      </p>
      <div id="grid" data-pm-page={data ? String(data.page) : ""} data-pm-status={status}>
        {data
          ? data.items.map((r) => (
              <article key={r.id} className="pm-card">
                <h2>{r.title}</h2>
                <p>
                  {r.artist}
                  {r.year ? ` — ${r.year}` : ""}
                </p>
                <p>
                  {r.priceFrom
                    ? `$${r.priceFrom.amount} (${r.numForSale} for sale)`
                    : "not for sale"}
                </p>
              </article>
            ))
          : "loading"}
      </div>
    </main>
  );
}
