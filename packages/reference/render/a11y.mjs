/**
 * The A11y section — vanilla singleton, three pages. The page SHELL is
 * compliant by construction; every deliberate defect lives inside an opt-in
 * collapsed <details> (panel kill: content in a closed details is natively
 * unfocusable and hidden from AT — the default keyboard path never enters an
 * exhibit). Element-demos is noindex (strategy-review finding 21). Labels
 * come BEFORE defects, the compliant twin is adjacent.
 *
 * SERVED by the vanilla variant through THIS renderer (a11y-section build,
 * 2026-09-03): `variants/vanilla` renders /vanilla/a11y/* with these three
 * functions under its own <head> (`head` callback), its chrome slot and its
 * one script (`slot`, `scripts` — shell.mjs `page()`), so the served body and
 * the committed master are one function's output and cannot drift. Build-time
 * spec consumption, the how-it-was-built precedent (ADR-0004 §2 addendum,
 * 2026-09-02); nothing here ships to a visitor. The three options default off
 * and the masters render exactly as before.
 *
 * The enhancement contract, for the script that wires these pages
 * (variants/vanilla/src/a11y.js; guarded by tools/repo-checks):
 *  - `[data-pm-demo="<key>"]` buttons write into `[data-pm-demo-out="<key>"]`
 *    — the DS-ON slot is role="status", the DS-OFF slot a plain element;
 *  - `.pm-mode__toggle[data-pm-mode-toggle="<mode>"]` toggles its own
 *    `aria-pressed` and NOTHING else — mode-demo.css applies the emulation to
 *    the ADJACENT `.pm-mode__stage[data-pm-mode="<mode>"]` from that
 *    attribute (one state, the accessible one; ADR-0003 §5);
 *  - every other button in a compare box or a stage is a SPECIMEN (the
 *    exhibit is its rendering); the DS-ON forms field is served in its
 *    error-wired state as the specimen of that wiring. Pressing one writes
 *    into `[data-pm-a11y-response]`, the page's OWN visible `role="status"`
 *    line — never the shell's `[data-pm-status]`, which is `.pm-sr-only`
 *    geometry (masthead.css: 1×1, clipped) and would leave a sighted pointer
 *    user with no answer at all on the page whose subject is target size.
 *    The message names the demo AND the box, so the two twins of a compare
 *    never produce the same string: identical text is what a live region
 *    does not re-announce, and telling the twins apart is the whole task.
 */
import { page } from "./shell.mjs";

/* No plaque sheet: the index rendered ZERO `pm-plaque*` classes while linking
   `components/plaque.css` — a rule set shipped to every visitor of this page
   with nothing on it to style, which is `pm-pdp__scroll` in mirror image
   (`master-styles-resolve` only walks class → rule, so nothing caught it).
   And no plaque is owed: CONTEXT.md reserves the FENCED form for "true
   number-exclusions", this section publishes no number at all, and the DS-OFF
   twins are already labeled twice over — the `<details>` summary that opens
   them ("deliberately fails") and the box's own `pm-compare__tag`. Found by
   the verification pass, 2026-09-03. */
const INTRO_CSS = ["components/prose.css", "surfaces/a11y.css"];

export function renderA11yIndex({ extraDepth = 0, head, slot, scripts } = {}) {
  const content = `      <div class="pm-a11y">
        <header>
          <p class="pm-page__kicker">Accessibility, shown</p>
          <h1 class="pm-page__title">The same components, with and without their defaults</h1>
        </header>
        <div class="pm-prose pm-a11y__intro">
          <p>Every accessible behavior in this store — visible focus, labelled forms, honest target sizes, real contrast, announced updates — ships as the design system's <em>default</em>. This section shows what those defaults are worth by removing them: each demo pairs the shipped component with a stripped twin that differs <em>only</em> in its accessibility treatment.</p>
          <p>The stripped twins are deliberately broken, so they stay behind a control you open on purpose; the label always comes first, and the compliant version is always beside it. This page and everything around the demos stays fully accessible — if a demo box behaves badly, that's the exhibit, not the site.</p>
          <p>This is not a paradigm comparison. It runs in one variant, off the benchmarked matrix — the question here is what a rushed team ships without the system, not which architecture is faster.</p>
        </div>
        <nav class="pm-a11y__toc" aria-label="Demos">
          <a href="element-demos/">Element demos — focus, forms, target size, contrast, live regions</a>
          <a href="mode-demos/">Mode demos — forced colors, zoom &amp; reflow, reduced motion</a>
        </nav>
      </div>`;
  return page({
    title: "Accessibility, shown — Long Decay Records",
    depth: 2 + extraDepth,
    css: INTRO_CSS,
    current: null,
    content,
    head,
    slot,
    scripts,
  });
}

function compare({ id, title, walkthrough, on, off }) {
  return `        <section class="pm-compare" aria-labelledby="${id}">
          <h2 class="pm-compare__title" id="${id}">${title}</h2>
          <div class="pm-compare__walkthrough">${walkthrough}</div>
          <div class="pm-compare__pair">
            <div class="pm-compare__box">
              <p class="pm-compare__tag">DS-on — the shipped default</p>
              ${on}
            </div>
            <details class="pm-compare__off">
              <summary class="pm-compare__summary">Open the stripped twin (deliberately fails)</summary>
              <div class="pm-compare__box pm-compare__box--off">
                <p class="pm-compare__tag">DS-off — what ships without the system</p>
                ${off}
              </div>
            </details>
          </div>
          <p class="pm-a11y__response" role="status" data-pm-a11y-response></p>
        </section>`;
}

export function renderA11yElementDemos({ extraDepth = 0, head, slot, scripts } = {}) {
  const demos = [
    compare({
      id: "demo-focus",
      title: "Focus, visible",
      walkthrough: `<p>Press <kbd>Tab</kbd> until the button below has focus. The shipped default draws a 3-pixel ring that survives Windows High Contrast; the stripped twin sets <code>outline: none</code> — keyboard users simply lose their place.</p>`,
      on: `<button class="pm-button" type="button">Add to cart</button>`,
      off: `<button class="pm-button" type="button" style="outline: none;">Add to cart</button>`,
    }),
    compare({
      id: "demo-forms",
      title: "Forms that announce themselves",
      walkthrough: `<p>With a screen reader, focus each field. The default has a real <code>&lt;label&gt;</code>, an <code>autocomplete</code> token, and an error tied in with <code>aria-describedby</code> + <code>aria-invalid</code> — read as one sentence. The twin uses a placeholder as its only label: it vanishes on type, and the error is a red word nothing points to.</p>`,
      on: `<div class="pm-field">
                <label class="pm-field__label" for="a11y-email-on">Email address</label>
                <input class="pm-field__control" id="a11y-email-on" name="email" type="email" autocomplete="email" aria-describedby="a11y-email-on-err" aria-invalid="true">
                <span class="pm-field__error" id="a11y-email-on-err">Enter a valid email address.</span>
              </div>`,
      off: `<div class="pm-field">
                <input class="pm-field__control" type="text" placeholder="Email address" style="border-color: var(--color-danger); border-width: 2px;">
                <span style="color: var(--color-danger); font-size: var(--text-small);">Invalid</span>
              </div>`,
    }),
    compare({
      id: "demo-target",
      title: "Targets you can hit",
      walkthrough: `<p>The default control clears the WCAG 2.5.8 minimum (24×24 CSS px) with generous padding that is all part of the target. The twin is the same action as a bare 13-pixel text link: try it on a phone, or with a tremor, or on a train.</p>`,
      on: `<button class="pm-button pm-button--secondary" type="button">Save for later</button>`,
      off: `<a href="#demo-target" style="font-size: 13px;">save</a>`,
    }),
    compare({
      id: "demo-contrast",
      title: "Contrast that survives sunlight",
      walkthrough: `<p>The default muted text clears WCAG AA wherever the system puts it: 6.14:1 on this paper ground, and 5.73:1 on the sunk panels where the editorial feature note and the checkout's empty-cart line live. The twin is the same sentence at a contrast that disappears on a bright screen or a cheap panel — and it is exactly what "light grey looks refined" ships.</p>`,
      on: `<p style="margin:0;">Shipping is free on orders over $50 — <span style="color: var(--color-text-muted);">rates update at checkout.</span></p>`,
      off: `<p style="margin:0;">Shipping is free on orders over $50 — <span style="color: #c9c4b8;">rates update at checkout.</span></p>`,
    }),
    compare({
      id: "demo-live",
      title: "Updates that get announced",
      walkthrough: `<p>Press the button with a screen reader running. The default writes into a <code>role="status"</code> region — announced without stealing focus. The twin updates the same text in a plain element: visually identical, silent to assistive tech. (The buttons need JavaScript; this page's build wires them.)</p>`,
      on: `<p style="margin:0 0 var(--space-stack);"><button class="pm-button pm-button--secondary" type="button" data-pm-demo="status-on">Add to cart</button></p>
              <p role="status" data-pm-demo-out="status-on" style="margin:0;"></p>`,
      off: `<p style="margin:0 0 var(--space-stack);"><button class="pm-button pm-button--secondary" type="button" data-pm-demo="status-off">Add to cart</button></p>
              <p data-pm-demo-out="status-off" style="margin:0;"></p>`,
    }),
  ];

  const content = `      <div class="pm-a11y">
        <header>
          <p class="pm-page__kicker">Accessibility, shown · element demos</p>
          <h1 class="pm-page__title">Five defaults, on and off</h1>
        </header>
        <div class="pm-prose pm-a11y__intro">
          <p>Each demo below pairs a shipped component with its stripped twin. The label comes first, the compliant version is adjacent, and the broken one stays closed until you open it. This page is deliberately kept out of search indexes — the twins are real failures.</p>
        </div>
        <nav class="pm-a11y__toc" aria-label="Demos on this page">
          <a href="#demo-focus">Focus</a>
          <a href="#demo-forms">Forms</a>
          <a href="#demo-target">Target size</a>
          <a href="#demo-contrast">Contrast</a>
          <a href="#demo-live">Live regions</a>
        </nav>
${demos.join("\n")}
      </div>`;

  return page({
    title: "Element demos — Accessibility, shown — Long Decay Records",
    depth: 3 + extraDepth,
    css: [
      "components/prose.css",
      "components/compare.css",
      "components/button.css",
      "components/field.css",
      "surfaces/a11y.css",
    ],
    current: null,
    content,
    noindex: true,
    head,
    slot,
    scripts,
  });
}

function mode({ id, title, walkthrough, buttonLabel, stage, modeKey }) {
  return `        <section class="pm-mode" aria-labelledby="${id}">
          <h2 class="pm-mode__title" id="${id}">${title}</h2>
          <div class="pm-mode__walkthrough">${walkthrough}</div>
          <p class="pm-mode__caveat">This button emulates the mode with CSS so you can watch the mechanism; your OS setting is the real thing — these demos never override it.</p>
          <button class="pm-mode__toggle" type="button" aria-pressed="false" data-pm-mode-toggle="${modeKey}">${buttonLabel}</button>
          <div class="pm-mode__stage" data-pm-mode="${modeKey}">
            ${stage}
          </div>
          <p class="pm-a11y__response" role="status" data-pm-a11y-response></p>
        </section>`;
}

const STAGE = `<ul class="pm-grid" role="list" style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr));">
              <li class="pm-release-card">
                <div class="pm-release-card__body">
                  <h3 class="pm-release-card__title">A sample card</h3>
                  <p class="pm-release-card__artist">The design system</p>
                  <div class="pm-release-card__foot">
                    <span class="pm-release-card__price">$21.50</span>
                    <span class="pm-release-card__stock">58 for sale</span>
                  </div>
                </div>
              </li>
            </ul>
            <p style="margin: var(--space-stack) 0 0;"><button class="pm-button" type="button">Add to cart</button></p>`;

export function renderA11yModeDemos({ extraDepth = 0, head, slot, scripts } = {}) {
  const demos = [
    mode({
      id: "mode-fc",
      title: "Forced colors",
      modeKey: "forced-colors",
      buttonLabel: "Emulate forced colors",
      walkthrough: `<p>Windows High Contrast replaces every author color with the user's system palette. The design system survives because ALL its color flows through one semantic seam that remaps to system colors — and because no meaning rides on color alone. Turn the real thing on (Windows: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>PrtScn</kbd>) and the whole store adapts.</p>`,
      stage: STAGE,
    }),
    mode({
      id: "mode-zoom",
      title: "Zoom and reflow",
      modeKey: "reflow",
      buttonLabel: "Emulate a 320px viewport",
      walkthrough: `<p>WCAG 1.4.10 asks pages to reflow at 400% zoom (a 320px-wide viewport) with no horizontal scrolling. Everything here is sized in <code>rem</code> and laid out to wrap — zoom your browser to 400% right now and check; the emulation below just narrows the stage so you can see the wrap happen.</p>`,
      stage: STAGE,
    }),
    mode({
      id: "mode-motion",
      title: "Reduced motion",
      modeKey: "reduced-motion",
      buttonLabel: "Emulate reduced motion",
      walkthrough: `<p>The OS "reduce motion" setting collapses every transition in the store to nothing — gated once, at the token tier, so no component needs its own media query. Hover the button below with the emulation on and off to see the difference; your OS setting always wins.</p>`,
      stage: STAGE,
    }),
  ];

  const content = `      <div class="pm-a11y">
        <header>
          <p class="pm-page__kicker">Accessibility, shown · mode demos</p>
          <h1 class="pm-page__title">Three global modes, honored</h1>
        </header>
        <div class="pm-prose pm-a11y__intro">
          <p>Some accessibility is a property of the whole page: what happens under forced colors, at 400% zoom, when the user asks for less motion. These demos emulate each mode inside a stage so you can watch the mechanism work — and each one tells you how to flip the real switch.</p>
        </div>
${demos.join("\n")}
      </div>`;

  return page({
    title: "Mode demos — Accessibility, shown — Long Decay Records",
    depth: 3 + extraDepth,
    css: [
      "components/prose.css",
      "components/mode-demo.css",
      "components/release-card.css",
      "surfaces/a11y.css",
    ],
    current: null,
    content,
    head,
    slot,
    scripts,
  });
}
