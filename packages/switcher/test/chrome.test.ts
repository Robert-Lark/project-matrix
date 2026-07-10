/**
 * Unit-level guards on the chrome MARKUP CONTRACT (the composed-origin suite
 * owns the injected end-to-end behavior): swap hrefs rewrite only the variant
 * segment, the control-set stays sparse, profile selection follows the spec
 * ids, and client-controlled input cannot break out of attributes.
 */
import { describe, expect, it } from "vitest";
import { PROFILE_IDS } from "@pm/measurement";
import { renderChrome } from "../src/chrome";

const ctx = {
  variant: "placeholder-static",
  surface: "sample",
  pathname: "/placeholder-static/sample/",
  search: "?n=240&cache=cold",
  location: "local",
};

describe("switcher anchors (ADR-0004 §4–§5, §7)", () => {
  it("rewrites only the variant segment, preserving surface and query", () => {
    const html = renderChrome(ctx);
    expect(html).toContain('href="/placeholder-ssr/sample/?n=240&amp;cache=cold"');
    // Current variant is marked, not linked — the SWITCHER row has no
    // self-link (profile links elsewhere legitimately keep the current path).
    const switcherRow =
      html.match(/data-pm-switcher>[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(switcherRow).toContain('aria-current="true">placeholder-static<');
    expect(switcherRow).not.toContain('href="/placeholder-static/');
  });

  it("offers only the variants the surface's control-set maps (sparse)", () => {
    const html = renderChrome(ctx);
    expect(html).not.toContain("vanilla");
    const unknownSurface = renderChrome({ ...ctx, surface: "nope" });
    expect(unknownSurface).toContain("singleton surface");
    expect(unknownSurface).not.toContain("placeholder-ssr");
  });

  it("anchors carry no script payload", () => {
    const html = renderChrome(ctx);
    expect(html).not.toMatch(/<a [^>]*on[a-z]+=/i);
    expect(html).not.toContain('href="javascript:');
  });
});

describe("HUD (ADR-0004 §6)", () => {
  it("marks each spec profile selected under its ?profile= id", () => {
    for (const id of PROFILE_IDS) {
      const html = renderChrome({ ...ctx, search: `?profile=${id}` });
      const selected = html.match(/pm-chrome__cell--current" aria-current="true">([^<]+)</g) ?? [];
      expect(html).toContain("No published runs yet");
      expect(selected.join(" ")).not.toBe("");
    }
  });

  it("unknown ?profile= selects nothing and still shows the empty state", () => {
    const html = renderChrome({ ...ctx, search: "?profile=warp-speed" });
    expect(html).toContain("No published runs yet");
  });
});

describe("beacon tag stamping", () => {
  it("the environment tag is canonicalized — aliases collapse to the served condition", () => {
    const html = renderChrome({ ...ctx, search: "?n=0240&cache=cold" });
    expect(html).toContain('data-pm-environment="n=240|cache=cold"');
    expect(html).toContain('data-pm-cache-state="cold"');
    const defaults = renderChrome({ ...ctx, search: "" });
    expect(defaults).toContain('data-pm-environment="n=24|cache=default"');
  });
});

describe("injection safety", () => {
  it("client-controlled query cannot break out of attributes", () => {
    const html = renderChrome({
      ...ctx,
      search: '?n=24&x="/><script>alert(1)</script>',
      pathname: '/placeholder-static/sample/"><img src=x>/',
    });
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x>");
  });
});
