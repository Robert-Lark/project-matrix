/**
 * Every control the PDP master ADVERTISES is wired by the variant that serves
 * it. This is the guard the pdp-controls unit exists to add.
 *
 * Two of the PDP's four advertised interactions shipped DEAD on ~500 deployed
 * pages and nothing anywhere could see it:
 *
 *  - The drift gate compares the SERVED MARKUP with JS OFF (ADR-0008 §7,
 *    `drift.browser.test.ts`). Both dead controls had perfectly correct,
 *    perfectly identical markup — they were dead only with JS ON, which is
 *    precisely the gate's blind spot.
 *  - `@pm/vanilla` contributes ZERO tasks to turbo's 30 (`turbo run lint
 *    typecheck test --dry=json` → 75 nodes, 30 with a real command, none of
 *    them this workspace), so no pre-merge check read `pdp.js` at all.
 *
 * The rule below is the cheap half of the close, and it is deliberately the
 * half that BLOCKS A MERGE: `@pm/repo-checks#test` is one of the 30, needs no
 * browser, no plane and no image bytes. The expensive half — proving the
 * controls actually DO something — is `pdp-controls.browser.test.ts` in the
 * origin suite, which needs a live plane and therefore cannot gate a merge.
 *
 * Neither half is sufficient alone: this one would pass a script that
 * mentions a class and does nothing with it; that one only ever runs the
 * fixture. Together they cover "the script never heard of this control" and
 * "the control does not respond".
 *
 * Per-variant mechanisms (pdp-variants slice 1 generalised what was
 * vanilla-hardcoded — the exact green-on-vanilla-alone gap this file's own
 * completeness assertion was written to block):
 *  - "selectors" — a plain-DOM enhancement (vanilla's pdp.js, astro's
 *    bundled script): its OWN string-literal selectors are extracted and run
 *    against the master DOM, so a control none of its selectors can reach is
 *    reported by markup.
 *  - "names" — a JSX enhancement (react-next, qwik) authors elements rather
 *    than selecting them, so there are no selectors to run; instead every
 *    unexcused control's class must be NAMED as a whole token somewhere in
 *    the registered component sources. Weaker on purpose and stated so: the
 *    behavior half lives in the browser leg, which is variant-generic.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { SURFACE_CONTROLS } from "@pm/switcher";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const MASTERS = ["pdp", "pdp/single-format", "pdp/unpriced", "pdp/one-image"] as const;

interface Enhancement {
  /** Repo-relative source files that together ARE the variant's PDP
   *  enhancement — what must reach the master's controls. */
  readonly files: readonly string[];
  readonly mechanism: "selectors" | "names";
}

/**
 * Where each LIVE PDP variant keeps its enhancement. Deliberately a map plus
 * a completeness assertion rather than a single hardcoded path:
 * `SURFACE_CONTROLS.pdp.variants` is the registry of record, and the test
 * below FAILS if it ever names a variant with no entry here. So the day a
 * variant moves `plannedVariants → variants`, this guard stops the merge
 * until someone points it at that variant's enhancement — rather than
 * quietly continuing to check the others and reporting green.
 */
const ENHANCEMENTS: Record<string, Enhancement> = {
  vanilla: {
    files: ["variants/vanilla/src/pdp.js"],
    mechanism: "selectors",
  },
  "react-next": {
    files: [
      "variants/react-next/src/components/PdpGallery.tsx",
      "variants/react-next/src/components/PdpPurchase.tsx",
      "variants/react-next/src/components/LiveOriginButton.tsx",
    ],
    mechanism: "names",
  },
  astro: {
    files: ["variants/astro/src/scripts/pdp.ts"],
    mechanism: "selectors",
  },
  qwik: {
    files: [
      "variants/qwik/src/components/PdpGallery.tsx",
      "variants/qwik/src/components/PdpPurchase.tsx",
      "variants/qwik/src/components/LiveOriginDemo.tsx",
    ],
    mechanism: "names",
  },
};

/**
 * State attributes CSS cannot set. A rule can style `[aria-pressed="true"]`,
 * but nothing except script can ever make the attribute say "true" — so a
 * master that renders one and an enhancement that never writes it is a
 * control which announces a state it can never enter (WCAG 4.1.2). This is
 * exactly what the Zoom button did.
 */
const SCRIPT_ONLY_STATE = [
  "aria-pressed",
  "aria-expanded",
  "aria-selected",
  // `aria-current` was missing from this list until it was pointed out, and
  // it is the SECOND script-only state on the very page this guards: the
  // gallery's exclusive thumb selection rides it, and moving it is the whole
  // of what a gallery switch does programmatically. (The masthead also
  // renders a STATIC `aria-current="page"`, which needs no script — the rule
  // asks only that the enhancement be able to write the attribute at all, so
  // a static instance never makes it pass vacuously for a live one.)
  "aria-current",
  // `aria-invalid` is the CHECKOUT surface's script-only state, and it was
  // found the same way `aria-current` was — by reading the stylesheet that
  // promises it, not by reading the markup. `field.css:7-8` is explicit:
  // "Error state styles off [aria-invalid], never a class — so the visual
  // defect cannot exist without the programmatic one." No committed master
  // renders it (a served checkout form is pristine, by contract), which is
  // exactly why the styles-derived leg below exists: on this surface the
  // markup alone owes nothing, and reading only the markup would have made
  // the whole rule vacuous.
  "aria-invalid",
] as const;

/**
 * Controls whose behaviour is the BROWSER's, not the enhancement's, with the
 * reason each is exempt. A registry, not a skip: adding a row is a visible
 * edit that has to be argued for, which is the same discipline
 * `PERMITTED_NOISE` follows.
 */
const NATIVE_BEHAVIOUR: Record<string, string> = {
  "pm-skip": "an in-page anchor — the browser moves focus, no script owed",
  "pm-masthead__brand": "navigation",
  "pm-masthead__link": "navigation",
  "pm-masthead__cart": "navigation (its aria-label IS written by cart code)",
  "pm-qty__input": "a native number input; the steppers drive it",
};

/** The checkout's committed master set — ONE page, and data-free: the
 *  reference renderer takes no snapshot at all (`render/build.mjs:78`
 *  discards it). Deliberately NOT merged into `MASTERS` above: the PDP set
 *  is asserted to contain no `pm-format` (addendum A took the cut), and
 *  checkout's shipping-method group is that component's surviving consumer
 *  (ADR-0008 :602-605), so one array would make the two claims contradict. */
const CHECKOUT_MASTERS = ["checkout"] as const;

/**
 * Where each checkout variant keeps its enhancement — the `ENHANCEMENTS`
 * shape, one surface along.
 *
 * Read the completeness legs below together with this map. They used to be
 * temporarily weak — `SURFACE_CONTROLS.checkout.variants` was `[]`, so
 * "every LIVE variant has an entry" ranged over nothing — and that is no
 * longer true: this unit registers `variants: ["vanilla"]`
 * (`packages/switcher/src/config.ts`) in the same commit as the routes it
 * makes true, so the leg now ranges over vanilla and bites. The control and
 * state legs never depended on it either way: they iterate THIS map, the
 * same way the PDP legs do (`Object.entries(ENHANCEMENTS)`, never the
 * registry).
 */
const CHECKOUT_ENHANCEMENTS: Record<string, Enhancement> = {
  vanilla: {
    files: ["variants/vanilla/src/checkout.js"],
    mechanism: "selectors",
  },
};

/**
 * Surfaces whose canonical SERVED markup carries no script-only state at
 * all, with the reason. A registry, not a skip — and asserted in BOTH
 * directions, which is the whole point: the PDP legs prove the rule bites by
 * requiring at least one state attribute in the markup, and simply exempting
 * checkout from that would have been the vacuous pass this file exists to
 * refuse. Instead the entry is a claim the test checks: a checkout master
 * that ever renders one fails here until the entry is removed.
 */
const SERVES_NO_SCRIPT_STATE: Record<string, string> = {
  checkout:
    "a served checkout form is pristine — every state its enhancement writes " +
    "is entered by the visitor, never served (ADR-0008 §7: the canonical " +
    "served state is the empty cart and an unfilled form). What the surface " +
    "owes is derived from its STYLESHEETS instead, by the leg below.",
};

/**
 * Every `@pm/tokens` sheet a master LINKS, comments stripped.
 *
 * Same two moves as `master-styles-resolve.test.ts:115-122` and `:71-73`, and
 * deliberately not shared with it: that file answers "does this class have a
 * rule", this one answers "does this rule promise a state nothing can
 * enter". Making them one helper would couple two guards that must be able
 * to fail independently. The comment strip is load-bearing either way — a
 * class named in a contract comment is not a rule, and these sheets name
 * classes constantly (`facets.css:14` carries a bare `[aria-current="true"]`
 * inside one).
 */
function linkedSheets(surface: string, html: string): string {
  const dir = join(repoRoot, "packages", "reference", "surfaces", surface);
  let css = "";
  for (const m of html.matchAll(/href="([^"]*@pm\/tokens\/css\/[^"]+\.css)"/g)) {
    css += readFileSync(join(dir, m[1]!), "utf8");
  }
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * The script-only states a master's OWN linked sheets promise for classes
 * that master renders inside `<main>`.
 *
 * This is the `pm-pdp__scroll` defect in mirror image. That one was markup
 * promising behaviour no stylesheet implemented; this is a STYLESHEET
 * promising a state no script can produce — `field.css:45` styles
 * `.pm-field__control[aria-invalid="true"]`, and if nothing ever writes the
 * attribute that rule is dead CSS and the error state it draws can never
 * appear. Neither guard sees the other's case.
 *
 * Scoped to `<main>` on purpose, and the boundary is principled rather than
 * convenient: the masthead and footer are the SHELL, rendered per surface by
 * `shell.mjs` with `current` decided at render time (`masthead.css:70` styles
 * `[aria-current="page"]`, which the server writes and no script touches);
 * `<main>` is the surface, and the surface is what a paradigm enhances.
 */
function statesPromisedByStyles(
  surface: string,
  html: string,
  document: ReturnType<typeof parseHTML>["document"],
): string[] {
  const css = linkedSheets(surface, html);
  const main = document.querySelector("main");
  if (main === null) throw new Error(`${surface} has no <main>`);
  const inMain = new Set<string>();
  for (const el of main.querySelectorAll("[class]")) {
    for (const c of (el.getAttribute("class") ?? "").split(/\s+/)) if (c) inMain.add(c);
  }
  const owed = new Set<string>();
  for (const m of css.matchAll(/\.([\w-]+)\[(aria-[\w-]+)=/g)) {
    if (inMain.has(m[1]!) && (SCRIPT_ONLY_STATE as readonly string[]).includes(m[2]!)) {
      owed.add(m[2]!);
    }
  }
  return [...owed].sort();
}

function master(surface: string): string {
  return readFileSync(
    join(repoRoot, "packages", "reference", "surfaces", surface, "index.html"),
    "utf8",
  );
}

function enhancementSource(enhancement: Enhancement): string {
  return codeOnly(
    enhancement.files.map((file) => readFileSync(join(repoRoot, file), "utf8")).join("\n"),
  );
}

/**
 * The enhancement's CODE, with comments removed.
 *
 * Added by checkout-vanilla's sabotage pass, which found this file passing a
 * sabotage it should have failed: the attribute checks below were
 * `script.includes("aria-invalid")` over the RAW file, and every one of these
 * enhancements explains its own state attributes in prose directly above the
 * line that writes them. Rewiring `aria-invalid` to `data-invalid` therefore
 * left five occurrences down to two — both in comments — and the guard
 * reported green.
 *
 * This is a PRE-EXISTING hole, not one this unit introduced: `pdp.js:90` and
 * `:97` name `aria-pressed` in the comment block above the zoom toggle, so
 * deleting the toggle and keeping its explanation would have passed the very
 * guard written to catch the dead zoom. It is the same defect
 * `master-styles-resolve.test.ts:66-73` already fixed one file over — "a
 * class NAMED in a contract comment is not a rule" — arriving here by the
 * other door.
 *
 * String-aware rather than a pair of regexes, because a regex strip would
 * eat the tail of any `"https://…"` literal and silently weaken the check it
 * is meant to strengthen. Known limit, stated: a REGEX literal containing a
 * quote character would confuse the scanner. None of the registered
 * enhancements contains one (checked), and if one ever does, the failure
 * mode is a false ALARM — a guard that fails loudly — not a false pass.
 */
function codeOnly(source: string): string {
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

/**
 * Can this enhancement reach a given element? Extracted from the PDP loop
 * when the checkout surface arrived (checkout-vanilla), because the two
 * surfaces must answer the question the SAME way: two copies of this rule
 * would be two rules, and the repo's own lesson is that a duplicated
 * contract diverges silently (CART_CONTRACT's uniqueness clause, seven
 * `read()`s). The PDP loop below is unchanged in behaviour — its own legs
 * assert the same thresholds they always did.
 */
function reachOf(
  script: string,
  mechanism: Enhancement["mechanism"],
  document: ReturnType<typeof parseHTML>["document"],
): { reaches: (raw: unknown, classes: string[]) => boolean; matched: number } {
  // The "selectors" mechanism runs the enhancement's OWN selectors against
  // the master DOM rather than substring-matching class names. Substring
  // matching cannot tell two controls apart when they share a class: the PDP
  // renders `pm-button` twice (add-to-cart and the fenced live-origin
  // button), so a dead live-origin handler passed an earlier draft purely
  // because `pm-button` appeared in the file for the OTHER button. The
  // "names" mechanism accepts that limit knowingly (JSX has no selectors to
  // run) — its behavior half is the browser leg, which presses every button
  // per variant.
  if (mechanism === "selectors") {
    const selected = new Set<unknown>();
    const selectors = [...script.matchAll(/["'`]([^"'`\n]*[.#[][^"'`\n]*)["'`]/g)]
      .map((m) => m[1]!.trim())
      .filter((sel) => sel.length > 1);
    for (const sel of selectors) {
      try {
        for (const el of document.querySelectorAll(sel)) selected.add(el);
      } catch {
        /* not a selector — a regex, a URL, a message string */
      }
    }
    return { reaches: (raw) => selected.has(raw), matched: selected.size };
  }
  const namedClasses = new Set<string>();
  for (const token of script.matchAll(/[\w-]+/g)) namedClasses.add(token[0]!);
  return {
    reaches: (_raw, classes) => classes.some((c) => namedClasses.has(c)),
    matched: [...namedClasses].filter((c) => c.startsWith("pm-")).length,
  };
}

describe("the PDP master advertises no control the variant leaves dead", () => {
  it("every LIVE PDP variant has a registered enhancement to check", () => {
    const live = SURFACE_CONTROLS["pdp"]!.variants;
    expect(live.length).toBeGreaterThan(0);
    const unregistered = live.filter((v) => !(v in ENHANCEMENTS));
    expect(
      unregistered,
      "a PDP variant is live but this guard does not know where its enhancement lives — " +
        "point ENHANCEMENTS at it; do not let the guard keep reporting green on the others alone",
    ).toEqual([]);
  });

  for (const [variant, enhancement] of Object.entries(ENHANCEMENTS)) {
    const script = enhancementSource(enhancement);

    for (const surface of MASTERS) {
      it(`${variant} · ${surface}: every script-only state attribute the master renders is written by the enhancement`, () => {
        const { document } = parseHTML(master(surface));
        const rendered = SCRIPT_ONLY_STATE.filter(
          (attr) => document.querySelectorAll(`[${attr}]`).length > 0,
        );
        expect(rendered.length).toBeGreaterThan(0);
        for (const attr of rendered) {
          expect(
            script.includes(attr),
            `${surface} renders [${attr}] but ${variant}'s enhancement never writes it — ` +
              `the control announces a state it can never enter`,
          ).toBe(true);
        }
      });

      it(`${variant} · ${surface}: every script-only state the master's own sheets promise is written by the enhancement`, () => {
        // The markup-derived leg above and this one find different things,
        // and the PDP is where that is easiest to see: `gallery.css:67`
        // scales the stage from `[aria-pressed="true"]` and `:128` marks the
        // current thumb from `[aria-current="true"]`, so the sheets promise
        // the same two states the markup renders. On checkout they diverge
        // completely — the markup renders none and the sheets promise
        // `aria-invalid` — which is why this leg exists. The PDP passes it
        // today unchanged; it is not a new demand on any PDP variant.
        const { document } = parseHTML(master(surface));
        const promised = statesPromisedByStyles(surface, master(surface), document);
        expect(
          promised.length,
          `${surface}'s linked sheets promise no script-only state at all`,
        ).toBeGreaterThan(0);
        for (const attr of promised) {
          expect(
            script.includes(attr),
            `${surface}'s sheets style [${attr}] but ${variant}'s enhancement never writes it — ` +
              `the rule can never match, and the state it draws can never appear`,
          ).toBe(true);
        }
      });

      it(`${variant} · ${surface}: every button and focusable region the master renders is reached by the enhancement`, () => {
        const { document } = parseHTML(master(surface));
        const controls = [
          ...document.querySelectorAll("button, input, select, textarea, [tabindex]"),
        ];
        expect(controls.length).toBeGreaterThan(0);

        // The "selectors" mechanism runs the enhancement's OWN selectors
        // against the master DOM rather than substring-matching class names.
        // Substring matching cannot tell two controls apart when they share a
        // class: the PDP renders `pm-button` twice (add-to-cart and the
        // fenced live-origin button), so a dead live-origin handler passed an
        // earlier draft purely because `pm-button` appeared in the file for
        // the OTHER button. The "names" mechanism accepts that limit
        // knowingly (JSX has no selectors to run) — its behavior half is the
        // browser leg, which presses every button per variant.
        const { reaches, matched } = reachOf(script, enhancement.mechanism, document);
        // Non-vacuity: a file whose selectors matched nothing would "pass"
        // every control below only if the registry excused them all.
        expect(
          matched,
          `${variant}'s enhancement reaches nothing in the master`,
        ).toBeGreaterThan(2);

        const unwired: string[] = [];
        for (const raw of controls) {
          const el = raw as unknown as {
            getAttribute: (n: string) => string | null;
            outerHTML: string;
          };
          const classes = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
          if (classes.some((c) => c in NATIVE_BEHAVIOUR)) continue;
          // A focusable scroll REGION is behaviour the stylesheet owns
          // (pdp.css `.pm-pdp__scroll { overflow-x: auto }`); script owes it
          // nothing, but something must — it shipped styled by NOTHING, a
          // focus stop on a container that could not scroll.
          if (el.getAttribute("role") === "region") {
            const css = readFileSync(
              join(repoRoot, "packages", "tokens", "css", "surfaces", "pdp.css"),
              "utf8",
            );
            for (const c of classes) {
              expect(css.includes(`.${c}`), `${c} is focusable but styled by nothing`).toBe(true);
            }
            continue;
          }
          if (!reaches(raw, classes)) unwired.push(el.outerHTML.slice(0, 120));
        }
        expect(unwired, `${surface}: controls ${variant}'s enhancement never reaches`).toEqual([]);
      });
    }
  }

  it("fires on the two controls that actually shipped dead", () => {
    // The exact pre-repair state: the master's markup with an enhancement
    // that never names either control. Both halves of the rule must fail.
    const { document } = parseHTML(master("pdp"));
    const deadScript = "/* an enhancement that does gallery and cart only */ pm-gallery__thumb";
    expect(document.querySelectorAll("[aria-pressed]").length).toBeGreaterThan(0);
    expect(deadScript.includes("aria-pressed")).toBe(false);
    expect(deadScript.includes("pm-gallery__zoom")).toBe(false);
    // …and every live enhancement passes both, which is what makes the
    // assertion above a proof rather than a restatement.
    for (const enhancement of Object.values(ENHANCEMENTS)) {
      const script = enhancementSource(enhancement);
      expect(script.includes("aria-pressed")).toBe(true);
      expect(script.includes("pm-gallery__zoom")).toBe(true);
    }
  });

  it("the format control is gone from the master, not merely unwired", () => {
    // ADR-0008 addendum A took the CUT rather than the wiring: `formats` is
    // the composition of one release, and the tray has one price and one
    // stock count for the whole release, so there was no choice to honour.
    // Shipping it inert was never a third option.
    for (const surface of MASTERS) {
      expect(master(surface)).not.toContain("pm-format");
      expect(master(surface)).not.toContain('name="format"');
    }
    // The DATA it carried survives, on every master rather than only the
    // single-format ones.
    for (const surface of MASTERS) {
      expect(master(surface)).toContain("<dt>Format</dt>");
    }
  });
});

/**
 * The same rule, one surface along (checkout-vanilla).
 *
 * A checkout form is the PDP's failure shape with more controls: fifteen of
 * them, markup that will be identical across three paradigms, and — before
 * this block — nothing pre-merge reading a line of the enhancement. The
 * `MASTERS` array above named four PDP pages and the loop iterated
 * `SURFACE_CONTROLS.pdp.variants`, so this file asserted NOTHING WHATSOEVER
 * about checkout while appearing, from its filename and its green tick, to
 * be the repo's control-wiring guard.
 *
 * What is deliberately different here, and why:
 *  - The markup-derived state leg inverts. Every PDP master renders at least
 *    one script-only state attribute, and the PDP leg asserts that to prove
 *    itself non-vacuous. A served checkout form renders NONE, correctly, so
 *    the same assertion would fail on a correct page. The registry
 *    (`SERVES_NO_SCRIPT_STATE`) turns that into a checked claim rather than
 *    an exemption, and the styles-derived leg supplies the bite.
 *  - A submit button is excused structurally, never by class. See below.
 */
describe("the checkout master advertises no control the variant leaves dead", () => {
  it("every LIVE checkout variant has a registered enhancement to check", () => {
    // No longer vacuous: this unit moved `vanilla` from `plannedVariants`
    // into `variants`, so the loop ranges over one real variant and the
    // guard bites. That is the case it was written for — the moment a
    // variant goes live, the merge stops until someone points this file at
    // that variant's enhancement. `react-next` and `htmx` are still planned
    // and still correctly outside it.
    const live = SURFACE_CONTROLS["checkout"]!.variants;
    const unregistered = live.filter((v) => !(v in CHECKOUT_ENHANCEMENTS));
    expect(
      unregistered,
      "a checkout variant is live but this guard does not know where its enhancement lives — " +
        "point CHECKOUT_ENHANCEMENTS at it; do not let the guard report green on the others alone",
    ).toEqual([]);
  });

  it("the enhancement map names only variants this surface actually plans", () => {
    // The other direction, and the one that is NOT vacuous today: a map
    // entry for a variant the registry has never heard of would be a guard
    // checking a file nobody serves — green, and about nothing.
    const controls = SURFACE_CONTROLS["checkout"]!;
    const known = new Set([...controls.variants, ...(controls.plannedVariants ?? [])]);
    expect(known.size, "the checkout registry names no variants at all").toBeGreaterThan(0);
    for (const variant of Object.keys(CHECKOUT_ENHANCEMENTS)) {
      expect(
        known.has(variant),
        `CHECKOUT_ENHANCEMENTS names ${variant}, which the checkout registry does not plan`,
      ).toBe(true);
    }
  });

  for (const [variant, enhancement] of Object.entries(CHECKOUT_ENHANCEMENTS)) {
    const script = enhancementSource(enhancement);

    for (const surface of CHECKOUT_MASTERS) {
      it(`${variant} · ${surface}: the master serves no script-only state, and the registry says so`, () => {
        const { document } = parseHTML(master(surface));
        const rendered = SCRIPT_ONLY_STATE.filter(
          (attr) => document.querySelectorAll(`[${attr}]`).length > 0,
        );
        expect(
          surface in SERVES_NO_SCRIPT_STATE,
          `${surface} is not in SERVES_NO_SCRIPT_STATE — say what it serves, or use the PDP leg`,
        ).toBe(true);
        // The registry entry is a CLAIM about the markup, checked here. A
        // master that gains `aria-expanded` on a collapsible section fails
        // this until someone either wires it or removes the entry.
        expect(
          rendered,
          `${surface} renders script-only state the registry claims it never serves — ` +
            `either the enhancement must write it or the registry entry is now false`,
        ).toEqual([]);
      });

      it(`${variant} · ${surface}: every script-only state the master's own sheets promise is written by the enhancement`, () => {
        // This is where the surface's rule actually bites. `field.css:45`
        // styles `.pm-field__control[aria-invalid="true"]` and the master
        // renders twelve `.pm-field__control`s, so the sheet promises an
        // error state on every field on the page. Nothing but script can
        // produce it.
        const { document } = parseHTML(master(surface));
        const promised = statesPromisedByStyles(surface, master(surface), document);
        expect(
          promised,
          `${surface}'s linked sheets promise no script-only state — this leg is vacuous`,
        ).not.toEqual([]);
        for (const attr of promised) {
          expect(
            script.includes(attr),
            `${surface}'s sheets style [${attr}] but ${variant}'s enhancement never writes it — ` +
              `the rule can never match, and the error state it draws can never appear`,
          ).toBe(true);
        }
      });

      it(`${variant} · ${surface}: every control the master renders is reached by the enhancement`, () => {
        const { document } = parseHTML(master(surface));
        const controls = [
          ...document.querySelectorAll("button, input, select, textarea, [tabindex]"),
        ];
        // Fifteen on this page: twelve `.pm-field__control` (eleven inputs
        // and the country select), two shipping radios, one submit button.
        expect(controls.length).toBeGreaterThan(10);

        const { reaches, matched } = reachOf(script, enhancement.mechanism, document);
        expect(
          matched,
          `${variant}'s enhancement reaches nothing in the master`,
        ).toBeGreaterThan(2);

        const unwired: string[] = [];
        for (const raw of controls) {
          const el = raw as unknown as {
            getAttribute: (n: string) => string | null;
            closest: (s: string) => unknown;
            outerHTML: string;
          };
          const classes = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
          if (classes.some((c) => c in NATIVE_BEHAVIOUR)) continue;
          // A submit button inside a form the enhancement REACHES is
          // reached: the browser routes the press to that form's `submit`
          // event, and that event is where the whole invalid-submit contract
          // lives (ADR-0008 §7 — render the error summary, move focus). This
          // is STRUCTURAL rather than a `NATIVE_BEHAVIOUR` row on purpose:
          // the button's class is `pm-button`, which is also the PDP's
          // add-to-cart, so a class row would blanket-excuse the very
          // control the PDP guard was written for. And it is not a free
          // pass — it applies only when the enhancement reaches the form
          // itself, so an enhancement that never binds `submit` still fails.
          if (el.getAttribute("type") === "submit") {
            const form = el.closest("form");
            if (form !== null && reaches(form, [])) continue;
          }
          if (!reaches(raw, classes)) unwired.push(el.outerHTML.slice(0, 120));
        }
        expect(unwired, `${surface}: controls ${variant}'s enhancement never reaches`).toEqual([]);
      });
    }
  }

  it("fires on an enhancement that leaves the form dead", () => {
    // The PDP block's self-proof, this surface's version: the exact shape a
    // checkout enhancement fails in — one that does the cart badge (which
    // every shell page does anyway) and never touches the form. Both halves
    // of the rule must fail on it, and pass on the real one, which is what
    // makes the assertions above a proof rather than a restatement.
    const { document } = parseHTML(master("checkout"));
    const deadScript = '/* a cart badge and nothing else */ "[data-pm-cart-count]"';
    expect(document.querySelectorAll(".pm-field__control").length).toBeGreaterThan(10);
    expect(deadScript.includes("aria-invalid")).toBe(false);
    const dead = reachOf(deadScript, "selectors", document);
    expect(dead.reaches(document.querySelector(".pm-checkout__form"), [])).toBe(false);

    for (const enhancement of Object.values(CHECKOUT_ENHANCEMENTS)) {
      const script = enhancementSource(enhancement);
      expect(script.includes("aria-invalid")).toBe(true);
      const live = reachOf(script, enhancement.mechanism, document);
      expect(live.reaches(document.querySelector(".pm-checkout__form"), [])).toBe(true);
      expect(live.reaches(document.querySelector("#card"), [])).toBe(true);
    }
  });
});
