import { Shell } from "@/lib/render";

/** The branded 404 `notFound()` renders for a facet or sort value the
 *  snapshot does not hold (the edge answered 400 — ADR-0005 §5's "junk is a
 *  400, never a KV key"). The STATUS and the copy are the cross-arm
 *  contract: htmx serves the same sentence at 404 for the same URL. The
 *  shell is kept so the page is branded once it renders — and it renders at
 *  HYDRATION: with multiple root layouts Next SSRs its own `__next_error__`
 *  document and ships this boundary in the RSC payload (DIFF-TO-STARTER.md
 *  item 25, the PDP not-found precedent), so the served HTML has no chrome
 *  slot and the front Worker logs `chrome-slot-count` 0 on this path, as it
 *  does for the PDP 404. Read off the served body 2026-09-18; the origin
 *  suite pins the shape (plp.test.ts). Not the error boundary: the data
 *  plane ANSWERED. */
export default function PlpNotFound() {
  return (
    <Shell current="plp">
      <div className="pm-plp">
        <h1>No such filter</h1>
        <p>
          Nothing in the crate is filed under that value. The filters on the{" "}
          <a href="/react-next/plp/plain/">catalogue</a> list what there is.
        </p>
      </div>
    </Shell>
  );
}
