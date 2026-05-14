import type { GameState } from '../state';
import { TUNING } from '../state';

// Endgame: after dismissing the legendary artifact, the colony tethers to
// it and rises. Two phases (launching, ascending) then 'arrived' lights up
// the EndBanner.
export function ascentSystem(state: GameState, dtMs: number): void {
  const a = state.ascent;
  if (a.phase === 'none' || a.phase === 'arrived') return;
  a.timer += dtMs;
  if (a.phase === 'launching' && a.timer >= TUNING.ASCENT_LAUNCH_MS) {
    a.phase = 'ascending';
    a.timer = 0;
  } else if (a.phase === 'ascending' && a.timer >= TUNING.ASCENT_FLIGHT_MS) {
    a.phase = 'arrived';
    a.timer = TUNING.ASCENT_FLIGHT_MS;
  }
}
