# Results & References

## Published Outcomes

| Organization | Result | Source |
|---|---|---|
| **OpenAI (Codex team)** | ~1M lines of agent-generated code, 1,500 PRs by 7 engineers (~3.5 PRs/engineer/day), zero manually-written code | [Harness Engineering](https://openai.com/index/harness-engineering/) |
| **Stripe** | 1,300+ PRs merged per week via Minions agents; aggressive CI catches ~15% of agent code that would introduce bugs | [Minions Part 1](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents), [Part 2](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents-part-2) |
| **Anthropic** | Multi-agent research systems outperform single-agent by 90.2%; parallel tool calling reduces research time by up to 90% | [Multi-Agent Research](https://www.anthropic.com/engineering/multi-agent-research-system) |
| **TELUS** | 30% faster shipping, 500K+ hours saved | [2026 Agentic Coding Trends](https://resources.anthropic.com/2026-agentic-coding-trends-report) |
| **Zapier** | 89% org-wide AI adoption, 800+ deployed agents | [2026 Agentic Coding Trends](https://resources.anthropic.com/2026-agentic-coding-trends-report) |

Modern frontier models sustain "2 hours and 17 minutes of continuous work with roughly 50% confidence," with task length doubling approximately every 7 months.

> Source: [Building an AI-Native Engineering Team](https://developers.openai.com/codex/guides/build-ai-native-engineering-team)

---

## Primary Sources

### Anthropic

| Title | URL | Topic |
|-------|-----|-------|
| Building Effective Agents | [anthropic.com/research/building-effective-agents](https://www.anthropic.com/research/building-effective-agents) | Agent design patterns, workflows vs. agents, tool design |
| Best Practices for Claude Code | [code.claude.com/docs/en/best-practices](https://code.claude.com/docs/en/best-practices) | CLAUDE.md, context management, common failure patterns |
| Effective Context Engineering | [anthropic.com/engineering/effective-context-engineering-for-ai-agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Token management, progressive disclosure, sub-agents |
| Writing Tools for Agents | [anthropic.com/engineering/writing-tools-for-agents](https://www.anthropic.com/engineering/writing-tools-for-agents) | ACI design, tool naming, response design, evaluation |
| How Anthropic Teams Use Claude Code | [claude.com/blog/how-anthropic-teams-use-claude-code](https://claude.com/blog/how-anthropic-teams-use-claude-code) | Internal workflows, documentation strategy |
| Effective Harnesses for Long-Running Agents | [anthropic.com/engineering/effective-harnesses-for-long-running-agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | Session management, progress files, two-agent architecture |
| Building Agents with the Agent SDK | [claude.com/blog/building-agents-with-the-claude-agent-sdk](https://claude.com/blog/building-agents-with-the-claude-agent-sdk) | Four-phase agent loop, folder structure as context engineering |
| Agent Skills | [claude.com/blog/equipping-agents-for-the-real-world-with-agent-skills](https://claude.com/blog/equipping-agents-for-the-real-world-with-agent-skills) | Progressive disclosure, skill design, SKILL.md |
| The Think Tool | [anthropic.com/engineering/claude-think-tool](https://www.anthropic.com/engineering/claude-think-tool) | Reasoning tool, policy compliance, sequential decisions |
| Building a C Compiler with Parallel Claudes | [anthropic.com/engineering/building-c-compiler](https://www.anthropic.com/engineering/building-c-compiler) | Multi-agent coordination, git as backbone, task locking |
| Multi-Agent Research System | [anthropic.com/engineering/multi-agent-research-system](https://www.anthropic.com/engineering/multi-agent-research-system) | Orchestration, delegation, parallel tool calling |
| 2026 Agentic Coding Trends Report | [resources.anthropic.com/2026-agentic-coding-trends-report](https://resources.anthropic.com/2026-agentic-coding-trends-report) | Industry trends, multi-agent coordination, security |

### OpenAI

| Title | URL | Topic |
|-------|-----|-------|
| Harness Engineering | [openai.com/index/harness-engineering/](https://openai.com/index/harness-engineering/) | 5 principles, agent-first codebase design |
| Best Practices for Codex | [developers.openai.com/codex/learn/best-practices](https://developers.openai.com/codex/learn/best-practices) | Prompt structure, common mistakes |
| AGENTS.md Guide | [developers.openai.com/codex/guides/agents-md](https://developers.openai.com/codex/guides/agents-md) | Custom instructions, discovery hierarchy |
| ExecPlans / PLANS.md | [developers.openai.com/cookbook/articles/codex_exec_plans](https://developers.openai.com/cookbook/articles/codex_exec_plans) | Multi-hour problem solving, plan structure |
| Building an AI-Native Engineering Team | [developers.openai.com/codex/guides/build-ai-native-engineering-team](https://developers.openai.com/codex/guides/build-ai-native-engineering-team) | Work distribution, delegate/review/own |
| Codex Agent Loop | [openai.com/index/unrolling-the-codex-agent-loop/](https://openai.com/index/unrolling-the-codex-agent-loop/) | Agent loop internals |
| Codex App Server | [openai.com/index/unlocking-the-codex-harness/](https://openai.com/index/unlocking-the-codex-harness/) | Harness architecture, JSON-RPC API |
| Agent Skills | [developers.openai.com/codex/skills](https://developers.openai.com/codex/skills) | SKILL.md, open standard |

### Community & Analysis

| Title | URL | Topic |
|-------|-----|-------|
| Martin Fowler: Harness Engineering | [martinfowler.com/articles/exploring-gen-ai/harness-engineering.html](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html) | Three pillars analysis, critical observations |
| Marmelab: Agent Experience | [marmelab.com/blog/2026/01/21/agent-experience.html](https://marmelab.com/blog/2026/01/21/agent-experience.html) | Code SEO, discoverability, AX |
| JetBrains: Coding Guidelines for AI Agents | [blog.jetbrains.com/idea/2025/05/coding-guidelines-for-your-ai-agents/](https://blog.jetbrains.com/idea/2025/05/coding-guidelines-for-your-ai-agents/) | Naming, cross-references, ADRs |
| Simon Willison: Agentic Engineering Patterns | [simonwillison.net/guides/agentic-engineering-patterns/](https://simonwillison.net/guides/agentic-engineering-patterns/) | TDD, manual testing, conformance testing |
| Addy Osmani: Specs for AI Agents | [addyosmani.com/blog/good-spec/](https://addyosmani.com/blog/good-spec/) | Spec writing, three-tier boundaries |
| Devin: Agents 101 | [devin.ai/agents101](https://devin.ai/agents101) | Spec-driven development, gated workflows |
| Builder.io: AGENTS.md | [builder.io/blog/agents-md](https://www.builder.io/blog/agents-md) | Cross-tool standard, Linux Foundation |
| Codified Context (arXiv) | [arxiv.org/html/2602.20478v1](https://arxiv.org/html/2602.20478v1) | Three-tier architecture, academic analysis |
