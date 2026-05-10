import { Application, Container } from 'pixi.js';
import type { GameState } from '../sim/state';
import type { World } from '../world/World';
import { WORLD } from '../world/layout';
import { WorldView } from './WorldView';
import { FlowerView } from './FlowerView';
import { HiveView } from './HiveView';
import { BeeView } from './BeeView';
import { VesselView } from './VesselView';
import { ParticleView } from './ParticleView';

export interface WorldRendererCallbacks {
  onHiveClick: (hiveId: string) => void;
  onVesselClick: () => void;
  onBackgroundClick: () => void;
}

export class WorldRenderer {
  readonly root: Container;
  private worldView: WorldView;
  private flowerView: FlowerView;
  private hiveView: HiveView;
  private beeView: BeeView;
  private vesselView: VesselView;
  private particleView: ParticleView;
  private fitListeners: (() => void)[] = [];

  constructor(callbacks: WorldRendererCallbacks) {
    this.root = new Container();
    this.root.eventMode = 'static';
    this.worldView = new WorldView();
    this.flowerView = new FlowerView();
    this.hiveView = new HiveView(callbacks.onHiveClick);
    this.beeView = new BeeView();
    this.vesselView = new VesselView(callbacks.onVesselClick);
    this.particleView = new ParticleView();

    this.root.addChild(this.worldView.container);
    this.root.addChild(this.flowerView.container);
    this.root.addChild(this.vesselView.container);
    this.root.addChild(this.hiveView.container);
    this.root.addChild(this.beeView.container);
    // Particles render on top so they're visible over hives/bees.
    this.root.addChild(this.particleView.container);

    // Background click (anything not consumed by hive/airplane): deselect.
    this.worldView.container.eventMode = 'static';
    this.worldView.container.on('pointertap', () => callbacks.onBackgroundClick());
  }

  attach(app: Application, parent: Container, _world: World): void {
    parent.addChild(this.root);
    this.fit(app);
    app.renderer.on('resize', () => this.fit(app));
  }

  private fit(app: Application): void {
    const sx = app.renderer.width / WORLD.WIDTH;
    const sy = app.renderer.height / WORLD.HEIGHT;
    const s = Math.min(sx, sy);
    this.root.scale.set(s);
    this.root.x = (app.renderer.width - WORLD.WIDTH * s) / 2;
    this.root.y = (app.renderer.height - WORLD.HEIGHT * s) / 2;
    for (const cb of this.fitListeners) cb();
  }

  /** Convert world coordinates into CSS pixel coordinates over the canvas.
   * Computed from the canvas's CSS dimensions to stay correct under any DPR
   * (Windows display scaling, retina displays, etc.) — Pixi's renderer.width
   * is already CSS-equivalent under autoDensity, so we use canvas.clientWidth
   * directly to avoid double-applying the resolution. */
  worldToScreen(worldX: number, worldY: number, app: Application): { x: number; y: number } {
    const canvas = app.canvas;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    const sx = cssW / WORLD.WIDTH;
    const sy = cssH / WORLD.HEIGHT;
    const s = Math.min(sx, sy);
    const offsetX = (cssW - WORLD.WIDTH * s) / 2;
    const offsetY = (cssH - WORLD.HEIGHT * s) / 2;
    return {
      x: offsetX + worldX * s,
      y: offsetY + worldY * s,
    };
  }

  onFit(cb: () => void): void {
    this.fitListeners.push(cb);
  }

  update(state: GameState, world: World, dtMs: number, selectedId: string | null): void {
    this.flowerView.update(state, world, dtMs);
    this.hiveView.update(state, world, selectedId, dtMs);
    this.beeView.update(world, state.elapsedMs);
    this.vesselView.update(state, dtMs, selectedId === 'vessel', world);
    this.particleView.update(world.particles);
  }
}
