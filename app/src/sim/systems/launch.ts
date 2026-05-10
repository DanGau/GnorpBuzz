import type { GameState } from '../state';
import { TUNING } from '../state';

// Drives the vessel through launching → crashing → crashed phases on a timer.
export function launchSystem(state: GameState, dtMs: number): void {
  if (state.vessel.phase === 'launching') {
    state.vessel.launchTimer += dtMs;
    if (state.vessel.launchTimer >= TUNING.LAUNCH_DURATION_MS) {
      state.vessel.phase = 'crashing';
      state.vessel.launchTimer = 0;
    }
  } else if (state.vessel.phase === 'crashing') {
    state.vessel.launchTimer += dtMs;
    if (state.vessel.launchTimer >= TUNING.CRASH_DURATION_MS) {
      state.vessel.phase = 'crashed';
      state.vessel.launchTimer = 0;
    }
  }
}
