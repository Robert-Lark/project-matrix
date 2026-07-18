/**
 * How it was built — the process as evidence. Content is GENERATED from
 * docs/ at build time (never re-typed): the ADR index is parsed from the ADR
 * files' own frontmatter + titles, the phase list from build-log headings.
 * The full generation pipeline (rendering whole ADRs as readable pages) is
 * owned by the workers/front build downstream (session ADR); this master
 * pins the surface's markup contract with the real index as content.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "./lib.mjs";
import { page } from "./shell.mjs";

const docsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "docs");

function adrIndex() {
  return readdirSync(join(docsDir, "adr"))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const src = readFileSync(join(docsDir, "adr", f), "utf8");
      const date = src.match(/^date:\s*(\S+)/m)?.[1] ?? "";
      const title = src.match(/^# (.+)$/m)?.[1] ?? f;
      const status = src.match(/^status:\s*(\S+)/m)?.[1] ?? "";
      return { file: f, date, title, status };
    });
}

function phaseIndex() {
  const log = readFileSync(join(docsDir, "build-log.md"), "utf8");
  return [...log.matchAll(/^## (Phase \d+ — .+)$/gm)].map((m) => m[1]);
}

export function renderHowBuilt({ extraDepth = 0 } = {}) {
  const adrs = adrIndex();
  const phases = phaseIndex();

  const content = `      <div class="pm-doc">
        <nav class="pm-doc__toc" aria-label="Contents">
          <details open>
            <summary>Decision records</summary>
            <ul role="list">
              ${adrs.map((a) => `<li><a href="#${esc(a.file.replace(/\.md$/, ""))}">${esc(a.title.split(" — ")[0])}</a></li>`).join("\n              ")}
            </ul>
          </details>
          <details open>
            <summary>Build log</summary>
            <ul role="list">
              ${phases.map((p, i) => `<li><a href="#phase-${i}">${esc(p)}</a></li>`).join("\n              ")}
            </ul>
          </details>
        </nav>
        <div class="pm-doc__body">
          <header>
            <p class="pm-page__kicker">How it was built</p>
            <h1 class="pm-page__title">The decision record, in the open</h1>
          </header>
          <div class="pm-prose">
            <p>Every load-bearing decision behind this site — how measurement stays fair, why the data is frozen, how six rendering paradigms share one design system without sharing code — was written down when it was made, with the alternatives that lost. This page is that record, generated from the repository's own files; nothing here is retyped for presentation.</p>
            <p>The short version of the method: decide one thing per session, record it as an architecture decision record, attack the decision with an adversarial review before building on it, and let every published number carry a receipt. The store you're browsing is the working end of that process.</p>
            <h2 id="decision-records">Decision records</h2>
            <ul>
              ${adrs
                .map(
                  (a) =>
                    `<li id="${esc(a.file.replace(/\.md$/, ""))}"><a href="https://github.com/Robert-Lark/project-matrix/blob/main/docs/adr/${esc(a.file)}" rel="noopener">${esc(a.title)}</a> — <time datetime="${esc(a.date)}">${esc(a.date)}</time>, ${esc(a.status)}</li>`,
                )
                .join("\n              ")}
            </ul>
            <h2 id="build-log">Build log</h2>
            <p>The narrative record, phase by phase — including the failures and the reviews that caught them:</p>
            <ul>
              ${phases
                .map(
                  (p, i) =>
                    `<li id="phase-${i}"><a href="https://github.com/Robert-Lark/project-matrix/blob/main/docs/build-log.md" rel="noopener">${esc(p)}</a></li>`,
                )
                .join("\n              ")}
            </ul>
            <p>The full files — the decision map, the reviews, the prototypes with their findings — live in <a href="https://github.com/Robert-Lark/project-matrix" rel="noopener">the public repository</a>.</p>
          </div>
        </div>
      </div>`;

  return page({
    title: "How it was built — Project Matrix",
    depth: 2 + extraDepth,
    css: ["components/prose.css", "surfaces/how-built.css"],
    current: null,
    content,
  });
}
