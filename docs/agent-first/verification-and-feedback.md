# Verification & Feedback: The EARS Framework

The single highest-leverage thing you can do for agent productivity is **give the agent a way to verify its own work.** Without verification tools, you — the human — become the only feedback loop, and every change requires a manual review cycle.

> "Give Claude a way to verify its work. Include tests, screenshots, or expected outputs so Claude can check itself." — Anthropic Official Docs
>
> "Give the Agent Eyes." — OpenAI Harness Engineering, Principle 4

Both OpenAI and Anthropic independently arrived at the same conclusion: agents need sensory feedback loops. OpenAI calls this "giving the agent eyes." At Quartermaster, we extend this into the **EARS** framework — **Eyes, Ears (Audio), and InSpect** — three complementary verification channels that together provide comprehensive change confidence.

---

## Eyes: Visual Verification

Agents can see. Browser automation tools let agents launch the application, interact with it, and take screenshots to visually verify that changes look correct.

**Why this matters:**
- Layout bugs, color mismatches, and rendering glitches are invisible to unit tests
- A screenshot is worth a thousand assertions for UI work
- Agents can take before/after screenshots to compare visual impact
- Visual verification catches the "it compiles but looks wrong" class of bugs

**Implementation patterns:**
- **Playwright** or **Puppeteer** for browser automation — launch, navigate, interact, screenshot
- **Chrome DevTools Protocol** for DOM snapshots, console access, and network monitoring
- **Camera presets** and **gallery modes** to reach specific visual states programmatically
- **Headed mode** for real-time visual debugging when needed

**OpenAI's approach:** Their Codex team wired Chrome DevTools Protocol into agent runtimes, enabling DOM snapshots, screenshots, and page navigation. Agents regularly sustained 6+ hour focused sessions with this visual feedback.

**Anthropic's approach:** "Take a screenshot of the result and compare it to the original. List differences and fix them." Screenshot → vision analysis → fix loop.

---

## Ears: Audio Verification

For applications with audio (games, media apps, accessibility features), agents need tools to verify what they hear — or more precisely, what the audio system produces.

**Why this matters:**
- Volume balance, playback timing, and sound selection can't be verified by reading code
- Audio bugs are subtle — a sound might play but be drowned out, duplicated, or missing its cooldown
- Without audio verification, sound-related changes require manual playtesting

**Implementation patterns:**
- **Static loudness analysis** — scan audio files for volume outliers relative to category medians
- **Runtime sound logging** — log every play attempt with timestamps, volumes, categories
- **Sound statistics** — aggregate play counts, skip rates, cooldown hits per sound
- **Volume correction suggestions** — automated recommendations for rebalancing

---

## InSpect: State Verification

The deepest verification layer: direct programmatic access to application state. Agents can query, manipulate, and assert on internal state without going through the UI.

**Why this matters:**
- Visual and audio verification confirm output; state inspection confirms the underlying model
- State manipulation lets agents drive the application into specific test scenarios
- Deterministic state queries enable automated assertions
- Critical for testing edge cases that are hard to reach through normal interaction

**Implementation patterns:**
- **Debug interface** exposed on `window.debug` (or equivalent) with commands for state inspection and manipulation
- **State dumps** — serialize full application state for snapshot comparison
- **Programmatic manipulation** — spawn entities, set resources, trigger phases, force outcomes
- **Frame stepping** — advance the simulation by specific frame counts for deterministic testing

---

## The Three-Layer Verification Stack

These three channels work together. Each catches different classes of bugs:

| Layer | Catches | Misses |
|-------|---------|--------|
| **Eyes** (visual) | Layout bugs, rendering glitches, color/style issues | Logic errors, audio issues, internal state corruption |
| **Ears** (audio) | Volume imbalances, missing sounds, playback timing | Visual bugs, state corruption, logic errors |
| **InSpect** (state) | Logic errors, state corruption, incorrect calculations | Visual presentation, audio experience |

A verification checklist should require all three:

1. **Build** — zero compilation errors (catches type-level bugs)
2. **Test** — integration tests pass (catches behavioral regressions)
3. **Screenshot** — visual inspection confirms changes look correct (catches presentation bugs)
4. **Audio audit** — sound analysis confirms balance (catches audio regressions, when applicable)

---

## Test-Driven Development as Verification

TDD is a natural fit for agent-first engineering. Tests are the primary feedback loop.

> "Starting every session with 'use red-green TDD' (just five tokens) dramatically improves agent reliability." — Simon Willison

**Key patterns:**
- **Write tests by hand, let agents implement.** Tests encode the requirements; agents code against them.
- **Conformance-driven development.** Build test suites that pass across implementations, then have agents implement new versions against these conformance tests.
- **Bounded iteration.** Stripe enforces "at most two CI runs" per agent attempt. If code doesn't pass after the second push, it returns to a human. Diminishing returns are real.

**Aggressive CI catches approximately 15% of agent-generated code** that would have introduced bugs (Stripe data).

---

## When Verification Fails, Fix the Environment

When an agent produces incorrect output despite having verification tools, the instinct is to prompt harder. Resist this.

Instead, ask: **what capability is missing?**

- Agent can't verify visual output → add screenshot tooling
- Agent can't tell if audio is balanced → add loudness analysis
- Agent keeps making the same state error → add a targeted integration test
- Agent doesn't know the expected behavior → add a spec or acceptance criteria

Each verification gap you fill compounds. The codebase becomes more agent-friendly over time, and every future agent session benefits.
