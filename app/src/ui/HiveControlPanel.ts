import type { Game } from '../game/Game';
import {
  nextBeeCost,
  costCurrency,
  spendableWax,
  totalPollen,
  buildCost,
  getForagerHive,
  getWaxHive,
  getBuilderHive,
} from '../sim/state';
import type { HiveType } from '../sim/state';

// HTML control panel anchored above its hive in world space. Hidden by
// default; shown when the hive is the selected target. Switches between
// "Build [hive]" mode (when unbuilt) and "Hire [bee]" mode (when built).

export class HiveControlPanel {
  readonly el: HTMLDivElement;
  readonly hiveId: string;
  private headerCount: HTMLSpanElement;
  private titleEl: HTMLSpanElement;
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
    this.el.innerHTML = `
      <div class="header">
        <span class="title"></span>
        <span class="count-badge"><span class="count">0</span></span>
      </div>
      <div class="body">
        <div class="cost-row">Next: <span class="cost-num">FREE</span></div>
        <button class="build" type="button"></button>
      </div>
      <div class="caret"></div>
    `;
    this.titleEl = this.el.querySelector('.title')! as HTMLSpanElement;
    this.headerCount = this.el.querySelector('.count')! as HTMLSpanElement;
    this.costEl = this.el.querySelector('.cost-num')! as HTMLSpanElement;
    this.button = this.el.querySelector('.build')! as HTMLButtonElement;

    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      const hive = this.game.state.hives.find((h) => h.type === this.type);
      if (hive && !hive.built) {
        this.game.buildHive(this.type);
      } else {
        this.game.buyBee(this.type);
      }
    });
    this.el.addEventListener('click', (e) => e.stopPropagation());
  }

  reposition(screenX: number, screenY: number): void {
    this.el.style.left = `${screenX}px`;
    this.el.style.top = `${screenY}px`;
  }

  update(): void {
    const hive =
      this.type === 'forager'
        ? getForagerHive(this.game.state)
        : this.type === 'wax'
          ? getWaxHive(this.game.state)
          : getBuilderHive(this.game.state);

    const visible = this.game.selectedId === this.hiveId;
    this.el.classList.toggle('hidden', !visible);

    if (!hive.built) {
      // Build mode
      const bc = buildCost(this.type)!;
      const buildLabel =
        this.type === 'wax' ? 'Build Wax Hive' : 'Build Builder Hive';
      this.titleEl.textContent =
        this.type === 'wax' ? 'Wax Hive' : 'Builder Hive';
      this.headerCount.textContent = '–';
      this.costEl.textContent = `${bc.amount} ${bc.currency}`;
      this.button.textContent = buildLabel;
      const have =
        bc.currency === 'pollen'
          ? totalPollen(this.game.state)
          : spendableWax(this.game.state);
      this.button.disabled = have < bc.amount;
    } else {
      // Hire mode
      const cost = nextBeeCost(this.game.state, this.type);
      const currency = costCurrency(this.type);
      const title =
        this.type === 'forager'
          ? 'Forager Bees'
          : this.type === 'wax'
            ? 'Wax-maker Bees'
            : 'Builder Bees';
      const buttonLabel =
        this.type === 'forager'
          ? 'Hire forager'
          : this.type === 'wax'
            ? 'Hire wax-maker'
            : 'Hire builder';
      this.titleEl.textContent = title;
      this.headerCount.textContent = hive.bees.toString();
      this.costEl.textContent = cost === 0 ? 'FREE' : `${cost} ${currency}`;
      this.button.textContent = buttonLabel;
      const have =
        currency === 'pollen'
          ? totalPollen(this.game.state)
          : spendableWax(this.game.state);
      this.button.disabled = cost > 0 && have < cost;
    }
  }

  get anchor(): { worldX: number; worldY: number } {
    return { worldX: this.worldX, worldY: this.worldY };
  }
}
