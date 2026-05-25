import { Application, Container } from 'pixi.js';
import type { GameState, UpgradeId, UpgradeRole } from '../sim/state';
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
import { UpgradePanelView } from './UpgradePanelView';
import { HoneyBarView } from './HoneyBarView';
import { PollenSiloView } from './PollenSiloView';
import { WaxBlockView } from './WaxBlockView';
import { FertilizerBinView } from './FertilizerBinView';
import { RockDropView } from './RockDropView';

// World-space anchor each upgrade panel docks under, keyed by role.
const UPGRADE_ANCHORS: Record<UpgradeRole, { x: number; y: number }> = {
  forager: WORLD.POLLEN_SILO,
  'wax-worker': WORLD.WAX_BLOCK,
  cantor: WORLD.HONEY_JAR,
  fertilizer: WORLD.FERTILIZER_BIN,
};

// Per-role economy-camera target. (cx, cy) is the world-space center of
// the framed rect; (rectW, rectH) is its desired world-space extent
// which controls the zoom level. Each role centers on its own building
// with enough room above for the hovering swarm and below for the
// upgrade panel that docks under the building anchor.
const ECONOMY_FRAMES: Record<
  UpgradeRole,
  { cx: number; cy: number; rectW: number; rectH: number }
> = {
  // Pollen Silo — small ground-level building. Pull the center up a bit
  // from the silo anchor so the swarm hovering above stays in frame.
  forager: {
    cx: WORLD.POLLEN_SILO.x,
    cy: WORLD.POLLEN_SILO.y - 30,
    rectW: 220,
    rectH: 260,
  },
  // Wax workshop — taller building (peaked roof + chimney), so the
  // frame extends higher than the silo's to show the whole hut.
  'wax-worker': {
    cx: WORLD.WAX_BLOCK.x,
    cy: WORLD.WAX_BLOCK.y - 40,
    rectW: 220,
    rectH: 280,
  },
  // Honey jar — floats in the sky above the hive. Center between jar
  // and hive top so both read clearly; the panel itself docks under
  // the jar.
  cantor: {
    cx: WORLD.HONEY_JAR.x,
    cy: WORLD.HONEY_JAR.y + 30,
    rectW: 240,
    rectH: 300,
  },
  // Fertilizer bin — small under-hive crate; frame mirrors the silo
  // and gives the panel room to dock underneath.
  fertilizer: {
    cx: WORLD.FERTILIZER_BIN.x,
    cy: WORLD.FERTILIZER_BIN.y - 30,
    rectW: 220,
    rectH: 260,
  },
};

export interface WorldRendererCallbacks {
  onHiveClick: () => void;
  onCellClick: (q: number, r: number) => void;
  onDigSiteClick: () => void;
  onBackgroundClick: () => void;
  onBuyCell: (q: number, r: number) => void;
  onAssignCell: (q: number, r: number, role: import('../sim/state').CellRole) => void;
  onBuyUpgrade: (id: UpgradeId) => void;
  // Clicking a resource building opens that role's contextual upgrade panel
  // (and pans the camera to frame it).
  onShowUpgrades: (role: UpgradeRole) => void;
}

interface Framing {
  scale: number;
  x: number;
  y: number;
}

export type CameraTarget = 'overview' | 'hive' | 'economy';

export class WorldRenderer {
  readonly root: Container;
  private worldView: WorldView;
  private flowerView: FlowerView;
  private hiveView: HiveView;
  private beeView: BeeView;
  private digSiteView: DigSiteView;
  private particleView: ParticleView;
  private cellRadialView: CellRadialView;
  private upgradePanelView: UpgradePanelView;
  private honeyBarView: HoneyBarView;
  private pollenSiloView: PollenSiloView;
  private waxBlockView: WaxBlockView;
  private fertilizerBinView: FertilizerBinView;
  private rockDropView: RockDropView;
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
  // Active upgrade role driving the economy framing. Each role focuses
  // on a different building (silo / workshop / honey jar) so the camera
  // actually zooms onto the thing the player clicked.
  private economyRole: UpgradeRole | null = null;

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
    this.upgradePanelView = new UpgradePanelView({
      onBuyUpgrade: callbacks.onBuyUpgrade,
      onDismissBackdrop: callbacks.onBackgroundClick,
    });
    this.honeyBarView = new HoneyBarView(() => callbacks.onShowUpgrades('cantor'));
    this.pollenSiloView = new PollenSiloView(() => callbacks.onShowUpgrades('forager'));
    this.waxBlockView = new WaxBlockView(() => callbacks.onShowUpgrades('wax-worker'));
    // No click handler yet — the fertilizer upgrade panel lands in a later
    // slice. The bin renders, fills, and shows its count in the meantime.
    this.fertilizerBinView = new FertilizerBinView(() => callbacks.onShowUpgrades('fertilizer'));
    this.rockDropView = new RockDropView();

    this.root.addChild(this.worldView.container);
    this.root.addChild(this.flowerView.container);
    this.root.addChild(this.digSiteView.container);
    this.root.addChild(this.hiveView.container);
    // Resource containers (Pollen Silo, Wax Block, Honey Jar). Drawn
    // after the hive so they sit in front of the shell, and before
    // particles so deposit puffs/sparkles render on top of them.
    this.root.addChild(this.pollenSiloView.container);
    this.root.addChild(this.waxBlockView.container);
    this.root.addChild(this.fertilizerBinView.container);
    // Rock drops sit behind the bees but in front of the boulder so a
    // bee picking one up renders on top of the pile.
    this.root.addChild(this.rockDropView.container);
    this.root.addChild(this.honeyBarView.container);
    this.root.addChild(this.beeView.container);
    this.root.addChild(this.particleView.container);
    this.root.addChild(this.cellRadialView.container);
    this.root.addChild(this.upgradePanelView.container);

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
      this.cameraTarget === 'economy'
        ? this.frameEconomy(this.economyRole ?? 'forager')
        : this.cameraTarget === 'hive'
          ? this.frameHive(this.hiveFocusRadius)
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

  // Hive-centric framing — frames the hive shell (the workable hex comb)
  // plus the honey jar floating above it. No underground band any more.
  // Horizontal/vertical centering is clamped to world bounds so empty
  // space outside the world never shows.
  private frameHive(focusRadius: number): Framing {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;

    // Vertical band: from above the honey jar (which floats ~95px above
    // the hive center) down past the bottom of the hive shell.
    const PADDING = 24;
    const bandTop = Math.min(WORLD.HIVE.y - focusRadius, WORLD.HONEY_JAR.y - 30) - PADDING;
    const bandBottom = WORLD.HIVE.y + focusRadius + PADDING;
    const bandHeight = bandBottom - bandTop;
    const bandCenterY = (bandTop + bandBottom) / 2;

    const hiveWidth = 2 * focusRadius;

    const s = Math.min((w * 0.96) / hiveWidth, (h * 0.96) / bandHeight);

    let cy = bandCenterY;
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

  // Side-on economy framing — per role. Each upgrade panel zooms onto
  // its own building so the player sees what they clicked instead of a
  // shared meadow shot. The cantor panel pulls the camera all the way
  // across to the honey jar above the hive (which is no longer next to
  // the silo / workshop after the hive moved right).
  private frameEconomy(role: UpgradeRole): Framing {
    const w = this.app.renderer.width;
    const h = this.app.renderer.height;
    const f = ECONOMY_FRAMES[role];
    const s = Math.min((w * 0.92) / f.rectW, (h * 0.92) / f.rectH);
    // Clamp horizontally so we don't pan past world edges.
    const halfWorldVisible = w / (2 * s);
    const minCx = halfWorldVisible;
    const maxCx = WORLD.WIDTH - halfWorldVisible;
    const ccx =
      minCx > maxCx
        ? WORLD.WIDTH * 0.5
        : Math.min(maxCx, Math.max(minCx, f.cx));
    return {
      scale: s,
      x: w * 0.5 - ccx * s,
      y: h * 0.5 - f.cy * s,
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
    selectedUpgrades: UpgradeRole | null,
  ): void {
    // Selection drives the camera. An open upgrade panel (forager / cantor /
    // wax-worker) frames the economy buildings. Otherwise cell / whole-hive
    // selection gives the hive comb framing; everything else is the wide
    // overview.
    const economyFocus = selectedUpgrades !== null;
    const hiveFocus =
      !economyFocus && (selectedCell !== null || selectedId === 'hive');
    this.cameraTarget = economyFocus ? 'economy' : hiveFocus ? 'hive' : 'overview';
    if (economyFocus) this.economyRole = selectedUpgrades;
    const goal =
      this.cameraTarget === 'economy'
        ? this.frameEconomy(selectedUpgrades ?? this.economyRole ?? 'forager')
        : this.cameraTarget === 'hive'
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
    this.honeyBarView.update(state, dtMs);
    this.pollenSiloView.update(state, dtMs);
    this.waxBlockView.update(state, dtMs, world);
    this.fertilizerBinView.update(state, dtMs);
    // Spall at every freshly-resolved strike — drained here so the sim
    // layer doesn't need a particle dependency. 6 dust + 2 sparkle per
    // hit gives the cantor cast a satisfying *crack* rather than the
    // four-pixel fizzle the homing arrival burst alone produced.
    for (const s of state.digSite.recentStrikes) {
      world.particles.emit('crashDust', s.x, s.y, 6);
      world.particles.emit('sparkle', s.x, s.y, 2);
    }
    state.digSite.recentStrikes.length = 0;
    this.rockDropView.update(state, world, dtMs);
    this.beeView.update(world, state.elapsedMs);
    this.digSiteView.update(state, dtMs, selectedId === 'dig-site');
    this.particleView.update(world.particles);
    this.cellRadialView.update(state, selectedCell, dtMs);
    const viewportWorld = this.visibleWorldRect();
    const anchor = selectedUpgrades ? UPGRADE_ANCHORS[selectedUpgrades] : null;
    this.upgradePanelView.update(state, selectedUpgrades, anchor, dtMs, viewportWorld);
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
