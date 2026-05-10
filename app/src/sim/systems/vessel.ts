import type { GameState } from '../state';
import { totalNectar } from '../state';

// When the vessel has enough blocks delivered AND enough nectar accumulated,
// transition to 'ready' (waiting for player click). Does NOT auto-launch.
export function vesselSystem(state: GameState): void {
  const v = state.vessel;
  if (v.phase !== 'building') return;
  const blocksReady = v.deliveredBlocks >= v.requiredBlocks;
  const nectarReady = totalNectar(state) >= v.requiredNectar;
  if (blocksReady && nectarReady) {
    v.phase = 'ready';
  }
}
