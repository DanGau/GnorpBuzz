import type { GameState } from '../state';
import { artifactForTier } from '../state';

// Bridge the pending artifact onto the journal-pending flag so the existing
// modal lights up. The artifact's journal text is pushed in only once.
export function artifactSystem(state: GameState): void {
  const pendingId = state.artifacts.pending;
  if (!pendingId) return;
  if (state.journal.pending) return;

  const alreadyJournaled = state.journal.entries.some((e) => e.id === pendingId);
  if (alreadyJournaled) {
    // Modal already shown and dismissed for this artifact but we're still in
    // 'revealing' state; do nothing — dismissArtifact() will progress us.
    return;
  }

  const spec = artifactForTier(state.digSite.tier);
  if (!spec || spec.id !== pendingId) return;

  state.journal.entries.push({
    id: spec.id,
    tier: spec.tier,
    text: spec.journalText,
  });
  state.journal.pending = true;
}
