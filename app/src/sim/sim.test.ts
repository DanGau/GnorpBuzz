import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  TUNING,
  totalBees,
  totalPollen,
  totalWax,
  countRole,
  nextWorkerCost,
  cellCost,
  hexDistance,
  mustPlaceForager,
  cellAt,
  cellSynergy,
  isCellBuyable,
  buyableCells,
  ARTIFACTS,
  artifactForTier,
} from './state';
import { digSiteSystem } from './systems/dig-sites';
import { artifactSystem } from './systems/artifact';
import {
  buyCell,
  assignCell,
  dismissArtifact,
  damageDigSite,
} from './actions';
import { serialize, deserialize } from './save';

describe('hive cell model', () => {
  it('starts with four free empty cells, no workers, no resources', () => {
    const s = createInitialState();
    expect(s.hive.cells).toHaveLength(4);
    expect(s.hive.cells.every((c) => c.role === null)).toBe(true);
    expect(totalBees(s)).toBe(0);
    expect(totalPollen(s)).toBe(0);
    expect(totalWax(s)).toBe(0);
    expect(s.hive.honey).toBe(0);
    expect(s.hive.pollenCap).toBeGreaterThan(0);
    expect(s.hive.waxCap).toBeGreaterThan(0);
  });

  it('starts with flowers in the meadow at full bloom', () => {
    const s = createInitialState();
    expect(s.flowers.length).toBeGreaterThan(0);
    for (const f of s.flowers) {
      expect(f.yieldRemaining).toBe(TUNING.FLOWER_YIELD);
      expect(f.regrowTimerMs).toBe(0);
      expect(f.claimants).toBe(0);
    }
  });

  it('starts with an active tier-1 dig site at full HP', () => {
    const s = createInitialState();
    expect(s.digSite.tier).toBe(1);
    expect(s.digSite.state).toBe('active');
    expect(s.digSite.hp).toBe(TUNING.DIG_SITE_TIER_1_HP);
    expect(s.digSite.maxHp).toBe(TUNING.DIG_SITE_TIER_1_HP);
  });

  it('exposes 7 artifacts mirroring the 7 vessel tiers', () => {
    expect(ARTIFACTS).toHaveLength(7);
    expect(artifactForTier(1)?.id).toBe('first-relic');
    expect(artifactForTier(7)?.id).toBe('sky-tether');
  });
});

describe('cell actions', () => {
  it('the first worker must be a Forager', () => {
    const s = createInitialState();
    expect(mustPlaceForager(s)).toBe(true);
    const bad = assignCell(s, 0, 0, 'cantor');
    expect(bad.ok).toBe(false);
    expect(bad.reason).toMatch(/Forager/);
    expect(assignCell(s, 0, 0, 'forager').ok).toBe(true);
    expect(mustPlaceForager(s)).toBe(false);
  });

  it('first forager and first wax-worker are free; other roles cost wax up front', () => {
    const s = createInitialState();
    expect(nextWorkerCost(s, 'forager')).toBe(0);
    expect(nextWorkerCost(s, 'wax-worker')).toBe(0);
    // Cantor and honey-worker must be paid for from the start so the
    // player can't soft-lock by filling early cells with non-wax roles.
    expect(nextWorkerCost(s, 'cantor')).toBeGreaterThan(0);
    expect(nextWorkerCost(s, 'honey-worker')).toBeGreaterThan(0);
    expect(assignCell(s, 0, 0, 'forager').ok).toBe(true);
    expect(countRole(s, 'forager')).toBe(1);
    expect(nextWorkerCost(s, 'forager')).toBeGreaterThan(0);
  });

  it('placing a second worker of a role requires wax', () => {
    const s = createInitialState();
    assignCell(s, 0, 0, 'forager'); // free
    const result = assignCell(s, 0, 1, 'forager');
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/wax/);
    s.hive.wax = 100;
    const cost = nextWorkerCost(s, 'forager');
    expect(assignCell(s, 0, 1, 'forager').ok).toBe(true);
    expect(s.hive.wax).toBe(100 - cost);
  });

  it('cell assignments are permanent — a filled cell cannot be reassigned', () => {
    const s = createInitialState();
    s.hive.wax = 100;
    assignCell(s, 0, 0, 'forager');
    const reassign = assignCell(s, 0, 0, 'cantor');
    expect(reassign.ok).toBe(false);
    expect(reassign.reason).toMatch(/already/);
    expect(cellAt(s.hive, 0, 0)?.role).toBe('forager');
  });

  it('buys a frontier cell; cost scales with hex distance from center', () => {
    const s = createInitialState();
    s.hive.wax = 100000;
    const frontier = buyableCells(s.hive);
    expect(frontier.length).toBeGreaterThan(0);
    const target = frontier[0];
    expect(isCellBuyable(s.hive, target.q, target.r)).toBe(true);
    expect(buyCell(s, target.q, target.r).ok).toBe(true);
    expect(cellAt(s.hive, target.q, target.r)?.role).toBeNull();
    // A ring-1 cell is cheaper than a ring-3 cell.
    expect(cellCost(1, 0)).toBeLessThan(cellCost(3, 0));
    expect(cellCost(1, 0)).toBe(TUNING.CELL_BASE_COST);
  });

  it('rejects buying a cell that is not on the frontier', () => {
    const s = createInitialState();
    s.hive.wax = 100000;
    expect(buyCell(s, 9, 9).ok).toBe(false);
  });

  it('cannot grow the comb past the radius cap', () => {
    const s = createInitialState();
    s.hive.wax = 100000;
    // Greedily buy every reachable cell.
    for (let i = 0; i < 200; i++) {
      const frontier = buyableCells(s.hive);
      if (frontier.length === 0) break;
      buyCell(s, frontier[0].q, frontier[0].r);
    }
    expect(buyableCells(s.hive)).toHaveLength(0);
    for (const c of s.hive.cells) {
      expect(hexDistance(c.q, c.r)).toBeLessThanOrEqual(TUNING.MAX_COMB_RADIUS);
    }
  });

  it('counts same-role neighbors as synergy', () => {
    const s = createInitialState();
    s.hive.wax = 1000;
    // Starting cells (-1,1) and (0,1) are adjacent to each other.
    assignCell(s, -1, 1, 'forager');
    assignCell(s, 0, 1, 'forager');
    expect(cellSynergy(s.hive, -1, 1)).toBe(1);
    expect(cellSynergy(s.hive, 0, 1)).toBe(1);
    // A worker with no same-role neighbor has zero synergy.
    assignCell(s, 0, 0, 'cantor');
    expect(cellSynergy(s.hive, 0, 0)).toBe(0);
  });

  it('honey-worker and wax-worker are placeable after a forager exists', () => {
    const s = createInitialState();
    s.hive.wax = 100;
    assignCell(s, 0, 0, 'forager'); // free
    expect(assignCell(s, -1, 1, 'honey-worker').ok).toBe(true);
    expect(cellAt(s.hive, -1, 1)?.role).toBe('honey-worker');
    expect(assignCell(s, 0, 1, 'wax-worker').ok).toBe(true);
    expect(cellAt(s.hive, 0, 1)?.role).toBe('wax-worker');
  });
});

describe('dig site progression', () => {
  it('damaging the dig site to 0 HP triggers a reveal', () => {
    const s = createInitialState();
    damageDigSite(s, TUNING.DIG_SITE_TIER_1_HP);
    digSiteSystem(s);
    expect(s.digSite.state).toBe('revealing');
    expect(s.artifacts.pending).toBe('first-relic');
  });

  it('artifact system pushes a journal entry and pends the modal', () => {
    const s = createInitialState();
    damageDigSite(s, TUNING.DIG_SITE_TIER_1_HP);
    digSiteSystem(s);
    artifactSystem(s);
    expect(s.journal.pending).toBe(true);
    expect(s.journal.entries).toHaveLength(1);
    expect(s.journal.entries[0].id).toBe('first-relic');
  });

  it('dismissing the artifact advances to the next dig site tier', () => {
    const s = createInitialState();
    damageDigSite(s, TUNING.DIG_SITE_TIER_1_HP);
    digSiteSystem(s);
    artifactSystem(s);
    expect(dismissArtifact(s).ok).toBe(true);
    expect(s.artifacts.revealed).toContain('first-relic');
    expect(s.digSite.tier).toBe(2);
    expect(s.digSite.state).toBe('active');
    expect(s.digSite.hp).toBe(s.digSite.maxHp);
    expect(s.journal.dismissedCount).toBe(1);
  });

  it('dismissing the legendary artifact triggers ascent', () => {
    const s = createInitialState();
    for (let t = 1; t <= 6; t++) {
      s.digSite.hp = 0;
      digSiteSystem(s);
      artifactSystem(s);
      dismissArtifact(s);
    }
    expect(s.digSite.tier).toBe(7);
    s.digSite.hp = 0;
    digSiteSystem(s);
    artifactSystem(s);
    dismissArtifact(s);
    expect(s.artifacts.revealed).toContain('sky-tether');
    expect(s.ascent.phase).toBe('launching');
  });
});

describe('save', () => {
  it('round-trips state', () => {
    const s = createInitialState();
    s.hive.wax = 7;
    s.hive.pollen = 3;
    assignCell(s, 0, 0, 'forager');
    s.flowers[0].yieldRemaining = 2;
    s.digSite.hp = 12;
    const restored = deserialize(serialize(s));
    expect(restored.hive.wax).toBe(7);
    expect(restored.hive.pollen).toBe(3);
    expect(cellAt(restored.hive, 0, 0)?.role).toBe('forager');
    expect(restored.flowers[0].yieldRemaining).toBe(2);
    expect(restored.digSite.hp).toBe(12);
  });

  it('rejects an incompatible pre-v4 save shape', () => {
    const legacy = JSON.stringify({ hives: [], flowers: [], tick: 5 });
    const restored = deserialize(legacy);
    expect(restored.hive).toBeDefined();
    expect(restored.hive.cells.length).toBe(4);
    expect(restored.tick).toBe(0);
  });
});
