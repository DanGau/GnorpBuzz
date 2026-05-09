---
name: game-eyes
description: Visual verification and game interaction through Chrome DevTools Protocol (CDP). Use this skill after ANY change that affects what the player sees — sprites, animations, layout, colors, particles, HUD, text, camera, scene changes. Also use when you need to test game interactions (clicks, keys, drags) or when the user asks you to look at, check, verify, or screenshot the running game. If you changed something visual, you MUST use this skill to verify it. A screenshot takes seconds and catches bugs that code review cannot.
---

# Game Eyes

Visual verification and game interaction via raw CDP. One script handles everything: Chrome lifecycle, dev server, navigation, screenshots, debug commands, and player-input simulation (mouse, keyboard, drag, scroll).

All output is JSON. All screenshots are archived by git branch/commit/session.

## Quick Start

```bash
node .claude/skills/game-eyes/scripts/eye.cjs verify-quick
```

Auto-starts Chrome and the Vite dev server if needed. Output JSON has a `screenshots` array — use the **Read** tool on each path to view them.

## Common Commands

| Goal | Command |
|------|---------|
| Take a screenshot of the game | `verify-quick` |
| One-off screenshot | `screenshot <name>` |
| Run a single `window.debug.X(...)` call | `debug <cmd> [args...]` |
| Click at viewport coords | `click <x> <y>` |
| Press a key | `key <name>` |
| Evaluate JS in the game context | `eval "<expr>"` |
| Pause + step N ticks + screenshot | `step [n] [name]` |
| Step N times, screenshot each | `step-sequence [tps] [n]` |
| Step until condition met | `step-until "<expr>"` |

Read `references/playbooks.md` for the full action catalog and JSON playbook syntax.

## Verification Workflow

1. **Build** — `cd app && npm run build`
2. **Screenshot** — `node .claude/skills/game-eyes/scripts/eye.cjs verify-quick`
3. **Read** — use the Read tool on each screenshot path to visually confirm
4. If something looks wrong, fix and repeat

## Screenshot Archive

Saved to `app/screenshots/{branch}/{commit}/{session-timestamp}/` with a `session.json` manifest. Compare across commits by browsing the archive.

## Tick Control

For frame-by-frame control (precise timing, animation verification):

```bash
node .claude/skills/game-eyes/scripts/eye.cjs step [n] [name]
```

Pauses the game, advances `n` ticks, renders, screenshots, returns a state snapshot. See the `tick-control` skill for patterns.

## Environment

- Auto-starts Chrome (headless) and Vite dev server — no manual setup
- Persists between commands for speed; `stop` to clean up
- Ports: CDP 9222, dev 5173 (configurable via `EYE_CDP_PORT`, `EYE_DEV_PORT`)
- Locates Chrome via Playwright's managed Chromium first, then system Chrome
