import { component$, useSignal } from "@builder.io/qwik";

/**
 * The live-origin demonstration's button + output (ADR-0002 §3) — the ONLY
 * serve-time Discogs call in the project, fenced from every number, on
 * demand only. The plaque's copy is canonical markup rendered by PdpArticle;
 * this island wires exactly the button and its output slot. The endpoint is
 * deliberately allowed not to exist yet — the output states the absence
 * plainly (the message strings are vanilla's pdp.js verbatim, so the
 * demonstration reads identically whichever paradigm serves it).
 */
export const LiveOriginDemo = component$<{ id: number }>(({ id }) => {
  const message = useSignal("");
  const busy = useSignal(false);

  return (
    <>
      <button
        class="pm-button pm-button--secondary"
        type="button"
        disabled={busy.value}
        onClick$={async () => {
          busy.value = true;
          message.value = "Asking the live API…";
          const started = performance.now();
          try {
            const res = await fetch(`/api/live-price/${id}`, {
              headers: { accept: "application/json" },
            });
            const elapsed = Math.round(performance.now() - started);
            if (!res.ok) {
              message.value =
                res.status === 404
                  ? `The live route is not deployed yet — nothing to show, and nothing faked (${elapsed} ms to find that out).`
                  : `The live origin answered ${res.status} after ${elapsed} ms. That is the cost of a dynamic origin on a bad day.`;
              return;
            }
            const body = (await res.json()) as { formatted?: string } | null;
            message.value =
              body && body.formatted
                ? `Live: ${body.formatted} · ${elapsed} ms round trip, uncached, right now.`
                : `The live origin answered in ${elapsed} ms but carried no price for this release.`;
          } catch {
            message.value =
              "The live call failed. That is a real property of a dynamic origin — and why the numbers on this site never depend on one.";
          } finally {
            busy.value = false;
          }
        }}
      >
        {"Fetch today's price live"}
      </button>{" "}
      <output data-pm-live-origin>{message.value}</output>
    </>
  );
});
