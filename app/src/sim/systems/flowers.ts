import type { GameState } from '../state';
import {
  TUNING,
  flowerYieldForTier,
  nearestEmptyMeadowTile,
  plantFlowerAt,
} from '../state';

// Per-tick maintenance for the meadow:
//   - Sapling growth (newly planted seeds opening into their tier's flower)
//   - Regrow timer (a fully-picked flower budding back to its tier's yield)
//   - Lifespan / wither: every fully-grown flower's clock ticks down; at
//     zero it disappears silently (the "harvest before it rots" pressure)
//   - Natural spawn: a slow release-valve trickle of T1 flowers when the
//     meadow drops below the baseline, so a stalled colony can recover
export function flowerSystem(state: GameState, dtMs: number): void {
  for (let i = state.flowers.length - 1; i >= 0; i--) {
    const f = state.flowers[i];
    if (f.growthMs > 0) {
      f.growthMs -= dtMs;
      if (f.growthMs < 0) f.growthMs = 0;
      // A still-sprouting sapling can't be regrowing, harvested, or
      // withering. Its lifespan only starts ticking once it opens.
      continue;
    }
    if (f.yieldRemaining === 0 && f.regrowTimerMs > 0) {
      f.regrowTimerMs -= dtMs;
      if (f.regrowTimerMs <= 0) {
        f.regrowTimerMs = 0;
        f.yieldRemaining = flowerYieldForTier(f.tier, state);
      }
    }
    f.lifespanMs -= dtMs;
    if (f.lifespanMs <= 0) {
      // Silent wither — yield is forfeit, the tile frees up. Foragers
      // mid-flight discover the missing flower on arrival and re-pick
      // a task (see updateForager's flying-to-flower case).
      state.flowers.splice(i, 1);
    }
  }

  // Natural spawn — only kicks in below baseline. Probability per tick
  // tuned so the expected interval is NATURAL_FLOWER_AVG_INTERVAL_MS.
  if (state.flowers.length < TUNING.NATURAL_FLOWER_BASELINE) {
    const chance = dtMs / TUNING.NATURAL_FLOWER_AVG_INTERVAL_MS;
    if (Math.random() < chance) {
      // Pick a random empty tile (nearestEmptyMeadowTile with random
      // origin = roughly uniform sampling across available tiles).
      const tile = nearestEmptyMeadowTile(state, Math.random() * 1280, 700);
      if (tile) plantFlowerAt(state, tile.x, tile.y, 1);
    }
  }
}
