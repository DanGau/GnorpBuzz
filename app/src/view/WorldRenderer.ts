import { Application, Container } from 'pixi.js';
import type { GameState } from '../sim/state';
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

export interface WorldRendererCallbacks {
  onHiveClick: () => void;
  onCellClick: (q: number, r: number) => void;
  onDigSiteClick: () => void;
  onBackgroundClick: () => void;
  onBuyCell: (q: number, r: number) => void;
  onAssignCell: (q: number, r: number, role: import('../sim/state').CellRole) => void;
}

interface Framing {
  scale: number;
  x: number;
  y: number;
}

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

    this.root.addChild(this.worldView.container);
    this.root.addChild(this.flowerView.container);
    this.root.addChild(this.digSiteView.container);
    this.root.addChild(this.hiveView.container);
    this.root.addChild(this.beeView.container);
    this.root.addChild(this.particleView.container);
    this.root.addChild(this.cellRadialView.container);

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
        ? this.frameHive(this.hiveFocusRadius)
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

  // Fit a square region of `2 * focusRadius` world units centered on the
  // hive. The comb is biased toward the left so the docked colony panel
  // (top-right) doesn't sit over it.
  private frameHive(focusRadius: number): Framing {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    const box = 2 * focusRadius;
    const s = Math.min((w * 0.72) / box, (h * 0.84) / box);
    return {
      scale: s,
      x: w * 0.4 - WORLD.HIVE.x * s,
      y: h * 0.5 - WORLD.HIVE.y * s,
    };
  }

  private hiveFramingFor(state: GameState): Framing {
    let maxRing = 1;
    for (const c of state.hive.cells) {
      maxRing = Math.max(maxRing, hexDistance(c.q, c.r));
    }
    const shellRing = Math.min(maxRing + 1, TUNING.MAX_COMB_RADIUS);
    const shell = WORLD.HEX_SIZE * (Math.sqrt(3) * shellRing + 1.9);
    this.hiveFocusRadius = shell + WORLD.HEX_SIZE * 3;
    return this.frameHive(this.hiveFocusRadius);
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
  ): void {
    // Selection drives the camera: the hive (whole or a specific cell)
    // pulls us into the zoomed-in `hive` framing; anything else is the
    // wide `overview`.
    this.cameraTarget =
      selectedCell !== null || selectedId === 'hive' ? 'hive' : 'overview';
    const goal =
      this.cameraTarget === 'hive'
        ? this.hiveFramingFor(state)
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
  }
}
