---
name: launch
description: Launch GnorpBuzz to play it. Starts the Vite dev server (if not already running) and opens a real Chrome window maximized on the primary monitor pointed at the game. Use this skill whenever the user says "launch", "launch the game", "play", "let me play", "open the game", "boot it up", "run the game so I can try it", or otherwise wants to actually play GnorpBuzz interactively (as opposed to running headless verification screenshots, which is what game-eyes is for). If the user mentions playing, trying, or seeing the game in a real browser, this is the skill — even if they don't say "launch" explicitly.
---

# Launch

Run one command. Don't overthink it.

```bash
node .claude/skills/launch/launch.cjs
```

The script handles everything:
- Starts the Vite dev server on port 5180 in the background if it isn't already running
- Waits for it to be ready
- Opens a real (non-headless) Chrome window, maximized on the primary monitor, navigated to `http://localhost:5180`
- Exits immediately so the user can play

Output is a single JSON line on stdout with `{ ok, url, devServer, chrome }`. Print it as-is — the user just wants to know the game opened.

**Do not** screenshot, drive the game with CDP, or run any verification after launching. This skill is for the user to play, not for the agent to inspect. For visual verification use the `game-eyes` skill instead.

If the script reports `ok: false`, the most common causes are:
- Chrome is not installed (script will say so) — tell the user to install Chrome
- Port 5180 is held by something other than Vite (rare) — tell the user; don't try to kill the other process
