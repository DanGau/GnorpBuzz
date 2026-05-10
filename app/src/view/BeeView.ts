import { Container, Graphics } from 'pixi.js';
import type { World } from '../world/World';
import type { Bee } from '../world/Bee';

interface BeeSprite {
  bee: Bee;
  graphics: Graphics;
  carry: Graphics;
}

export class BeeView {
  readonly container: Container;
  private sprites: BeeSprite[] = [];

  constructor() {
    this.container = new Container();
  }

  update(world: World): void {
    const liveBees: Bee[] = [];
    for (const hive of world.hives.values()) {
      for (const bee of hive.bees) liveBees.push(bee);
    }

    // Grow / shrink the sprite pool to match
    while (this.sprites.length < liveBees.length) {
      const g = new Graphics();
      const carry = new Graphics();
      this.drawBee(g, liveBees[this.sprites.length].role);
      this.container.addChild(g);
      this.container.addChild(carry);
      this.sprites.push({ bee: liveBees[this.sprites.length], graphics: g, carry });
    }
    while (this.sprites.length > liveBees.length) {
      const sprite = this.sprites.pop()!;
      this.container.removeChild(sprite.graphics);
      this.container.removeChild(sprite.carry);
      sprite.graphics.destroy();
      sprite.carry.destroy();
    }

    for (let i = 0; i < liveBees.length; i++) {
      const bee = liveBees[i];
      const sprite = this.sprites[i];
      // If the bee identity changed (e.g., role differs), redraw
      if (sprite.bee !== bee) {
        this.drawBee(sprite.graphics, bee.role);
        sprite.bee = bee;
      }
      sprite.graphics.x = bee.x;
      sprite.graphics.y = bee.y;
      sprite.carry.x = bee.x;
      sprite.carry.y = bee.y;
      const flap = 0.85 + 0.25 * Math.sin(bee.flapPhase);
      sprite.graphics.scale.y = flap;
      this.drawCarry(sprite.carry, bee.carrying);
    }
  }

  private drawBee(g: Graphics, role: 'forager' | 'wax-maker'): void {
    g.clear();
    // Wax-makers wear a slightly darker, dustier coat
    const bodyColor = role === 'forager' ? 0xffd23f : 0xe6b833;
    g.ellipse(0, 0, 7, 5).fill(bodyColor);
    g.rect(-4, -2, 2.5, 4).fill(0x222222);
    g.rect(1.5, -2, 2.5, 4).fill(0x222222);
    g.ellipse(-2, -4, 4, 2.5).fill({ color: 0xffffff, alpha: 0.6 });
    g.ellipse(2, -4, 4, 2.5).fill({ color: 0xffffff, alpha: 0.6 });
  }

  private drawCarry(g: Graphics, carrying: 'none' | 'pollen' | 'wax-block'): void {
    g.clear();
    if (carrying === 'none') return;
    if (carrying === 'pollen') {
      // Yellow pollen ball under the bee body
      g.circle(0, 4, 3).fill(0xf5d166);
      g.circle(-1, 3, 1).fill({ color: 0xfff2bf, alpha: 0.6 });
    } else if (carrying === 'wax-block') {
      // Cream hex block under the bee
      const r = 4;
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        pts.push(Math.cos(a) * r, 4 + Math.sin(a) * r);
      }
      g.poly(pts).fill(0xfff2cf).stroke({ color: 0xb89858, width: 1 });
    }
  }
}
