# Agent-Based Production — Phase 1 (Wizard Reframing)

This doc replaces the formula-based production model from `docs/dps-model.md` for Phase 1. Production is no longer a /sec rate — it emerges from visible bee journeys between flowers, the hive, and the dig site.

## The mana economy

```
flower (in meadow)
   ↓  forager flies, harvests for ~3 sec, flies back
hive cell
   ↓  deposit credits BOTH pools:
        - state.hive.pollen += carryAmount    (upgrade currency)
        - up to honeyCap honey is refined too (mana reservoir, capped)

geomancer cell                cantor cell
   ↓ check honey ≥ 2            ↓ check honey ≥ 1 (after cast-interval timer)
   ↓ if yes: pay, dive-bomb     ↓ if yes: pay, fire spark across meadow
   ↓ if no:  enter idle-swarm   ↓ if no:  enter idle-swarm
             retry in ~3 sec               retry in ~3 sec
   ↓ damage applied on impact   ↓ damage applied at cast (spark is cosmetic)
dig site HP drops, eventually reveals an artifact.
```

The two pools — pollen (uncapped, for upgrades) and honey (capped, for spells) — share a single deposit event but have very different shapes. Honey forces casters into idle swarms when foragers can't keep up; pollen quietly accrues for the next chamber dig or upgrade purchase.

## Buildings

There is exactly **one Hive**, a honeycomb of hex cells. Each filled cell holds one worker — Forager, Geomancer, or Cantor — and assignments are permanent. The player scales by buying more workers and unlocking more cells, not by building more hives. Adjacency synergy between same-role neighbors rewards cluster planning.

### Cells

- Start with three empty cells in a small connected cluster.
- New cells unlock outward from the comb at exponential cost (`cellCost(q, r)`).
- The first worker placed must be a Forager (otherwise the colony soft-locks: no mana, no spells).
- Workers cost pollen; the first of each role is free.

### Flowers

- Live in the meadow at predetermined positions.
- Each has a **yield counter** (default 5 harvests) and a **regrow timer** (default 60 sec).
- Multiple foragers can share a flower — its remaining bloom is the claim cap.

### Dig site

- A single boulder dominates the right side of the meadow.
- Spellcasters (Geomancer, Cantor) damage it; foragers do not.
- At 0 HP the site flips to `revealing`, the next artifact pends, and on dismiss the next tier (bigger HP) takes its place.

## Bee state machines

### Forager (unchanged from the prior MVP, with honey-refining at deposit)

```
IDLE
   ↓ pick a free flower (else wait)
FLYING_TO_FLOWER
   ↓ arrive
HARVESTING (~3 sec, claims one of the flower's bloom slots)
   ↓ flower yield -= 1, bee.carrying = pollen × pouchCapacity
FLYING_HOME
   ↓ arrive
DEPOSIT
   ↓ state.hive.pollen += carryAmount
   ↓ refineHoney(state, carryAmount)  // tops up honey up to honeyCap
IDLE (loop)
```

### Geomancer (one-shot, mana-gated)

```
IDLE
   ↓ dig site active?
   ↓ try spendHoney(2)
        - fail → enter IDLE_SWARM (drift near comb for ~3 sec, retry IDLE)
        - success → continue
FLYING_TO_HOVER (climb above the impact point)
   ↓ arrive
HOVERING (~380ms bob — anticipation)
   ↓
DIVING (180ms straight-down ease-in)
   ↓ contact: damage dig site, big dust burst
STRIKING_IMPACT (70ms splat)
   ↓
BOUNCING (~360ms tumble outward)
   ↓
EXPIRED → cell respawns a fresh geomancer on a cooldown
```

Note the mana check fires at the moment the bee commits to fly — *not* on impact. This avoids the awkward "fly all that way for nothing" pattern and gives immediate feedback (the reservoir drops the instant the bee launches).

### Cantor (persistent, mana-gated, hover-cast)

```
IDLE
   ↓
CANTOR_RISING (climb to hover slot above home cell)
   ↓ arrive
CANTOR_HOVERING
   ↓ bob in place; cast timer counts down
   ↓ when timer hits 0: try spendHoney(1)
        - fail → enter IDLE_SWARM (retry hovering when swarm timer expires)
        - success → continue
   ↓ apply damage to dig site
   ↓ World.emitSpark(origin → strikePoint)  // cosmetic projectile
   ↓ optional Mana Sip refund every Nth cast
CANTOR_CASTING (~160ms recoil pose)
   ↓
CANTOR_HOVERING (loop; cast timer reset to cantorCastIntervalMs)
```

Cantors never expire — they keep hovering and casting as long as the cell exists.

### Idle swarm (shared)

When any spellcaster can't pay for its next cast, it falls into `idle-swarm`. The shared loop picks a small wander target near the home cell, drifts toward it, occasionally repicks, and exits back to `idle` after `SPELL_IDLE_RETRY_MS` (~3 sec). On exit, the bee retries its mana check. With multiple casters and no foragers, the meadow fills with a visible buzzing cloud near the hive — the "we're out of mana" beat that telegraphs to the player exactly what's wrong.

## Resource state model (sim)

```ts
interface HiveData {
  id: string;
  pollen: number;     // upgrade currency, uncapped
  honey: number;      // mana, ≤ honeyCap
  honeyCap: number;   // default 10; future upgrades may grow it
  cells: HiveCell[];  // hex cells with optional role assignment
}
```

The `Bee` class gains role-specific fields:

- All: `seed`, `flapPhase`, `idleWaitMs`, `consecutiveIdleResets`.
- Geomancer: `impactX/Y`, `windupX/Y`, `ramDirX/Y`, single-strike timers.
- Cantor: `castTimerMs`, `castCount`, `hoverX/Y`.

`spendHoney`, `refineHoney`, and `manaCostFor` are pure helpers in `state.ts`.

## Tuning (current placeholders)

- Honey cap: **10**.
- Forager round-trip: ~10 sec/pollen.
- Geomancer mana cost: 2 honey/cast. Base damage: 1.
- Cantor mana cost: 1 honey/cast. Base damage: 0.35. Cast interval: 2.4 sec.
- Idle swarm retry: 2.8 sec.

Roughly: a single Forager → Geomancer + single Cantor pair should chip the tier-1 rock open in a couple of minutes, with the Forager often catching up to the mana drain. Tighten/loosen `HONEY_CAP`, mana costs, and forager throughput in `TUNING` once we've watched real play.
