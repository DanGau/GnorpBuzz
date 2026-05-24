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
| **Pollen** | Pollen Silo (under-hive, left of center) | 20 | Foragers harvest meadow flowers; one dot per trip | Raw input only — Workers pick it up to refine |
| **Honey** (mana) | Honey Jar (above the hive) | 10 | Honey Workers deliver pollen from the Silo | Spell casts (Cantor 1) |
| **Wax** | Wax Block (left meadow, elevated) | 40 | Wax Workers deliver pollen from the Silo | Worker/cell role upgrades, cell unlocks, worker hires |
| **Fertilizer** | Fertilizer Bin (under-hive, right of center) | 100 | Foragers haul fertilizer drops from the rock pile | Permanent meadow upgrades (Rich Soil, Long Bloom, Quick Sprout) |

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

## Rock Drops (loot economy)

When a cantor strikes the boulder, the impact knocks loose **drops** that
arc into a pile at the boulder's base. Drops come in three flavors with
loot-box rarity:

| Kind | Rarity | What it does |
|------|--------|--------------|
| **Seed** (T1 / T2 / T3) | Common (~75%) | Forager hauls it back, plants it on the nearest empty meadow tile; grows into a flower of the seed's tier (T1 short-lived/normal, T2 longer/+yield, T3 long/big yield). |
| **Fertilizer** | Uncommon (~22%) | Forager hauls it to the **Fertilizer Bin**; spent on permanent meadow/flower upgrades. |
| **Fossilized Honey** | Rare (~3%) | Auto-applies on spawn — instantly fills the Honey Jar. Never becomes a physical drop entity. The dopamine is the instant fill. |

Drops-per-rock is **damage-proportional**: each whole point of damage dealt
to the rock spawns one drop. So a tier-1 rock (40 HP) yields ~40 drops over
its lifetime, and the bigger rocks rain accordingly more loot.

**Forager dual-task.** Foragers spawn-park between the two under-hive intake
buildings (Pollen Silo + Fertilizer Bin). On idle they pick the **nearest
pending task**: fly LEFT to a meadow flower for pollen, or fly RIGHT to the
pile to haul a seed (plant it) or fertilizer (deposit it). The geometry is
what makes the dual-task tension feel emergent — geographically equidistant
from the start, demand on either side pulls the swarm.

**The pile is capped at 250 uncollected drops.** Past the cap, the boulder
becomes **invincible** — cantors stop casting (no wasted mana) until
foragers haul the pile down. This turns "over-damaging while your foragers
fall behind" into a self-correcting jam rather than a punishment.

**Real physics on the pile.** Drops are circle colliders with gravity,
restitution, friction, sleep-when-supported, and a right-edge wall.
They mound up in the bottom-right corner of the meadow against the
world edge — what you see is the literal physical pile, not a tally.

**Planting is left-field only.** Foragers plant hauled seeds at the
nearest empty meadow tile, and meadow tiles only exist on the LEFT side
of the field (where the wild flowers already grow). The right side of
the meadow is intentionally empty grass — the boulder's territory.

**Flowers wither.** Once a planted sapling opens, it lives for a
tier-dependent lifespan (T1: 60s, T2: 120s, T3: 240s) and then
disappears silently. The "harvest before it rots" pressure is what
makes player attention scarce.

**Natural release valve.** If the meadow drops below a baseline (4
flowers), a slow trickle of T1 flowers spawns on its own (~one every
22s) at random empty tiles — enough to recover a soft-locked colony,
not enough to be a primary supply.

## Fertilizer Upgrades

Clicking the **Fertilizer Bin** opens a panel of three permanent meadow
buffs, each spent in fertilizer (🌿):

| Upgrade | Effect | Cost (base · growth) |
|---------|--------|----------------------|
| **Rich Soil** | +25% pollen yield per flower per tier (max 4) | 8 · 1.7× |
| **Long Bloom** | +30% flower lifespan per tier (max 4) | 6 · 1.6× |
| **Quick Sprout** | −20% sapling growth time per tier (max 3) | 10 · 1.8× |

These are symmetric with the wax upgrades but compound the meadow's
output rather than the workers'. A maxed colony has flowers that yield
big, live long, and grow fast — turning the rock-drop economy from a
slow trickle into the main pollen pipeline.

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
| **Fertilizer Bin** | Fertilizer (Rich Soil, Long Bloom, Quick Sprout) |

Clicking a building also pans the camera to a side-on "economy" framing of the three refinery buildings. (There is no underground — that view was removed.)

## Win State

After the seventh and final rock breaks open, the colony finds **the Sky Tether** — a child's half-deflated mylar balloon, still straining upward. The bees tie themselves to it. The flower of the original lore is finally within reach. Ascent begins.

The Scientist Bee's final journal entry is the emotional payoff: not "we made it," but "we're going up."
