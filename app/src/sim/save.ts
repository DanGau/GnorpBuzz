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
