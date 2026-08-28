import { HOSTS, Shell } from "@/lib/render";

/** The branded 404 `notFound()` renders (slug mismatch, unknown release,
 *  malformed slug). The STATUS is the cross-paradigm contract — vanilla
 *  404s these URLs by construction (no file) — and Next locks it to a real
 *  404 because nothing on this route streams. The body is this variant's
 *  own: keeping the shell here also keeps the chrome slot present, so the
 *  front Worker's slot-cardinality contract holds on error paths too. No
 *  masthead link is current — this page is off the store nav. */
export default function PdpNotFound() {
  return (
    <Shell>
      <div className="pm-pdp">
        <h1>This record isn&apos;t in the crate</h1>
        <p>
          No release in the frozen snapshot matches this address. The catalogue is fixed at
          capture time — a link that changed is a link that broke, honestly.
        </p>
        <p>
          <a href={HOSTS.plp}>Back to all records</a>
        </p>
      </div>
    </Shell>
  );
}
