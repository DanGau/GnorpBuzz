import { CellEntity } from './CellEntity';
import { Bee } from './Bee';
import type { HiveData } from '../sim/state';
import { isWorkerCell } from '../sim/state';
import { hexToWorld } from './layout';

// World-side representation of the Hive: the honeycomb. Holds a CellEntity
// for every filled (worker) cell in the sim. Reconciled each tick — when the
// player assigns, clears, or reassigns a cell, the comb adjusts its set of
// CellEntities to match.

function cellKey(q: number, r: number): string {
  return `${q},${r}`;
}

export class HiveEntity {
  hiveId: string;
  cells: Map<string, CellEntity>;

  constructor(hiveId: string) {
    this.hiveId = hiveId;
    this.cells = new Map();
  }

  reconcile(hive: HiveData): void {
    for (const simCell of hive.cells) {
      if (!isWorkerCell(simCell)) continue;
      const key = cellKey(simCell.q, simCell.r);
      const existing = this.cells.get(key);
      if (!existing || existing.role !== simCell.role) {
        const pos = hexToWorld(simCell.q, simCell.r);
        this.cells.set(
          key,
          new CellEntity(simCell.q, simCell.r, pos.x, pos.y, simCell.role as CellEntity['role']),
        );
      }
    }
    const liveKeys = new Set(
      hive.cells.filter(isWorkerCell).map((c) => cellKey(c.q, c.r)),
    );
    for (const key of this.cells.keys()) {
      if (!liveKeys.has(key)) this.cells.delete(key);
    }
  }

  allBees(): Bee[] {
    const bees: Bee[] = [];
    for (const cell of this.cells.values()) {
      for (const bee of cell.bees) bees.push(bee);
    }
    return bees;
  }
}
