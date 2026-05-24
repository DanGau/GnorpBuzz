import { Application, Container, Ticker } from 'pixi.js';
import type { GameState, CellRole, UpgradeRole } from '../sim/state';
import {
  createInitialState,
  totalPollen,
  totalWax,
  totalHoney,
  honeyCap,
  totalBees,
  countRole,
  nextWorkerCost,
  digSiteHpPct,
  addPollen,
  takePollen,
  spawnRockDrop,
} from '../sim/state';
import { WORLD } from '../world/layout';
import { flowerSystem } from '../sim/systems/flowers';
import { digSiteSystem } from '../sim/systems/dig-sites';
import { artifactSystem } from '../sim/systems/artifact';
import { ascentSystem } from '../sim/systems/ascent';
import { rockDropsSystem } from '../sim/systems/rock-drops';
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
  // Sum of pollen dots sitting on all Forager cell piles — the transient
  // buffer between gatherers and refiners.
  pollen: number;
  // Wax — the upgrade currency. Refined by Wax Workers.
  wax: number;
  honey: number;
  honeyCap: number;
  cells: { q: number; r: number; role: string | null }[];
  pollenCap: number;
  waxCap: number;
  totalBees: number;
  foragers: number;
  honeyWorkers: number;
  waxWorkers: number;
  cantors: number;
  digSite: { tier: number; hp: number; maxHp: number; state: string; hpPct: number };
  artifacts: { revealed: string[]; pending: string | null };
  journal: { pending: boolean; entries: number };
  ascent: { phase: string; timer: number };
  nextForagerCost: number;
  nextHoneyWorkerCost: number;
  nextWaxWorkerCost: number;
  nextCantorCost: number;
}

export class Game {
  readonly app: Application;
  readonly stage: Container;
  state: GameState;
  readonly observer: Observer;
  readonly world: World;
  readonly renderer: WorldRenderer;
  ui?: UI;

  // UI selection. `selectedId` covers the dig site ('dig-site'), the whole
  // hive ('hive'), or null; `selectedCell` is the hex cell open in the cell
  // panel; `selectedUpgrades` is the role whose contextual upgrade panel is
  // open (set by clicking the Pollen Silo / Honey Jar / Wax Block / rune
  // stone). These are mutually exclusive — opening one closes the others.
  selectedId: string | null = null;
  selectedCell: { q: number; r: number } | null = null;
  selectedUpgrades: UpgradeRole | null = null;

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
      onBuyUpgrade: (id: UpgradeId) => this.buyUpgrade(id),
      onShowUpgrades: (role: UpgradeRole) => this.toggleUpgrades(role),
    });
    this.world.reconcile(this.state);
  }

  private notify(): void {
    this.observer.emit();
    if (this.ui) this.ui.update();
  }

  select(id: string | null): void {
    if (
      this.selectedId === id &&
      this.selectedCell === null &&
      this.selectedUpgrades === null
    )
      return;
    this.selectedId = id;
    this.selectedCell = null;
    this.selectedUpgrades = null;
    this.notify();
  }

  toggleSelection(id: string): void {
    this.select(this.selectedId === id ? null : id);
  }

  selectCell(q: number, r: number): void {
    this.selectedCell = { q, r };
    this.selectedId = null;
    this.selectedUpgrades = null;
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

  // Open the contextual upgrade panel for a role (clicking a resource
  // building). The camera pans to frame that role's anchor.
  selectUpgrades(role: UpgradeRole | null): void {
    this.selectedUpgrades = role;
    this.selectedCell = null;
    this.selectedId = null;
    this.notify();
  }

  toggleUpgrades(role: UpgradeRole): void {
    this.selectUpgrades(this.selectedUpgrades === role ? null : role);
  }

  clearSelection(): void {
    if (
      this.selectedId === null &&
      this.selectedCell === null &&
      this.selectedUpgrades === null
    )
      return;
    this.selectedId = null;
    this.selectedCell = null;
    this.selectedUpgrades = null;
    this.notify();
  }

  // Step out one selection layer: a click outside an open panel closes it
  // (cell → hive), but a second click is needed to leave the zoomed-in
  // hive (hive → overview). An open upgrade panel closes straight to the
  // overview since its camera isn't a sub-view of the hive.
  stepOutSelection(): void {
    if (this.selectedCell !== null) {
      this.select('hive');
    } else {
      this.clearSelection();
    }
  }

  // True when the camera is (or is heading) zoomed into the hive.
  get isZoomedIn(): boolean {
    return (
      this.selectedCell !== null ||
      this.selectedUpgrades !== null ||
      this.selectedId === 'hive'
    );
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
    rockDropsSystem(this.state, dtMs);
    digSiteSystem(this.state);
    artifactSystem(this.state);
    ascentSystem(this.state, dtMs);
    this.lastDeltaMs = dtMs;
    this.renderer.update(this.state, this.world, dtMs, this.selectedId, this.selectedCell, this.selectedUpgrades);
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
      wax: totalWax(this.state),
      honey: totalHoney(this.state),
      honeyCap: honeyCap(this.state),
      cells: this.state.hive.cells.map((c) => ({
        q: c.q,
        r: c.r,
        role: c.role,
      })),
      pollenCap: this.state.hive.pollenCap,
      waxCap: this.state.hive.waxCap,
      totalBees: totalBees(this.state),
      foragers: countRole(this.state, 'forager'),
      honeyWorkers: countRole(this.state, 'honey-worker'),
      waxWorkers: countRole(this.state, 'wax-worker'),
      cantors: countRole(this.state, 'cantor'),
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
      nextHoneyWorkerCost: nextWorkerCost(this.state, 'honey-worker'),
      nextWaxWorkerCost: nextWorkerCost(this.state, 'wax-worker'),
      nextCantorCost: nextWorkerCost(this.state, 'cantor'),
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
    this.renderer.update(this.state, this.world, this.lastDeltaMs, this.selectedId, this.selectedCell, this.selectedUpgrades);
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
    const result = this.commit(assignCell(this.state, q, r, role));
    // Assigning a role finishes the cell's interaction; drop back to the
    // whole-hive selection so the radial menu's dim overlay closes (a
    // filled cell has no further options) while the camera stays zoomed in.
    if (result.ok) this.select('hive');
    return result;
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
    this.selectedUpgrades = null;
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
      grantWax: (amount: number) => {
        this.state.hive.wax += amount;
        saveToStorage(this.state);
        this.notify();
        return { ok: true };
      },
      // Grant pollen directly to the silo (clamped to cap). Useful for sim
      // tests that want to stress-test the Worker pickup loop without
      // waiting for foragers to fly out and back.
      grantPollen: (amount: number) => {
        // Route through addPollen / takePollen so the physical dot
        // entities stay in sync with the scalar count. Negative grants
        // drain from the top of the pile.
        if (amount >= 0) addPollen(this.state, amount);
        else takePollen(this.state, Math.min(this.state.hive.pollen, -amount));
        saveToStorage(this.state);
        this.notify();
        return { ok: true };
      },
      grantFertilizer: (amount: number) => {
        this.state.hive.fertilizer = Math.max(0, Math.min(
          this.state.hive.fertilizerCap,
          this.state.hive.fertilizer + amount,
        ));
        saveToStorage(this.state);
        this.notify();
        return { ok: true, total: this.state.hive.fertilizer };
      },
      grantHoney: (amount: number) => {
        this.state.hive.honey = Math.min(
          this.state.hive.honeyCap,
          this.state.hive.honey + amount,
        );
        saveToStorage(this.state);
        this.notify();
        return { ok: true };
      },
      worldBees: () => {
        const result: { q: number; r: number; role: string; alive: number }[] = [];
        for (const cell of this.world.hive.cells.values()) {
          result.push({
            q: cell.q,
            r: cell.r,
            role: cell.role,
            alive: cell.bees.length,
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
      flowers: () => this.state.flowers.map(f => ({ id: f.id, tier: f.tier, growthMs: Math.round(f.growthMs), yield: f.yieldRemaining, x: Math.round(f.x), y: Math.round(f.y) })),
      rockDrops: () => this.state.rockDrops,
      rockDropBudget: () => this.state.digSite.dropBudget,
      fertilizer: () => this.state.hive.fertilizer,
      // Debug: spawn N rock drops straight from the strike point. Bypasses
      // the cantor entirely so visual/UI tests of the pile don't need to
      // wait the ~2.4s cast cadence. The drops still roll their kind/tier
      // through the normal helper.
      forceRockDrops: (n: number) => {
        const site = this.world.digSite;
        if (!site) return { ok: false, reason: 'no dig site' };
        const sp = site.strikePoint();
        const settleBaseY = site.y + WORLD.DIG_SITE_RADIUS - 8;
        for (let i = 0; i < n; i++) {
          spawnRockDrop(this.state, sp.x, sp.y, settleBaseY);
        }
        this.notify();
        return { ok: true, count: this.state.rockDrops.length };
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
      selectUpgrades: (role: UpgradeRole | null) => this.selectUpgrades(role),
      selectedId: () => this.selectedId,
      selectedCell: () => this.selectedCell,
      selectedUpgrades: () => this.selectedUpgrades,
    };
    (window as unknown as { debug: typeof dbg }).debug = dbg;
  }
}
