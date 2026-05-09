---
name: burn-backlog
description: "Process and ship every item in the backlog, one at a time. Picks up the highest-priority task, implements it, validates it (build + tests + screenshot), commits, pushes, and moves on to the next task until the backlog is empty. Use this skill whenever the user says 'burn the backlog', 'work through the backlog', 'process the backlog', 'clear the backlog', 'do the backlog', 'grind through tasks', or generally wants to systematically knock out all pending backlog items without hand-holding."
---

# Burn Backlog

You are an autonomous backlog-processing orchestrator. Your job is to work through every task in the backlog from highest to lowest priority. **Each task is fully implemented inside a subagent** so the main conversation context stays clean and doesn't rot over time.

## Setup

### 1. Load the backlog

Read all task files from `backlog/todo/`. Each is a markdown file with structured frontmatter (Category, Priority, Scene) and sections (Purpose, Context, Description, Acceptance Criteria, Validation).

### 2. Sort by priority

Process tasks in this order:
1. **high** priority first
2. **medium** priority next
3. **low** priority last

Within the same priority level, process in whatever order makes sense (e.g., bugs before features, or tasks in the same scene grouped together to reduce context-switching).

### 3. Announce the plan

Before starting, print a numbered list of every task in processing order so the user can see what's coming. Something like:

```
Backlog: 24 tasks (2 high, 14 medium, 8 low)

1. [high] fix-feedback-textbox-cursor-drift
2. [high] make-ranged-units-target-enemy-base
3. [medium] remove-upgrade-army-button
...
```

## The Loop

For each task, do these steps **in the main context** (lightweight orchestration only):

### Step 1: Claim the task

Move the task file from `backlog/todo/` to `backlog/in-progress/`:

```bash
mv backlog/todo/<task>.md backlog/in-progress/<task>.md
```

Print a clear header so the user can follow along:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Task 3/24: remove-upgrade-army-button [medium]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 2: Read the task file

Read the task file content. You need the full text to pass to the subagent.

### Step 3: Dispatch to subagent

Use the **Agent tool** (`subagent_type: "general-purpose"`) to handle the entire implementation. Pass it a self-contained prompt that includes:

1. The full task file content (copy-pasted into the prompt)
2. The complete implementation + validation + shipping instructions (below)
3. The task filename (for commit messages and backlog moves)

The subagent prompt must contain everything the subagent needs — it does NOT have access to this conversation's context. Use this template:

```
You are implementing a backlog task for the GnorpBuzz game (a 2D PixiJS web game in app/).

## Task File: <task-filename>.md

<paste full task file content here>

## Instructions

### 1. Understand the task
Read the Context section files to understand the current code. The codebase may have evolved since the task was written — if referenced files/functions don't exist, search for equivalents.

### 2. Implement
Make the code changes. Follow existing patterns. Keep changes minimal and focused.

### 3. Validate

**Build:**
cd app && npm run build
Fix any TypeScript errors and rebuild until clean.

**Tests:**
cd app && node test-game.cjs
Fix any test failures and rerun until all pass.

**Visual verification:**
pkill -f "vite" 2>/dev/null; cd app && npm run dev &
sleep 3
Screenshot http://localhost:5173 and verify the UI looks correct. If the task affects a non-default screen, navigate to it or automate reaching that state.
pkill -f "vite" 2>/dev/null

**Check acceptance criteria:** Verify each criterion from the task file is met.

### 4. Ship
Stage specific changed files (never git add -A or git add .), commit, and push:

git add <specific files>
git commit -m "$(cat <<'EOF'
<prefix>: <description>

Closes backlog item: <task-filename>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
git push

Use conventional commit prefixes (feat:, fix:, refactor:, chore:). If push is rejected, pull with rebase and retry.

### 5. Complete
Move the task file to done:
mv backlog/in-progress/<task-filename>.md backlog/done/<task-filename>.md

Stage and commit the backlog move:
git add backlog/
git commit -m "$(cat <<'EOF'
chore: mark <task-filename> as done

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
git push

### 6. Report back
At the end, report a summary in this exact format:
RESULT: SUCCESS or RESULT: FAILED
FILES_CHANGED: <comma-separated list of changed files>
COMMIT: <short hash> — <commit message>
ERROR: <if failed, explain what went wrong>

### Failure handling
- You get 3 attempts to fix build/test failures
- If stuck after 3 attempts, move the task back to backlog/todo/, add a note at the bottom explaining what went wrong, commit, push, and report RESULT: FAILED
- Make reasonable decisions for ambiguous tasks — don't stop to ask questions
```

### Step 4: Adversarial review (on SUCCESS only)

When the implementation subagent reports SUCCESS, spawn a **second subagent** (`subagent_type: "code-reviewer"`) to independently verify the work. This reviewer is adversarial — its job is to find reasons the task is NOT done.

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

### 3. Build and test
cd app && npm run build
cd app && node test-game.cjs

Both must pass. If either fails, that's an automatic REJECT.

### 4. Visual verification (if task has visual impact)
If any acceptance criterion involves visual changes:
pkill -f "vite" 2>/dev/null; cd app && npm run dev &
sleep 3
Screenshot http://localhost:5173 and verify the visual criteria are actually met.
pkill -f "vite" 2>/dev/null

### 5. Verdict
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
1. Print the rejection reason to the main context:
   ```
   ⚠ Review REJECTED: remove-upgrade-army-button
     Issues: "Button removed from PlanningOverlay but keyboard shortcut 'U'
     still triggers upgradeArmy() — acceptance criterion 2 not met"
     Sending back for fix...
   ```
2. Spawn a new implementation subagent with a fix prompt that includes:
   - The original task file content
   - The reviewer's ISSUES (exactly what's wrong)
   - Instruction to fix ONLY the identified issues, not redo everything
3. After the fix subagent returns, run the adversarial reviewer AGAIN
4. Maximum 2 review cycles (implement → review → fix → review). If it still
   fails after 2 rejections, treat it as a failed task (move back to todo/).

### Step 5: Process the result

When the task is done (approved by reviewer) or failed, print a brief summary in the main context:

**On success (approved):**
```
✓ Done: remove-upgrade-army-button (approved by reviewer)
  Changed: src/ui/PlanningOverlay.ts, src/scenes/BattleScene.ts
  Commit: abc1234 — chore: remove obsolete Upgrade Army button
  Progress: 3/24 complete
```

**On success after fix cycle:**
```
✓ Done: remove-upgrade-army-button (approved after 1 fix cycle)
  Changed: src/ui/PlanningOverlay.ts, src/scenes/BattleScene.ts, src/input/KeyBindings.ts
  Commit: def5678 — chore: remove upgrade army button and keybind
  Progress: 3/24 complete
```

**On failure/skip:**
```
✗ SKIPPED: add-beam-in-spawn-animation — Build failure after 3 attempts (missing BeamInEffect module)
  Progress: 3/24 (2 complete, 1 skipped)
```

**On review rejection (max cycles exhausted):**
```
✗ REJECTED: fix-mana-bar-alignment — Failed adversarial review 2x
  Last issue: "Mana bar still overflows container at <640px viewport width"
  Progress: 3/24 (2 complete, 1 rejected)
```

Track completed, skipped, and rejected counts for the final summary.

### Step 6: Next task

Go back to Step 1 with the next task. Keep going until the backlog is empty.

**IMPORTANT:** Do NOT carry implementation details from one task to the next. The subagent handles everything. Your main loop should only track: task names, completion status, and progress counts.

## When You're Done

After processing all tasks, print a final summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backlog Burn Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Completed: 20/24 (14 first-pass, 6 after fix cycle)
Skipped:   2/24
  - add-beam-in-spawn-animation (build failure)
  - decouple-camera-speed-from-game-speed (unclear requirements)
Rejected:  2/24
  - fix-mana-bar-alignment (failed review 2x — viewport overflow)
  - add-tooltip-hover (failed review 2x — missing keyboard nav)

Commits pushed: 26
Review stats: 24 reviews, 8 rejections caught, 6 fixed
```

## Principles

- **Context isolation.** Each task runs in a fresh subagent. The main context only orchestrates. This prevents context rot across many tasks.
- **Be autonomous.** The user said "burn the backlog" and walked away. Don't stop to ask questions. Make reasonable decisions and keep moving.
- **One task, one commit.** Each backlog item gets its own commit with a clear message. This keeps the git history clean and makes it easy to revert individual changes.
- **Minimal changes.** Do exactly what the task says. Don't refactor nearby code, don't add features that weren't requested, don't "improve" things along the way. Stay focused.
- **Forward progress over perfection.** If a task is taking too long or is genuinely stuck, skip it and move on. Completing 22 of 24 tasks is better than getting stuck on task 3.
- **Validate everything.** Build, test, screenshot — every single task. No exceptions. A shipped bug is worse than a skipped task.
