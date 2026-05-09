---
name: breakdown-tasks
description: >
  Break down a product ask, feature request, or large initiative into a series of small,
  atomic, verifiable backlog tasks — then run them through an adversarial review to
  harden them before they hit the backlog. Use this skill whenever the user says "break this
  down", "decompose this", "plan this out", "create tasks for", "what tasks do we need for",
  "break this into tasks", or describes a product-level change that clearly needs multiple
  implementation steps. Also trigger when the user pastes a feature spec, PRD, or describes
  something ambitious that can't be done in a single commit — even if they don't explicitly
  say "break down". If the user says "I want to add X" and X is clearly multi-step, this is
  the right skill.
---

# Breakdown Tasks

You are a task decomposition system that turns product-level asks into a set of atomic,
agent-executable backlog tasks. Every task you produce must be small enough that a single
agent session can implement, validate, and ship it — and rigorous enough that a reviewer
can verify it passed without understanding the original ask.

This skill has two phases:
1. **Decompose** — break the ask into EARS-structured atomic tasks
2. **Review** — run the tasks through a single-agent adversarial review that hardens them

The output is a set of task files written to `backlog/todo/`.

---

## Phase 1: Decompose

### Step 1: Understand the ask

Read the user's request carefully. If they've given a high-level product ask ("I want
multiplayer support"), you need to figure out what that actually means for this codebase.

Do targeted research:
- Use Glob and Grep to find the relevant files, types, and systems
- Read enough code to understand the current architecture in the affected area
- Identify what exists today vs. what needs to change

If the ask is genuinely ambiguous (you can't determine scope even after research), ask
**one** focused clarifying question. Don't ask about things you can figure out from the code.

### Step 2: Identify the EARS requirements

Before splitting into tasks, write out the requirements using the EARS framework (Easy
Approach to Requirements Specification). EARS eliminates the ambiguity that causes agents
to misinterpret what they need to build.

> **Note:** This project also uses "EARS" as shorthand for its verification methodology
> (Eyes, Ears/Audio, InSpect) in `docs/`. These are different frameworks — this skill uses
> EARS for *requirements specification*, not verification. The verification triple
> (build/test/screenshot) is a separate concern handled in the Validation section.

There are five EARS patterns. For the product ask, identify which requirements fall into
each category:

**Ubiquitous** (always true, no trigger keyword):
> The system shall [response].

These are invariants — things that must hold at all times. Examples: "The build shall
produce zero TypeScript errors." "The game shall maintain 60fps during battle phase."

**Event-Driven** (keyword: When):
> When [trigger], the system shall [response].

These are cause-and-effect pairs. Examples: "When the user clicks a card, the system shall
highlight valid placement slots." "When a unit dies, the system shall play the death animation."

**State-Driven** (keyword: While):
> While [precondition], the system shall [response].

These are conditional behaviors tied to system state. Examples: "While the game is paused,
units shall not move or attack." "While in the planning phase, the battle timer shall not
count down."

**Optional Feature** (keyword: Where):
> Where [feature is included], the system shall [response].

These are conditional on configuration. Examples: "Where sound is enabled, the system shall
play ability SFX on cast." "Where the codex is unlocked, the menu shall show the codex button."

**Unwanted Behavior** (keywords: If/Then):
> If [unwanted trigger], then the system shall [response].

These are error handling and edge cases. Examples: "If the player has no cards in hand,
then the draw button shall be disabled." "If a network request fails, then the system shall
retry once before showing an error."

**Complex** (combined patterns):
> While [precondition], when [trigger], the system shall [response].

Write these out as a numbered list grouped by pattern. Present them to the user in a
compact format so they can see the full picture before you split into tasks.

### Step 3: Decompose into atomic tasks

Now break the EARS requirements into tasks. Each task must be:

- **Atomic** — completable in a single agent session (one commit, one focused change)
- **Verifiable** — every acceptance criterion can be checked with a command or screenshot
- **Self-contained** — an agent with zero context can pick it up and execute it
- **Ordered** — tasks are numbered and list their dependencies (if any)
- **Small** — biased toward too-small over too-large (see sizing rules below)

Use the contract-first decomposition principle: if a sub-task's output is too subjective
to verify, break it down further until every piece has programmatic verification.

### Sizing rules — err on the side of smaller

Agents that face large tasks tend to cut corners, skip validation, or bail early. A
completed small task is worth more than a half-finished large one. Apply these hard limits:

- **Max 5 acceptance criteria** per task (not counting the standard build/test/screenshot).
  If you have more, split the task.
- **Max 2 production files modified** per task (test files don't count). If you're touching
  3+ unrelated files, you're doing two things at once.
- **One new concept per task.** A task that introduces a new type system AND populates it
  with 64 entries is two tasks. A task that adds 3 different effect handlers is three tasks.
- **Data-heavy tasks must batch.** If a task involves writing many similar definitions
  (upgrade data, config entries, test cases), batch into groups of 4-8 items per task.
  An agent writing 64 entries will make mistakes on entry 47 that it won't catch.
- **Infrastructure vs. integration.** If a task builds a generic system (like an
  `onFieldCount` handler) that happens to be first used by a specific unit, the generic
  system is its own task. The unit-specific integration test is a separate task.
- **Wire what you define.** If a task defines an interface method on an adapter, that same
  task must provide a working implementation (even if minimal). An interface without an
  implementation is not "done" — downstream tasks will crash.
- **Verification-only work is not a task.** If a tier/feature is "already handled by
  prerequisites — just verify," that verification belongs in the prerequisite's acceptance
  criteria, not a new task.

The decomposition should follow a natural implementation order:
1. Data model / type changes first
2. Core logic / simulation changes next
3. UI / rendering changes after
4. Polish / animation / sound last

Each task uses the standard GnorpBuzz task format:

```markdown
# <Imperative Action Title>

- **Category:** bug | feature | UX | balance | polish
- **Priority:** high | medium | low
- **Scene:** <primary scene affected>
- **Created:** <YYYY-MM-DD>
- **Source:** <the product ask that spawned this>
- **Depends-on:** <slugs of prerequisite tasks, or "none">
- **Sequence:** <N of M>

## Purpose
Why this matters (1-2 sentences, user impact focus).

## Context
- Full repo-relative file paths
- Current behavior being changed
- Key types, functions, modules involved

## EARS Requirements
The specific EARS-patterned requirements this task satisfies (copied from the master list).

## Description
2-3 sentence developer brief.

## Acceptance Criteria
- [ ] Behavioral verification statements using EARS language
- [ ] "When the user does X, they see Y"
- [ ] "Running `npm run build` produces zero errors"
- [ ] "`node test-game.cjs` passes all tests"
- [ ] "Screenshot at localhost:5173 shows Z"

## Validation
```
npm run build          # zero TypeScript errors
node test-game.cjs     # all integration tests pass
npm run dev            # take screenshot, verify visually
```
Task-specific validation steps.
```

**Sizing guideline:** If a task has more than 5 acceptance criteria (beyond the standard
build/test/screenshot), it's too big — split it. If it modifies more than 2 production
files, it's too broad — split it. If it introduces more than one new concept, it's doing
two things — split it. When in doubt, split. A 50-task plan where each task takes 15
minutes is better than a 20-task plan where agents bail on task 7.

### Step 4: Present the decomposition

Show the user a numbered overview:

```
Product Ask: "<the original ask>"

EARS Requirements: 12 identified (4 event-driven, 3 ubiquitous, 2 state-driven, 2 unwanted, 1 complex)

Tasks (8 total):
  1. [feature] add-mana-field-to-sim-unit (no deps)
  2. [feature] implement-mana-generation-in-combat (depends on 1)
  3. [feature] add-ability-cast-trigger (depends on 2)
  ...
```

Wait for user confirmation before proceeding to the review phase. They might want to
adjust scope, reorder, or merge/split tasks.

---

## Phase 2: Adversarial Review

Once the user approves the decomposition, run it through an adversarial review. Use a
**single agent** that evaluates all tasks through 5 review lenses. The goal is to find
problems before an implementing agent hits them — without burning tokens on parallel
agent teams.

### The Review Agent

Spawn **one** subagent (general-purpose type) that covers all 5 review perspectives in
a single pass. The agent receives:
- The original product ask
- The full EARS requirements list
- All draft task slugs with summaries, dependencies, and file counts
- Instructions to use Glob/Grep to ground-truth against the actual codebase

The agent's prompt must include this framing:

> You are a combined reviewer covering 5 adversarial perspectives. Be direct, concise,
> and adversarial — flag real problems, skip tasks that pass cleanly. A missed issue
> that reaches implementation is far more expensive than a false alarm caught in review.

The agent evaluates every task through these 5 lenses:

**Lens 1 — Scope:** Is the task atomic? Does it touch >3 files? Hidden sub-tasks?
Two things at once? Muddy boundaries with adjacent tasks? Propose specific splits.

**Lens 2 — Verifiability:** Can every acceptance criterion be verified by command,
assertion, or screenshot? Would two agents agree on pass/fail? Flag vague criteria
and propose concrete replacements.

**Lens 3 — Performance:** Does it touch a hot path (per-tick loop, per-attack,
per-frame)? Risk of O(N²), GC pauses, missing cleanup? Use Grep to verify hot-path
claims before flagging. Propose constraints or alternative approaches.

**Lens 4 — Technical Feasibility:** Do referenced files/types/functions exist? Use
Glob and Grep to verify. Compatible with current architecture? Dependency ordering
correct? Context accurate enough for a zero-knowledge agent?

**Lens 5 — Naysayer:** What's the most likely misinterpretation? What implicit
assumptions aren't written down? What gets built wrong by a literal-but-dumb agent?
What cross-task interactions cause conflicts?

The agent should also look for **cross-cutting gaps** — things no individual task
covers but the system needs (e.g., missing bridge code between two subsystems, hooks
that multiple tasks assume exist but nobody creates).

**Output format:** The agent reports ONLY tasks with problems. Skip clean passes.
Group findings into:
- **CRITICAL** — blocks multiple tasks or causes silent wrong behavior
- **TASK-SPECIFIC** — individual task issues

For each flagged task:
```
TASK: <slug>
LENSES: <which lenses flagged it>
VERDICT: PASS | REVISE | REWRITE | SPLIT | ADD_CONSTRAINT | FIX_CONTEXT
ISSUES: <bullet list>
RECOMMENDATION: <what to change>
```

### Processing Review Results

After the reviewer returns:

1. **Prioritize critical gaps** — these often require new tasks or dependency changes
2. **Apply task-specific fixes** — revise flagged tasks with concrete changes
3. **Resolve conflicts** — when lenses disagree, pick the better option and explain why
4. **Don't over-correct** — sometimes the Naysayer lens is paranoid and the task is fine

5. **Present the review summary** to the user:

```
Review Panel Results:
━━━━━━━━━━━━━━━━━━━━
Task 1: add-mana-field — 5/5 PASS ✓
Task 2: implement-mana-gen — 3/5 PASS
  - Scope Guardian: SPLIT (too many files)
  - Naysayer: REWRITE (ambiguous mana formula)
  → Revised: split into 2a (mana tick) and 2b (mana cap logic)
Task 3: add-cast-trigger — 4/5 PASS
  - Performance: ADD_CONSTRAINT (hot path concern)
  → Added: "No frame drops during ability cast animation"
...

Total: 8 tasks → 9 tasks (1 split), 4 revised, 5 unchanged
```

### Step 5: Rewrite revised tasks from scratch

This step is critical and must not be skipped. Do NOT just update the outline — you must
produce complete, final task files that incorporate ALL review feedback. The review panel
is worthless if the revised tasks only exist as a bullet-point plan.

For every task that was split, revised, or flagged:
- **Write the full task file** with all sections (Purpose, Context, EARS, Description,
  Acceptance Criteria, Validation) reflecting the review feedback
- **Re-verify against sizing rules** — splits should produce tasks that each pass
  the max-5-criteria, max-2-files checks independently
- **Re-verify wiring** — if a task was split and one half defines an interface, confirm
  the implementation is in the SAME task, not deferred to the other half
- **Re-verify test patterns** — if reviewers flagged test methodology issues (wrong APIs,
  bypassed code paths), the rewritten tests must use the corrected approach

After rewriting, do a quick self-check pass on every task:
1. Does this task modify ≤2 production files?
2. Does it have ≤5 acceptance criteria (beyond build/test/screenshot)?
3. Does every test route through the actual code path being tested?
4. If it defines an interface, does it also wire the implementation?
5. Are all file paths and function names verified against the current codebase?

If any task fails the self-check, fix it before presenting to the user.

Then ask the user if they want to proceed with writing the tasks to the backlog. If yes:

- Write each task file to `backlog/todo/<slug>.md`
- Use the standard GnorpBuzz task format
- Include the `Depends-on` and `Sequence` fields so the execution skill can order them
- Print a final confirmation with all file paths

---

## Principles

- **EARS eliminates ambiguity.** Every requirement gets a pattern. "The system should
  handle errors gracefully" becomes "If the WebSocket connection drops, then the system
  shall display a reconnection overlay and retry every 3 seconds for up to 30 seconds."
  The pattern forces you to specify the trigger, the system, and the response.

- **Atomic means one commit.** If you can't describe the change in a single conventional
  commit message, it's not atomic. Split it.

- **Review lenses are adversarial, not collaborative.** The review works because each
  lens defends its concern without compromise. A task that survives 5 adversarial
  perspectives is much more likely to survive implementation.

- **Verify the verifiers.** The Technical Feasibility reviewer should actually Glob/Grep
  the codebase to check file paths — not just take the task's word for it.

- **Order matters.** Data model first, logic second, UI third, polish fourth. This
  mirrors how changes propagate through the codebase and minimizes rework.

- **The user is the tiebreaker.** When reviewers disagree, present the tradeoff clearly
  and let the user decide. Don't silently pick a side.
