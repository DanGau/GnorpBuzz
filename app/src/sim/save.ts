import type { GameState } from './state';
import { createInitialState } from './state';

const STORAGE_KEY = 'gnorpbuzz.save.v1';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(blob: string): GameState {
  const parsed = JSON.parse(blob) as Partial<GameState>;
  const merged = { ...createInitialState(), ...parsed } as GameState;
  // Migration: older saves don't have hive.built. Default forager always
  // built; treat anything else as unbuilt unless it had bees in the save.
  if (merged.hives) {
    merged.hives = merged.hives.map((h) => {
      if ((h as { built?: boolean }).built === undefined) {
        const built = h.type === 'forager' ? true : h.bees > 0;
        return { ...h, built } as typeof h;
      }
      return h;
    });
  }
  // Migration: journal.dismissedCount may be missing in older saves.
  if (merged.journal && (merged.journal as { dismissedCount?: number }).dismissedCount === undefined) {
    merged.journal.dismissedCount = merged.journal.pending
      ? Math.max(0, merged.journal.entries.length - 1)
      : merged.journal.entries.length;
  }
  if (!merged.upgrades) merged.upgrades = {};
  if (typeof merged.launchCount !== 'number') merged.launchCount = 0;
  // Migrations for Phase 2: vessel.tier, vessel.requiredNectar,
  // hive.nectar, flower.kind, nectarUnlocked.
  if (typeof merged.nectarUnlocked !== 'boolean') merged.nectarUnlocked = false;
  if (typeof merged.vessel.tier !== 'number') merged.vessel.tier = 1;
  if (typeof merged.vessel.requiredNectar !== 'number') merged.vessel.requiredNectar = 0;
  for (const h of merged.hives) {
    if (h.type === 'forager' && typeof h.nectar !== 'number') {
      (h as { nectar?: number }).nectar = 0;
    }
  }
  for (const f of merged.flowers) {
    if (!('kind' in f) || (f.kind !== 'pollen' && f.kind !== 'nectar')) {
      f.kind = 'pollen';
    }
  }
  return merged;
}

export function saveToStorage(state: GameState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, serialize(state));
  } catch {
    // Storage may be full or disabled — non-fatal for MVP.
  }
}

export function loadFromStorage(): GameState | null {
  if (typeof localStorage === 'undefined') return null;
  try {
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
  } catch {
    // ignore
  }
}
