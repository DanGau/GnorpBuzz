import type { GameState } from '../state';

// First crash → first journal entry. Idempotent: only fires once per crash cycle.
export function journalSystem(state: GameState): void {
  if (state.vessel.phase !== 'crashed') return;
  if (state.journal.pending) return;
  if (state.journal.entries.some((e) => e.tier === 1)) return;
  state.journal.entries.push({
    id: 'tier-1',
    tier: 1,
    text: "It's higher than it looks. We'll need more lift.",
  });
  state.journal.pending = true;
}
