import type { Game } from '../game/Game';
import { ResourceBar } from './ResourceBar';
import { BuyHivePanel } from './BuyHivePanel';
import { VesselProgress } from './VesselProgress';
import { JournalModal } from './JournalModal';
import { EndBanner } from './EndBanner';

// Top-level HTML overlay. Mounts widgets into #ui and updates them every
// frame from Game state. Modal-style widgets read state too, but appear
// or disappear based on phase / journal.pending.

export class UI {
  private widgets: { update(): void }[];

  constructor(game: Game, mount: HTMLElement) {
    const resourceBar = new ResourceBar(game);
    const buyPanel = new BuyHivePanel(game);
    const vesselProgress = new VesselProgress(game);
    const journal = new JournalModal(game);
    const endBanner = new EndBanner(game);

    mount.appendChild(resourceBar.el);
    mount.appendChild(buyPanel.el);
    mount.appendChild(vesselProgress.el);
    mount.appendChild(journal.el);
    mount.appendChild(endBanner.el);

    this.widgets = [resourceBar, buyPanel, vesselProgress, journal, endBanner];
    this.update();
  }

  update(): void {
    for (const w of this.widgets) w.update();
  }
}
