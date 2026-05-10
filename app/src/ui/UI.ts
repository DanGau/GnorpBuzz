import type { Game } from '../game/Game';
import { ResourceBar } from './ResourceBar';
import { HiveControlPanel } from './HiveControlPanel';
import { VesselProgress } from './VesselProgress';
import { JournalModal } from './JournalModal';
import { EndBanner } from './EndBanner';
import { WORLD } from '../world/layout';

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

    // Hive panels are anchored just above the hive's top edge in world space.
    // The hive bodies extend ~50px above their slot center, so anchor at
    // slot.y - 56 → panel sits with its bottom 6px above the hive top.
    const ANCHOR_OFFSET = 56;
    const foragerSlot = WORLD.HIVE_SLOTS[0];
    const waxSlot = WORLD.HIVE_SLOTS[1];
    const foragerPanel = new HiveControlPanel(
      game,
      'forager',
      'forager-hive',
      foragerSlot.x,
      foragerSlot.y - ANCHOR_OFFSET,
    );
    const waxPanel = new HiveControlPanel(
      game,
      'wax',
      'wax-hive',
      waxSlot.x,
      waxSlot.y - ANCHOR_OFFSET,
    );

    mount.appendChild(resourceBar.el);
    mount.appendChild(foragerPanel.el);
    mount.appendChild(waxPanel.el);
    mount.appendChild(vesselProgress.el);
    mount.appendChild(journal.el);
    mount.appendChild(endBanner.el);

    this.hivePanels = [foragerPanel, waxPanel];
    this.widgets = [resourceBar, foragerPanel, waxPanel, vesselProgress, journal, endBanner];

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
