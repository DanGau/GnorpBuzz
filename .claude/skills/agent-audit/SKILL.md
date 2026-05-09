---
name: agent-audit
description: >
  Audit and fix a codebase for agent-first engineering principles — covering both
  OpenAI's Harness Engineering (5 principles) and Anthropic's agent architecture
  research. Has two modes: "fix" (default) actively improves the codebase, "inform"
  reports findings without changes. Use this skill whenever the user asks to audit
  code for agent-friendliness, improve their repo for AI agents, check agent-readiness,
  make their codebase more agent-friendly, or mentions "agent audit", "agent-first audit",
  "harness audit", "fix for agents", or "make this agent-ready". Also trigger when the
  user says things like "how can I improve this repo for Claude", "audit the codebase",
  "what's missing for agents", or "optimize for AI coding".
---

# Agent-First Codebase Audit

Audit a codebase against agent-first engineering principles synthesized from OpenAI's
Harness Engineering and Anthropic's agent architecture research, then optionally fix
the gaps found. The reference material lives in `docs/agent-first/` — read the relevant
doc when you need deeper context on a principle.

## Modes

**fix** (default): Audit the codebase, report findings, then make changes to address
the gaps. Create missing files, improve existing docs, add enforcement tooling, and
enhance verification infrastructure. Commit nothing — leave changes unstaged for the
user to review.

**inform**: Audit the codebase and report findings only. No file changes.

Parse the mode from the user's prompt. If they say "inform", "just report", "don't change
anything", or "read-only", use inform mode. Otherwise default to fix.

## Audit Dimensions

The audit covers 7 dimensions. Each maps to one or more principles from the source
material. For deeper background on any dimension, read the corresponding doc in
`docs/agent-first/`.

### 1. Visibility — "What the agent can't see doesn't exist"

Are architectural decisions, conventions, and context discoverable in the repo? Or do
they live in Slack, wikis, people's heads?

**Check for:**
- CLAUDE.md / AGENTS.md at the project root with build commands, conventions, gotchas
- Design docs, ADRs, or plan files checked into the repo
- Documented environment setup (no tribal knowledge required)
- Self-documenting config files with meaningful names and comments
- Inline "why" comments on non-obvious decisions

**Red flags:** "ask Alice about this" comments, undocumented env vars, magic numbers
with no explanation, important context only in external tools.

**Fix actions:**
- Create missing CLAUDE.md files (root and key subdirectories)
- Add build/test/dev commands to CLAUDE.md if absent
- Document undocumented env vars referenced in code
- Add a `docs/` index if architecture docs exist but lack an entry point

### 2. Discoverability — Code as searchable documentation

Can agents find what they need through search? File names, function names, and
directory structure all affect agent navigation.

**Check for:**
- Complete words in identifiers (no cryptic abbreviations)
- Unique filenames (no duplicates that force agents to read multiple files)
- Domain-reflective naming (`OrderProcessor` not `Svc2Handler`)
- Cross-references between related modules
- Directory structure that reflects logical boundaries

**Red flags:** files named `utils.ts`, `helpers.ts`, `misc.ts`; abbreviations like
`mgr`, `svc`, `impl`; duplicate filenames across directories.

**Fix actions:**
- Flag files with non-descriptive names (suggest renames, don't rename — too risky)
- Add CLAUDE.md index files in directories that lack orientation
- Add cross-reference comments where modules have non-obvious relationships

### 3. Mechanical Enforcement — "Enforce invariants, not implementations"

Are important rules enforced by tooling, or just documented and hoped for? Critically,
not all enforcement is equal — some lint rules exist primarily for human reading comfort
and add friction for agents without meaningful benefit. The audit should distinguish
between **agent-valuable** enforcement and **human-comfort** enforcement.

**Agent-valuable enforcement** catches real bugs and structural violations:
- Type checking (TypeScript strict mode, mypy) — prevents runtime errors
- Architectural tests (dependency direction, import boundary violations)
- Build-time validation of conventions that affect correctness
- Pre-commit hooks that run tests or type checks
- CI/CD pipeline that runs tests and lints on every push
- Custom linters with actionable error messages that teach the agent how to fix issues

**Human-comfort enforcement** helps humans scan code but adds noise for agents:
- Import sorting rules (alphabetical ordering, grouping) — agents don't scan imports visually
- Trailing comma style preferences — purely aesthetic
- Brace style / formatting debates (agents emit whatever style you tell them)
- Max line length rules on non-extreme values — agents don't get tired reading long lines
- Blank line counting rules (e.g., "exactly 1 blank line between functions")
- JSDoc/docstring requirement rules on internal code — agents read the code, not the docs
- `no-console` rules that block debugging without replacement tooling
- Naming convention rules that enforce arbitrary style (camelCase vs snake_case) without
  type safety — agents adapt to whatever convention the codebase uses

This isn't to say human-comfort rules are worthless — but in an agent-first audit, they
should be flagged as friction if they cause frequent agent failures or pre-commit rejections
without catching real problems. A linter that rejects valid code because of import ordering
is wasting an agent iteration cycle on something that doesn't matter for correctness.

**Check for:**
- Linter configuration (ESLint, Biome, Prettier, Clippy, etc.) that's actually active
- TypeScript strict mode or equivalent type strictness
- Pre-commit hooks (husky, lint-staged, lefthook)
- CI/CD pipeline that runs tests and lints on every push
- Architectural tests (dependency direction, import boundaries)
- Build-time validation of conventions
- Ratio of correctness-enforcing rules vs. style-enforcing rules

**Red flags:**
- `any` scattered through TypeScript (weak type enforcement where it matters)
- No CI pipeline, or a pipeline that doesn't run tests
- Architectural boundaries documented but not enforced
- `--no-verify` in commit scripts (bypassing enforcement entirely)
- Heavy lint configs where most rules are stylistic and agents frequently fail pre-commit
  on formatting issues rather than real problems
- Lint rules with default error messages that give agents no guidance on how to fix

**Fix actions:**
- Enable stricter TypeScript options if `tsconfig.json` exists but is loose
- Add pre-commit hooks if a package manager exists but no hooks are configured
- Suggest custom lint rules for undocumented conventions found in CLAUDE.md
- Report un-enforced rules from CLAUDE.md that could become lint rules
- Flag human-comfort rules that cause frequent agent friction — recommend moving them
  to editor-only configs or autofix-only mode so they're applied automatically without
  blocking the agent. Formatting rules should autofix silently, not reject commits.
- Improve lint error messages: if a custom rule exists but has a generic message, suggest
  rewriting it with remediation steps that will land in the agent's context

### 4. Verification — EARS: "Give the agent eyes, ears, and inspection"

Can agents verify their own work? Visual output, audio state, application state —
each catches different bug classes.

**Eyes (visual):**
- Playwright, Puppeteer, or Cypress for browser automation
- Screenshot capabilities in the test harness
- Visual regression testing

**Ears (audio):**
- Audio analysis tooling (loudness, balance, playback logging)
- Runtime sound logging and statistics
- Only applicable to projects with audio

**InSpect (state):**
- Debug interfaces for state inspection and manipulation
- State dump/snapshot capabilities
- Integration tests that verify internal state, not just output
- Balance/simulation testing tools

**Check for:** at least Eyes + InSpect. Ears only matters for audio-heavy projects.

**Red flags:** no way to visually verify UI changes, `console.log` as only debugging,
tests that pass/fail silently, no observability.

**Fix actions:**
- Add a basic Playwright test scaffold if the project has a UI but no browser tests
- Add a debug interface pattern if the project has complex runtime state
- Document existing verification tools in CLAUDE.md if they exist but aren't mentioned
- Reference `docs/agent-first/verification-and-feedback.md` for the EARS framework

### 5. Documentation Architecture — "A map, not a manual"

Is documentation structured for progressive disclosure? Or is it a monolithic wall of
text (or absent entirely)?

**Check for:**
- Root CLAUDE.md under 300 lines, functioning as a table of contents
- Hierarchical CLAUDE.md files in subdirectories for domain-specific rules
- `docs/` directory with structured architecture documentation
- Documentation that states what *doesn't* exist (negative space constraints)
- Entry points that orient rather than exhaustively describe

**Red flags:** single massive doc trying to cover everything, no architectural overview
at all, duplicated information across files, stale docs describing old code.

**Fix actions:**
- Split bloated CLAUDE.md files (move details to linked docs, keep root as a map)
- Create missing `docs/` index with links to existing documentation
- Add CLAUDE.md files in undocumented subdirectories
- Remove duplicated content (keep single source of truth)
- Flag stale documentation that references moved/deleted code

### 6. Context Efficiency — Token-conscious design

Does the codebase respect the agent's context window? Or does it waste tokens through
bloated tool output, verbose error messages, and excessive boilerplate?

**Check for:**
- Tool/script output that's concise and high-signal
- Error messages that are specific and actionable
- Build output that highlights failures clearly
- Test output that summarizes results without noise
- API responses with only relevant fields

**Red flags:** verbose logging that floods context, error messages with full stack traces
but no actionable guidance, test runners that dump hundreds of lines per test.

**Fix actions:**
- Suggest structured output formats for custom scripts
- Improve error messages to include remediation steps
- Add summary modes to verbose scripts

### 7. Environment Design — "Fix the environment, not the prompt"

When agents fail, does the codebase treat that as a signal to improve the environment?
Is there infrastructure for agent-driven iteration?

**Check for:**
- Test-driven development patterns (tests exist before implementation)
- Fast feedback loops (hot reload, quick builds, <10s test runs)
- Seeded/deterministic behavior for reproducibility
- Sub-agent friendly structure (independent modules that can be researched in isolation)

**Red flags:** builds that take minutes, flaky tests, non-deterministic behavior that
changes between runs, tightly coupled modules that require reading the whole codebase.

**Fix actions:**
- Add test commands to CLAUDE.md if tests exist but aren't documented
- Flag slow build/test feedback loops
- Document deterministic behavior patterns (seeded RNG, etc.)

## Evaluation Process

### Phase 1: Investigate

Use Glob, Grep, and Read to examine the codebase across all 7 dimensions. Focus on
quality over quantity — actually read key files, don't just check existence. Use
sub-agents for parallel investigation if the codebase is large.

Key files to always check:
- `CLAUDE.md` / `AGENTS.md` / `CONTRIBUTING.md` at root
- `tsconfig.json` / `pyproject.toml` / `Cargo.toml` (language config)
- `.eslintrc*` / `biome.json` / linter configs
- `.github/workflows/` / CI configs
- `package.json` scripts section
- `docs/` directory structure
- Test files and test configuration
- `.husky/` / `.lefthook/` / pre-commit configs

### Phase 2: Score

Rate each dimension:
- **Strong** — Well-embodied with clear, intentional practices
- **Moderate** — Some practices exist but with notable gaps
- **Weak** — Little evidence of this dimension
- **Absent** — No meaningful presence

### Phase 3: Report

Always output the report, regardless of mode:

```
# Agent-First Audit: [Project Name]

## Summary
[2-3 sentence overall assessment]

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Visibility | ... | one-line |
| 2 | Discoverability | ... | one-line |
| 3 | Mechanical Enforcement | ... | one-line |
| 4 | Verification (EARS) | ... | one-line |
| 5 | Documentation Architecture | ... | one-line |
| 6 | Context Efficiency | ... | one-line |
| 7 | Environment Design | ... | one-line |

## Detailed Findings

### 1. Visibility
**Score: [rating]**
[Evidence and analysis — cite specific files]
**Recommendations:**
- ...

[...repeat for all 7...]

## Top 3 Priority Actions
1. [Highest-impact, most actionable fix]
2. [Second highest]
3. [Third highest]
```

### Phase 4: Fix (fix mode only)

After reporting, work through the recommendations systematically. Focus on the Top 3
Priority Actions first. For each fix:

1. State what you're about to change and why
2. Make the change
3. Verify the change (build check if touching code, read-back if touching docs)

Leave all changes unstaged. The user decides what to commit.

Things that are safe to create/edit in fix mode:
- CLAUDE.md files (new or improved)
- Documentation files in docs/
- Linter configs and pre-commit hook configs
- Test scaffolds and verification tooling
- Build script improvements

Things to recommend but NOT do in fix mode (too risky without user input):
- Renaming files or functions
- Changing TypeScript strictness settings on existing projects (may surface hundreds of errors)
- Modifying CI/CD pipelines
- Deleting documentation
- Changing existing test behavior

## Notes

- Evaluate what **actually exists** in the repo, not what the user claims. If it's not
  in the repo, it doesn't count (that's the whole point of Principle 1).
- Adapt to the tech stack. Python projects have different enforcement tools than
  TypeScript projects — evaluate each in context.
- Be honest but constructive. Most codebases won't score Strong on all dimensions.
  The goal is to identify the highest-leverage improvements, not to be discouraging.
- For deeper background on any principle, reference `docs/agent-first/`.
