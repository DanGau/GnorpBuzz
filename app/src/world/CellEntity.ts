import { Bee } from './Bee';
import type { CellRole } from '../sim/state';

// Positioned representation of a single filled hive cell. Each cell holds
// exactly one worker's worth of output — a persistent bee (Forager, Honey
// Worker, Wax Worker, or Cantor) spawned when the cell is created.

export class CellEntity {
  q: number;
  r: number;
  x: number;
  y: number;
  role: CellRole;
  bees: Bee[];

  constructor(q: number, r: number, x: number, y: number, role: CellRole) {
    this.q = q;
    this.r = r;
    this.x = x;
    this.y = y;
    this.role = role;
    this.bees = [];
    this.spawnBee();
  }

  spawnBee(): void {
    this.bees.push(new Bee(this.role, this.x, this.y, this.q, this.r));
  }
}
