# Claude Code Instructions for GnorpBuzz

GnorpBuzz is a 2D web-app game built on PixiJS. The codebase is set up for agent-first
development: Claude is expected to **verify all changes** before considering work done.

## How We Work

The project gives Claude eyes and inspection capabilities — use them.

- **Eyes:** Chrome DevTools Protocol + screenshots to visually verify the game
  (`.claude/skills/game-eyes`).
- **Tick control:** Pause/advance the engine frame-by-frame for deterministic capture
  (`.claude/skills/tick-control`).
- **Inspect:** Debug interface exposed at `window.debug` — snapshot state, advance ticks,
  call game-specific commands.

## Verification Checklist (MUST FOLLOW)

After any code change to `app/`:

1. **Build** — `cd app && npm run build` — zero TypeScript errors
2. **Test** — `cd app && node test-game.cjs` — integration harness boots the real game
3. **Screenshot** — Run `node .claude/skills/game-eyes/scripts/eye.cjs verify-quick`,
   then read each returned PNG path to visually confirm the change

If a feature isn't reachable from the default state, drive the game to it via `window.debug`
or by adding a step to `test-game.cjs`.

Do not skip steps. The Stop hook (`.claude/hooks/enforce-verification.mjs`) blocks
session-end if game files were edited without build + screenshot evidence.

## Architecture

- `app/` — the game (Vite + TypeScript + Pixi.js v8)
- `app/src/game/Game.ts` — Pixi `Application`, ticker-driven `update(deltaMS)`,
  `manualUpdate(deltaMS)` for headless stepping, and `attachDebugInterface()` exposing
  `window.debug`
- `app/test-game.cjs` — Playwright harness that spawns Vite + Chromium and asserts
  `window.debug` is reachable
- `.claude/skills/` — agent-facing tooling
- `docs/agent-first/` — principles behind the harness

Read `docs/agent-first/principles.md` for the philosophy this repo is built on.
