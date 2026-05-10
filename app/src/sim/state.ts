// Plain-data game state for the agent-based Phase 1 MVP.
// Pollen lives at Forager Hives; wax blocks live at Wax Hives.
// Production happens via bee behavior, not via /sec formulas.
// See docs/agent-behavior.md.

export type VesselPhase = 'building' | 'launching' | 'crashing' | 'crashed' | 'reviewed';
export type HiveType = 'forager' | 'wax';

export interface ForagerHiveData {
  id: string;
  type: 'forager';
  slots: number;
  bees: number;
  pollen: number;
}

export interface WaxHiveData {
  id: string;
  type: 'wax';
  slots: number;
  bees: number;
  waxBlocks: number;
}

export type HiveData = ForagerHiveData | WaxHiveData;

export interface FlowerData {
  id: string;
  yieldRemaining: number; // 0 = wilted; > 0 = harvestable
  regrowTimerMs: number; // counts down to 0; when 0, yield resets
  claimedByBeeId: string | null;
}

export interface JournalEntry {
  id: string;
  tier: number;
  text: string;
}

export interface GameState {
  tick: number;
  elapsedMs: number;
  hives: HiveData[];
  flowers: FlowerData[];
  queen: { fillProgressMs: number };
  vessel: {
    deliveredBlocks: number;
    requiredBlocks: number;
    phase: VesselPhase;
    launchTimer: number;
  };
  journal: { entries: JournalEntry[]; pending: boolean };
  hiveSeq: number;
}

// Tuning constants for MVP. Placeholders per docs/mvp-scope.md;
// will be tuned after the loop is playable.
export const TUNING = {
  HIVE_BASE_COST: 5, // in wax blocks
  HIVE_COST_GROWTH: 1.08,
  HIVE_SLOTS: 4,
  QUEEN_FILL_MS: 15_000,

  // Vessel
  VESSEL_BLOCKS_REQUIRED: 8,
  LAUNCH_DURATION_MS: 4000,
  CRASH_DURATION_MS: 2000,

  // Flowers
  FLOWER_YIELD: 5,
  FLOWER_REGROW_MS: 60_000,

  // Bee behavior timings
  BEE_SPEED: 90, // pixels/sec
  HARVEST_DURATION_MS: 3000,
  PICKUP_DURATION_MS: 500,
  DROP_DURATION_MS: 500,
  PRODUCE_DURATION_MS: 5000,
  IDLE_WANDER_DURATION_MS: 2000, // how long a bee wanders before re-checking work
} as const;

const FLOWER_COUNT = 8;

export function createInitialState(): GameState {
  const flowers: FlowerData[] = [];
  for (let i = 0; i < FLOWER_COUNT; i++) {
    flowers.push({
      id: `flower-${i}`,
      yieldRemaining: TUNING.FLOWER_YIELD,
      regrowTimerMs: 0,
      claimedByBeeId: null,
    });
  }
  return {
    tick: 0,
    elapsedMs: 0,
    hives: [
      { id: 'hive-0', type: 'forager', slots: TUNING.HIVE_SLOTS, bees: 3, pollen: 0 },
      { id: 'hive-1', type: 'wax', slots: TUNING.HIVE_SLOTS, bees: 2, waxBlocks: 0 },
    ],
    flowers,
    queen: { fillProgressMs: 0 },
    vessel: {
      deliveredBlocks: 0,
      requiredBlocks: TUNING.VESSEL_BLOCKS_REQUIRED,
      phase: 'building',
      launchTimer: 0,
    },
    journal: { entries: [], pending: false },
    hiveSeq: 2,
  };
}

// Cost is per-hive-type: each type's cost grows with its own count.
export function nextHiveCost(state: GameState, type: HiveType): number {
  const n = state.hives.filter((h) => h.type === type).length;
  return Math.ceil(TUNING.HIVE_BASE_COST * Math.pow(TUNING.HIVE_COST_GROWTH, n));
}

export function totalBees(state: GameState): number {
  return state.hives.reduce((sum, h) => sum + h.bees, 0);
}

export function totalPollen(state: GameState): number {
  return state.hives.reduce((sum, h) => sum + (h.type === 'forager' ? h.pollen : 0), 0);
}

export function totalWaxBlocks(state: GameState): number {
  return state.hives.reduce((sum, h) => sum + (h.type === 'wax' ? h.waxBlocks : 0), 0);
}
