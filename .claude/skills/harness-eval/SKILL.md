---
name: harness-eval
description: >
  Evaluate any codebase against OpenAI's 5 Harness Engineering principles
  (from their Codex team's experience building 1M+ lines of agent-written code).
  Use this skill whenever the user asks to evaluate code quality for AI-agent
  readability, check how "agent-friendly" a codebase is, audit a repo's
  documentation/architecture/enforcement practices, run a harness engineering
  assessment, or mentions any of the five principles by name: "what the agent
  can't see", "capability is missing", "mechanical enforcement", "give the
  agent eyes", or "map not a manual". Also trigger when the user says things
  like "how agent-ready is this code", "evaluate against harness principles",
  "is this repo set up for AI agents", or "check codebase health for agents".
---

# Harness Engineering Evaluator

Evaluate a codebase against OpenAI's five Harness Engineering principles — the
practices their Codex team developed while building a million-line production
system entirely with AI agents. These principles represent hard-won lessons
about what makes a codebase productive for both human and AI contributors.

## Background

OpenAI's Codex team found that agent productivity depends far more on the
**environment** (repo structure, docs, tooling, enforcement) than on prompt
engineering. They distilled this into five principles. This skill evaluates how
well a codebase embodies each one and provides actionable recommendations.

## The Five Principles

### 1. What the Agent Can't See Doesn't Exist

Knowledge that lives only in people's heads, Slack threads, or external wikis
is invisible to agents. Every important decision, convention, and piece of
context must be **in the repository** where agents (and new humans) can find it.

**What to look for:**
- Design docs, decision records, or plan files checked into the repo (e.g.,
  `PLANS.md`, `docs/decisions/`, `ADRs/`)
- A `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, or similar file that captures
  conventions and workflow instructions
- Inline comments explaining non-obvious "why" decisions (not just "what")
- Config files that are self-documenting (meaningful names, comments)
- Whether environment setup is fully documented or requires tribal knowledge

**Red flags:**
- Important context only exists in external tools (Notion, Confluence, Slack)
- "Ask Alice about this" comments
- Undocumented environment variables or setup steps
- Magic numbers or patterns with no explanation

### 2. Ask What Capability Is Missing, Not Why the Agent Is Failing

When an agent (or developer) struggles, the productive response is to ask "what
tool, context, or guardrail is missing from the environment?" rather than
"why is the agent bad at this?" This reframes failures as environmental
deficiencies to fix, not model limitations to work around.

**What to look for:**
- Preference for stable, well-documented "boring" technologies (standard
  libraries, widely-used frameworks) over exotic/novel ones
- Custom tooling that fills gaps (scripts, CLI tools, debug interfaces)
- Error messages that are actionable and context-rich
- APIs and interfaces that are predictable and well-typed
- Test infrastructure that gives clear, specific failure signals

**Red flags:**
- Heavy reliance on obscure or poorly-documented libraries
- Brittle workarounds instead of proper tooling
- Error messages like "something went wrong" with no context
- Complex implicit conventions that require deep familiarity to navigate

### 3. Mechanical Enforcement Over Documentation

Automated rules (linters, structural tests, CI checks) prevent inconsistency
far more reliably than written guidelines. If a rule matters, it should be
enforced mechanically — not just documented and hoped for.

**What to look for:**
- Linter configs (ESLint, Prettier, Biome, Clippy, etc.)
- Structural/architectural tests (dependency direction checks, import rules)
- Pre-commit hooks or CI pipelines that enforce standards
- Type checking (TypeScript strict mode, mypy, etc.)
- Automated formatting that removes style debates
- Build-time validation of conventions

**Red flags:**
- Important rules exist only in a style guide document
- Linter configs with many rules disabled
- No CI/CD pipeline or a pipeline that doesn't run tests
- TypeScript with `any` scattered throughout
- Architectural boundaries that exist only in documentation

### 4. Give the Agent Eyes

Agents (and developers) need ways to **see** the effect of their work — visual
output, logs, metrics, test results. Without feedback loops, they're coding
blind.

**What to look for:**
- Screenshot/visual testing capabilities
- Observability integration (logging, metrics, tracing)
- Debug interfaces or developer tools exposed at runtime
- Test suites that provide clear pass/fail signals
- Hot-reload or fast feedback development setups
- Error reporting that captures context (stack traces, state snapshots)

**Red flags:**
- No way to visually verify UI changes
- `console.log` as the only debugging strategy
- Tests that pass/fail silently without explanation
- No observability or monitoring setup
- Long feedback cycles (minutes+ to see a change)

### 5. A Map, Not a Manual

Provide a concise architectural overview that highlights **what rarely changes**
(boundaries, layers, conventions) rather than exhaustive documentation of every
file. A brief map orients quickly; a massive manual overwhelms.

**What to look for:**
- A concise `ARCHITECTURE.md` or equivalent (ideally under 500 lines)
- Clear module/layer boundaries expressed in directory structure
- Documentation that states what **doesn't** exist in certain areas (negative
  space constraints)
- Entry points and flow descriptions that help navigate the codebase
- README that orients rather than exhaustively documents

**Red flags:**
- No architectural overview at all
- A single massive documentation file that tries to cover everything
- Directory structure that doesn't reflect logical boundaries
- No clear entry point for understanding the system
- Documentation that describes every file but not how they relate

## Evaluation Process

For each principle, do the following:

1. **Investigate** — Use Glob, Grep, and Read to examine the relevant aspects
   of the codebase. Don't just check for file existence; read key files and
   assess their quality and completeness.

2. **Score** — Rate the codebase on a scale:
   - **Strong** — The principle is well-embodied with clear, intentional practices
   - **Moderate** — Some practices exist but with notable gaps
   - **Weak** — Little evidence of this principle in practice
   - **Absent** — No meaningful presence of this principle

3. **Evidence** — Cite specific files, patterns, or absence thereof that
   support your rating.

4. **Recommendations** — Provide 1-3 concrete, actionable steps to improve.
   Prioritize high-impact, low-effort changes. Be specific (name files to
   create, tools to add, patterns to adopt).

## Output Format

Structure the evaluation as:

```
# Harness Engineering Evaluation: [Project Name]

## Summary
[2-3 sentence overall assessment]

| Principle | Score | Key Finding |
|-----------|-------|-------------|
| 1. What the Agent Can't See... | Strong/Moderate/Weak/Absent | one-line summary |
| 2. Ask What Capability Is Missing... | ... | ... |
| 3. Mechanical Enforcement... | ... | ... |
| 4. Give the Agent Eyes... | ... | ... |
| 5. A Map, Not a Manual... | ... | ... |

## Detailed Findings

### 1. What the Agent Can't See Doesn't Exist
**Score: [rating]**
[Evidence and analysis]
**Recommendations:**
- ...

### 2. Ask What Capability Is Missing
**Score: [rating]**
[Evidence and analysis]
**Recommendations:**
- ...

[...repeat for all 5...]

## Top 3 Priority Actions
1. [Highest-impact recommendation across all principles]
2. [Second highest]
3. [Third highest]
```

## Important Notes

- Evaluate what **actually exists** in the repo, not what the user tells you
  about their practices. The whole point of Principle 1 is that if it's not in
  the repo, it doesn't count.
- Be honest but constructive. Most codebases won't score "Strong" on all five
  principles — that's fine. The goal is to identify the highest-leverage
  improvements.
- Adapt your investigation to the project's tech stack. A Python project and a
  TypeScript project will have different linters, type systems, and testing
  approaches — evaluate each in context.
- When scanning, focus on quality over quantity. A single well-written
  ARCHITECTURE.md is worth more than ten scattered README files that say nothing
  useful.
