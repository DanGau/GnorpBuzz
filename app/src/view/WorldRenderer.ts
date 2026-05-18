import { Application, Container } from 'pixi.js';
import type { GameState, UpgradeId } from '../sim/state';
import { CHAMBERS, hexDistance, TUNING } from '../sim/state';
import type { World } from '../world/World';
import { UNDERGROUND, WORLD } from '../world/layout';
import { WorldView } from './WorldView';
import { FlowerView } from './FlowerView';
import { HiveView } from './HiveView';
import { BeeView } from './BeeView';
import { DigSiteView } from './DigSiteView';
import { ParticleView } from './ParticleView';
import { CellRadialView } from './CellRadialView';
import { UndergroundView } from './UndergroundView';
import { ChamberRadialView } from './ChamberRadialView';
import { HoneyBarView } from './HoneyBarView';

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

// World-space Y of the bottom edge of the deepest chamber row. Used by
// the hive camera framing so even the smallest hive always pulls the
// underground band fully into view.
function deepestChamberBottom(): number {
  let maxRow = 0;
  for (const spec of CHAMBERS) {
    if (spec.plot.row > maxRow) maxRow = spec.plot.row;
  }
  // Each row's chamber center sits at TOP_Y + ROW_HEIGHT * (row + 0.5);
  // the bottom edge is half a CHAMBER_H further down.
  return (
    UNDERGROUND.TOP_Y +
    UNDERGROUND.ROW_HEIGHT * (maxRow + 0.5) +
    UNDERGROUND.CHAMBER_H / 2
  );
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
  private undergroundView: UndergroundView;
  private chamberRadialView: ChamberRadialView;
  private honeyBarView: HoneyBarView;
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
    this.honeyBarView = new HoneyBarView();

    this.root.addChild(this.worldView.container);
    this.root.addChild(this.flowerView.container);
    this.root.addChild(this.digSiteView.container);
    // Underground sits BEHIND the hive so the hive shell visually overlaps
    // the soil layer at the meadow line.
    this.root.addChild(this.undergroundView.container);
    this.root.addChild(this.hiveView.container);
    // Honey jar floats above the hive — drawn after the hive so it sits
    // in front of the shell, and before particles so mana orbs/sparkles
    // emitted at the jar render on top of it.
    this.root.addChild(this.honeyBarView.container);
    this.root.addChild(this.beeView.container);
    this.root.addChild(this.particleView.container);
    this.root.addChild(this.cellRadialView.container);
    this.root.addChild(this.chamberRadialView.container);

    this.worldView.container.eventMode = 'static';
    this.worldView.container.on('pointertap', () => callbacks.onBackgroundClick());
  }

  attach(app: Application, parent: Container, world: World): void {
    this.app = app;
    parent.addChild(this.root);
    // Register the honey jar as the World's reaction surface so Bee.ts
    // (which can only see `World`) can fire produce/consume flashes
    // through it without the sim layer importing presentation code.
    world.honeyBar = this.honeyBarView;
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

  // Fit the wide-screen overview rect into the canvas, centered. The rect
  // (WORLD.OVERVIEW) stops just below the meadow flowers — the underground
  // band is intentionally cropped out and only appears when the camera
  // zooms in. The rect is ~16:9 so a typical canvas fills with no letter-
  // boxing; on narrower canvases the rect contains the width and the extra
  // sky/meadow above and below is allowed to be cropped or padded by the
  // standard contain fit.
  private frameOverview(): Framing {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    const ov = WORLD.OVERVIEW;
    const rectW = ov.RIGHT - ov.LEFT;
    const rectH = ov.BOTTOM - ov.TOP;
    const s = Math.min(w / rectW, h / rectH);
    // Anchor the rect's top-left at the canvas top-left after centering —
    // multiplying the rect's offsets by `s` keeps world coordinates inside
    // (`OVERVIEW.LEFT`, `OVERVIEW.TOP`) aligned to the visible viewport.
    return {
      scale: s,
      x: (w - rectW * s) / 2 - ov.LEFT * s,
      y: (h - rectH * s) / 2 - ov.TOP * s,
    };
  }

  // Hive-centric framing. The camera frames a vertical band that always
  // contains BOTH the full hive shell AND every chamber row underground —
  // even at the smallest hive (3 starting cells) the deepest chamber stays
  // in view. The band is computed from the hive's actual shell radius plus
  // the underground depth derived from `CHAMBERS`.
  //
  // When a chamber is focused, the camera PANS down (same scale) so the
  // chamber + its drop-down upgrade panel sit comfortably in frame.
  //
  // Horizontal centering is clamped to the world bounds so the empty
  // space outside the world (x < 0 or x > WORLD.WIDTH) never shows.
  private frameHive(focusRadius: number, focusChamber: boolean): Framing {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;

    // Vertical band the camera must contain: from the top of the hive
    // shell down through the bottom of the deepest chamber row, with a
    // small padding so neither edge is flush against the viewport edge.
    const hiveTop = WORLD.HIVE.y - focusRadius;
    const undergroundBottom = deepestChamberBottom();
    const PADDING = 30;
    const bandTop = hiveTop - PADDING;
    const bandBottom = undergroundBottom + PADDING;
    const bandHeight = bandBottom - bandTop;
    const bandCenterY = (bandTop + bandBottom) / 2;

    // Width budget: keep the hive's horizontal extent comfortable. The
    // hive shell's flat-top hexagon spans roughly 2 × focusRadius wide,
    // matching its vertical extent.
    const hiveWidth = 2 * focusRadius;

    const s = Math.min(
      (w * 0.96) / hiveWidth,
      (h * 0.96) / bandHeight,
    );

    let cy = bandCenterY;
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
    this.honeyBarView.update(state, dtMs);
    this.beeView.update(world, state.elapsedMs);
    this.digSiteView.update(state, dtMs, selectedId === 'dig-site');
    this.particleView.update(world.particles);
    this.cellRadialView.update(state, selectedCell, dtMs);
    this.undergroundView.update(state, selectedChamber, cellsInteractive, dtMs);
    // Visible world rect in world coordinates, computed from the live
    // camera transform. Passed to the chamber panel so its hover tooltip
    // can decide whether to fan right or left based on what's actually
    // on-screen, not on the abstract world bounds.
    const viewportWorld = this.visibleWorldRect();
    this.chamberRadialView.update(state, selectedChamber, dtMs, viewportWorld);
  }

  // Inverse of the camera transform: returns the world-space rect that
  // maps onto the canvas viewport right now.
  private visibleWorldRect(): { left: number; right: number; top: number; bottom: number } {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    const s = this.camScale || 1;
    return {
      left: -this.camX / s,
      right: (w - this.camX) / s,
      top: -this.camY / s,
      bottom: (h - this.camY) / s,
    };
  }
}
