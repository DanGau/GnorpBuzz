# Agent-Based Production — Phase 1

This doc replaces the formula-based production model from `docs/dps-model.md` for Phase 1. Production is no longer a /sec rate — it emerges from visible bee journeys between flowers, hives, and the vessel.

`docs/dps-model.md` still applies for Phase 2+ as the abstract model the upgrades and economy plug into. Phase 1 becomes the visible, agent-driven implementation that those abstractions sit on top of later.

## Resource chain

```
flower (in meadow)
   ↓  forager flies, harvests for ~3 sec, flies back
forager hive (pollen pot)
   ↓  wax-maker walks here, picks up pollen, returns
wax hive (production interior)
   ↓  wax-maker spends ~5 sec converting pollen → wax block
wax hive (block stockpile)
   ↓  wax-maker (same bee) flies block to vessel, drops it
vessel construction pile
   ↓  block snaps into place; vessel grows visibly
```

Two resources are visible: **pollen** (yellow, raw, accumulates at Forager Hives) and **wax blocks** (cream-colored, processed, stockpiled at Wax Hives). The vessel grows in discrete chunks as blocks arrive.

## Buildings

There is exactly **one Forager Hive** and **one Wax Hive** in Phase 1. Hives are fixed structures; you scale by adding individual worker bees, not by building more hives. There is no Queen and no auto-spawning — every bee enters the colony only when the player buys it.

### Forager Hive

- Holds the Forager bees that the player has bought.
- Holds a visible pollen stockpile (small pots at the base of the skep that fill as foragers deposit).
- Foragers always return to this single home hive.

### Wax Hive

- Holds the Wax-maker bees that the player has bought.
- Holds an overflow wax-block stockpile (visible cream hexes beside the workshop) — populated when the vessel isn't accepting more blocks.
- Wax-makers fetch pollen from the Forager Hive, return, produce a block, then carry it to the vessel.

### Buying bees

- The first bee of each type is **free** — clicking "Build forager" or "Build wax-maker" with zero of that type costs nothing. This is what kicks off play.
- Subsequent bees cost wax blocks: `cost = ceil(BASE × GROWTH^(currentCount - 1))` where BASE=2, GROWTH=1.3.
- Bee purchases drain wax from the wax-hive stockpile first, then from the vessel pile if the stockpile is empty. Buying bees while the vessel is full can revert it from `ready` back to `building`.

### Flowers

- Live in the meadow at predetermined positions.
- Each has a **yield counter** (default 5 harvests before depleting) and a **regrow timer** (default 60 sec to fully regrow).
- Visible state: full bloom (harvestable), partially picked (still harvestable, fewer petals), wilted/brown (not harvestable, regrowing).
- Foragers pick the nearest harvestable flower they can claim; one bee per flower at a time (a flower being harvested is "claimed" until the bee leaves).

### Vessel pad

- Visible construction pile at center-meadow.
- Each delivered wax block adds visibly to the pile.
- Vessel transitions to **`ready`** when N blocks have been delivered (Phase 1: 8 blocks for the paper airplane). The pile transforms into a fully-assembled paper airplane that gently glows and pulses.
- The vessel does **not** auto-launch. The player must **click the airplane** to send it. This makes "launching" a deliberate, satisfying action rather than a passive event.
- Buying bees while the vessel is `ready` can drain the pile and revert to `building`, which is intended — choose between "more bees now" and "launch now."

## Bee state machines

### Forager

```
IDLE_AT_HIVE
   ↓ pick a free flower (else wait)
FLYING_TO_FLOWER (target: flower)
   ↓ arrive
HARVESTING (3 sec, claims the flower)
   ↓ flower yield -= 1, bee carrying = 1 pollen
FLYING_HOME (target: home hive)
   ↓ arrive
DEPOSITING (~0.5 sec)
   ↓ home hive's pollen += 1
IDLE_AT_HIVE (loop)
```

Visual carrying state: bee body has a yellow glow / small pollen sphere attached when carrying.

### Wax-maker

```
IDLE_AT_HIVE
   ↓ check: any Forager Hive has pollen?
FLYING_TO_POLLEN (target: nearest Forager Hive with pollen ≥ 1)
   ↓ arrive
PICKUP (~0.5 sec, decrements that hive's pollen)
   ↓ carrying = 1 pollen
FLYING_HOME (target: home Wax Hive)
   ↓ arrive
PRODUCING (5 sec inside hive, no movement)
   ↓ carrying = 1 wax block, hive's wax stockpile += 1 (visually pops out)
FLYING_TO_VESSEL (target: vessel pad)
   ↓ arrive
DROPPING (~0.5 sec)
   ↓ vessel.deliveredBlocks += 1, hive stockpile -= 1
FLYING_HOME (loop)
```

If the Wax Hive's stockpile already has one or more blocks, the bee picks up an existing block instead of producing a new one — keeps the stockpile from runaway growth.

Visual carrying state: pollen sphere on the way in; cream-colored hexagonal block on the way to the vessel.

### Idle behavior

When a bee can't find work (no available flowers / no pollen anywhere), it does a small wandering loop near its home hive — same behavior we have today.

## Resource state model (sim)

```ts
interface GameState {
  // ... existing ...
  resources: {
    pollen: { perHive: Record<string, number> }; // pollen at each Forager Hive
    waxBlocks: { perHive: Record<string, number> }; // blocks at each Wax Hive
  };
  flowers: FlowerData[]; // moved into sim — yields and timers must persist
  vessel: {
    deliveredBlocks: number;
    requiredBlocks: number;
    phase: VesselPhase;
    launchTimer: number;
  };
}

interface FlowerData {
  id: string;
  yieldRemaining: number;
  regrowTimerMs: number; // 0 = full bloom; counts down while regrowing
  claimedByBeeId: string | null;
}
```

The world layer's bee/hive entities each get richer state (see state machines above). The `Bee` class gains a behavior state enum, current target, and `carrying` field.

## Buy currency

Same as before: **wax blocks** are the meta-currency. Building a hive costs N blocks. The same blocks the player wants to send to the vessel also have to feed colony expansion — a real strategic tension.

## Phase 1 starter state (revised MVP)

The game loads into a **deliberately empty colony**. Nothing happens until the player acts.

- **1 empty Forager Hive** on the left (no foragers).
- **1 empty Wax Hive** on the right (no wax-makers).
- **8 flowers** scattered across the meadow (default yield 5, regrow 60s).
- **0 pollen, 0 wax blocks, 0 bees.**
- **Vessel:** empty pad with a faint airplane outline; requires 8 blocks for first launch.
- Buy panel offers both bee types, both with first-bee-FREE.

The player's first actions are: build the first forager (free), build the first wax-maker (free). Production begins. Player buys more bees as wax accumulates. When 8 blocks are delivered, the airplane assembles and waits for a click.

## Tuning targets (placeholders)

- Forager round-trip: ~10 sec/pollen (4s out + 3s harvest + 3s back).
- Wax-maker round-trip: ~17 sec/block (3s to Forager Hive + 0.5 pickup + 3s back + 5s producing + 3s to vessel + 0.5 drop + 3s back).
- 2 wax-makers cranking: ~1 block / 8.5 sec.
- 8 blocks for first vessel: ~70 sec minimum if pollen flow keeps up.
- Pollen production: 3 foragers × (1 pollen / 10 sec) = 0.3 pollen/sec.
- Wax demand: 2 wax-makers × (1 pollen / 17 sec) ≈ 0.12 pollen/sec.
- → Pollen surplus by default; foragers will eventually idle. That's fine for the starter — buying a Wax Hive accelerates progress, eventually rebalancing.

Actual numbers will get tuned after first play.

## What this changes from the existing code

- **Sim:** new shape (`pollen.perHive`, `waxBlocks.perHive`, `flowers`, `vessel.deliveredBlocks`), new systems for bee behavior state, removal of `productionSystem` and `constructionSystem` (replaced by behavior triggers).
- **World:** Bee gets a real state machine; HiveEntity differentiates Forager vs Wax; FlowerEntity gets state.
- **View:** new visuals for pollen pots, wax stockpile, claimed flower state, carried items, vessel pile.
- **UI:** resource bar shows pollen + blocks; buy panel offers two hive types; vessel progress shows N/M blocks.
