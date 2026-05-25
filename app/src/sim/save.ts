import type { GameState } from './state';
import {
  createInitialState,
  syncPollenDotsToScalar,
  seedFlowerPositions,
  flowerLifespanForTier,
} from './state';

// Bumped to v11 — added fertilizer field on HiveData plus a major layout
// shift (Pollen Silo moved under the hive, Fertilizer Bin added). A v10
// save is structurally compatible but its persisted building positions
// would mismatch the new layout reference, so drop it for a clean start.
const STORAGE_KEY = 'gnorpbuzz.save.v11';
const LEGACY_KEYS = [
  'gnorpbuzz.save.v1',
  'gnorpbuzz.save.v2',
  'gnorpbuzz.save.v3',
  'gnorpbuzz.save.v4',
  'gnorpbuzz.save.v5',
  'gnorpbuzz.save.v6',
  'gnorpbuzz.save.v7',
  'gnorpbuzz.save.v8',
  'gnorpbuzz.save.v9',
  'gnorpbuzz.save.v10',
];

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(blob: string): GameState {
  const parsed = JSON.parse(blob) as Partial<GameState> & { hives?: unknown };
  const base = createInitialState();

  // A save carrying the old `hives[]` array (or no proper `hive`) is pre-v4
  // and incompatible: fall back to a fresh state rather than half-merging.
  if ('hives' in parsed || !parsed.hive || !Array.isArray(parsed.hive.cells)) {
    return base;
  }

  const merged = { ...base, ...parsed } as GameState;

  // Defensive defaults — older shapes may lack these fields.
  if (typeof merged.hive.honey !== 'number') merged.hive.honey = 0;
  if (typeof merged.hive.honeyCap !== 'number') merged.hive.honeyCap = base.hive.honeyCap;
  if (typeof merged.hive.pollen !== 'number') merged.hive.pollen = 0;
  if (typeof merged.hive.pollenCap !== 'number') merged.hive.pollenCap = base.hive.pollenCap;
  if (typeof merged.hive.wax !== 'number') merged.hive.wax = 0;
  if (typeof merged.hive.waxCap !== 'number') merged.hive.waxCap = base.hive.waxCap;
  if (typeof merged.hive.fertilizer !== 'number') merged.hive.fertilizer = 0;
  if (typeof merged.hive.fertilizerCap !== 'number')
    merged.hive.fertilizerCap = base.hive.fertilizerCap;

  // Rock drops are persistent loot near the boulder. Older saves predate
  // the field; default to empty. Forager claims are ephemeral (the bees
  // are rebuilt on load) so any persisted claim is stale — clear them.
  if (!Array.isArray(merged.rockDrops)) merged.rockDrops = [];
  for (const d of merged.rockDrops) {
    d.claimedBy = null;
    if (typeof d.rotation !== 'number') d.rotation = 0;
    if (typeof d.spin !== 'number') d.spin = 0;
  }
  if (typeof merged.digSite.dropBudget !== 'number') merged.digSite.dropBudget = 0;
  if (!Array.isArray(merged.digSite.pendingHits)) merged.digSite.pendingHits = [];
  if (!Array.isArray(merged.digSite.recentStrikes)) merged.digSite.recentStrikes = [];

  // Defensive defaults — fields that may be missing from partial saves.
  if (!merged.flowers) merged.flowers = base.flowers;
  // Flower claims are ephemeral runtime state — bees are recreated fresh on
  // load, so any persisted claim count would be a stale ghost. Reset them.
  for (const f of merged.flowers) f.claimants = 0;
  // Older save shapes don't store per-flower positions; reseed any missing
  // (x, y) from the starter slots so the meadow renders correctly.
  const needSeed = merged.flowers.some(
    (f) => typeof f.x !== 'number' || typeof f.y !== 'number',
  );
  if (needSeed) seedFlowerPositions(merged.flowers);
  for (const f of merged.flowers) {
    if (typeof f.hue !== 'number') f.hue = Math.floor(Math.random() * 360);
    if (typeof f.tier !== 'number') f.tier = 1;
    if (typeof f.growthMs !== 'number') f.growthMs = 0;
    if (typeof f.lifespanMs !== 'number') f.lifespanMs = flowerLifespanForTier(f.tier);
  }
  if (!merged.digSite) merged.digSite = base.digSite;
  if (!merged.artifacts) merged.artifacts = { revealed: [], pending: null };
  if (!merged.journal)
    merged.journal = { entries: [], pending: false, dismissedCount: 0 };
  if (!merged.upgrades) merged.upgrades = {};
  if (!merged.ascent) merged.ascent = { phase: 'none', timer: 0 };

  // Saves written before pollen became physical entities don't carry a
  // pollenDots array — rebuild it from the scalar count so the silo
  // renders the right pile on first frame.
  syncPollenDotsToScalar(merged);

  return merged;
}

export function saveToStorage(state: GameState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, serialize(state));
  } catch {
    // ignore
  }
}

export function loadFromStorage(): GameState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    // Drop any legacy v1 saves first so the user starts fresh on the new loop.
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
    const blob = localStorage.getItem(STORAGE_KEY);
    if (!blob) return null;
    return deserialize(blob);
  } catch {
    return null;
  }
}

export function clearStorage(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch {
    // ignore
  }
}
