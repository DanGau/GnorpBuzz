# Underground Chambers — MVP Slice

The first build of the design in `docs/underground.md`. Tightly scoped to prove the loop end-to-end without touching the hive, dig site, or journal systems.

## What ships in this PR

- **Two chamber specs**, both on row 0 (Tier 1, just below the meadow line):
  - **Forager Den** (`forager-den`) — owns `forager-swift-wings`, `forager-quick-forage`, `forager-pollen-pouches`
  - **Geomancer Hall** (`geomancer-hall`) — owns `geomancer-sharp-stinger`, `geomancer-swift-strike`, `geomancer-heavy-swarm`
- **Two plots**, side by side under the hive. Both start unexcavated.
- **Dig action** — `digChamber(specId)` action; spends pollen; flips chamber `built = true`. Cost: 20🌼 for Forager Den, 30🌼 for Geomancer Hall (cheap so the player can experience the loop within a few minutes).
- **Chamber radial menu** — built on the existing `RadialMenu`. An unbuilt plot shows a single **Dig** option; a built chamber shows its 1–N upgrade options (same data the old `ColonyPanel` rendered).
- **Underground cross-section view** — soil background drawn below the meadow line; chamber sprites; plot affordances. Visible only while the camera is zoomed in.
- **Camera framing extended downward** when zoomed in so the underground row is in frame alongside the hive.
- **`ColonyPanel` removed** from the UI. Its upgrade catalogue migrates wholesale into the two chambers.

## Gating change

Existing rule: `isUpgradeUnlocked` returns `true` when `journal.dismissedCount >= currentTier + 1`. This made all upgrades wait on dig-site progress.

New rule: an upgrade is unlocked when **its owning chamber is built**. Journal entries no longer gate upgrade rows directly. (They still drive narrative and dig-site tier progression — unchanged.)

The Phase-1 cost curve doesn't need to grow because the player now has to spend resources twice to get going on a path: once to dig the chamber, then per upgrade tier.

## Layout

Below `MEADOW_Y` (520), add two slot positions on row 0:

```
plot 0 (Forager Den)   plot 1 (Geomancer Hall)
       x = 180                 x = 320
                  y = 640
```

These sit symmetrically under the existing hive at (250, 545), with a comfortable visual gap.

`WORLD.HEIGHT` extends from 720 → 820 so the underground row has breathing room without crashing into the bottom edge.

## Selection model

The current `Game` tracks `selectedId` (`'hive' | 'dig-site' | null`) and `selectedCell` (a hex coord). Add:

- `selectedChamber: string | null` — the chamber spec id the player has open. Mutually exclusive with `selectedCell`.
- Clicking a chamber sprite or plot sets `selectedChamber` and `selectedId = 'hive'` (so the camera stays zoomed in on the hive cross-section).
- Closing a chamber radial (background click) steps back to whole-hive, same pattern as cells.

## Visual scope (deliberately small)

- Soil layer: flat tinted rectangle below meadow line, slightly darker near the bottom (one gradient, no texture art).
- Chamber sprite: rounded rectangle with glyph + name, sized ~80×60 world units.
- Tunnel: single straight line connecting built chambers in the same row (cosmetic).
- Dig-here plot: dashed-outline rectangle + pickaxe glyph + cost label.
- One-shot dig flourish: short alpha pop of the sprite when a chamber transitions from undug → built. No particle work.

## Test plan

Hand-verified via `node test-game.cjs` + `eye.cjs verify-quick` after these steps driven from `window.debug`:

1. **Fresh state.** Zoom in on hive. Expect: hive cross-section visible, two faded plots below it, no chamber sprites.
2. **`debug.grantPollen(100)`.** Click an empty plot. Expect: radial pops with one "Dig" option showing the cost.
3. **`debug.digChamber('forager-den')`.** Expect: chamber sprite swaps in with brief flourish; tunnel line draws (eventually, when a second is built).
4. **Click the built chamber.** Expect: radial shows the three forager upgrades with costs.
5. **`debug.digChamber('geomancer-hall')` after `grantPollen(50)`.** Expect: both chambers visible with a tunnel between them.
6. **Build passes** (`npm run build` — zero TS errors). **Existing tests pass** (`node test-game.cjs`).

## Out of scope for this PR

- More than two chambers, or any chamber on row 1+.
- Save migration — existing saves get fresh empty chambers on load (a brand-new field defaults to `{}`).
- Multiple hives.
- Tunnel particle flow.
- Mid-dig timing or construction animation beyond a single alpha pop.
- Touching the journal system or dig-site advancement.
