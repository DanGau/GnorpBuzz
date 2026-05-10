import { Container, Graphics } from 'pixi.js';
import { WORLD } from '../world/layout';

// Static background: sky gradient bands, stars, meadow base.
// Drawn once at construction. The goal flower lives in FlowerView.

export class WorldView {
  readonly container: Container;
  private bg: Graphics;

  constructor() {
    this.container = new Container();
    this.bg = new Graphics();
    this.draw();
    this.container.addChild(this.bg);
  }

  private draw(): void {
    const g = this.bg;
    g.clear();

    // Stars band (very dark blue-black at top)
    g.rect(0, 0, WORLD.WIDTH, WORLD.SKY_Y).fill(0x0a0e1a);

    // Sky band (medium blue)
    g.rect(0, WORLD.SKY_Y, WORLD.WIDTH, WORLD.MEADOW_Y - WORLD.SKY_Y).fill(0x4a7ab0);

    // Sky-to-meadow horizon glow
    g.rect(0, WORLD.MEADOW_Y - 20, WORLD.WIDTH, 20).fill(0xf2c879);

    // Meadow band (green)
    g.rect(0, WORLD.MEADOW_Y, WORLD.WIDTH, WORLD.HEIGHT - WORLD.MEADOW_Y).fill(0x4d8b3a);

    // Stars — pseudo-random distribution via xorshift-ish hash
    let seed = 0x9e3779b9;
    const rand = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return ((seed >>> 0) % 10000) / 10000;
    };
    for (let i = 0; i < 90; i++) {
      const x = rand() * WORLD.WIDTH;
      const y = rand() * (WORLD.SKY_Y - 10) + 5;
      const size = 0.8 + rand() * 1.6;
      const alpha = 0.5 + rand() * 0.5;
      g.circle(x, y, size).fill({ color: 0xffffff, alpha });
    }
  }
}
