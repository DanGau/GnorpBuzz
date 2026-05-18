# GnorpBuzz — Underground Chambers

The colony's tech tree is **physical**. Upgrades don't live in a menu — they live in chambers the colony has literally excavated below the hive. To unlock new technology, the player **digs**.

This is GnorpBuzz's answer to "where do colony-wide upgrades go?" The earlier `ColonyPanel` (a docked HTML widget on the right edge) is removed in favor of buildings the player places on the map.

See `docs/game-design.md` for the wider concept and `docs/phases.md` for how this maps onto the four-phase arc.

## Core idea

- The **hive crowns a hill** on the meadow. From the zoomed-out overview, the hill is the colony's silhouette — clean, uncluttered, so the launch drama (vessel rising toward the sky flower) reads.
- Zooming in **cracks the hill open** into a cross-section. The hive is on top; the earth beneath shows excavated **chambers**, connecting **tunnels**, and unexcavated rock waiting to be dug.
- Each chamber owns one **tech tree** (upgrade path). Clicking a chamber opens a radial menu of its upgrades — same vocabulary as the existing hive-cell radial.
- New chambers are placed by **digging** them — an explicit player action that costs resources. The dig action is the unlock; building the chamber and unlocking its tech are the same gesture.
- Deeper layers = later phases. Phase 1 chambers sit just under the meadow; Phase 4 chambers are deep underground. Vertical position telegraphs progression.

## Why this works

- **Spatial = legible.** Players see what they have, what's next, what's empty. The full ambition of the run is visible the moment they zoom in.
- **Diegetic.** Upgrades are *things bees built*, not menu rows.
- **Re-uses the radial pattern.** Chambers click → radial → option, the same flow as comb cells. One UI vocabulary across the game.
- **Scales with the phase arc.** New phases dig deeper. Auto-converted Phase N buildings stay visible as background producers — exactly what `phases.md` calls for.
- **Empty rock is a future hook.** Unexcavated areas can host future things: an underground economy, dig-site connections, water tables, secrets.

## Anatomy

```
── ZOOMED IN (cross-section) ────────────────────────────

                  ╭────────────╮
                  │  ⬡⬡⬡⬡⬡⬡ │   ← hive (above ground)
                  │  ⬡⬡⬡⬡⬡⬡ │
   ░▒░▒░▒░▒░░░░░▒░▒░▒▒▒▒▒▒░▒░▒░▒░▒░▒░░░░░░░ meadow line
   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
   ▓▓ ┌──────┐ ▓▓▓▓ ┌──────┐ ▓▓▓▓ ┌──────┐ ▓▓
   ▓▓ │ DEN  │═════│ HALL │═════│  ··  │ ▓▓  Tier 1 (Phase 1)
   ▓▓ └──┬───┘ ▓▓▓▓└──┬───┘ ▓▓▓▓└──────┘ ▓▓     dig me ↑
   ▓▓▓▓▓▓│▓▓▓▓▓▓▓▓▓▓▓▓│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
   ▓▓▓ ┌─┴────┐ ▓▓▓ ┌─┴────┐ ▓▓▓ ▓▓▓▓▓▓▓▓▓▓
   ▓▓▓ │ WRK  │════│ APO  │ ▓▓▓ unexcavated   Tier 2 (Phase 2)
   ▓▓▓ └──────┘ ▓▓▓└──────┘ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
```

- **Hive** — the existing honeycomb, unchanged. Sits at the top of the cross-section.
- **Soil / rock background** — fills the area below the meadow line. Visually conveys "you're looking underground." Lighter near surface, darker deeper.
- **Plots** — fixed slots arranged in horizontal rows (one row per phase tier). Each row is at a deeper depth than the last.
- **Chambers** — built structures occupying plots. Each chamber has a sprite (a labelled rounded-rectangle room), a list of upgrade tiers, and an outward direction for its radial menu (downward — into the rock).
- **Tunnels** — visual connectors drawn between built chambers in the same row, and to the hive above. Cosmetic in MVP; future hook for resource flow particles.
- **Unexcavated plots** — show as "Dig here" affordances: a faded outline + pickaxe glyph + cost label. Click to open a one-option radial that commits the dig.

## Chamber specs

A chamber is defined by:

| Field | Meaning |
|-------|---------|
| `id` | `'forager-den'`, `'geomancer-hall'`, `'cantor-cloister'`, … — stable across saves |
| `name` | Display name (`"Forager Den"`) |
| `glyph` | Single emoji or character for the chamber sprite and dig-here icon |
| `plot` | `{ row, col }` — fixed grid coordinate underground |
| `digCost` | Resource cost to excavate this chamber |
| `upgradeIds` | Which `UpgradeId`s this chamber owns (1–N) |

Upgrades themselves keep their existing definitions in `UPGRADE_DEFS`; chambers are the **container** that determines whether each upgrade is reachable.

## Player flow

1. Player zooms in on the hive (existing zoom mechanic, unchanged).
2. Camera framing extends downward to also show the underground.
3. Player sees their built chambers and faded "Dig here" plots.
4. Player clicks an unbuilt plot → radial pops with one option: **Dig — cost: 30🌼**.
5. Confirm → chamber sprite swaps in over the plot, with a brief "construction" flourish (puff of dirt, etc.).
6. Player clicks the new chamber → radial pops with that chamber's upgrade options (same UI as before, just sourced per-chamber).
7. Player purchases upgrades from inside the chamber radial.

## Gating: chambers replace journal-gating for upgrades

Today, `isUpgradeUnlocked` gates upgrade purchases by `journal.dismissedCount`. Under the new model, **owning the chamber that holds an upgrade IS the unlock**. Journal entries still drive narrative and dig-site progression; they just no longer directly gate upgrade rows.

A chamber's `digCost` itself may scale with `journal.dismissedCount` or with the chamber's tier row, so journal progress still acts as soft pacing on when deeper chambers become affordable.

## Future hooks (parked, but the design anticipates them)

- **Tunnels carry resource flow.** Phase 2+ auto-conversion (e.g. wax huts feeding refineries) renders as particles flowing through tunnels between chambers. Direct visual feedback for the economy that today lives in invisible counters.
- **Underground economy.** Unexcavated rock could yield raw materials when dug — Phase 3's nectar-vein motif, Phase 4's Bloomshard refineries.
- **Multiple hives.** Reserved for later. For now, one hill, one hive. If we add hives, each gets its own hill + underground.
- **Chamber upgrades that affect the chamber itself.** A Workshop tier-up could enlarge its sprite, deepen its room, sprout a sub-chamber.

## Non-goals for the first build

- No tunnels carrying real resource flow yet — cosmetic connectors only.
- No chamber-on-chamber dependencies (e.g. "Workshop requires Forager Den"). Every chamber's `digCost` is the only gate.
- No mid-dig animation requiring time to elapse — dig is instantaneous on commit, with a one-shot flourish.
- No removal/relocation of chambers. Like cell-role assignments, dig is permanent.
- No vertical scroll inside the underground. The cross-section frames everything that exists; future rows extend the framing downward.
