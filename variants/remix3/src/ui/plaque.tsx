// The fenced plaque — labeling layer 1 of 3 (remix3-frontier FINDINGS §7(c);
// ADR-0003 first addendum). The DS plaque component's canonical fenced form
// (packages/tokens/css/components/plaque.css): kicker · name · claim · rule,
// data-pm-fenced="true" as the machine hook the normalizer, the pixel leg,
// and the origin suite all key on. A plaque states a boundary; it never
// alarms (CONTEXT.md).
//
// The version string is TOOL-DERIVED from this package's own manifest — the
// plaque cannot drift from the installed pin (every number from a tool,
// never typed; the exact-pin format itself is asserted by the pre-merge
// guard).
import type { Handle } from "remix/ui";

import pkg from "../../package.json" with { type: "json" };

export const REMIX_VERSION: string = pkg.dependencies.remix;

export function FrontierPlaque(_handle: Handle) {
  return () => (
    <aside class="pm-plaque pm-plaque--fenced" data-pm-fenced="true">
      <p class="pm-plaque__kicker">{"Fenced exhibit"}</p>
      <p class="pm-plaque__name">
        <strong>{"Remix 3 — a frontier preview"}</strong>
      </p>
      <p class="pm-plaque__claim">
        {"This page is served by Remix 3 ("}
        <code>{REMIX_VERSION}</code>
        {"), a pre-release framework: non-React server HTML whose frames reload over the wire as markup. It is shown as a preview of a coming paradigm — pre-release software can change or break week to week, so this exhibit is excluded from every benchmark number on this site. The demo below the article shows the mechanism."}
      </p>
      <p class="pm-plaque__rule">
        {"pre-release "}
        {REMIX_VERSION}
        {" · excluded from every benchmark number"}
      </p>
    </aside>
  );
}
