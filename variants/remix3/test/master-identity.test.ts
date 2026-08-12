/**
 * remix3 editorial equals the master by normalized DOM, both snapshots
 * (pre-merge; editorial-build slice F). The byte-strict vanilla/htmx
 * mechanism CANNOT hold here — Remix 3's serializer reorders attributes
 * (class last), leaves quotes raw in text where the reference escapes
 * `&#39;`, and self-closes voids — so this is the react-next mechanism: the
 * ACTUAL drift-gate normalizer (PAGE_NORMALIZE) over linkedom, master under
 * NO_NOISE, variant under NO_NOISE too (remix3's registration is
 * measured-empty) plus the fenced-subtree drop that is this slice's one
 * normalizer extension.
 *
 * In the variant's own workspace, not repo-checks (the astro precedent):
 * rendering needs remix/ui's JSX runtime. The variant side renders through
 * the WORKER's real fetch path with a stub EDGE serving the same committed
 * trays the master renders from — so the snapshot policy module, the
 * controller, the render middleware, and the serializer all execute here
 * pre-merge (the slice-E guard-derives-through-the-variant's-own-module
 * lesson).
 *
 * DETERMINISM NOTE (why this guard may BLOCK while the drift leg is
 * advisory): the lockfile exact-pins the whole render path, so this guard's
 * outcome can only change when a commit changes the tree — the weekly-beta
 * weather ADR-0003's first addendum fences out of CI cannot reach it.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";

import { NO_NOISE, PAGE_NORMALIZE, PERMITTED_NOISE, type NoiseSpec } from "@pm/drift-gate";

import worker from "../src/worker.ts";
import { REMIX_VERSION } from "../src/ui/plaque.tsx";

const variantRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(variantRoot, "..", "..");

/** linkedom's parser keeps attribute-name case a real browser's tokenizer
 *  would lowercase — the react-next guard's recorded fixup, reused. */
function lowercaseAttributeNames(document: ReturnType<typeof parseHTML>["document"]): void {
  for (const el of document.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      const lower = attr.name.toLowerCase();
      if (lower !== attr.name) {
        const value = attr.value;
        el.removeAttribute(attr.name);
        el.setAttribute(lower, value);
      }
    }
  }
}

function normalizeHtml(html: string, noise: NoiseSpec, dropFencedSubtrees = false): string {
  const { document, Node } = parseHTML(html);
  lowercaseAttributeNames(document);
  const g = globalThis as unknown as { document?: unknown; Node?: unknown };
  const prevDocument = g.document;
  const prevNode = g.Node;
  g.document = document;
  g.Node = Node;
  try {
    return PAGE_NORMALIZE({
      attrPatterns: [...noise.attrPatterns],
      classPatterns: [...noise.classPatterns],
      behaviorAttrPatterns: [...noise.behaviorAttrPatterns],
      dropElementSelectors: noise.dropElementSelectors ? [...noise.dropElementSelectors] : [],
      dropFencedSubtrees,
    });
  } finally {
    g.document = prevDocument;
    g.Node = prevNode;
  }
}

const countFenced = (html: string): number => {
  const { document } = parseHTML(html);
  return document.querySelectorAll("[data-pm-fenced]").length;
};

describe("remix3 editorial equals the master by normalized DOM, both snapshots (pre-merge)", () => {
  for (const name of ["fixture", "crate"] as const) {
    it(`${name}: the Worker's served page matches renderEditorial modulo the two fenced subtrees`, async () => {
      const lib = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
      );
      const reference = await import(
        pathToFileURL(join(repoRoot, "packages", "reference", "render", "editorial.mjs")).href
      );
      const snapshot = lib.loadSnapshot(name);
      const master = reference.renderEditorial(snapshot, { origin: "" });
      expect(master).not.toBe("");

      // The variant side goes through the REAL Worker path: stub EDGE
      // serving this snapshot's manifest + featured detail, so the
      // variant's own featured-id policy picks the id — cross-checked
      // against the reference's — rather than the test wiring it.
      const featuredId = lib.featuredIds(snapshot).editorial as number;
      const snapshotPolicy = await import(
        pathToFileURL(join(variantRoot, "src", "snapshot.mjs")).href
      );
      expect(snapshotPolicy.featuredIdFor(snapshot.manifest.crate)).toBe(featuredId);
      expect(snapshotPolicy.isFixtureCrate(snapshot.manifest.crate)).toBe(name === "fixture");

      const detail = snapshot.details.find((d: { id: number }) => d.id === featuredId);
      if (!detail) throw new Error(`${name}: no detail tray for id ${featuredId}`);
      const env = {
        EDGE: {
          fetch: (input: string) => {
            const path = new URL(input).pathname;
            if (path === "/api/snapshot") return Promise.resolve(Response.json(snapshot.manifest));
            if (path === `/api/pdp/${featuredId}`) return Promise.resolve(Response.json(detail));
            return Promise.resolve(new Response("not found\n", { status: 404 }));
          },
        },
      };
      const res = await worker.fetch(
        new Request("https://pm-front.example/remix3/editorial/"),
        env,
      );
      expect(res.status).toBe(200);
      const variant = await res.text();

      // Fenced-count non-vacuity BEFORE the drop: exactly the plaque and
      // the frames demo on the variant page, none on the master — an
      // unexpected third fenced subtree must fail here, not ride the fence.
      expect(countFenced(variant)).toBe(2);
      expect(countFenced(master)).toBe(0);

      // remix3's PERMITTED_NOISE registration is measured-empty (the
      // astro/htmx precedent) — pinned here so a future registration has to
      // arrive together with a change to this guard's premises.
      expect(PERMITTED_NOISE["remix3"]).toBeUndefined();

      const masterDom = normalizeHtml(master, NO_NOISE);
      const variantDom = normalizeHtml(variant, NO_NOISE, true);
      expect(variantDom).not.toBe("");
      expect(variantDom).toContain("pm-editorial");
      expect(variantDom).toBe(masterDom);
    });
  }

  it("the fenced drop is load-bearing: without it the same page DIVERGES from the master", async () => {
    // The complement that keeps the extension honest (the slice-D
    // non-vacuity lesson): if the plaque/demo ever stopped reaching the
    // served page, dropFencedSubtrees would be excusing nothing and the
    // advisory leg's green would be vacuous.
    const lib = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "lib.mjs")).href
    );
    const reference = await import(
      pathToFileURL(join(repoRoot, "packages", "reference", "render", "editorial.mjs")).href
    );
    const snapshot = lib.loadSnapshot("fixture");
    const master = reference.renderEditorial(snapshot, { origin: "" });
    const featuredId = lib.featuredIds(snapshot).editorial as number;
    const detail = snapshot.details.find((d: { id: number }) => d.id === featuredId);
    const env = {
      EDGE: {
        fetch: (input: string) => {
          const path = new URL(input).pathname;
          if (path === "/api/snapshot") return Promise.resolve(Response.json(snapshot.manifest));
          if (path === `/api/pdp/${featuredId}`) return Promise.resolve(Response.json(detail));
          return Promise.resolve(new Response("not found\n", { status: 404 }));
        },
      },
    };
    const res = await worker.fetch(new Request("https://pm-front.example/remix3/editorial/"), env);
    const variant = await res.text();
    expect(normalizeHtml(variant, NO_NOISE, false)).not.toBe(normalizeHtml(master, NO_NOISE));
  });

  it("the plaque's version string IS the installed exact pin (tool-derived, never typed)", () => {
    const pkg = JSON.parse(readFileSync(join(variantRoot, "package.json"), "utf8"));
    expect(REMIX_VERSION).toBe(pkg.dependencies.remix);
    // An exact pin, not a range: the lockfile is the real pin for the
    // caret-ranged sub-packages, but the metapackage itself must not float.
    expect(REMIX_VERSION).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
    const installed = JSON.parse(
      readFileSync(join(variantRoot, "node_modules", "remix", "package.json"), "utf8"),
    );
    expect(installed.version).toBe(REMIX_VERSION);
  });
});
