import { Application, Container, Ticker } from 'pixi.js';
import type { GameState, HiveType } from '../sim/state';
import {
  createInitialState,
  totalPollen,
  spendableWax,
  nextBeeCost,
} from '../sim/state';
import { flowerSystem } from '../sim/systems/flowers';
import { vesselSystem } from '../sim/systems/vessel';
import { launchSystem } from '../sim/systems/launch';
import { journalSystem } from '../sim/systems/journal';
import { buyBee, dismissJournal, launchVessel, buildHive } from '../sim/actions';
import type { ActionResult } from '../sim/actions';
import { saveToStorage, loadFromStorage, clearStorage } from '../sim/save';
import { Observer } from '../sim/observer';
import { World } from '../world/World';
import { WorldRenderer } from '../view/WorldRenderer';
import { UI } from '../ui/UI';

export interface GameSnapshot {
  tick: number;
  elapsedMs: number;
  paused: boolean;
  pollen: number;
  wax: number;
  hives: { id: string; type: string; bees: number; pollen?: number; waxBlocks?: number }[];
  flowers: { id: string; yieldRemaining: number; regrowMs: number; claimed: boolean }[];
  totalBees: number;
  vessel: { delivered: number; required: number; phase: string };
  journal: { pending: boolean; entries: number };
  nextForagerCost: number;
  nextWaxCost: number;
}

export class Game {
  readonly app: Application;
  readonly stage: Container;
  state: GameState;
  readonly observer: Observer;
  readonly world: World;
  readonly renderer: WorldRenderer;
  ui?: UI;

  // UI selection state — which hive (if any) is currently focused. Drives
  // panel visibility and the in-world building highlight. Not part of the
  // sim, not persisted in saves.
  // Selection target — a hive id or the special VESSEL_ID. Drives panel
  // visibility and the in-world highlight. Not part of the sim, not saved.
  selectedId: string | null = null;

  private paused = false;
  private skipRendering = false;
  private lastDeltaMs = 16.7;
  private boundUpdate = (ticker: Ticker) => this.update(ticker.deltaMS);

  constructor() {
    this.app = new Application();
    this.stage = new Container();
    this.state = loadFromStorage() ?? createInitialState();
    this.observer = new Observer();
    this.world = new World();
    this.renderer = new WorldRenderer({
      onHiveClick: (hiveId: string) => this.toggleSelection(hiveId),
      onVesselClick: () => this.toggleSelection('vessel'),
      onBackgroundClick: () => this.select(null),
    });
    this.world.reconcile(this.state);
  }

  // ---- UI state ----

  select(id: string | null): void {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.observer.emit();
    if (this.ui) this.ui.update();
  }

  toggleSelection(id: string): void {
    this.select(this.selectedId === id ? null : id);
  }

  async init(mount: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: mount,
      background: 0x101418,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    mount.appendChild(this.app.canvas);
    this.app.stage.addChild(this.stage);
    this.renderer.attach(this.app, this.stage, this.world);
    this.app.ticker.add(this.boundUpdate);
  }

  private runSystems(dtMs: number): void {
    this.state.tick += 1;
    this.state.elapsedMs += dtMs;
    flowerSystem(this.state, dtMs);
    this.world.reconcile(this.state);
    this.world.update(dtMs, this.state);
    vesselSystem(this.state);
    launchSystem(this.state, dtMs);
    journalSystem(this.state);
    this.lastDeltaMs = dtMs;
    this.renderer.update(this.state, this.world, dtMs, this.selectedId);
    if (this.ui) this.ui.update();
  }

  private update(deltaMS: number): void {
    if (this.paused) return;
    this.runSystems(deltaMS);
  }

  manualUpdate(deltaMS: number): void {
    this.runSystems(deltaMS);
  }

  pause(): void {
    this.paused = true;
    this.app.ticker.stop();
  }

  resume(): void {
    this.paused = false;
    this.app.ticker.start();
  }

  isPaused(): boolean {
    return this.paused;
  }

  snapshot(): GameSnapshot {
    const totalBees = this.state.hives.reduce((sum, h) => sum + h.bees, 0);
    return {
      tick: this.state.tick,
      elapsedMs: this.state.elapsedMs,
      paused: this.paused,
      pollen: totalPollen(this.state),
      wax: spendableWax(this.state),
      hives: this.state.hives.map((h) => ({
        id: h.id,
        type: h.type,
        bees: h.bees,
        pollen: h.type === 'forager' ? h.pollen : undefined,
        waxBlocks: h.type === 'wax' ? h.waxBlocks : undefined,
      })),
      flowers: this.state.flowers.map((f) => ({
        id: f.id,
        yieldRemaining: f.yieldRemaining,
        regrowMs: f.regrowTimerMs,
        claimed: f.claimedByBeeId !== null,
      })),
      totalBees,
      vessel: {
        delivered: this.state.vessel.deliveredBlocks,
        required: this.state.vessel.requiredBlocks,
        phase: this.state.vessel.phase,
      },
      journal: {
        pending: this.state.journal.pending,
        entries: this.state.journal.entries.length,
      },
      nextForagerCost: nextBeeCost(this.state, 'forager'),
      nextWaxCost: nextBeeCost(this.state, 'wax'),
    };
  }

  advanceTicks(n: number): GameSnapshot {
    const dt = 1000 / 60;
    for (let i = 0; i < n; i++) this.manualUpdate(dt);
    return this.snapshot();
  }

  render(): void {
    if (this.skipRendering) return;
    this.world.reconcile(this.state);
    this.renderer.update(this.state, this.world, this.lastDeltaMs, this.selectedId);
    this.app.renderer.render(this.app.stage);
  }

  stepAndRender(n: number): GameSnapshot {
    const snap = this.advanceTicks(n);
    this.render();
    return snap;
  }

  // ---- Actions (UI-callable mutators) ----

  buyBee(type: HiveType): ActionResult {
    const result = buyBee(this.state, type);
    if (result.ok) {
      saveToStorage(this.state);
      this.observer.emit();
      if (this.ui) this.ui.update();
    }
    return result;
  }

  buildHive(type: HiveType): ActionResult {
    const result = buildHive(this.state, type);
    if (result.ok) {
      saveToStorage(this.state);
      this.observer.emit();
      if (this.ui) this.ui.update();
    }
    return result;
  }

  launchVessel(): ActionResult {
    const result = launchVessel(this.state);
    if (result.ok) {
      saveToStorage(this.state);
      this.observer.emit();
      if (this.ui) this.ui.update();
    }
    return result;
  }

  dismissJournal(): ActionResult {
    const result = dismissJournal(this.state);
    if (result.ok) {
      saveToStorage(this.state);
      this.observer.emit();
      if (this.ui) this.ui.update();
    }
    return result;
  }

  resetGame(): void {
    clearStorage();
    this.state = createInitialState();
    this.world.reconcile(this.state);
    this.observer.emit();
  }

  attachDebugInterface(): void {
    const dbg = {
      snapshot: () => this.snapshot(),
      pause: () => this.pause(),
      resume: () => this.resume(),
      isPaused: () => this.isPaused(),
      advanceTicks: (n: number) => this.advanceTicks(n),
      render: () => this.render(),
      stepAndRender: (n: number) => this.stepAndRender(n),
      buyForagerBee: () => this.buyBee('forager'),
      buyWaxBee: () => this.buyBee('wax'),
      buyBuilderBee: () => this.buyBee('builder'),
      buildWaxHive: () => this.buildHive('wax'),
      buildBuilderHive: () => this.buildHive('builder'),
      launchVessel: () => this.launchVessel(),
      dismissJournal: () => this.dismissJournal(),
      resetGame: () => this.resetGame(),
      worldSnapshot: () => this.world.snapshot(),
      select: (id: string | null) => this.select(id),
      selectedId: () => this.selectedId,
    };
    (window as unknown as { debug: typeof dbg }).debug = dbg;
  }
}
