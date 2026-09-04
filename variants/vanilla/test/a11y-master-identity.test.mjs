/**
 * Pre-merge identity for the a11y section: this variant's three served pages
 * vs the committed masters (a11y-section build, 2026-09-03).
 *
 * The body is rendered by the master's OWN renderer (render.mjs
 * `renderA11yPage` — DIFF-TO-STARTER decision 6), so unlike the checkout guard
 * beside this file the comparison is not two templates agreeing. It is the
 * proof that the COMPOSITION adds exactly the three delivery freedoms the
 * strip removes — the head, the chrome slot, script elements — and nothing
 * else. The D2 sabotage class the how-it-was-built build recorded (a
 * post-render edit of the body in the consumer, invisible to every other
 * guard because the renderer itself is unchanged) is what this catches. An
 * edit to the renderer moves both sides identically and is the master
 * regeneration test's to catch (packages/reference/test/reference.test.ts).
 *
 * Dependency-free like the checkout guard: node:test, node:assert. The master
 * side reaches the reference renderer by FILE URL (the drift gate's own
 * pattern) even though this workspace now declares @pm/reference — so the
 * variant side's bare-specifier import and the master side's file import are
 * two independent resolutions of one module, and a broken workspace link
 * fails here rather than passing two copies of the same broken import.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import { A11Y_PAGES, renderA11yPage } from "../render.mjs";

const root = join(import.meta.dirname, "..");
const repoRoot = join(root, "..", "..");

const reference = await import(
  pathToFileURL(join(repoRoot, "packages", "reference", "render", "a11y.mjs")).href
);
/** Which master renderer IS each page's body. */
const MASTER = {
  a11y: reference.renderA11yIndex,
  "a11y/element-demos": reference.renderA11yElementDemos,
  "a11y/mode-demos": reference.renderA11yModeDemos,
};

/** Strip the ADR-0008 delivery freedoms this guard tolerates: the head
 *  subtree, script elements, the chrome slot; collapse ASCII whitespace. */
function stripDelivery(html) {
  return html
    .replace(/<head>[\s\S]*?<\/head>/, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<div id="pm-chrome-slot"><\/div>/, "")
    .replace(/[\t\n\f\r ]+/g, " ");
}

/** First point of divergence, with context — see the checkout guard for why
 *  this is written here rather than imported. */
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

/** The stylesheet LIST by tail after `/css/`, ORDER INCLUDED — cascade order
 *  is a rendering property, not a freedom (the vanilla PDP guard's leg). */
function sheets(html) {
  return [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"\s*\/?>/g)].map((m) => {
    const at = m[1].lastIndexOf("/css/");
    if (at === -1) throw new Error(`stylesheet href outside the css tree: ${m[1]}`);
    return m[1].slice(at + 1);
  });
}

/** The committed a11y masters, DERIVED FROM DISK: the surface root's own
 *  index.html plus every subdirectory carrying one. */
function committedA11yMasters() {
  const dir = join(repoRoot, "packages", "reference", "surfaces", "a11y");
  const found = existsSync(join(dir, "index.html")) ? ["a11y"] : [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(join(dir, entry.name, "index.html"))) {
      found.push(`a11y/${entry.name}`);
    }
  }
  return found.sort();
}

describe("vanilla's a11y pages equal their masters textually (pre-merge)", () => {
  it("the page table names exactly the committed masters — no page unserved, none invented", () => {
    // Both sides derived: a fourth master committed without a build entry, or
    // a build entry with no master behind it, fails here by name.
    assert.deepEqual(Object.keys(A11Y_PAGES).sort(), committedA11yMasters());
    assert.deepEqual(Object.keys(MASTER).sort(), committedA11yMasters());
  });

  for (const rel of Object.keys(A11Y_PAGES)) {
    it(`${rel}: renderA11yPage matches the master after the delivery strip`, () => {
      const master = stripDelivery(MASTER[rel]());
      const variant = stripDelivery(renderA11yPage(rel));
      // Non-vacuity: real a11y markup was compared, not two copies of the shell.
      assert.notEqual(variant, "");
      assert.ok(variant.includes('class="pm-a11y"'), "no a11y root in the variant render");
      if (variant !== master) console.error(firstDivergence(master, variant));
      assert.ok(variant === master, `${rel} has drifted from its master (see above)`);
    });

    it(`${rel}: the composition adds exactly the chrome slot and this variant's one script`, () => {
      const html = renderA11yPage(rel);
      const { depth } = A11Y_PAGES[rel];
      // One slot, directly after the skip link — the skip link stays the
      // FIRST focusable (shell.mjs skeleton), the slot second.
      assert.equal(
        html.match(/<div id="pm-chrome-slot"><\/div>/g)?.length,
        1,
        `${rel}: exactly one chrome slot (the front Worker fills it; zero ships an unmeasured page, two double-inject)`,
      );
      assert.match(
        html,
        /Skip to content<\/a>\n {2}<div id="pm-chrome-slot"><\/div>\n {2}<div class="pm-page">/,
      );
      // One script element, the enhancement, at THIS page's depth (the asset
      // base derives from depth — a second literal is how the first goes wrong).
      const scripts = [...html.matchAll(/<script[^>]*>/g)].map((m) => m[0]);
      assert.deepEqual(scripts, [`<script src="${"../".repeat(depth)}assets/a11y.js" defer>`]);
      // And the master carries neither — the two ✂ lines are the whole difference.
      const master = MASTER[rel]();
      assert.ok(!master.includes("pm-chrome-slot"), "the master must never carry a slot");
      assert.ok(!/<script/i.test(master), "the master must never carry a script");
    });

    it(`${rel}: links exactly the master's stylesheets, in order, and each exists in @pm/tokens`, () => {
      const master = sheets(MASTER[rel]());
      const variant = sheets(renderA11yPage(rel));
      assert.ok(master.length > 5, "the master links no stylesheets");
      assert.deepEqual(variant, master);
      // The build copies @pm/tokens' whole css tree into the variant's assets,
      // so every tail the page links must be a real file there — the
      // compare and mode-demo sheets included.
      const tokensCss = join(
        createRequire(join(root, "package.json")).resolve("@pm/tokens/css/tokens.css"),
        "..",
      );
      for (const tail of variant) {
        assert.ok(existsSync(join(tokensCss, tail.slice("css/".length))), `${tail} is not in @pm/tokens`);
      }
      // The variant's own base path, at this page's depth.
      const base = `${"../".repeat(A11Y_PAGES[rel].depth)}assets/pm/css/`;
      for (const m of renderA11yPage(rel).matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
        assert.ok(m[1].startsWith(base), `${m[1]} is not under ${base}`);
      }
    });
  }

  it("element-demos alone is noindex — the master's flag, carried through the head callback", () => {
    // Strategy-review finding 21: the stripped twins are deliberately
    // inaccessible pages on a public site. The flag is the MASTER's
    // (a11y.mjs passes `noindex: true` for this page only); the variant's head
    // receives it through the callback and must neither drop it nor spread it.
    const ROBOTS = '<meta name="robots" content="noindex">';
    for (const rel of Object.keys(A11Y_PAGES)) {
      const expected = rel === "a11y/element-demos";
      assert.equal(MASTER[rel]().includes(ROBOTS), expected, `master ${rel}`);
      assert.equal(renderA11yPage(rel).includes(ROBOTS), expected, `variant ${rel}`);
    }
  });

  it("every DS-off twin is served inside a CLOSED <details>, label first, compliant twin adjacent", () => {
    // Finding 21's three conditions, held on the served bytes.
    const html = renderA11yPage("a11y/element-demos");
    const sections = html.split('<section class="pm-compare"').slice(1);
    assert.equal(sections.length, 5, "five compares");
    for (const section of sections) {
      const walkthrough = section.indexOf('class="pm-compare__walkthrough"');
      const onBox = section.indexOf('<div class="pm-compare__box">');
      const details = section.indexOf('<details class="pm-compare__off">');
      const offBox = section.indexOf("pm-compare__box--off");
      assert.ok(walkthrough !== -1 && onBox !== -1 && details !== -1 && offBox !== -1);
      assert.ok(walkthrough < onBox, "the label comes FIRST");
      assert.ok(onBox < details, "the compliant twin comes before the stripped one");
      assert.ok(details < offBox, "the stripped twin sits INSIDE the details");
    }
    assert.ok(!/<details[^>]*\sopen[\s>]/.test(html), "no twin is served open");
  });

  it("every mode toggle is served unpressed, beside the honesty caveat", () => {
    const html = renderA11yPage("a11y/mode-demos");
    assert.equal(
      html.match(/class="pm-mode__toggle" type="button" aria-pressed="false"/g)?.length,
      3,
    );
    assert.ok(!html.includes('aria-pressed="true"'), "a toggle is served pressed");
    // The caveat is CONTENT, once per demo (prompt duty 5), not chrome.
    assert.equal(
      html.match(/your OS setting is the real thing — these demos never override it/g)?.length,
      3,
    );
  });
});
