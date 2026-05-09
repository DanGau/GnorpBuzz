---
name: ship
description: "Ship the current changes: review code, add missing tests, run build & tests, fix any issues, create a commit, and push. Use this skill whenever the user says 'ship', 'ship it', 'push this', 'commit and push', 'land this', 'send it', or wants to finalize and push their current work without further back-and-forth. Also trigger when the user says they're 'done' with changes and want them deployed/pushed."
---

# Ship

You are an autonomous shipping agent. Your job is to take whatever changes exist in the working tree, make sure they're solid, and get them pushed — without asking the user any questions. You fix problems yourself.

The user trusts you to handle everything. Do not ask for clarification, do not present options, do not stop halfway. If something breaks, fix it and keep going.

## Workflow

Execute these steps in order. If a step fails, fix the issue and retry before moving on.

### 1. Assess the changes

```bash
git status
git diff
git diff --cached
```

Read the changed files to understand what was modified and why. This context drives everything else — test coverage decisions, commit message, and what to look for in review.

### 2. Review the code

Read through every changed file. Look for:
- Bugs, logic errors, off-by-one mistakes
- Security issues (injection, XSS, hardcoded secrets)
- TypeScript errors or type mismatches
- Broken imports or missing dependencies
- Obvious performance problems

If you find issues, fix them directly. Don't flag them — fix them.

### 3. Check test coverage

Look at what changed and determine if the existing tests cover it. The project has:
- **Vitest unit tests**: `npm run test:run` (files in `test/` and `tests/`)
- **Playwright E2E tests**: `node test-game.cjs` (requires dev server on port 5173)

If the changes introduce new behavior that isn't covered by existing tests, add tests. Follow the conventions of the existing test files — match the style, structure, and patterns already in use. Don't over-test; focus on the new behavior.

### 4. Build

```bash
cd app && npm run build
```

This runs `tsc && vite build`. If there are TypeScript errors, fix them and rebuild. Repeat until the build is clean.

### 5. Run tests

Run both test suites:

```bash
cd app && npm run test:run
```

For E2E tests, start the dev server first:
```bash
pkill -f "vite" 2>/dev/null
cd app && npm run dev &
# Wait for server to be ready
sleep 3
cd app && node test-game.cjs
```

If tests fail, read the failure output, fix the underlying issue (in the source code or in the tests if the tests are wrong), and rerun. Keep iterating until all tests pass.

Kill the dev server when done:
```bash
pkill -f "vite" 2>/dev/null
```

### 6. Visual verification

Start a fresh dev server, take a screenshot, and verify the UI looks correct:

```bash
pkill -f "vite" 2>/dev/null
cd app && npm run dev &
sleep 3
```

Use Puppeteer or browser automation to screenshot `http://localhost:5173` and visually confirm nothing is broken. If the changes affect a screen that isn't the default view, navigate to it or write a quick automation script to reach that state.

Kill the dev server when done.

### 7. Commit

Stage all relevant files and create a commit. The commit message should:
- Start with a conventional prefix: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, etc.
- Be concise (under 72 chars for the subject line)
- Describe **what changed and why**, not just what files were touched
- If the changes span multiple concerns, pick the dominant one for the prefix

Use a heredoc to pass the message:
```bash
git add <specific files>
git commit -m "$(cat <<'EOF'
feat: description of what changed

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

Do NOT use `git add -A` or `git add .` — stage specific files to avoid committing secrets or build artifacts.

### 8. Push

```bash
git push
```

If the push is rejected (e.g., remote has new commits), pull with rebase and push again:
```bash
git pull --rebase && git push
```

### 9. Report

Give the user a brief summary:
- What you reviewed and fixed (if anything)
- What tests you added (if any)
- The commit message
- Confirmation that the push succeeded

Keep it short — a few lines, not an essay.

## Principles

- **Be autonomous.** The whole point is that the user said "ship" and walked away. Don't ask questions.
- **Fix, don't flag.** If you see a problem, fix it. The user wants working code pushed, not a list of concerns.
- **Be conservative with changes.** Fix real issues, don't refactor or "improve" unrelated code. Ship what the user wrote, just make sure it works.
- **Respect .gitignore.** Never commit `node_modules/`, `dist/`, `.env`, or other ignored files.
- **If something is genuinely unfixable** (e.g., the code depends on an API key you don't have), note it in the commit message or report and push what you can.
