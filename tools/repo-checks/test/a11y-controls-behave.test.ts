/**
 * The a11y section's controls DO what the page says — driven, not inspected
 * (a11y-section build, 2026-09-03; the checkout-controls-behave pattern).
 *
 * `pdp-controls-wired.test.ts`'s a11y block proves the enhancement can REACH
 * every control the masters render. This file runs the REAL `a11y.js` against
 * the REAL served pages (variants/vanilla/render.mjs renderA11yPage — the
 * same call build.mjs makes) in linkedom, before merge, with no plane and no
 * ports, and holds it to the promises the page makes ON ITSELF:
 *
 *  - the live-region demo writes the same sentence into each twin's OWN
 *    output slot — the DS-ON slot is role="status", the DS-OFF slot a plain
 *    element — and never into the shell's status region (routing the DS-OFF
 *    twin there would announce the silence the exhibit exists to show);
 *  - a mode toggle writes its own `aria-pressed` and NOTHING ELSE: no
 *    attribute on <html> or <body>, no class, no inline style, no <style>
 *    element — the emulation is stage-scoped CSS keyed on that one attribute,
 *    which is what makes "these demos never override your OS setting" true;
 *  - no DS-OFF <details> is ever opened by script;
 *  - a specimen answers in the page's OWN visible `role="status"` line,
 *    naming the demo AND the side, so the two twins of a compare never
 *    produce the same string (a live region does not re-announce unchanged
 *    text, and telling the twins apart is the task);
 *  - the masthead badge reads the cart (CART_CONTRACT, the fourth vanilla
 *    read(), uniqueness clause included) and the script never WRITES storage.
 *
 * Plus the one CSS claim the emulation makes: the forced-colors rule's
 * custom-property declarations are the real media query's, verbatim — held
 * equal here so the demonstration of the seam cannot drift from the seam.
 *
 * What this cannot do, stated: linkedom has no layout, no computed styles and
 * no focus order. That the emulation actually PAINTS, that a closed twin is
 * actually unfocusable, and that a real OS preference wins over the toggle
 * are the browser leg's (tools/origin-suite/suite/a11y.browser.test.ts),
 * which needs a plane and therefore cannot gate a merge.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const scriptPath = join(repoRoot, "variants", "vanilla", "src", "a11y.js");
const tokensCss = join(repoRoot, "packages", "tokens", "css");

type Page = "a11y" | "a11y/element-demos" | "a11y/mode-demos";
const PAGES: readonly Page[] = ["a11y", "a11y/element-demos", "a11y/mode-demos"];

let served: Record<Page, string>;
let enhancement: string;

beforeAll(async () => {
  // The SERVED documents, from the variant's own renderer — never a
  // hand-written fixture, which is the thing that silently stops matching.
  const vanilla = await import(
    pathToFileURL(join(repoRoot, "variants", "vanilla", "render.mjs")).href
  );
  served = Object.fromEntries(
    PAGES.map((rel) => [rel, vanilla.renderA11yPage(rel) as string]),
  ) as Record<Page, string>;
  enhancement = readFileSync(scriptPath, "utf8");
});

interface Env {
  document: Document;
  writes: number;
}

/** Run the real enhancement over the real served document. */
function run(rel: Page, stored: unknown = null): Env {
  const { document } = parseHTML(served[rel]) as unknown as { document: Document };
  const store = new Map<string, string>();
  if (stored !== null) store.set("pm:cart", JSON.stringify(stored));
  const env: Env = { document, writes: 0 };
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      env.writes += 1;
      store.set(k, v);
    },
  };
  new Function("document", "localStorage", enhancement)(document, localStorage);
  return env;
}

const click = (el: unknown): void => {
  const node = el as { ownerDocument: { defaultView: { Event: typeof Event } }; dispatchEvent: (e: Event) => void };
  node.dispatchEvent(new node.ownerDocument.defaultView.Event("click", { bubbles: true }));
};
const $ = (env: Env, sel: string): Element => {
  const el = env.document.querySelector(sel);
  if (el === null) throw new Error(`no ${sel} in the served page`);
  return el;
};
const $$ = (env: Env, sel: string): Element[] => [...env.document.querySelectorAll(sel)];

/** A fingerprint of EVERY element and EVERY attribute in the document, with
 *  the one attribute a toggle is allowed to write masked out, plus the
 *  `<details>` open states and the `<style>` element count.
 *
 *  Deliberately total rather than a list of suspects. The first draft
 *  captured only `<html>`/`<body>` attributes, classes and inline styles —
 *  enough for the failure the guard was written for (a class on the root, an
 *  inline style on the stage), but NARROWER THAN ITS OWN TEST NAME, which
 *  says the toggle touches nothing but its own `aria-pressed`. A guard whose
 *  name claims more than it checks is the vacuity this repo treats as the
 *  defect, so the check now covers what the name says: any attribute written
 *  anywhere — a `data-` hook on a compare box, an `aria-hidden` on a stage, a
 *  `hidden` on a twin — moves this string. `aria-pressed` on the toggles is
 *  masked because writing it is the whole permitted behaviour; a toggle
 *  writing `aria-pressed` on anything ELSE is not masked and still fails. */
function untouchables(env: Env): string {
  const shape = (el: Element): string => {
    const isToggle = el.classList.contains("pm-mode__toggle");
    const attrs = [...el.attributes]
      .filter((a) => !(isToggle && a.name === "aria-pressed"))
      .map((a) => `${a.name}=${a.value}`)
      .sort()
      .join("|");
    return `${el.tagName.toLowerCase()}[${attrs}]`;
  };
  return JSON.stringify({
    elements: $$(env, "*").map(shape),
    open: $$(env, "details").map((el) => el.hasAttribute("open")),
    styleElements: $$(env, "style").length,
    // Text is content, not state: a toggle that wrote a sentence anywhere
    // would be writing state the CSS could never read, so it is caught here
    // rather than left to the DOM legs (which run JS-off and cannot see it).
    text: env.document.body.textContent,
  });
}

/** The `role="status"` line of ONE section — there is one per compare and per
 *  mode, so a test that reads "the" slot reads the wrong one. */
function slotIn(env: Env, sectionSel: string): Element {
  const section = env.document.querySelector(sectionSel);
  if (section === null) throw new Error(`no ${sectionSel} in the served page`);
  const slot = section.querySelector("[data-pm-a11y-response]");
  if (slot === null) throw new Error(`${sectionSel} carries no response line`);
  return slot;
}

const DEMO_SENTENCE = (n: number) =>
  `Added "A sample record" to the demo cart — ${n} in the demo cart.`;

describe("the live-region demo (element-demos)", () => {
  it("the DS-ON button writes the announcement into its role=status slot; the shell's region stays silent", () => {
    const env = run("a11y/element-demos");
    const out = $(env, '[data-pm-demo-out="status-on"]');
    expect(out.getAttribute("role"), "the DS-ON slot IS the live region").toBe("status");
    expect(out.textContent).toBe("");
    click($(env, '[data-pm-demo="status-on"]'));
    expect(out.textContent).toBe(DEMO_SENTENCE(1));
    click($(env, '[data-pm-demo="status-on"]'));
    expect(out.textContent).toBe(DEMO_SENTENCE(2));
    // The shell's own live region is the CART's (CART_CONTRACT); the demo
    // never borrows it — otherwise the DS-OFF twin below would be announced
    // through it too, and the exhibit would show nothing.
    expect($(env, "[data-pm-status]").textContent).toBe("");
    // And nothing reached the real cart.
    expect(env.writes).toBe(0);
  });

  it("the DS-OFF button writes the SAME sentence into a plain element — silent to AT by construction — and never the shell's region", () => {
    const env = run("a11y/element-demos");
    const out = $(env, '[data-pm-demo-out="status-off"]');
    expect(out.getAttribute("role"), "the DS-OFF slot must be a plain element").toBeNull();
    expect(out.getAttribute("aria-live")).toBeNull();
    click($(env, '[data-pm-demo="status-off"]'));
    expect(out.textContent).toBe(DEMO_SENTENCE(1));
    expect($(env, '[data-pm-demo-out="status-on"]').textContent, "the twins have separate slots").toBe("");
    expect($(env, "[data-pm-status]").textContent, "the DS-OFF twin must stay silent").toBe("");
  });

  it("the script never opens a stripped twin", () => {
    const env = run("a11y/element-demos");
    const twins = $$(env, "details.pm-compare__off");
    expect(twins.length).toBe(5);
    for (const button of $$(env, "button")) click(button);
    for (const twin of twins) expect(twin.hasAttribute("open")).toBe(false);
  });

  it("a specimen answers in ITS OWN section's visible status line, never the shell's clipped one", () => {
    // Two defects the verification pass found, both fixed here and both
    // guarded: (F1) the first draft answered through the shell's
    // `[data-pm-status]`, which masthead.css sizes 1x1 and clips — silent to
    // everyone looking rather than listening; (F3) the second draft used one
    // page-level line, leaving the answer one to three viewports above the
    // button. The answer now belongs to the section that was pressed.
    const env = run("a11y/element-demos");
    const focus = 'section[aria-labelledby="demo-focus"]';
    const target = 'section[aria-labelledby="demo-target"]';
    const shell = $(env, "[data-pm-status]");

    // One line per compare, served empty, and a real live region.
    const slots = $$(env, "[data-pm-a11y-response]");
    expect(slots.length, "one answer line per compare").toBe(5);
    for (const slot of slots) {
      expect(slot.getAttribute("role")).toBe("status");
      expect(slot.textContent).toBe("");
    }

    click($(env, `${focus} .pm-compare__box:not(.pm-compare__box--off) button`));
    expect(slotIn(env, focus).textContent).toContain('"Add to cart"');
    expect(slotIn(env, focus).textContent).toContain("nothing was added or saved");
    // The answer went to the pressed section and NOWHERE else — a write that
    // lands in another section is the F3 defect wearing a different shape.
    expect(slotIn(env, target).textContent, "another section's line was written").toBe("");
    expect(shell.textContent, "the shell's clipped region is never used here").toBe("");

    click($(env, `${target} .pm-compare__box:not(.pm-compare__box--off) button`));
    expect(slotIn(env, target).textContent).toContain('"Save for later"');

    // The live-region buttons are NOT specimens: they have slots of their own.
    const env2 = run("a11y/element-demos");
    click($(env2, '[data-pm-demo="status-on"]'));
    for (const slot of $$(env2, "[data-pm-a11y-response]")) expect(slot.textContent).toBe("");
    expect(env2.writes).toBe(0);
  });

  it("a repeated press says something NEW — a live region will not re-announce unchanged text, and the target-size demo invites repeats", () => {
    // F-A8: the walkthrough tells the visitor to try the target "on a phone,
    // or with a tremor", so the second press is the designed interaction. A
    // per-control counter makes every press a distinct string, and answers
    // "did that do anything?" honestly: no, this many times now.
    const env = run("a11y/element-demos");
    const target = 'section[aria-labelledby="demo-target"]';
    const button = $(env, `${target} .pm-compare__box:not(.pm-compare__box--off) button`);
    const slot = slotIn(env, target);
    const said: string[] = [];
    for (let i = 0; i < 3; i++) { click(button); said.push(slot.textContent ?? ""); }
    expect(new Set(said).size, "a repeated press repeated itself — silent to AT").toBe(3);
    expect(said[1]).toContain("(2 presses)");
    expect(said[2]).toContain("(3 presses)");
    expect(said[0]).not.toContain("presses)");
  });

  it("the two twins of a compare produce DIFFERENT sentences in the SAME line", () => {
    // F2: both focus twins are the same component with the same label, so a
    // message built from the label alone was byte-identical for both — silent
    // on the second press, at exactly the moment the visitor is comparing
    // them. They share one section, so they share one answer line, which is
    // what makes the distinctness load-bearing rather than incidental.
    const env = run("a11y/element-demos");
    const focus = 'section[aria-labelledby="demo-focus"]';
    const slot = slotIn(env, focus);
    const said: string[] = [];
    for (const box of [".pm-compare__box:not(.pm-compare__box--off)", ".pm-compare__box--off"]) {
      click($(env, `${focus} ${box} button`));
      said.push(slot.textContent ?? "");
    }
    expect(said[0]).not.toBe(said[1]);
    expect(said[0]).toContain("DS-on");
    expect(said[1]).toContain("DS-off");
    // The demo's NAME is deliberately not in the sentence: the line sits
    // inside the demo's own section, so the heading above it already says
    // which comparison this is, and every character is height the line must
    // reserve. What the sentence must carry is what the section cannot —
    // which control, which side, and that nothing happened.
    for (const line of said) {
      expect(line).toContain("Specimen:");
      expect(line).toContain("nothing was added or saved");
      expect(line).not.toContain("Focus, visible");
    }

    // And across the whole page: no two specimens produce the same sentence.
    const env2 = run("a11y/element-demos");
    const all = new Set<string>();
    const specimens = $$(env2, ".pm-compare__box button.pm-button:not([data-pm-demo])");
    expect(specimens.length).toBeGreaterThan(2);
    for (const sp of specimens) {
      click(sp);
      const line = sp.closest("section")?.querySelector("[data-pm-a11y-response]");
      all.add(line?.textContent ?? "");
    }
    expect(all.size, "two specimens share a sentence").toBe(specimens.length);
  });

  it("the answer line is styled VISIBLE with reserved geometry — the sheet is what keeps F1 fixed", () => {
    // linkedom has no layout, so the visibility half is asserted against the
    // rule that provides it; the browser leg measures the real box.
    const css = readFileSync(join(tokensCss, "surfaces", "a11y.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = css.match(/\.pm-a11y__response\s*\{([\s\S]*?)\}/)?.[1];
    expect(rule, "a11y.css defines no .pm-a11y__response rule").toBeTruthy();
    expect(rule).toMatch(/min-height:/);
    // Compared against the SHELL's own visually-hidden rule rather than a
    // hand-typed pattern list: `.pm-sr-only` is the shape this line must not
    // have, and reading it from the sheet means a change to how this repo
    // hides things cannot leave this check testing yesterday's shape
    // (F-6 — the first draft asserted the absence of a CLASS the line would
    // never have carried, which is no check at all).
    const shellCss = readFileSync(join(tokensCss, "surfaces", "shell.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const hidden = shellCss.match(/\.pm-sr-only\s*\{([\s\S]*?)\}/)?.[1];
    expect(hidden, "shell.css defines no .pm-sr-only to compare against").toBeTruthy();
    const props = (block: string) =>
      new Set([...block.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]!));
    const hiding = [...props(hidden!)].filter((k) => k !== "white-space" && k !== "overflow");
    expect(hiding.length).toBeGreaterThan(3);
    for (const prop of hiding) {
      expect(props(rule!).has(prop), `the answer line borrows .pm-sr-only's ${prop}`).toBe(false);
    }
  });
});

describe("the mode toggles (mode-demos)", () => {
  const MODES = ["forced-colors", "reflow", "reduced-motion"] as const;
  const emulation = (mode: string) =>
    `.pm-mode__toggle[aria-pressed="true"] + .pm-mode__stage[data-pm-mode="${mode}"]`;

  it("a press flips the toggle's own aria-pressed, and the CSS emulation selector becomes matchable for THAT stage only", () => {
    const env = run("a11y/mode-demos");
    for (const mode of MODES) {
      expect($(env, `[data-pm-mode-toggle="${mode}"]`).getAttribute("aria-pressed")).toBe("false");
      expect($$(env, emulation(mode)).length, `${mode} served unemulated`).toBe(0);
    }
    click($(env, '[data-pm-mode-toggle="forced-colors"]'));
    expect($(env, '[data-pm-mode-toggle="forced-colors"]').getAttribute("aria-pressed")).toBe("true");
    expect($$(env, emulation("forced-colors")).length, "the rule can now match its stage").toBe(1);
    expect($$(env, emulation("reflow")).length, "no other stage is emulated").toBe(0);
    expect($$(env, emulation("reduced-motion")).length).toBe(0);
    // Release: back to served state.
    click($(env, '[data-pm-mode-toggle="forced-colors"]'));
    expect($(env, '[data-pm-mode-toggle="forced-colors"]').getAttribute("aria-pressed")).toBe("false");
    expect($$(env, emulation("forced-colors")).length).toBe(0);
  });

  it("a toggle touches NOTHING but its own aria-pressed — additive, stage-scoped, never the document", () => {
    // The promise the caveat makes ("these demos never override it"), as a
    // mechanism: the emulation lives entirely in one attribute on one button
    // and the sheet that reads it. If the script set a class on <html>, an
    // inline style on the stage, or opened anything, the fingerprint moves.
    const env = run("a11y/mode-demos");
    const before = untouchables(env);
    for (const mode of MODES) click($(env, `[data-pm-mode-toggle="${mode}"]`));
    for (const mode of MODES) {
      expect($(env, `[data-pm-mode-toggle="${mode}"]`).getAttribute("aria-pressed")).toBe("true");
    }
    expect(untouchables(env)).toBe(before);
    // And every stage's ATTRIBUTES are exactly as served — the stage is
    // never written; the sibling combinator does the work.
    for (const stage of $$(env, ".pm-mode__stage")) {
      expect([...stage.attributes].map((a) => a.name).sort()).toEqual(["class", "data-pm-mode"]);
    }
    expect(env.writes).toBe(0);
  });

  it("a stage's specimen answers in ITS OWN mode section and names that mode", () => {
    const env = run("a11y/mode-demos");
    const zoom = 'section[aria-labelledby="mode-zoom"]';
    const forced = 'section[aria-labelledby="mode-fc"]';
    expect($$(env, "[data-pm-a11y-response]").length, "one answer line per mode").toBe(3);
    click($(env, '.pm-mode__stage[data-pm-mode="reflow"] button.pm-button'));
    expect(slotIn(env, zoom).textContent).toContain('"Add to cart"');
    // The mode is identified by WHICH line was written, not by naming it in
    // the sentence — the assertion below is what carries that.
    expect(slotIn(env, forced).textContent, "another mode's line was written").toBe("");
    expect($(env, "[data-pm-status]").textContent).toBe("");
  });
});

describe("the emulation IS the seam remap, scoped (mode-demo.css vs tokens.css)", () => {
  /** `--name: value` pairs inside one CSS block, whitespace-normalized. */
  function customProps(block: string): string[] {
    return [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
      .map((m) => `${m[1]}: ${m[2]!.trim()}`)
      .sort();
  }
  const rules = (file: string) =>
    readFileSync(join(tokensCss, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("the forced-colors rule's custom properties are the media query's, verbatim", () => {
    const tokens = rules("tokens.css");
    const query = tokens.match(/@media \(forced-colors: active\)\s*\{\s*:root\s*\{([\s\S]*?)\}/)?.[1];
    expect(query, "tokens.css lost its forced-colors remap — the seam this demo demonstrates").toBeTruthy();
    const demo = rules("components/mode-demo.css").match(
      /\.pm-mode__toggle\[aria-pressed="true"\] \+ \.pm-mode__stage\[data-pm-mode="forced-colors"\]\s*\{([\s\S]*?)\}/,
    )?.[1];
    expect(demo, "mode-demo.css has no forced-colors emulation rule").toBeTruthy();
    const seam = customProps(query!);
    expect(seam.length, "the seam remaps nothing").toBeGreaterThan(5);
    expect(customProps(demo!)).toEqual(seam);
  });

  it("the reduced-motion rule collapses exactly the durations the media query collapses", () => {
    const tokens = rules("tokens.css");
    const query = tokens.match(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root\s*\{([\s\S]*?)\}/)?.[1];
    expect(query).toBeTruthy();
    const demo = rules("components/mode-demo.css").match(
      /\.pm-mode__toggle\[aria-pressed="true"\] \+ \.pm-mode__stage\[data-pm-mode="reduced-motion"\]\s*\{([\s\S]*?)\}/,
    )?.[1];
    expect(demo).toBeTruthy();
    expect(customProps(demo!)).toEqual(customProps(query!));
    expect(customProps(query!).length).toBeGreaterThan(0);
  });

  it("the reflow rule narrows to WCAG 1.4.10's 320 CSS px and never past the viewport", () => {
    const demo = rules("components/mode-demo.css").match(
      /\.pm-mode__toggle\[aria-pressed="true"\] \+ \.pm-mode__stage\[data-pm-mode="reflow"\]\s*\{([\s\S]*?)\}/,
    )?.[1];
    expect(demo).toBeTruthy();
    expect(demo).toMatch(/inline-size:\s*320px/);
    expect(demo).toMatch(/max-inline-size:\s*100%/);
    // `box-sizing: border-box` is what makes the 320 mean the FRAME the
    // visitor reads as the viewport. Without it the stage measured 362 px
    // under a label saying 320 (observed in the browser, 2026-09-03): the
    // tokens set no global box-sizing, so a 320 px CONTENT box wears the
    // padding and border on top. Asserting the number alone would pass that
    // regression again, which is why the declaration is pinned beside it.
    expect(demo, "the 320 must be the frame, not the content box").toMatch(/box-sizing:\s*border-box/);
  });
});

describe("the contrast numbers the exhibit PUBLISHES are the tokens' own", () => {
  /** WCAG 2.x relative luminance + contrast ratio, from the definition. */
  const lum = (hex: string): number => {
    const h = hex.replace("#", "");
    const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = ch.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
  };
  const ratio = (a: string, b: string): number => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };
  /** A primitive's hex, resolved through the semantic alias, from tokens.css. */
  const tokens = readFileSync(join(tokensCss, "tokens.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const primitive = (name: string): string => {
    const alias = tokens.match(new RegExp(`${name}:\\s*var\\((--pm-[\\w-]+)\\)`))?.[1];
    expect(alias, `${name} does not alias a primitive`).toBeTruthy();
    const hex = tokens.match(new RegExp(`${alias}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
    expect(hex, `${alias} has no hex in tokens.css`).toBeTruthy();
    return hex!;
  };

  it("every ratio the copy quotes is computed from the palette, and none of them is a superlative", async () => {
    // The verification pass found this page publishing "our worst shipped
    // pair measures 6.14:1". The number was right; "worst" was checked by
    // nothing and was false — muted ink on the SUNK surface is 5.73:1 and
    // ships on the editorial feature note and the checkout's empty-cart line.
    // A number on this site carries its artifact; the artifact for these two
    // is the palette, so they are recomputed here and the copy is held to
    // them. The superlative is barred by name: it cannot be recomputed, so it
    // cannot be published.
    const a11y = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "a11y.mjs")).href
    );
    const copy: string = a11y.renderA11yElementDemos();
    const muted = primitive("--color-text-muted");
    const paper = primitive("--color-surface");
    const sunk = primitive("--color-surface-sunk");

    const onPaper = ratio(muted, paper).toFixed(2);
    const onSunk = ratio(muted, sunk).toFixed(2);
    expect(onPaper, "the paper pairing moved — requote the page").toBe("6.14");
    expect(onSunk, "the sunk pairing moved — requote the page").toBe("5.73");
    expect(copy).toContain(`${onPaper}:1`);
    expect(copy).toContain(`${onSunk}:1`);
    // Both still clear AA for normal text, which is the claim around them.
    expect(Number(onPaper)).toBeGreaterThanOrEqual(4.5);
    expect(Number(onSunk)).toBeGreaterThanOrEqual(4.5);
    // No unfalsifiable superlative anywhere in the served copy.
    for (const word of ["worst shipped", "best shipped", "lowest shipped", "highest shipped"]) {
      expect(copy, `the copy publishes an unverifiable superlative: ${word}`).not.toContain(word);
    }
  });

  it("the stripped twin's grey really fails AA — the exhibit's failure is a real failure", () => {
    const a11yCss = readFileSync(join(tokensCss, "surfaces", "a11y.css"), "utf8");
    expect(a11yCss).toBeTruthy();
    // The hardcoded grey the DS-OFF twin uses, read from the renderer.
    const src = readFileSync(join(repoRoot, "packages", "reference", "render", "a11y.mjs"), "utf8");
    const grey = src.match(/color:\s*(#[0-9a-fA-F]{6})/)?.[1];
    expect(grey, "the stripped twin no longer hardcodes a grey").toBeTruthy();
    const paper = primitive("--color-surface");
    const r = ratio(grey!, paper);
    expect(r, `the stripped twin measures ${r.toFixed(2)}:1 — it must FAIL AA to be an exhibit`).toBeLessThan(4.5);
    expect(r.toFixed(2)).toBe("1.70");
  });
});

describe("the cart badge on this surface (CART_CONTRACT — the fourth vanilla read())", () => {
  it("populates from storage on every one of the three pages, and never writes", () => {
    for (const rel of PAGES) {
      const env = run(rel, { v: 1, items: [{ id: 7, qty: 2 }, { id: 9, qty: 1 }] });
      expect($(env, "[data-pm-cart-count]").textContent, rel).toBe("3");
      expect($(env, ".pm-masthead__cart").getAttribute("aria-label"), rel).toBe("Cart, 3 items");
      expect(env.writes, `${rel}: the a11y page wrote to the cart`).toBe(0);
    }
  });

  it("the empty cart is left exactly as served", () => {
    const env = run("a11y");
    expect($(env, "[data-pm-cart-count]").textContent).toBe("");
    expect($(env, ".pm-masthead__cart").getAttribute("aria-label")).toBeNull();
  });

  it("a repeated release id is the EMPTY cart, on this surface too", () => {
    // CART_CONTRACT's uniqueness clause (shell.mjs), checked in every
    // read(); this is the fourth and must not be the one that disagrees.
    const env = run("a11y", { v: 1, items: [{ id: 7, qty: 1 }, { id: 7, qty: 1 }] });
    expect($(env, "[data-pm-cart-count]").textContent).toBe("");
    expect($(env, ".pm-masthead__cart").getAttribute("aria-label")).toBeNull();
  });

  it("caps the badge at 9+ and keeps the exact count on the label", () => {
    const env = run("a11y", { v: 1, items: [{ id: 7, qty: 12 }] });
    expect($(env, "[data-pm-cart-count]").textContent).toBe("9+");
    expect($(env, ".pm-masthead__cart").getAttribute("aria-label")).toBe("Cart, 12 items");
  });

  it("garbage in storage is the empty cart", () => {
    for (const bad of ["{", { v: 2, items: [] }, { v: 1, items: "x" }, { v: 1, items: [{ id: 1, qty: 0 }] }]) {
      const env = run("a11y", bad);
      expect($(env, "[data-pm-cart-count]").textContent).toBe("");
    }
  });
});
