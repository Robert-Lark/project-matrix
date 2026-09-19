/**
 * The front Worker's first tests (security floor, 2026-09-18). Two things the
 * origin suite — which only sees HTTP — cannot pin:
 *
 *  - The dispatch table and wrangler.jsonc's `services` are ONE set. The
 *    table is derived from @pm/measurement's VARIANT_PREFIXES (the beacon
 *    roster), so a prefix on the roster with no binding would 502 on
 *    dispatch and a binding with no prefix would be unreachable. The deploy
 *    config is the roster's INDEPENDENT oracle: the roster tests in
 *    @pm/measurement and @pm/edge compare the roster to itself, and a prefix
 *    dropped from the list moves both sides together. This one does not.
 *
 *  - The floor module's own mechanics: it OVERRIDES an upstream's weaker
 *    value (never appends), it keeps status, body and unrelated headers, a
 *    null body stays null, the `_headers` text is the same three headers in
 *    the platform's rule syntax — and the byte figure ADR-0001 addendum U
 *    cites is DERIVED from the module here, not typed into prose.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VARIANT_PREFIXES } from "@pm/measurement";
import { SECURITY_FLOOR, headersFileText, withSecurityFloor } from "../src/security-floor.js";

const bindingOf = (prefix) => prefix.toUpperCase().replaceAll("-", "_");

// JSONC → JSON: this file's comments are whole lines (a `//` inside a string
// value — a URL — would survive this strip, and none of the values is one).
const wrangler = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "wrangler.jsonc"), "utf8").replace(
    /^\s*\/\/.*$/gm,
    "",
  ),
);

describe("the dispatch table IS wrangler.jsonc's service list (roster ↔ deploy config)", () => {
  const bindings = new Map(wrangler.services.map((s) => [s.binding, s.service]));

  it("every roster prefix has a service binding named for it", () => {
    for (const prefix of VARIANT_PREFIXES) {
      expect(bindings.has(bindingOf(prefix)), `${prefix} → ${bindingOf(prefix)}`).toBe(true);
    }
  });

  it("every service binding that is not a variant is exactly EDGE or BLOG — no unreachable variant binding", () => {
    const variantBindings = new Set(VARIANT_PREFIXES.map(bindingOf));
    const rest = [...bindings.keys()].filter((b) => !variantBindings.has(b)).sort();
    expect(rest).toEqual(["BLOG", "EDGE"]);
  });

  it("each variant binding points at the Worker named pm-<prefix>", () => {
    for (const prefix of VARIANT_PREFIXES) {
      expect(bindings.get(bindingOf(prefix))).toBe(`pm-${prefix}`);
    }
  });

  it("the roster has the eight dispatched variants (non-vacuity)", () => {
    expect(VARIANT_PREFIXES.length).toBe(8);
  });
});

describe("the floor module", () => {
  it("names exactly the three headers, lower-case", () => {
    expect(Object.keys(SECURITY_FLOOR).sort()).toEqual([
      "referrer-policy",
      "x-content-type-options",
      "x-frame-options",
    ]);
    for (const name of Object.keys(SECURITY_FLOOR)) expect(name).toBe(name.toLowerCase());
  });

  it("OVERRIDES an upstream's weaker value — set, never append", () => {
    const upstream = new Response("x", {
      headers: { "x-frame-options": "SAMEORIGIN", "content-type": "text/plain" },
    });
    const floored = withSecurityFloor(upstream);
    expect(floored.headers.get("x-frame-options")).toBe("DENY");
    expect(floored.headers.get("content-type")).toBe("text/plain");
  });

  it("keeps status, unrelated headers and the body", async () => {
    const floored = withSecurityFloor(
      new Response("body", { status: 418, headers: { "x-custom": "1", "set-cookie": "a=b" } }),
    );
    expect(floored.status).toBe(418);
    expect(floored.headers.get("x-custom")).toBe("1");
    expect(floored.headers.get("set-cookie")).toBe("a=b");
    expect(await floored.text()).toBe("body");
    for (const [name, value] of Object.entries(SECURITY_FLOOR)) {
      expect(floored.headers.get(name)).toBe(value);
    }
  });

  it("a null body stays null (204 / 304 / HEAD), and the floor still rides", () => {
    const floored = withSecurityFloor(new Response(null, { status: 204 }));
    expect(floored.status).toBe(204);
    expect(floored.body).toBeNull();
    expect(floored.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("a redirect keeps its location", () => {
    const floored = withSecurityFloor(
      new Response(null, { status: 303, headers: { location: "/blog/admin" } }),
    );
    expect(floored.status).toBe(303);
    expect(floored.headers.get("location")).toBe("/blog/admin");
  });

  it("_headers is one /* rule carrying the same three lines, newline-terminated", () => {
    const text = headersFileText();
    expect(text.endsWith("\n")).toBe(true);
    const lines = text.trimEnd().split("\n");
    expect(lines[0]).toBe("/*");
    expect(lines.slice(1)).toEqual(
      Object.entries(SECURITY_FLOOR).map(([name, value]) => `  ${name}: ${value}`),
    );
  });

  it("the HTTP/1.1 wire cost ADR-0001 addendum U cites — 106 bytes — is what the module spells", () => {
    // `name: value\r\n` per header. The figure is derived here so the prose
    // cannot drift from the code that ships the bytes.
    const bytes = Object.entries(SECURITY_FLOOR).reduce(
      (sum, [name, value]) => sum + name.length + 2 + value.length + 2,
      0,
    );
    expect(bytes).toBe(106);
  });
});
