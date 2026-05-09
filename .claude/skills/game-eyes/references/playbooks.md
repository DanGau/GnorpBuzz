# Custom Playbooks & Action Reference

Write a JSON array of actions and pipe it to the script:

```bash
node .claude/skills/game-eyes/scripts/eye.cjs play - << 'EYES'
[
  {"action": "screenshot", "name": "initial"},
  {"action": "click", "x": 800, "y": 450},
  {"action": "wait", "ms": 500},
  {"action": "screenshot", "name": "after-click"}
]
EYES
```

Output is JSON:

```json
{
  "ok": true,
  "screenshots": ["path/to/001-initial.png", "..."],
  "results": [],
  "log": ["[1/4] screenshot — 30 ms", "..."],
  "duration_ms": 1200,
  "session": "path/to/session-dir"
}
```

## Action Reference

### Screenshots & State

| Action       | Params                      | Description                        |
|--------------|-----------------------------|------------------------------------|
| `screenshot` | `name`                      | Capture & archive a PNG            |
| `debug`      | `cmd`, `args[]`             | Call `window.debug.<cmd>(...args)` |
| `eval`       | `expression`                | Evaluate arbitrary JS, return value|

### Player Input

| Action     | Params                                | Description                    |
|------------|---------------------------------------|--------------------------------|
| `click`    | `x`, `y`                              | Left-click at viewport coords  |
| `dblclick` | `x`, `y`                              | Double-click                   |
| `move`     | `x`, `y`                              | Move mouse (hover)             |
| `drag`     | `from: {x,y}`, `to: {x,y}`, `steps?`  | Drag from A to B               |
| `scroll`   | `x?`, `y?`, `deltaX`, `deltaY`        | Mouse wheel                    |
| `key`      | `key` (Enter/Escape/a/Space/…)        | Press a key                    |
| `type`     | `text`                                | Type string, char by char      |

### Flow Control

| Action    | Params                   | Description                        |
|-----------|--------------------------|------------------------------------|
| `wait`    | `ms`                     | Sleep N milliseconds               |
| `waitFor` | `expression`, `timeout?` | Poll until JS expression is truthy |
| `reload`  | —                        | Re-navigate to the game URL        |

### Tick Control

| Action          | Params                                                | Description                                     |
|-----------------|-------------------------------------------------------|-------------------------------------------------|
| `step`          | `count?`, `name?`                                     | Pause + advance N ticks + render + screenshot   |
| `step-sequence` | `ticksPerStep?`, `numSteps?`, `name?`                 | Run N steps, screenshot each                    |
| `step-until`    | `expression`, `ticksPerStep?`, `maxTicks?`, `name?`   | Step until JS expression is truthy              |

**Viewport:** 1600 x 900. Origin (0,0) is top-left.

## Individual CLI Commands

```bash
node eye.cjs start                      # Pre-warm (optional)
node eye.cjs stop                       # Kill Chrome
node eye.cjs stop --all                 # Kill Chrome + dev server
node eye.cjs status                     # What's running?
node eye.cjs screenshot my-shot         # Take one screenshot
node eye.cjs debug snapshot             # Run debug command
node eye.cjs click 400 300              # Click at coords
node eye.cjs key Escape                 # Press key
node eye.cjs eval "window.debug.snapshot()"
```

## Debug Interface

The game exposes commands via `window.debug` (defined in `app/src/game/Game.ts`).
At minimum it provides: `snapshot()`, `pause()`, `resume()`, `advanceTicks(n)`,
`stepAndRender(n)`, `screenshot(name)`. Game-specific commands are added there as the
game grows.
