---
name: execute-tasks
description: >
  Execute all tasks in the backlog sequentially, respecting dependency order, with
  built-in validation gates and progress tracking. Use this skill whenever the user says
  "execute tasks", "run the tasks", "implement the tasks", "do the tasks", "execute the
  backlog", "start implementing", "go build these", or wants to systematically implement
  a set of backlog tasks that were produced by the breakdown-tasks skill. Also trigger when
  the user has just finished reviewing a task breakdown and says "looks good, go" or "ship
  these" or "start". Different from burn-backlog in that it respects task dependencies,
  uses EARS criteria for validation, and tracks progress across a coordinated task set
  rather than treating each task as independent.
---

# Execute Tasks

You are an autonomous task execution engine. You take a set of backlog tasks — typically
produced by the `breakdown-tasks` skill — and implement them in dependency order, one at
a time, with strict validation gates between each task.

Each task runs in an isolated subagent to keep context fresh. The main conversation stays
lightweight: it orchestrates, tracks progress, and handles failures.

---

## Setup

### 1. Load and analyze the backlog

Read all task files from `backlog/todo/`. Parse each file's metadata,
paying special attention to:

- **Depends-on** — which tasks must complete before this one can start
- **Sequence** — the intended order within a coordinated set
- **Priority** — high > medium > low
- **Category** — for grouping related work

### 2. Build the dependency graph

Tasks from the breakdown-tasks skill include `Depends-on` fields. Use these to build
an execution order that respects dependencies:

1. Tasks with no dependencies go first
2. Tasks whose dependencies are all satisfied go next
3. Continue until all tasks are scheduled

If there are cycles (A depends on B, B depends on A), flag them to the user and ask
how to resolve.

If tasks don't have `Depends-on` fields (e.g., they were created manually or by
create-task), fall back to priority ordering: high → medium → low, bugs before features
within the same priority.

### 3. Announce the execution plan

```
Execution Plan: 9 tasks
━━━━━━━━━━━━━━━━━━━━━━━

Phase 1 (no dependencies):
  1. [feature] add-mana-field-to-sim-unit

Phase 2 (depends on phase 1):
  2. [feature] implement-mana-generation-in-combat
  3. [feature] add-mana-bar-ui-component

Phase 3 (depends on phase 2):
  4. [feature] add-ability-cast-trigger
  5. [UX] add-mana-bar-to-unit-renderer

Phase 4 (depends on phase 3):
  6. [polish] add-ability-cast-animation
  7. [polish] add-ability-cast-sound

Phase 5 (depends on phase 4):
  8. [balance] tune-mana-generation-rates
  9. [UX] add-ability-tooltip-to-codex

Ready to execute? (Tasks within the same phase could run in parallel if desired.)
```

Wait for user confirmation before starting.

---

## The Execution Loop

### Step 1: Claim the task

Move the next eligible task from `todo/` to `in-progress/`:

```bash
mv backlog/todo/<task>.md backlog/in-progress/<task>.md
```

Print a clear header:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task 3/9: add-ability-cast-trigger [feature]
  Depends on: implement-mana-generation-in-combat ✓
  Phase: 3 of 5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 2: Pre-flight check

Before dispatching to a subagent, verify preconditions:

1. **Dependencies satisfied** — all tasks in the `Depends-on` list are in `done/`
2. **Build is clean** — run `cd app && npm run build` to ensure
   the codebase is in a good state before the subagent starts. If it's broken, stop
   and report — don't send a subagent into a broken codebase.
3. **Tests pass** — run `cd app && node test-game.cjs` as a
   baseline. If tests are already failing, stop and report.

This pre-flight exists because tasks build on each other. A failure in task 2 that
wasn't caught will cascade into task 3. Catching it here saves time.

### Step 3: Dispatch to subagent

Use the **Agent tool** (`subagent_type: "general-purpose"`) with a self-contained prompt.
The subagent gets everything it needs — it has no access to this conversation.

The subagent prompt must include:

1. **The full task file content** (copy-pasted, not a file path)
2. **Implementation instructions** (below)
3. **The task filename** (for commits and file moves)
4. **What changed in predecessor tasks** — include a summary of what each *direct*
   dependency changed (files modified, types added, APIs created). For deep chains
   (A → B → C), also include a one-line summary of transitive predecessors so the
   subagent knows about types/APIs introduced earlier in the chain. This gives the
   subagent the context it needs without requiring it to reverse-engineer the git history.

Subagent prompt template:

```
You are implementing a backlog task for the GnorpBuzz game (a tug-of-war auto-battler
at app/).

## Task File: <task-filename>.md

<paste full task file content>

## Predecessor Changes

Direct dependencies (read these files to understand the foundation):
<For each direct dependency, list:>
- <task-slug>: <1-2 sentence summary of what changed, key files and types affected>

Transitive predecessors (for awareness — types and APIs introduced earlier in the chain):
<For each earlier ancestor not listed above, one line:>
- <task-slug>: <key types/APIs it introduced>

## Instructions

### 1. Understand
Read the Context section files. The codebase may have evolved since the task was written.
If referenced files or functions don't exist, search for equivalents before proceeding.

Read any predecessor files mentioned above to understand the foundation you're building on.

### 2. Implement
Make the code changes. Follow existing patterns in the codebase. Keep changes minimal
and focused on exactly what the task describes.

### 3. Validate against acceptance criteria

The task has two key sections: "EARS Requirements" (the formal requirement patterns this
task satisfies) and "Acceptance Criteria" (the concrete, checkable pass/fail items).
Validate every item in Acceptance Criteria explicitly — these are your pass/fail gate:

**Build:**
cd app && npm run build
Fix any TypeScript errors and rebuild until clean.

**Tests:**
cd app && node test-game.cjs
Fix any test failures and rerun until all pass.

**Visual verification:**
pkill -f "vite" 2>/dev/null; cd app && npm run dev &
sleep 3
Screenshot http://localhost:5173 and verify against each visual acceptance criterion.
If the task affects a non-default screen, navigate there or automate reaching that state.
pkill -f "vite" 2>/dev/null

**Acceptance criteria check:** Go through each acceptance criterion one by one and
explicitly confirm it passes. Cross-reference against the EARS Requirements section to
make sure you haven't missed the intent behind any criterion. If any criterion fails
after your implementation, fix it before proceeding. Do not rationalize a failure as
acceptable.

### 4. Ship
Stage specific changed files (never git add -A or git add .), commit, and push:

git add <specific files>
git commit -m "$(cat <<'EOF'
<prefix>: <description>

Closes backlog item: <task-filename>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
git push

Use conventional commit prefixes (feat:, fix:, refactor:, chore:).
If push is rejected, pull with rebase and retry.

### 5. Complete
Move the task file to done:
mv backlog/in-progress/<task-filename>.md backlog/done/<task-filename>.md

Stage and commit the backlog move:
git add backlog/
git commit -m "$(cat <<'EOF'
chore: mark <task-filename> as done

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
git push

### 6. Report
At the end, report in this exact format:
RESULT: SUCCESS or RESULT: FAILED
FILES_CHANGED: <comma-separated list>
TYPES_ADDED: <any new types/interfaces created>
APIS_ADDED: <any new functions/methods exposed>
COMMIT: <short hash> — <commit message>
ERROR: <if failed, explain what went wrong>

### Failure handling
- You get 3 attempts to fix build/test failures
- If stuck after 3 attempts, move the task back to todo/, add a note explaining what
  went wrong, commit, push, and report RESULT: FAILED
- Make reasonable decisions for ambiguous details — don't stop to ask questions
```

### Step 4: Adversarial review (on SUCCESS only)

When the implementation subagent reports SUCCESS, spawn a **second subagent**
(`subagent_type: "code-reviewer"`) to independently verify the work. This reviewer
is adversarial — its job is to find reasons the task is NOT done.

The reviewer prompt must include:
1. The full task file content (same as the implementation agent got)
2. The list of files changed (from the implementation agent's report)
3. The commit hash

Use this template for the reviewer prompt:

```
You are an adversarial reviewer for a GnorpBuzz backlog task. Your job is to
independently verify that the implementation actually satisfies every acceptance
criterion. You are NOT the implementer — you are the skeptic. Assume nothing works
until you prove it does.

## Task File: <task-filename>.md

<paste full task file content>

## Implementation Claim

The implementer reports SUCCESS with these changes:
- Files changed: <FILES_CHANGED from implementation report>
- Types added: <TYPES_ADDED from implementation report>
- APIs added: <APIS_ADDED from implementation report>
- Commit: <COMMIT from implementation report>

## Review Instructions

### 1. Read the changed files
Read every file listed in FILES_CHANGED. Understand what actually changed (not what
the implementer claims changed).

### 2. Check each acceptance criterion
Go through EVERY acceptance criterion in the task file. For each one:
- Find concrete evidence in the code that it is satisfied
- If a criterion says "X should happen when Y", trace the code path to verify
- Don't trust comments or variable names — verify actual behavior

### 3. Check EARS requirements
Cross-reference acceptance criteria against the EARS Requirements section. Verify
the spirit of each requirement is met, not just the letter.

### 4. Build and test
cd app && npm run build
cd app && node test-game.cjs

Both must pass. If either fails, that's an automatic REJECT.

### 5. Visual verification (if task has visual impact)
If any acceptance criterion involves visual changes:
pkill -f "vite" 2>/dev/null; cd app && npm run dev &
sleep 3
Screenshot http://localhost:5173 and verify the visual criteria are actually met.
pkill -f "vite" 2>/dev/null

### 6. Verdict
Report in this exact format:

VERDICT: APPROVE or VERDICT: REJECT
CRITERIA_CHECKED: <number checked> / <total number>
ISSUES: <if REJECT, list each unmet criterion and why it fails>
NOTES: <any concerns, even if approving>

Rules:
- REJECT if ANY acceptance criterion is not met
- REJECT if build or tests fail
- REJECT if a visual criterion exists but the screenshot doesn't confirm it
- You may APPROVE with NOTES if you have minor concerns that don't violate criteria
- Be specific in ISSUES — say exactly what's wrong so the implementer can fix it
```

**If the reviewer returns APPROVE:**
The task passed adversarial review. Proceed to Step 5 (Process the result).

**If the reviewer returns REJECT:**
1. Print the rejection reason to the main context
2. Spawn a new implementation subagent with a fix prompt that includes:
   - The original task file content
   - The predecessor changes context
   - The reviewer's ISSUES (exactly what's wrong)
   - Instruction to fix ONLY the identified issues, not redo everything
3. After the fix subagent returns, run the adversarial reviewer AGAIN
4. Maximum 2 review cycles (implement → review → fix → review). If it still
   fails after 2 rejections, treat it as a failed task.

### Step 5: Process the result

When the task is done (approved by reviewer) or failed, parse the report and update
your tracking state.

**On success (approved):**
```
✓ Task 3/9: add-ability-cast-trigger (approved by reviewer)
  Changed: src/sim/CombatSystem.ts, src/sim/AbilitySystem.ts
  Added types: AbilityCastEvent, ManaThreshold
  Added APIs: AbilitySystem.tryCast(), CombatSystem.onAbilityCast()
  Commit: abc1234 — feat: add ability cast trigger on mana threshold
  Phase 3 progress: 1/2 complete
```

**On success after fix cycle:**
```
✓ Task 3/9: add-ability-cast-trigger (approved after 1 fix cycle)
  Changed: src/sim/CombatSystem.ts, src/sim/AbilitySystem.ts, src/sim/ManaPool.ts
  Added types: AbilityCastEvent, ManaThreshold
  Added APIs: AbilitySystem.tryCast(), CombatSystem.onAbilityCast()
  Commit: def5678 — feat: add ability cast trigger on mana threshold
  Phase 3 progress: 1/2 complete
```

Save the "Types Added" and "APIs Added" information — you'll pass this as predecessor
context to downstream tasks.

**On failure:**
```
✗ Task 3/9: add-ability-cast-trigger — FAILED
  Error: Build failure — AbilitySystem references ManaPool type that doesn't exist
  Task moved back to: backlog/todo/
  ⚠ Blocking: tasks 4, 5, 6, 7 depend on this
```

**On review rejection (max cycles exhausted):**
```
✗ Task 3/9: add-ability-cast-trigger — REJECTED (failed review 2x)
  Last issue: "tryCast() doesn't check mana threshold — always fires"
  Task moved back to: backlog/todo/
  ⚠ Blocking: tasks 4, 5, 6, 7 depend on this
```

### Step 6: Handle cascading failures

If a task fails, check whether downstream tasks depend on it:

- **No dependents** — skip it and continue with the next eligible task
- **Has dependents** — pause and report to the user:
  ```
  ⚠ Task 3 failed. This blocks 4 downstream tasks:
    4. add-ability-cast-trigger
    5. add-mana-bar-to-unit-renderer
    6. add-ability-cast-animation
    7. add-ability-cast-sound

  Options:
  a) Skip task 3 and all its dependents (continue with independent tasks)
  b) I'll investigate and retry task 3
  c) Stop execution
  ```

  Wait for the user's decision. Don't silently skip blocked tasks — the user needs
  to know their execution plan has changed.

  **When skipping dependents:** Leave skipped task files in `backlog/todo/`. They weren't
  attempted, so they stay in the queue for a future run. Add a note at the bottom of each
  skipped file: `<!-- Skipped: blocked by failed dependency <slug> on YYYY-MM-DD -->`

### Step 7: Next task

Move to the next eligible task (one whose dependencies are all in `done/`). Keep
going until:
- All tasks are done
- All remaining tasks are blocked by failures
- The user tells you to stop

---

## Progress Tracking

Maintain a mental model of the execution state:

```
Phase 1: ██████████ 1/1 complete
Phase 2: █████░░░░░ 1/2 complete (1 in progress)
Phase 3: ░░░░░░░░░░ 0/2 (blocked on phase 2)
Phase 4: ░░░░░░░░░░ 0/2 (blocked on phase 3)
Phase 5: ░░░░░░░░░░ 0/2 (blocked on phase 4)
```

After every task completion or failure, print a brief progress update.

---

## Final Summary

After all tasks are processed:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Execution Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Completed: 6/9 (4 first-pass, 2 after fix cycle)
Failed:    1/9 (add-ability-cast-trigger — ManaPool type missing)
Rejected:  1/9 (add-mana-bar-ui — failed review 2x, overflow at small viewports)
Skipped:   1/9 (add-ability-cast-animation — blocked by failed dependency)

Commits pushed: 8
Files changed: 23
Review stats: 8 reviews, 3 rejections caught, 2 fixed

Dependency chain status:
  Phase 1: ✓ complete
  Phase 2: ✓ complete
  Phase 3: ✗ partial (1 of 2 failed)
  Phase 4: ✗ skipped (blocked)
  Phase 5: ✓ complete (independent tasks only)
```

---

## Principles

- **Dependencies are contracts.** If task B depends on task A, task A's outputs (types,
  APIs, file changes) become task B's inputs. Pass this context forward explicitly so
  subagents don't have to reverse-engineer what changed.

- **Pre-flight prevents cascades.** Checking build + tests before each task catches
  problems early. A broken codebase should never be handed to a subagent.

- **Failures are loud, not silent.** When a task fails and blocks downstream work,
  stop and tell the user. Silent skipping leads to surprise gaps.

- **Context stays fresh.** Each task runs in an isolated subagent. The main loop only
  tracks: task names, dependencies, completion status, and predecessor summaries. No
  implementation details leak between tasks.

- **Acceptance criteria are the contract.** The breakdown-tasks skill derived acceptance
  criteria from EARS-structured requirements. The subagent validates against each criterion
  explicitly and cross-references the EARS requirements to ensure the spirit is met, not
  just the letter.

- **One task, one commit.** Clean git history. Easy to revert. Easy to bisect.
