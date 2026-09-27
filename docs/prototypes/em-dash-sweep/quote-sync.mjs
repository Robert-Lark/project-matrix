// Quoted build-log headings inside other docs must equal the heading text exactly
// (decision-map-node-cap guard). Map each old heading form to its new form and
// rewrite the quotes the sweep transformed differently.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { githubAnchors } from "../../../packages/reference/render/how-built.mjs";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const oldLog = execFileSync("git", ["show", "HEAD:docs/build-log.md"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 });
const newLog = readFileSync(`${ROOT}/docs/build-log.md`, "utf8");
const forms = (t) => { const np = t.replace(/^Phase \d+(?:\.\d+)?(?: \u2014 |: )/, ""); const s = new Set(); for (const x of [t, np]) { s.add(x); s.add(x.replace(/\s\([^()]*\d{4}-\d{2}-\d{2}[^()]*\)$/, "")); } return [...s]; };
const oldA = githubAnchors(oldLog), newA = githubAnchors(newLog);
if (oldA.length !== newA.length) throw new Error("heading count");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rules = [];
oldA.forEach((a, i) => {
  if (!a.text.includes("\u2014")) return;
  const of = forms(a.text), nf = forms(newA[i].text);
  of.forEach((o, k) => {
    // what the prose sweep could have made of this quote: ", " / ": " / ". " with the next char in either case
    const parts = o.split(" \u2014 ");
    const body = parts.map((p, j) => {
      if (j === 0) return esc(p);
      const c = p[0], rest = esc(p.slice(1));
      const first = /[a-z]/i.test(c) ? `[${c.toLowerCase()}${c.toUpperCase()}]` : esc(c);
      return `(?:, |: |\\. | onward|,? ?)${first}${rest}`;
    }).join("");
    const rx = new RegExp('(["“])' + body + '(["”])', "g");
    rules.push([rx, `$1${nf[k]}$2`]);
  });
});
const files = execFileSync("git", ["ls-files", "-z", "*.md"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
let total = 0;
for (const f of files) {
  const src = readFileSync(`${ROOT}/${f}`, "utf8");
  let out = src;
  for (const [rx, to] of rules) out = out.replace(rx, (m) => { total++; return m.replace(rx, to); });
  if (out !== src) { writeFileSync(`${ROOT}/${f}`, out); console.log(`synced ${f}`); }
}
console.log(`quotes synced: ${total}`);
