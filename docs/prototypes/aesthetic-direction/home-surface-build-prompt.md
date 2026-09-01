<!--
  Friday build prompt for the home/gateway surface (home-surface ticket).
  Drafted 2026-07-13. Paste everything inside the fenced block into a fresh
  Fable session opened in this repo. Fill the ABOUT ME block first.

  Setup notes (for Rob, not part of the prompt):
  - Run it in a worktree (say "work in a worktree").
  - It assumes the Catalogue aesthetic is already merged to main (it is).
  - It will NOT self-merge; merging deploys, that stays your call.
-->

```
Build the home page for Project Matrix — the front door to my portfolio.

This is a demonstration of what you can do with full creative range on
COMPOSITION and CRAFT. But read it before you reach for a blank canvas: you are
not designing a site from scratch. You are building the entrance to a system
that already has a strong, documented point of view, and your job is to
dramatize that point of view better than I could — not to replace it.

── READ FIRST (this page is exhaustively specified; use it) ──
Before anything, read: docs/decision-map.md (the `home-surface` and
`thesis-and-curation` tickets, and the Notes/matrix at the top), CONTEXT.md
(the vocabulary — get the words right), docs/adr/0003 (the design system),
0004 (why home is a static singleton off the benchmarked spine), and 0006 (the
"Catalogue" aesthetic that just shipped). Skim docs/build-log.md Phase 6. Then
look at packages/tokens/ (the real design tokens) and open
packages/reference/index.html to see the design language rendered. The goal of
this page is well-documented — your work is the imagination for how a visitor
FEELS it and acts on it, not re-deriving what it is.

── ABOUT ME (authoritative — I filled this; treat it as fact) ──
  Name: Rob Lark
  Role: staff-level frontend engineer (currently at Discogs)
  What I care about: architectural judgment over framework fashion; proving
    claims with real numbers; accessibility as a default, not a bolt-on.
  Links: GitHub github.com/Robert-Lark  ·  [write-up/blog URL: TODO]
  [Correct or expand any of the above before running. If a field is TODO,
   design a graceful slot for it rather than inventing facts about me.]

── THE PAGE'S JOB (the master constraint — everything serves this) ──
Audience: skeptical staff engineers and hiring managers arriving cold from a
job application or a blog link. They are allergic to marketing-speak and hype.
In about 90 seconds this page must do three things, in this order of
importance:
  1. Make them understand the site's ARGUMENT: one real commercial product — a
     Discogs-powered vinyl store — built across several rendering paradigms and
     instrumented so you can see, in real numbers, what each choice costs in
     performance, UX, and infra spend. The point is FIT, NOT A LEADERBOARD:
     the same architecture wins on one page and loses on another.
  2. Establish that I have the judgment to build it (credibility, quietly).
  3. Be the GATEWAY: send them into the tool — one entry per surface
     (Editorial, Product page, Catalog + search, Checkout, Accessibility, How
     it was built), each with a one-line statement of the tradeoff that
     surface proves.
Voice: pure evidence. No "in the age of AI" manifesto, no hype adjectives, no
"revolutionary." The demos convince; the copy just gets out of the way and
points. Assume the reader is smarter than you and short on time.

── YOUR CREATIVE MANDATE (spend it here) ──
You have full latitude over composition, layout, hierarchy, typographic
drama, pacing, scroll choreography, and — most of all — the ONE signature
moment this page is remembered by. This is a free-composition surface (a
static singleton, not one of the benchmarked store variants), so you may be
more ambitious here than the disciplined store components allow. Take one real
aesthetic risk and make it land. Work autonomously; don't ask me what I want;
don't check in at intermediate steps; when you have enough to act, act, and
don't narrate options you won't pursue.

── WHAT'S ALREADY DECIDED — BUILD ON IT, DON'T REINVENT IT ──
Unlike a from-scratch site, the visual language is chosen and shipped: the
"Catalogue" aesthetic (ADR-0006) — warm-paper palette, Familjen Grotesk,
slate-water accent, airy spacing, the tokens in packages/tokens/css. BUILD
FROM THOSE TOKENS. Extend them expressively for this page, but do not invent a
new palette or typeface — coherence with the store is the entire point; a
visitor should feel they entered one designed thing. If you genuinely need a
new primitive, add it to the token tier and say why.

── THE HARDEST PART IS THE WORDS ──
The single hardest problem on this page is not visual — it's saying "one
product, several architectures, real numbers; which fits when, not which wins"
in two or three plain sentences to someone who distrusts marketing copy. Nail
the message before the pixels. Draft it, attack it, cut every word that sounds
like a landing page, and rewrite until a tired senior engineer would nod
instead of roll their eyes. The layout exists to deliver those sentences.

── MOTION & INTERACTION (ambitious, but it must PROVE the thesis, not betray it) ──
This is a site whose whole argument is performance and restraint, and it puts
its own web-vitals on display. So the first impression a perf-skeptic gets must
never be a heavy, janky hero — that would refute the thesis on sight. Use
motion and interactivity deliberately and make them earn their bytes: a
considered load sequence, scroll-triggered reveals, hover micro-interactions,
maybe one interactive moment that itself embodies the argument (e.g. the same
fragment rendered two ways, side by side; a live web-vitals flourish; the
deadwax "matrix number" — the code etched in a record's runout groove that the
project is named for — as a motif). Prefer modern CSS (view transitions,
scroll-driven animations, :has, container queries) over heavy JS libraries;
keep it fast and light and measure it. Respect prefers-reduced-motion and
visible keyboard focus without exception. More restraint, executed
flawlessly, beats more effects.

── ASSETS (real, not generated) ──
No stock photos and no AI-generated hero imagery — that's the wrong register
for an evidence site, and it isn't how this project earns trust. Your materials
are: the Catalogue design language, real measurement data / receipts from the
project, and typographic + CSS-driven visuals rooted in the subject's world
(record-store print culture, hi-fi faceplates, spec sheets, the deadwax etch).
You MAY use a few real record-sleeve covers from the crate as texture, but note
they carry an open Discogs-ToS/attribution question (see the domain-cutover
ticket) — so lean on type, palette, and motion, and treat cover art as a spice,
not the main course.

── HOW TO WORK ──
Work in a git worktree. It's a real repo with conventions — follow them: this
is a Grilling-type ticket, so interrogate the content/structure/copy hard
before building; record your decisions (an ADR entry, the decision-map answer,
a build-log note) as you go, because the build process is itself content for
the "How it was built" surface. The home page ships as a static singleton on
the Cloudflare canonical plane (ADR-0004), replacing the throwaway index the
front Worker currently serves at `/`. Verify with the project's real tooling
(lint/typecheck/test, the measurement harness) plus your own eyes.

── REVIEW LIKE YOU MEAN IT ──
Once a first version exists, load it in a browser and actually look — don't
assume the code is right. Review critically at least three separate passes,
each against all three of: (a) the 90-second goal above, (b) the eight design
principles (contrast, hierarchy, alignment, proximity, repetition, balance,
white space, unity), and (c) the fit-not-leaderboard thesis and evidence voice.
Fix inconsistency, timing, layout collisions, jank, anything generic, anything
that reads as marketing, and anything you'd be embarrassed to ship. Check it
responsive down to mobile, at 400% zoom, with reduced-motion on, and by
keyboard. It must be genuinely fast — this is a perf-thesis site, so measure it,
don't hope.

── DELIVERABLE ──
When it's built, iterated, and verified live, present it for my review with the
URL and a short account of the message you landed on and the one risk you took.
Do NOT merge to main — merging deploys, and that stays my call.
```
