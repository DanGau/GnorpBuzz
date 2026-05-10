# GnorpBuzz — Engine Architecture

The MVP architecture. Designed to extend cleanly into Phase 2+ without rewrites, but no system in here exists for Phase 2+ alone.

See `docs/mvp-scope.md` for what's in scope.

## Layer overview

```
┌──────────────────────────────────────────────────────┐
│  Layer 3 — UI (HTML overlay)                         │
│   ResourceBar, BuyHivePanel, VesselProgress, Journal │
└──────────┬───────────────────────────────────────────┘
           │ reads sim state, dispatches Actions
┌──────────┴───────────────────────────────────────────┐
│  Layer 2 — Presentation (Pixi)                       │
│   WorldView, HiveView, BeeView, VesselView, FlowerView
└──────────┬───────────────────────────────────────────┘
           │ reads sim state and world state per frame
┌──────────┴───────────────────────────────────────────┐
│  Layer 1b — World (game objects)                     │
│   Bee, Hive (positioned), Flower — agent-like.       │
│   Animated; visual companion to the sim.             │
└──────────┬───────────────────────────────────────────┘
           │ created/updated based on sim state
┌──────────┴───────────────────────────────────────────┐
│  Layer 1a — Sim (pure data + functions)              │
│   GameState, Systems, Actions, Save/Load.            │
│   Headlessly testable; no Pixi, no DOM.              │
└──────────────────────────────────────────────────────┘
```

The split between **1a (sim)** and **1b (world)** is deliberate: the sim is "the spreadsheet," the world is "the diorama." The sim is authoritative for resources, costs, production rates, vessel progress, journal state. The world is authoritative for *where things are and what they're doing visually*. The world reacts to sim state (when sim adds a bee to a hive, world spawns a Bee entity); the sim does not care where world entities are.

## Layer 1a — Sim (`src/sim/`)

### `GameState` — single plain-data object

```ts
interface GameState {
  tick: number;
  elapsedMs: number;
  resources: { wax: number };
  hives: HiveData[];                  // worker hives only in MVP
  queen: { fillProgressMs: number };  // ms toward next slot fill
  vessel: { progress: number; cost: number; phase: VesselPhase; launchTimer: number };
  journal: { entries: JournalEntry[]; pending: boolean };
}

interface HiveData { id: string; type: 'worker'; slots: number; bees: number; }
type VesselPhase = 'building' | 'launching' | 'crashed' | 'reviewed';
interface JournalEntry { id: string; tier: number; text: string; }
```

### `Systems` — pure functions, called each tick

```ts
productionSystem(state, dtMs)     // wax += totalBees × waxPerBeePerSec × (dt/1000)
queenSystem(state, dtMs)          // accumulate fillProgressMs; fill empty slot at 60_000ms
constructionSystem(state, dtMs)   // flow wax into vessel.progress (bounded by available wax)
launchSystem(state, dtMs)         // run launch/crash animation timer; transition phase
journalSystem(state)              // when vessel.phase becomes 'crashed', set journal.pending
```

Order is fixed in `Game.update`. Each system mutates `state` in place.

### `Actions` — UI-dispatched mutators

```ts
buyWorkerHive(state) → { ok: boolean; reason?: string }
dismissJournal(state) → void           // sets phase to 'reviewed', resets vessel for next launch
```

Actions are the *only* way the UI can mutate state. They return success/failure so the UI can flash or beep.

### `Save / Load`

```ts
serialize(state) → string
deserialize(string) → GameState
```

Triggered after every Action; reads at game init.

## Layer 1b — World (`src/world/`)

The world is a parallel object graph holding *positioned, animated* entities. It's reconciled against sim state each frame: if sim says a hive has 3 bees and world has 2 Bee entities for that hive, world spawns one more.

### Entities

- **`Bee`** — has position, velocity, behavior state (`idle | flyingToFlower | pollinating | returningToHive`), home hive ID. Updates per tick. Cosmetic; doesn't produce wax (sim does).
- **`HiveEntity`** — positioned representation of a sim hive. Has a slot in the meadow (predetermined positions for MVP — first hive at slot 0, second at slot 1, etc.). Holds references to its Bee entities.
- **`FlowerEntity`** — meadow flowers that bees visit. Static for MVP; later phases turn them into the nectar-click mini-event.

### Reconciliation

A `WorldReconciler` runs each tick:

1. For each `HiveData` in sim, ensure a `HiveEntity` exists at its assigned slot.
2. For each hive, ensure entity bee count matches `HiveData.bees`. Spawn or despawn Bee entities as needed.
3. World entities run their own update step (movement, behavior).

This keeps the sim ignorant of positions and the world ignorant of economy.

## Layer 2 — Presentation (`src/view/`)

Each view owns a Pixi `Container`. Views read sim and world state and update Pixi objects every frame. They never mutate state.

- **`WorldView`** — meadow background, sky gradient, stars, flower (the goal in the sky). Mostly static for MVP.
- **`HiveView`** — renders a hive sprite per `HiveEntity`.
- **`BeeView`** — renders a bee sprite per `Bee` entity, positioned per the entity's current position.
- **`VesselView`** — renders the airplane being assembled at center; transitions to launching/crashing animation based on `vessel.phase`.
- **`FlowerView`** — the goal flower in the upper sky.

A top-level `WorldRenderer` aggregates these and is the only Layer-2 surface `Game.ts` knows about.

## Layer 3 — UI (`src/ui/`)

Vanilla TypeScript classes that hold DOM refs and re-render on a state-change event. No framework.

- **`ResourceBar`** — wax counter; updates per frame for smooth count-up animation.
- **`BuyHivePanel`** — shows next-hive cost (computed from sim), button, disabled when insufficient.
- **`VesselProgress`** — progress bar fed from `state.vessel.progress`.
- **`JournalModal`** — renders when `state.journal.pending`, dismissible. Calls `dismissJournal` Action on close.

A tiny `Observer` utility in `src/sim/` emits a `'changed'` event on every Action; HTML widgets that need event-driven updates subscribe. Pixi views just read state every frame.

## Render trigger

- **Pixi views:** updated every tick (cheap; handful of sprites).
- **HTML UI:** mostly per-frame too (the resource counter wants smooth counting). Modal-style widgets (journal) react to state-change events.

## Layer 0 — Glue (`Game.ts`, evolved)

```ts
class Game {
  state: GameState;            // sim
  world: World;                // world entities + reconciler
  renderer: WorldRenderer;     // Pixi views
  ui: UI;                      // HTML widgets

  update(dtMs) {
    // Sim
    productionSystem(this.state, dtMs);
    queenSystem(this.state, dtMs);
    constructionSystem(this.state, dtMs);
    launchSystem(this.state, dtMs);
    journalSystem(this.state);

    // World
    this.world.reconcile(this.state);
    this.world.update(dtMs);

    // Views
    this.renderer.update(this.state, this.world);
    this.ui.update(this.state);
  }

  // Actions called by UI
  buyWorkerHive() { Actions.buyWorkerHive(this.state); save(this.state); this.emit('changed'); }
  dismissJournal() { Actions.dismissJournal(this.state); save(this.state); this.emit('changed'); }
}
```

`manualUpdate(dtMs)` keeps working — same flow without `renderer.update` (or with it; `skipRendering` already handles that). `window.debug` keeps working. The verification harness keeps working.

## Proposed file layout

```
app/src/
  main.ts                  // entry point, mounts Game
  game/
    Game.ts                // orchestrator (existing, evolved)
  sim/
    state.ts               // GameState type + initial state
    systems/
      production.ts
      queen.ts
      construction.ts
      launch.ts
      journal.ts
    actions.ts             // buyWorkerHive, dismissJournal
    save.ts                // serialize/deserialize/localStorage
    observer.ts            // tiny event emitter for UI
  world/
    World.ts               // top-level container, reconciler, update
    Bee.ts
    HiveEntity.ts
    FlowerEntity.ts
    layout.ts              // hive slot positions, etc.
  view/
    WorldRenderer.ts       // top-level aggregator
    WorldView.ts           // background
    HiveView.ts
    BeeView.ts
    VesselView.ts
    FlowerView.ts
  ui/
    UI.ts                  // top-level mounter
    ResourceBar.ts
    BuyHivePanel.ts
    VesselProgress.ts
    JournalModal.ts
```

## Extension path (parking lot)

When we move past MVP, the points of growth are:

- **More hive types** — add to `HiveData['type']` union, add cost-curve config, add corresponding `HiveView` variants.
- **Upgrades** — new `state.upgrades` slice + a `multipliers.ts` that derives multipliers from upgrade state, consumed by Systems.
- **More resources** — extend `state.resources`, extend `productionSystem`, add UI counters.
- **Conversion ratios (Phase 3)** — new `refinerySystem` that flows resources between buckets.
- **Active layer (nectar flowers)** — `FlowerEntity` gains click handlers + a spawn lifecycle; new Action `harvestFlower(state, flowerId)`.
- **Phase 4 colonization** — new vessel kind, second-Queen state, win-state condition.

None of these require restructuring layers — they slot into existing buckets.
