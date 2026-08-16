/**
 * No committed master ships a BARE GLYPH as an element's whole content.
 *
 * A lone "—" is not an accessible name. A screen reader announces it as "em
 * dash", or — with punctuation verbosity low, which is the common default —
 * says nothing at all, so "this release has no price" and "the price failed
 * to render" become the same experience. `tracklist.css` has applied that
 * reasoning to empty duration cells since surface-design; `pdp.mjs`'s
 * steppers and its "#" column header apply it too. What was missing was
 * anything that could FIND the places where it had not been applied.
 *
 * Run against the masters on `origin/main` it reports SEVEN instances across
 * THREE sites: the PDP's unpriced amount (1), the release card's unpriced
 * price (5, in the PLP master), and checkout's cart total placeholder (1).
 * A fourth site — `pdp.mjs`'s null year — was repaired in the same pass but
 * this rule did NOT find it and cannot: all four resolved masters have years,
 * so no committed artifact renders that arm. It was found by reading. Saying
 * so matters, because "the guard found four" would credit the rule with the
 * one instance it is still blind to.
 *
 * The rule is deliberately not a list of glyphs to ban — an enumeration is a
 * thing to forget to extend. Any element whose entire text is short and
 * carries neither a letter nor a digit is a glyph standing in for words, and
 * must either be hidden from assistive tech (with the words supplied beside
 * it — `lib.mjs` namedGlyph) or given a name of its own.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";

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

/** Letters and digits in ANY script — the crate carries CJK, Arabic, Greek
 *  and Cyrillic titles, and none of those are bare glyphs. */
const HAS_WORD_CHARACTER = /[\p{L}\p{N}]/u;

/** Two characters, so a paired glyph ("→←", "±%") cannot slip through on
 *  length while a real fragment of prose stays out of scope by having words. */
const MAX_GLYPH_LENGTH = 2;

type El = {
  tagName: string;
  textContent: string | null;
  children: { length: number };
  getAttribute: (name: string) => string | null;
  hasAttribute: (name: string) => boolean;
  parentElement: El | null;
  outerHTML: string;
};

/** Hidden from AT here or anywhere above — `aria-hidden` is inherited by the
 *  whole subtree, so a glyph inside a hidden wrapper is already silent. */
function hiddenFromAssistiveTech(el: El): boolean {
  for (let node: El | null = el; node; node = node.parentElement) {
    if (node.getAttribute("aria-hidden") === "true") return true;
    if (node.hasAttribute("hidden")) return true;
  }
  return false;
}

/** Named by something other than its own text. */
function carriesItsOwnName(el: El): boolean {
  return (
    el.hasAttribute("aria-label") ||
    el.hasAttribute("aria-labelledby") ||
    el.hasAttribute("title") ||
    el.hasAttribute("alt")
  );
}

function bareGlyphs(html: string): string[] {
  const { document } = parseHTML(html);
  const found: string[] = [];
  for (const raw of document.querySelectorAll("*")) {
    const el = raw as unknown as El;
    // Only LEAF text matters: an ancestor's textContent concatenates its
    // children's, so <p><span aria-hidden>—</span><span>No price</span></p>
    // would otherwise read as the bare glyph plus words and be judged twice.
    if (el.children.length > 0) continue;
    const text = (el.textContent ?? "").trim();
    if (text === "") continue;
    if (text.length > MAX_GLYPH_LENGTH) continue;
    if (HAS_WORD_CHARACTER.test(text)) continue;
    if (hiddenFromAssistiveTech(el)) continue;
    if (carriesItsOwnName(el)) continue;
    found.push(el.outerHTML);
  }
  return found;
}

describe("committed masters name every glyph they render", () => {
  it("finds every committed master on disk", () => {
    expect(MASTERS.length).toBeGreaterThanOrEqual(12);
    expect(MASTERS).toContain("pdp/unpriced");
  });

  for (const surface of MASTERS) {
    it(`${surface}: no element's whole content is a bare glyph`, () => {
      const html = readFileSync(join(surfaces, surface, "index.html"), "utf8");
      expect(bareGlyphs(html)).toEqual([]);
    });
  }

  it("the rule fires on the exact markup the PDP used to ship", () => {
    // The pre-pdp-controls unpriced amount, and the repair that replaced it.
    const before = `<!doctype html><html lang="en"><body><p class="pm-pdp__price">
      <span class="pm-pdp__amount">—</span></p></body></html>`;
    const after = `<!doctype html><html lang="en"><body><p class="pm-pdp__price">
      <span class="pm-pdp__amount"><span aria-hidden="true">—</span><span
      class="pm-sr-only">No price listed</span></span></p></body></html>`;
    expect(bareGlyphs(before)).toHaveLength(1);
    expect(bareGlyphs(before)[0]).toContain("pm-pdp__amount");
    expect(bareGlyphs(after)).toEqual([]);
  });

  it("does not fire on glyphs that are already hidden, named, or words", () => {
    const fine = `<!doctype html><html lang="en"><body>
      <button><span aria-hidden="true">−</span><span class="pm-sr-only">Decrease quantity</span></button>
      <th scope="col"><span aria-hidden="true">#</span><span class="pm-sr-only">Position</span></th>
      <span aria-label="Rating: 4 of 5">★</span>
      <td>A1</td>
      <dd>2 × Vinyl, LP, Album</dd>
      <p>Your cart is empty — items appear here as you add them.</p>
      </body></html>`;
    expect(bareGlyphs(fine)).toEqual([]);
  });
});
