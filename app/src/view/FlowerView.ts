import { Container, Graphics } from 'pixi.js';
import { WORLD } from '../world/layout';
import type { World } from '../world/World';
import type { GameState } from '../sim/state';
import { TUNING } from '../sim/state';

// Renders the goal sky-flower (always visible, gently pulses) and the
// meadow flowers — bloom / partial / wilted state read from sim.

const PETAL_COLORS = [0xff6fa6, 0xfff066, 0xc066ff, 0xff9966, 0xffaa55];

interface FlowerSprite {
  id: string;
  graphics: Graphics;
  hue: number;
  x: number;
  y: number;
}

export class FlowerView {
  readonly container: Container;
  private skyFlower: Graphics;
  private meadowGroup: Container;
  private flowerSprites: Map<string, FlowerSprite>;
  private pulse = 0;

  constructor() {
    this.container = new Container();
    this.meadowGroup = new Container();
    this.skyFlower = new Graphics();
    this.flowerSprites = new Map();
    this.container.addChild(this.meadowGroup);
    this.container.addChild(this.skyFlower);
  }

  update(state: GameState, world: World, dtMs: number): void {
    this.pulse += dtMs / 1000;

    // Reconcile sprite set with world flowers
    for (const flower of world.flowers.values()) {
      let sprite = this.flowerSprites.get(flower.id);
      if (!sprite) {
        const g = new Graphics();
        this.meadowGroup.addChild(g);
        sprite = { id: flower.id, graphics: g, hue: flower.hue, x: flower.x, y: flower.y };
        this.flowerSprites.set(flower.id, sprite);
      }
    }
    // Re-draw each based on current sim state
    for (const sprite of this.flowerSprites.values()) {
      const sim = state.flowers.find((f) => f.id === sprite.id);
      this.drawFlower(sprite, sim);
    }

    this.drawSkyFlower();
  }

  private drawFlower(
    sprite: FlowerSprite,
    sim:
      | { yieldRemaining: number; regrowTimerMs: number; kind?: 'pollen' | 'nectar' }
      | undefined,
  ): void {
    const g = sprite.graphics;
    g.clear();
    const isNectar = sim?.kind === 'nectar';
    // Nectar flowers wear cool blue/cyan petals; pollen flowers cycle the
    // warmer palette by hue index.
    const color = isNectar
      ? [0x66c8ff, 0x88a8ff, 0x66ffe0][sprite.hue % 3]
      : PETAL_COLORS[sprite.hue % PETAL_COLORS.length];
    const coreColor = isNectar ? 0xffffff : 0xffe066;
    const yieldNow = sim?.yieldRemaining ?? TUNING.FLOWER_YIELD;
    const regrowFrac = sim ? 1 - sim.regrowTimerMs / TUNING.FLOWER_REGROW_MS : 1;

    if (yieldNow === 0) {
      g.roundRect(sprite.x - 1, sprite.y - 4, 2, 12, 1).fill(0x556633);
      const r = 1 + 3 * Math.max(0, Math.min(1, regrowFrac));
      g.circle(sprite.x, sprite.y - 4, r).fill({ color: isNectar ? 0x6699bb : 0x6e8b3a, alpha: 0.7 });
      return;
    }

    const petalCount = Math.max(1, Math.min(5, yieldNow));
    const r = isNectar ? 7 : 6;
    for (let i = 0; i < petalCount; i++) {
      const a = (i / petalCount) * Math.PI * 2;
      const px = sprite.x + Math.cos(a) * r;
      const py = sprite.y + Math.sin(a) * r;
      g.circle(px, py, isNectar ? 5.5 : 5).fill(color);
    }
    if (isNectar) {
      // Faint inner glow so nectar flowers feel special.
      g.circle(sprite.x, sprite.y, 6).fill({ color: 0xb0e0ff, alpha: 0.35 });
    }
    g.circle(sprite.x, sprite.y, 4).fill(coreColor);
  }

  private drawSkyFlower(): void {
    const g = this.skyFlower;
    g.clear();
    const { x, y, baseRadius } = WORLD.FLOWER;
    const breath = 1 + Math.sin(this.pulse * 1.4) * 0.08;
    const glowR = baseRadius * 3.2 * breath;
    g.circle(x, y, glowR).fill({ color: 0xffeaa0, alpha: 0.18 });
    g.circle(x, y, glowR * 0.65).fill({ color: 0xfff2bf, alpha: 0.22 });
    const petalCount = 8;
    const petalR = baseRadius * 1.6 * breath;
    for (let i = 0; i < petalCount; i++) {
      const a = (i / petalCount) * Math.PI * 2;
      const px = x + Math.cos(a) * (baseRadius * 0.7);
      const py = y + Math.sin(a) * (baseRadius * 0.7);
      g.circle(px, py, petalR * 0.55).fill(0xffd5d5);
    }
    g.circle(x, y, baseRadius * 0.9).fill(0xffe680);
    g.circle(x, y, baseRadius * 0.55).fill(0xfff8d0);
  }

  // Removed: initFromWorld no longer needed; reconciliation happens in update()
}
