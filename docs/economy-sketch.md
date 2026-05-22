# Economy Sketch — Pollen → Worker → {Honey, Wax}

**Status:** built (save v9). Sim, UI, and visuals land this loop end-to-end.
The current shape supersedes the per-cell-pile model in this doc — see the
"What we actually built" section below. The original sketch and its open
questions are kept for historical reference.

**v9 changes:** the underground chamber tech-tree was removed entirely.
Upgrades are now **contextual panels** anchored to world objects — click the
Pollen Silo (Forager upgrades), Honey Jar (Cantor), Wax Block (Wax Worker),
or the geomancer rune stone (Geomancer). Clicking a building also pans a
dedicated camera to frame it (a shared side-on "economy" view for the three
refinery buildings; a combat-side view for the rune stone). Upgrades are
cost-gated by wax only — no dig/unlock step. A new **Wax Worker** upgrade
group was introduced: Swift Haul (+move speed), Rich Combs (+wax per
delivery), Deep Coffers (+wax cap). The hive hex grid and its zoom remain,
just without the underground band beneath it.

## What we actually built (v8)

The per-cell pollen pile turned out to be the wrong abstraction. Bees should
*never* use the comb grid as a destination — the comb is a population dial
(how many of each role exist), and all physical bee work happens at three
visible **buildings** sitting around the hive:

```
   LEFT ............... MIDDLE ............... RIGHT
   (economy)            (refinery+casting)     (combat)

   Pollen Silo          Honey Jar                rune stone (geomancers)
   (woven basket,       (glass + wax,             ↓ ↓ ↓
   ground level)        above hive)              the BOULDER
   Wax Block
   (stacked hex flakes,
   ground level)
```

- **Pollen Silo** (`WORLD.POLLEN_SILO`): foragers deposit pollen here.
  Capped at `TUNING.POLLEN_CAP` (20). Renders as a woven basket on the
  meadow ground with a visible pile of pollen rising inside as the pool
  fills; numeric `pollen/cap` label below.
- **Honey Jar** (`WORLD.HONEY_JAR`, existing `HoneyBarView`): honey workers
  deposit, spellcasters draw. Capped at `TUNING.HONEY_CAP` (10). Unchanged.
- **Wax Block** (`WORLD.WAX_BLOCK`): wax workers deposit. Capped at
  `TUNING.WAX_CAP` (40). Renders as a growing stack of hex-shaped wax flakes
  on a pallet; stack height tracks the pool, alternating tile colors give
  it texture, brief flash on each deposit.

All three pools are **capped**. The cap is the *visible* "you need to
spend" beat: when a destination is full, the supplier bees idle visibly at
their park spot. Concrete tells:

| What the player sees | What's full |
|----------------------|-------------|
| Foragers loitering at the Pollen Silo, not going to the meadow | Pollen Silo at cap |
| Honey workers bobbing at the Honey Jar, not picking from the Silo | Honey at cap (spend mana) |
| Wax workers bobbing at the Wax Block | Wax at cap (spend on upgrades) |
| Honey/Wax workers idling, casters idle-swarming, Silo empty | Need more foragers |

### Bee routing (v8)

| Role | Park (idle) | Out trip | Home trip |
|------|-------------|----------|-----------|
| **Forager** | near Pollen Silo | fly to flower → harvest | fly to Pollen Silo → deposit → return to park |
| **Honey Worker** | near Honey Jar | fly to Pollen Silo → pluck | fly to Honey Jar → +1 honey → return to park |
| **Wax Worker** | near Wax Block | fly to Pollen Silo → pluck | fly to Wax Block → +1 wax → return to park |
| **Geomancer** | rune stone (mid-sky) | dive at boulder, burn 2 mana | (one-shot, respawns) |
| **Cantor** | honey jar (above hive) | hover-cast, burn 1 mana | (persistent) |

### Other deltas from the original sketch

- Single "Worker" with a `workerMode` toggle became **two distinct cell
  roles** (`honey-worker`, `wax-worker`). Cleaner data; the visible mix on
  the comb is still the allocation dashboard.
- Starting cells bumped from **3 → 4** so the player can place
  Forager + Honey + Wax + (Geomancer or Cantor) all free on first session.
- Per-cell `pollenPile` removed entirely — global silo replaces it.
- `forager-pollen-pouches` upgrade removed (Foragers always carry 1).
  Forager Den dropped from 3 → 2 upgrades; a third slot will return later.

## Original sketch (historical)


## Why change

Current flow collapses two distinct economic pressures into one deposit:
foragers credit both pollen (upgrades) and honey (mana) on the same drop. That
works as a placeholder, but it hides the *processing* step that ought to be the
most visible thing on the comb. We want a real conveyor: raw material in,
finished goods out, with the player able to *see* the bottleneck.

## The new loop

```
meadow flower
   ↓  Forager flies out, harvests, carries ONE pollen dot home
hive comb (drop tile)
   ↓  visible little yellow pile of pollen dots accumulates
Worker bee (new role)
   ↓  walks/hovers from its home cell to the pile, picks up one dot
   ↓  carries it to its assigned station:
        ├── Honey Vat cell  → fills the honey reservoir (mana for spells)
        └── Wax Forge cell  → extrudes a wax flake onto the wax pile (upgrades)
```

Three pools, three shapes:

| Resource | Source | Cap | Used for |
|----------|--------|-----|----------|
| **Pollen** | Foragers, one per trip | Soft cap = comb drop-tile capacity | Raw input only — workers consume it |
| **Honey** | Workers routed to a Honey Vat | Hard cap (reservoir size) | Spell casts (Geomancer 2, Cantor 1) |
| **Wax** | Workers routed to a Wax Forge | Uncapped | All upgrades, chamber digs, new cells |

Pollen is no longer the upgrade currency. Wax is. Pollen becomes a *transient*
buffer between gathering and refining — when it piles up, the player can see
the surplus; when it's empty, foragers are the bottleneck.

## Why this is visually rich

- **Pollen dots travel.** Forager → comb pile → worker → station. Three legs of
  a physical conveyor, all on-screen.
- **Piles grow and shrink.** Pollen pile, wax pile, honey reservoir fill level
  — three visible gauges built into the world, not the HUD.
- **Bottlenecks are legible without text.**
  - Pollen pile huge → not enough Workers (or too few stations).
  - Pollen pile empty, vats dry → not enough Foragers.
  - Wax pile flat → workers all routed to honey; tilt the mix.
  - Honey reservoir overflowing → too many honey workers, not enough casters.
- **Thematic payoff.** Wax is *what the comb is made of.* The same resource the
  hive produces is the substance new cells and chambers are built from. Future
  hook: extending the comb visibly consumes wax from the pile.

## The Worker role

A fourth worker caste alongside Forager / Geomancer / Cantor. Workers are
mundane (non-spellcaster), like Foragers, but they never leave the comb.

**State machine (sketch):**

```
IDLE (at home cell)
   ↓  is there pollen on a drop tile within reach? (else wait/bob)
WALKING_TO_PILE
   ↓  arrive, pluck one pollen dot
CARRYING_TO_STATION (assigned: honey vat OR wax forge)
   ↓  arrive
DEPOSITING (~400ms little animation — pour into vat OR press into wax flake)
   ↓  honey += 1  (clamped to honeyCap; surplus is lost or pollen stays)
   ↓  OR wax += 1
IDLE (loop)
```

**Assignment lives in the comb layout, not a slider.** Each Worker cell is
toggled at placement (or via radial menu) to feed *either* honey or wax. To
re-balance, the player retoggles cells. This keeps allocation spatial and
visible — you can *see* the honey-vs-wax mix by counting the colored cells.

## Cell types (new)

- **Forager cell** — unchanged. Spawns a Forager that flies to the meadow.
- **Worker cell** — spawns a Worker. Cell has a sub-state: `honey` or `wax`.
- **Honey Vat cell** — the destination. Visibly fills with honey. There can be
  one or many; honey produced by any worker feeds the shared `honey` pool, but
  *which vat the worker walks to* is a visual detail that should pick the
  nearest non-full vat.
- **Wax Forge cell** — the destination for wax-routed workers. Wax flakes stack
  on/around the cell visibly until spent on an upgrade.
- **Drop tile** — could be implicit (every Forager cell *is* its own drop tile,
  pollen accumulates on the cell it was deposited at) or explicit (dedicated
  drop cells). Start with implicit; revisit if routing looks ugly.

Geomancer and Cantor cells unchanged — they pull from the honey pool, not
directly from any vat.

## Forager change

- Forager pouch capacity = **1 pollen, always.** Removes `pouchCapacity` as a
  tuning lever; throughput scales by adding foragers, not by upgrading them to
  carry more. (Forager Den upgrades shift to speed / round-trip / synergy.)
- On deposit: pollen pile on the forager's home cell += 1. No more direct
  honey refining.

## Cost model migration

All existing pollen prices (cells, chambers, workers, upgrades) get re-denominated
in **wax**. Rough rule: same number, new label — then retune after we watch real
play. Some specifics worth deciding before implementation:

- **Cell unlocks** — wax.
- **Worker / Forager / Geomancer / Cantor purchase** — wax.
- **Chamber digs** — wax.
- **Upgrades inside chambers** — wax.

Pollen is never spent by the player directly. It only exists as the on-comb
buffer between foragers and workers.

## Tuning skeleton (placeholder numbers)

- Forager round-trip: ~10s for 1 pollen (unchanged).
- Worker round-trip (cell → pile → station → cell): ~3-4s for 1 unit.
- Honey per worker-trip: 1 (mana cost stays at Geomancer 2 / Cantor 1).
- Wax per worker-trip: 1.
- Pollen pile soft cap per cell: ~5 dots (after which Foragers see the cell as
  "full" and choose a different home or idle briefly — visible backpressure).
- Worker cell first-of-role free; subsequent ones cost wax.

Tune the ratio of foragers : workers : casters by feel once it's on screen.
Expectation: a healthy early colony is roughly 2 foragers : 2 workers (1 honey,
1 wax) : 2 casters, give or take.

## Open questions (defer until prototype)

1. **Pile location.** On the Forager's own cell (implicit drop) vs a central
   shared drop tile vs adjacency to Worker cells. Implicit is simplest;
   centralized makes worker routing more interesting.
2. **Overflow behavior.** When the honey reservoir is full, does a
   honey-routed worker idle, switch to wax temporarily, or just drop its pollen
   back on the pile? Idle is the most legible.
3. **Wax as comb substance.** Should extending the comb consume *visible* wax
   from the pile (literal builder bees)? Cute but adds a fourth animation; park
   for v2 of this system.
4. **Adjacency synergy for Workers.** Worker-next-to-Worker speed bonus is the
   obvious analogue. Worker-next-to-station gives a shorter walk for free
   — emergent without explicit synergy code.
5. **Save migration.** v6 → v7. Old saves either get wiped or auto-converted
   (pollen balance → wax balance is the easy path).

## Knock-on doc updates (when this lands)

- `game-design.md` — rewrite the Resources table; add Worker to the caste list.
- `agent-behavior.md` — add Worker state machine; rewrite Forager deposit step.
- `mvp-scope.md` — bump scope to four roles; honey-cap and wax both appear in
  the HUD.
- `dps-model.md` — Forager `pouchCapacity` removed; new Worker throughput term.
- `population.md` — add Worker to caste counts.
- `underground.md` — Worker Hall chamber (or fold into Forager Den).
