import { Container, Graphics } from 'pixi.js';
import type { GameState, RockDrop } from '../sim/state';

// Render the loot pile near the boulder. Iterates `state.rockDrops` every
// frame and draws each at its current position. Settled drops are static;
// in-flight drops show their arc as physics runs in the sim layer. Visual
// style by kind:
//   seed       — small dark teardrop in a tier-tinted hull
//   fertilizer — chunky green-brown nub
// Fossil honey never reaches here — it auto-applies on spawn.

const SEED_TIER_TINT: Record<1 | 2 | 3, number> = {
  1: 0x5a3a14, // umber — common
  2: 0x6a8a2a, // grass-green hull — uncommon
  3: 0xc89a2a, // gold-tipped — rare
};

const SEED_TIER_GLINT: Record<1 | 2 | 3, number> = {
  1: 0x8a6a2a,
  2: 0xb8d860,
  3: 0xffe890,
};

export class RockDropView {
  readonly container: Container;
  private layer: Graphics;

  constructor() {
    this.container = new Container();
    this.layer = new Graphics();
    this.container.addChild(this.layer);
  }

  update(state: GameState): void {
    const g = this.layer;
    g.clear();
    for (const d of state.rockDrops) {
      this.drawDrop(g, d);
    }
  }

  private drawDrop(g: Graphics, d: RockDrop): void {
    if (d.kind === 'fertilizer') {
      // A chunky compost nub — irregular pebble with a hint of green moss
      // on top so it reads as organic, not just another seed.
      g.ellipse(d.x, d.y, 4.5, 3.4).fill(0x4a3210);
      g.ellipse(d.x - 0.8, d.y - 0.6, 3.0, 1.8).fill({ color: 0x5a4218, alpha: 0.9 });
      g.circle(d.x + 1.0, d.y - 1.8, 1.2).fill({ color: 0x6e8c2a, alpha: 0.95 });
      g.circle(d.x - 0.6, d.y - 2.0, 0.8).fill({ color: 0x8aa83a, alpha: 0.85 });
      return;
    }
    // Seed — teardrop with tier-colored hull, dark eye, tiny glint.
    const tint = SEED_TIER_TINT[d.tier];
    const glint = SEED_TIER_GLINT[d.tier];
    g.ellipse(d.x, d.y, 3.6, 4.5).fill(tint);
    g.ellipse(d.x - 0.9, d.y - 0.9, 1.5, 2.0).fill({ color: glint, alpha: 0.8 });
    g.circle(d.x + 0.6, d.y + 0.9, 0.8).fill({ color: 0x1a0e04, alpha: 0.9 });
    // Tier-3 seeds get a subtle aura so the player notices the jackpot.
    if (d.tier === 3) {
      g.circle(d.x, d.y, 7).fill({ color: 0xffe890, alpha: 0.22 });
    }
    // Tier-2 seeds get a faint green halo — subtler than T3 but still a tell.
    if (d.tier === 2) {
      g.circle(d.x, d.y, 5).fill({ color: 0xb8d860, alpha: 0.14 });
    }
  }
}
