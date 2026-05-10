import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  TUNING,
  totalBees,
  totalPollen,
  spendableWax,
  nextBeeCost,
  getForagerHive,
  getWaxHive,
} from './state';
import { vesselSystem } from './systems/vessel';
import { buyBee, dismissJournal, launchVessel } from './actions';
import { serialize, deserialize } from './save';

describe('sim state shape', () => {
  it('starts with one empty Forager Hive and one empty Wax Hive', () => {
    const s = createInitialState();
    expect(s.hives).toHaveLength(2);
    expect(getForagerHive(s).bees).toBe(0);
    expect(getWaxHive(s).bees).toBe(0);
    expect(totalBees(s)).toBe(0);
    expect(totalPollen(s)).toBe(0);
    expect(spendableWax(s)).toBe(0);
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

  it('vessel needs the configured block count', () => {
    const s = createInitialState();
    expect(s.vessel.requiredBlocks).toBe(TUNING.VESSEL_BLOCKS_REQUIRED);
    expect(s.vessel.deliveredBlocks).toBe(0);
    expect(s.vessel.phase).toBe('building');
  });
});

describe('actions', () => {
  it('first forager bee is free', () => {
    const s = createInitialState();
    expect(nextBeeCost(s, 'forager')).toBe(0);
    const result = buyBee(s, 'forager');
    expect(result.ok).toBe(true);
    expect(getForagerHive(s).bees).toBe(1);
  });

  it('first wax-maker bee is free', () => {
    const s = createInitialState();
    expect(nextBeeCost(s, 'wax')).toBe(0);
    buyBee(s, 'wax');
    expect(getWaxHive(s).bees).toBe(1);
  });

  it('subsequent bees cost wax and fail without it', () => {
    const s = createInitialState();
    buyBee(s, 'forager'); // free
    expect(nextBeeCost(s, 'forager')).toBeGreaterThan(0);
    const result = buyBee(s, 'forager');
    expect(result.ok).toBe(false);
  });

  it('bee cost grows with each purchase', () => {
    const s = createInitialState();
    buyBee(s, 'forager');
    const c1 = nextBeeCost(s, 'forager');
    // Hand-mutate to fake the next purchase happening
    getForagerHive(s).bees = 5;
    const cN = nextBeeCost(s, 'forager');
    expect(cN).toBeGreaterThan(c1);
  });

  it('bee cost is independent per type', () => {
    const s = createInitialState();
    buyBee(s, 'forager');
    expect(nextBeeCost(s, 'wax')).toBe(0); // wax bee still free
  });

  it('vessel transitions to ready (not launching) when full', () => {
    const s = createInitialState();
    s.vessel.deliveredBlocks = TUNING.VESSEL_BLOCKS_REQUIRED;
    vesselSystem(s);
    expect(s.vessel.phase).toBe('ready');
  });

  it('launchVessel only works when vessel is ready', () => {
    const s = createInitialState();
    expect(launchVessel(s).ok).toBe(false);
    s.vessel.phase = 'ready';
    expect(launchVessel(s).ok).toBe(true);
    expect(s.vessel.phase).toBe('launching');
  });

  it('buying a bee can drain the vessel pile and revert ready→building', () => {
    const s = createInitialState();
    buyBee(s, 'forager'); // free
    s.vessel.deliveredBlocks = TUNING.VESSEL_BLOCKS_REQUIRED;
    vesselSystem(s);
    expect(s.vessel.phase).toBe('ready');
    // Forager has 1 bee, next costs > 0
    const result = buyBee(s, 'forager');
    expect(result.ok).toBe(true);
    expect(s.vessel.deliveredBlocks).toBeLessThan(TUNING.VESSEL_BLOCKS_REQUIRED);
    expect(s.vessel.phase).toBe('building');
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
    getForagerHive(s).pollen = 7;
    s.flowers[0].yieldRemaining = 2;
    const restored = deserialize(serialize(s));
    expect(getForagerHive(restored).pollen).toBe(7);
    expect(restored.flowers[0].yieldRemaining).toBe(2);
  });
});
