import type { GameState } from '../sim/state';
import { TUNING } from '../sim/state';
import { HiveEntity } from './HiveEntity';
import { FlowerEntity } from './FlowerEntity';
import { DigSiteEntity } from './DigSiteEntity';
import { ParticleSystem } from './ParticleSystem';
import { WORLD } from './layout';

// The world holds positioned, animated entities mirroring sim state.
// Reconciled each tick: when sim state changes (cell assigned, more bees),
// the world adjusts its entity set to match.

// Subset of the view layer the sim is allowed to poke for reaction
// feedback. The renderer wires the live `HoneyBarView` in here so bees
// (which only see `World`) can fire produce/consume flashes without the
// sim layer importing presentation code.
export interface HoneyBarReactions {
  flashProduce(): void;
  flashConsume(): void;
  manaSourcePoint(): { x: number; y: number };
}

export class World {
  hive: HiveEntity;
  flowers: Map<string, FlowerEntity>;
  digSite: DigSiteEntity | null;
  particles: ParticleSystem;
  honeyBar: HoneyBarReactions | null;

  constructor() {
    this.hive = new HiveEntity('hive');
    this.flowers = new Map();
    this.digSite = null;
    this.particles = new ParticleSystem();
    this.honeyBar = null;
  }

  reconcile(state: GameState): void {
    this.hive.reconcile(state.hive);

    if (this.flowers.size === 0 || this.flowers.size !== state.flowers.length) {
      this.flowers.clear();
      state.flowers.forEach((simFlower, i) => {
        const pos = WORLD.MEADOW_FLOWERS[i % WORLD.MEADOW_FLOWERS.length];
        this.flowers.set(simFlower.id, new FlowerEntity(simFlower.id, pos.x, pos.y, i * 47));
      });
    }

    if (!this.digSite) {
      this.digSite = new DigSiteEntity(state.digSite.id, WORLD.DIG_SITE.x, WORLD.DIG_SITE.y);
    }
  }

  update(dtMs: number, state: GameState): void {
    for (const cell of this.hive.cells.values()) {
      for (const bee of cell.bees) bee.update(dtMs, state, this);
      cell.tickRespawn(dtMs, state);
    }
    this.particles.update(dtMs);
  }

  getFlowerPosition(flowerId: string): { x: number; y: number } | null {
    const f = this.flowers.get(flowerId);
    return f ? { x: f.x, y: f.y } : null;
  }

  // Cantor's cantrip spark — homing projectile that flies all the way to
  // the dig site and bursts on contact. Damage is already applied at cast
  // time (so the sim is deterministic), but the visual must actually arrive
  // or the spell reads as fizzling. One bright lead spark plus two slightly
  // offset trailers; each is independently homing on the impact point.
  emitSpark(originX: number, originY: number, targetX: number, targetY: number): void {
    const speed = TUNING.CANTOR_PROJECTILE_SPEED;
    for (let i = 0; i < 3; i++) {
      // Lateral jitter at the origin so the trio reads as a tight cluster
      // rather than three sparks stacked on the same pixel. The targets
      // are also slightly offset so they don't pile up exactly on impact.
      const ox = originX + (i - 1) * 2.4;
      const oy = originY + (i - 1) * 1.8;
      const tx = targetX + (i - 1) * 3;
      const ty = targetY + (i - 1) * 2;
      const size = i === 0 ? 1.8 : 1.1;
      this.particles.emitHoming('spark', ox, oy, tx, ty, speed, size);
    }
  }

  // Mana flowing from the hive's honey reservoir to a casting bee. Fires
  // a small homing orb that arrives at (toX, toY) — typically the bee's
  // current position the instant it commits to cast — and a brief jar
  // squish to signal "mana drawn." Damage on the dig site is applied
  // separately at cast time so the sim stays deterministic; this is
  // entirely cosmetic.
  emitManaDraw(toX: number, toY: number): void {
    if (!this.honeyBar) return;
    const src = this.honeyBar.manaSourcePoint();
    this.honeyBar.flashConsume();
    // Slow + chunky on purpose — the bee is right next to the jar so the
    // travel distance is short, and we want the orb to read as a beat
    // rather than a flicker.
    this.particles.emitHoming('manaOrb', src.x, src.y, toX, toY, 180, 2.4);
    // A pair of small honey-drops dribbling off the jar's lip — reads as
    // "some splashed out" while the main orb is the magic being routed.
    this.particles.emit('honeyDrop', src.x - 2, src.y + 18, 2);
  }

  // Mana being topped up from a forager deposit. Subtle jar bump + a
  // small sparkle at the jar; the deposit-side pollen puff already lives
  // at the hive entrance, so this completes the visual chain.
  emitManaRefine(amount: number): void {
    if (!this.honeyBar || amount <= 0) return;
    const src = this.honeyBar.manaSourcePoint();
    this.honeyBar.flashProduce();
    this.particles.emit('sparkle', src.x, src.y - 4, Math.min(3, 1 + amount));
  }

  snapshot() {
    return {
      hive: {
        id: this.hive.hiveId,
        cells: Array.from(this.hive.cells.values()).map((c) => ({
          q: c.q,
          r: c.r,
          role: c.role,
          alive: c.bees.length,
          respawning: c.respawnQueue.length,
        })),
      },
      flowers: this.flowers.size,
      digSite: this.digSite ? { x: this.digSite.x, y: this.digSite.y } : null,
    };
  }
}
