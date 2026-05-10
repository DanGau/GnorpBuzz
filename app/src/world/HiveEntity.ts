import { Bee } from './Bee';
import type { HiveType } from '../sim/state';

// Positioned representation of a sim hive. Holds the world-side Bee entities
// for that hive. The slot index drives its position via layout.ts.
// Type drives which kind of bee spawns into it.

export class HiveEntity {
  hiveId: string;
  type: HiveType;
  slotIndex: number;
  x: number;
  y: number;
  bees: Bee[];

  constructor(hiveId: string, type: HiveType, slotIndex: number, x: number, y: number) {
    this.hiveId = hiveId;
    this.type = type;
    this.slotIndex = slotIndex;
    this.x = x;
    this.y = y;
    this.bees = [];
  }

  spawnBee(): void {
    const role =
      this.type === 'forager' ? 'forager' : this.type === 'wax' ? 'wax-maker' : 'builder';
    this.bees.push(new Bee(role, this.hiveId, this.x, this.y));
  }

  despawnBee(): void {
    this.bees.pop();
  }
}
