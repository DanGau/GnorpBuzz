# MVP Scope

The minimum slice that proves the core loop end-to-end. Everything outside this is parked.

## Scope (revised after first-play feedback)

**Phase 1, agent-driven, single vessel.** The MVP runs from new-game through:

1. Foragers fly out to flowers, harvest pollen, return to a Forager Hive — visibly.
2. Wax-makers walk from their Wax Hive to a Forager Hive, fetch pollen, return, produce a wax block (visible animation), then carry the block to the vessel.
3. The vessel construction pile grows as blocks arrive.
4. Player buys additional Forager Hives and Wax Hives (cost: wax blocks) to expand the colony.
5. After 8 blocks delivered, vessel launches → crashes.
6. Scientist Bee writes the first journal entry.
7. End of MVP.

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
- Two hive types: Forager Hive and Wax Hive, each independently buyable.
- Flowers as harvest sites with yield + regrow.
- Bee state machines (forager and wax-maker, see `docs/agent-behavior.md`).
- Discrete wax-block delivery to the vessel.

## Technical decisions

| Decision | Choice |
|----------|--------|
| UI approach | **Hybrid** — Pixi for world (meadow, bees, vessel, sky, flower), HTML/CSS overlay for resource counters, buy buttons, journal modal |
| Save | **Local storage**, **on-action** (every meaningful state change writes) |
| Offline progress | **None** for MVP — game ticks only while tab is open |
| Tuning approach | **Guess values; tune after** the loop is playable |

## First-pass Phase 1 numbers (revised for agent-based model)

- **Forager round-trip:** ~10 sec/pollen (4s out, 3s harvest, 3s back).
- **Wax-maker round-trip:** ~17 sec/block (3s to forager hive, 0.5s pickup, 3s back, 5s producing, 3s to vessel, 0.5s drop, 3s back).
- **Hive base cost:** 5 wax blocks, growth `r = 1.08` (each hive type has its own count).
- **Slots per hive:** 4 (smaller than before so each hive feels meaningful).
- **Queen fill rate:** 1 slot per 15 sec (unchanged).
- **Flower yield:** 5 harvests per flower, 60 sec regrow timer.
- **Vessel cost:** 8 wax blocks (Tier 1 paper airplane).
- **Launch animation:** 4 sec ascent, 2 sec crash (unchanged).

**Observed time-to-first-launch (starter colony, no purchases):** ~2 min (112 sec elapsed sim time on a verification run). Matches the agent-throughput estimate.

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
