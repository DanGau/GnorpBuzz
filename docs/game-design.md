# GnorpBuzz — Game Design

## Core Concept

An incremental/idle game where a colony of bees attempts to reach a mysterious glowing flower floating in the stars. The player optimizes the colony's DPS (work output) to build increasingly large and absurd flying vessels, each one getting closer to the flower than the last.

## Tone & Visual Style

- Cozy, nature-forward, whimsical.
- 2D with simple bee sprites — always in a "buzzing" animation state.
- One persistent background: meadow at the bottom, sky in the middle, stars at the top. The sky gradually darkens and becomes more starry as the game progresses — only a few background variants needed, crossfaded between stages.
- The sky flower is always visible in the upper portion of the screen, glowing softly, acting as a constant visual goal.
- The flower grows slightly brighter and more detailed as the player gets closer.

## Core Loop

1. Bees automatically collect resources (wax, pollen, nectar) from the meadow.
2. Resources are fed into the current vessel being constructed at the center of the screen.
3. When the vessel is complete it launches — the player watches it ascend toward the flower.
4. It fails to reach the flower and crashes back down.
5. The Scientist Bee (visually distinct with goggles and a satchel) writes a journal entry describing what she observed.
6. The journal entry unlocks a new upgrade category.
7. A new, larger vessel blueprint appears and construction begins again.

## The Scientist Bee & Journal System

One visually distinct bee rides every rocket as observer. After each crash she writes a short field note — these are the primary storytelling vehicle.

Each journal entry does two things:

- Delivers a narrative beat.
- Unlocks a new upgrade tier.

**The journal IS the tech tree** — no separate upgrade screen needed.

Her tone evolves: early entries are practical and panicked, mid entries become wonder-struck, late entries are philosophical.

### Rough journal arc

- "It's higher than it looks. We need more lift." → unlocks lift upgrades.
- "Terribly cold and wet. The wax melted." → unlocks heat resistance.
- "No flowers up here. Just stars. But I saw it — it's real." → emotional beat, unlocks navigation.
- "Can't breathe. Need a sealed cabin." → unlocks pressurization.
- "Silent. Beautiful. The flower is enormous up close. We just can't reach it yet." → unlocks late-game tier.
- Final launch — the flower is reached.

## Vessel Progression

Always the same category: flying vessels. Each one is bigger and more absurd than the last:

1. Paper airplane (folded from flower petals)
2. Hot air balloon (woven vines, honey-gas)
3. Propeller plane (wood and beeswax)
4. Jet
5. Rocket
6. Bigger rocket
7. Absurd mega-rocket

Each vessel is visibly larger on screen than the previous one. The launch, ascent, and crash are a key satisfying visual moment — the vessel gets measurably closer to the flower each time before falling.

## Upgrade System

Organized around what the Scientist Bee observed on the previous launch. Categories unlock sequentially:

- **Collector upgrades** — more bees, faster collection, new resource types.
- **Construction upgrades** — build speed, material efficiency.
- **Vessel upgrades** — lift, heat resistance, navigation, pressurization, fuel, orbital mechanics.

Each upgrade tier is gated behind the previous launch's journal entry.

## Milestone Structure

The "break the wall" moment is the launch itself:

- Complete vessel → launch → dramatic ascent → crash → journal entry → new upgrade tier unlocks → new larger vessel appears.
- This cycle is the primary player reward loop.
- Each cycle should feel meaningfully different from the last due to new upgrade categories opening up.

## Win State

The final phase isn't a visit — it's a **colonization**. Once the colony confirms the flower is real and reachable but not safely traversable in a single trip, the goal pivots from "reach it" to "live there." The final mega-vessel carries habitats. Bees harvest **Bloomshard** (crystallized flower-essence) from approach distance to build sustainable structures at the destination.

The Scientist Bee's final journal entry is the emotional payoff of the whole game — not "we made it" but **"we're staying."** The flower was always real, always waiting, and now it's home.

See `docs/phases.md` for the four-phase breakdown that delivers this arc.
