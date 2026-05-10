import type { GameState } from '../state';
import { TUNING } from '../state';

// Tick down regrow timers; when a wilted flower's timer hits zero, refresh
// its yield so foragers can pick it again.
export function flowerSystem(state: GameState, dtMs: number): void {
  for (const f of state.flowers) {
    if (f.yieldRemaining === 0 && f.regrowTimerMs > 0) {
      f.regrowTimerMs -= dtMs;
      if (f.regrowTimerMs <= 0) {
        f.regrowTimerMs = 0;
        f.yieldRemaining = TUNING.FLOWER_YIELD;
      }
    }
  }
}
