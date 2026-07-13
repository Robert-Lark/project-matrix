export const meta = {
  name: 'verify-slice',
  description: 'Limit-resilient adversarial verification of an implementation slice: finder lenses run SEQUENTIALLY and stream findings to disk, so a session-limit death loses at most the in-flight lens',
  whenToUse: 'Pre-commit verification of a slice (the repo standing rule: staged finders, refuted inline by the main session). Run it in the background and do inline empirical probing in the foreground while it works. On a session-limit death: completed lenses are durable (journal + findings files); resume after the reset with Workflow({name:"verify-slice", args:<same>, resumeFromRunId:"<runId>"}) — completed lenses replay from cache.',
  phases: [{ title: 'Find' }],
}

// WHY SEQUENTIAL (recorded after three session-limit deaths, build-log
// "Verification fan-outs vs the session limit"): parallel fan-outs fail
// correlated — near the limit wall, no agent has RETURNED yet, so the kill
// takes all of them and the journal holds nothing (round three lost all
// four lenses at once). Sequential execution makes every completed lens
// durable before the next starts, and each finder also appends confirmed
// findings to disk AS IT GOES, so even the in-flight lens leaves a
// recoverable trail. Wall-clock cost is irrelevant: this runs in the
// background while the main session probes inline.
//
// args (all required unless noted):
//   issue:      GitHub issue number of the slice (finders run `gh issue view` themselves)
//   scratchDir: absolute path finders stream findings-<lens>.md into
//               (pass the session scratchpad — never a repo path: a dirty
//               tree would show up in bench receipts' commit.dirty)
//   context:    slice-specific context — changed files, runtime notes,
//               accepted-knowns ("do NOT report these"), extra ADR pointers
//   lenses?:    optional [{key, prompt}] override of the default four

const RULES = `## Investigation and recommendations

**Brainstorm multiple solutions**
- Consider multiple options to solve the problem. Present them with their tradeoffs (architecture, performance, security, reversibility) — the user decides priority and effort.
- Evaluate each one through through codebase and or web research. Gather evidence to support the idea.

**Evidence requirements — every finding must include:**
- File path and line number — read from source, never from recall. After emitting a \`file:line\` citation, re-open that exact range and confirm the claimed code is on those lines. "Close" is not cited.
- Code snippet, reference, or concrete evidence
- Tool-verified counts and statistics (\`wc\`, \`grep -c\`, \`jq length\`, Glob) — never count mentally

**Before recommending a code change or bug fix:**
1. Validate the solution against research and community, best-practice implementations - not training knowledge
2. State the root cause with a specific code reference (file:line + snippet)
3. Trace the execution path end-to-end — read every file in the call chain
4. Explain the mechanism: how does this change fix the root cause?`

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'file', 'line', 'evidence', 'failureScenario', 'proposedFix'],
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'number' },
          evidence: { type: 'string', description: 'exact snippet read from source at the cited lines' },
          failureScenario: { type: 'string', description: 'concrete inputs/state -> wrong outcome' },
          proposedFix: { type: 'string' },
        },
      },
    },
  },
}

const DEFAULT_LENSES = [
  {
    key: 'correctness',
    prompt: 'LENS: implementation correctness. Hunt for FALSE-PASS and FALSE-FAIL bugs in the slice’s new code. Think adversarially about what the code silently gets wrong: boundary conditions, spec semantics of the platform APIs it leans on (verify against MDN/W3C/vendor docs where semantics matter — cite them), state leaking between iterations, and claims in comments/READMEs the code does not actually uphold. Trace each entry point end-to-end.',
  },
  {
    key: 'issue-adr-conformance',
    prompt: 'LENS: acceptance-criteria and ADR conformance. Walk EVERY acceptance criterion in the issue and verify the implementation satisfies it with cited evidence (which test/code, which lines). Then walk the ADR sections the issue cites and check each stated rule is honored. Report any criterion met only partially, met vacuously, or met by a mechanism that contradicts the ADRs (the ADR wins over issue text — flag, never silently resolve).',
  },
  {
    key: 'seams-integration',
    prompt: 'LENS: seams and integration. This repo’s defects historically live BETWEEN workspaces. Check: the origin-suite integration, the post-deploy smoke path (the same tests run against the deployed origin with PM_ORIGIN set and PM_EXPECT_BROTLI=1 — does everything hold there), CI wiring (.github/workflows/ci.yml), pnpm isolation (hoist:false — every import declared where used), turbo task config, eslint/typecheck coverage, repo-checks guards, and the contracts DOWNSTREAM slices consume from this one.',
  },
  {
    key: 'anti-rigging-skeptic',
    prompt: 'LENS: the skeptical staff engineer / anti-rigging audit (ADR-0001 §9 ethos). Could someone argue this slice’s guarantees pass vacuously, hide something, or can be gamed? Hunt vacuous assertions, unproven exclusions, numbers that could be estimated rather than measured, non-reproducible steps, and undocumented blind spots a variant author or benchmark skeptic will hit. Report concrete scenarios only.',
  },
]

// The harness has delivered named-workflow args as a JSON STRING (observed
// 2026-07-12, aesthetic-direction session — the guard below threw on a valid
// launch); parse defensively.
const A = typeof args === 'string' ? JSON.parse(args) : args

if (!A || !A.issue || !A.scratchDir || !A.context) {
  throw new Error('verify-slice needs args: { issue, scratchDir, context, repoDir?, lenses? }')
}

const lenses = A.lenses ?? DEFAULT_LENSES

// repoDir: pass the WORKTREE path when the slice lives in one — otherwise
// finders review the main checkout's unchanged tree and every lens is vacuous.
const repoDir = A.repoDir ?? '/Users/roblark/Work/project-matrix'

// Numeric issue → GitHub issue; anything else → a decision-map ticket name.
const issueLine = /^\d+$/.test(String(A.issue))
  ? `The slice under review implements GitHub issue #${A.issue} (run \`gh issue view ${A.issue}\` for the full text and acceptance criteria — the acceptance criteria are the definition of done).`
  : `The slice under review implements the "${A.issue}" ticket — its question, status, and definition of done live in docs/decision-map.md (there is NO GitHub issue; do not run gh issue view).`

const CONTEXT = `Repo: ${repoDir} (work in this directory; READ-ONLY apart from your findings file — do not edit repo files, run builds, or start dev servers; do NOT run pnpm run origin-suite; ports 8787-8790/9230-9233 may be in use).
${issueLine}
The ADRs in docs/adr/ are the rationale of record; on any conflict between issue/PRD text and an ADR, the ADR wins.

${A.context}

Report REAL defects with concrete failure scenarios, not style preferences. For each finding include: file:line, snippet, the failure scenario (inputs/state → wrong outcome), and a proposed fix direction.`

phase('Find')
const results = []
for (const lens of lenses) {
  log(`lens ${lens.key} starting (${results.length}/${lenses.length} lenses durable so far)`)
  const findingsFile = `${A.scratchDir}/findings-${lens.key}.md`
  const result = await agent(
    [
      lens.prompt,
      '',
      CONTEXT,
      '',
      RULES,
      '',
      `DURABILITY (do this — your process may be killed at any moment by a session limit): APPEND every finding to ${findingsFile} with the Write/Edit tools AS SOON as you confirm it — one markdown block per finding (title, file:line, evidence snippet, failure scenario, proposed fix). The file is the durable record; do not wait until the end. When you have swept everything, ALSO return all findings as structured output. If a suspected finding does not survive your own evidence check, drop it (and note the refutation in the file).`,
    ].join('\n'),
    { label: `find:${lens.key}`, phase: 'Find', schema: FINDINGS_SCHEMA },
  )
  results.push({ lens: lens.key, findings: result?.findings ?? [], findingsFile })
  log(`lens ${lens.key} done: ${result?.findings?.length ?? 0} findings (durable in journal + ${findingsFile})`)
}

log(`${results.reduce((n, r) => n + r.findings.length, 0)} raw findings across ${results.length}/${lenses.length} lenses — refute INLINE in the main session before adopting`)
return results
