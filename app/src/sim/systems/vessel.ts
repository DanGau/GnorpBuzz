import type { GameState } from '../state';

// When the vessel has enough blocks delivered, transition to 'ready' (waiting
// for player click). Does NOT auto-launch.
export function vesselSystem(state: GameState): void {
  const v = state.vessel;
  if (v.phase !== 'building') return;
  if (v.deliveredBlocks >= v.requiredBlocks) {
    v.phase = 'ready';
  }
}
