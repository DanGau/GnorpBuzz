import { Application, Container } from 'pixi.js';
import type { GameState } from '../sim/state';
import type { World } from '../world/World';
import { WORLD } from '../world/layout';
import { WorldView } from './WorldView';
import { FlowerView } from './FlowerView';
import { HiveView } from './HiveView';
import { BeeView } from './BeeView';
import { VesselView } from './VesselView';

export class WorldRenderer {
  readonly root: Container;
  private worldView: WorldView;
  private flowerView: FlowerView;
  private hiveView: HiveView;
  private beeView: BeeView;
  private vesselView: VesselView;

  constructor() {
    this.root = new Container();
    this.worldView = new WorldView();
    this.flowerView = new FlowerView();
    this.hiveView = new HiveView();
    this.beeView = new BeeView();
    this.vesselView = new VesselView();

    // Z order: world bg → meadow flowers + sky flower → vessel → hives → bees
    this.root.addChild(this.worldView.container);
    this.root.addChild(this.flowerView.container);
    this.root.addChild(this.vesselView.container);
    this.root.addChild(this.hiveView.container);
    this.root.addChild(this.beeView.container);
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
  }

  update(state: GameState, world: World, dtMs: number): void {
    this.flowerView.update(state, world, dtMs);
    this.hiveView.update(state, world);
    this.beeView.update(world);
    this.vesselView.update(state);
  }
}
