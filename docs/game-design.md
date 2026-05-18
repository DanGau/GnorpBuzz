# GnorpBuzz — Game Design

## Core Concept

An incremental/idle game where a colony of **wizard bees** chips its way through ancient rocks to recover the absurd "relics" buried beneath them, slowly piecing together the cosmology of their meadow. Each rock cracks open into an artifact (always something mundane — a soda can, a Lego, a cracked iPhone screen) and a Scientist Bee journal entry, which unlocks the next, larger dig site. The player optimizes the colony's mana economy — pollen → honey → spells — to break increasingly tough rock and ultimately follow the Sky Tether upward.

## Tone & Visual Style

- Cozy, nature-forward, whimsical — with a wink at high fantasy. The bees take their magic *very* seriously.
- 2D with simple bee sprites — always in a "buzzing" animation state. Spellcaster bees wear tiny pointed hats.
- One persistent background: meadow at the bottom, sky above, stars at the top. Sky gradually darkens as the player progresses.
- Below the meadow line, the **underground cross-section** shows the colony's excavated chambers (tech tree) — see `docs/underground.md`.

## The Wizard Reframing

All worker bees are members of a magical caste:

- **Foragers** are the *mundane* caste. They have no spells. They harvest pollen from meadow flowers; the hive refines pollen into **honey** — the colony's mana.
- **Geomancers** are melee earth-magic specialists. They dive-bomb the rock from above, channeling stored mana into a single thunderous strike.
- **Cantors** are cantrip-tier hover-casters. They float just above the comb and lob slow magical sparks at the rock from a safe distance — small damage, frequent casts, low mana cost.

Whenever a spellcaster wants to attack, it tries to spend honey. If the reservoir is empty, the caster drifts into an **idle swarm** near the hive for a few seconds, then retries. Mana flow is the central economic pressure: too few foragers and the spellcasters stall; too many and the comb's pollen overflows the cap and just feeds upgrades.

## Resources

| Resource | Source | Used for |
|----------|--------|----------|
| **Pollen** | Foragers harvest meadow flowers | Cell unlocks, worker placement, chamber excavation, upgrades |
| **Honey** (mana) | Refined automatically from deposited pollen, capped at the hive's reservoir | Spell casts (Geomancer, Cantor) |

A forager's deposit credits BOTH pools: pollen increments the upgrade currency, and as long as the honey reservoir has room, the same deposit also tops it up. When the reservoir is full, deposits still build pollen for upgrades — but spellcasters won't gain anything until casts free up room.

> **Note:** the long-term plan is to replace pollen as the upgrade currency with a more thematic "research/insight" resource. Pollen-for-upgrades is a placeholder while we shake out the spell economy.

## Core Loop

1. Player buys a Forager — it starts gathering pollen from flowers.
2. Player buys a Geomancer (or Cantor) — it begins casting spells at the current rock, burning honey to deal damage.
3. As honey runs dry, spellcasters drop into an idle swarm until foragers refill the reservoir.
4. The rock breaks open → an artifact is revealed → Scientist Bee writes a journal entry.
5. Player dismisses the artifact → the next rock (more HP) takes its place.
6. Player buys more workers, expands the comb (new hex cells), digs new underground chambers to unlock upgrade rows.
7. Cycle repeats across 7 tiers of progressively absurd "relics."

## The Scientist Bee & Journal System

One visually distinct bee witnesses every reveal and writes a short field note. Her tone evolves from practical curiosity (early relics) to philosophical wonder (later ones). Each entry both delivers a narrative beat AND, by being dismissed, advances the dig-site tier. The journal IS the cosmology — no separate lore screen.

## Spellcaster Roles in Detail

### Geomancer

- Big dramatic dive-bomb onto the rock. One strike per spawn; the bee "expires" after each cast and the cell respawns a fresh one on a cooldown.
- **Mana cost: 2 honey.** High cost = each strike feels deliberate.
- **Damage:** the bulk of moment-to-moment progress on the rock.
- **Upgrade paths (Geomancer Hall chamber):** Sharpened Stinger (+damage), Hasty Recruits (−respawn time), Heavy Swarm (+flight speed).

### Cantor

- Hovers above its home cell. Doesn't fly to the rock — fires a slow magical spark across the meadow at it.
- **Mana cost: 1 honey.** Cheap and frequent.
- **Damage:** ~⅓ of a Geomancer strike, but with much faster cadence.
- **Upgrade paths (Cantor Cloister chamber):** Quicker Cantrip (−cast interval), Twin Spark (+damage), Mana Sip (every Nth cast refunds 1 honey).

The two casters have different rhythm and risk shapes: Geomancers are big chunky bursts; Cantors are a constant background patter. A mature colony usually wants both.

## Hive expansion & layout

The comb is a hex grid the player grows outward one cell at a time. Cells are assigned permanently to a role on placement. **Same-role neighbors** grant adjacency synergy bonuses (Forager speed, Geomancer damage, Cantor — see `docs/dps-model.md`). Layout matters.

## Upgrade System

Upgrades live inside underground chambers (`docs/underground.md`). To unlock a row, dig the chamber that contains it. Chambers cost pollen; their dig cost gates how fast the player can specialize.

## Win State

After the seventh and final rock breaks open, the colony finds **the Sky Tether** — a child's half-deflated mylar balloon, still straining upward. The bees tie themselves to it. The flower of the original lore is finally within reach. Ascent begins.

The Scientist Bee's final journal entry is the emotional payoff: not "we made it," but "we're going up."
