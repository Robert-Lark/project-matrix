// Assemble the vanilla variant's dist: static HTML, no runtime — the build
// script IS the paradigm (a hand-rolled static site generator over the frozen
// trays). Snapshot-parameterized via PM_SNAPSHOT (fixture default — the CI
// build, always; the deploy job sets `crate` so the plane serves pages baked
// from the snapshot it actually serves, ADR-0002 §7 / ADR-0008 §9). The
// selector and the tray files are declared to turbo (env + inputs on
// @pm/vanilla#build) — an undeclared selector would replay the origin job's
// fixture-flavored dist straight onto the crate plane (turbo.json documents
// the failure mode).
//
// Copying @pm/tokens into the variant's own assets is the paradigm's
// delivery model (ADR-0003 §2), resolved through this package's own declared
// dependency — the placeholder-static mold.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { renderCheckoutPage, renderEditorialPage, renderPdpPage } from "./render.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(root, "..", "..");

const SNAPSHOTS = {
  fixture: join(repoRoot, "tools", "snapshot-fixture", "snapshot"),
  crate: join(repoRoot, "tools", "snapshot-capture", "crate"),
};

const name = process.env.PM_SNAPSHOT ?? "fixture";
const snapDir = SNAPSHOTS[name];
if (!snapDir) {
  console.error(`PM_SNAPSHOT=${name} is not a known snapshot (fixture|crate)`);
  process.exit(1);
}

const read = (f) => JSON.parse(readFileSync(join(snapDir, f), "utf8"));
const snapshot = {
  name,
  manifest: read("manifest.json"),
  summaries: read("summaries.json"),
  details: read("details.json"),
};

// The featured release: the fixture's curation.json names it; the crate's
// frozen curation predates the field, so the crate pick is a design constant
// (ADR-0008 §9: editorial 953800 — a curated choice, like the crate itself).
const featuredId =
  name === "crate" ? 953800 : read("curation.json").featured;
if (featuredId == null) throw new Error(`${name}: no featured release id`);

const tokensRoot = dirname(
  dirname(
    createRequire(join(root, "package.json")).resolve(
      "@pm/tokens/css/tokens.css",
    ),
  ),
);
const dist = join(root, "dist", "vanilla");

rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(join(dist, "editorial"), { recursive: true });

writeFileSync(
  join(dist, "editorial", "index.html"),
  renderEditorialPage(snapshot, featuredId),
);

// The PDP, one static page per release (pdp-build). This is what the
// build-time paradigm actually costs on a catalogue surface, and it is
// published rather than avoided: generation time and dist size scale with
// the crate, where the request-time variants pay per visit instead. Building
// only the handful of releases the bench measures would be rigging the
// variant to fit the instrument (the rejected assetsInlineLimit precedent).
//
// The URL is slug-keyed — /vanilla/pdp/{id}-{artist}-{title}/ — which every
// variant's release card already links to. A non-canonical slug 404s here by
// construction (no file), and the request-time variants match that
// deliberately rather than redirecting: a 301 they can serve and this one
// cannot would be an observable behavioural difference between paradigms on
// the very surface that measures them.
let pdpCount = 0;
for (const detail of snapshot.details) {
  const dir = join(dist, "pdp", detail.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), renderPdpPage(snapshot, detail, { depth: 2 }));
  pdpCount += 1;
}
// The checkout, one static page (checkout-vanilla). Data-free by contract —
// `renderCheckout` takes no snapshot (packages/reference/render/build.mjs:78
// discards it) — so unlike editorial and the PDP this page is byte-identical
// under both snapshots.
mkdirSync(join(dist, "checkout"), { recursive: true });
writeFileSync(
  join(dist, "checkout", "index.html"),
  renderCheckoutPage({ depth: 1 }),
);

// The cart catalogue: id → what the order summary needs to render a line
// (cart-summary.css pins the shape — thumb, title × qty, price). Cart is
// localStorage, so no paradigm can SERVE cart contents (ADR-0008 §7) and
// every checkout variant has to resolve the ids client-side. A separate
// asset rather than an inline payload, and fetched only when the cart is
// non-empty: the canonical served state IS the empty cart, so the page the
// instrument measures pays nothing for this. Inlining it would have put
// tens of kilobytes of catalogue on the flagship INP page for a state the
// measurement never enters — a manufactured paradigm cost, which is the
// defect PR #35 had just finished removing from the ruler.
mkdirSync(join(dist, "assets"), { recursive: true });
const catalogue = Object.fromEntries(
  snapshot.summaries.map((s) => [
    String(s.id),
    {
      title: s.title,
      price: s.priceFrom?.currency === "USD" ? s.priceFrom.amount : null,
      thumb: s.cover.src.replace(/\.avif$/, ".thumb.avif"),
    },
  ]),
);
writeFileSync(
  join(dist, "assets", "cart-catalogue.json"),
  JSON.stringify({ v: 1, items: catalogue }),
);

cpSync(join(tokensRoot, "css"), join(dist, "assets", "pm", "css"), {
  recursive: true,
});
cpSync(join(tokensRoot, "fonts"), join(dist, "assets", "pm", "fonts"), {
  recursive: true,
});
cpSync(join(root, "src", "cart.js"), join(dist, "assets", "cart.js"));
cpSync(join(root, "src", "pdp.js"), join(dist, "assets", "pdp.js"));
cpSync(join(root, "src", "checkout.js"), join(dist, "assets", "checkout.js"));

console.log(
  `vanilla: editorial + ${pdpCount} PDPs + checkout rendered from the ${name} snapshot`,
);
