# Documentation Patterns

Agent-first documentation is fundamentally different from human documentation. Humans skim, infer context, and ask clarifying questions. Agents consume tokens linearly, have finite context windows, and take documentation literally. The goal is not comprehensive coverage — it's providing the right information at the right time.

> "A Map, Not a Manual." — OpenAI Harness Engineering, Principle 5

---

## CLAUDE.md and AGENTS.md

These are the primary instruction files for coding agents. CLAUDE.md is Claude-specific; AGENTS.md is cross-tool (supported by Claude Code, Cursor, GitHub Copilot, Gemini CLI, Windsurf, Aider, Zed, Warp, and others as of 2026).

### What to Include

Only include things agents **cannot figure out by reading code:**

- **Build/test commands** the agent cannot guess (`npm run build`, specific flags, test runners)
- **Code style rules** that differ from language defaults (not standard conventions)
- **Repository etiquette** — branch naming, PR conventions, commit message format
- **Architectural decisions** specific to the project that aren't obvious from the code
- **Developer environment quirks** — required env vars, special setup steps
- **Common gotchas** — non-obvious behaviors that cause repeated mistakes

### What to Exclude

- Anything the agent can figure out by reading code
- Standard language conventions the agent already knows
- Detailed API documentation (link to docs instead)
- Information that changes frequently (it will rot and mislead)
- File-by-file descriptions of the codebase
- Self-evident practices like "write clean code"
- Long explanations or tutorials

### Size Guidelines

- **CLAUDE.md:** Under 300 lines (Anthropic recommendation), ideally under 100 lines as a table of contents (OpenAI recommendation)
- **AGENTS.md:** Default `project_doc_max_bytes` is 32 KiB
- **Litmus test:** For each line, ask: "Would removing this cause the agent to make mistakes?" If not, cut it

### Emphasis for Critical Rules

Use emphasis markers to improve adherence on critical rules:
- "IMPORTANT:", "YOU MUST", "NEVER" for hard requirements
- Agents treat these markers as higher-priority instructions
- Use sparingly — if everything is important, nothing is

### Hierarchical Placement

```
~/.claude/CLAUDE.md          # Global — applies to all sessions
./CLAUDE.md                  # Project root — shared with team
./src/CLAUDE.md              # Subdirectory — domain-specific rules
./src/api/CLAUDE.md          # Deeper nesting — even more specific
```

Files merge from root downward. Closer directories can override or extend parent rules. This mirrors how agents navigate: start broad, go deeper as needed.

---

## Progressive Disclosure Architecture

The most effective documentation strategy loads information incrementally, matching how agents naturally explore:

### Level 1: Entry Point (Always Loaded)
- CLAUDE.md at project root
- ~100 lines: build commands, key conventions, links to deeper docs
- Functions as a **table of contents**, not an encyclopedia

### Level 2: Section Indexes (Loaded on Navigation)
- CLAUDE.md files in subdirectories (`docs/CLAUDE.md`, `src/api/CLAUDE.md`)
- Summarize what's in that section and link deeper
- Agents read these when they navigate into that directory

### Level 3: Detailed Documentation (Loaded on Demand)
- Architecture docs, API specs, design decisions
- Read only when the agent is actively working in that area
- Can be longer and more detailed since they don't compete with task context

### Level 4: Code-Level Discovery
- Comments, type signatures, function names, test descriptions
- Agents discover these by reading code
- Don't duplicate this information in higher-level docs

---

## The Repository as Operating Manual

In agent-first engineering, the repository serves dual purposes: source code AND an operating manual for agents. Build commands, test instructions, architecture notes, design documentation, constraints, and non-goals become executable context.

> "What the agent can't see doesn't exist." — OpenAI Harness Engineering, Principle 1

This means:
- **Architectural decisions** belong in the repo, not in Slack or Google Docs
- **Active plans and known tech debt** should be versioned and co-located with the code
- **Product specs** should live in `docs/`, not in a wiki the agent can't access
- **Execution plans** (ExecPlans) should be self-contained design documents that enable implementation without prior knowledge

### ExecPlans / PLANS.md Pattern

OpenAI's pattern for complex, multi-hour tasks:

- Every plan must enable a complete novice to implement end-to-end without prior knowledge
- Must produce demonstrable working behavior, not merely code changes
- Living documents that evolve during implementation
- Anchor outcomes as observable behavior ("navigating to /health returns HTTP 200") rather than internal attributes
- Include full repository-relative paths, function/module names, and expected command output

> Source: [Using PLANS.md for multi-hour problem solving](https://developers.openai.com/cookbook/articles/codex_exec_plans)

---

## Code Discoverability ("Code SEO")

Code itself is documentation for agents. Make it easy to find:

- **Use complete words, avoid abbreviations.** Agents search for complete words; abbreviations make code harder to find
- **Eliminate duplicate filenames** that force agents to read multiple files to identify the right one
- **Include cross-references** linking related modules, functions, and classes
- **Add synonyms in comments** to help agents recognize related concepts (sparingly)
- **Use domain-reflective naming** — `OrderProcessor` not `OrderServiceFactory`
- **Write Architecture Decision Records (ADRs)** for custom architecture choices that agents wouldn't expect

---

## Documentation Anti-Patterns

### The Kitchen-Sink CLAUDE.md
A 500-line CLAUDE.md that tries to cover everything. Rules get lost in noise. Agents pattern-match locally rather than following important instructions.

**Fix:** Ruthlessly prune. Move details to linked docs. Keep the root file as a map.

### Duplicated Information
The same rule appears in CLAUDE.md, a README, and inline comments. When one gets updated and the others don't, agents get contradictory instructions.

**Fix:** Single source of truth. Reference, don't duplicate.

### Stale Documentation
Docs that describe how the code *used to* work. Agents follow these outdated instructions and produce code that doesn't fit the current architecture.

**Fix:** Treat docs like code — review them during PRs. Or better: enforce with linters so the docs can't drift (see [Mechanical Enforcement](mechanical-enforcement.md)).

### Over-Specified Instructions
Research shows that piling on requirements diminishes adherence to each one. The more rules you add, the less reliably any single rule is followed.

**Fix:** Feed agents one focused task at a time. Move durable rules into linters. Keep CLAUDE.md for what's truly important.
