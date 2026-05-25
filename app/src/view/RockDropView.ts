import { Container, Graphics } from 'pixi.js';
import type { GameState, RockDrop } from '../sim/state';

// Render the loot pile near the boulder. Each drop owns its own Graphics
// object built once at the origin so we can apply `.rotation` and `.position`
// per frame — Pixi's batched Graphics primitives don't support a per-shape
// rotation, so a single shared canvas can't tumble individual drops.
// Visual style by kind:
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
  // Halos sit underneath all the spinning drops so they read as a static
  // ground glow rather than tumbling with the seed.
  private halos: Graphics;
  private sprites = new Map<string, Graphics>();

  constructor() {
    this.container = new Container();
    this.halos = new Graphics();
    this.container.addChild(this.halos);
  }

  update(state: GameState): void {
    this.halos.clear();
    const seen = new Set<string>();
    for (const d of state.rockDrops) {
      seen.add(d.id);
      let sprite = this.sprites.get(d.id);
      if (!sprite) {
        sprite = this.buildSprite(d);
        this.sprites.set(d.id, sprite);
        this.container.addChild(sprite);
      }
      sprite.position.set(d.x, d.y);
      sprite.rotation = d.rotation;
      // Tier halos are screen-space — draw them at the drop's current
      // position without rotation. Keeps the sparkle "stuck to" the
      // seed visually even while the hull tumbles.
      if (d.kind === 'seed' && d.tier === 3) {
        this.halos.circle(d.x, d.y, 7).fill({ color: 0xffe890, alpha: 0.22 });
      } else if (d.kind === 'seed' && d.tier === 2) {
        this.halos.circle(d.x, d.y, 5).fill({ color: 0xb8d860, alpha: 0.14 });
      }
    }
    // Reap sprites for drops that no longer exist (hauled away).
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }
  }

  // Build a drop's sprite once at the local origin. Position + rotation
  // are applied at the container level so per-frame work is just two
  // transform writes — no Graphics rebuild.
  private buildSprite(d: RockDrop): Graphics {
    const g = new Graphics();
    if (d.kind === 'fertilizer') {
      g.ellipse(0, 0, 4.5, 3.4).fill(0x4a3210);
      g.ellipse(-0.8, -0.6, 3.0, 1.8).fill({ color: 0x5a4218, alpha: 0.9 });
      g.circle(1.0, -1.8, 1.2).fill({ color: 0x6e8c2a, alpha: 0.95 });
      g.circle(-0.6, -2.0, 0.8).fill({ color: 0x8aa83a, alpha: 0.85 });
      return g;
    }
    const tint = SEED_TIER_TINT[d.tier];
    const glint = SEED_TIER_GLINT[d.tier];
    g.ellipse(0, 0, 3.6, 4.5).fill(tint);
    g.ellipse(-0.9, -0.9, 1.5, 2.0).fill({ color: glint, alpha: 0.8 });
    g.circle(0.6, 0.9, 0.8).fill({ color: 0x1a0e04, alpha: 0.9 });
    return g;
  }
}
