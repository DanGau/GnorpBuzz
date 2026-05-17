import type { GameState, CellRole, UpgradeId } from './state';
import {
  cellAt,
  isCellBuyable,
  mustPlaceForager,
  cellCost,
  nextWorkerCost,
  totalPollen,
  UPGRADE_DEFS,
  getUpgradeTier,
  isUpgradeUnlocked,
  nextUpgradeCost,
  artifactForTier,
  chamberSpec,
  isChamberBuilt,
  TUNING,
} from './state';

export interface ActionResult {
  ok: boolean;
  reason?: string;
}

function spendPollen(state: GameState, amount: number): void {
  state.hive.pollen = Math.max(0, state.hive.pollen - amount);
}

// Unlock a new comb cell at the given hex coordinate. Must be on the buyable
// frontier (adjacent to an existing cell). The cell comes in empty.
export function buyCell(state: GameState, q: number, r: number): ActionResult {
  const hive = state.hive;
  if (cellAt(hive, q, r)) return { ok: false, reason: 'Cell already unlocked' };
  if (!isCellBuyable(hive, q, r)) {
    return { ok: false, reason: 'Cell not adjacent to the comb' };
  }
  const cost = cellCost(q, r);
  if (totalPollen(state) < cost) {
    return { ok: false, reason: `Need ${cost} pollen` };
  }
  spendPollen(state, cost);
  hive.cells.push({ q, r, role: null });
  return { ok: true };
}

// Assign a worker role to an empty unlocked cell. Costs the next worker
// price for that role. Assignments are permanent — a filled cell cannot be
// cleared or reassigned, so the player lives with their layout choices.
export function assignCell(
  state: GameState,
  q: number,
  r: number,
  role: CellRole,
): ActionResult {
  const cell = cellAt(state.hive, q, r);
  if (!cell) return { ok: false, reason: 'Cell is locked' };
  if (cell.role !== null) return { ok: false, reason: 'Cell already has a worker' };
  if (mustPlaceForager(state) && role !== 'forager') {
    return { ok: false, reason: 'Your first worker must be a Forager' };
  }
  const cost = nextWorkerCost(state, role);
  if (cost > 0 && totalPollen(state) < cost) {
    return { ok: false, reason: `Need ${cost} pollen` };
  }
  if (cost > 0) spendPollen(state, cost);
  cell.role = role;
  return { ok: true };
}

// Dismiss the pending artifact reveal. Advances to the next dig-site tier
// (with bigger HP), bumps dismissedCount (unlocks the next upgrade tier),
// and pushes a journal entry into the history.
export function dismissArtifact(state: GameState): ActionResult {
  const pendingId = state.artifacts.pending;
  if (!pendingId) return { ok: false, reason: 'No pending artifact' };
  const spec = artifactForTier(state.digSite.tier);
  if (!spec || spec.id !== pendingId) {
    return { ok: false, reason: 'Artifact tier mismatch' };
  }

  state.artifacts.revealed.push(pendingId);
  state.artifacts.pending = null;
  state.journal.pending = false;
  state.journal.dismissedCount += 1;

  // Endgame: the legendary artifact triggers ascent instead of advancing
  // to the next dig site.
  if (spec.tier >= 7) {
    state.digSite.state = 'sealed';
    state.ascent.phase = 'launching';
    state.ascent.timer = 0;
    return { ok: true };
  }

  // Advance to next dig site tier.
  const nextTier = spec.tier + 1;
  state.digSite.tier = nextTier;
  state.digSite.maxHp = spec.nextSiteMaxHp;
  state.digSite.hp = spec.nextSiteMaxHp;
  state.digSite.state = 'active';
  return { ok: true };
}

// Kept as an alias for the journal-modal dismiss action so old UI callers
// still work. Internally identical to dismissArtifact.
export function dismissJournal(state: GameState): ActionResult {
  return dismissArtifact(state);
}

export function buyUpgrade(state: GameState, id: UpgradeId): ActionResult {
  const def = UPGRADE_DEFS[id];
  if (!def) return { ok: false, reason: `Unknown upgrade ${id}` };
  if (!isUpgradeUnlocked(state, id)) {
    return { ok: false, reason: `Upgrade locked — needs more journal entries` };
  }
  const cost = nextUpgradeCost(state, id);
  if (cost <= 0) return { ok: false, reason: `Already at max tier` };
  if (totalPollen(state) < cost) {
    return { ok: false, reason: `Need ${cost} pollen` };
  }
  spendPollen(state, cost);
  state.upgrades[id] = getUpgradeTier(state, id) + 1;
  return { ok: true };
}

// Excavate a chamber — spends the dig cost, flips the chamber to built.
// Building a chamber is the unlock gate for every upgrade it owns.
export function digChamber(state: GameState, id: string): ActionResult {
  const spec = chamberSpec(id);
  if (!spec) return { ok: false, reason: `Unknown chamber ${id}` };
  if (isChamberBuilt(state, id)) {
    return { ok: false, reason: 'Chamber already built' };
  }
  if (totalPollen(state) < spec.digCost) {
    return { ok: false, reason: `Need ${spec.digCost} pollen` };
  }
  spendPollen(state, spec.digCost);
  state.chambers[id] = { built: true };
  return { ok: true };
}

// Used by tests/debug to deal direct damage to the dig site without bees.
export function damageDigSite(state: GameState, amount: number): ActionResult {
  if (state.digSite.state !== 'active') {
    return { ok: false, reason: 'Dig site not active' };
  }
  state.digSite.hp = Math.max(0, state.digSite.hp - amount);
  return { ok: true };
}

// Tuning re-export so other modules don't have to dig into state.ts.
export { TUNING };
