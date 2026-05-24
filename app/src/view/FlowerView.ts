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
      | {
          yieldRemaining: number;
          regrowTimerMs: number;
          growthMs?: number;
          tier?: 1 | 2 | 3;
          kind?: 'pollen' | 'nectar';
        }
      | undefined,
  ): void {
    const g = sprite.graphics;
    g.clear();
    const isNectar = sim?.kind === 'nectar';
    // Sapling phase — render a tiny sprout that gradually grows into a
    // bloom. growthFrac goes 0 (just planted) → 1 (about to open).
    const growthMs = sim?.growthMs ?? 0;
    if (growthMs > 0) {
      const growthFrac = 1 - Math.min(1, growthMs / TUNING.SAPLING_GROWTH_MS);
      // Stem rises from the ground as growth progresses.
      const stemH = 2 + growthFrac * 6;
      g.roundRect(sprite.x - 0.8, sprite.y - stemH, 1.6, stemH + 1, 0.6).fill(0x4a7a2a);
      // Two tiny leaves splay out from the stem at the top.
      const leafR = 1.2 + growthFrac * 1.6;
      g.ellipse(sprite.x - 1.3, sprite.y - stemH + 0.5, leafR, leafR * 0.55)
        .fill(0x6a9c3a);
      g.ellipse(sprite.x + 1.3, sprite.y - stemH + 0.5, leafR, leafR * 0.55)
        .fill(0x6a9c3a);
      // A closed bud at the top — tints toward the flower's eventual petal
      // color as growth completes, so the player sees the bloom coming.
      const tier = sim?.tier ?? 1;
      const petalColor = PETAL_COLORS[sprite.hue % PETAL_COLORS.length];
      const budColor = lerpColor(0x6a9c3a, petalColor, growthFrac * 0.7);
      g.circle(sprite.x, sprite.y - stemH - 0.4, 1 + growthFrac * 1.2).fill(budColor);
      if (tier === 3 && growthFrac > 0.5) {
        g.circle(sprite.x, sprite.y - stemH - 0.4, 4)
          .fill({ color: 0xffe890, alpha: 0.18 * growthFrac });
      }
      return;
    }
    // Nectar flowers wear cool blue/cyan petals; pollen flowers cycle the
    // warmer palette by hue index.
    const color = isNectar
      ? [0x66c8ff, 0x88a8ff, 0x66ffe0][sprite.hue % 3]
      : PETAL_COLORS[sprite.hue % PETAL_COLORS.length];
    const coreColor = isNectar ? 0xffffff : 0xffe066;
    const yieldNow = sim?.yieldRemaining ?? TUNING.FLOWER_YIELD;
    const regrowFrac = sim ? 1 - sim.regrowTimerMs / TUNING.FLOWER_REGROW_MS : 1;
    const tier = sim?.tier ?? 1;

    if (yieldNow === 0) {
      g.roundRect(sprite.x - 1, sprite.y - 4, 2, 12, 1).fill(0x556633);
      const r = 1 + 3 * Math.max(0, Math.min(1, regrowFrac));
      g.circle(sprite.x, sprite.y - 4, r).fill({ color: isNectar ? 0x6699bb : 0x6e8b3a, alpha: 0.7 });
      return;
    }

    // Tier-scaled radius: T2 a touch bigger, T3 noticeably bigger, so the
    // player can spot a jackpot bloom at a glance.
    const tierScale = tier === 3 ? 1.45 : tier === 2 ? 1.15 : 1.0;
    const petalCount = Math.max(1, Math.min(5, yieldNow));
    const r = (isNectar ? 7 : 6) * tierScale;
    const petalR = (isNectar ? 5.5 : 5) * tierScale;
    for (let i = 0; i < petalCount; i++) {
      const a = (i / petalCount) * Math.PI * 2;
      const px = sprite.x + Math.cos(a) * r;
      const py = sprite.y + Math.sin(a) * r;
      g.circle(px, py, petalR).fill(color);
    }
    if (isNectar) {
      // Faint inner glow so nectar flowers feel special.
      g.circle(sprite.x, sprite.y, 6 * tierScale).fill({ color: 0xb0e0ff, alpha: 0.35 });
    }
    if (tier === 3) {
      // Gold halo on T3 — matches the jackpot drop / sapling glow.
      g.circle(sprite.x, sprite.y, 12).fill({ color: 0xffe890, alpha: 0.18 });
    }
    g.circle(sprite.x, sprite.y, 4 * tierScale).fill(coreColor);
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

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const gc = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (gc << 8) | bl;
}
