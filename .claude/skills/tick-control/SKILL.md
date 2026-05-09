---
name: tick-control
description: Precise tick-by-tick control of the GnorpBuzz game engine. Use this skill whenever you need to observe game state frame by frame, verify animations or timing-sensitive behavior, watch a sequence unfold step by step, or take screenshots at exact moments. Also use when the game is running too fast to screenshot reliably, when you need deterministic frame-advancing for testing, or when verifying that something happens at a specific tick. If you're about to take a screenshot of something that moves or changes quickly, use tick control instead of hoping you catch the right frame.
---

# Tick Control

Control the game engine tick by tick. The game runs at 60 FPS — without tick control, a screenshot captures a random frame. With it, you control exactly when time advances and what you see.

All commands use eye.cjs:
```
node .claude/skills/game-eyes/scripts/eye.cjs <subcommand>
```

## Commands

### `step` — advance and screenshot once

```bash
node .claude/skills/game-eyes/scripts/eye.cjs step [ticks] [name]
```

Pauses the game, advances `ticks` frames (default 1, each ~16.67ms at 60fps), renders, screenshots, returns snapshot + screenshot path.

### `step-sequence` — advance and screenshot N times

```bash
node .claude/skills/game-eyes/scripts/eye.cjs step-sequence [ticks-per-step] [num-steps] [name]
```

Runs `num-steps` iterations of step, screenshotting each. Returns a `frames` array.

**Example:** Watch 5 seconds of game time in 0.5s increments:
```bash
node .claude/skills/game-eyes/scripts/eye.cjs step-sequence 30 10 replay
# Returns 10 frames, each 30 ticks apart (0.5s game time)
```

### `step-until` — advance until a condition is met

```bash
node .claude/skills/game-eyes/scripts/eye.cjs step-until "<js-expression>" [ticks-per-step] [max-ticks] [name]
```

Steps repeatedly until the JS expression evaluates truthy in the game context. Screenshots at checkpoints (~10 evenly spaced) and on the final match. Returns `conditionMet: true/false` and all captured frames.

**Example:** Step until a state condition holds:
```bash
node .claude/skills/game-eyes/scripts/eye.cjs step-until "window.debug.snapshot().tick > 600" 5 1200 wait-for-tick
```

## Output Format

Single step:
```json
{
  "snapshot": { "tick": 1234, "paused": true, ... },
  "screenshot": "/path/to/screenshot.png"
}
```

Sequence and until commands return `{ frames: [...] }`.

## Playbook Integration

```json
[
  { "action": "step-sequence", "ticksPerStep": 30, "numSteps": 10, "name": "replay" },
  { "action": "step-until", "expression": "window.debug.snapshot().tick > 600", "ticksPerStep": 10, "maxTicks": 1200, "name": "wait" }
]
```

## Time Math (60 FPS)

| Game time     | Ticks |
|---------------|-------|
| 1 frame       | 1     |
| 100ms         | 6     |
| 0.5 seconds   | 30    |
| 1 second      | 60    |
| 5 seconds     | 300   |
| 10 seconds    | 600   |

## Low-Level Debug Commands

Available via `node eye.cjs debug <cmd> [args]`:

| Command              | Effect                                      |
|----------------------|---------------------------------------------|
| `pause`              | Stop the ticker                             |
| `resume`             | Restart the ticker                          |
| `advanceTicks <n>`   | Advance n frames (no render, no snapshot)   |
| `render`             | Force-paint the canvas                      |
| `stepAndRender <n>`  | Advance + render + return snapshot          |
| `snapshot`           | Return state without advancing              |

## Why This Matters

CDP screenshot takes 50–200ms. At 60 FPS, several frames pass during that call — you can't control which frame you get. Tick control freezes the game, advances exactly the ticks you specify, renders synchronously, then screenshots the known state.
