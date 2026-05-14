import { Bee } from './Bee';
import type { CellRole, GameState } from '../sim/state';
import { excavatorRespawnMs } from '../sim/state';

// Positioned representation of a single filled hive cell. Each cell holds
// exactly one worker's worth of output. Forager cells keep a persistent bee;
// excavator cells run a one-shot respawn loop (the bee flies out, strikes,
// expires, and a fresh one pops after a cooldown).

export class CellEntity {
  q: number;
  r: number;
  x: number;
  y: number;
  role: CellRole;
  bees: Bee[];
  // Excavator-only: ms remaining until the cell respawns its bee.
  respawnQueue: number[];

  constructor(q: number, r: number, x: number, y: number, role: CellRole) {
    this.q = q;
    this.r = r;
    this.x = x;
    this.y = y;
    this.role = role;
    this.bees = [];
    this.respawnQueue = [];
    // Seed the cell's one worker. Excavators come in via the respawn queue
    // (cooldown 0 = immediate), foragers spawn directly.
    if (role === 'excavator') {
      this.respawnQueue.push(0);
    } else {
      this.spawnBee();
    }
  }

  spawnBee(): void {
    this.bees.push(new Bee(this.role, this.x, this.y, this.q, this.r));
  }

  // Excavator cells: tick down the respawn timer and reap expired bees.
  // Foragers don't expire so this is a no-op for them.
  tickRespawn(dtMs: number, state: GameState): void {
    if (this.role !== 'excavator') return;

    let i = 0;
    while (i < this.bees.length) {
      if (this.bees[i].state === 'expired') {
        this.bees.splice(i, 1);
        this.respawnQueue.push(excavatorRespawnMs(state));
      } else {
        i += 1;
      }
    }

    for (let j = this.respawnQueue.length - 1; j >= 0; j--) {
      this.respawnQueue[j] -= dtMs;
      if (this.respawnQueue[j] <= 0) {
        this.respawnQueue.splice(j, 1);
        this.spawnBee();
      }
    }
  }
}
