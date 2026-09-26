import re, subprocess, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[3]
files = subprocess.run(["git","ls-files","-z","packages/reference/render","packages/switcher/src","variants","workers/blog/src","workers/front/home","workers/front/lab/fit.mjs"],cwd=ROOT,capture_output=True,text=True).stdout.split("\0")
files=[f for f in files if f and not f.endswith((".png",".jpg",".woff2",".ico")) and "/test/" not in f and "surfaces/" not in f]
# (pattern, replacement, is_regex)
T = [
 (r", Long Decay Records(?=[\"'`<])", " · Long Decay Records", True),
 (r"(\$\{[\w.]+\}), (\$\{[\w.]+\}) · Long Decay Records", r"\1 · \2 · Long Decay Records", True),
 ("Element demos, Accessibility, shown · Long Decay Records", "Element demos · Accessibility, shown · Long Decay Records", False),
 ("Mode demos, Accessibility, shown · Long Decay Records", "Mode demos · Accessibility, shown · Long Decay Records", False),
 ("How it was built, Project Matrix", "How it was built · Project Matrix", False),
 ("Project Matrix, one store, five architectures, one ruler", "Project Matrix: one store, five architectures, one ruler", False),
 ("Sample surface, Project Matrix placeholder", "Sample surface · Project Matrix placeholder", False),
 ("`${title}, ${MASTHEAD}`", "`${title} · ${MASTHEAD}`", False),
 ("`${post.title}, editing`", "`${post.title} · editing`", False),
 ("Live preview, rendered exactly as the blog renders", "Live preview: rendered exactly as the blog renders", False),
 ("Revoke every session on every device, the stolen-cookie response", "Revoke every session on every device: the stolen-cookie response", False),
 ("Element demos, focus, forms, target size, contrast, live regions", "Element demos: focus, forms, target size, contrast, live regions", False),
 ("Mode demos, forced colors, zoom &amp; reflow, reduced motion", "Mode demos: forced colors, zoom &amp; reflow, reduced motion", False),
 ("DS-on, the shipped default", "DS-on: the shipped default", False),
 ("DS-off. What ships without the system", "DS-off: what ships without the system", False),
 ("Demo card fields, type anything;", "Demo card fields: type anything;", False),
 ("Your cart is empty, items appear here", "Your cart is empty. Items appear here", False),
 ("The only interactive element on this page, that's the experiment.", "The only interactive element on this page. That's the experiment.", False),
 ("The only interactive element on this page, that&apos;s the experiment.", "The only interactive element on this page. That&apos;s the experiment.", False),
 ("is being served, the fixture never leaves CI.", "is being served. The fixture never leaves CI.", False),
 ("with the same shape and the same rules, numbers from trays,", "with the same shape and the same rules: numbers from trays,", False),
 ("Every number above links its receipt, profile, date, commit, location.", "Every number above links its receipt: profile, date, commit, location.", False),
 ("it carries its receipt, profile, date, commit, location, or it doesn't land at all.", "it carries its receipt (profile, date, commit, location) or it doesn't land at all.", False),
 ("is a fenced exhibit, no lab snapshot exists for it, by policy.", "is a fenced exhibit: no lab snapshot exists for it, by policy.", False),
 ("in every column, the same bytes, not a ranking.", "in every column: the same bytes, not a ranking.", False),
 ("These numbers are your visit, your device, your network, measured by", "These numbers are your visit (your device, your network), measured by", False),
 ("stays blank, the switcher and everything else here works without it.", "stays blank. The switcher and everything else here works without it.", False),
 ("whole measurement condition, share it and you share the experiment.", "whole measurement condition: share it and you share the experiment.", False),
 ("lab profile's axis, pick a profile in the reading above.", "lab profile's axis: pick a profile in the reading above.", False),
 ("An unregistered surface, the measurement contract still applies;", "An unregistered surface: the measurement contract still applies;", False),
 ('Instrument<span class="pm-chrome__sr">, lab readings and your visit</span>', 'Instrument<span class="pm-chrome__sr">: lab readings and your visit</span>', False),
 ("across those runs, where two bands overlap the difference is inside the noise.", "across those runs. Where two bands overlap, the difference is inside the noise.", False),
 ("An em-dash is a cell with no published run, or, where a row says so, a metric", "A dash is a cell with no published run or, where a row says so, a metric", False),
 ("The render baseline, how much machinery does prose need?", "The render baseline: how much machinery does prose need?", False),
 ("where the interactivity is genuine, gallery, zoom, quantity, cart.", "where the interactivity is genuine: gallery, zoom, quantity, cart.", False),
 ("where the data layer lives, nowhere, the browser, the server, or the edge, is the variable", "where the data layer lives (nowhere, the browser, the server, or the edge) is the variable", False),
 ('label: "Client cache, TanStack Query"', 'label: "Client cache: TanStack Query"', False),
 ('label: "Server-rendered, loaders + PE"', 'label: "Server-rendered: loaders + PE"', False),
 ('label: "Edge cache, KV"', 'label: "Edge cache: KV"', False),
 ('label: "Misapplication exhibit, Apollo on REST"', 'label: "Misapplication exhibit: Apollo on REST"', False),
 ("under main-thread load, INP, scripted and labeled.", "under main-thread load: INP, scripted and labeled.", False),
 ("Not a paradigm comparison. What the design system's accessibility defaults are worth.", "Not a paradigm comparison: what the design system's accessibility defaults are worth.", False),
 ("The decision record as content, ADRs, build log, reviews.", "The decision record as content: ADRs, build log, reviews.", False),
 ("Nothing ships, checkout is simulated.", "Nothing ships. Checkout is simulated.", False),
 ("Couldn't load that page, the list is unchanged.", "Couldn't load that page. The list is unchanged.", False),
 ("every field here still works, labels, hints, native validation", "every field here still works: labels, hints, native validation", False),
 ("Every load-bearing decision behind this site, how measurement stays fair, why the data is frozen, how the rendering paradigms share one design system without sharing code, was written down", "Every load-bearing decision behind this site (how measurement stays fair, why the data is frozen, how the rendering paradigms share one design system without sharing code) was written down", False),
 (r"price instead, the(\s)", r"price instead: the\1", True),
 ("data layer live, nowhere,", "data layer live (nowhere,", False),
 ("edge, and what does cache warmth", "edge), and what does cache warmth", False),
 ("ADRs, adversarial reviews, receipts, the build log is the source material.", "ADRs, adversarial reviews, receipts: the build log is the source material.", False),
 ("The frozen snapshot manifest, the live receipt behind this record", "The frozen snapshot manifest: the live receipt behind this record", False),
 ("Fit, not a leaderboard, a receipt behind every number.", "Fit, not a leaderboard: a receipt behind every number.", False),
 ("Remix 3, a frontier preview", "Remix 3: a frontier preview", False),
 ("The misapplication exhibit, a GraphQL client on a REST tray", "The misapplication exhibit: a GraphQL client on a REST tray", False),
 ("to this card's URL, progressive enhancement is the paradigm's default", "to this card's URL: progressive enhancement is the paradigm's default", False),
 ("a preview of a coming paradigm, pre-release software can change or break", "a preview of a coming paradigm. Pre-release software can change or break", False),
 (r"fixed at capture time, a link that changed", r"fixed at capture time: a link that changed", True),
 ("Edited elsewhere, copy anything unsaved, then reload.", "Edited elsewhere. Copy anything unsaved, then reload.", False),
 ("Nothing here yet, paste or drop an image into the editor to upload.", "Nothing here yet. Paste or drop an image into the editor to upload.", False),
 ("</span>, permanent once published (old slugs 301).", "</span>: permanent once published (old slugs 301).", False),
 ("Insert uses the library’s alt text, editing it here re-fixes every post that shows the image.", "Insert uses the library’s alt text. Editing it here re-fixes every post that shows the image.", False),
 ("Writing by Rob Lark, engineering, records, photography.", "Writing by Rob Lark: engineering, records, photography.", False),
 ("Draft preview, unpublished, unlisted.", "Draft preview: unpublished, unlisted.", False),
 ("Total unavailable, an item in this cart has no price", "Total unavailable: an item in this cart has no price", False),
 ("Order placed, a demonstration, so nothing ships", "Order placed (a demonstration), so nothing ships", False),
 ("not comparable on this surface, see the methodology page", "not comparable on this surface: see the methodology page", False),
 ('.cares li::before { content: "- ";', '.cares li::before { content: "– ";', False),
]
counts=[0]*len(T)
for f in files:
    p=ROOT/f
    try: s=p.read_text()
    except Exception: continue
    o=s
    for i,(a,b,rx) in enumerate(T):
        if rx: s,n=re.subn(a,b,s)
        else:
            n=s.count(a); s=s.replace(a,b)
        counts[i]+=n
    if s!=o: p.write_text(s)
for i,(a,b,rx) in enumerate(T):
    print(f"{counts[i]:3d}  {a[:70]}")
