"use client";

import { useState } from "react";

/**
 * The live-origin demonstration's button + output (ADR-0002 §3) — the ONLY
 * serve-time Discogs call in the project, fenced from every number, on
 * demand only. The plaque's copy is canonical markup rendered by the server
 * component; this island wires exactly the button and its output slot.
 *
 * The endpoint is deliberately allowed not to exist yet: until the edge
 * Worker's live route and its token secret are in place (Rob's to set), the
 * demonstration says so plainly in its own output slot — the same rule every
 * unpublished number follows: state the absence, never a silent no-op. The
 * message strings are vanilla's verbatim (variants/vanilla/src/pdp.js), so
 * the demonstration reads identically whichever paradigm serves it.
 */
export function LiveOriginButton({ id }: { id: number }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    setBusy(true);
    setMessage("Asking the live API…");
    const started = performance.now();
    try {
      const res = await fetch(`/api/live-price/${id}`, {
        headers: { accept: "application/json" },
      });
      const elapsed = Math.round(performance.now() - started);
      if (!res.ok) {
        setMessage(
          res.status === 404
            ? `The live route is not deployed yet — nothing to show, and nothing faked (${elapsed} ms to find that out).`
            : `The live origin answered ${res.status} after ${elapsed} ms. That is the cost of a dynamic origin on a bad day.`,
        );
        return;
      }
      const body = (await res.json()) as { formatted?: string } | null;
      setMessage(
        body && body.formatted
          ? `Live: ${body.formatted} · ${elapsed} ms round trip, uncached, right now.`
          : `The live origin answered in ${elapsed} ms but carried no price for this release.`,
      );
    } catch {
      setMessage(
        "The live call failed. That is a real property of a dynamic origin — and why the numbers on this site never depend on one.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="pm-button pm-button--secondary"
        type="button"
        disabled={busy}
        onClick={ask}
      >
        Fetch today&apos;s price live
      </button>{" "}
      <output data-pm-live-origin="">{message}</output>
    </>
  );
}
