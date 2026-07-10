/**
 * Composed-origin integration suite (issue #3) — extends the spike's
 * 18-assertion suite (docs/prototypes/cf-composition/test.sh, the prior art).
 * Outside-in at the composed origin: plain HTTP, no Worker internals (PRD
 * testing decisions — the composition seam is the contract).
 *
 * Base URL: PM_ORIGIN (default: local cross-process dev via run-local.mjs).
 * PM_EXPECT_BROTLI=1 (the post-deploy smoke) upgrades the value-agnostic
 * content-encoding parity assertion to "specifically Brotli" (ADR-0001 §6).
 *
 * Chrome-injection assertions are deliberately absent — the chrome slice
 * (issue #5) owns the HTMLRewriter leg; until then the slot stays empty.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ORIGIN = (process.env.PM_ORIGIN ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const EXPECT_BROTLI = process.env.PM_EXPECT_BROTLI === "1";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const get = (path: string, init?: RequestInit) => fetch(`${ORIGIN}${path}`, init);

/** content-encoding as the wire actually carries it (fetch would decode). */
function wireEncoding(path: string): string {
  return execFileSync(
    "curl",
    ["-s", "-o", "/dev/null", "-H", "Accept-Encoding: br, gzip",
      "-w", "%header{content-encoding}", `${ORIGIN}${path}`],
    { encoding: "utf8" },
  ).trim();
}

describe("front Worker: own assets + dispatch", () => {
  it("/ serves the throwaway index assets-first, chrome-free", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("PM-INDEX-MARKER");
    expect(body).not.toContain("pm-chrome-slot");
  });

  it("unknown variant prefixes 404", async () => {
    expect((await get("/nope/x")).status).toBe(404);
    expect((await get("/definitely-missing")).status).toBe(404);
  });

  it("dispatches each placeholder prefix over its service binding", async () => {
    const staticRes = await get("/placeholder-static/sample/");
    expect(staticRes.status).toBe(200);
    const ssrRes = await get("/placeholder-ssr/sample/");
    expect(ssrRes.status).toBe(200);
    expect(ssrRes.headers.get("x-pm-ssr")).toBe("1");
  });
});

describe("the shared surface (both variants, same page)", () => {
  for (const variant of ["placeholder-static", "placeholder-ssr"]) {
    it(`${variant} renders the canonical sample markup with the chrome slot`, async () => {
      const body = await (await get(`/${variant}/sample/`)).text();
      expect(body).toContain("<h1>Sample surface</h1>");
      expect(body).toContain('class="pm-release-card');
      expect(body).toContain('id="pm-chrome-slot"');
      // Shared design system, delivered as the variant's own assets.
      expect(body).toContain("../assets/pm/css/tokens.css");
      expect(body).toContain("PMPlaceholderSans.var.woff2");
    });
  }

  it("a variant swap is a pure prefix rewrite onto the same surface", async () => {
    // Same measurement condition under the other paradigm (ADR-0004 §4–§5):
    // both serve /{variant}/sample/ and render the same sample components —
    // the reference render's grid verbatim (both cards), so the drift gate
    // (issue #6) has a congruent subtree to compare.
    const a = await (await get("/placeholder-static/sample/")).text();
    const b = await (await get("/placeholder-ssr/sample/")).text();
    for (const marker of [
      "Kind Of Blue",
      "$21.50",
      "A Love Supreme",
      "$28.00",
      "pm-release-card__price",
    ]) {
      expect(a).toContain(marker);
      expect(b).toContain(marker);
    }
  });
});

describe("permitted paradigm noise (drift-gate raw material, ADR-0003 §6)", () => {
  it("SSR output carries hydration marker, comment node, and scoping hash", async () => {
    const body = await (await get("/placeholder-ssr/sample/")).text();
    expect(body).toContain('data-ph-hydrate="idle"');
    expect(body).toContain("<!-- ph:ssr-boundary -->");
    expect(body).toContain("ph-x7f3a2");
  });

  it("static output is the clean control — no noise", async () => {
    const body = await (await get("/placeholder-static/sample/")).text();
    expect(body).not.toContain("data-ph-hydrate");
    expect(body).not.toContain("ph:ssr-boundary");
    expect(body).not.toContain("ph-x7f3a2");
  });
});

describe("fidelity through the service-binding hop (ADR-0004 §5)", () => {
  it("path and query arrive at the variant unmodified", async () => {
    const res = await get("/placeholder-ssr/sample/?n=240&cache=cold");
    expect(res.headers.get("x-pm-echo-path")).toBe("/placeholder-ssr/sample/");
    expect(res.headers.get("x-pm-echo-search")).toBe("?n=240&cache=cold");
  });

  it("request headers arrive intact", async () => {
    const res = await get("/placeholder-ssr/sample/", {
      headers: { "x-pm-probe": "fidelity-abc123" },
    });
    expect(res.headers.get("x-pm-echo-probe")).toBe("fidelity-abc123");
  });

  it("upstream response headers survive the hop", async () => {
    const res = await get("/placeholder-ssr/sample/");
    expect(res.headers.get("x-pm-ssr")).toBe("1");
  });

  it("trailing-slash redirects pass through with the prefix intact", async () => {
    for (const variant of ["placeholder-static", "placeholder-ssr"]) {
      const res = await get(`/${variant}/sample`, { redirect: "manual" });
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain(`/${variant}/sample/`);
    }
  });
});

describe("non-HTML passthrough (byte-identical)", () => {
  // BOTH variants: the SSR variant's asset hop (binding → script → own
  // ASSETS binding, spike hardening 1) is the one composition hop the spike
  // could never verify in production — the post-deploy smoke must cover it.
  for (const variant of ["placeholder-static", "placeholder-ssr"]) {
    it(`${variant}: the tokens stylesheet arrives byte-identical to its source`, async () => {
      const res = await get(`/${variant}/assets/pm/css/tokens.css`);
      expect(res.status).toBe(200);
      const source = readFileSync(
        join(repoRoot, "packages/tokens/css/tokens.css"),
        "utf8",
      );
      expect(await res.text()).toBe(source);
    });

    it(`${variant}: the font arrives byte-identical to its source, typed as woff2`, async () => {
      const res = await get(
        `/${variant}/assets/pm/fonts/PMPlaceholderSans.var.woff2`,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("woff2");
      const source = readFileSync(
        join(repoRoot, "packages/tokens/fonts/PMPlaceholderSans.var.woff2"),
      );
      const wire = Buffer.from(await res.arrayBuffer());
      expect(wire.equals(source)).toBe(true);
    });
  }
});

describe("transport parity (ADR-0001 §6)", () => {
  it(
    EXPECT_BROTLI
      ? "equivalent responses are Brotli-compressed on the deployed origin"
      : "equivalent responses carry identical content-encoding (value-agnostic locally)",
    () => {
      const a = wireEncoding("/placeholder-static/sample/");
      const b = wireEncoding("/placeholder-ssr/sample/");
      expect(a).toBe(b);
      if (EXPECT_BROTLI) expect(a).toBe("br");
    },
  );
});

describe("observability posture at the seam", () => {
  it("an unexpected variant error returns a generic message — no details, no stack", async () => {
    const res = await get("/placeholder-ssr/sample/boom");
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toContain("internal error");
    expect(body).not.toContain("boom");
    expect(body).not.toMatch(/\bat .+\.js/);
    expect(body).not.toContain("Error:");
  });
});
