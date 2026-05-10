import type { GameState, HiveType } from './state';
import { nextBeeCost, getWaxHive, spendableWax } from './state';

export interface ActionResult {
  ok: boolean;
  reason?: string;
}

// Buy a worker bee for the named hive type. First bee of each type is free;
// subsequent bees cost wax (deducted from the wax-hive stockpile first, then
// from the vessel pile if needed).
export function buyBee(state: GameState, type: HiveType): ActionResult {
  const cost = nextBeeCost(state, type);
  if (cost > 0 && spendableWax(state) < cost) {
    return { ok: false, reason: `Need ${cost} wax, have ${spendableWax(state)}` };
  }
  // Drain cost: wax hive stockpile first, then vessel pile.
  let remaining = cost;
  if (remaining > 0) {
    const waxHive = getWaxHive(state);
    const fromHive = Math.min(waxHive.waxBlocks, remaining);
    waxHive.waxBlocks -= fromHive;
    remaining -= fromHive;
  }
  if (remaining > 0) {
    const fromVessel = Math.min(state.vessel.deliveredBlocks, remaining);
    state.vessel.deliveredBlocks -= fromVessel;
    remaining -= fromVessel;
    // If vessel was 'ready' and we just dipped below threshold, bump back to 'building'.
    if (
      state.vessel.phase === 'ready' &&
      state.vessel.deliveredBlocks < state.vessel.requiredBlocks
    ) {
      state.vessel.phase = 'building';
    }
  }
  const hive = state.hives.find((h) => h.type === type);
  if (hive) hive.bees += 1;
  return { ok: true };
}

// Player click on the airplane when it's ready: send it.
export function launchVessel(state: GameState): ActionResult {
  if (state.vessel.phase !== 'ready') {
    return { ok: false, reason: 'Vessel not ready' };
  }
  state.vessel.phase = 'launching';
  state.vessel.launchTimer = 0;
  return { ok: true };
}

export function dismissJournal(state: GameState): ActionResult {
  if (!state.journal.pending) return { ok: false, reason: 'No pending journal entry' };
  state.journal.pending = false;
  state.vessel.phase = 'reviewed';
  return { ok: true };
}
