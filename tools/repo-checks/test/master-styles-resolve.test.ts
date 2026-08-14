/**
 * Every `pm-` class a committed master renders resolves to a rule in a sheet
 * THAT MASTER LINKS.
 *
 * This is the `pm-pdp__scroll` defect made impossible. That class carried
 * `role="region" tabindex="0"` — a promise of a scrollable region — and
 * matched zero lines of CSS anywhere, so every PDP page with a tracklist gave
 * keyboard users a focus stop on a container that could not scroll. Nothing
 * could see it, because no check ever compared the markup contract against the
 * stylesheets that are supposed to implement it.
 *
 * It caught a second instance immediately, one this very slice introduced.
 * `.pm-sr-only` was defined in `components/gallery.css`, a COMPONENT sheet
 * only the PDP links. When `lib.mjs` namedGlyph put visually-hidden text on
 * the PLP and checkout masters, those pages had no rule to hide it with — the
 * text meant only for assistive technology would have rendered as visible
 * "— No price listed". The utility now lives in `surfaces/shell.css`, which
 * `head()` links everywhere.
 *
 * "Linked by that master" is the load-bearing half. A repo-wide grep for the
 * class would have passed in both cases: `.pm-sr-only` DID exist in the
 * package. What it did not do was exist on the page that used it.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const surfaces = join(repoRoot, "packages", "reference", "surfaces");

/** Every committed master, DERIVED FROM DISK. An earlier draft of this list
 *  was a hand-kept array under a comment claiming it was derived — exactly the
 *  record-not-code shape `reference.test.ts` records ("eight" through three
 *  master additions), committed while asserting the opposite. */
function committedMasters(): string[] {
  const found: string[] = [];
  const walk = (rel: string): void => {
    for (const entry of readdirSync(join(surfaces, rel), { withFileTypes: true })) {
      if (entry.isDirectory()) walk(rel ? `${rel}/${entry.name}` : entry.name);
      else if (entry.name === "index.html" && rel) found.push(rel);
    }
  };
  walk("");
  return found.sort();
}

const MASTERS = committedMasters();

/**
 * Classes rendered by a master that NOTHING styles, each with the surface that
 * owes the rule. A registry, not a skip: every entry is a real debt, the list
 * is frozen at what existed before this guard, and a NEW unstyled class fails.
 *
 * All three predate the guard (verified against `origin/main`) and sit on
 * surfaces that are not built yet, so no visitor meets them. They are the
 * `pm-pdp__scroll` class of defect — markup contract ahead of the stylesheet —
 * and belong to whichever build lands the surface.
 */
const OWED: Record<string, string> = {
  "pm-plp__head": "plp — unbuilt surface; the PLP build owes the rule",
  "pm-plp__results": "plp — unbuilt surface; the PLP build owes the rule",
  "pm-checkout__form": "checkout — unbuilt surface; the checkout build owes the rule",
};

/** CSS with comments removed. A class NAMED in a contract comment is not a
 *  rule — this package's comments describe canonical markup and mention class
 *  names constantly, so matching against them would excuse the exact defect
 *  this file exists to catch (the note left behind in `gallery.css` mentions
 *  `.pm-sr-only` by name). */
function rulesOnly(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Is `name` used as a WHOLE class token in a selector?
 *
 *  A plain `css.includes(".pm-sr-only")` is not this, and the difference is
 *  not academic: it also matches `.pm-sr-only-MOVED`, and it reports
 *  `.pm-plp` as defined because `.pm-plp__head` exists. The first draft of
 *  this guard used `includes`, and its own sabotage proof — renaming the rule
 *  it was written to protect — passed. A class name ends where a CSS
 *  identifier character stops. */
function definesClass(css: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\.${escaped}(?![\\w-])`).test(rulesOnly(css));
}

/** A BEM BLOCK ROOT carrying no rules of its own is normal, not debt:
 *  `<article class="pm-pdp">` is an anchor and every rule hangs off its
 *  elements. Treat the root as resolved when the sheet styles any of its
 *  elements or modifiers — but never treat an ELEMENT class that way, which
 *  is what keeps `pm-plp__head` in the owed registry where it belongs. */
function resolves(css: string, name: string): boolean {
  if (definesClass(css, name)) return true;
  if (name.includes("__") || name.includes("--")) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\.${escaped}(?:__|--)[\\w-]+`).test(rulesOnly(css));
}

/** The `pm-` classes a master's markup actually renders. */
function classesUsed(html: string): Set<string> {
  const used = new Set<string>();
  for (const match of html.matchAll(/class="([^"]+)"/g)) {
    for (const name of match[1]!.split(/\s+/)) {
      if (name.startsWith("pm-")) used.add(name);
    }
  }
  return used;
}

/** Every @pm/tokens sheet THIS master links, concatenated. Relative hrefs are
 *  resolved against the master's own directory, which is what the browser
 *  does — a master at pdp/unpriced/ reaches the package through one more
 *  "../" than one at pdp/. */
function linkedCss(dir: string, html: string): { css: string; count: number } {
  const hrefs = [...html.matchAll(/href="([^"]*@pm\/tokens\/css\/[^"]+\.css)"/g)].map(
    (m) => m[1]!,
  );
  let css = "";
  for (const href of hrefs) css += readFileSync(join(dir, href), "utf8");
  return { css, count: hrefs.length };
}

describe("committed masters link a rule for every class they render", () => {
  it("finds every committed master on disk", () => {
    expect(MASTERS.length).toBeGreaterThanOrEqual(12);
    expect(MASTERS).toContain("pdp/unpriced");
  });

  for (const surface of MASTERS) {
    it(`${surface}: every pm- class resolves in a sheet this master links`, () => {
      const dir = join(surfaces, surface);
      const html = readFileSync(join(dir, "index.html"), "utf8");
      const { css, count } = linkedCss(dir, html);
      // Non-vacuity: a master that linked nothing would pass every check below
      // by having nothing to check against.
      expect(count, `${surface} links no @pm/tokens stylesheet`).toBeGreaterThan(2);

      const used = classesUsed(html);
      expect(used.size, `${surface} renders no pm- classes`).toBeGreaterThan(5);

      const unstyled = [...used].filter((name) => !resolves(css, name) && !(name in OWED));
      expect(unstyled, `${surface}: classes no linked sheet defines`).toEqual([]);
    });
  }

  it("the OWED registry is exactly the known debt — no more, no less", () => {
    // A registry that outlives its debt is a silent permission. When a surface
    // build lands its rules, this fails until the entry is removed.
    const stillUnstyled: string[] = [];
    for (const surface of MASTERS) {
      const dir = join(surfaces, surface);
      const html = readFileSync(join(dir, "index.html"), "utf8");
      const { css } = linkedCss(dir, html);
      for (const name of classesUsed(html)) {
        if (name in OWED && !resolves(css, name) && !stillUnstyled.includes(name)) {
          stillUnstyled.push(name);
        }
      }
    }
    expect(stillUnstyled.sort()).toEqual(Object.keys(OWED).sort());
  });

  it("fires on the exact defect that prompted it", () => {
    // `.pm-sr-only` rendered by a master whose linked sheets do not define it —
    // the state the PLP and checkout masters were in mid-slice.
    const html = '<html><head><link rel="stylesheet" href="../css/components/button.css"></head>' +
      '<body><span class="pm-sr-only">No price listed</span></body></html>';
    const used = classesUsed(html);
    expect(used.has("pm-sr-only")).toBe(true);
    expect("pm-sr-only" in OWED, "the utility must never be excused by the registry").toBe(false);
    const css = readFileSync(
      join(repoRoot, "packages", "tokens", "css", "components", "button.css"),
      "utf8",
    );
    expect(definesClass(css, "pm-sr-only")).toBe(false);
  });

  it("the visually-hidden utility lives in a sheet EVERY surface links", () => {
    // The specific rule the slice moved, pinned where it belongs: `head()`
    // ships surfaces/shell.css on every master, so the utility is reachable
    // from any surface that ever needs to hide text from sight but not from
    // assistive technology.
    const shell = readFileSync(
      join(repoRoot, "packages", "tokens", "css", "surfaces", "shell.css"),
      "utf8",
    );
    expect(definesClass(shell, "pm-sr-only")).toBe(true);
    const gallery = readFileSync(
      join(repoRoot, "packages", "tokens", "css", "components", "gallery.css"),
      "utf8",
    );
    expect(definesClass(gallery, "pm-sr-only"), "the old definition must not linger").toBe(false);
  });
});
