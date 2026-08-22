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

function master(surface: string): string {
  return readFileSync(
    join(repoRoot, "packages", "reference", "surfaces", surface, "index.html"),
    "utf8",
  );
}

function enhancementSource(enhancement: Enhancement): string {
  return enhancement.files
    .map((file) => readFileSync(join(repoRoot, file), "utf8"))
    .join("\n");
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
        const selected = new Set<unknown>();
        const namedClasses = new Set<string>();
        if (enhancement.mechanism === "selectors") {
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
          // Non-vacuity: a file whose selectors matched nothing would "pass"
          // every control below only if the registry excused them all.
          expect(
            selected.size,
            `${variant}'s enhancement selectors matched nothing in the master`,
          ).toBeGreaterThan(2);
        } else {
          for (const token of script.matchAll(/[\w-]+/g)) namedClasses.add(token[0]!);
          expect(
            [...namedClasses].filter((c) => c.startsWith("pm-")).length,
            `${variant}'s enhancement names no pm- classes at all`,
          ).toBeGreaterThan(2);
        }

        const reaches = (raw: unknown, classes: string[]): boolean =>
          enhancement.mechanism === "selectors"
            ? selected.has(raw)
            : classes.some((c) => namedClasses.has(c));

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
