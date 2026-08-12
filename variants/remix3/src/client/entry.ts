// The client runtime bootstrap, verbatim from the official template (the
// spike's app/client/entry.ts is the prior art): run() starts the Navigation
// API listener that intercepts plain anchors carrying rmx-target/rmx-src and
// resolves frame (re)loads over the wire as HTML. This exhibit ships no
// clientEntry island, so loadModule is the template's stub shape and is
// never called on this page; the frames demo is what run() drives.
import { run } from "remix/ui";

run({
  async loadModule(moduleUrl, exportName) {
    const mod = await import(moduleUrl);
    return mod[exportName];
  },
  async resolveFrame(src, signal) {
    const response = await fetch(src, { headers: { Accept: "text/html" }, signal });
    if (!response.ok) {
      return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`;
    }

    if (response.body) return response.body;
    return await response.text();
  },
});
