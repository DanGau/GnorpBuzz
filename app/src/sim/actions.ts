import type { GameState, HiveType } from './state';
import { TUNING, nextHiveCost, totalWaxBlocks } from './state';

export interface ActionResult {
  ok: boolean;
  reason?: string;
}

export function buyHive(state: GameState, type: HiveType): ActionResult {
  const cost = nextHiveCost(state, type);
  const available = totalWaxBlocks(state);
  if (available < cost) {
    return { ok: false, reason: `Need ${cost} wax blocks, have ${available}` };
  }
  // Deduct cost from wax hives — drain largest stockpiles first.
  let remaining = cost;
  const waxHives = state.hives
    .filter((h): h is Extract<typeof h, { type: 'wax' }> => h.type === 'wax')
    .sort((a, b) => b.waxBlocks - a.waxBlocks);
  for (const h of waxHives) {
    if (remaining <= 0) break;
    const take = Math.min(h.waxBlocks, remaining);
    h.waxBlocks -= take;
    remaining -= take;
  }
  // Push the new hive
  if (type === 'forager') {
    state.hives.push({
      id: `hive-${state.hiveSeq}`,
      type: 'forager',
      slots: TUNING.HIVE_SLOTS,
      bees: 0,
      pollen: 0,
    });
  } else {
    state.hives.push({
      id: `hive-${state.hiveSeq}`,
      type: 'wax',
      slots: TUNING.HIVE_SLOTS,
      bees: 0,
      waxBlocks: 0,
    });
  }
  state.hiveSeq += 1;
  return { ok: true };
}

export function dismissJournal(state: GameState): ActionResult {
  if (!state.journal.pending) return { ok: false, reason: 'No pending journal entry' };
  state.journal.pending = false;
  state.vessel.phase = 'reviewed';
  return { ok: true };
}
