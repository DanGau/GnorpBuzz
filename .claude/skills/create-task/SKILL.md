---
name: create-task
description: >
  Create a new backlog task with full agentic context. Use this skill whenever the user says
  "create a task", "add a task", "new task", "add to backlog", "backlog item", or describes
  work they want tracked as a future task. Also trigger when the user says "track this",
  "remember to do X later", or wants to file a bug, feature request, or improvement.
---

# Create Task

Create structured, self-contained backlog items that an agent (or developer with zero context)
can pick up and execute autonomously. This format is synthesized from Anthropic and OpenAI best
practices for agentic task specification.

## Core Principles

These principles come from converging recommendations by Anthropic ("Building Effective Agents")
and OpenAI ("Practices for Agents", PLANS.md):

1. **Novice-completability** — Write as if for a brilliant new hire with zero codebase context.
   Include all file paths, module names, and terminology definitions needed to execute.
2. **Behavioral acceptance** — Define success as observable outcomes ("the user sees X when they
   do Y"), not implementation details ("added a struct").
3. **Purpose-driven** — Always explain WHY the task matters before WHAT needs to change.
4. **Verification-explicit** — Include exact commands to run and what success looks like.
5. **Context-rich** — Name files with full paths, name functions precisely, describe current state.
6. **Edge-case aware** — Document known failure modes, interactions with other systems, and
   constraints.

## Task Format

Every backlog item MUST use this template:

```markdown
# <Imperative Action Title>

- **Category:** bug | feature | UX | balance | polish
- **Priority:** high | medium | low
- **Scene:** <primary scene affected>
- **Created:** <YYYY-MM-DD>
- **Source:** <feedback file, user request, or "manual">

## Purpose

Why this matters to the player or system. What observable behavior changes after
implementation. 1-2 sentences focused on user impact. This is NOT a description of what
to build — it's WHY it needs to exist.

## Context

Current state of the code relevant to this task:
- File paths with full repo-relative paths (e.g., `src/ui/ArtifactStrip.ts`)
- Current behavior being changed or extended
- Key types, functions, or modules involved
- Any terminology the implementer needs to know

## Description

2-3 sentences explaining what needs to change. Write as a developer brief — someone
unfamiliar with the raw feedback should understand the scope and approach.

## Acceptance Criteria

Behavioral verification statements — what the user/system can DO after this is complete:
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

Additional validation steps specific to this task (e.g., specific test scenarios,
edge cases to check in screenshot, specific game states to reach).
```

## Workflow

### Step 1: Understand the request

Parse what the user wants. If the request is vague, ask one clarifying question before
proceeding. Don't ask about things you can figure out from the codebase.

### Step 2: Research the codebase for context

Before writing the task, use Glob and Grep to find:
- Which files contain the relevant code
- Current behavior and implementation patterns
- Related systems that might be affected

This research becomes the **Context** section. Be specific — full file paths, function
names, type names.

### Step 3: Write the task file

Create the file at `backlog/todo/<kebab-case-slug>.md` using the format above.

**Naming convention:** Use a kebab-case slug derived from the imperative title.
- "Add card draw animations" → `add-card-draw-animations.md`
- "Fix tooltip clipping" → `fix-tooltip-clipping.md`

### Step 4: Confirm with the user

Print a summary:
```
Created: backlog/todo/<filename>.md
Title: <title>
Category: <category> | Priority: <priority>
Purpose: <one-line purpose>
```

## Priority Guidelines

- **high** — Broken functionality, crashes, blocking issues, things that make the game
  unplayable or confusing. Missing visual representations of game mechanics (invisible
  structures, missing feedback for active effects).
- **medium** — Missing features players explicitly ask for, noticeable UX friction,
  gameplay improvements, visual indicators for existing mechanics.
- **low** — Polish, nice-to-haves, aesthetic suggestions, animation refinements,
  minor visual tweaks.

## Category Definitions

- **bug** — Something that is broken or behaves incorrectly vs. its design intent
- **feature** — New functionality that doesn't exist yet
- **UX** — Improvements to how the player interacts with existing features
- **balance** — Tuning game values (damage, speed, costs, difficulty)
- **polish** — Visual/audio refinements that make existing features feel better

## Important

- Always research the codebase before writing Context. Never guess file paths.
- Acceptance criteria must be testable — if you can't verify it, rewrite it.
- The Validation section should always include the three standard checks from CLAUDE.md
  (build, test, screenshot) plus any task-specific checks.
- If the task requires reaching a non-obvious game state for verification, note that
  in Validation (e.g., "Must reach Region 2 boss fight to verify").
- Do not create duplicate tasks. Check existing items in `backlog/todo/`
  first.
