/**
 * The a11y section in a real browser (a11y-section build, 2026-09-03) — the
 * claims linkedom cannot check (tools/repo-checks a11y-controls-behave says
 * which): focus order, computed styles, and what a real OS preference does.
 *
 *  - Finding 21, observed: with JS OFF (the served page alone), Tab never
 *    lands inside a closed DS-OFF twin; opening one — the visitor's
 *    deliberate act, native <details>, no script — puts its controls in the
 *    tab order. "Natively unfocusable until opened" is a browser fact, so it
 *    is asserted in one.
 *  - The enhancement, JS on: the live-region demo writes its own slots and
 *    the shell stays silent; a specimen answers in its OWN section's visible
 *    line, and that line is measured to be a real box rather than a clipped
 *    one (the half linkedom cannot see); a toggle
 *    emulates INSIDE its stage (computed style moves there, nowhere else) and
 *    releases cleanly.
 *  - The caveat is a kept promise: under a real reduced-motion preference the
 *    collapsed durations stand with the toggle off AND on, and releasing the
 *    toggle does not re-enable motion; under a real forced-colors preference
 *    the page is already remapped and the toggle changes nothing. Additive
 *    only — the OS wins.
 *  - The cart survives the swap onto this page: the badge reads storage.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const ELEMENT_DEMOS = `${ORIGIN}/vanilla/a11y/element-demos/`;
const MODE_DEMOS = `${ORIGIN}/vanilla/a11y/mode-demos/`;

let browser: Browser;
beforeAll(async () => {
  try {
    browser = await chromium.launch();
  } catch {
    // Dev machines where TLS interception blocks the Playwright CDN drive
    // the system Chrome instead; CI always installs bundled Chromium.
    browser = await chromium.launch({ channel: "chrome" });
  }
});
afterAll(async () => {
  await browser?.close();
});

const DEMO_SENTENCE = (n: number) =>
  `Added "A sample record" to the demo cart — ${n} in the demo cart.`;

/** Computed values inside one mode's stage. */
const stageCardBackground = (page: Page, mode: string) =>
  page.evaluate(
    (m) =>
      getComputedStyle(
        document.querySelector(`.pm-mode__stage[data-pm-mode="${m}"] .pm-release-card`)!,
      ).backgroundColor,
    mode,
  );
const stageButtonDuration = (page: Page, mode: string) =>
  page.evaluate(
    (m) =>
      parseFloat(
        getComputedStyle(
          document.querySelector(`.pm-mode__stage[data-pm-mode="${m}"] button.pm-button`)!,
        ).transitionDuration,
      ),
    mode,
  );
const stageWidth = (page: Page, mode: string) =>
  page.evaluate(
    (m) => document.querySelector(`.pm-mode__stage[data-pm-mode="${m}"]`)!.getBoundingClientRect().width,
    mode,
  );
/** EVERY element and EVERY attribute, with the one attribute a toggle may
 *  write masked out. Total for the same reason the linkedom guard went total
 *  (F-S5): the first draft sampled `<html>`/`<body>` attributes, classes and
 *  inline styles, which is narrower than the claim it backs — a toggle that
 *  set `aria-hidden` on the honesty caveat, or `hidden` on a twin, moved
 *  nothing it looked at. The chrome subtree is excluded: it is injected
 *  instrumentation with its own live HUD, and its readout legitimately
 *  changes while the page sits there. */
const documentFingerprint = (page: Page) =>
  page.evaluate(() => {
    const shape = (el: Element) => {
      const isToggle = el.classList.contains("pm-mode__toggle");
      const attrs = [...el.attributes]
        .filter((a) => !(isToggle && a.name === "aria-pressed"))
        .map((a) => `${a.name}=${a.value}`)
        .sort()
        .join("|");
      return `${el.tagName.toLowerCase()}[${attrs}]`;
    };
    return JSON.stringify({
      html: shape(document.documentElement),
      elements: [...document.querySelectorAll("*")]
        .filter((el) => el.closest("#pm-chrome") === null && el.id !== "pm-chrome")
        .map(shape),
      open: [...document.querySelectorAll("details")].map((d) => d.hasAttribute("open")),
      styleElements: document.querySelectorAll("style").length,
      pageText: document.querySelector(".pm-page main")?.textContent ?? "",
    });
  });

describe("element-demos: the stripped twins are unfocusable until opened (JS off — the served page alone)", () => {
  it("Tab never enters a closed twin; opening one puts its controls in the tab order", async () => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(ELEMENT_DEMOS, { waitUntil: "load" });
    // Non-vacuity: the twins really hold focusable content to be kept out.
    expect(
      await page.locator("details.pm-compare__off button, details.pm-compare__off input, details.pm-compare__off a").count(),
    ).toBeGreaterThan(2);

    const visited: string[] = [];
    for (let i = 0; i < 150; i++) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return "body";
        // "Inside a closed twin" means inside its CONTENT box: the <summary> is
        // inside the closed <details> too and is focusable by design — it is
        // the control that opens the twin. The first draft flagged all five.
        const inOff = el.closest(".pm-compare__box--off") !== null;
        const inClosed = inOff && el.closest("details.pm-compare__off:not([open])") !== null;
        return `${el.tagName.toLowerCase()}${inClosed ? " IN-CLOSED-TWIN" : ""}${inOff ? " IN-OFF-BOX" : ""} ${(el.textContent ?? "").trim().slice(0, 24)}`;
      });
      visited.push(where);
      if (where.startsWith("a") && where.includes("GitHub")) break; // the footer's last link: one full pass
    }
    expect(visited.length, "the tab walk never reached the footer").toBeLessThan(150);
    expect(visited.length).toBeGreaterThan(10);
    // The twins' summaries ARE in the order — reachable on purpose. Counted by
    // their text, not by tag: the injected chrome carries a <details> of its
    // own (observed 2026-09-03 — six summaries on the page, five of them twins).
    expect(visited.filter((v) => v.startsWith("summary") && v.includes("Open the stripped twin")).length).toBe(5);
    // …and the DS-ON controls are: a button, an input.
    expect(visited.some((v) => v.startsWith("button Add to cart"))).toBe(true);
    expect(visited.some((v) => v.startsWith("input"))).toBe(true);
    // …but nothing inside a closed twin ever was.
    expect(visited.filter((v) => v.includes("IN-CLOSED-TWIN"))).toEqual([]);
    expect(visited.filter((v) => v.includes("IN-OFF-BOX"))).toEqual([]);

    // Open the focus demo's twin — native <details>, no script running — and
    // Tab once from its summary: the stripped button is now the next stop.
    const summary = page.locator('section[aria-labelledby="demo-focus"] details.pm-compare__off summary');
    await summary.click();
    expect(await page.locator('section[aria-labelledby="demo-focus"] details[open]').count()).toBe(1);
    await summary.focus();
    await page.keyboard.press("Tab");
    const after = await page.evaluate(() => {
      const el = document.activeElement!;
      return {
        inOff: el.closest(".pm-compare__box--off") !== null,
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? "").trim(),
        // The exhibit itself: the stripped twin removed the ring.
        outline: getComputedStyle(el).outlineStyle,
      };
    });
    expect(after.inOff).toBe(true);
    expect(after.tag).toBe("button");
    expect(after.text).toBe("Add to cart");
    expect(after.outline).toBe("none");
    await context.close();
  }, 90_000);
});

describe("the enhancement, JS on", () => {
  it("the live-region demo writes into its own slots only, the shell stays silent, and a specimen's answer is a VISIBLE box in its own section", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(ELEMENT_DEMOS, { waitUntil: "load" });
    await page.click('[data-pm-demo="status-on"]');
    expect(await page.textContent('[data-pm-demo-out="status-on"]')).toBe(DEMO_SENTENCE(1));
    expect(await page.getAttribute('[data-pm-demo-out="status-on"]', "role")).toBe("status");
    expect(await page.textContent("[data-pm-status]")).toBe("");
    // The DS-OFF twin: opened deliberately, pressed, same sentence, plain
    // element, shell silent — the silence IS the exhibit.
    await page.click('section[aria-labelledby="demo-live"] details.pm-compare__off summary');
    await page.click('[data-pm-demo="status-off"]');
    expect(await page.textContent('[data-pm-demo-out="status-off"]')).toBe(DEMO_SENTENCE(1));
    expect(await page.getAttribute('[data-pm-demo-out="status-off"]', "role")).toBeNull();
    expect(await page.textContent("[data-pm-status]")).toBe("");
    // Nothing reached the real cart.
    expect(await page.evaluate(() => localStorage.getItem("pm:cart"))).toBeNull();
    // A specimen answers in ITS OWN section, names itself, and — the half no
    // linkedom guard can check — the line it answers in is a real box on the
    // page rather than the shell's 1x1 clipped one (F1/F3, verification pass).
    const focus = 'section[aria-labelledby="demo-focus"]';
    await page.click(`${focus} .pm-compare__box:not(.pm-compare__box--off) button`);
    const answer = await page.evaluate((sel) => {
      const slot = document.querySelector(`${sel} [data-pm-a11y-response]`)!;
      const r = slot.getBoundingClientRect();
      const cs = getComputedStyle(slot);
      return {
        text: slot.textContent ?? "",
        w: Math.round(r.width), h: Math.round(r.height),
        clipped: cs.clipPath !== "none" || cs.position === "absolute",
        // Is it near the control that was pressed, rather than pages away?
        gap: Math.round(r.top - document.querySelector(`${sel} button`)!.getBoundingClientRect().bottom),
      };
    }, focus);
    // The sentence names the control and the SIDE; the demo's name is the
    // heading the line sits under, deliberately not repeated (every character
    // is reserved height — see the zero-shift leg below).
    expect(answer.text).toBe(
      'Specimen: "Add to cart", DS-on. You hit it — nothing was added or saved.',
    );
    expect(answer.w, "the answer line is a real box, not 1px").toBeGreaterThan(100);
    expect(answer.h).toBeGreaterThan(20);
    expect(answer.clipped, "the answer line borrows the sr-only shape").toBe(false);
    expect(Math.abs(answer.gap), "the answer is a viewport away from the control").toBeLessThan(400);
    expect(await page.textContent("[data-pm-status]")).toBe("");
    await context.close();
  }, 60_000);

  it("mode-demos: each toggle emulates inside its own stage — computed style moves there and nowhere else — and releases cleanly", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(MODE_DEMOS, { waitUntil: "load" });
    const before = {
      fcCard: await stageCardBackground(page, "forced-colors"),
      rfCard: await stageCardBackground(page, "reflow"),
      rmDuration: await stageButtonDuration(page, "reduced-motion"),
      fcDuration: await stageButtonDuration(page, "forced-colors"),
      rfWidth: await stageWidth(page, "reflow"),
      fingerprint: await documentFingerprint(page),
    };
    // The served page has motion and a paper-coloured card: the emulations
    // have something to change (non-vacuity for every assertion below).
    expect(before.rmDuration).toBeGreaterThan(0.001);
    expect(before.rfWidth).toBeGreaterThan(320);

    await page.click('[data-pm-mode-toggle="forced-colors"]');
    expect(await page.getAttribute('[data-pm-mode-toggle="forced-colors"]', "aria-pressed")).toBe("true");
    const fcOn = await stageCardBackground(page, "forced-colors");
    expect(fcOn, "the forced-colors stage repainted its card in system colours").not.toBe(before.fcCard);
    expect(await stageCardBackground(page, "reflow"), "the other stage is untouched").toBe(before.rfCard);

    await page.click('[data-pm-mode-toggle="reduced-motion"]');
    expect(await stageButtonDuration(page, "reduced-motion")).toBeLessThan(0.001);
    expect(await stageButtonDuration(page, "forced-colors"), "motion elsewhere is untouched").toBe(before.fcDuration);

    await page.click('[data-pm-mode-toggle="reflow"]');
    // The FRAME is the emulated viewport: 320 at the border box (mode-demo.css
    // sizes it border-box for exactly this reason), not 320 of content inside
    // a wider frame.
    expect(await stageWidth(page, "reflow")).toBeLessThanOrEqual(320);
    expect(await stageWidth(page, "reflow")).toBeGreaterThan(300);

    // Nothing but the three aria-pressed attributes moved on the document.
    expect(await documentFingerprint(page)).toBe(before.fingerprint);

    // Release all three: the served state, exactly.
    for (const mode of ["forced-colors", "reduced-motion", "reflow"]) {
      await page.click(`[data-pm-mode-toggle="${mode}"]`);
      expect(await page.getAttribute(`[data-pm-mode-toggle="${mode}"]`, "aria-pressed")).toBe("false");
    }
    expect(await stageCardBackground(page, "forced-colors")).toBe(before.fcCard);
    expect(await stageButtonDuration(page, "reduced-motion")).toBe(before.rmDuration);
    expect(await stageWidth(page, "reflow")).toBe(before.rfWidth);
    await context.close();
  }, 60_000);

  it("under a real reduced-motion preference the collapsed durations stand with the toggle off AND on — releasing it never re-enables motion", async () => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(MODE_DEMOS, { waitUntil: "load" });
    // The OS setting, honoured by tokens.css at :root — page-wide, toggle off.
    expect(await stageButtonDuration(page, "reduced-motion")).toBeLessThan(0.001);
    expect(await stageButtonDuration(page, "forced-colors")).toBeLessThan(0.001);
    await page.click('[data-pm-mode-toggle="reduced-motion"]');
    expect(await stageButtonDuration(page, "reduced-motion")).toBeLessThan(0.001);
    await page.click('[data-pm-mode-toggle="reduced-motion"]');
    expect(await page.getAttribute('[data-pm-mode-toggle="reduced-motion"]', "aria-pressed")).toBe("false");
    // The caveat, kept: the toggle is additive; the OS setting is the real thing.
    expect(await stageButtonDuration(page, "reduced-motion")).toBeLessThan(0.001);
    expect(await stageButtonDuration(page, "forced-colors")).toBeLessThan(0.001);
    await context.close();
  }, 60_000);

  it("under a real forced-colors preference tokens.css's SEAM is what remapped the page, and the toggle adds nothing", async () => {
    // F-5: the first draft compared painted background colours, which
    // Chromium's own forced-colors mode overrides whatever the author CSS
    // says — so it would have passed with tokens.css's `@media
    // (forced-colors: active)` block deleted, proving the browser rather than
    // the design system. Custom PROPERTY values are the non-vacuous signal:
    // Chromium forces used colours, it does not rewrite `--color-*`, so a
    // property reading `CanvasText` can only have come from the seam.
    const context = await browser.newContext({ forcedColors: "active" });
    const page = await context.newPage();
    await page.goto(MODE_DEMOS, { waitUntil: "load" });
    const seam = () =>
      page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        const get = (n: string) => cs.getPropertyValue(n).trim();
        return {
          text: get("--color-text"),
          surface: get("--color-surface"),
          accent: get("--color-accent"),
          focus: get("--color-focus"),
          danger: get("--color-danger"),
        };
      });
    const remapped = await seam();
    // The seam's own target values (tokens.css's forced-colors block).
    expect(remapped).toEqual({
      text: "CanvasText",
      surface: "Canvas",
      accent: "LinkText",
      focus: "Highlight",
      danger: "CanvasText",
    });
    // Non-vacuity in the other direction: without the preference these are
    // the palette's hex values, so the assertion above is not just "some
    // string".
    const plain = await browser.newContext();
    const plainPage = await plain.newPage();
    await plainPage.goto(MODE_DEMOS, { waitUntil: "load" });
    const unforced = await plainPage.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-text").trim(),
    );
    expect(unforced).toMatch(/^#|^rgb/);
    expect(unforced).not.toBe("CanvasText");
    await plain.close();

    // And the toggle is additive: pressing it cannot change what the OS
    // already decided, in either direction.
    await page.click('[data-pm-mode-toggle="forced-colors"]');
    expect(await page.getAttribute('[data-pm-mode-toggle="forced-colors"]', "aria-pressed")).toBe("true");
    expect(await seam(), "the emulation cannot out-remap the OS").toEqual(remapped);
    await page.click('[data-pm-mode-toggle="forced-colors"]');
    expect(await seam()).toEqual(remapped);
    await context.close();
  }, 60_000);

  it("filling an answer line shifts NOTHING below it, at every width down to 320px", async () => {
    // F-4/F-A7: `min-height` was 3em, which held at 412px and 1440px and
    // failed at 360px and 320px — the longest message the script can build
    // wrapped to a third line, the box went 73 to 96px, and the next demo
    // moved down 23px. 320px is the width WCAG 1.4.10 and this page's own
    // reflow demo are about. The reserve is three lines now, and this leg is
    // what keeps a copy edit from quietly spending it: the longest string the
    // code can produce is written in and the following section must not move.
    const WORST =
      'Specimen: "Save for later", the stage. You hit it — nothing was added or saved. (99 presses)';
    for (const width of [320, 360, 412, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      for (const rel of ["a11y/element-demos", "a11y/mode-demos"]) {
        await page.goto(`${ORIGIN}/vanilla/${rel}/`, { waitUntil: "load" });
        const r = await page.evaluate((msg) => {
          const secs = [...document.querySelectorAll("section.pm-compare, section.pm-mode")];
          const slot = secs[0]!.querySelector("[data-pm-a11y-response]")!;
          const nextTop = () => Math.round(secs[1]!.getBoundingClientRect().top);
          const before = nextTop();
          const emptyH = Math.round(slot.getBoundingClientRect().height);
          slot.textContent = msg;
          const after = nextTop();
          const filledH = Math.round(slot.getBoundingClientRect().height);
          return { shift: after - before, emptyH, filledH, sections: secs.length };
        }, WORST);
        // Non-vacuity: there really is a following section to be pushed, and
        // the line really is a reserved box rather than a zero-height one.
        expect(r.sections, `${rel}: nothing below to shift`).toBeGreaterThan(1);
        expect(r.emptyH, `${rel} @${width}: the line reserves nothing`).toBeGreaterThan(40);
        expect(r.shift, `${rel} @${width}px: filling the answer line moved the next demo`).toBe(0);
        expect(r.filledH, `${rel} @${width}px: the worst message outgrew its reserve`).toBe(r.emptyH);
      }
      await context.close();
    }
  }, 120_000);

  it("the cart survives the swap onto this page: the masthead badge reads storage, and the page never writes it", async () => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      localStorage.setItem("pm:cart", JSON.stringify({ v: 1, items: [{ id: 7, qty: 2 }, { id: 9, qty: 1 }] }));
    });
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/vanilla/a11y/`, { waitUntil: "load" });
    expect(await page.textContent("[data-pm-cart-count]")).toBe("3");
    expect(await page.getAttribute(".pm-masthead__cart", "aria-label")).toBe("Cart, 3 items");
    const stored = await page.evaluate(() => localStorage.getItem("pm:cart"));
    expect(JSON.parse(stored!)).toEqual({ v: 1, items: [{ id: 7, qty: 2 }, { id: 9, qty: 1 }] });
    await context.close();
  }, 60_000);
});
