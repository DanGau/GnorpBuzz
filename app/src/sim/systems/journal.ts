import type { GameState } from '../state';

// A small library of journal entries. The Nth crash uses the Nth entry.
// Entries don't gate specific upgrades themselves — instead, each dismissed
// entry advances state.journal.dismissedCount, which unlocks the next tier
// across all upgrade paths (per docs/dps-model.md's tier-gating model).
const JOURNAL_ENTRIES: { id: string; text: string }[] = [
  { id: 'tier-1', text: "It's higher than it looks. We'll need more lift." },
  { id: 'tier-2', text: 'Pollen blows away in the gusts. We need to be quicker about it.' },
  { id: 'tier-3', text: 'The wax blocks are heavier than I thought. We need stronger backs.' },
  { id: 'tier-4', text: "I caught a glimpse — there's something bright up there. Keep going." },
  { id: 'tier-5', text: 'Silent. Beautiful. The flower is enormous. We just need more.' },
];

const FALLBACK_ENTRY = {
  id: 'tier-fallback',
  text: 'We climb higher each time. The flower is patient.',
};

export function journalSystem(state: GameState): void {
  if (state.vessel.phase !== 'crashed') return;
  if (state.journal.pending) return;
  // Pick the next entry by index. After we run out of preset entries,
  // reuse the fallback so the loop keeps working.
  const idx = state.journal.entries.length;
  const template = JOURNAL_ENTRIES[idx] ?? FALLBACK_ENTRY;
  // Avoid duplicating the same entry id back-to-back if the fallback is reused.
  state.journal.entries.push({
    id: `${template.id}-${idx}`,
    tier: idx + 1,
    text: template.text,
  });
  state.journal.pending = true;
}
