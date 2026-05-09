# Core Principles of Agent-First Engineering

Agent-first engineering is the discipline of designing codebases, tooling, and workflows so that AI coding agents can work autonomously and reliably. The mental model: **the model is the horse, the harness is the infrastructure, the engineer is the rider.** The competitive advantage lies not in the model (commodity) but in the harness — context engineering + architectural constraints + entropy management.

Two organizations have published the most influential frameworks: OpenAI's Codex team (Harness Engineering, 5 principles) and Anthropic (Building Effective Agents, context engineering). Their principles are complementary and converge on the same core ideas.

---

## OpenAI's 5 Harness Engineering Principles

OpenAI's Codex team spent 5 months building a production internal product with **zero manually-written code**. Three engineers produced ~1,500 merged PRs across ~1 million lines of code at roughly 1/10th typical development time. These are the principles they distilled.

> Source: [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)

### 1. What the Agent Can't See Doesn't Exist

Agents operate only within their accessible information. Slack discussions, Google Docs, and tacit human knowledge are invisible. If it's not discoverable in the repo, it effectively does not exist.

**What this means in practice:**
- Push ALL architectural decisions into the repository as markdown files, schemas, and plans
- Version and co-locate active plans, completed plans, and known technical debt
- Structure a `docs/` directory as the system of record — design docs, execution plans, product specs, references
- Codex sustained focus on single prompts for over 7 hours when context was complete and stable

### 2. Ask What Capability Is Missing

When agent velocity underperforms, the root cause is almost never the model. It's an insufficient operational environment. The fix is never "try harder" or "prompt harder."

**What this means in practice:**
- When agents struggle, identify what's missing: tools, guardrails, abstractions, or documentation
- Have the agent itself build that missing capability into the repo (this compounds over time)
- Prioritize "stable, well-documented" technology with strong training data representation
- Never manually write code as a workaround; fix the environment instead

### 3. Mechanical Enforcement Over Documentation

Documentation alone cannot maintain consistency in agent-generated codebases. Enforce structural rules through automated mechanisms that agents cannot violate.

**What this means in practice:**
- Write custom linters that verify dependency directions and fail builds on violations
- Craft lint error messages that inject remediation instructions directly into agent context — every violation becomes a learning opportunity
- Let agents write the linters themselves
- Mandate data boundary parsing but allow agent choice of implementation libraries

See [Mechanical Enforcement](mechanical-enforcement.md) for detailed patterns.

### 4. Give the Agent Eyes

Agents need sensory access to verify their actual effects. Visual and observability feedback loops enable autonomous iteration without human involvement.

**What this means in practice:**
- Wire browser automation (Playwright, Chrome DevTools Protocol) into agent runtimes for DOM snapshots, screenshots, and navigation
- Provide observability stacks — agents should be able to query logs, metrics, and traces
- Use pre/post-task snapshot comparisons with runtime event observation
- Convert aspirational prompts ("make service startup under 800ms") into executable instructions via observable metrics
- Agents regularly sustained 6+ hour focused sessions with these feedback loops

See [Verification & Feedback](verification-and-feedback.md) for the EARS framework.

### 5. A Map, Not a Manual

Effective context management determines agent performance. Monolithic documentation is counterproductive.

**What this means in practice:**
- Keep AGENTS.md/CLAUDE.md to ~100 lines functioning as a table of contents
- Point to deeper sources in a structured `docs/` directory
- Monolithic instruction files "crowd out task context, rot quickly, and cause agents to pattern-match locally rather than navigate intentionally"
- Use progressive disclosure: agents start with a small, stable entry point and discover deeper context on demand
- Every token in context that isn't directly relevant becomes noise

See [Documentation Patterns](documentation-patterns.md) for implementation details.

---

## Anthropic's Agent Architecture Principles

Anthropic's research spans agent design patterns, context engineering, tool design, and long-running agent management. Where OpenAI focuses on codebase design, Anthropic focuses more on how agents think and how to shape their information environment.

> Sources: [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents), [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), [Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents)

### Simplicity First

Start with the simplest solution. The most successful implementations use simple, composable patterns rather than complex frameworks. Only add agentic patterns when simpler approaches demonstrably underperform.

### Context Is the Scarce Resource

The context window is the most precious resource. Everything — folder structure, tool design, documentation architecture — should optimize for minimal high-signal token usage. Accuracy degrades as context length increases ("context rot") — it's a gradient, not a cliff.

**Guiding formula:** Find "the smallest set of high-signal tokens that maximize the likelihood of some desired outcome."

### Agent-Computer Interface (ACI) = HCI

Invest as much effort in designing how agents interact with tools as you would in human-computer interface design. Tool naming, parameter design, response format, and error messages all matter enormously.

**Tool design best practices:**
- Choose formats naturally occurring in training data
- Structure arguments to make mistakes harder (e.g., require absolute filepaths instead of relative ones)
- Return only high-signal information; restrict responses to ~25K tokens
- Error messages should be specific and actionable, not opaque codes
- Minimize functional overlap between tools

### Environment Over Instructions

Invest in designing the environment — tests, feedback mechanisms, verification tools, file organization — rather than writing detailed instructions. A well-designed environment naturally guides agent behavior. Claude naturally picks up the "next most obvious" problem when the environment clearly signals what's needed.

### Progressive Disclosure

Load information in tiers. Metadata first, core docs when relevant, deep references on demand. This applies to CLAUDE.md, Skills, folder hierarchies, and tool responses.

**Three-tier memory architecture:**
1. **Hot memory** (system prompt / CLAUDE.md) — always loaded
2. **Domain specialists** (sub-agents) — invoked per task
3. **Cold memory** (knowledge base / docs/) — retrieved on demand

### Verification Is Non-Negotiable

Always provide agents with a way to verify their own work — tests, linters, screenshots, expected outputs. Without verification, you become the only feedback loop.

---

## Synthesis: Where Both Converge

Despite different framing, OpenAI and Anthropic converge on the same core ideas:

| Concept | OpenAI Framing | Anthropic Framing |
|---------|---------------|-------------------|
| Context is king | "What the agent can't see doesn't exist" | "Context is the scarce resource" |
| Verify autonomously | "Give the agent eyes" | "Verification is non-negotiable" |
| Automate constraints | "Mechanical enforcement over docs" | "Environment over instructions" |
| Don't over-document | "A map, not a manual" | "Progressive disclosure" |
| Fix the environment | "Ask what capability is missing" | "Simplicity first" + ACI design |
| Repo is the source of truth | Push everything to the repo | Hot/cold memory tiers in the repo |

The overarching insight: **engineers no longer primarily write code — they design the environment in which agents write code reliably.**
