// The one pipeline (ADR-0009 §3) — unit contract. What these prove: the
// directive vocabulary renders, sanitize keeps XSS dead even from a
// stolen-session author, footnote anchors pair, Shiki highlights the
// curated set and degrades to plain <pre> outside it.
import { describe, expect, it } from "vitest";
import { excerptText, renderMarkdown } from "../src/render.js";

describe("directives", () => {
  it("renders :::aside as a classed <aside>", async () => {
    const html = await renderMarkdown(":::aside\nBeside the point.\n:::");
    expect(html).toContain('<aside class="bp-aside">');
    expect(html).toContain("Beside the point.");
  });

  it("renders :::pullquote as a <figure>", async () => {
    const html = await renderMarkdown(":::pullquote\nThe line worth lifting.\n:::");
    expect(html).toContain('<figure class="bp-pullquote">');
  });

  it("renders :::gallery with its layout attribute", async () => {
    const html = await renderMarkdown(
      ':::gallery{layout=side-by-side}\n![a](/blog/media/a.jpg)\n![b](/blog/media/b.jpg)\n:::',
    );
    expect(html).toContain('class="bp-gallery"');
    expect(html).toContain('data-layout="side-by-side"');
    // Both images hoisted into their own grid cells.
    expect(html.match(/<p><img/g)?.length).toBe(2);
  });

  it("gallery hoisting never drops non-image words", async () => {
    const html = await renderMarkdown(
      ':::gallery{layout=grid}\n![a](/blog/media/a.jpg) the caption words ![b](/blog/media/b.jpg)\n:::',
    );
    expect(html).toContain("the caption words");
  });

  it("unknown container directives degrade to a classed div", async () => {
    const html = await renderMarkdown(":::retired-thing\nStill readable.\n:::");
    expect(html).toContain('<div class="bp-retired-thing">');
  });
});

describe("sanitize (stolen-session defense, ADR-0009 §5)", () => {
  it("strips script elements and inline handlers", async () => {
    const html = await renderMarkdown(
      'Hi.\n\n<script>alert(1)</script>\n\n<img src="/blog/media/x.png" onerror="alert(1)">',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
  });

  it("strips javascript: URLs", async () => {
    const html = await renderMarkdown("[x](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });
});

describe("footnotes", () => {
  it("every footnote href has a matching id (single prefix layer)", async () => {
    const html = await renderMarkdown("Text.[^1]\n\n[^1]: The note.");
    const hrefs = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(ids.has(href)).toBe(true);
  });
});

describe("code", () => {
  it("highlights curated languages with dual-theme inline styles", async () => {
    const html = await renderMarkdown("```ts\nconst n: number = 1;\n```");
    expect(html).toContain("shiki");
    expect(html).toContain("--shiki-dark");
  });

  it("passes unknown languages through as plain pre/code", async () => {
    const html = await renderMarkdown("```brainfuck\n+++\n```");
    expect(html).toContain("<pre>");
    expect(html).not.toContain("shiki");
  });

  it("clamps every token color to AA against the code background", async () => {
    // Orange/yellow literals are everforest-light's known AA failures.
    const html = await renderMarkdown('```js\nconst s = "str"; // note\nlet n = 0xff;\n```');
    const lum = (hex) => {
      const h = hex.slice(1);
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
      const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const lightBg = /background-color:(#[0-9a-fA-F]{6})/.exec(html)[1];
    const darkBg = /--shiki-dark-bg:(#[0-9a-fA-F]{6})/.exec(html)[1];
    for (const [, color] of html.matchAll(/[^-]color:(#[0-9a-fA-F]{6})/g)) {
      expect(ratio(color, lightBg)).toBeGreaterThanOrEqual(4.5);
    }
    for (const [, color] of html.matchAll(/--shiki-dark:(#[0-9a-fA-F]{6})/g)) {
      expect(ratio(color, darkBg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("excerptText", () => {
  it("takes the first paragraph, strips tags, clamps", () => {
    expect(excerptText("<p>Hello <em>there</em> world.</p><p>More.</p>")).toBe(
      "Hello there world.",
    );
    expect(excerptText(`<p>${"x".repeat(400)}</p>`, 20).length).toBeLessThanOrEqual(20);
  });

  it("returns true plain text — entities decoded, ready for re-escaping", async () => {
    // Consumers wrap the excerpt in esc(); encoded entities would render
    // double-escaped in entry titles, meta descriptions, and RSS titles.
    const html = await renderMarkdown("Fish & chips <3 — the best.");
    expect(excerptText(html)).toBe("Fish & chips <3 — the best.");
  });
});
