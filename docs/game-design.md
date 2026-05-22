# GnorpBuzz — Game Design

## Core Concept

An incremental/idle game where a colony of **wizard bees** chips its way through ancient rocks to recover the absurd "relics" buried beneath them, slowly piecing together the cosmology of their meadow. Each rock cracks open into an artifact (always something mundane — a soda can, a Lego, a cracked iPhone screen) and a Scientist Bee journal entry, which unlocks the next, larger dig site. The player optimizes the colony's mana economy — pollen → honey → spells — to break increasingly tough rock and ultimately follow the Sky Tether upward.

## Tone & Visual Style

- Cozy, nature-forward, whimsical — with a wink at high fantasy. The bees take their magic *very* seriously.
- 2D with simple bee sprites — always in a "buzzing" animation state. Spellcaster bees wear tiny pointed hats.
- One persistent background: meadow at the bottom, sky above, stars at the top. Sky gradually darkens as the player progresses.

## The Wizard Reframing

Bees split into a mundane and a magical caste:

- **Foragers** harvest pollen from meadow flowers (one dot per trip) and deliver it to the **Pollen Silo**. They park around the silo between trips.
- **Honey Workers** park around the **Honey Jar**. They fly to the Silo, pluck one pollen, carry it back to the Jar, and refine it into **honey** — the colony's mana.
- **Wax Workers** park around the **Wax Block**. Same loop, producing **wax** — the colony's upgrade currency.
- **Cantors** are cantrip-tier hover-casters — currently the colony's only attacker. They float near the honey jar and lob slow magical sparks at the rock — small damage, frequent casts, low mana cost.

> **Note:** the **Geomancer** (a heavy melee dive-bomber) is parked for now and removed from the build while the economy is fleshed out. Cantors are the sole damage source in the current slice.

Whenever a cantor wants to cast, it tries to spend honey. If the reservoir is empty, it drifts into an **idle swarm** near the hive for a few seconds, then retries. The bottleneck moves around: too few foragers and the Silo dries up; too few Honey Workers and cantors idle-swarm with a full Silo in plain sight; too few Wax Workers and the player can't afford the next upgrade. Every state of the economy is visible in the buildings: a full Silo means "spend or rebalance," a draining Jar means "cantors are eating into the reserve faster than honey workers can refill it," etc.

## Resources

All three resource pools are **capped**, and each lives in a visible
above-ground building around the hive. The buildings ARE the dashboard:

| Resource | Container | Cap | Source | Used for |
|----------|-----------|-----|--------|----------|
| **Pollen** | Pollen Silo (left, meadow ground) | 20 | Foragers harvest meadow flowers; one dot per trip | Raw input only — Workers pick it up to refine |
| **Honey** (mana) | Honey Jar (above the hive, between economy and combat) | 10 | Honey Workers deliver pollen from the Silo | Spell casts (Cantor 1) |
| **Wax** | Wax Block (left, meadow ground) | 40 | Wax Workers deliver pollen from the Silo | All upgrades, cell unlocks, worker hires |

**Bees never use the comb as a destination.** The comb is a population
dial: how many of each role exist. Every bee homes to a *building*, not a
cell. The layout reads left-to-right as the colony's economic story:
economy zone on the left (Pollen Silo + Wax Block, where foragers and wax
workers gather), refinery in the middle (Honey Jar above the hive, where
honey workers and cantors cluster), and the boulder on the right that
cantors chip away at.

**Caps are the central pressure.** When a pool is full, the bees that
supply it loiter at their park spot — visible backpressure that reads as
"you need to spend before more can be produced." Honey at cap → honey
workers bob at the jar. Wax at cap → wax workers bob at the block. Silo
full → foragers loiter at the silo instead of flying out for more.

See `docs/economy-sketch.md` for the full design history.

## Core Loop

1. Player buys a Forager — it starts gathering pollen from flowers.
2. Player buys a Cantor — it begins casting sparks at the current rock, burning honey to deal damage.
3. As honey runs dry, cantors drop into an idle swarm until workers refill the reservoir.
4. The rock breaks open → an artifact is revealed → Scientist Bee writes a journal entry.
5. Player dismisses the artifact → the next rock (more HP) takes its place.
6. Player buys more workers, expands the comb (new hex cells), and buys role upgrades by clicking the relevant building.
7. Cycle repeats across 7 tiers of progressively absurd "relics."

## The Scientist Bee & Journal System

One visually distinct bee witnesses every reveal and writes a short field note. Her tone evolves from practical curiosity (early relics) to philosophical wonder (later ones). Each entry both delivers a narrative beat AND, by being dismissed, advances the dig-site tier. The journal IS the cosmology — no separate lore screen.

## Spellcaster Roles in Detail

### Cantor

- Hovers near the Honey Jar. Doesn't fly to the rock — fires a slow magical spark across the meadow at it.
- **Mana cost: 1 honey.** Cheap and frequent.
- **Damage:** small per-hit, fast cadence — currently the colony's only damage source.
- **Upgrade paths (click the Honey Jar):** Quicker Cantrip (−cast interval), Twin Spark (+damage), Mana Sip (every Nth cast refunds 1 honey).

> **Parked:** the **Geomancer** (a big dive-bomb melee caster, 2 honey/strike) is removed from the current build while the economy is built up. It'll likely return as a second attacker once the core loop is solid.

## Hive expansion & layout

The comb is a hex grid the player grows outward one cell at a time. Cells are assigned permanently to a role on placement. **Same-role neighbors** grant adjacency synergy bonuses (Forager speed, Cantor damage — see `docs/dps-model.md`). Layout matters.

## Upgrade System

Upgrades are **contextual panels** that open when you click the world object a role is tied to — no separate tech-tree screen. Each panel lists that role's upgrade rows; buying is gated only by wax cost (no unlock/dig step).

| Click… | Opens upgrades for |
|--------|--------------------|
| **Pollen Silo** | Forager (Swift Wings, Quick Forage) |
| **Honey Jar** | Cantor (Quicker Cantrip, Twin Spark, Mana Sip) |
| **Wax Block** | Wax Worker (Swift Haul, Rich Combs, Deep Coffers) |

Clicking a building also pans the camera to a side-on "economy" framing of the three refinery buildings. (There is no underground — that view was removed.)

## Win State

After the seventh and final rock breaks open, the colony finds **the Sky Tether** — a child's half-deflated mylar balloon, still straining upward. The bees tie themselves to it. The flower of the original lore is finally within reach. Ascent begins.

The Scientist Bee's final journal entry is the emotional payoff: not "we made it," but "we're going up."
