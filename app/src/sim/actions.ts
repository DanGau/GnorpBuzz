import type { GameState, HiveType, ForagerHiveData } from './state';
import {
  nextBeeCost,
  costCurrency,
  totalPollen,
  spendableWax,
  getWaxHive,
  buildCost,
} from './state';

export interface ActionResult {
  ok: boolean;
  reason?: string;
}

// Buy a worker bee for the named hive type. Currency depends on the role:
//   forager / wax-maker → pollen
//   builder             → wax
// First bee of each type is free.
export function buyBee(state: GameState, type: HiveType): ActionResult {
  const hive = state.hives.find((h) => h.type === type);
  if (!hive) return { ok: false, reason: `No ${type} hive` };
  if (!hive.built) return { ok: false, reason: `${type} hive not built yet` };
  const cost = nextBeeCost(state, type);
  const currency = costCurrency(type);

  if (cost > 0) {
    if (currency === 'pollen') {
      const available = totalPollen(state);
      if (available < cost) {
        return { ok: false, reason: `Need ${cost} pollen, have ${available}` };
      }
      // Drain pollen from any Forager Hive that has it (largest first).
      let remaining = cost;
      const foragerHives = state.hives
        .filter((h): h is ForagerHiveData => h.type === 'forager')
        .sort((a, b) => b.pollen - a.pollen);
      for (const h of foragerHives) {
        if (remaining <= 0) break;
        const take = Math.min(h.pollen, remaining);
        h.pollen -= take;
        remaining -= take;
      }
    } else {
      // wax
      if (spendableWax(state) < cost) {
        return { ok: false, reason: `Need ${cost} wax, have ${spendableWax(state)}` };
      }
      let remaining = cost;
      const waxHive = getWaxHive(state);
      const fromHive = Math.min(waxHive.waxBlocks, remaining);
      waxHive.waxBlocks -= fromHive;
      remaining -= fromHive;
      if (remaining > 0) {
        const fromVessel = Math.min(state.vessel.deliveredBlocks, remaining);
        state.vessel.deliveredBlocks -= fromVessel;
        remaining -= fromVessel;
        // If draining the vessel pulls it back below the threshold, revert.
        if (
          state.vessel.phase === 'ready' &&
          state.vessel.deliveredBlocks < state.vessel.requiredBlocks
        ) {
          state.vessel.phase = 'building';
        }
      }
    }
  }

  hive.bees += 1;
  return { ok: true };
}

// Construct an unbuilt hive. Pays a one-shot cost in the appropriate
// currency (wax hive → pollen, builder hive → wax).
export function buildHive(state: GameState, type: HiveType): ActionResult {
  const hive = state.hives.find((h) => h.type === type);
  if (!hive) return { ok: false, reason: `No ${type} hive` };
  if (hive.built) return { ok: false, reason: `${type} hive already built` };
  const cost = buildCost(type);
  if (!cost) return { ok: false, reason: `${type} hive cannot be built (starter)` };

  if (cost.currency === 'pollen') {
    if (totalPollen(state) < cost.amount) {
      return { ok: false, reason: `Need ${cost.amount} pollen` };
    }
    let remaining = cost.amount;
    const foragerHives = state.hives
      .filter((h): h is ForagerHiveData => h.type === 'forager')
      .sort((a, b) => b.pollen - a.pollen);
    for (const h of foragerHives) {
      if (remaining <= 0) break;
      const take = Math.min(h.pollen, remaining);
      h.pollen -= take;
      remaining -= take;
    }
  } else {
    if (spendableWax(state) < cost.amount) {
      return { ok: false, reason: `Need ${cost.amount} wax` };
    }
    let remaining = cost.amount;
    const waxHive = getWaxHive(state);
    const fromHive = Math.min(waxHive.waxBlocks, remaining);
    waxHive.waxBlocks -= fromHive;
    remaining -= fromHive;
    if (remaining > 0) {
      const fromVessel = Math.min(state.vessel.deliveredBlocks, remaining);
      state.vessel.deliveredBlocks -= fromVessel;
      remaining -= fromVessel;
      if (
        state.vessel.phase === 'ready' &&
        state.vessel.deliveredBlocks < state.vessel.requiredBlocks
      ) {
        state.vessel.phase = 'building';
      }
    }
  }
  hive.built = true;
  return { ok: true };
}

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
