/**
 * Pre-merge textual identity for the checkout: this variant's
 * re-implementation vs the reference master (checkout-vanilla).
 *
 * WHY THIS FILE EXISTS AT ALL, which is more of the point than what it
 * asserts: `@pm/vanilla` contributed ZERO tasks to turbo's 30 — verified
 * before this file landed (`turbo run lint typecheck test --dry=json` → 75
 * nodes, 30 with a real command, none of them this workspace) — so nothing
 * pre-merge ever read this package's own scripts. That is the precise gap
 * `pdp-controls` recorded after two of the PDP's four advertised
 * interactions shipped dead on ~500 deployed pages. The `test` script this
 * file gives the workspace makes the count 31, which is the honest number:
 * the 30 was a snapshot of a tree in which this variant was unguarded.
 *
 * Deliberately dependency-free — `node:test`, `node:assert`, no vitest, no
 * linkedom, no `@pm/drift-gate`. Two reasons, in order: the vanilla variant
 * IS the no-runtime, no-toolchain control and giving it a test toolchain
 * would blur that; and the comparison genuinely does not need a DOM, because
 * the vanilla guards are byte-strict after a regex strip rather than
 * DOM-normalized (`tools/repo-checks/test/variant-master-identity.test.ts:52-60`
 * is the idiom, and its own comment records why: attribute order is NOT
 * freed here, so a serialization change surfaces as a visible edit).
 *
 * The reference renderer is reached by FILE URL here, never by package
 * specifier: `@pm/reference` exposes no JS entry point on purpose (ADR-0003
 * §1, asserted by `no-component-runtime.test.ts`). This workspace DOES now
 * declare `@pm/reference` — for the a11y section only, a singleton rendered
 * by the master renderer at build time (DIFF-TO-STARTER decision 6, ADR-0004
 * §2 addendum) — but the checkout is a re-typed benchmarked surface and its
 * guard keeps the file-URL import so the two sides stay independent.
 *
 * `@pm/vanilla#test` is `"cache": false` in turbo.json (the entry this file
 * once recorded as owed landed with the checkout unit), matching every
 * sibling variant guard, so a change to `packages/reference/render/*` alone
 * cannot replay a stale PASS here.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import { renderCheckoutPage } from "../render.mjs";

const repoRoot = join(import.meta.dirname, "..", "..", "..");

/** Strip the ADR-0008 delivery freedoms this guard tolerates: the head
 *  subtree, script elements, the chrome slot; collapse ASCII whitespace. */
function stripDelivery(html) {
  return html
    .replace(/<head>[\s\S]*?<\/head>/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<div id="pm-chrome-slot"><\/div>/, "")
    .replace(/[\t\n\f\r ]+/g, " ");
}

/**
 * First point of divergence between two stripped documents, with context.
 *
 * `@pm/drift-gate` exports exactly this (`firstDomDivergence`) and this file
 * deliberately cannot import it — the package is a workspace dependency this
 * variant does not and should not declare. Written here rather than skipped
 * because the sabotage pass proved the need: without it, a one-word drift
 * printed two 6 KB single-line blobs and the actual difference was invisible.
 * A guard whose failure output cannot be read is a guard that gets muted.
 */
function firstDivergence(expected, actual, context = 70) {
  let i = 0;
  while (i < expected.length && i < actual.length && expected[i] === actual[i]) i += 1;
  const from = Math.max(0, i - context);
  return [
    `first divergence at character ${i}:`,
    `--- expected (reference render)  …${expected.slice(from, i + context)}…`,
    `+++ actual   (vanilla render)    …${actual.slice(from, i + context)}…`,
  ].join("\n");
}

/** The stylesheet LIST, which the strip above throws away with the head —
 *  compared by tail after `/css/`, ORDER INCLUDED: cascade order is a
 *  rendering property, not a freedom. The vanilla, astro and react-next PDP
 *  guards all carry this leg. */
function sheets(html) {
  return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/g)].map((m) => {
    const at = m[1].lastIndexOf("/css/");
    if (at === -1) throw new Error(`stylesheet href outside the css tree: ${m[1]}`);
    return m[1].slice(at + 1);
  });
}

const reference = await import(
  pathToFileURL(join(repoRoot, "packages", "reference", "render", "checkout.mjs")).href
);

describe("vanilla's checkout equals the master textually (pre-merge)", () => {
  it("renderCheckoutPage matches renderCheckout after the delivery strip", () => {
    // The checkout is DATA-FREE: `renderCheckout` takes no snapshot at all
    // (`packages/reference/render/build.mjs:78` discards it), so unlike the
    // editorial and PDP guards there is no fixture/crate loop here — there
    // is exactly one page and one flavor of it.
    const master = stripDelivery(reference.renderCheckout({}));
    const variant = stripDelivery(renderCheckoutPage({ depth: 1 }));

    // Non-vacuity: real checkout markup was compared, not two empty strings
    // or two copies of the shell.
    assert.notEqual(variant, "");
    assert.ok(variant.includes("pm-checkout__form"), "no checkout form in the variant render");
    assert.ok(variant.includes('name="shipping"'), "no shipping-method group in the variant render");
    // Specific to what this surface exists to prove: the twelve controls are
    // really in the compared string, not just the shell. Carried here from
    // the `@pm/repo-checks` copy of this guard, which was deleted once
    // `@pm/vanilla#test` went `"cache": false` (turbo.json) and stopped being
    // able to replay a stale PASS.
    assert.equal(variant.match(/pm-field__control/g)?.length, 12);
    // The plaque claims "what you type never leaves your browser" and the
    // form is a real method="post". The ONLY thing keeping that true JS-off
    // is that no typed control is a successful control, so it is asserted
    // rather than trusted to a code review: two names in the whole form, both
    // the shipping radio group, which needs one to be a group at all.
    assert.equal(variant.match(/<input[^>]* name=/g)?.length, 2);
    assert.equal(variant.match(/<select[^>]* name=/g), null);
    // Native validation is claimed on-page; these are what make it true.
    assert.equal(variant.match(/ required/g)?.length, 10);
    if (variant !== master) console.error(firstDivergence(master, variant));
    assert.ok(variant === master, "the vanilla checkout has drifted from the master (see above)");
  });

  it("the checkout links exactly the master's stylesheets, in order", () => {
    const master = sheets(reference.renderCheckout({}));
    const variant = sheets(renderCheckoutPage({ depth: 1 }));
    assert.ok(master.length > 5, "the master links no stylesheets");
    // The two sheets this surface exists to exercise, pinned by name so a
    // silent drop shows up here rather than as unstyled markup in a
    // screenshot: format-switch survives BECAUSE of checkout's
    // shipping-method group (ADR-0008 addendum A), and error-summary is the
    // invalid-submit contract's sheet.
    assert.ok(master.includes("css/components/format-switch.css"));
    assert.ok(master.includes("css/components/error-summary.css"));
    assert.deepEqual(variant, master);
  });

  it("the served markup carries no novalidate — the enhancement adds it", () => {
    // checkout.mjs:9-12 is explicit: JS-off, native constraint validation is
    // the real behavior the page claims, so `novalidate` must NOT be in the
    // served document. It is set at wire-up, where this paradigm's own
    // validation takes over. A master that gained it would silently delete
    // the JS-off behavior the page states about itself on the page.
    assert.ok(!renderCheckoutPage({ depth: 1 }).includes("novalidate"));
    assert.ok(
      readFileSync(join(import.meta.dirname, "..", "src", "checkout.js"), "utf8").includes(
        'form.setAttribute("novalidate", "")',
      ),
      "the enhancement never takes the validation handover it is served without",
    );
  });

  it("the express-shipping constant and the served option label are one number", () => {
    // The price appears twice by necessity — as authored copy in the served
    // markup and as arithmetic in the enhancement — and nothing else would
    // notice them disagreeing. This is the only leg here that reads only
    // `variants/vanilla/**`, so it is the only one turbo can cache soundly.
    const script = readFileSync(
      join(import.meta.dirname, "..", "src", "checkout.js"),
      "utf8",
    );
    const declared = script.match(/const EXPRESS_SHIPPING = (\d+(?:\.\d+)?);/);
    assert.ok(declared, "EXPRESS_SHIPPING is not declared as a literal");
    const html = renderCheckoutPage({ depth: 1 });
    const label = html.match(/Express — \$([\d,]+\.\d{2}), /);
    assert.ok(label, "the express option label does not state a price");
    assert.equal(Number(declared[1]), Number(label[1].replace(/,/g, "")));
  });
});
