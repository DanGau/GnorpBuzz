// Plain-data game state for the agent-based Phase 1 MVP.
// Three buildings: Forager Hive, Wax Hive, Builder Hive (fixed structures).
// Player buys individual worker bees. Vessel waits for a click to launch.

export type Currency = 'pollen' | 'wax';

export type VesselPhase =
  | 'building'
  | 'ready'
  | 'launching'
  | 'crashing'
  | 'crashed'
  | 'reviewed';
export type HiveType = 'forager' | 'wax' | 'builder';

export interface ForagerHiveData {
  id: string;
  type: 'forager';
  built: boolean;
  bees: number;
  pollen: number;
}

export interface WaxHiveData {
  id: string;
  type: 'wax';
  built: boolean;
  bees: number;
  waxBlocks: number; // produced by wax-makers, drained by builders
}

export interface BuilderHiveData {
  id: string;
  type: 'builder';
  built: boolean;
  bees: number;
}

export type HiveData = ForagerHiveData | WaxHiveData | BuilderHiveData;

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

export const TUNING = {
  BEE_BASE_COST: 2,
  BEE_COST_GROWTH: 1.3,

  // Building costs (one-shot to construct a hive). Forager Hive starts
  // built; the others are unlocked by paying these costs.
  WAX_HIVE_BUILD_COST: 8, // pollen
  BUILDER_HIVE_BUILD_COST: 4, // wax

  VESSEL_BLOCKS_REQUIRED: 8,
  LAUNCH_DURATION_MS: 4000,
  CRASH_DURATION_MS: 2000,

  FLOWER_YIELD: 5,
  FLOWER_REGROW_MS: 60_000,

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
    // Order matches the slot order in world/layout.ts.
    hives: [
      { id: 'forager-hive', type: 'forager', built: true, bees: 0, pollen: 0 },
      { id: 'builder-hive', type: 'builder', built: false, bees: 0 },
      { id: 'wax-hive', type: 'wax', built: false, bees: 0, waxBlocks: 0 },
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

export function getBuilderHive(state: GameState): BuilderHiveData {
  return state.hives.find((h) => h.type === 'builder') as BuilderHiveData;
}

export function nextBeeCost(state: GameState, type: HiveType): number {
  const hive = state.hives.find((h) => h.type === type);
  const n = hive?.bees ?? 0;
  if (n === 0) return 0;
  return Math.ceil(TUNING.BEE_BASE_COST * Math.pow(TUNING.BEE_COST_GROWTH, n - 1));
}

// Foragers and wax-makers are the production-side roles — paid in raw pollen.
// Builders are the late-stage role that delivers finished wax — paid in wax.
export function costCurrency(type: HiveType): Currency {
  return type === 'builder' ? 'wax' : 'pollen';
}

// One-shot construction cost for an unbuilt hive. Forager Hive is always
// built (starter), so this returns null for it.
export function buildCost(
  type: HiveType,
): { amount: number; currency: Currency } | null {
  if (type === 'wax') return { amount: TUNING.WAX_HIVE_BUILD_COST, currency: 'pollen' };
  if (type === 'builder')
    return { amount: TUNING.BUILDER_HIVE_BUILD_COST, currency: 'wax' };
  return null;
}

export function totalBees(state: GameState): number {
  return state.hives.reduce((sum, h) => sum + h.bees, 0);
}

export function totalPollen(state: GameState): number {
  return state.hives.reduce((sum, h) => sum + (h.type === 'forager' ? h.pollen : 0), 0);
}

export function spendableWax(state: GameState): number {
  return state.vessel.deliveredBlocks + getWaxHive(state).waxBlocks;
}
