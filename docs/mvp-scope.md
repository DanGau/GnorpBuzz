# MVP Scope

The minimum slice that proves the core loop end-to-end. Everything outside this is parked.

## Scope (revised after first-play feedback)

**Phase 1, agent-driven, deliberate progression.** The MVP runs from new-game through:

1. Game loads into an empty colony — one Forager Hive, one Wax Hive, no bees, vacant vessel pad.
2. Player buys their first Forager Bee (FREE). It flies out and harvests pollen.
3. Player buys their first Wax-maker Bee (FREE). It fetches pollen, produces wax, carries blocks to the vessel.
4. Player buys additional bees with wax to scale the colony (each bee costs more than the last).
5. After 8 blocks delivered, the airplane assembles and glows.
6. **Player clicks the airplane** to launch it. Auto-launch is intentionally absent.
7. Vessel ascends → crashes.
8. Scientist Bee writes the first journal entry.
9. End of MVP.

The full agent-behavior model is in `docs/agent-behavior.md`.

**Out of scope for MVP:**

- Nectar, Bloomshard.
- Builder / Scientist / Engineer hive types.
- Queen upgrades, collection upgrades, hive upgrades — no upgrade tree at all yet.
- Tier 2+ vessels, conversion ratios, refineries, in-flight performance.
- Active nectar-flower mini-event.
- Multiple journal entries; just the first.

**In scope (added in the pivot):**

- Pollen as a visible Phase 1 resource.
- Single Forager Hive and single Wax Hive (fixed structures); player scales by buying bees.
- First bee of each type is free; subsequent bees cost wax with exponential growth.
- Flowers as harvest sites with yield + regrow.
- Bee state machines (forager and wax-maker, see `docs/agent-behavior.md`).
- Discrete wax-block delivery to the vessel.
- Click-to-launch: player must click the assembled airplane to send it.

**Removed from earlier MVP iterations:**

- Queen / auto-spawning. Bees only enter the colony via player purchase.
- Slot caps on hives. Hives hold as many bees as the player has bought.
- Buying additional hives. Only one of each type exists.

## Technical decisions

| Decision | Choice |
|----------|--------|
| UI approach | **Hybrid** — Pixi for world (meadow, bees, vessel, sky, flower), HTML/CSS overlay for resource counters, buy buttons, journal modal |
| Save | **Local storage**, **on-action** (every meaningful state change writes) |
| Offline progress | **None** for MVP — game ticks only while tab is open |
| Tuning approach | **Guess values; tune after** the loop is playable |

## First-pass Phase 1 numbers (single-hive, click-to-launch model)

- **Forager round-trip:** ~10 sec/pollen (varies with flower distance).
- **Wax-maker round-trip:** ~22–27 sec/block (with hives at x=380 and x=900, vessel at x=640).
- **Bee base cost:** 2 wax blocks, growth `r = 1.3` (per-type count, first one free).
- **Flower yield:** 5 harvests per flower, 60 sec regrow timer.
- **Vessel cost:** 8 wax blocks (Tier 1 paper airplane).
- **Launch animation:** 4 sec ascent, 2 sec crash.

**No queen, no slots, no auto-spawn.** Bees enter the colony only when the player buys them.

**Time-to-launch is now player-paced.** With minimum bees (1 forager + 1 wax-maker), an 8-block vessel takes ~3–4 minutes. Buying additional bees accelerates throughput but delays the launch budget.

## Why this scope

This slice exercises the architecture's load-bearing concerns:

- Game loop / tick system.
- Resource accumulation and spending.
- Purchasable building (the hive) with exponential cost.
- Auto-fill / Queen mechanic.
- Vessel construction bar.
- Launch / crash sequence (animation + state transition).
- Journal modal (HTML overlay).
- Save / load on action.

Everything in Phase 2+ is a *repetition* of these patterns with new variables. Get this right and the rest is content.
