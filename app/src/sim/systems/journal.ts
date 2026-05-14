import type { GameState } from '../state';

// Journal entries are pushed by `artifactSystem` when an artifact reveal is
// pending. This file is kept as a no-op shim so older system orchestration
// imports still resolve; the active logic lives in `artifact.ts`.
export function journalSystem(_state: GameState): void {
  // intentionally empty
}
