// Plain-data game state for the excavation MVP.
// One Hive: a honeycomb of hex cells. Each filled cell holds one worker —
// a Forager (gathers pollen) or an Excavator (deals damage to the dig site).
// Cells are unlocked one at a time outward from the comb. Same-role
// neighbors grant an adjacency synergy bonus, so clustering by role matters.
// Worker assignments are permanent — there is no clearing or reassigning.
// A single Dig Site sits in the meadow; bees chip its HP down; at 0 HP an
// ancient artifact (comically just human garbage) is revealed and a Scientist
// Bee journal entry pops. Each artifact unlocks the next dig site tier.

export type Currency = 'pollen';

// Per-role upgrade paths. Tier N is unlocked by N dismissed journal entries.
export type UpgradeId =
  | 'forager-swift-wings'
  | 'forager-quick-forage'
  | 'forager-pollen-pouches'
  | 'excavator-sharp-stinger'
  | 'excavator-swift-strike'
  | 'excavator-heavy-swarm';

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
  'excavator-sharp-stinger': {
    id: 'excavator-sharp-stinger',
    role: 'excavator',
    name: 'Sharpened Stinger',
    blurb: '+50% damage per strike',
    maxTier: 5,
    baseCost: 6,
    costGrowth: 1.7,
    currency: 'pollen',
  },
  'excavator-swift-strike': {
    id: 'excavator-swift-strike',
    role: 'excavator',
    name: 'Hasty Recruits',
    blurb: '−15% respawn time',
    maxTier: 3,
    baseCost: 5,
    costGrowth: 1.7,
    currency: 'pollen',
  },
  'excavator-heavy-swarm': {
    id: 'excavator-heavy-swarm',
    role: 'excavator',
    name: 'Heavy Swarm',
    blurb: '+15% flight speed to dig site',
    maxTier: 3,
    baseCost: 8,
    costGrowth: 1.8,
    currency: 'pollen',
  },
};

// The role discriminator, shared by worker bees, cell assignments, and the
// per-role upgrade paths.
export type HiveType = 'forager' | 'excavator';
export type CellRole = HiveType;

// ---- Hive: a honeycomb of hex cells ----
//
// Cells use axial hex coordinates (q, r). A cell present in `hive.cells` is
// unlocked. `role` is:
//   null     — unlocked but empty
//   'forager' / 'excavator' — holds one worker of that role (permanent)

export interface HiveCell {
  q: number;
  r: number;
  role: CellRole | null;
}

export interface HiveData {
  id: string;
  pollen: number;
  cells: HiveCell[];
}

export type FlowerKind = 'pollen';

export interface FlowerData {
  id: string;
  kind: FlowerKind;
  yieldRemaining: number;
  regrowTimerMs: number;
  // How many bees are currently working this flower (en route or
  // harvesting). A flower is claimable while `claimants < yieldRemaining`,
  // so its remaining bloom is the cap — many bees can share one flower
  // instead of one bee locking the whole thing. Ephemeral: reset on load.
  claimants: number;
}

export interface JournalEntry {
  id: string; // matches the revealed artifact id
  tier: number;
  text: string;
}

// ---- Artifacts ----
// Each artifact has a reverent in-world name and a "real" subtitle (the joke
// is the disconnect). One artifact per dig-site tier; they map 1:1 to the
// seven planned phases of the game.

export interface ArtifactSpec {
  id: string;
  tier: number;
  reverentName: string; // what the bees call it
  realName: string; // what it actually is
  journalText: string; // Scientist Bee's field note
  // Next dig-site HP after this artifact is dismissed.
  nextSiteMaxHp: number;
}

export const ARTIFACTS: ArtifactSpec[] = [
  {
    id: 'first-relic',
    tier: 1,
    reverentName: 'The First Relic',
    realName: 'a plastic bottle cap',
    journalText:
      "Smooth and perfectly round, marked with sacred runes (P · E · P · S · I). It hummed when struck. We hummed back.",
    nextSiteMaxHp: 120,
  },
  {
    id: 'crystalline-cylinder',
    tier: 2,
    reverentName: 'The Crystalline Cylinder',
    realName: 'an empty soda can',
    journalText:
      "A vessel of immense pressure once. The brown elixir is long gone but the cylinder remembers. It still fizzes a little when shaken.",
    nextSiteMaxHp: 320,
  },
  {
    id: 'singing-pebble',
    tier: 3,
    reverentName: 'The Singing Pebble',
    realName: 'an AirPod',
    journalText:
      "It WHISPERED. To me. By name. I wept openly. The colony is concerned but I am at peace. We are not alone.",
    nextSiteMaxHp: 820,
  },
  {
    id: 'sacred-brick',
    tier: 4,
    reverentName: 'The Sacred Brick',
    realName: 'a Lego 2x4',
    journalText:
      "Geometric perfection. Eight studs, arrayed in two rows of four. Surely the gods themselves laid this brick. We have begun to worship it.",
    nextSiteMaxHp: 2200,
  },
  {
    id: 'eternal-duckling',
    tier: 5,
    reverentName: 'The Eternal Duckling',
    realName: 'a rubber duck',
    journalText:
      "It does not decay. It does not feed. It only smiles. The smile has not faded in the days we have studied it. We are beginning to find it unsettling.",
    nextSiteMaxHp: 5800,
  },
  {
    id: 'window-of-visions',
    tier: 6,
    reverentName: 'The Window of Visions',
    realName: 'a cracked iPhone screen',
    journalText:
      "Through the glass, I saw myself, reversed. The reversed-me waved. I did not wave first. I am quite certain I did not wave first.",
    nextSiteMaxHp: 14000,
  },
  {
    id: 'sky-tether',
    tier: 7,
    reverentName: 'The Sky Tether',
    realName: "a child's half-deflated mylar balloon",
    journalText:
      "It still tries to rise. Even half-empty, it strains upward. We will tie ourselves to it. It wants to fly. We want to fly. The flower waits.",
    nextSiteMaxHp: 0, // endgame — no next site
  },
];

export function artifactForTier(tier: number): ArtifactSpec | null {
  return ARTIFACTS.find((a) => a.tier === tier) ?? null;
}

// ---- Dig site ----

export type DigSiteState = 'active' | 'revealing' | 'sealed';

export interface DigSiteData {
  id: string;
  tier: number; // 1..7
  hp: number;
  maxHp: number;
  state: DigSiteState;
}

// ---- Ascent (endgame) ----

export type AscentPhase = 'none' | 'launching' | 'ascending' | 'arrived';

export interface AscentData {
  phase: AscentPhase;
  timer: number;
}

// ---- Game state ----

export interface GameState {
  tick: number;
  elapsedMs: number;
  hive: HiveData;
  flowers: FlowerData[];
  digSite: DigSiteData;
  artifacts: {
    revealed: string[];
    pending: string | null;
  };
  journal: { entries: JournalEntry[]; pending: boolean; dismissedCount: number };
  upgrades: Partial<Record<UpgradeId, number>>;
  ascent: AscentData;
}

export const TUNING = {
  BEE_BASE_COST: 2,
  BEE_COST_GROWTH: 1.3,

  // Hive comb — unlocking a new cell. Cost scales with the cell's hex
  // distance (ring) from the center of the comb. The comb cannot grow past
  // MAX_COMB_RADIUS rings, which keeps it bounded on-screen.
  CELL_BASE_COST: 6,
  CELL_COST_GROWTH: 1.5,
  MAX_COMB_RADIUS: 4,

  // Adjacency synergy: each same-role neighbor of a filled cell grants this
  // fractional bonus. Foragers gain flight speed; excavators gain damage.
  SYNERGY_FORAGER_SPEED: 0.08,
  SYNERGY_EXCAVATOR_DAMAGE: 0.12,

  // Dig site
  DIG_SITE_TIER_1_HP: 40,

  // Excavator strike — each bee gets ONE strike then expires. The hive
  // respawns a fresh bee on a per-slot cooldown so we always see a stream
  // of new bees flying toward the dig site.
  EXCAVATOR_BASE_DAMAGE: 1,
  EXCAVATOR_WINDUP_MS: 400,
  EXCAVATOR_RESPAWN_MS: 1800, // base time between expiration and next spawn

  // Ascent (endgame)
  ASCENT_LAUNCH_MS: 1200,
  ASCENT_FLIGHT_MS: 5000,

  // Flowers
  FLOWER_YIELD: 5,
  FLOWER_REGROW_MS: 60_000,

  // Shared
  BEE_SPEED: 90,
  HARVEST_DURATION_MS: 3000,
  IDLE_WANDER_DURATION_MS: 2000,
} as const;

const FLOWER_COUNT = 12;

// The cells the colony starts with — a small connected cluster at the
// center of the comb, all mutually adjacent so the first same-role pairs
// are reachable immediately.
const STARTING_CELLS: ReadonlyArray<{ q: number; r: number }> = [
  { q: 0, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function createInitialState(): GameState {
  const flowers: FlowerData[] = [];
  for (let i = 0; i < FLOWER_COUNT; i++) {
    flowers.push({
      id: `flower-${i}`,
      kind: 'pollen',
      yieldRemaining: TUNING.FLOWER_YIELD,
      regrowTimerMs: 0,
      claimants: 0,
    });
  }
  const cells: HiveCell[] = STARTING_CELLS.map((c) => ({
    q: c.q,
    r: c.r,
    role: null,
  }));
  return {
    tick: 0,
    elapsedMs: 0,
    hive: { id: 'hive', pollen: 0, cells },
    flowers,
    digSite: {
      id: 'dig-site',
      tier: 1,
      hp: TUNING.DIG_SITE_TIER_1_HP,
      maxHp: TUNING.DIG_SITE_TIER_1_HP,
      state: 'active',
    },
    artifacts: { revealed: [], pending: null },
    journal: { entries: [], pending: false, dismissedCount: 0 },
    upgrades: {},
    ascent: { phase: 'none', timer: 0 },
  };
}

// ---- Upgrade helpers ----

export function getUpgradeTier(state: GameState, id: UpgradeId): number {
  return state.upgrades[id] ?? 0;
}

export function isUpgradeUnlocked(state: GameState, id: UpgradeId): boolean {
  const def = UPGRADE_DEFS[id];
  const currentTier = getUpgradeTier(state, id);
  if (currentTier >= def.maxTier) return false;
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

// ---- Hex grid helpers ----

// The six axial-coordinate neighbor directions for a pointy-top hex grid.
export const HEX_DIRS: ReadonlyArray<{ q: number; r: number }> = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexNeighbors(q: number, r: number): { q: number; r: number }[] {
  return HEX_DIRS.map((d) => ({ q: q + d.q, r: r + d.r }));
}

// Ring distance of a hex coordinate from the comb center (0, 0).
export function hexDistance(q: number, r: number): number {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

// ---- Hive / cell helpers ----

export function cellAt(hive: HiveData, q: number, r: number): HiveCell | undefined {
  return hive.cells.find((c) => c.q === q && c.r === r);
}

export function isWorkerCell(cell: HiveCell): boolean {
  return cell.role === 'forager' || cell.role === 'excavator';
}

export function countRole(state: GameState, role: CellRole): number {
  return state.hive.cells.filter((c) => c.role === role).length;
}

export function totalBees(state: GameState): number {
  return state.hive.cells.filter(isWorkerCell).length;
}

export function totalPollen(state: GameState): number {
  return state.hive.pollen;
}

// Number of same-role neighbors for the cell at (q, r). Returns 0 for cells
// that are empty, locked, or the queen.
export function cellSynergy(hive: HiveData, q: number, r: number): number {
  const cell = cellAt(hive, q, r);
  if (!cell || !isWorkerCell(cell)) return 0;
  let count = 0;
  for (const n of hexNeighbors(q, r)) {
    const neighbor = cellAt(hive, n.q, n.r);
    if (neighbor && neighbor.role === cell.role) count += 1;
  }
  return count;
}

// Locked cells on the frontier — neighbors of existing cells that aren't
// themselves unlocked yet, and that fall within the comb radius cap.
export function buyableCells(hive: HiveData): { q: number; r: number }[] {
  const result: { q: number; r: number }[] = [];
  const seen = new Set<string>();
  for (const cell of hive.cells) {
    for (const n of hexNeighbors(cell.q, cell.r)) {
      const key = `${n.q},${n.r}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (cellAt(hive, n.q, n.r)) continue;
      if (hexDistance(n.q, n.r) > TUNING.MAX_COMB_RADIUS) continue;
      result.push(n);
    }
  }
  return result;
}

export function isCellBuyable(hive: HiveData, q: number, r: number): boolean {
  if (cellAt(hive, q, r)) return false;
  return buyableCells(hive).some((c) => c.q === q && c.r === r);
}

// Cost to unlock a comb cell — scales with its ring distance from the
// center, so cells farther out cost more.
export function cellCost(q: number, r: number): number {
  const dist = Math.max(1, hexDistance(q, r));
  return Math.ceil(TUNING.CELL_BASE_COST * Math.pow(TUNING.CELL_COST_GROWTH, dist - 1));
}

// The very first worker placed must be a Forager — without a pollen income
// the player could otherwise soft-lock the colony.
export function mustPlaceForager(state: GameState): boolean {
  return totalBees(state) === 0;
}

// Cost to place the next worker of a role into a cell. First of each role is
// free; subsequent workers escalate with that role's count.
export function nextWorkerCost(state: GameState, role: CellRole): number {
  const n = countRole(state, role);
  if (n === 0) return 0;
  return Math.ceil(TUNING.BEE_BASE_COST * Math.pow(TUNING.BEE_COST_GROWTH, n - 1));
}

// ---- Dig site helpers ----

export function digSiteHpPct(state: GameState): number {
  if (state.digSite.maxHp <= 0) return 0;
  return Math.max(0, state.digSite.hp / state.digSite.maxHp);
}

export function pendingArtifact(state: GameState): ArtifactSpec | null {
  if (!state.artifacts.pending) return null;
  return ARTIFACTS.find((a) => a.id === state.artifacts.pending) ?? null;
}

// ---- Excavator stat helpers (used by Bee + UI) ----

// Global damage per strike, before per-cell adjacency synergy is applied.
export function excavatorDamagePerStrike(state: GameState): number {
  const sharp = getUpgradeTier(state, 'excavator-sharp-stinger');
  return TUNING.EXCAVATOR_BASE_DAMAGE * Math.pow(1.5, sharp);
}

export function excavatorRespawnMs(state: GameState): number {
  const swift = getUpgradeTier(state, 'excavator-swift-strike');
  return TUNING.EXCAVATOR_RESPAWN_MS * Math.pow(0.85, swift);
}
