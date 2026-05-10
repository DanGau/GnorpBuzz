import type { GameState } from '../state';

// Watches deliveredBlocks; when the vessel has enough, transitions to launching.
export function vesselSystem(state: GameState): void {
  const v = state.vessel;
  if (v.phase !== 'building') return;
  if (v.deliveredBlocks >= v.requiredBlocks) {
    v.phase = 'launching';
    v.launchTimer = 0;
  }
}
