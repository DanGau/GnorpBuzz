import { Application, Container } from 'pixi.js';
import type { GameState, UpgradeId } from '../sim/state';
import { hexDistance, TUNING } from '../sim/state';
import type { World } from '../world/World';
import { WORLD } from '../world/layout';
import { WorldView } from './WorldView';
import { FlowerView } from './FlowerView';
import { HiveView } from './HiveView';
import { BeeView } from './BeeView';
import { DigSiteView } from './DigSiteView';
import { ParticleView } from './ParticleView';
import { CellRadialView } from './CellRadialView';
import { UndergroundView } from './UndergroundView';
import { ChamberRadialView } from './ChamberRadialView';

export interface WorldRendererCallbacks {
  onHiveClick: () => void;
  onCellClick: (q: number, r: number) => void;
  onDigSiteClick: () => void;
  onBackgroundClick: () => void;
  onBuyCell: (q: number, r: number) => void;
  onAssignCell: (q: number, r: number, role: import('../sim/state').CellRole) => void;
  onChamberClick: (id: string) => void;
  onDigChamber: (id: string) => void;
  onBuyUpgrade: (id: UpgradeId) => void;
}

interface Framing {
  scale: number;
  x: number;
  y: number;
}

// Fraction of viewport height the hive occupies when zoomed in. The
// chambers below get the rest. Designed so the hive dominates the
// zoomed-in view. The chambers' world-unit footprint (see UNDERGROUND in
// layout.ts) is tuned to comfortably fit in the remaining viewport.
const HIVE_VIEWPORT_FRACTION = 0.78;
// Where the hive's CENTER sits, as a fraction of viewport height from the
// top. >0.5 pushes everything down on screen (more sky above the hive).
const HIVE_CENTER_FRAC_FROM_TOP = 0.45;

export type CameraTarget = 'overview' | 'hive';

export class WorldRenderer {
  readonly root: Container;
  private worldView: WorldView;
  private flowerView: FlowerView;
  private hiveView: HiveView;
  private beeView: BeeView;
  private digSiteView: DigSiteView;
  private particleView: ParticleView;
  private cellRadialView: CellRadialView;
  private undergroundView: UndergroundView;
  private chamberRadialView: ChamberRadialView;
  private fitListeners: (() => void)[] = [];

  private app!: Application;
  // Animated camera transform (in renderer pixels, matching `root`).
  private camScale = 1;
  private camX = 0;
  private camY = 0;
  private cameraTarget: CameraTarget = 'overview';
  // World radius the `hive` framing tries to fit; cached so a resize can
  // recompute the framing without needing live game state.
  private hiveFocusRadius = 120;

  constructor(callbacks: WorldRendererCallbacks) {
    this.root = new Container();
    this.root.eventMode = 'static';
    this.worldView = new WorldView();
    this.flowerView = new FlowerView();
    this.hiveView = new HiveView(callbacks.onCellClick, callbacks.onHiveClick, callbacks.onBuyCell);
    this.beeView = new BeeView();
    this.digSiteView = new DigSiteView(callbacks.onDigSiteClick);
    this.particleView = new ParticleView();
    this.cellRadialView = new CellRadialView({
      onBuyCell: callbacks.onBuyCell,
      onAssignCell: callbacks.onAssignCell,
    });
    this.undergroundView = new UndergroundView({
      onChamberClick: callbacks.onChamberClick,
      onDigChamber: callbacks.onDigChamber,
    });
    this.chamberRadialView = new ChamberRadialView({
      onDigChamber: callbacks.onDigChamber,
      onBuyUpgrade: callbacks.onBuyUpgrade,
      onDismissBackdrop: callbacks.onBackgroundClick,
    });

    this.root.addChild(this.worldView.container);
    this.root.addChild(this.flowerView.container);
    this.root.addChild(this.digSiteView.container);
    // Underground sits BEHIND the hive so the hive shell visually overlaps
    // the soil layer at the meadow line.
    this.root.addChild(this.undergroundView.container);
    this.root.addChild(this.hiveView.container);
    this.root.addChild(this.beeView.container);
    this.root.addChild(this.particleView.container);
    this.root.addChild(this.cellRadialView.container);
    this.root.addChild(this.chamberRadialView.container);

    this.worldView.container.eventMode = 'static';
    this.worldView.container.on('pointertap', () => callbacks.onBackgroundClick());
  }

  attach(app: Application, parent: Container, _world: World): void {
    this.app = app;
    parent.addChild(this.root);
    this.snapTo(this.frameOverview());
    app.renderer.on('resize', () => this.onResize());
  }

  private snapTo(f: Framing): void {
    this.camScale = f.scale;
    this.camX = f.x;
    this.camY = f.y;
    this.applyCamera();
  }

  private applyCamera(): void {
    this.root.scale.set(this.camScale);
    this.root.x = this.camX;
    this.root.y = this.camY;
  }

  private onResize(): void {
    const goal =
      this.cameraTarget === 'hive'
        ? this.frameHive(this.hiveFocusRadius, false)
        : this.frameOverview();
    this.snapTo(goal);
    for (const cb of this.fitListeners) cb();
  }

  // Fit the whole world into the canvas, centered.
  private frameOverview(): Framing {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    const s = Math.min(w / WORLD.WIDTH, h / WORLD.HEIGHT);
    return {
      scale: s,
      x: (w - WORLD.WIDTH * s) / 2,
      y: (h - WORLD.HEIGHT * s) / 2,
    };
  }

  // Hive-centric framing. Scale is set so the hive comb plus the
  // underground chamber row both fit at a comfortable size with the hive
  // dominating (~60% of vertical viewport). When a chamber is focused,
  // the camera PANS down (same scale) to bring the chamber + its drop-
  // down panel into frame — hive partially scrolls off the top.
  //
  // Horizontal centering is clamped to the world bounds so the empty
  // space outside the world (x < 0 or x > WORLD.WIDTH) never shows.
  private frameHive(focusRadius: number, focusChamber: boolean): Framing {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    const hiveHeight = 2 * focusRadius;
    // Scale is set so the HIVE fills HIVE_VIEWPORT_FRACTION of viewport
    // height. Chambers below get the remainder. The width budget is
    // generous so the hive's vertical extent is the binding constraint.
    const s = Math.min(
      (w * 0.96) / hiveHeight,
      (h * HIVE_VIEWPORT_FRACTION) / hiveHeight,
    );
    // Anchor the hive so its center lands at HIVE_CENTER_FRAC_FROM_TOP
    // of the viewport. Larger values push everything lower on screen.
    let cy = WORLD.HIVE.y + (h * 0.5 - h * HIVE_CENTER_FRAC_FROM_TOP) / s;
    // When focused on a chamber, shift the camera down so the chamber +
    // its drop-down upgrade panel come into view. The hive partially
    // scrolls off the top — desired, since the player's attention is on
    // the chamber.
    if (focusChamber) cy += 95;
    // Clamp camera center so the visible region stays inside the world
    // (no black bars from showing past the world's edges in either axis).
    const halfWorldVisible = w / (2 * s);
    const minCx = halfWorldVisible;
    const maxCx = WORLD.WIDTH - halfWorldVisible;
    const cx =
      minCx > maxCx
        ? WORLD.WIDTH * 0.5
        : Math.min(maxCx, Math.max(minCx, WORLD.HIVE.x));
    const halfVerticalVisible = h / (2 * s);
    const minCy = halfVerticalVisible;
    const maxCy = WORLD.HEIGHT - halfVerticalVisible;
    if (maxCy >= minCy) cy = Math.min(maxCy, Math.max(minCy, cy));
    return {
      scale: s,
      x: w * 0.5 - cx * s,
      y: h * 0.5 - cy * s,
    };
  }

  private hiveFramingFor(state: GameState, focusChamber: boolean): Framing {
    let maxRing = 1;
    for (const c of state.hive.cells) {
      maxRing = Math.max(maxRing, hexDistance(c.q, c.r));
    }
    const shellRing = Math.min(maxRing + 1, TUNING.MAX_COMB_RADIUS);
    const shell = WORLD.HEX_SIZE * (Math.sqrt(3) * shellRing + 1.9);
    this.hiveFocusRadius = shell + WORLD.HEX_SIZE * 3;
    return this.frameHive(this.hiveFocusRadius, focusChamber);
  }

  worldToScreen(worldX: number, worldY: number, _app: Application): { x: number; y: number } {
    // `root` lives in the renderer's logical-pixel space — the same space
    // CSS positions DOM panels in — so its transform maps world coords
    // straight to screen coords. No resolution conversion belongs here;
    // autoDensity handles the device-pixel buffer separately. Reading the
    // live `root` transform keeps panels glued to the camera mid-animation.
    return {
      x: this.root.x + worldX * this.root.scale.x,
      y: this.root.y + worldY * this.root.scale.y,
    };
  }

  onFit(cb: () => void): void {
    this.fitListeners.push(cb);
  }

  update(
    state: GameState,
    world: World,
    dtMs: number,
    selectedId: string | null,
    selectedCell: { q: number; r: number } | null,
    selectedChamber: string | null,
  ): void {
    // Selection drives the camera: anything that focuses on the hive (a
    // selected cell, the whole hive, or any chamber underground) pulls us
    // into the zoomed-in framing; anything else is the wide overview.
    const zoomedIn =
      selectedCell !== null ||
      selectedId === 'hive' ||
      selectedChamber !== null;
    this.cameraTarget = zoomedIn ? 'hive' : 'overview';
    const goal =
      this.cameraTarget === 'hive'
        ? this.hiveFramingFor(state, selectedChamber !== null)
        : this.frameOverview();

    // Frame-rate-independent exponential ease toward the goal framing.
    const a = 1 - Math.pow(0.002, dtMs / 1000);
    this.camScale += (goal.scale - this.camScale) * a;
    this.camX += (goal.x - this.camX) * a;
    this.camY += (goal.y - this.camY) * a;
    this.applyCamera();

    const cellsInteractive = this.cameraTarget === 'hive';

    this.flowerView.update(state, world, dtMs);
    this.hiveView.update(state, world, selectedCell, cellsInteractive, dtMs);
    this.beeView.update(world, state.elapsedMs);
    this.digSiteView.update(state, dtMs, selectedId === 'dig-site');
    this.particleView.update(world.particles);
    this.cellRadialView.update(state, selectedCell, dtMs);
    this.undergroundView.update(state, selectedChamber, cellsInteractive, dtMs);
    this.chamberRadialView.update(state, selectedChamber, dtMs);
  }
}
