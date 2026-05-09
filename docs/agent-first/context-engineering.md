# Context Engineering

Context engineering is the discipline of strategically curating and maintaining the optimal set of tokens during LLM inference. It is the natural evolution from prompt engineering — where prompt engineering optimizes a single input, context engineering optimizes the entire information environment across an agent's lifetime.

> Source: [Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

---

## The Fundamental Constraint

The transformer architecture creates n-squared pairwise token relationships. Longer contexts stretch model focus thin. "Context rot" means accuracy degrades as context length increases — a gradient, not a cliff.

**Guiding principle:** Find "the smallest set of high-signal tokens that maximize the likelihood of some desired outcome."

**Token priority order:** Current task > Tools > Retrieved docs > Memory > History.

---

## Three-Tier Memory Architecture

Structure information in tiers so agents load only what they need, when they need it.

### Tier 1: Hot Memory (Always Loaded)
- CLAUDE.md / AGENTS.md — project-wide rules and conventions
- System prompt — agent capabilities, boundaries, persona
- Keep this under 100-300 lines. Every unnecessary token here competes with task context

### Tier 2: Domain Specialists (On-Demand Agents)
- Sub-agents with clean context windows for specific domains
- Invoked per task, explore extensively (tens of thousands of tokens)
- Return condensed summaries (1,000-2,000 tokens) to the coordinating agent
- Example: a "research agent" that searches the codebase and reports findings

### Tier 3: Cold Memory (Retrieved on Demand)
- `docs/` directory, knowledge base files, ADRs
- Agents discover and read these as needed via file system navigation
- File organization, naming conventions, and directory hierarchy provide behavioral cues without consuming tokens

---

## Progressive Disclosure

The most effective context strategy loads information incrementally:

1. **Entry point** — CLAUDE.md provides a small, stable map of the project
2. **Navigation** — Folder README/CLAUDE.md files guide agents to relevant areas
3. **Deep context** — Detailed docs, specs, and references are read only when needed
4. **Discovery** — Agents use grep, glob, and file reading to find specifics

This mirrors how humans navigate codebases: start with the README, follow links, read code as needed. Fighting this natural pattern — by front-loading everything into a massive instruction file — is counterproductive.

**Anti-pattern:** Monolithic instruction files "crowd out task context, rot quickly, and cause agents to pattern-match locally rather than navigate intentionally."

---

## Sub-Agents for Context Isolation

Sub-agents are one of the most powerful context management tools. They run in separate context windows, protecting the main conversation from information overload.

**When to use sub-agents:**
- Broad codebase searches that might return thousands of lines
- Research tasks that require reading many files
- Investigation of bugs where root cause is unclear
- Parallel independent work streams

**Pattern:**
1. Main agent identifies a question or task
2. Sub-agent gets a clean context window with just the question
3. Sub-agent explores extensively, reads files, searches code
4. Sub-agent returns a condensed summary to the main agent
5. Main agent continues with high-signal information, not raw search results

---

## Context Management in Practice

### Frequent Compaction
Structure workflow around managing context utilization at 40-60% capacity. Don't let context fill up and degrade — proactively clear between unrelated tasks.

### Research Before Implementation
Bad research compounds into thousands of bad code lines. The highest-leverage human review points (from most to least impactful):
1. **Research review** — prevents cascading misunderstandings
2. **Plan review** — catches architectural decisions before implementation
3. **Code review** — focused on remaining issues

### Folder Structure as Context Engineering
File organization isn't just for humans — it becomes discoverable information architecture for agents:
- Use complete words, avoid abbreviations (agents search for whole words)
- Eliminate duplicate filenames that force agents to read multiple files
- Include cross-references linking related modules
- Use domain-reflective naming (`OrderProcessor` not `OrderServiceFactory`)
- Prefer "boring tech" — frameworks like React, Express, Rails that agents know well from training data

### Token-Efficient Tool Design
Tools are a major source of context consumption. Design for efficiency:
- Return only high-signal information
- Implement response format enums (detailed vs. concise)
- Restrict responses to approximately 25,000 tokens
- Include helpful truncation messages guiding agents toward efficient strategies
- Error responses should be specific and actionable, not opaque codes or tracebacks
