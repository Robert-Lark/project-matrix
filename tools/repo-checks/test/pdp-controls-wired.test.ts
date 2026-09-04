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
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

/**
 * The same rule, on the accessibility exhibit (a11y-section build,
 * 2026-09-03) — the surface where a dead control is the project's worst
 * possible bug, because the page's whole claim is that its controls behave.
 *
 * Three pages, one enhancement (variants/vanilla/src/a11y.js), and two
 * registries the other blocks did not need, each a CHECKED claim:
 *  - SPECIMENS. The focus, target-size and mode-stage demos render the
 *    store's own button as an exhibit of its RENDERING; the forms demo
 *    renders the field in its error-wired state as an exhibit of that WIRING.
 *    A specimen BUTTON is still wired — a11y.js answers every press through
 *    the shell's status region (the behave test drives it) — so the reach leg
 *    holds them like any control. The two INPUTS are the exception: typing is
 *    the browser's and the served wiring is the demo, so they are registered
 *    native by class WITH the reason — and the leg asserts every such element
 *    sits inside a compare box, so the row cannot excuse a real form field
 *    anywhere else on the surface.
 *  - SERVED SPECIMEN STATE. The forms demo serves `aria-invalid="true"` (the
 *    state IS the exhibit), so the "every rendered script-only state is
 *    written by the enhancement" rule would demand a11y.js write an attribute
 *    the page deliberately serves static. The registry names the attribute,
 *    the one selector it may appear on, and the exact count; every OTHER
 *    rendered or sheet-promised script-only state (aria-pressed, here) must
 *    still be written by the enhancement, and the leg proves that half bites.
 */
const A11Y_ENHANCEMENTS: Record<string, Enhancement> = {
  vanilla: {
    files: ["variants/vanilla/src/a11y.js"],
    mechanism: "selectors",
  },
};

/** The committed a11y masters that render controls, DERIVED FROM DISK — the
 *  index is asserted control-free separately, and a fourth master committed
 *  tomorrow joins this loop by existing rather than by being remembered. The
 *  sibling guard in this same slice
 *  (`variants/vanilla/test/a11y-master-identity.test.mjs`) derives the identical
 *  set the same way; a hand-typed array beside a derived one is the
 *  record-not-code shape `master-styles-resolve` already records paying for
 *  (its own master list said "eight" through three additions). */
function a11yControlMasters(): string[] {
  const dir = join(repoRoot, "packages", "reference", "surfaces", "a11y");
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && existsSync(join(dir, entry.name, "index.html"))) {
      found.push(`a11y/${entry.name}`);
    }
  }
  return found.sort();
}
const A11Y_CONTROL_MASTERS = a11yControlMasters();

/** Controls the BROWSER owns on this surface: class, the tag it must be, and
 *  exactly how many the masters may render. All three, because a bare class
 *  row is an open door — a `<button class="pm-field__control">` dropped into
 *  a compare box, or a sixth field added to the forms demo, would inherit the
 *  exemption without anyone arguing for it (F-S3, verification pass). The
 *  count is the registry's teeth: it fails on the change rather than after
 *  it. Every excused element must also sit inside a compare box, asserted
 *  below, so the row can never excuse a real form field elsewhere. */
const A11Y_SPECIMEN_NATIVE: Record<string, { tag: string; count: number; reason: string }> = {
  "pm-field__control": {
    tag: "input",
    count: 2, // the DS-ON field and its placeholder-only twin
    reason:
      "the forms demo's field, served in its error-wired state — typing is the browser's; " +
      "the wiring the screen reader announces is the exhibit (a11y.mjs demo-forms)",
  },
};

const A11Y_SERVED_SPECIMEN_STATE: Record<string, { selector: string; count: number; reason: string }> = {
  "aria-invalid": {
    selector: '.pm-compare__box .pm-field__control[aria-invalid="true"]',
    count: 1,
    reason:
      "the forms demo's DS-ON field displays the error-wired state as its exhibit — " +
      "the attribute is served, never entered (a11y.mjs demo-forms)",
  },
};

describe("the a11y masters advertise no control the variant leaves dead", () => {
  it("every LIVE a11y variant has a registered enhancement to check", () => {
    const controls = SURFACE_CONTROLS["a11y"]!;
    // The registration ships with the routes (decision map, 2026-08-29): a
    // served section whose registry still says `variants: []` is the
    // parallel-builds falsehood, and this leg would be vacuous over it.
    expect(
      controls.variants.length,
      "a11y registers no live variant — either the section is unserved or the registration was left out of the commit that served it",
    ).toBeGreaterThan(0);
    expect(controls.singleton, "a11y is a singleton off the benchmarked matrix").toBe(true);
    const unregistered = controls.variants.filter((v) => !(v in A11Y_ENHANCEMENTS));
    expect(
      unregistered,
      "an a11y variant is live but this guard does not know where its enhancement lives — point A11Y_ENHANCEMENTS at it",
    ).toEqual([]);
  });

  it("the enhancement map names only the variant the registry serves", () => {
    const controls = SURFACE_CONTROLS["a11y"]!;
    for (const variant of Object.keys(A11Y_ENHANCEMENTS)) {
      expect(controls.variants, `A11Y_ENHANCEMENTS names ${variant}, which the a11y registry does not serve`).toContain(variant);
    }
  });

  it("the index page renders no control and no script-only state — a checked claim, not a skipped page", () => {
    const { document } = parseHTML(master("a11y"));
    expect([...document.querySelectorAll("button, input, select, textarea, [tabindex]")]).toEqual([]);
    for (const attr of SCRIPT_ONLY_STATE) {
      expect(document.querySelectorAll(`[${attr}]`).length, `index renders [${attr}]`).toBe(0);
    }
    // But it IS the shell: the masthead's cart link is there for the badge
    // the enhancement populates (CART_CONTRACT).
    expect(document.querySelectorAll("[data-pm-cart-count]").length).toBe(1);
  });

  for (const [variant, enhancement] of Object.entries(A11Y_ENHANCEMENTS)) {
    const script = enhancementSource(enhancement);

    for (const surface of A11Y_CONTROL_MASTERS) {
      it(`${variant} · ${surface}: every script-only state the master renders is written by the enhancement, or is the registered served specimen`, () => {
        const { document } = parseHTML(master(surface));
        const rendered = SCRIPT_ONLY_STATE.filter(
          (attr) => document.querySelectorAll(`[${attr}]`).length > 0,
        );
        expect(rendered.length, `${surface} renders no script-only state — this leg is vacuous`).toBeGreaterThan(0);
        for (const attr of rendered) {
          const served = A11Y_SERVED_SPECIMEN_STATE[attr];
          if (served) {
            // The registry is a claim about the markup, checked: exactly
            // `count` instances on the surface, every one of them the
            // registered specimen. A second [aria-invalid] anywhere on the
            // page fails here until it is wired or registered.
            const all = document.querySelectorAll(`[${attr}]`).length;
            const registered = document.querySelectorAll(served.selector).length;
            expect(
              all,
              `${surface}: [${attr}] appears ${all}× but the registry excuses ${served.count} served specimen(s)`,
            ).toBe(served.count);
            expect(registered, `${surface}: [${attr}] is not on the registered specimen`).toBe(served.count);
            continue;
          }
          expect(
            script.includes(attr),
            `${surface} renders [${attr}] but ${variant}'s enhancement never writes it — ` +
              `the control announces a state it can never enter`,
          ).toBe(true);
        }
      });

      it(`${variant} · ${surface}: every script-only state the master's own sheets promise is written by the enhancement, unless the master serves it`, () => {
        const { document } = parseHTML(master(surface));
        const promised = statesPromisedByStyles(surface, master(surface), document);
        expect(promised.length, `${surface}'s linked sheets promise no script-only state — vacuous`).toBeGreaterThan(0);
        for (const attr of promised) {
          if (attr in A11Y_SERVED_SPECIMEN_STATE) {
            // The rule CAN match: the master itself carries the attribute.
            expect(document.querySelectorAll(`[${attr}]`).length).toBeGreaterThan(0);
            continue;
          }
          expect(
            script.includes(attr),
            `${surface}'s sheets style [${attr}] but ${variant}'s enhancement never writes it — ` +
              `the rule can never match, and the state it draws can never appear`,
          ).toBe(true);
        }
      });

      it(`${variant} · ${surface}: every control the master renders is reached by the enhancement`, () => {
        const { document } = parseHTML(master(surface));
        const controls = [
          ...document.querySelectorAll("button, input, select, textarea, [tabindex]"),
        ];
        expect(controls.length).toBeGreaterThan(3);
        const { reaches, matched } = reachOf(script, enhancement.mechanism, document);
        expect(matched, `${variant}'s enhancement reaches nothing in the master`).toBeGreaterThan(2);

        const unwired: string[] = [];
        for (const raw of controls) {
          const el = raw as unknown as {
            getAttribute: (n: string) => string | null;
            closest: (s: string) => unknown;
            outerHTML: string;
          };
          const classes = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
          if (classes.some((c) => c in NATIVE_BEHAVIOUR)) continue;
          const excused = classes.map((c) => A11Y_SPECIMEN_NATIVE[c]).find(Boolean);
          if (excused) {
            // Inside a compare box and nowhere else…
            expect(
              el.closest(".pm-compare__box"),
              `${surface}: a ${classes.join(" ")} outside a compare box is a real control, not a specimen`,
            ).not.toBeNull();
            // …and the TAG the row names. A button wearing a field's class is
            // a control, not a specimen, and must be wired like one.
            expect(
              (el as unknown as { tagName: string }).tagName.toLowerCase(),
              `${surface}: the specimen row excuses <${excused.tag}>, not this`,
            ).toBe(excused.tag);
            continue;
          }
          if (!reaches(raw, classes)) unwired.push(el.outerHTML.slice(0, 120));
        }
        expect(unwired, `${surface}: controls ${variant}'s enhancement never reaches`).toEqual([]);
      });
    }
  }

  it("the specimen registry's counts are exactly what the masters render — the row's teeth", () => {
    // A registry that excuses "any number of these" excuses the next one too.
    for (const [cls, row] of Object.entries(A11Y_SPECIMEN_NATIVE)) {
      let seen = 0;
      for (const surface of A11Y_CONTROL_MASTERS) {
        const { document } = parseHTML(master(surface));
        for (const el of document.querySelectorAll(`.${cls}`)) {
          seen += 1;
          expect(
            el.closest(".pm-compare__box"),
            `${surface}: a .${cls} outside a compare box`,
          ).not.toBeNull();
        }
      }
      expect(seen, `.${cls}: the registry excuses ${row.count}, the masters render ${seen}`).toBe(row.count);
    }
  });

  it("mode-demos: the emulation is keyed on the toggle's own aria-pressed — the ONE state the enhancement writes", () => {
    // mode-demo.css applies each emulation from
    // `.pm-mode__toggle[aria-pressed="true"] + .pm-mode__stage[data-pm-mode="…"]`,
    // so the visual state cannot exist without the programmatic one (ADR-0003
    // §5) — which holds only if the master places every stage DIRECTLY after
    // its toggle with matching keys, and every mode has its rule.
    const html = master("a11y/mode-demos");
    const { document } = parseHTML(html);
    const toggles = [...document.querySelectorAll(".pm-mode__toggle")] as unknown as Element[];
    expect(toggles.length).toBe(3);
    const css = linkedSheets("a11y/mode-demos", html);
    for (const toggle of toggles) {
      const mode = toggle.getAttribute("data-pm-mode-toggle");
      expect(mode).toBeTruthy();
      const stage = toggle.nextElementSibling;
      expect(stage?.classList.contains("pm-mode__stage"), `${mode}: the stage is not adjacent to its toggle`).toBe(true);
      expect(stage?.getAttribute("data-pm-mode")).toBe(mode);
      expect(css).toContain(
        `.pm-mode__toggle[aria-pressed="true"] + .pm-mode__stage[data-pm-mode="${mode}"]`,
      );
    }
  });

  it("fires on an enhancement that does the badge and nothing else", () => {
    // The other blocks' self-proof, this surface's version: the shape an
    // exhibit enhancement fails in — one that populates the cart badge (every
    // shell page does) and never touches a demo. Both halves must fail on it
    // and pass on the real one.
    const { document } = parseHTML(master("a11y/mode-demos"));
    const deadScript = '/* a cart badge and nothing else */ "[data-pm-cart-count]"';
    expect(deadScript.includes("aria-pressed")).toBe(false);
    const dead = reachOf(deadScript, "selectors", document);
    expect(dead.reaches(document.querySelector(".pm-mode__toggle"), [])).toBe(false);
    for (const enhancement of Object.values(A11Y_ENHANCEMENTS)) {
      const script = enhancementSource(enhancement);
      expect(script.includes("aria-pressed")).toBe(true);
      const live = reachOf(script, enhancement.mechanism, document);
      expect(live.reaches(document.querySelector(".pm-mode__toggle"), [])).toBe(true);
      expect(live.reaches(document.querySelector(".pm-mode__stage button.pm-button"), [])).toBe(true);
      const demos = parseHTML(master("a11y/element-demos")).document;
      const liveDemos = reachOf(script, enhancement.mechanism, demos);
      expect(liveDemos.reaches(demos.querySelector('[data-pm-demo="status-off"]'), [])).toBe(true);
    }
  });
});
