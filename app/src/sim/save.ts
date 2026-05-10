import type { GameState } from './state';
import { createInitialState } from './state';

const STORAGE_KEY = 'gnorpbuzz.save.v1';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(blob: string): GameState {
  const parsed = JSON.parse(blob) as Partial<GameState>;
  // Merge over a fresh initial state so missing fields get sane defaults.
  return { ...createInitialState(), ...parsed } as GameState;
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
