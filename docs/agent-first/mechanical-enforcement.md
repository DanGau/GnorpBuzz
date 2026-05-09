# Mechanical Enforcement

Documentation tells agents what to do. Mechanical enforcement ensures they actually do it. In agent-generated codebases, documentation alone cannot maintain consistency — you need automated mechanisms that agents cannot violate.

> "Mechanical Enforcement Over Documentation." — OpenAI Harness Engineering, Principle 3

---

## Why Documentation Alone Fails

Agents process documentation probabilistically. A rule in CLAUDE.md is a strong suggestion, not a guarantee. As context windows fill, instruction adherence degrades. And documentation rots — the codebase evolves but the docs lag behind.

Mechanical enforcement removes the probabilistic element. A linter that rejects invalid dependency directions doesn't care how long the context window is. A type system that rejects incorrect shapes doesn't need documentation to explain itself.

---

## Layers of Enforcement

### 1. Type Systems

Strongly typed languages (TypeScript, Rust, Go) are the first line of enforcement. The type system catches errors at compile time with zero runtime overhead and zero documentation needed.

**Why TypeScript overtook Python/JavaScript for agent-generated code:** TypeScript gives agents clearer constraints, producing more reliable, contextually correct output. It became the most-used language on GitHub in August 2025.

**Practical applications:**
- Define strict interfaces for data shapes at module boundaries
- Use discriminated unions instead of string enums where possible
- Mandate data boundary parsing — require validation at system edges
- Let agents choose implementation libraries, but enforce the types

### 2. Linters and Static Analysis

Custom linters verify structural rules that the type system can't express.

**OpenAI's approach:** The Codex team enforces a fixed layered architecture (Types → Config → Repo → Service → Runtime → UI) via custom linters that validate dependency directions and fail builds on violations.

**Key insight: error messages are agent instructions.** Craft lint error messages that inject remediation instructions directly into agent context. Every violation becomes a learning opportunity. Instead of:

```
Error: Invalid import in service layer
```

Write:

```
Error: Service layer cannot import from UI layer.
Services must only import from: Types, Config, Repo.
Move the UI logic to the Runtime layer or extract shared types to the Types layer.
See docs/architecture/layers.md for the dependency diagram.
```

The error message itself teaches the agent how to fix the problem.

**Let agents write the linters.** Since agents understand the rules, they can build the enforcement tooling. This compounds — every new linter improves all future agent sessions.

### 3. Pre-Commit Hooks

Hooks run automatically before commits, catching issues before they enter the repository.

**Common agent-relevant hooks:**
- Format checking (Prettier, Black, gofmt)
- Lint verification
- Type checking (`tsc --noEmit`)
- Import order enforcement
- Test execution for affected files

### 4. CI/CD Pipeline Validation

The final enforcement layer. Even if an agent bypasses local checks, CI catches the issue.

**Stripe's approach:** Multi-layered feedback:
1. Local lint checks (~5 seconds)
2. Selective CI test execution from 3M+ test battery
3. Automatic test fixes for known failure patterns
4. At most 2 CI rounds — if code doesn't pass after second push, it goes back to humans

### 5. Architectural Tests

Tests that verify architectural invariants rather than business logic:

- Dependency direction tests (layer A cannot import from layer B)
- Module boundary tests (public API surface hasn't changed unexpectedly)
- Convention tests (all files in `/api/` export a handler function)
- Dead code detection

---

## Entropy Management: Garbage Collection

Agent-generated codebases accumulate "AI slop" — unnecessary abstractions, redundant error handling, hallucinated APIs, documentation drift, over-engineering.

OpenAI's team initially spent 20% of their week (every Friday) on manual cleanup. They solved this by **encoding golden principles and running continuous cleanup agents:**

1. Define mechanical rules (e.g., prefer shared utilities over hand-rolled helpers)
2. Run regular background agent tasks scanning for deviations
3. Auto-generate targeted refactoring PRs
4. Track quality metrics per domain/layer

**Philosophy:** "Human taste captured once, enforced continuously on every line of code."

Martin Fowler characterized this as one of three pillars of harness engineering:
1. **Context Engineering** — knowledge embedded in the codebase
2. **Architectural Constraints** — linters and structural tests
3. **Entropy Management** — periodic cleanup maintaining consistency

---

## Anti-Patterns

- **Documentation-only rules.** "Please don't import X from Y" in CLAUDE.md. Agents will eventually forget. Add a lint rule.
- **Manual code review as sole enforcement.** Doesn't scale. By the time you review, the agent has moved on.
- **Over-constraining.** Enforce invariants (dependency direction), not implementations (which library to use). Agents need room to choose approaches.
- **Ignoring agent-generated linter failures.** If the linter fails and you skip it (`--no-verify`), you've defeated the purpose. Fix the issue or update the rule.
