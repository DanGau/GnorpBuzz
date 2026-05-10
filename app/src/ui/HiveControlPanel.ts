import type { Game } from '../game/Game';
import {
  nextBeeCost,
  spendableWax,
  getForagerHive,
  getWaxHive,
  getBuilderHive,
} from '../sim/state';
import type { HiveType } from '../sim/state';

// HTML control panel anchored above its hive in world space. Hidden by
// default; shown when the hive is the currently-selected building.
// Clicking the building (in Pixi) toggles selection; clicking the meadow
// background deselects.

export class HiveControlPanel {
  readonly el: HTMLDivElement;
  readonly hiveId: string;
  private headerCount: HTMLSpanElement;
  private costEl: HTMLSpanElement;
  private button: HTMLButtonElement;

  constructor(
    private game: Game,
    private type: HiveType,
    hiveId: string,
    private worldX: number,
    private worldY: number,
  ) {
    this.hiveId = hiveId;
    this.el = document.createElement('div');
    this.el.className = `hive-control panel hive-${type} hidden`;
    const title =
      type === 'forager' ? 'Forager Bees' : type === 'wax' ? 'Wax-maker Bees' : 'Builder Bees';
    const buttonLabel =
      type === 'forager'
        ? 'Hire forager'
        : type === 'wax'
          ? 'Hire wax-maker'
          : 'Hire builder';
    this.el.innerHTML = `
      <div class="header">
        <span class="title">${title}</span>
        <span class="count-badge"><span class="count">0</span></span>
      </div>
      <div class="body">
        <div class="cost-row">Next: <span class="cost-num">FREE</span></div>
        <button class="build" type="button">${buttonLabel}</button>
      </div>
      <div class="caret"></div>
    `;
    this.headerCount = this.el.querySelector('.count')! as HTMLSpanElement;
    this.costEl = this.el.querySelector('.cost-num')! as HTMLSpanElement;
    this.button = this.el.querySelector('.build')! as HTMLButtonElement;

    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.buyBee(this.type);
    });
    // Clicks on the panel itself shouldn't propagate to the page background.
    this.el.addEventListener('click', (e) => e.stopPropagation());
  }

  reposition(screenX: number, screenY: number): void {
    this.el.style.left = `${screenX}px`;
    this.el.style.top = `${screenY}px`;
  }

  update(): void {
    const cost = nextBeeCost(this.game.state, this.type);
    const hive =
      this.type === 'forager'
        ? getForagerHive(this.game.state)
        : this.type === 'wax'
          ? getWaxHive(this.game.state)
          : getBuilderHive(this.game.state);
    this.headerCount.textContent = hive.bees.toString();
    this.costEl.textContent = cost === 0 ? 'FREE' : `${cost} wax`;
    this.button.disabled = cost > 0 && spendableWax(this.game.state) < cost;

    const visible = this.game.selectedId === this.hiveId;
    this.el.classList.toggle('hidden', !visible);
  }

  get anchor(): { worldX: number; worldY: number } {
    return { worldX: this.worldX, worldY: this.worldY };
  }
}
