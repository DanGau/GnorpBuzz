import type { GameState } from '../state';
import { artifactForTier } from '../state';

// When an active dig site hits 0 HP, transition to 'revealing' and queue
// the artifact for the journal modal. Geomancers stop hitting once state
// leaves 'active'.
export function digSiteSystem(state: GameState): void {
  const site = state.digSite;
  if (site.state === 'active' && site.hp <= 0) {
    site.hp = 0;
    site.state = 'revealing';
    const spec = artifactForTier(site.tier);
    if (spec && !state.artifacts.pending) {
      state.artifacts.pending = spec.id;
    }
  }
}
