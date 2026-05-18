// Plain-data game state for the wizard/excavation MVP.
//
// LORE: the bees are wizards. Foragers are the mundane caste — they harvest
// pollen from meadow flowers and the hive refines it into HONEY, the colony's
// mana. Spellcaster bees (Geomancer, Cantor) burn honey to cast spells that
// crack the rock. If the hive has no honey, casters drift into an idle swarm
// near the hive until the foragers refill the reservoir.
//
// One Hive: a honeycomb of hex cells. Each filled cell holds one worker —
// a Forager (gathers pollen → honey), a Geomancer (melee earth-magic; dives
// onto the rock), or a Cantor (cantrip-tier hover-caster; lobs sparks at the
// rock from above the hive). Same-role neighbors grant an adjacency synergy
// bonus, so clustering by role matters. Worker assignments are permanent.
// A single Dig Site sits in the meadow; spellcasters chip its HP down; at 0
// HP an ancient artifact (comically just human garbage) is revealed and a
// Scientist Bee journal entry pops. Each artifact unlocks the next tier.

export type Currency = 'pollen';

// Per-role upgrade paths. Tier N is unlocked by N dismissed journal entries.
export type UpgradeId =
  | 'forager-swift-wings'
  | 'forager-quick-forage'
  | 'forager-pollen-pouches'
  | 'geomancer-sharp-stinger'
  | 'geomancer-swift-strike'
  | 'geomancer-heavy-swarm'
  | 'cantor-quicker-cantrip'
  | 'cantor-twin-spark'
  | 'cantor-mana-sip';

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
  'geomancer-sharp-stinger': {
    id: 'geomancer-sharp-stinger',
    role: 'geomancer',
    name: 'Sharpened Stinger',
    blurb: '+50% damage per spell',
    maxTier: 5,
    baseCost: 6,
    costGrowth: 1.7,
    currency: 'pollen',
  },
  'geomancer-swift-strike': {
    id: 'geomancer-swift-strike',
    role: 'geomancer',
    name: 'Hasty Recruits',
    blurb: '−15% respawn time',
    maxTier: 3,
    baseCost: 5,
    costGrowth: 1.7,
    currency: 'pollen',
  },
  'geomancer-heavy-swarm': {
    id: 'geomancer-heavy-swarm',
    role: 'geomancer',
    name: 'Heavy Swarm',
    blurb: '+15% flight speed to dig site',
    maxTier: 3,
    baseCost: 8,
    costGrowth: 1.8,
    currency: 'pollen',
  },
  'cantor-quicker-cantrip': {
    id: 'cantor-quicker-cantrip',
    role: 'cantor',
    name: 'Quicker Cantrip',
    blurb: '−20% time between sparks',
    maxTier: 5,
    baseCost: 4,
    costGrowth: 1.6,
    currency: 'pollen',
  },
  'cantor-twin-spark': {
    id: 'cantor-twin-spark',
    role: 'cantor',
    name: 'Twin Spark',
    blurb: '+25% spark damage',
    maxTier: 3,
    baseCost: 6,
    costGrowth: 1.7,
    currency: 'pollen',
  },
  'cantor-mana-sip': {
    id: 'cantor-mana-sip',
    role: 'cantor',
    name: 'Mana Sip',
    blurb: 'Cantrips refund 1 mana every 4 casts',
    maxTier: 3,
    baseCost: 10,
    costGrowth: 1.9,
    currency: 'pollen',
  },
};

// The role discriminator, shared by worker bees, cell assignments, and the
// per-role upgrade paths. Foragers are the mundane caste (gather pollen,
// fuel the honey/mana reservoir). Geomancers and Cantors are spellcasters
// that burn honey to attack the dig site.
export type HiveType = 'forager' | 'geomancer' | 'cantor';
export type CellRole = HiveType;

// ---- Underground chambers ----
//
// Tech is physical. Upgrades live inside chambers excavated below the hive.
// To unlock an upgrade row, the player must first dig the chamber that
// owns it. Each chamber has a fixed plot in the underground grid and a
// list of UpgradeIds it gates. See `docs/underground.md` for the design.

export type ChamberId = 'forager-den' | 'geomancer-hall' | 'cantor-cloister';

export interface ChamberSpec {
  id: ChamberId;
  name: string;
  glyph: string;
  digCost: number;
  currency: Currency;
  upgradeIds: UpgradeId[];
  // Grid coordinate in the underground layout. Row 0 sits just below the
  // meadow line; deeper rows hold later-phase chambers.
  plot: { row: number; col: number };
}

export interface ChamberData {
  built: boolean;
}

export const CHAMBERS: ChamberSpec[] = [
  {
    id: 'forager-den',
    name: 'Forager Den',
    glyph: '🌼',
    digCost: 20,
    currency: 'pollen',
    upgradeIds: [
      'forager-swift-wings',
      'forager-quick-forage',
      'forager-pollen-pouches',
    ],
    plot: { row: 0, col: 0 },
  },
  {
    id: 'geomancer-hall',
    name: 'Geomancer Hall',
    glyph: '⛏',
    digCost: 30,
    currency: 'pollen',
    upgradeIds: [
      'geomancer-sharp-stinger',
      'geomancer-swift-strike',
      'geomancer-heavy-swarm',
    ],
    plot: { row: 0, col: 1 },
  },
  {
    id: 'cantor-cloister',
    name: 'Cantor Cloister',
    glyph: '✦',
    digCost: 45,
    currency: 'pollen',
    upgradeIds: [
      'cantor-quicker-cantrip',
      'cantor-twin-spark',
      'cantor-mana-sip',
    ],
    plot: { row: 1, col: 0 },
  },
];

export function chamberSpec(id: string): ChamberSpec | null {
  return CHAMBERS.find((c) => c.id === id) ?? null;
}

export function chamberOwningUpgrade(upgradeId: UpgradeId): ChamberSpec | null {
  return CHAMBERS.find((c) => c.upgradeIds.includes(upgradeId)) ?? null;
}

export function isChamberBuilt(state: GameState, id: string): boolean {
  return state.chambers[id]?.built === true;
}

// ---- Hive: a honeycomb of hex cells ----
//
// Cells use axial hex coordinates (q, r). A cell present in `hive.cells` is
// unlocked. `role` is:
//   null     — unlocked but empty
//   'forager' / 'geomancer' — holds one worker of that role (permanent)

export interface HiveCell {
  q: number;
  r: number;
  role: CellRole | null;
}

export interface HiveData {
  id: string;
  pollen: number;
  // Honey = mana. Foragers refine deposited pollen into honey up to
  // `honeyCap`. Spellcasters burn honey to cast spells; with empty reserves
  // they swarm idle near the hive until foragers refill. Excess pollen above
  // the cap keeps accumulating as pollen (still the upgrade currency).
  honey: number;
  honeyCap: number;
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
  // Each excavated chamber records as { built: true }. A missing entry means
  // the chamber is still an unexcavated plot.
  chambers: Record<string, ChamberData>;
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
  // fractional bonus. Foragers gain flight speed; geomancers gain damage.
  SYNERGY_FORAGER_SPEED: 0.08,
  SYNERGY_GEOMANCER_DAMAGE: 0.12,

  // Dig site
  DIG_SITE_TIER_1_HP: 40,

  // Geomancer spell — each bee gets ONE cast then expires. The hive
  // respawns a fresh bee on a per-slot cooldown so we always see a stream
  // of new bees flying toward the dig site.
  GEOMANCER_BASE_DAMAGE: 1,
  GEOMANCER_WINDUP_MS: 400,
  GEOMANCER_RESPAWN_MS: 1800, // base time between expiration and next spawn

  // Honey / mana economy.
  HONEY_CAP: 10,
  POLLEN_PER_HONEY: 1, // pollen consumed to produce one honey (also accrues to upgrade pollen)
  GEOMANCER_MANA_COST: 2,
  CANTOR_MANA_COST: 1,

  // Cantor cantrip — a hovering caster that fires a slow projectile at the
  // dig site. Damage is a fraction of a geomancer dive; cadence is faster.
  CANTOR_BASE_DAMAGE: 0.35,
  CANTOR_CAST_INTERVAL_MS: 2400, // between two successful casts
  CANTOR_PROJECTILE_SPEED: 460,  // px/sec for the spark on its way to the rock
  CANTOR_HOVER_OFFSET_Y: -55,    // how far above the home cell the cantor floats

  // When a spellcaster can't afford the mana for its next cast it falls into
  // an idle "swarm" loop for this long before retrying. Keeps the bee visible
  // (drifting near the hive) instead of vanishing.
  SPELL_IDLE_RETRY_MS: 2800,

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
    hive: { id: 'hive', pollen: 0, honey: 0, honeyCap: TUNING.HONEY_CAP, cells },
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
    chambers: {},
    ascent: { phase: 'none', timer: 0 },
  };
}

// ---- Upgrade helpers ----

export function getUpgradeTier(state: GameState, id: UpgradeId): number {
  return state.upgrades[id] ?? 0;
}

// Unlock gate: an upgrade is purchasable iff the chamber that owns it is
// built. Journal entries no longer gate upgrade rows directly (they still
// drive narrative + dig-site progression).
export function isUpgradeUnlocked(state: GameState, id: UpgradeId): boolean {
  const def = UPGRADE_DEFS[id];
  const currentTier = getUpgradeTier(state, id);
  if (currentTier >= def.maxTier) return false;
  const chamber = chamberOwningUpgrade(id);
  if (!chamber) return true;
  return isChamberBuilt(state, chamber.id);
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

// Human-readable description of an upgrade's effect at a given tier and at
// the *next* tier. Used by the hover tooltip so the player can see the
// concrete impact of their next purchase, not just a generic "+15% per
// tier" blurb. `nextLabel` is null when the upgrade is already maxed.
export interface UpgradeEffectSummary {
  currentLabel: string;
  nextLabel: string | null;
  perTierBlurb: string;
}

export function describeUpgradeEffect(
  state: GameState,
  id: UpgradeId,
): UpgradeEffectSummary {
  const def = UPGRADE_DEFS[id];
  const tier = getUpgradeTier(state, id);
  const maxed = tier >= def.maxTier;
  const nextTier = maxed ? tier : tier + 1;

  const fmtMul = (m: number): string =>
    `${m.toFixed(2)}× (+${Math.round((m - 1) * 100)}%)`;
  const fmtRed = (m: number): string =>
    `${Math.round(m * 100)}% of base (−${Math.round((1 - m) * 100)}%)`;

  let currentLabel: string;
  let nextLabel: string | null;

  switch (id) {
    case 'forager-swift-wings': {
      const cur = Math.pow(1.15, tier);
      const nxt = Math.pow(1.15, nextTier);
      currentLabel = `Flight speed ${fmtMul(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtMul(nxt)}`;
      break;
    }
    case 'forager-quick-forage': {
      const cur = Math.pow(0.8, tier);
      const nxt = Math.pow(0.8, nextTier);
      currentLabel = `Harvest time ${fmtRed(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtRed(nxt)}`;
      break;
    }
    case 'forager-pollen-pouches': {
      const cur = 1 + tier;
      const nxt = 1 + nextTier;
      currentLabel = `Carrying ${cur} pollen per trip`;
      nextLabel = maxed ? null : `→ ${nxt} pollen per trip`;
      break;
    }
    case 'geomancer-sharp-stinger': {
      const cur = Math.pow(1.5, tier);
      const nxt = Math.pow(1.5, nextTier);
      currentLabel = `Spell damage ${fmtMul(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtMul(nxt)}`;
      break;
    }
    case 'geomancer-swift-strike': {
      const cur = Math.pow(0.85, tier);
      const nxt = Math.pow(0.85, nextTier);
      currentLabel = `Respawn time ${fmtRed(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtRed(nxt)}`;
      break;
    }
    case 'geomancer-heavy-swarm': {
      const cur = Math.pow(1.15, tier);
      const nxt = Math.pow(1.15, nextTier);
      currentLabel = `Flight speed ${fmtMul(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtMul(nxt)}`;
      break;
    }
    case 'cantor-quicker-cantrip': {
      const cur = Math.pow(0.8, tier);
      const nxt = Math.pow(0.8, nextTier);
      currentLabel = `Cast interval ${fmtRed(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtRed(nxt)}`;
      break;
    }
    case 'cantor-twin-spark': {
      const cur = Math.pow(1.25, tier);
      const nxt = Math.pow(1.25, nextTier);
      currentLabel = `Spark damage ${fmtMul(cur)}`;
      nextLabel = maxed ? null : `→ ${fmtMul(nxt)}`;
      break;
    }
    case 'cantor-mana-sip': {
      // Tier 0: no refund. Tier N≥1: refund 1 mana every max(4, 7-N) casts.
      const everyAt = (t: number): string =>
        t <= 0 ? 'No refund' : `1 mana every ${Math.max(4, 7 - t)} casts`;
      currentLabel = everyAt(tier);
      nextLabel = maxed ? null : `→ ${everyAt(nextTier)}`;
      break;
    }
  }
  return { currentLabel, nextLabel, perTierBlurb: def.blurb };
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
  return (
    cell.role === 'forager' ||
    cell.role === 'geomancer' ||
    cell.role === 'cantor'
  );
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

export function totalHoney(state: GameState): number {
  return state.hive.honey;
}

export function honeyCap(state: GameState): number {
  return state.hive.honeyCap;
}

// Refine deposited pollen into honey, capped at the hive's reservoir.
// Returns the amount of honey actually added. Pollen passed in is also
// counted toward the upgrade-currency pool by the caller — the same pollen
// drop both feeds the spell economy AND the upgrade economy.
export function refineHoney(state: GameState, pollen: number): number {
  const space = Math.max(0, state.hive.honeyCap - state.hive.honey);
  const refined = Math.min(space, Math.floor(pollen / TUNING.POLLEN_PER_HONEY));
  state.hive.honey += refined;
  return refined;
}

// Spend honey if there is enough. Returns true if the spell could be cast.
export function spendHoney(state: GameState, amount: number): boolean {
  if (state.hive.honey < amount) return false;
  state.hive.honey -= amount;
  return true;
}

// Mana cost for a single spell of the given caster role.
export function manaCostFor(role: CellRole): number {
  if (role === 'geomancer') return TUNING.GEOMANCER_MANA_COST;
  if (role === 'cantor') return TUNING.CANTOR_MANA_COST;
  return 0;
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

// ---- Geomancer stat helpers (used by Bee + UI) ----

// Global damage per strike, before per-cell adjacency synergy is applied.
export function geomancerDamagePerStrike(state: GameState): number {
  const sharp = getUpgradeTier(state, 'geomancer-sharp-stinger');
  return TUNING.GEOMANCER_BASE_DAMAGE * Math.pow(1.5, sharp);
}

export function geomancerRespawnMs(state: GameState): number {
  const swift = getUpgradeTier(state, 'geomancer-swift-strike');
  return TUNING.GEOMANCER_RESPAWN_MS * Math.pow(0.85, swift);
}

// ---- Cantor stat helpers ----

export function cantorDamagePerSpark(state: GameState): number {
  const twin = getUpgradeTier(state, 'cantor-twin-spark');
  return TUNING.CANTOR_BASE_DAMAGE * Math.pow(1.25, twin);
}

export function cantorCastIntervalMs(state: GameState): number {
  const quicker = getUpgradeTier(state, 'cantor-quicker-cantrip');
  return TUNING.CANTOR_CAST_INTERVAL_MS * Math.pow(0.8, quicker);
}

// How often a cantor's cast refunds 1 mana (Mana Sip). 0 means no refund.
// Each tier shaves one cast off the refund cycle: 0 → never, 1 → every 6,
// 2 → every 5, 3 → every 4.
export function cantorRefundEveryNCasts(state: GameState): number {
  const sip = getUpgradeTier(state, 'cantor-mana-sip');
  if (sip <= 0) return 0;
  return Math.max(4, 7 - sip);
}
