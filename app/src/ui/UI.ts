import type { Game } from '../game/Game';
import { ResourceBar } from './ResourceBar';
import { ArtifactProgress } from './ArtifactProgress';
import { ZoomOutButton } from './ZoomOutButton';
import { JournalModal } from './JournalModal';
import { EndBanner } from './EndBanner';

// Upgrade rows used to live in a docked ColonyPanel here. They now live
// inside the underground chambers (`UndergroundView` + `ChamberRadialView`).
// See `docs/underground.md`.
export class UI {
  private widgets: { update(): void }[];

  constructor(game: Game, mount: HTMLElement) {
    const resourceBar = new ResourceBar(game);
    const artifactProgress = new ArtifactProgress(game);
    const zoomOut = new ZoomOutButton(game);
    const journal = new JournalModal(game);
    const endBanner = new EndBanner(game);

    mount.appendChild(resourceBar.el);
    mount.appendChild(artifactProgress.el);
    mount.appendChild(zoomOut.el);
    mount.appendChild(journal.el);
    mount.appendChild(endBanner.el);

    this.widgets = [
      resourceBar,
      artifactProgress,
      zoomOut,
      journal,
      endBanner,
    ];

    this.update();
  }

  update(): void {
    for (const w of this.widgets) w.update();
  }
}
