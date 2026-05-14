import type { GameState } from '../sim/state';
import { HiveEntity } from './HiveEntity';
import { FlowerEntity } from './FlowerEntity';
import { DigSiteEntity } from './DigSiteEntity';
import { ParticleSystem } from './ParticleSystem';
import { WORLD } from './layout';

// The world holds positioned, animated entities mirroring sim state.
// Reconciled each tick: when sim state changes (cell assigned, more bees),
// the world adjusts its entity set to match.

export class World {
  hive: HiveEntity;
  flowers: Map<string, FlowerEntity>;
  digSite: DigSiteEntity | null;
  particles: ParticleSystem;

  constructor() {
    this.hive = new HiveEntity('hive');
    this.flowers = new Map();
    this.digSite = null;
    this.particles = new ParticleSystem();
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
