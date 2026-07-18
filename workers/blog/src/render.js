// The one rendering pipeline (ADR-0009 §3). The admin live preview, the
// published page, the preview-link page, and the RSS body all call
// renderMarkdown — the preview cannot drift from the blog because they are
// the same function.
//
// Order matters: raw HTML is parsed then SANITIZED (defense-in-depth against
// a stolen-session author — ADR-0009 §5 abuse case), and Shiki highlighting
// runs AFTER sanitize, so its inline-styled spans are generated output, not
// author input.

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import themeLight from "@shikijs/themes/everforest-light";
import themeDark from "@shikijs/themes/everforest-dark";
import langJs from "@shikijs/langs/javascript";
import langTs from "@shikijs/langs/typescript";
import langJsx from "@shikijs/langs/jsx";
import langTsx from "@shikijs/langs/tsx";
import langPython from "@shikijs/langs/python";
import langGo from "@shikijs/langs/go";
import langRust from "@shikijs/langs/rust";
import langSql from "@shikijs/langs/sql";
import langShell from "@shikijs/langs/shellscript";
import langJson from "@shikijs/langs/json";
import langYaml from "@shikijs/langs/yaml";
import langHtml from "@shikijs/langs/html";
import langCss from "@shikijs/langs/css";
import langDiff from "@shikijs/langs/diff";
import langMarkdown from "@shikijs/langs/markdown";
import langToml from "@shikijs/langs/toml";

const THEMES = { light: "everforest-light", dark: "everforest-dark" };

let highlighterPromise;
function getHighlighter() {
  // A rejected init must not be cached, or one transient failure would
  // poison every render for the isolate's lifetime.
  highlighterPromise ??= createHighlighterCore({
    themes: [themeLight, themeDark],
    langs: [
      langJs, langTs, langJsx, langTsx, langPython, langGo, langRust,
      langSql, langShell, langJson, langYaml, langHtml, langCss, langDiff,
      langMarkdown, langToml,
    ],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  }).catch((err) => {
    highlighterPromise = undefined;
    throw err;
  });
  return highlighterPromise;
}

// Block directives become the blog's typographic range (`bp-` = blog plane):
// :::aside, :::pullquote, :::gallery{layout=…}, :::wide, :::bleed. Unknown
// directives degrade to a classed div/span so old posts never break when a
// directive is retired.
function directiveBlocks() {
  return (tree) => {
    visit(tree, (node) => {
      if (
        node.type !== "containerDirective" &&
        node.type !== "leafDirective" &&
        node.type !== "textDirective"
      ) {
        return;
      }
      const data = (node.data ??= {});
      const attributes = node.attributes ?? {};
      if (node.type === "textDirective") {
        data.hName = "span";
        data.hProperties = { className: [`bp-${node.name}`] };
        return;
      }
      switch (node.name) {
        case "aside":
          data.hName = "aside";
          data.hProperties = { className: ["bp-aside"] };
          break;
        case "pullquote":
          data.hName = "figure";
          data.hProperties = { className: ["bp-pullquote"] };
          break;
        case "gallery": {
          data.hName = "div";
          data.hProperties = {
            className: ["bp-gallery"],
            dataLayout: attributes.layout ?? "grid",
          };
          // Hoist images out of shared paragraphs so each becomes a grid
          // cell — adjacent image lines parse as ONE paragraph, which
          // otherwise collapses the grid to a single overflowing child.
          // Anything ELSE in that paragraph (caption words, links) survives
          // as its own trailing paragraph — never silently dropped.
          node.children = node.children.flatMap((child) => {
            if (child.type !== "paragraph") return [child];
            const images = child.children.filter((c) => c.type === "image");
            if (images.length < 2) return [child];
            const rest = child.children.filter(
              (c) => c.type !== "image" &&
                !(c.type === "text" && c.value.trim() === "") &&
                c.type !== "break",
            );
            return [
              ...images.map((image) => ({ type: "paragraph", children: [image] })),
              ...(rest.length ? [{ type: "paragraph", children: rest }] : []),
            ];
          });
          break;
        }
        case "wide":
        case "bleed":
          data.hName = "div";
          data.hProperties = { className: [`bp-${node.name}`] };
          break;
        default:
          data.hName = "div";
          data.hProperties = { className: [`bp-${node.name}`] };
      }
    });
  };
}

// GitHub's schema plus the blog's semantic vocabulary. className everywhere
// and data-* are safe here because script-src 'self' holds regardless
// (html.js) and the only author is the admin.
const schema = structuredClone(defaultSchema);
// data: images are CSP-permitted (img-src 'self' data:) and inert; the
// default protocol list strips them (observed: broken photo posts).
schema.protocols = {
  ...schema.protocols,
  src: [...(schema.protocols?.src ?? []), "data"],
};
schema.tagNames = [
  ...schema.tagNames,
  "aside", "figure", "figcaption", "mark", "kbd", "cite",
];
schema.attributes = {
  ...schema.attributes,
  "*": [...(schema.attributes["*"] ?? []), "className", "data*"],
  img: [
    ...(schema.attributes.img ?? []),
    "loading", "decoding", "width", "height",
  ],
};

// Sanitize's id-clobbering stays ON (author raw-HTML ids get the
// user-content- prefix — the DOM-clobbering defense §5 leans on), but
// remark-rehype's footnote ids arrive already prefixed, so sanitize doubles
// them while hrefs keep one layer — broken anchors (observed). Collapse the
// double prefix instead of disabling the protection.
function rehypeCollapseClobberPrefix() {
  return (tree) => {
    visit(tree, "element", (node) => {
      for (const prop of ["id", "name"]) {
        const value = node.properties?.[prop];
        if (typeof value === "string" && value.startsWith("user-content-user-content-")) {
          node.properties[prop] = value.slice("user-content-".length);
        }
      }
    });
  };
}

function codeText(node) {
  let text = "";
  visit(node, "text", (t) => {
    text += t.value;
  });
  return text;
}

// --- The AA clamp: highlighting may never break the contrast floor. -------
// Syntax themes ship pastel tokens that fail 4.5:1 (measured: everforest
// light's orange at 2.48). Instead of trusting any theme, every token color
// is nudged toward its scheme's pole (dark text darker, light text lighter)
// until it clears AA against the code background. Render-time only — the
// result is cached in body_html.

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function clampContrast(fgHex, bgHex, min = 4.5) {
  let fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  if (contrast(fg, bg) >= min) return fgHex;
  const towardWhite = luminance(bg) < 0.5;
  for (let i = 0; i < 24 && contrast(fg, bg) < min; i += 1) {
    fg = fg.map((c) => (towardWhite ? Math.min(255, c + (255 - c) * 0.12 + 2) : Math.max(0, c * 0.88 - 2)));
  }
  return rgbToHex(fg);
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}/;

function clampShikiTree(pre) {
  const preStyle = String(pre.properties?.style ?? "");
  const lightBg = /background-color:(#[0-9a-fA-F]+)/.exec(preStyle)?.[1];
  const darkBg = /--shiki-dark-bg:(#[0-9a-fA-F]+)/.exec(preStyle)?.[1];
  if (!lightBg || !darkBg) return;
  visit(pre, "element", (node) => {
    if (node.tagName !== "span" || !node.properties?.style) return;
    node.properties.style = String(node.properties.style)
      .split(";")
      .map((decl) => {
        const [prop, value] = decl.split(":").map((s) => s?.trim());
        if (!prop || !value || !HEX_RE.test(value)) return decl;
        if (prop === "color") return `color:${clampContrast(value, lightBg)}`;
        if (prop === "--shiki-dark") return `--shiki-dark:${clampContrast(value, darkBg)}`;
        return decl;
      })
      .join(";");
  });
}

function rehypeShiki(highlighter) {
  return (tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre" || !parent || index === undefined) return;
      const code = node.children?.[0];
      if (!code || code.tagName !== "code") return;
      const classes = (code.properties?.className ?? []).map(String);
      const lang = classes
        .find((c) => c.startsWith("language-"))
        ?.slice("language-".length);
      if (!lang || !highlighter.getLoadedLanguages().includes(lang)) return;
      const hast = highlighter.codeToHast(codeText(code), {
        lang,
        themes: THEMES,
        defaultColor: "light",
      });
      const rendered = hast.children[0];
      clampShikiTree(rendered);
      parent.children[index] = rendered;
    });
  };
}

// Uploaded images carry their true width/height (from the media table) so
// plain markdown yields zero-CLS pages; first image loads eager/high, the
// rest lazy. mediaLookup is injected (db.js) to keep this module pure.
function rehypeImages(options) {
  const lookup = options?.mediaLookup;
  return async (tree) => {
    const imgs = [];
    visit(tree, "element", (node) => {
      if (node.tagName === "img") imgs.push(node);
    });
    const keys = [
      ...new Set(
        imgs
          .map((node) => String(node.properties?.src ?? ""))
          .filter((src) => src.startsWith("/blog/media/"))
          .map((src) => src.slice("/blog/media/".length)),
      ),
    ];
    const rows = lookup && keys.length > 0 ? await lookup(keys) : new Map();
    imgs.forEach((node, i) => {
      const props = (node.properties ??= {});
      const src = String(props.src ?? "");
      if (src.startsWith("/blog/media/")) {
        const row = rows.get(src.slice("/blog/media/".length));
        if (row?.width && !props.width) {
          props.width = row.width;
          props.height = row.height;
        }
        if (row?.alt && !props.alt) props.alt = row.alt;
      }
      props.decoding = "async";
      if (i === 0) props.fetchpriority = "high";
      else props.loading = "lazy";
    });
  };
}

export async function renderMarkdown(md, { mediaLookup = null } = {}) {
  const highlighter = await getHighlighter();
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(directiveBlocks)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, schema)
    .use(rehypeCollapseClobberPrefix)
    .use(rehypeShiki, highlighter)
    .use(rehypeImages, { mediaLookup })
    .use(rehypeStringify)
    .process(md);
  return String(file);
}

// Plain-text opener for list pages and meta descriptions: first paragraph,
// tags stripped, entities DECODED (every consumer re-escapes with esc(), so
// this must return true plain text or ampersands render double-escaped).
const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text) {
  return text.replaceAll(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, body) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) return String.fromCodePoint(parseInt(body.slice(1), 10));
    return NAMED_ENTITIES[body] ?? whole;
  });
}

export function excerptText(html, max = 220) {
  const match = /<p>(.*?)<\/p>/s.exec(html);
  if (!match) return "";
  const text = decodeEntities(match[1].replaceAll(/<[^>]+>/g, "")).trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
