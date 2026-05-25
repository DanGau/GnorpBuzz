import { Container, Graphics } from 'pixi.js';
import type { GameState, RockDrop } from '../sim/state';
import type { World } from '../world/World';

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

// Cadence for the random sparkle the pile emits over its highest-tier
// settled drops. Keeps the eye drifting back to the corner without
// drowning the rest of the scene in noise.
const PILE_SPARKLE_INTERVAL_MS = 620;

export class RockDropView {
  readonly container: Container;
  // Halos sit underneath all the spinning drops so they read as a static
  // ground glow rather than tumbling with the seed.
  private halos: Graphics;
  private sprites = new Map<string, Graphics>();
  private pulseMs = 0;
  private sparkleAccumMs = 0;

  constructor() {
    this.container = new Container();
    this.halos = new Graphics();
    this.container.addChild(this.halos);
  }

  update(state: GameState, world: World, dtMs: number): void {
    this.pulseMs += dtMs;
    this.halos.clear();
    const seen = new Set<string>();
    // Track settled high-tier drops so the periodic pile-sparkle can pick
    // one without re-scanning state.rockDrops. Cheap — bounded by cap.
    const sparkleCandidates: RockDrop[] = [];
    for (const d of state.rockDrops) {
      seen.add(d.id);
      let sprite = this.sprites.get(d.id);
      if (!sprite) {
        sprite = this.buildSprite(d);
        if (d.tintJitter !== undefined) sprite.tint = d.tintJitter;
        this.sprites.set(d.id, sprite);
        this.container.addChild(sprite);
      }
      const liftT = d.liftT ?? 0;
      if (
        liftT > 0 &&
        d.liftFromX !== undefined &&
        d.liftFromY !== undefined &&
        d.liftToX !== undefined &&
        d.liftToY !== undefined
      ) {
        // easeOutBack — the drop slingshots toward the bee, reading as
        // "yanked off the pile". The entity's own x/y is left untouched
        // so physics neighbors keep their stacking relationships during
        // the 150ms lift — only the SPRITE moves.
        const c1 = 1.70158;
        const c3 = c1 + 1;
        const u = liftT - 1;
        const e = 1 + c3 * u * u * u + c1 * u * u;
        const sx = d.liftFromX + (d.liftToX - d.liftFromX) * e;
        const sy = d.liftFromY + (d.liftToY - d.liftFromY) * e;
        sprite.position.set(sx, sy);
        sprite.scale.set(1 - liftT * liftT * 0.85);
      } else {
        sprite.position.set(d.x, d.y);
        sprite.scale.set(1);
      }
      sprite.rotation = d.rotation;
      // Tier halos are screen-space — draw them at the drop's current
      // position without rotation. Sine-pulse the alpha (per-drop phase
      // via id hash) so the corner of the screen quietly breathes when
      // loot is sitting there waiting for a forager.
      if (d.kind === 'seed' && (d.tier === 2 || d.tier === 3)) {
        const phase = hashPhase(d.id);
        const pulse = 0.7 + 0.3 * Math.sin(this.pulseMs / 480 + phase);
        if (d.tier === 3) {
          this.halos.circle(d.x, d.y, 12).fill({ color: 0xffe890, alpha: 0.24 * pulse });
        } else {
          this.halos.circle(d.x, d.y, 8.5).fill({ color: 0xb8d860, alpha: 0.16 * pulse });
        }
        if (d.settled && d.tier === 3) sparkleCandidates.push(d);
      }
    }
    // Reap sprites for drops that no longer exist (hauled away).
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.sprites.delete(id);
      }
    }

    // Periodic pile-sparkle — one random tier-3 settled drop pops a
    // sparkle particle every ~600ms. Tiny attention-pull so the player
    // notices a fresh rare drop in the corner without staring at it.
    this.sparkleAccumMs += dtMs;
    if (
      this.sparkleAccumMs >= PILE_SPARKLE_INTERVAL_MS &&
      sparkleCandidates.length > 0
    ) {
      this.sparkleAccumMs = 0;
      const pick = sparkleCandidates[Math.floor(Math.random() * sparkleCandidates.length)];
      world.particles.emit('sparkle', pick.x, pick.y - 2, 1);
    }
  }

  // Build a drop's sprite once at the local origin. Position + rotation
  // are applied at the container level so per-frame work is just two
  // transform writes — no Graphics rebuild.
  private buildSprite(d: RockDrop): Graphics {
    const g = new Graphics();
    if (d.kind === 'fertilizer') {
      g.ellipse(0, 0, 7.7, 5.8).fill(0x4a3210);
      g.ellipse(-1.4, -1.0, 5.1, 3.1).fill({ color: 0x5a4218, alpha: 0.9 });
      g.circle(1.7, -3.1, 2.0).fill({ color: 0x6e8c2a, alpha: 0.95 });
      g.circle(-1.0, -3.4, 1.4).fill({ color: 0x8aa83a, alpha: 0.85 });
      return g;
    }
    const tint = SEED_TIER_TINT[d.tier];
    const glint = SEED_TIER_GLINT[d.tier];
    g.ellipse(0, 0, 6.1, 7.7).fill(tint);
    g.ellipse(-1.5, -1.5, 2.6, 3.4).fill({ color: glint, alpha: 0.8 });
    g.circle(1.0, 1.5, 1.4).fill({ color: 0x1a0e04, alpha: 0.9 });
    return g;
  }
}

// Stable [0, 2π) phase from a drop id so each halo pulses on its own
// rhythm — the pile shimmers organically rather than throbbing in unison.
function hashPhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000 * Math.PI * 2;
}
