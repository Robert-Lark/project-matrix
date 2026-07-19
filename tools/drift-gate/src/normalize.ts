/**
 * Normalized-DOM extraction (ADR-0003 §6): the drift gate's first check.
 *
 * `PAGE_NORMALIZE` runs INSIDE the driven browser (Playwright serializes the
 * function into the page), so the DOM being normalized is the browser's own
 * parse of what the variant actually served — no second HTML parser whose
 * quirks could diverge from what a visitor's browser sees. The function is
 * therefore fully self-contained: no imports, no closures.
 *
 * What normalization removes, and why each removal is legitimate:
 *
 *  1. The `div#pm-chrome-slot` ELEMENT and its subtree — chrome is
 *     instrumentation, excluded by contract (ADR-0004 §7,
 *     packages/switcher/README.md). The slot element itself goes too: the
 *     reference render has no slot, variants do — both facts are part of the
 *     contract, so after normalization both sides agree.
 *  2. Comment nodes — permitted paradigm noise (ADR-0003 §6: SSR boundary
 *     markers and the like). Text they SPLIT is merged back first: React-style
 *     `foo<!-- -->bar` renders as one text run and must compare equal to it.
 *  3. `script`/`style`/`link`/`template` elements — DELIVERY, the measured
 *     variable, not the canonical markup (ADR-0003 §2: a paradigm may inline
 *     critical CSS or emit hydration payloads; the drift gate must not
 *     punish repackaging — only re-valuing, which the pixel check catches).
 *     NOTE: this deliberately widens issue #6's "only the permitted paradigm
 *     noise" list — ADR-0003 §2 wins over the issue text (flagged on the
 *     issue). Like comments, dropped elements are transparent to text runs.
 *  4. The `<head>` subtree — asset links and metadata are delivery. The
 *     `<html>` and `<body>` elements' OWN attributes are contract surface
 *     though (a dropped `lang` is pixel-neutral a11y drift): they are
 *     serialized as the extract's leading lines, through the same noise
 *     filter as every other attribute.
 *  5. Per-variant PERMITTED noise — hydration-marker attributes, scoping
 *     hash classes, and behavior attributes (their own declared class,
 *     ADR-0008), declared in {@link PERMITTED_NOISE} so what each variant
 *     is allowed to add is auditable in exactly one place.
 *  6. Insignificant whitespace — ASCII whitespace runs collapse to one
 *     space; ASCII-whitespace-only text drops (indentation is not drift).
 *     ONLY ASCII: U+00A0 and friends are rendered content per the HTML
 *     spec's whitespace definition, and must compare verbatim.
 *
 * Everything else — elements, nesting, attributes and their values, class
 * names, text — must match the reference render exactly.
 *
 * Serialization is deterministic (sorted attributes, sorted class tokens,
 * one node per line, two-space indent) so equality is a string comparison
 * and a failure diff is human-readable in CI logs.
 */

export interface NoiseSpec {
  /** Regex sources matching ATTRIBUTE NAMES that are permitted noise
   *  (hydration markers and other inert residue). */
  attrPatterns: readonly string[];
  /** Regex sources matching CLASS TOKENS that are permitted scoping hashes. */
  classPatterns: readonly string[];
  /** Regex sources matching BEHAVIOR-ATTRIBUTE NAMES (`hx-*`, `on:*`,
   *  `q:*`): the paradigm's MECHANISM, not residue — ADR-0008's freedoms
   *  list makes them their own declared registry class so a registration is
   *  auditable as "this is how the paradigm works", never smuggled in as
   *  residue. Stripped identically to `attrPatterns`; the distinction is
   *  the audit trail. Minted by the editorial build's slice A so the
   *  behavior-attribute paradigms (Qwik, HTMX) register without touching
   *  this shared type mid-chain. */
  behaviorAttrPatterns: readonly string[];
  /** CSS selectors matching WHOLE ELEMENTS (subtree included) that are
   *  permitted noise — for residue that isn't expressible as an
   *  attribute/class strip because the element itself doesn't exist in the
   *  master (e.g. a framework's own internal streaming/hydration-boundary
   *  wrapper). Optional: only variants that measure a real need register
   *  it (minted by editorial-build slice B for Next's App Router streaming
   *  marker, `body > div[hidden]:first-child` — an empty wrapper around
   *  React's own `<!--$-->`/`<!--/$-->` Suspense-boundary comments, which
   *  the comment-stripping rule already erases; only the wrapping element
   *  remains to account for). Removed the same way the chrome slot already
   *  is — this generalizes that one hardcoded case into registry policy. */
  dropElementSelectors?: readonly string[];
}

/** No permitted noise: what the reference render is held to. */
export const NO_NOISE: NoiseSpec = {
  attrPatterns: [],
  classPatterns: [],
  behaviorAttrPatterns: [],
};

/**
 * The permitted-noise registry — gate POLICY, one auditable place
 * (ADR-0003 §6 names the permitted classes: hydration markers, comment
 * nodes, scoping hashes; comments are dropped unconditionally). Every real
 * variant registers its paradigm's idiomatic noise here when it lands.
 *
 * Registering noise does NOT extend the gate past its boundary: the gate
 * proves the SERVED DOM only (contexts are JS-off) — a hydrating variant's
 * post-hydration mutations are unchecked until the JS-on second pass lands
 * with the first hydrating variant (tools/drift-gate/README.md).
 */
export const PERMITTED_NOISE: Readonly<Record<string, NoiseSpec>> = {
  /** The throwaway SSR placeholder's representative noise (issue #3). */
  "placeholder-ssr": {
    attrPatterns: ["^data-ph-"],
    classPatterns: ["^ph-"],
    behaviorAttrPatterns: [],
  },
  // vanilla registers NOTHING — it is the NO_NOISE control, by design
  // (editorial-build PRD): the absence of an entry here is asserted in the
  // origin suite, and its drift comparison runs under NO_NOISE.
  /** react-next (editorial-build slice B): measured from real served
   *  output (not guessed) — no noisy attributes or scoping-hash classes
   *  anywhere; the one residue is structural, App Router's own streaming
   *  wrapper (see NoiseSpec.dropElementSelectors' doc comment). */
  "react-next": {
    attrPatterns: [],
    classPatterns: [],
    behaviorAttrPatterns: [],
    dropElementSelectors: ["body > div[hidden]:first-child"],
  },
};

/**
 * The in-page normalizer. Passed to `page.evaluate` by
 * `extractNormalizedDom` (gate.ts) — self-contained by construction.
 * Operates on a clone of the document element; never mutates the live page.
 *
 * With `rootSelector` set, serializes only the first matching element's
 * subtree (used to pin the component demo's canonical markup to the surface
 * golden master); returns "" when nothing matches so callers can assert.
 */
export const PAGE_NORMALIZE = (spec: {
  attrPatterns: readonly string[];
  classPatterns: readonly string[];
  behaviorAttrPatterns: readonly string[];
  dropElementSelectors?: readonly string[];
  rootSelector?: string;
}): string => {
  // Behavior attributes strip exactly like inert-residue attributes — the
  // two classes differ in the registry's audit trail, not in mechanics.
  const attrRes = [...spec.attrPatterns, ...spec.behaviorAttrPatterns].map(
    (s) => new RegExp(s),
  );
  const classRes = spec.classPatterns.map((s) => new RegExp(s));
  const DROP_ELEMENTS = new Set(["script", "style", "link", "template"]);
  const VOID_ELEMENTS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "source", "track", "wbr",
  ]);

  // HTML's ASCII whitespace only — NBSP/Unicode spaces are content (§6 above).
  const WS_RUN = /[\t\n\f\r ]+/g;
  const WS_EDGES = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g;
  const escText = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escAttr = (s: string) => escText(s).replace(/"/g, "&quot;");

  const root = document.documentElement.cloneNode(true) as HTMLElement;
  for (const slot of root.querySelectorAll("div#pm-chrome-slot")) slot.remove();
  for (const sel of spec.dropElementSelectors ?? []) {
    for (const el of root.querySelectorAll(sel)) {
      // Content-aware, not just positional: a registration excuses an
      // EMPTY structural artifact (verified case: Next's App Router
      // streaming-metadata wrapper, comment-only when the page's own
      // <title>/<meta> are the only metadata, since those auto-hoist to
      // <head> regardless of tree position). If real markup ever renders
      // inside the matched element (e.g. a future <link>/icon that does
      // NOT auto-hoist), silently deleting the whole subtree would hide
      // that divergence from the drift gate instead of proving it —
      // exactly the failure mode this gate exists to catch. Only comment
      // nodes are tolerated inside; any element child aborts the removal
      // (verify-slice finding: the registration is a scoped noise excuse,
      // never a bulk content eraser).
      if (el.childElementCount === 0) el.remove();
    }
  }

  const normalizedAttrs = (el: Element): string[] => {
    const attrs: string[] = [];
    for (const { name, value } of Array.from(el.attributes)) {
      if (attrRes.some((re) => re.test(name))) continue;
      if (name === "class") {
        const tokens = value
          .split(WS_RUN)
          .filter((t) => t !== "" && !classRes.some((re) => re.test(t)))
          .sort();
        if (tokens.length === 0) continue;
        attrs.push(`class="${escAttr(tokens.join(" "))}"`);
        continue;
      }
      attrs.push(
        `${name}="${escAttr(value.replace(WS_RUN, " ").replace(WS_EDGES, ""))}"`,
      );
    }
    return attrs.sort();
  };
  const openTag = (el: Element): string => {
    const attrs = normalizedAttrs(el);
    return `<${el.localName}${attrs.length > 0 ? " " + attrs.join(" ") : ""}>`;
  };

  const lines: string[] = [];
  const serializeElement = (el: Element, depth: number): void => {
    const indent = "  ".repeat(depth);
    lines.push(indent + openTag(el));
    if (VOID_ELEMENTS.has(el.localName)) return;
    serializeChildren(el, depth + 1);
    lines.push(`${indent}</${el.localName}>`);
  };
  const serializeChildren = (el: Element, depth: number): void => {
    const indent = "  ".repeat(depth);
    // Contiguous text runs merge across dropped nodes (comments, delivery
    // elements): `foo<!-- -->bar` and `foobar` render identically and must
    // normalize identically. Raw values concatenate BEFORE collapsing so
    // `"Kind " + "Of Blue"` keeps its space.
    let textBuf = "";
    const flushText = () => {
      const text = textBuf.replace(WS_RUN, " ").replace(WS_EDGES, "");
      if (text !== "") lines.push(indent + escText(text));
      textBuf = "";
    };
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        textBuf += child.nodeValue ?? "";
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue; // comments et al.
      const childEl = child as Element;
      if (DROP_ELEMENTS.has(childEl.localName)) continue;
      flushText();
      serializeElement(childEl, depth);
    }
    flushText();
  };

  if (spec.rootSelector !== undefined) {
    const scoped = root.querySelector(spec.rootSelector);
    if (scoped === null) return "";
    serializeElement(scoped, 0);
    return lines.join("\n");
  }

  // Document shape: the html/body elements' own attributes are contract
  // surface (§4 above); head content is not.
  lines.push(openTag(root));
  const body = root.querySelector("body");
  if (body === null) return "";
  serializeElement(body, 0);
  return lines.join("\n");
};

/**
 * First point of divergence between two normalized-DOM strings, with
 * surrounding context — the CI-log evidence when the DOM check fails.
 */
export function firstDomDivergence(
  a: string,
  b: string,
  context = 3,
): string | undefined {
  if (a === b) return undefined;
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const n = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < n; i++) {
    if (aLines[i] === bLines[i]) continue;
    const from = Math.max(0, i - context);
    const excerpt = (lines: string[]) =>
      lines
        .slice(from, i + context + 1)
        .map((l, j) => `${from + j === i ? ">" : " "} ${l}`)
        .join("\n");
    return [
      `first divergence at normalized line ${i + 1}:`,
      "--- expected (reference render)",
      excerpt(aLines),
      "+++ actual (variant)",
      excerpt(bLines),
    ].join("\n");
  }
  return "strings differ only in length"; // unreachable in practice
}
