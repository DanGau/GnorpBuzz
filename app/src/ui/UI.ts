import type { Game } from '../game/Game';
import { ResourceBar } from './ResourceBar';
import { HiveControlPanel } from './HiveControlPanel';
import { VesselProgress } from './VesselProgress';
import { JournalModal } from './JournalModal';
import { EndBanner } from './EndBanner';
import { LaunchButton } from './LaunchButton';
import { WORLD } from '../world/layout';

export class UI {
  private widgets: { update(): void }[];
  private hivePanels: HiveControlPanel[];
  private launchButton: LaunchButton;
  private vesselProgress: VesselProgress;
  private game: Game;

  constructor(game: Game, mount: HTMLElement) {
    this.game = game;
    const resourceBar = new ResourceBar(game);
    this.vesselProgress = new VesselProgress(game);
    const journal = new JournalModal(game);
    const endBanner = new EndBanner(game);

    // Hive panels — anchor just above each hive's top edge.
    const ANCHOR_OFFSET = 56;
    const foragerSlot = WORLD.HIVE_SLOTS[0];
    const builderSlot = WORLD.HIVE_SLOTS[1];
    const waxSlot = WORLD.HIVE_SLOTS[2];

    const foragerPanel = new HiveControlPanel(
      game,
      'forager',
      'forager-hive',
      foragerSlot.x,
      foragerSlot.y - ANCHOR_OFFSET,
    );
    const builderPanel = new HiveControlPanel(
      game,
      'builder',
      'builder-hive',
      builderSlot.x,
      builderSlot.y - ANCHOR_OFFSET,
    );
    const waxPanel = new HiveControlPanel(
      game,
      'wax',
      'wax-hive',
      waxSlot.x,
      waxSlot.y - ANCHOR_OFFSET,
    );

    // Launch button — anchored just below the airplane on the vessel pad.
    this.launchButton = new LaunchButton(game);

    mount.appendChild(resourceBar.el);
    mount.appendChild(foragerPanel.el);
    mount.appendChild(builderPanel.el);
    mount.appendChild(waxPanel.el);
    mount.appendChild(this.vesselProgress.el);
    mount.appendChild(this.launchButton.el);
    mount.appendChild(journal.el);
    mount.appendChild(endBanner.el);

    this.hivePanels = [foragerPanel, builderPanel, waxPanel];
    this.widgets = [
      resourceBar,
      foragerPanel,
      builderPanel,
      waxPanel,
      this.launchButton,
      this.vesselProgress,
      journal,
      endBanner,
    ];

    game.renderer.onFit(() => this.repositionAnchored());
    this.repositionAnchored();
    this.update();
  }

  private repositionAnchored(): void {
    for (const panel of this.hivePanels) {
      const screen = this.game.renderer.worldToScreen(
        panel.anchor.worldX,
        panel.anchor.worldY,
        this.game.app,
      );
      panel.reposition(screen.x, screen.y);
    }
    // Launch button sits just below the airplane.
    const launch = this.game.renderer.worldToScreen(
      WORLD.VESSEL_PAD.x,
      WORLD.VESSEL_PAD.y + 36,
      this.game.app,
    );
    this.launchButton.reposition(launch.x, launch.y);
    // Vessel progress panel sits above the airplane (selection-gated).
    const vesselAbove = this.game.renderer.worldToScreen(
      WORLD.VESSEL_PAD.x,
      WORLD.VESSEL_PAD.y - 36,
      this.game.app,
    );
    this.vesselProgress.reposition(vesselAbove.x, vesselAbove.y);
  }

  update(): void {
    for (const w of this.widgets) w.update();
  }
}
