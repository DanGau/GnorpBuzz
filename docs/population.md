# GnorpBuzz — Bee Population Model

How bees enter the colony, grow, assign to roles, and migrate to the flower. Pairs with `docs/dps-model.md` (which uses `count` as an input) and `docs/phases.md`.

## Model (revised after first-play feedback)

**Single hive of each type. Buy bees directly. No queen.**

- Each role has exactly one hive (fixed structure).
- The player buys individual worker bees, which join the appropriate hive.
- The first bee of each type is free; subsequent bees cost wax with exponential growth.
- There is no Queen and no auto-spawning. Every bee enters the colony via a deliberate player action.

This makes early-game progression feel like a sequence of decisions ("buy my first forager," "buy my first wax-maker," "save up for a 2nd forager") rather than a passive wait.

The earlier hive/queen model is parked for re-introduction in later phases if scaling demands it.

## Hives

Each role has a dedicated hive type, each with its own exponential cost curve:

```
Cost_hive_role(n) = base_role × r^n
```

Where `r` matches the phase cost growth (1.08 → 1.11 → 1.13 → 1.15 across phases per `docs/phases.md`).

| Phase | Hive types available |
|-------|----------------------|
| 1 | Worker Hive |
| 2 | Collector Hive, Builder Hive, Scientist Hive |
| 3 | + Engineer Hive |
| 4 | + Colonization Hive (ships out at finale) |

Each hive holds a fixed number of bee slots (e.g., 5 slots per hive — exact number is a tuning knob). Hive *upgrades* can grow slot count or efficiency; the per-hive count is a separate purchase track from per-hive *upgrades*.

## Queen and fill rate

**Single eternal Queen.** Always present, never lost.

- **Global fill rate:** ~1 empty slot filled per minute, baseline. Applies across all hives — the Queen lays eggs and they go to whichever hive has empty slots (with simple priority: oldest empty slot fills first, ties broken by smallest population).
- The Queen herself is a major **upgrade tree** ("Royal Jelly," "Royal Gardens," "Royal Diet," etc.) — each upgrade multiplies the global fill rate. Standard additive-within-family stacking per the DPS model.
- The Queen's egg-laying is one of the colony's most important meta-DPS levers, since fill-rate is the bottleneck on capacity → bee count → resource production.

## Empty slots

Empty slots only appear when:

1. **A new hive is just purchased** — starts with 0 bees, fills over time at the Queen's rate.
2. **Phase transitions add new hive types** — the new types start empty.

There are **no crash deaths**. The Scientist Bee is the only passenger on each vessel and always survives (narrative fiat). So once a hive fills, it stays full.

This means **the Queen's rate is the rate-limiter on population growth**, and **buying a hive is the "permission to grow" lever**. Two clean, separable controls.

## Role assignment

Hives are typed at purchase. A Builder Hive only ever holds Builders. There's no manual reassignment — to shift the role mix, you buy more hives of the desired role and let them fill.

This is intentional: assignment-puzzle complexity comes from *purchase decisions*, not from runtime micromanagement. Matches the typed-bee-purchase decision baked into `docs/dps-model.md`.

## The Scientist Bee

Special. Not a hive-grown bee. Always exactly one. Always survives every crash. Generates Insight (per `docs/dps-model.md`) only when she's *with the colony*, not in flight or post-crash.

In Phase 1 only the Scientist exists in this role. From Phase 2 onward, **Scientist Hives** produce additional anonymous Scientists who generate Insight passively. The named Scientist Bee remains unique and is the journal author and vessel observer.

## Phase 4 — Colonization migration

The win-state mechanic.

- A new hive type unlocks: **Colonization Hive**. Buy and fill these like any other.
- A **second Queen** unlocks as a Bloomshard-tier upgrade — she's not yet active, just being prepared.
- The mega-vessel's payload is composed of: filled Colonization Hives + the second Queen + supplies.
- During the multi-hour ascent, the **Earth colony continues operating normally** — the original Queen still lays, all other hives still produce, the player still has a meadow to tend. (Avoids dead air during the slow climb.)
- **Win state:** the second Queen reaches the flower and begins laying eggs there. The first egg laid at the destination triggers the final journal entry and credits.

## Cross-doc impact

This model means **"buy a bee" is never a literal action** — players buy hives. The DPS doc's "Cost_role(n)" should be read as "Cost_hive_role(n)" with the hive auto-filling. The phases doc's "Buy more workers vs. buy collection upgrade?" should be read as "Buy more Worker Hives vs. buy collection upgrade?"

`docs/dps-model.md` and `docs/phases.md` have been updated to reflect this terminology.

## Open tuning questions (for later)

- How many slots per hive? (5 is a placeholder — affects how granular hive purchases feel.)
- Hive upgrades — does each hive have its own per-hive upgrade tree, or are upgrades global per role?
- Queen fill-rate cap — soft cap at very high upgrades, or runaway?
- Does the second Queen's egg-laying rate at the flower differ from Earth's?
