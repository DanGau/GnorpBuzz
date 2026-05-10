import type { Game } from '../game/Game';
import { nextBeeCost, spendableWax, getForagerHive, getWaxHive } from '../sim/state';
import type { HiveType } from '../sim/state';

// HTML control panel anchored above its hive in world space. Positions itself
// in screen pixels by querying the WorldRenderer for the current transform.
// Header is always visible; body collapses/expands on header click.

export class HiveControlPanel {
  readonly el: HTMLDivElement;
  private headerCount: HTMLSpanElement;
  private costEl: HTMLSpanElement;
  private button: HTMLButtonElement;
  private chevron: HTMLSpanElement;
  private expanded: boolean;

  constructor(
    private game: Game,
    private type: HiveType,
    private worldX: number,
    private worldY: number,
  ) {
    this.expanded = true;
    this.el = document.createElement('div');
    this.el.className = `hive-control panel hive-${type}`;
    const title = type === 'forager' ? 'Forager Bees' : 'Wax-maker Bees';
    const buttonLabel = type === 'forager' ? 'Build forager' : 'Build wax-maker';
    this.el.innerHTML = `
      <button class="header" type="button">
        <span class="title">${title}</span>
        <span class="count-badge"><span class="count">0</span></span>
        <span class="chevron">▾</span>
      </button>
      <div class="body">
        <div class="cost-row">Next: <span class="cost-num">FREE</span></div>
        <button class="build" type="button">${buttonLabel}</button>
      </div>
    `;
    const header = this.el.querySelector('.header')! as HTMLButtonElement;
    this.headerCount = this.el.querySelector('.count')! as HTMLSpanElement;
    this.costEl = this.el.querySelector('.cost-num')! as HTMLSpanElement;
    this.button = this.el.querySelector('.build')! as HTMLButtonElement;
    this.chevron = this.el.querySelector('.chevron')! as HTMLSpanElement;

    header.addEventListener('click', () => this.toggle());
    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.buyBee(this.type);
    });
    this.applyExpanded();
  }

  private toggle(): void {
    this.expanded = !this.expanded;
    this.applyExpanded();
  }

  private applyExpanded(): void {
    this.el.classList.toggle('collapsed', !this.expanded);
    // Chevron char stays '▾'; CSS rotates it when collapsed.
    this.chevron.textContent = '▾';
  }

  /** Reposition the panel based on current world→screen transform. */
  reposition(screenX: number, screenY: number): void {
    this.el.style.left = `${screenX}px`;
    this.el.style.top = `${screenY}px`;
  }

  update(): void {
    const cost = nextBeeCost(this.game.state, this.type);
    const hive =
      this.type === 'forager'
        ? getForagerHive(this.game.state)
        : getWaxHive(this.game.state);
    this.headerCount.textContent = hive.bees.toString();
    this.costEl.textContent = cost === 0 ? 'FREE' : `${cost} wax`;
    this.button.disabled = cost > 0 && spendableWax(this.game.state) < cost;
  }

  get anchor(): { worldX: number; worldY: number } {
    return { worldX: this.worldX, worldY: this.worldY };
  }
}
