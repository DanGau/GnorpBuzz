// Plain-data game state for the agent-based Phase 1 MVP.
// Three buildings: Forager Hive, Wax Hive, Builder Hive (fixed structures).
// Player buys individual worker bees. Vessel waits for a click to launch.

export type Currency = 'pollen' | 'wax';

// Per-role upgrade paths. Tier N is unlocked by N dismissed journal entries.
// Stacking: each path is its own family — tiers within stack additively
// (per docs/dps-model.md), and we read the family count directly. Across
// roles the families are independent (not multiplicative for now).
export type UpgradeId =
  | 'forager-swift-wings'
  | 'forager-quick-forage'
  | 'forager-pollen-pouches'
  | 'waxmaker-stoked-furnace'
  | 'waxmaker-quick-pickup'
  | 'waxmaker-big-batches'
  | 'builder-strong-wings'
  | 'builder-quick-drops'
  | 'builder-heavy-lifters';

export interface UpgradeDef {
  id: UpgradeId;
  role: HiveType;
  name: string;
  blurb: string;
  maxTier: number;
  baseCost: number;
  costGrowth: number;
  currency: Currency;
}

export const UPGRADE_DEFS: Record<UpgradeId, UpgradeDef> = {
  'forager-swift-wings': {
    id: 'forager-swift-wings',
    role: 'forager',
    name: 'Swift Wings',
    blurb: '+15% flight speed',
    maxTier: 5,
    baseCost: 4,
    costGrowth: 1.6,
    currency: 'pollen',
  },
  'forager-quick-forage': {
    id: 'forager-quick-forage',
    role: 'forager',
    name: 'Quick Forage',
    blurb: '−20% harvest time',
    maxTier: 3,
    baseCost: 5,
    costGrowth: 1.7,
    currency: 'pollen',
  },
  'forager-pollen-pouches': {
    id: 'forager-pollen-pouches',
    role: 'forager',
    name: 'Pollen Pouches',
    blurb: '+1 pollen carried per trip',
    maxTier: 3,
    baseCost: 8,
    costGrowth: 1.8,
    currency: 'pollen',
  },
  'waxmaker-stoked-furnace': {
    id: 'waxmaker-stoked-furnace',
    role: 'wax',
    name: 'Stoked Furnace',
    blurb: '−15% production time',
    maxTier: 5,
    baseCost: 6,
    costGrowth: 1.6,
    currency: 'pollen',
  },
  'waxmaker-quick-pickup': {
    id: 'waxmaker-quick-pickup',
    role: 'wax',
    name: 'Quick Pickup',
    blurb: '−30% pickup time',
    maxTier: 3,
    baseCost: 5,
    costGrowth: 1.6,
    currency: 'pollen',
  },
  'waxmaker-big-batches': {
    id: 'waxmaker-big-batches',
    role: 'wax',
    name: 'Big Batches',
    blurb: '+1 wax block per cycle',
    maxTier: 3,
    baseCost: 10,
    costGrowth: 1.8,
    currency: 'pollen',
  },
  'builder-strong-wings': {
    id: 'builder-strong-wings',
    role: 'builder',
    name: 'Strong Wings',
    blurb: '+15% flight speed',
    maxTier: 5,
    baseCost: 3,
    costGrowth: 1.6,
    currency: 'wax',
  },
  'builder-quick-drops': {
    id: 'builder-quick-drops',
    role: 'builder',
    name: 'Quick Drops',
    blurb: '−30% pickup + drop time',
    maxTier: 3,
    baseCost: 4,
    costGrowth: 1.6,
    currency: 'wax',
  },
  'builder-heavy-lifters': {
    id: 'builder-heavy-lifters',
    role: 'builder',
    name: 'Heavy Lifters',
    blurb: '+1 wax block carried per trip',
    maxTier: 3,
    baseCost: 6,
    costGrowth: 1.8,
    currency: 'wax',
  },
};

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
  journal: { entries: JournalEntry[]; pending: boolean; dismissedCount: number };
  upgrades: Partial<Record<UpgradeId, number>>;
  // Number of times a vessel has launched (post-dismiss). Used to pick the
  // next journal entry from the predefined sequence.
  launchCount: number;
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
    journal: { entries: [], pending: false, dismissedCount: 0 },
    upgrades: {},
    launchCount: 0,
  };
}

// ---- Upgrade helpers ----

export function getUpgradeTier(state: GameState, id: UpgradeId): number {
  return state.upgrades[id] ?? 0;
}

/** A tier is unlocked once at least `tier` journal entries have been dismissed. */
export function isUpgradeUnlocked(state: GameState, id: UpgradeId): boolean {
  const def = UPGRADE_DEFS[id];
  const currentTier = getUpgradeTier(state, id);
  if (currentTier >= def.maxTier) return false; // already maxed
  // Next tier (currentTier + 1) requires (currentTier + 1) journal entries.
  return state.journal.dismissedCount >= currentTier + 1;
}

export function nextUpgradeCost(state: GameState, id: UpgradeId): number {
  const def = UPGRADE_DEFS[id];
  const tier = getUpgradeTier(state, id);
  if (tier >= def.maxTier) return 0;
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, tier));
}

export function upgradesForRole(role: HiveType): UpgradeDef[] {
  return Object.values(UPGRADE_DEFS).filter((u) => u.role === role);
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
