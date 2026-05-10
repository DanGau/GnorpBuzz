import type { GameState } from '../sim/state';
import { HiveEntity } from './HiveEntity';
import { FlowerEntity } from './FlowerEntity';
import { ParticleSystem } from './ParticleSystem';
import { WORLD, hiveSlotPosition } from './layout';

// The world holds positioned, animated entities mirroring sim state.
// Reconciled each tick: when sim state changes (new hive, more bees), the
// world adjusts its entity set to match. Bee behaviors run inside update()
// and may mutate sim state through callbacks (deposit pollen, deliver block).

export class World {
  hives: Map<string, HiveEntity>;
  flowers: Map<string, FlowerEntity>;
  particles: ParticleSystem;

  constructor() {
    this.hives = new Map();
    this.flowers = new Map();
    this.particles = new ParticleSystem();
  }

  reconcile(state: GameState): void {
    // Hives — match sim
    state.hives.forEach((simHive, index) => {
      let entity = this.hives.get(simHive.id);
      if (!entity) {
        const pos = hiveSlotPosition(index);
        entity = new HiveEntity(simHive.id, simHive.type, index, pos.x, pos.y);
        this.hives.set(simHive.id, entity);
      }
      while (entity.bees.length < simHive.bees) entity.spawnBee();
      while (entity.bees.length > simHive.bees) entity.despawnBee();
    });
    const liveHiveIds = new Set(state.hives.map((h) => h.id));
    for (const id of this.hives.keys()) {
      if (!liveHiveIds.has(id)) this.hives.delete(id);
    }

    // Flowers — created from layout once; positions are stable.
    if (this.flowers.size === 0 || this.flowers.size !== state.flowers.length) {
      this.flowers.clear();
      state.flowers.forEach((simFlower, i) => {
        const pos = WORLD.MEADOW_FLOWERS[i % WORLD.MEADOW_FLOWERS.length];
        this.flowers.set(simFlower.id, new FlowerEntity(simFlower.id, pos.x, pos.y, i * 47));
      });
    }
  }

  update(dtMs: number, state: GameState): void {
    for (const hive of this.hives.values()) {
      for (const bee of hive.bees) bee.update(dtMs, state, this);
    }
    this.particles.update(dtMs);
  }

  getHivePosition(hiveId: string): { x: number; y: number } | null {
    const h = this.hives.get(hiveId);
    return h ? { x: h.x, y: h.y } : null;
  }

  getFlowerPosition(flowerId: string): { x: number; y: number } | null {
    const f = this.flowers.get(flowerId);
    return f ? { x: f.x, y: f.y } : null;
  }

  snapshot() {
    return {
      hives: Array.from(this.hives.values()).map((h) => ({
        id: h.hiveId,
        type: h.type,
        x: h.x,
        y: h.y,
        bees: h.bees.length,
      })),
      flowers: Array.from(this.flowers.values()).length,
    };
  }
}
