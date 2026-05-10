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

  update(world: World, elapsedMs: number): void {
    const liveBees: Bee[] = [];
    for (const hive of world.hives.values()) {
      for (const bee of hive.bees) liveBees.push(bee);
    }

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
      if (sprite.bee !== bee) {
        this.drawBee(sprite.graphics, bee.role);
        sprite.bee = bee;
      }
      sprite.graphics.x = bee.x;
      sprite.graphics.y = bee.y;
      sprite.carry.x = bee.x;
      sprite.carry.y = bee.y;

      // Per-frame velocity components drive squash/stretch.
      const dx = bee.x - bee.prevX;
      const dy = bee.y - bee.prevY;

      // Wing-flap freq scales with role. Forager is jittery, wax-maker lazy.
      const flapBase = bee.role === 'forager' ? 1.3 : bee.role === 'wax-maker' ? 0.8 : 1.0;
      const flap = 0.85 + 0.25 * Math.sin(bee.flapPhase * flapBase);

      // Squash/stretch driven by velocity components separately. Horizontal
      // travel stretches horizontally; vertical travel squashes horizontally
      // and stretches vertically. Bees never rotate (their stripes stay put).
      const squashK = bee.role === 'wax-maker' ? 0.05 : bee.role === 'forager' ? 0.09 : 0.06;
      const cap = bee.role === 'wax-maker' ? 0.25 : 0.4;
      const horizSpeed = Math.abs(dx);
      const vertSpeed = Math.abs(dy);
      const stretchX = Math.min(cap, horizSpeed * squashK) - Math.min(cap * 0.6, vertSpeed * squashK * 0.5);
      const stretchY = Math.min(cap, vertSpeed * squashK) - Math.min(cap * 0.6, horizSpeed * squashK * 0.5);

      // Reaction shake — brief horizontal squish after a key event.
      let shake = 1;
      if (bee.shakeUntilMs > elapsedMs) {
        const t = Math.max(0, (bee.shakeUntilMs - elapsedMs) / 120);
        shake = 1 + 0.35 * t;
      }

      sprite.graphics.rotation = 0;
      sprite.graphics.scale.set((1 + stretchX) * shake, (1 + stretchY) * flap);
      sprite.carry.rotation = 0;
      sprite.carry.scale.set(1, 1);

      this.drawCarry(sprite.carry, bee.carrying);
    }
  }

  private drawBee(g: Graphics, role: 'forager' | 'wax-maker' | 'builder'): void {
    g.clear();
    const bodyColor =
      role === 'forager' ? 0xffd23f : role === 'wax-maker' ? 0xe6b833 : 0xe07a3a;
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
      g.circle(0, 4, 3).fill(0xf5d166);
      g.circle(-1, 3, 1).fill({ color: 0xfff2bf, alpha: 0.6 });
    } else if (carrying === 'wax-block') {
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
