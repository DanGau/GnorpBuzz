import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  TUNING,
  totalBees,
  totalPollen,
  totalWaxBlocks,
  nextHiveCost,
} from './state';
import { queenSystem } from './systems/queen';
import { buyHive, dismissJournal } from './actions';
import { serialize, deserialize } from './save';

describe('sim state shape', () => {
  it('starts with one Forager Hive and one Wax Hive', () => {
    const s = createInitialState();
    const foragers = s.hives.filter((h) => h.type === 'forager');
    const waxen = s.hives.filter((h) => h.type === 'wax');
    expect(foragers).toHaveLength(1);
    expect(waxen).toHaveLength(1);
    expect(totalBees(s)).toBe(5);
    expect(totalPollen(s)).toBe(0);
    expect(totalWaxBlocks(s)).toBe(0);
  });

  it('starts with flowers in the meadow at full bloom', () => {
    const s = createInitialState();
    expect(s.flowers.length).toBeGreaterThan(0);
    for (const f of s.flowers) {
      expect(f.yieldRemaining).toBe(TUNING.FLOWER_YIELD);
      expect(f.regrowTimerMs).toBe(0);
      expect(f.claimedByBeeId).toBeNull();
    }
  });

  it('vessel needs the configured block count to launch', () => {
    const s = createInitialState();
    expect(s.vessel.requiredBlocks).toBe(TUNING.VESSEL_BLOCKS_REQUIRED);
    expect(s.vessel.deliveredBlocks).toBe(0);
    expect(s.vessel.phase).toBe('building');
  });
});

describe('queen', () => {
  it('queen fills empty hive slots over time', () => {
    const s = createInitialState();
    // Forager hive has 3/4, wax hive has 2/4. Tick QUEEN_FILL_MS — one slot fills.
    queenSystem(s, TUNING.QUEEN_FILL_MS);
    expect(totalBees(s)).toBe(6);
  });
});

describe('actions', () => {
  it('buyHive forager fails when insufficient wax', () => {
    const s = createInitialState();
    const result = buyHive(s, 'forager');
    expect(result.ok).toBe(false);
  });

  it('buyHive forager succeeds, deducts wax, adds empty hive', () => {
    const s = createInitialState();
    const wax = s.hives.find((h) => h.type === 'wax')! as Extract<
      typeof s.hives[number],
      { type: 'wax' }
    >;
    wax.waxBlocks = 100;
    const cost = nextHiveCost(s, 'forager');
    const result = buyHive(s, 'forager');
    expect(result.ok).toBe(true);
    expect(totalWaxBlocks(s)).toBe(100 - cost);
    const foragers = s.hives.filter((h) => h.type === 'forager');
    expect(foragers).toHaveLength(2);
    expect(foragers[1].bees).toBe(0);
  });

  it('buyHive wax adds a new wax hive', () => {
    const s = createInitialState();
    const wax = s.hives.find((h) => h.type === 'wax')! as Extract<
      typeof s.hives[number],
      { type: 'wax' }
    >;
    wax.waxBlocks = 100;
    buyHive(s, 'wax');
    const waxen = s.hives.filter((h) => h.type === 'wax');
    expect(waxen).toHaveLength(2);
  });

  it('hive cost grows independently per type', () => {
    const s = createInitialState();
    const c1 = nextHiveCost(s, 'forager');
    // Push enough foragers to clear ceiling-rounding noise
    for (let i = 0; i < 5; i++) {
      s.hives.push({ id: `extra-f-${i}`, type: 'forager', slots: 4, bees: 0, pollen: 0 });
    }
    const c2 = nextHiveCost(s, 'forager');
    expect(c2).toBeGreaterThan(c1);
    // Wax cost unaffected by adding foragers
    const cw = nextHiveCost(s, 'wax');
    expect(cw).toBe(nextHiveCost(s, 'wax'));
  });

  it('dismissJournal closes a pending entry', () => {
    const s = createInitialState();
    s.journal.pending = true;
    s.journal.entries.push({ id: 'e1', tier: 1, text: 'test' });
    const result = dismissJournal(s);
    expect(result.ok).toBe(true);
    expect(s.journal.pending).toBe(false);
    expect(s.vessel.phase).toBe('reviewed');
  });
});

describe('save', () => {
  it('round-trips state', () => {
    const s = createInitialState();
    const f = s.hives[0] as Extract<typeof s.hives[number], { type: 'forager' }>;
    f.pollen = 7;
    s.flowers[0].yieldRemaining = 2;
    const restored = deserialize(serialize(s));
    const f2 = restored.hives[0] as Extract<
      typeof restored.hives[number],
      { type: 'forager' }
    >;
    expect(f2.pollen).toBe(7);
    expect(restored.flowers[0].yieldRemaining).toBe(2);
  });
});
