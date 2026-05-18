import type { GameState } from './state';
import { createInitialState } from './state';

// Bumped to v6 — wizard reframing: honey/mana reservoir on the hive, cantor
// role, geomancer rename. Older saves are simply ignored.
const STORAGE_KEY = 'gnorpbuzz.save.v6';
const LEGACY_KEYS = [
  'gnorpbuzz.save.v1',
  'gnorpbuzz.save.v2',
  'gnorpbuzz.save.v3',
  'gnorpbuzz.save.v4',
  'gnorpbuzz.save.v5',
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

  // Defensive defaults for honey reservoir — older shapes may lack these.
  if (typeof merged.hive.honey !== 'number') merged.hive.honey = 0;
  if (typeof merged.hive.honeyCap !== 'number') merged.hive.honeyCap = base.hive.honeyCap;

  // Defensive defaults — fields that may be missing from partial saves.
  if (!merged.flowers) merged.flowers = base.flowers;
  // Flower claims are ephemeral runtime state — bees are recreated fresh on
  // load, so any persisted claim count would be a stale ghost. Reset them.
  for (const f of merged.flowers) f.claimants = 0;
  if (!merged.digSite) merged.digSite = base.digSite;
  if (!merged.artifacts) merged.artifacts = { revealed: [], pending: null };
  if (!merged.journal)
    merged.journal = { entries: [], pending: false, dismissedCount: 0 };
  if (!merged.upgrades) merged.upgrades = {};
  if (!merged.chambers) merged.chambers = {};
  if (!merged.ascent) merged.ascent = { phase: 'none', timer: 0 };

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
