/**
 * How it was built — the process as evidence (ADR-0008 §8; the PRD at
 * docs/prds/how-it-was-built-build.md is the contract).
 *
 * The surface INDEXES the record; it never copies it. Every list is generated
 * at render time from the file it names — the ADR index from docs/adr/*.md
 * frontmatter + titles, each ADR's corrections from its own `## Addendum`
 * headings, the phase list from docs/build-log.md, the reviews from
 * docs/reviews/, and the methodology sections from the served page's own
 * <h2 id> list (workers/front/methodology/index.html — that page KEEPS its
 * URL and is indexed, PRD Decision 2). Nothing in the lists is retyped; the
 * prose between them is authored, and the page says so. The build line sits
 * in the <header> as the dek — prose.css's contract is "no classes inside
 * .pm-prose". Rendering whole ADRs as pages was declined (PRD Decision 1).
 *
 * ONE renderer, two heads (PRD Decision 4). The committed master
 * (render/build.mjs) and the served page (workers/front, written at build
 * attestation) are both this function. The front passes its own pre-composed
 * `head` — inlined CSS and /pm/ font paths, the home delivery shape (ADR-0007
 * §6) — and the build attestation `{sha, dirty}`, which pins every deep link
 * to the served commit. The master passes neither, so its bytes stay stable
 * while docs move; its INDEX is pinned by test/reference.test.ts.
 *
 * Deep links are receipts (PRD Decision 1): `blob/{ref}/{path}` where `ref`
 * is the attested SHA — or `main` when the tree was dirty, said so on the
 * page. Two anchor forms, by what GitHub can show:
 *  - an ADR is rendered, so an addendum links GitHub's own heading anchor
 *    (`#addendum--…`). The rule is github-slugger's, pinned in
 *    test/reference.test.ts to anchors GitHub rendered on 2026-09-02;
 *  - the build log is NOT rendered by GitHub's blob view (its payload carries
 *    `richText: null, richTextTruncated: true` at 403 KB, checked 2026-09-02),
 *    so a heading fragment would scroll nowhere. A phase links the code view
 *    at the heading's own line (`?plain=1#L<n>`) — exact at a pinned SHA.
 * tools/repo-checks re-derives every fragment from the named file (slug from
 * its headings, line from its text), so either kind rots loudly, offline.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "./lib.mjs";
import { page } from "./shell.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const docsDir = join(repoRoot, "docs");
const methodologyPath = join(repoRoot, "workers", "front", "methodology", "index.html");

export const REPO_URL = "https://github.com/Robert-Lark/project-matrix";

/**
 * The ref every deep link pins, DERIVED from the build attestation the front
 * already writes to /_pm/build.json (workers/front/stamp-build.mjs). One
 * function, so the front, the served-vs-master leg and the master cannot
 * disagree about the dirty rule: a SHA off an unclean tree would be a receipt
 * pointing at the wrong bytes, worse than an honest moving ref (PRD
 * Decision 1). No attestation (the committed master) → `main`.
 */
export function refFor(build) {
  if (build == null) return "main";
  if (
    typeof build.dirty !== "boolean" ||
    typeof build.sha !== "string" ||
    !/^[0-9a-f]{40}$/.test(build.sha)
  ) {
    throw new Error(
      `how-built: build attestation is malformed (${JSON.stringify(build)}) — expected {sha: <40 hex>, dirty: boolean}, the /_pm/build.json shape`,
    );
  }
  return build.dirty ? "main" : build.sha;
}

/**
 * GitHub's heading anchor for one heading's text (github-slugger): lowercase;
 * drop every character that is not a letter, mark, number, connector
 * punctuation, hyphen or space; spaces become hyphens. So `## Addendum — the
 * ruler's accounting fixes (2026-08-01, issue #16 + audit)` becomes
 * `addendum--the-rulers-accounting-fixes-2026-08-01-issue-16--audit`, which
 * is the id the rendered page carries (fetched 2026-09-02). Duplicate slugs
 * within one document are numbered by `githubAnchors`, not here.
 */
export function githubSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
    .replace(/ /g, "-");
}

/**
 * Every heading in a markdown document, in order, with the anchor GitHub
 * renders for it. All levels are walked because GitHub numbers duplicate
 * slugs across the whole document (`-1`, `-2`, …); fenced code is skipped
 * because a `# comment` inside a fence is not a heading.
 */
export function githubAnchors(markdown) {
  const occurrences = new Map();
  const anchors = [];
  let fenced = false;
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^ {0,3}(```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const m = line.match(/^(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/);
    if (!m) continue;
    const text = m[2].trim();
    const base = githubSlug(text);
    let slug = base;
    while (occurrences.has(slug)) {
      occurrences.set(base, (occurrences.get(base) ?? 0) + 1);
      slug = `${base}-${occurrences.get(base)}`;
    }
    occurrences.set(slug, occurrences.get(slug) ?? 0);
    // `line` is 1-based: the number GitHub's code view gives the heading.
    anchors.push({ level: m[1].length, text, slug, line: i + 1 });
  }
  return anchors;
}

/** A field the index renders must exist: `<time datetime="">` is invalid
 *  HTML and a line ending in " — " is a half-sentence, and no guard reads the
 *  text (verify-slice). Refuse the render, naming the file and the field. */
function required(value, file, field) {
  if (value == null || value === "") {
    throw new Error(`how-built: ${file} has no ${field} — the index renders it; add the field rather than ship an empty slot`);
  }
  return value;
}

/**
 * GitHub slugs a heading's RENDERED text — a link's label rather than its
 * URL, emphasis without its delimiters, entities decoded — while this rule
 * slugs the source. The two agree for every indexed heading today (pinned by
 * the fetched vectors in test/reference.test.ts) and would not for one that
 * carries inline markdown, so such a heading REFUSES the render rather than
 * minting a fragment that scrolls nowhere (verify-slice, correctness +
 * skeptic lenses). Underscores are kept by GitHub inside a word
 * (`snake_case`) and dropped as emphasis delimiters, so only delimiter
 * positions are refused. Applied to the headings this page LINKS by slug —
 * the addenda; phases link by line, and the dedupe counter over other
 * headings only ever adds a numeric suffix.
 */
const INLINE_MARKDOWN = /\]\(|<|&[#A-Za-z0-9]+;|(?<!\w)_|_(?!\w)/;
function assertSluggable(text, where) {
  if (INLINE_MARKDOWN.test(text)) {
    throw new Error(
      `how-built: the ${where} heading "${text}" carries inline markdown (a link, HTML, an entity or _emphasis_) — GitHub slugs the rendered text and this renderer slugs the source, so decide the anchor rule for it before linking it`,
    );
  }
}

const blob = (ref, path, fragment) =>
  `${REPO_URL}/blob/${ref}/${path}${fragment ? `#${fragment}` : ""}`;
/** The code view at one line — for a file GitHub's blob view will not render. */
const blobLine = (ref, path, line) => `${REPO_URL}/blob/${ref}/${path}?plain=1#L${line}`;

function adrIndex(ref) {
  return readdirSync(join(docsDir, "adr"))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const src = readFileSync(join(docsDir, "adr", f), "utf8");
      const stem = f.replace(/\.md$/, "");
      const file = `docs/adr/${f}`;
      const date = required(src.match(/^date:\s*(\d{4}-\d{2}-\d{2})\s*$/m)?.[1], file, "date: YYYY-MM-DD");
      const title = required(src.match(/^# (.+)$/m)?.[1], file, "# title");
      const status = required(src.match(/^status:\s*(\S+)/m)?.[1], file, "status:");
      // The corrections: every `## Addendum…` heading, linked to ITS anchor.
      // An index that showed ADR-0001 as one accepted line would hide five
      // later corrections to it — the strongest evidence this page has.
      const addenda = githubAnchors(src)
        .filter((a) => a.level === 2 && /^Addendum\b/.test(a.text))
        .map((a, i) => ({
          id: (assertSluggable(a.text, `${file} addendum`), `${stem}-addendum-${i + 1}`),
          text: a.text,
          href: blob(ref, `docs/adr/${f}`, a.slug),
        }));
      return { stem, date, title, status, href: blob(ref, `docs/adr/${f}`), addenda };
    });
}

function phaseIndex(ref) {
  const log = readFileSync(join(docsDir, "build-log.md"), "utf8");
  return githubAnchors(log)
    .filter((a) => a.level === 2 && /^Phase \d+ — /.test(a.text))
    .map((a) => ({
      // The id carries the phase NUMBER from the heading, not the list
      // position — the reference test pins `id="phase-{n}"` per heading.
      n: a.text.match(/^Phase (\d+)/)[1],
      text: a.text,
      href: blobLine(ref, "docs/build-log.md", a.line),
    }));
}

function reviewIndex(ref) {
  return readdirSync(join(docsDir, "reviews"))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const src = readFileSync(join(docsDir, "reviews", f), "utf8");
      const stem = f.replace(/\.md$/, "");
      return {
        id: `review-${stem}`,
        date: required(f.match(/^(\d{4}-\d{2}-\d{2})-/)?.[1], `docs/reviews/${f}`, "YYYY-MM-DD- filename prefix"),
        title: required(src.match(/^# (.+)$/m)?.[1], `docs/reviews/${f}`, "# title"),
        href: blob(ref, `docs/reviews/${f}`),
      };
    });
}

/** The methodology page's own sections, by the ids its <h2>s carry. The one
 *  heading that carries a build-substituted count (`%%LAB_RUNS%%`) renders
 *  the slot as "N": this page publishes no figure (PRD Decision 5), the
 *  served value is not always one number ("7 (editorial) and 5 (pdp)" is a
 *  legal substitution), and the real value lives on the page the link opens.
 *  Whitelisted, not blanket: any OTHER marker in a heading is a new decision
 *  and refuses the render rather than printing "N" for a date. */
const HEADING_MARKERS = { "%%LAB_RUNS%%": "N" };

/**
 * Every <h2> on the methodology page with its id — the contract this index
 * and its guards read (the page's own header comment says so). Attribute
 * ORDER is free (`<h2 class="x" id="y">` indexes like `<h2 id="y">`), HTML
 * comments are stripped first (that header comment quotes <h2> markup), and
 * an <h2> WITHOUT an id refuses the render: the page claims to index the
 * methodology page's sections, and a section the renderer skipped would be a
 * silent omission every guard agreed with, because they read the same
 * markup (verify-slice, correctness + skeptic lenses). Exported so the
 * guards derive their expected list with this exact reading.
 */
export function methodologyHeadings(html) {
  const source = html.replace(/<!--[\s\S]*?-->/g, "");
  return [...source.matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/g)].map((m) => {
    const id = m[1].match(/\bid="([^"]+)"/)?.[1];
    if (!id) {
      throw new Error(
        `how-built: a methodology <h2> has no id ("${m[2].replace(/<[^>]+>/g, "").trim().slice(0, 60)}") — every section of /methodology/ is indexed by its id, so give it one`,
      );
    }
    return { id, inner: m[2] };
  });
}

function methodologySections() {
  const decode = (s) =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  return methodologyHeadings(readFileSync(methodologyPath, "utf8")).map(({ id, inner }) => ({
    id,
    text: decode(inner.replace(/<[^>]+>/g, ""))
      .replace(/%%[A-Z_]+%%/g, (marker) => {
        if (!Object.hasOwn(HEADING_MARKERS, marker)) {
          throw new Error(
            `how-built: methodology heading id="${id}" carries the marker ${marker}, which this index has no rendering for — decide what a figure-free page shows there (how-built.mjs HEADING_MARKERS)`,
          );
        }
        return HEADING_MARKERS[marker];
      })
      .replace(/\s+/g, " ")
      .trim(),
  }));
}

/** The one line on the page that is not an index entry, and the one
 *  exception to "no figures": a receipt. Three states, never blank. */
function buildLine(build) {
  if (build == null) {
    return `Deep links on this page point at the repository's main branch. This is the committed reference render; the served page pins its links to the commit it was built from.`;
  }
  if (build.dirty) {
    return `This page was built from a working tree with uncommitted changes, so its deep links point at the repository's main branch rather than at a commit that could vouch for them.`;
  }
  return (
    `Every deep link on this page is pinned to commit ` +
    `<a href="${REPO_URL}/commit/${esc(build.sha)}" rel="noopener">${esc(build.sha.slice(0, 7))}</a>, ` +
    `the build this page was served from, so what it cites cannot move underneath it.`
  );
}

/**
 * @param {object} [options]
 * @param {number} [options.extraDepth] directories below the master's usual
 *   depth (nested masters, .local board builds).
 * @param {string} [options.head] a pre-composed <head> inner replacing the
 *   canonical relative-link head (the front Worker's delivery). Body is
 *   identical either way.
 * @param {{sha: string, dirty: boolean} | null} [options.build] the build
 *   attestation; pins every deep link (see `refFor`). Omit for the master.
 */
export function renderHowBuilt({ extraDepth = 0, head, build = null } = {}) {
  const ref = refFor(build);
  const adrs = adrIndex(ref);
  const phases = phaseIndex(ref);
  const reviews = reviewIndex(ref);
  const sections = methodologySections();

  const toc = (items) => items.join("\n              ");
  const content = `      <div class="pm-doc">
        <nav class="pm-doc__toc" aria-label="Contents">
          <details open>
            <summary>Decision records</summary>
            <ul role="list">
              ${toc(adrs.map((a) => `<li><a href="#${esc(a.stem)}">${esc(a.title.split(" — ")[0])}</a></li>`))}
            </ul>
          </details>
          <details open>
            <summary>Build log</summary>
            <ul role="list">
              ${toc(phases.map((p) => `<li><a href="#phase-${esc(p.n)}">${esc(p.text)}</a></li>`))}
            </ul>
          </details>
          <details open>
            <summary>Reviews</summary>
            <ul role="list">
              ${toc(reviews.map((r) => `<li><a href="#${esc(r.id)}">${esc(r.title.split(" — ")[0])}</a></li>`))}
            </ul>
          </details>
          <details open>
            <summary>How the numbers are made</summary>
            <ul role="list">
              ${toc(sections.map((s) => `<li><a href="#methodology-${esc(s.id)}">${esc(s.text)}</a></li>`))}
            </ul>
          </details>
          <details open>
            <summary>Scope</summary>
            <ul role="list">
              <li><a href="#not-indexed">What this page does not index</a></li>
            </ul>
          </details>
        </nav>
        <div class="pm-doc__body">
          <header>
            <p class="pm-page__kicker">How it was built</p>
            <h1 class="pm-page__title">The decision record, in the open</h1>
            <p class="pm-doc__build">${buildLine(build)}</p>
          </header>
          <div class="pm-prose">
            <p>Every load-bearing decision behind this site — how measurement stays fair, why the data is frozen, how the rendering paradigms share one design system without sharing code — was written down when it was made, with the alternatives that lost. This page indexes that record: the architecture decision records and every correction later made to them, the build log's phases, the adversarial reviews, and the sections of the methodology page. Every list is generated from the file it names; nothing in the lists is retyped. The prose between the lists is written by hand.</p>
            <p>The short version of the method: decide one thing per session, record it as an architecture decision record, attack the decision with a review before building on it — the panels are the project's own, not external referees — and let every published number carry a receipt. Read the corrections before the titles: an accepted decision that was later amended is the record arguing with itself, and that is the evidence this page exists to show. The store you're browsing is the working end of that process.</p>
            <h2 id="decision-records">Decision records</h2>
            <p>Each record links its own file at the pinned commit; the corrections listed beneath a record link the addendum that made them.</p>
            <ul>
              ${adrs
                .map(
                  (a) =>
                    `<li id="${esc(a.stem)}"><a href="${esc(a.href)}" rel="noopener">${esc(a.title)}</a> — <time datetime="${esc(a.date)}">${esc(a.date)}</time>, ${esc(a.status)}` +
                    (a.addenda.length > 0
                      ? `\n                <ul>\n                  ${a.addenda
                          .map(
                            (x) =>
                              `<li id="${esc(x.id)}"><a href="${esc(x.href)}" rel="noopener">${esc(x.text)}</a></li>`,
                          )
                          .join("\n                  ")}\n                </ul>\n              `
                      : "") +
                    `</li>`,
                )
                .join("\n              ")}
            </ul>
            <h2 id="build-log">Build log</h2>
            <p>The narrative record, phase by phase — including the failures and the reviews that caught them. Each link opens the log's source at that phase's own heading line; the file is too long for GitHub to render as a page:</p>
            <ul>
              ${phases
                .map(
                  (p) =>
                    `<li id="phase-${esc(p.n)}"><a href="${esc(p.href)}" rel="noopener">${esc(p.text)}</a></li>`,
                )
                .join("\n              ")}
            </ul>
            <h2 id="reviews">Adversarial reviews</h2>
            <p>Whole-record reviews the project ran against itself, before the decisions they examine were built on:</p>
            <ul>
              ${reviews
                .map(
                  (r) =>
                    `<li id="${esc(r.id)}"><a href="${esc(r.href)}" rel="noopener">${esc(r.title)}</a> — <time datetime="${esc(r.date)}">${esc(r.date)}</time></li>`,
                )
                .join("\n              ")}
            </ul>
            <h2 id="methodology">How the numbers are made</h2>
            <p>The fairness rules behind every published figure live on <a href="/methodology/">their own page</a>, at a URL stable enough to cite in a hostile review. It stays there; this page indexes its sections:</p>
            <ul>
              ${sections
                .map(
                  (s) =>
                    `<li id="methodology-${esc(s.id)}"><a href="/methodology/#${esc(s.id)}">${esc(s.text)}</a></li>`,
                )
                .join("\n              ")}
            </ul>
            <h2 id="not-indexed">What this page does not index</h2>
            <p>The decision map that schedules the work, the session handoffs, the prototypes with their findings, and the product requirement documents are in <a href="${REPO_URL}" rel="noopener">the public repository</a> but are not listed here. This page claims the record it lists, not the whole repository.</p>
          </div>
        </div>
      </div>`;

  return page({
    title: "How it was built — Project Matrix",
    depth: 2 + extraDepth,
    css: ["components/prose.css", "surfaces/how-built.css"],
    current: null,
    content,
    head,
  });
}
