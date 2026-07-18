// Public blog templates — server-rendered strings, semantic HTML, zero
// framework bytes (ADR-0009 §7). The register is "Sleeve & Shelf" (build-log
// Phase 9): every post carries a spine — the record-sleeve edge, colored by
// the per-post accent knob — a mono catalog line as its metadata register,
// and the contents page is the shelf: year numerals down the page.

import { esc } from "../html.js";
import { excerptText } from "../render.js";

const MASTHEAD = "Rob Lark";

export function layout({
  title,
  description = "",
  origin,
  path,
  body,
  noindex = false,
  ogImage = null,
}) {
  const fullTitle = title ? `${title} — ${MASTHEAD}` : MASTHEAD;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(fullTitle)}</title>
  ${description ? `<meta name="description" content="${esc(description)}">` : ""}
  ${noindex ? `<meta name="robots" content="noindex">` : ""}
  <link rel="canonical" href="${esc(origin + path)}">
  <link rel="alternate" type="application/rss+xml" title="${esc(MASTHEAD)}" href="${esc(origin)}/blog/feed.xml">
  <meta property="og:site_name" content="${esc(MASTHEAD)}">
  <meta property="og:type" content="${path === "/blog/" ? "website" : "article"}">
  <meta property="og:title" content="${esc(title || MASTHEAD)}">
  ${description ? `<meta property="og:description" content="${esc(description)}">` : ""}
  <meta property="og:url" content="${esc(origin + path)}">
  ${ogImage ? `<meta property="og:image" content="${esc(origin + ogImage)}">` : ""}
  <link rel="preload" href="/blog/static/fonts/literata-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/blog/static/fonts/fraunces-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/blog/static/blog.css">
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="site-head">
    <a class="masthead" href="/blog/">${esc(MASTHEAD)}</a>
    <nav class="site-nav" aria-label="Site">
      <a href="/blog/feed.xml">RSS</a>
    </nav>
  </header>
  <main id="main">
${body}
  </main>
  <footer class="site-foot">
    <p>Written and kept by Rob Lark · <a href="/blog/feed.xml">RSS</a> · <a href="/">the record-store benchmark</a></p>
  </footer>
</body>
</html>
`;
}

function dateHuman(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function dateShort(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function displayDate(post) {
  return post.original_date || post.published_at || post.updated_at;
}

function entryTitle(post) {
  return post.title || excerptText(post.body_html, 90) || post.slug;
}

const KIND_LABEL = { essay: "Essay", photo: "Photographs", note: "Note", link: "Link" };

function accentStyle(post) {
  return post.accent ? ` style="--accent:${esc(post.accent)}"` : "";
}

export function contentsPage(posts, { origin, heading = null, path = "/blog/", browse = null }) {
  const byYear = new Map();
  for (const post of posts) {
    const year = String(displayDate(post)).slice(0, 4);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(post);
  }

  const shelf = [...byYear.entries()]
    .map(
      ([year, group]) => `  <section class="shelf-year">
    <h2 class="year-mark" aria-label="Posts from ${year}">${year}</h2>
    <ol class="contents">
${group
  .map((post) => {
    const when = displayDate(post);
    const external = post.kind === "link" && post.link_url;
    return `      <li class="entry entry--${esc(post.kind)}"${accentStyle(post)}>
        <a href="/blog/${esc(post.slug)}">
          <span class="entry-title">${esc(entryTitle(post))}</span>${external ? '<span class="entry-mark" aria-hidden="true"> ↗</span>' : ""}
          ${post.title && post.dek ? `<span class="entry-dek">${esc(post.dek)}</span>` : ""}
        </a>
        <time datetime="${esc(when)}">${esc(dateShort(when))}</time>
      </li>`;
  })
  .join("\n")}
    </ol>
  </section>`,
    )
    .join("\n");

  const browseBlock =
    browse && (browse.tags.length || browse.series.length)
      ? `  <nav class="browse" aria-label="Browse">
${browse.series.length ? `    <p class="browse-row"><span class="browse-label">Series</span>${browse.series.map((s) => `<a href="/blog/series/${esc(encodeURIComponent(s.name))}">${esc(s.name)}<span class="browse-count"> ${s.n}</span></a>`).join("")}</p>` : ""}
${browse.tags.length ? `    <p class="browse-row"><span class="browse-label">Tags</span>${browse.tags.map((t) => `<a href="/blog/tag/${esc(encodeURIComponent(t.name))}">${esc(t.name)}<span class="browse-count"> ${t.n}</span></a>`).join("")}</p>` : ""}
  </nav>`
      : "";

  const body = `  <h1${heading ? ' class="page-heading"' : ' class="visually-hidden"'}>${esc(heading ?? "Writing")}</h1>
${heading ? `  <p class="page-back"><a href="/blog/">← All writing</a></p>` : ""}
${shelf || '  <p class="empty">Nothing here yet.</p>'}
${browseBlock}`;

  return layout({
    title: heading,
    description: "Writing by Rob Lark — engineering, records, photography.",
    origin,
    path,
    body,
  });
}

export function postArticle(post, { neighbors = { prev: null, next: null }, cover = null } = {}) {
  const tags = JSON.parse(post.tags || "[]");
  const when = displayDate(post);
  const eyebrow = `<p class="post-eyebrow"><span class="post-kind">${esc(KIND_LABEL[post.kind] ?? post.kind)}</span><time datetime="${esc(when)}">${esc(dateHuman(when))}</time>${post.series ? `<a class="eyebrow-series" href="/blog/series/${esc(encodeURIComponent(post.series))}">${esc(post.series)}${post.series_part ? ` · ${esc(String(post.series_part))}` : ""}</a>` : ""}</p>`;

  const hero =
    post.header_style === "photo-hero" && cover
      ? `  <figure class="post-hero">
    <img src="/blog/media/${esc(cover.key)}" alt="${esc(cover.alt)}"${cover.width ? ` width="${cover.width}" height="${cover.height}"` : ""} fetchpriority="high" decoding="async">
  </figure>`
      : "";

  const header = post.title
    ? `  <header class="post-head post-head--${esc(post.header_style)}">
    ${eyebrow}
    <h1>${esc(post.title)}</h1>
    ${post.dek ? `<p class="dek">${esc(post.dek)}</p>` : ""}
  </header>`
    : `  <header class="post-head post-head--bare">
    ${eyebrow}
  </header>`;

  const linkLine =
    post.kind === "link" && post.link_url
      ? `  <p class="link-line"><a href="${esc(post.link_url)}" rel="noopener">${esc(post.link_url.replace(/^https?:\/\//, ""))} ↗</a></p>`
      : "";

  const series = post.series
    ? `  <nav class="series-nav" aria-label="Series">
    ${neighbors.prev ? `<a rel="prev" href="/blog/${esc(neighbors.prev.slug)}"><span>← Previous</span> ${esc(neighbors.prev.title || neighbors.prev.slug)}</a>` : "<span></span>"}
    ${neighbors.next ? `<a rel="next" href="/blog/${esc(neighbors.next.slug)}"><span>Next →</span> ${esc(neighbors.next.title || neighbors.next.slug)}</a>` : ""}
  </nav>`
    : "";

  const tagList = tags.length
    ? `  <footer class="post-foot">
    <ul class="tag-list" aria-label="Tags">
${tags.map((t) => `      <li><a href="/blog/tag/${esc(encodeURIComponent(t))}">${esc(t)}</a></li>`).join("\n")}
    </ul>
  </footer>`
    : "";

  return `<article class="post post--${esc(post.kind)} mood--${esc(post.mood)}"${accentStyle(post)}>
${hero}
${header}
${linkLine}
  <div class="post-body">
${post.body_html}
  </div>
${series}
${tagList}
</article>`;
}

export function postPage(post, { origin, neighbors, cover = null }) {
  return layout({
    title: post.title || excerptText(post.body_html, 60),
    description: post.dek || excerptText(post.body_html),
    origin,
    path: `/blog/${post.slug}`,
    ogImage: cover ? `/blog/media/${cover.key}` : null,
    body: postArticle(post, { neighbors, cover }),
  });
}

export function previewPage(post, { origin, cover = null }) {
  return layout({
    title: post.title || "Draft preview",
    description: "",
    origin,
    path: `/blog/preview/${post.preview_token}`,
    noindex: true,
    body: `<p class="preview-banner">Draft preview — unpublished, unlisted.</p>\n${postArticle(post, { cover })}`,
  });
}

function rfc822(iso) {
  return new Date(iso).toUTCString();
}

function absolutize(html, origin) {
  return html
    .replaceAll('src="/blog/', `src="${origin}/blog/`)
    .replaceAll('href="/blog/', `href="${origin}/blog/`);
}

function cdata(text) {
  return `<![CDATA[${text.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

export function feedXml(posts, origin) {
  const items = posts
    .map((post) => {
      const url = `${origin}/blog/${post.slug}`;
      return `    <item>
      <title>${esc(entryTitle(post))}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${rfc822(post.published_at)}</pubDate>
      <description>${cdata(absolutize(post.body_html, origin))}</description>
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(MASTHEAD)}</title>
    <link>${esc(origin)}/blog/</link>
    <atom:link href="${esc(origin)}/blog/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Writing by Rob Lark — engineering, records, photography.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
}
