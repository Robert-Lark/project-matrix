/**
 * A script's CODE, with comments removed — the one comment stripper the
 * repo-checks guards share (extracted from pdp-controls-wired.test.ts by
 * checkout-measure-prep, 2026-09-24, when the cart-trio guard needed it too).
 *
 * Why it exists at all: checkout-vanilla's sabotage pass found the
 * controls-wired guard passing a sabotage it should have failed. Its
 * attribute checks were `script.includes("aria-invalid")` over the RAW file,
 * and every vanilla enhancement explains its own state attributes in prose
 * directly above the line that writes them — so rewiring `aria-invalid` to
 * `data-invalid` left two occurrences, both in comments, and the guard
 * reported green. `pdp.js` names `aria-pressed` in the comment above the
 * zoom toggle for the same reason, so deleting the toggle and keeping its
 * explanation would have passed the guard written to catch the dead zoom.
 * A class NAMED in a contract comment is not a rule (master-styles-resolve
 * :68-75 learned it for CSS); a state named in a code comment is not a write.
 *
 * String-aware rather than a pair of regexes, because a regex strip would
 * eat the tail of any `"https://…"` literal and silently weaken the check it
 * is meant to strengthen. Known limit, stated: a REGEX literal containing a
 * quote character would confuse the scanner. No registered enhancement
 * contains one (checked), and if one ever does, the failure mode is a false
 * ALARM — a guard that fails loudly — not a false pass.
 *
 * Shared on purpose, unlike the CSS-linking helpers the two stylesheet guards
 * keep separate: those are ORACLES that must be able to fail independently;
 * this is a lexer with one right answer, and two copies of a lexer diverge.
 */
export function codeOnly(source: string): string {
  let out = "";
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < source.length && source[j] !== c) {
        if (source[j] === "\\") j += 1;
        j += 1;
      }
      out += source.slice(i, j + 1);
      i = j;
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? source.length : end + 1;
      out += " ";
      continue;
    }
    out += c;
  }
  return out;
}
