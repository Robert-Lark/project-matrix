#!/usr/bin/env node
/**
 * Emits preview.html for each candidate direction from one shared template,
 * so all three boards render IDENTICAL real-component markup (the canonical
 * markup contract) under different primitive pours — differences you see are
 * the tokens, never the markup.
 *
 * Load order per page: shared tokens.css (semantic tier + forced-colors +
 * reduced-motion) → candidate fonts.css → candidate tokens.css (primitive
 * override) → the real component modules → the real chrome.css.
 *
 * Cover art: absolute file:// paths into the MAIN checkout's crate (the
 * image bytes are deliberately git-excluded — ADR-0002/issue #9). Open the
 * pages via file://; regenerate with `node build-previews.mjs`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CRATE_IMG =
  "file:///Users/roblark/Work/project-matrix/tools/snapshot-capture/crate/img";
const picks = JSON.parse(readFileSync(join(here, "picks.json"), "utf8"));

const DIRECTIONS = [
  {
    slug: "a-catalogue",
    name: "A · Catalogue",
    tagline: "mat-board for five hundred sleeves",
    face: "Familjen Grotesk (variable 400–700, tnum) — one face for everything",
    thesis:
      "The label's own catalogue: warm paper, slate-water accent, generous air. The covers are the color; the system is mat-board.",
    dials:
      "radii 5/14 px · soft double shadow · airy space scale (…2/3rem) · motion 170/280 ms gentle",
    signature:
      "Restraint as the signature: the quietest direction, betting that 500 real sleeves and aligned numerals carry the personality.",
    risk:
      "Reads 'tasteful default' if the type rhythm doesn't do enough work — the failure mode is anonymous minimalism.",
    displayStyle: "font-weight: 400; letter-spacing: -0.02em;",
    extraCss: "",
  },
  {
    slug: "b-faceplate",
    name: "B · Faceplate",
    tagline: "amber signal on warm charcoal",
    face: "Public Sans (variable 100–900, tnum) + JetBrains Mono metrics",
    thesis:
      "The instrument panel: the one canonical theme poured dark — warm charcoal, amber signal, machined edges, mono readouts. Sleeves glow like records under shop light.",
    dials:
      "radii 3/8 px · seated shadow (no float) · dense rack rhythm · motion 100/170 ms snappy",
    signature:
      "The dark pour itself + amber-on-charcoal HUD: the instrument register IS the identity; hover pours lighter, proving the seam.",
    risk:
      "Dark-canonical is the big bet: long-form reading fatigue, and 'portfolio reads as dashboard' if warmth is lost.",
    displayStyle: "font-weight: 640; letter-spacing: -0.015em;",
    extraCss: "",
  },
  {
    slug: "c-runout",
    name: "C · Runout",
    tagline: "a spec sheet you can shop from",
    face: "Archivo (variable wght × width 62–125, tnum) — width axis as display voice",
    thesis:
      "The pressing-plant document: cool paper, stamp blue, square corners, zero float. Structure by rule and tone — a spec sheet you can shop from.",
    dials:
      "radii 0/2 px · no shadow · document-grid space scale · motion 80/140 ms immediate",
    signature:
      "The width axis: condensed eyebrows and wide display from ONE face — plus the deadwax etch line on receipts.",
    risk:
      "Austerity: flat + square can read cold or unfinished if spacing precision slips anywhere.",
    displayStyle: "font-stretch: 118%; font-weight: 560; letter-spacing: -0.01em;",
    extraCss: ".spec-eyebrow { font-stretch: 68%; letter-spacing: 0.14em; }",
  },
];

const money = (p) => `$${p.amount.toFixed(2)}`;
const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const card = (r) => `      <li class="pm-release-card">
        <img class="pm-release-card__media" width="${r.w}" height="${r.h}"
             alt="${esc(r.alt)}" src="${CRATE_IMG}/${r.img}">
        <div class="pm-release-card__body">
          <h3 class="pm-release-card__title">${esc(r.title)}</h3>
          <p class="pm-release-card__artist">${esc(r.artist)}</p>
          <p class="pm-release-card__meta">${esc(r.format)} · ${r.year}</p>
          <div class="pm-release-card__foot">
            <span class="pm-release-card__price">${money(r.priceFrom)}</span>
            <span class="pm-release-card__stock">${r.numForSale} for sale</span>
          </div>
        </div>
      </li>`;

const swatch = (name) =>
  `<div class="sw"><span class="sw__chip" style="background: var(${name})"></span><code>${name.replace("--pm-", "")}</code></div>`;

const SLOTS = [
  "--pm-neutral-0", "--pm-neutral-50", "--pm-neutral-100", "--pm-neutral-200",
  "--pm-neutral-400", "--pm-neutral-600", "--pm-neutral-700", "--pm-neutral-900",
  "--pm-neutral-950", "--pm-accent-500", "--pm-accent-700", "--pm-danger-600",
];

const chromeCell = (label, current) =>
  current
    ? `<span class="pm-chrome__cell pm-chrome__cell--current" aria-current="true">${label}</span>`
    : `<a class="pm-chrome__cell" href="#">${label}</a>`;

const hud = () => `    <nav id="pm-chrome" aria-label="Project Matrix instrumentation">
      <div class="pm-chrome__row">
        <span class="pm-chrome__label">variant</span>
        ${chromeCell("vanilla", true)}${chromeCell("react")}${chromeCell("astro")}${chromeCell("qwik")}${chromeCell("htmx")}
      </div>
      <div class="pm-chrome__row">
        <span class="pm-chrome__label">profile</span>
        ${chromeCell("fast wifi · laptop", false)}${chromeCell("broadband · desktop", true)}${chromeCell("slow 4G · phone", false)}
        <span class="pm-chrome__label">your visit</span>
        ${["TTFB|64 ms", "FCP|0.4 s", "LCP|0.9 s", "CLS|0.01", "INP|48 ms"]
          .map((m) => {
            const [k, v] = m.split("|");
            return `<span class="pm-chrome__metric"><span class="pm-chrome__metric-name">${k}</span> <span class="pm-chrome__metric-value">${v}</span></span>`;
          })
          .join("")}
      </div>
    </nav>`;

for (const d of DIRECTIONS) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>aesthetic-direction · ${d.name}</title>

  <!-- Real system, candidate pour: shared tokens (semantic tier) → candidate
       fonts → candidate primitives (override) → REAL component modules. -->
  <link rel="stylesheet" href="../../../../../packages/tokens/css/tokens.css">
  <link rel="stylesheet" href="fonts.css">
  <link rel="stylesheet" href="tokens.css">
  <link rel="stylesheet" href="../../../../../packages/tokens/css/components/release-card.css">
  <link rel="stylesheet" href="../../../../../packages/tokens/css/components/button.css">
  <link rel="stylesheet" href="../../../../../packages/tokens/css/components/field.css">
  <link rel="stylesheet" href="../../../../../packages/switcher/src/chrome.css">

  <!-- Board scaffolding ONLY (semantic tokens, so it re-pours per candidate) -->
  <style>
    body { margin: 0; background: var(--color-surface-sunk); color: var(--color-text);
           font: var(--text-body)/1.55 var(--font-ui); }
    .board { max-width: 1060px; margin-inline: auto; padding: var(--pm-space-6) var(--pm-space-4); }
    .board h1 { font: var(--text-display)/1.08 var(--font-ui); ${d.displayStyle} margin: 0 0 var(--pm-space-2); }
    .board h2 { font: var(--weight-medium) var(--text-title)/1.2 var(--font-ui);
                margin: var(--pm-space-6) 0 var(--pm-space-3);
                padding-block-end: var(--pm-space-2); border-block-end: 1px solid var(--color-border); }
    .board__kicker { color: var(--color-text-muted); font-size: var(--text-small);
                     text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 var(--pm-space-3); }
    .board__meta { color: var(--color-text-muted); max-width: 70ch; margin: 0 0 var(--pm-space-2); }
    .board__meta strong { color: var(--color-text); font-weight: var(--weight-medium); }
    .sw-row { display: flex; flex-wrap: wrap; gap: var(--space-inline); }
    .sw { display: flex; flex-direction: column; gap: 2px; align-items: center; font-size: 0.7rem; }
    .sw code { color: var(--color-text-muted); }
    .sw__chip { width: 52px; height: 36px; border-radius: var(--radius-control);
                border: 1px solid var(--color-border); display: block; }
    .spec-display { font: var(--weight-normal) var(--text-display)/1.12 var(--font-ui); ${d.displayStyle} margin: 0; }
    .spec-line { display: flex; flex-wrap: wrap; gap: var(--space-gap); align-items: baseline; margin-block-start: var(--space-stack); }
    .spec-weights span { font-size: var(--text-title); }
    .spec-nums { font: var(--weight-medium) var(--text-title)/1 var(--font-metric);
                 font-variant-numeric: var(--numeric-metric); }
    .spec-eyebrow { font: var(--weight-medium) var(--text-small)/1 var(--font-ui);
                    text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-text-muted); }
    ${d.extraCss}
    .panel { background: var(--color-surface); border: 1px solid var(--color-border);
             border-radius: var(--radius-card); box-shadow: var(--shadow-card); padding: var(--space-inset); }
    .row { display: flex; flex-wrap: wrap; gap: var(--pm-space-4); align-items: center; }
    .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--pm-space-5); }
    .receipt { font: var(--text-small)/1.6 var(--font-metric); font-variant-numeric: var(--numeric-metric);
               border: 1px solid var(--color-border); border-radius: var(--radius-card);
               background: var(--color-surface); padding: var(--space-inset); max-width: 46rem; }
    .receipt__etch { margin-block-start: var(--space-stack); padding-block-start: var(--space-stack);
                     border-block-start: 1px dashed var(--color-border);
                     letter-spacing: 0.22em; color: var(--color-text-muted); }
  </style>
</head>
<body>
${hud()}
  <main class="board">
    <p class="board__kicker">aesthetic-direction · candidate board · real components, real crate</p>
    <h1>${d.name} — ${esc(d.tagline)}</h1>
    <p class="board__meta">${esc(d.thesis)}</p>
    <p class="board__meta"><strong>Face:</strong> ${esc(d.face)}</p>
    <p class="board__meta"><strong>Dials:</strong> ${esc(d.dials)}</p>
    <p class="board__meta"><strong>Signature:</strong> ${esc(d.signature)}</p>
    <p class="board__meta"><strong>Risk:</strong> ${esc(d.risk)}</p>

    <h2>Palette — the twelve slots</h2>
    <div class="sw-row">${SLOTS.map(swatch).join("")}</div>

    <h2>Type specimen</h2>
    <p class="spec-eyebrow">Ambient · Melodic Techno · Neo-Classical — 2006–2026</p>
    <p class="spec-display">One store, five architectures, real numbers.</p>
    <div class="spec-line">
      <span class="spec-weights"><span style="font-weight: var(--weight-normal)">Normal 400</span> ·
        <span style="font-weight: var(--weight-medium)">Medium 550</span> ·
        <span style="font-weight: var(--weight-bold)">Bold 700</span></span>
      <span class="spec-nums">TTFB 412→15 ms · $515.24 · 1,817 files</span>
    </div>

    <h2>The store — PLP grid (8 of 500, frozen 2026-07-11)</h2>
    <ul class="pm-grid">
${picks.slice(0, 8).map(card).join("\n")}
    </ul>

    <h2>Controls</h2>
    <div class="row">
      <button class="pm-button" type="button">Add to cart</button>
      <button class="pm-button pm-button--secondary" type="button">Save for later</button>
      <button class="pm-button" type="button" disabled>Sold out</button>
    </div>

    <h2>Forms</h2>
    <div class="two">
      <div class="panel">
        <div class="pm-field">
          <label class="pm-field__label" for="email-${d.slug}">Email address</label>
          <input class="pm-field__control" id="email-${d.slug}" name="email" type="email"
                 autocomplete="email" aria-describedby="hint-${d.slug}">
          <span class="pm-field__hint" id="hint-${d.slug}">We'll send your receipt here.</span>
        </div>
      </div>
      <div class="panel">
        <div class="pm-field">
          <label class="pm-field__label" for="card-${d.slug}">Card number</label>
          <input class="pm-field__control" id="card-${d.slug}" name="card" inputmode="numeric"
                 aria-describedby="err-${d.slug}" aria-invalid="true">
          <span class="pm-field__error" id="err-${d.slug}">Enter the 16-digit number on the front of your card.</span>
        </div>
      </div>
    </div>

    <h2>Instrument sketch — receipt voice (exploratory, not a component)</h2>
    <div class="receipt">
      <div>PM-BENCH RECEIPT · commit f60385f · captured 2026-07-11 · slow-4G / mid-phone · median of 9</div>
      <div>TTFB 412 ms (navigation timing) · transfer 128.4 KB brotli (CDP) · CPU 84 ms (V8 profile)</div>
      <div class="receipt__etch">&#9651; PM-2026-07-11 · F60385F · SLOW-4G · N=9 &#9651;</div>
    </div>
  </main>
</body>
</html>
`;
  writeFileSync(join(here, d.slug, "preview.html"), html);
  console.log(`wrote ${d.slug}/preview.html`);
}
