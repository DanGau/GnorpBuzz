import type { GameState } from '../state';
import { TUNING } from '../state';

// Queen lays one egg per QUEEN_FILL_MS. Eggs go to the oldest hive with empty slots.
// Reset progress to 0 when no empty slots exist (no banked fills).
export function queenSystem(state: GameState, dtMs: number): void {
  state.queen.fillProgressMs += dtMs;
  while (state.queen.fillProgressMs >= TUNING.QUEEN_FILL_MS) {
    const hive = state.hives.find((h) => h.bees < h.slots);
    if (!hive) {
      state.queen.fillProgressMs = 0;
      return;
    }
    hive.bees += 1;
    state.queen.fillProgressMs -= TUNING.QUEEN_FILL_MS;
  }
}
