// Plain-data game state for the agent-based Phase 1 MVP.
// Single Forager Hive and single Wax Hive (fixed structures). Player buys
// individual worker bees to grow each hive's roster. No queen / auto-spawn.
// Vessel transitions to 'ready' when full and waits for player click.
// See docs/agent-behavior.md.

export type VesselPhase =
  | 'building'
  | 'ready'
  | 'launching'
  | 'crashing'
  | 'crashed'
  | 'reviewed';
export type HiveType = 'forager' | 'wax';

export interface ForagerHiveData {
  id: string;
  type: 'forager';
  bees: number;
  pollen: number;
}

export interface WaxHiveData {
  id: string;
  type: 'wax';
  bees: number;
  waxBlocks: number; // overflow stockpile when vessel is not building
}

export type HiveData = ForagerHiveData | WaxHiveData;

export interface FlowerData {
  id: string;
  yieldRemaining: number;
  regrowTimerMs: number;
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
  vessel: {
    deliveredBlocks: number;
    requiredBlocks: number;
    phase: VesselPhase;
    launchTimer: number;
  };
  journal: { entries: JournalEntry[]; pending: boolean };
}

// Tuning constants for MVP. Placeholders per docs/mvp-scope.md.
export const TUNING = {
  // First bee of each type is free; subsequent cost ceil(BASE * GROWTH^(n-1))
  // where n = current bee count.
  BEE_BASE_COST: 2,
  BEE_COST_GROWTH: 1.3,

  // Vessel
  VESSEL_BLOCKS_REQUIRED: 8,
  LAUNCH_DURATION_MS: 4000,
  CRASH_DURATION_MS: 2000,

  // Flowers
  FLOWER_YIELD: 5,
  FLOWER_REGROW_MS: 60_000,

  // Bee behavior timings
  BEE_SPEED: 90,
  HARVEST_DURATION_MS: 3000,
  PICKUP_DURATION_MS: 500,
  DROP_DURATION_MS: 500,
  PRODUCE_DURATION_MS: 5000,
  IDLE_WANDER_DURATION_MS: 2000,
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
      { id: 'forager-hive', type: 'forager', bees: 0, pollen: 0 },
      { id: 'wax-hive', type: 'wax', bees: 0, waxBlocks: 0 },
    ],
    flowers,
    vessel: {
      deliveredBlocks: 0,
      requiredBlocks: TUNING.VESSEL_BLOCKS_REQUIRED,
      phase: 'building',
      launchTimer: 0,
    },
    journal: { entries: [], pending: false },
  };
}

export function getForagerHive(state: GameState): ForagerHiveData {
  return state.hives.find((h) => h.type === 'forager') as ForagerHiveData;
}

export function getWaxHive(state: GameState): WaxHiveData {
  return state.hives.find((h) => h.type === 'wax') as WaxHiveData;
}

export function nextBeeCost(state: GameState, type: HiveType): number {
  const hive = state.hives.find((h) => h.type === type);
  const n = hive?.bees ?? 0;
  if (n === 0) return 0; // first bee of each type is free
  return Math.ceil(TUNING.BEE_BASE_COST * Math.pow(TUNING.BEE_COST_GROWTH, n - 1));
}

export function totalBees(state: GameState): number {
  return state.hives.reduce((sum, h) => sum + h.bees, 0);
}

export function totalPollen(state: GameState): number {
  return state.hives.reduce((sum, h) => sum + (h.type === 'forager' ? h.pollen : 0), 0);
}

// The vessel's deliveredBlocks IS the global wax pool. Wax-makers add to it;
// bee purchases drain from it; vessel "completes" when it reaches required.
export function spendableWax(state: GameState): number {
  return state.vessel.deliveredBlocks + getWaxHive(state).waxBlocks;
}
