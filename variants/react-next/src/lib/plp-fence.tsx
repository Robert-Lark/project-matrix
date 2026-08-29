/**
 * The fenced Apollo exhibit's on-surface label.
 *
 * The canonical fenced plaque (CONTEXT.md "Plaque"; the form
 * `packages/reference/render/pdp.mjs:127-132` renders): a bordered block of
 * kicker · name · claim, plus `data-pm-fenced="true"` and the exclusion rule
 * line. `data-pm-fenced` is the CONTRACT's own labeling hook — the drift
 * gate's `dropFencedSubtrees` is a call-site flag, never a `PERMITTED_NOISE`
 * field (`tools/drift-gate/src/normalize.ts:275-287`), so only this route's own
 * comparison legs drop it and the two benchmarked PLP routes carry zero fenced
 * elements, which is editorial's rule and the one the PLP follows (its master
 * renders no plaque at all).
 *
 * The rule line is the DS canonical string, not remix3's version-carrying
 * override — that override belongs to a pre-release exhibit, and this one is
 * not pre-release. The separator is U+00B7 with spaces on both sides.
 *
 * The versions are TOOL-DERIVED from this variant's own package.json (the
 * remix3 precedent: a version a human typed is a version that goes stale), and
 * the pre-merge guard asserts they equal the installed pins.
 *
 * WHAT THE COPY MAY CLAIM, and why it was narrowed. An earlier draft said "It
 * works, and the page you are reading is the proof." It is not: the grid on
 * this page is server-rendered by `loadPlp`, byte-identically to the plain
 * arm, and handed to Apollo as a cache seed — so Apollo issues no request for
 * anything the reader is looking at. Its REST path is exercised by a later
 * pagination click, which nothing in this repo drives yet (the pre-merge guard
 * runs no effects and has no DOM; the origin suite has no PLP legs). The
 * exhibit was overstating its own evidence on the one page whose subject is
 * not overstating evidence. The claim now says what the page actually shows,
 * and the behavioural proof is OWED to the origin suite's JS-on leg, the same
 * place the popstate and error-floor hooks are owed.
 */
import pkg from "../../package.json";

const APOLLO_VERSION = pkg.dependencies["@apollo/client"];
const REST_LINK_VERSION = pkg.dependencies["apollo-link-rest"];

export const APOLLO_EXHIBIT = {
  apolloVersion: APOLLO_VERSION,
  restLinkVersion: REST_LINK_VERSION,
  /** The DS canonical fenced rule line (`packages/tokens/css/components/plaque.css`
   *  names it; `pdp.mjs:132` renders it). */
  rule: "measured with the same harness · excluded from every benchmark number",
};

export function PlpApolloPlaque() {
  return (
    <aside className="pm-plaque pm-plaque--fenced" data-pm-fenced="true">
      <p className="pm-plaque__kicker">Fenced demonstration</p>
      <p className="pm-plaque__name">
        <strong>The misapplication exhibit — a GraphQL client on a REST tray</strong>
      </p>
      {/* One template literal per text run: JSX splits `text {expr} text` into
          separate DOM text nodes, which the zero-tolerance pixel gate sees. */}
      <p className="pm-plaque__claim">
        {`This is the same catalogue, wired to Apollo Client ${APOLLO_VERSION} and apollo-link-rest ${REST_LINK_VERSION} — a GraphQL client pointed at a REST endpoint that was never GraphQL. The grid below is server-rendered, exactly as it is on every other strategy; from here on, every page change on this page goes through Apollo instead. What that costs is a query document describing a shape the server never had, a directive mapping that shape back onto the URL, and a normalizing cache that has to be told the type of every object before it will hold one — plus the bytes, which the reading table publishes.`}
      </p>
      <p className="pm-plaque__claim">
        Apollo is the right tool when a real graph is on the other end: many
        clients composing their own views over one schema, fragments colocated
        with components, a cache that can answer a question no single endpoint
        was written for. None of those exist here — this tray is one endpoint
        with one shape.
      </p>
      <p className="pm-plaque__rule">
        measured with the same harness · excluded from every benchmark number
      </p>
    </aside>
  );
}
