import type { Game } from '../game/Game';
import { ResourceBar } from './ResourceBar';
import { CellPanel } from './CellPanel';
import { ColonyPanel } from './ColonyPanel';
import { ArtifactProgress } from './ArtifactProgress';
import { JournalModal } from './JournalModal';
import { EndBanner } from './EndBanner';
import { WORLD } from '../world/layout';

export class UI {
  private widgets: { update(): void }[];
  private artifactProgress: ArtifactProgress;
  private game: Game;

  constructor(game: Game, mount: HTMLElement) {
    this.game = game;
    const resourceBar = new ResourceBar(game);
    const cellPanel = new CellPanel(game);
    const colonyPanel = new ColonyPanel(game);
    this.artifactProgress = new ArtifactProgress(game);
    const journal = new JournalModal(game);
    const endBanner = new EndBanner(game);

    mount.appendChild(resourceBar.el);
    mount.appendChild(colonyPanel.el);
    mount.appendChild(cellPanel.el);
    mount.appendChild(this.artifactProgress.el);
    mount.appendChild(journal.el);
    mount.appendChild(endBanner.el);

    this.widgets = [
      resourceBar,
      colonyPanel,
      cellPanel,
      this.artifactProgress,
      journal,
      endBanner,
    ];

    game.renderer.onFit(() => this.repositionAnchored());
    this.repositionAnchored();
    this.update();
  }

  private repositionAnchored(): void {
    const above = this.game.renderer.worldToScreen(
      WORLD.DIG_SITE.x,
      WORLD.DIG_SITE.y - WORLD.DIG_SITE_RADIUS - 40,
      this.game.app,
    );
    this.artifactProgress.reposition(above.x, above.y);
  }

  update(): void {
    for (const w of this.widgets) w.update();
  }
}
