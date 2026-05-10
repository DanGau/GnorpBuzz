import type { Game } from '../game/Game';
import { ResourceBar } from './ResourceBar';
import { HiveControlPanel } from './HiveControlPanel';
import { VesselProgress } from './VesselProgress';
import { JournalModal } from './JournalModal';
import { EndBanner } from './EndBanner';
import { WORLD } from '../world/layout';

// Top-level HTML overlay. Mounts widgets into #ui and updates them every
// frame from Game state. Per-hive control panels are positioned in world
// space (anchored above their hive) and re-positioned on canvas resize.

export class UI {
  private widgets: { update(): void }[];
  private hivePanels: HiveControlPanel[];
  private game: Game;

  constructor(game: Game, mount: HTMLElement) {
    this.game = game;
    const resourceBar = new ResourceBar(game);
    const vesselProgress = new VesselProgress(game);
    const journal = new JournalModal(game);
    const endBanner = new EndBanner(game);

    // Per-hive panels — anchored just above the top of each hive.
    const foragerSlot = WORLD.HIVE_SLOTS[0];
    const waxSlot = WORLD.HIVE_SLOTS[1];
    const HIVE_TOP_OFFSET = 70; // hive sprites stand ~50px tall; sit panel above
    const foragerPanel = new HiveControlPanel(
      game,
      'forager',
      foragerSlot.x,
      foragerSlot.y - HIVE_TOP_OFFSET,
    );
    const waxPanel = new HiveControlPanel(
      game,
      'wax',
      waxSlot.x,
      waxSlot.y - HIVE_TOP_OFFSET,
    );

    mount.appendChild(resourceBar.el);
    mount.appendChild(foragerPanel.el);
    mount.appendChild(waxPanel.el);
    mount.appendChild(vesselProgress.el);
    mount.appendChild(journal.el);
    mount.appendChild(endBanner.el);

    this.hivePanels = [foragerPanel, waxPanel];
    this.widgets = [resourceBar, foragerPanel, waxPanel, vesselProgress, journal, endBanner];

    // Reposition hive panels on canvas resize.
    game.renderer.onFit(() => this.repositionHivePanels());
    this.repositionHivePanels();
    this.update();
  }

  private repositionHivePanels(): void {
    for (const panel of this.hivePanels) {
      const screen = this.game.renderer.worldToScreen(
        panel.anchor.worldX,
        panel.anchor.worldY,
        this.game.app,
      );
      panel.reposition(screen.x, screen.y);
    }
  }

  update(): void {
    for (const w of this.widgets) w.update();
  }
}
