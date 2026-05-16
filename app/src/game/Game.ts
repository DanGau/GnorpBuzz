import { Application, Container, Ticker } from 'pixi.js';
import type { GameState, CellRole } from '../sim/state';
import {
  createInitialState,
  totalPollen,
  totalBees,
  countRole,
  nextWorkerCost,
  digSiteHpPct,
} from '../sim/state';
import { flowerSystem } from '../sim/systems/flowers';
import { digSiteSystem } from '../sim/systems/dig-sites';
import { artifactSystem } from '../sim/systems/artifact';
import { ascentSystem } from '../sim/systems/ascent';
import {
  buyCell,
  assignCell,
  dismissArtifact,
  buyUpgrade,
  damageDigSite,
} from '../sim/actions';
import type { UpgradeId } from '../sim/state';
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
  cells: { q: number; r: number; role: string | null }[];
  totalBees: number;
  foragers: number;
  excavators: number;
  digSite: { tier: number; hp: number; maxHp: number; state: string; hpPct: number };
  artifacts: { revealed: string[]; pending: string | null };
  journal: { pending: boolean; entries: number };
  ascent: { phase: string; timer: number };
  nextForagerCost: number;
  nextExcavatorCost: number;
}

export class Game {
  readonly app: Application;
  readonly stage: Container;
  state: GameState;
  readonly observer: Observer;
  readonly world: World;
  readonly renderer: WorldRenderer;
  ui?: UI;

  // UI selection. `selectedId` covers the dig site ('dig-site' or null);
  // `selectedCell` is the hex cell the player has open in the cell panel.
  selectedId: string | null = null;
  selectedCell: { q: number; r: number } | null = null;

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
      onHiveClick: () => this.select('hive'),
      onCellClick: (q: number, r: number) => this.toggleCell(q, r),
      onDigSiteClick: () => this.toggleSelection('dig-site'),
      onBackgroundClick: () => this.stepOutSelection(),
      onBuyCell: (q: number, r: number) => this.buyCell(q, r),
      onAssignCell: (q: number, r: number, role: CellRole) => this.assignCell(q, r, role),
    });
    this.world.reconcile(this.state);
  }

  private notify(): void {
    this.observer.emit();
    if (this.ui) this.ui.update();
  }

  select(id: string | null): void {
    if (this.selectedId === id && this.selectedCell === null) return;
    this.selectedId = id;
    this.selectedCell = null;
    this.notify();
  }

  toggleSelection(id: string): void {
    this.select(this.selectedId === id ? null : id);
  }

  selectCell(q: number, r: number): void {
    this.selectedCell = { q, r };
    this.selectedId = null;
    this.notify();
  }

  toggleCell(q: number, r: number): void {
    if (this.selectedCell && this.selectedCell.q === q && this.selectedCell.r === r) {
      // Closing a cell's panel falls back to the whole-hive selection so
      // the camera stays zoomed in — leaving the hive is a separate action.
      this.select('hive');
    } else {
      this.selectCell(q, r);
    }
  }

  clearSelection(): void {
    if (this.selectedId === null && this.selectedCell === null) return;
    this.selectedId = null;
    this.selectedCell = null;
    this.notify();
  }

  // Step out one selection layer: a click outside the radial menu closes it
  // (cell → hive), but a second click is needed to leave the zoomed-in hive
  // (hive → overview). Prevents one stray click from rocketing the camera
  // out from under the player.
  stepOutSelection(): void {
    if (this.selectedCell !== null) {
      this.select('hive');
    } else {
      this.clearSelection();
    }
  }

  // True when the camera is (or is heading) zoomed into the hive.
  get isZoomedIn(): boolean {
    return this.selectedCell !== null || this.selectedId === 'hive';
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

    // Esc backs out of any selection — a natural way to leave the
    // zoomed-in hive view.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.stepOutSelection();
    });
  }

  private runSystems(dtMs: number): void {
    this.state.tick += 1;
    this.state.elapsedMs += dtMs;
    flowerSystem(this.state, dtMs);
    this.world.reconcile(this.state);
    this.world.update(dtMs, this.state);
    digSiteSystem(this.state);
    artifactSystem(this.state);
    ascentSystem(this.state, dtMs);
    this.lastDeltaMs = dtMs;
    this.renderer.update(this.state, this.world, dtMs, this.selectedId, this.selectedCell);
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
    return {
      tick: this.state.tick,
      elapsedMs: this.state.elapsedMs,
      paused: this.paused,
      pollen: totalPollen(this.state),
      cells: this.state.hive.cells.map((c) => ({ q: c.q, r: c.r, role: c.role })),
      totalBees: totalBees(this.state),
      foragers: countRole(this.state, 'forager'),
      excavators: countRole(this.state, 'excavator'),
      digSite: {
        tier: this.state.digSite.tier,
        hp: this.state.digSite.hp,
        maxHp: this.state.digSite.maxHp,
        state: this.state.digSite.state,
        hpPct: digSiteHpPct(this.state),
      },
      artifacts: {
        revealed: [...this.state.artifacts.revealed],
        pending: this.state.artifacts.pending,
      },
      journal: {
        pending: this.state.journal.pending,
        entries: this.state.journal.entries.length,
      },
      ascent: { phase: this.state.ascent.phase, timer: this.state.ascent.timer },
      nextForagerCost: nextWorkerCost(this.state, 'forager'),
      nextExcavatorCost: nextWorkerCost(this.state, 'excavator'),
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
    this.renderer.update(this.state, this.world, this.lastDeltaMs, this.selectedId, this.selectedCell);
    this.app.renderer.render(this.app.stage);
  }

  stepAndRender(n: number): GameSnapshot {
    const snap = this.advanceTicks(n);
    this.render();
    return snap;
  }

  // ---- Actions ----

  private commit(result: ActionResult): ActionResult {
    if (result.ok) {
      saveToStorage(this.state);
      this.notify();
    }
    return result;
  }

  buyCell(q: number, r: number): ActionResult {
    return this.commit(buyCell(this.state, q, r));
  }

  assignCell(q: number, r: number, role: CellRole): ActionResult {
    return this.commit(assignCell(this.state, q, r, role));
  }

  buyUpgrade(id: UpgradeId): ActionResult {
    return this.commit(buyUpgrade(this.state, id));
  }

  dismissJournal(): ActionResult {
    return this.commit(dismissArtifact(this.state));
  }

  resetGame(): void {
    clearStorage();
    this.state = createInitialState();
    this.selectedId = null;
    this.selectedCell = null;
    this.world.reconcile(this.state);
    this.notify();
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
      buyCell: (q: number, r: number) => this.buyCell(q, r),
      assignCell: (q: number, r: number, role: CellRole) => this.assignCell(q, r, role),
      buyUpgrade: (id: UpgradeId) => this.buyUpgrade(id),
      dismissJournal: () => this.dismissJournal(),
      damageDigSite: (amount: number) => this.commit(damageDigSite(this.state, amount)),
      grantPollen: (amount: number) => {
        this.state.hive.pollen += amount;
        saveToStorage(this.state);
        this.notify();
        return { ok: true };
      },
      worldBees: () => {
        const result: { q: number; r: number; role: string; alive: number; respawning: number }[] = [];
        for (const cell of this.world.hive.cells.values()) {
          result.push({
            q: cell.q,
            r: cell.r,
            role: cell.role,
            alive: cell.bees.length,
            respawning: cell.respawnQueue.length,
          });
        }
        return result;
      },
      beeStates: () => {
        const out: { id: string; role: string; state: string; target: string | null; cell: string }[] = [];
        for (const cell of this.world.hive.cells.values()) {
          for (const bee of cell.bees) {
            out.push({
              id: bee.id,
              role: bee.role,
              state: bee.state,
              target: bee.targetFlowerId,
              cell: `${cell.q},${cell.r}`,
            });
          }
        }
        return out;
      },
      flowerClaims: () =>
        this.state.flowers.map((f) => ({
          id: f.id,
          yield: f.yieldRemaining,
          claimants: f.claimants,
          regrowMs: Math.round(f.regrowTimerMs),
        })),
      resetGame: () => this.resetGame(),
      worldSnapshot: () => this.world.snapshot(),
      select: (id: string | null) => this.select(id),
      selectCell: (q: number, r: number) => this.selectCell(q, r),
      selectedId: () => this.selectedId,
      selectedCell: () => this.selectedCell,
    };
    (window as unknown as { debug: typeof dbg }).debug = dbg;
  }
}
