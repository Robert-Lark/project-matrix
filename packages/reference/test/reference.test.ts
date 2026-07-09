/**
 * The reference render is the golden-master SPEC (ADR-0003 §6): plain static
 * HTML consuming the shared tokens + font through the @pm/tokens workspace
 * link, with no framework and no scripts. These tests pin exactly that — the
 * actual DOM/pixel drift checks against variants arrive with the drift gate
 * (issue #6).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(pkgRoot, "index.html"), "utf8");

describe("consumes the shared design system", () => {
  it("every linked asset resolves on disk through the workspace link", () => {
    const hrefs = [...html.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)].map(
      (m) => m[1]!,
    );
    // At minimum: font preload, fonts.css, tokens.css, three component modules.
    expect(hrefs.length).toBeGreaterThanOrEqual(6);
    for (const href of hrefs) {
      expect(existsSync(join(pkgRoot, href)), `${href} does not resolve`).toBe(
        true,
      );
    }
  });

  it("loads tokens and the self-hosted font from @pm/tokens", () => {
    expect(html).toContain("@pm/tokens/css/tokens.css");
    expect(html).toContain("@pm/tokens/css/fonts.css");
    expect(html).toMatch(
      /rel="preload"[^>]+@pm\/tokens\/fonts\/[^"]+\.woff2[^>]+as="font"/,
    );
  });
});

describe("framework-free (ADR-0003 §6)", () => {
  it("contains no script at all", () => {
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/\son[a-z]+="/i);
  });

  it("renders the canonical pm- markup for all three components", () => {
    for (const cls of ["pm-release-card", "pm-button", "pm-field"]) {
      expect(html).toContain(`class="${cls}`);
    }
  });

  it("keeps the matched DS-on / DS-off field pair (ADR-0003 §5)", () => {
    expect(html).toContain("DS-ON");
    expect(html).toContain("DS-OFF");
    expect(html).toContain('aria-invalid="true"');
  });
});
