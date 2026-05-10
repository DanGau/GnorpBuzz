import type { Game } from '../game/Game';
import { nextBeeCost, spendableWax, getForagerHive, getWaxHive } from '../sim/state';
import type { HiveType } from '../sim/state';

// Buys individual worker bees (foragers + wax-makers). First bee of each type
// is free; subsequent bees cost wax. The hive structure itself is fixed —
// you only ever scale by adding bees to the existing hive.

export class BuyHivePanel {
  readonly el: HTMLDivElement;
  private rows: { type: HiveType; costEl: HTMLSpanElement; countEl: HTMLSpanElement; button: HTMLButtonElement }[];

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'buy-panel panel';
    this.el.innerHTML = `
      <div class="hive-row" data-type="forager">
        <div class="label">FORAGER BEES</div>
        <div class="cost">You have <span class="count">0</span></div>
        <div class="cost">Next: <span class="cost-num">FREE</span></div>
        <button>Build forager</button>
      </div>
      <hr style="border:0;border-top:1px solid #5a4a30;margin:10px 0;">
      <div class="hive-row" data-type="wax">
        <div class="label">WAX-MAKER BEES</div>
        <div class="cost">You have <span class="count">0</span></div>
        <div class="cost">Next: <span class="cost-num">FREE</span></div>
        <button>Build wax-maker</button>
      </div>
    `;
    this.rows = (['forager', 'wax'] as HiveType[]).map((type) => {
      const row = this.el.querySelector(`.hive-row[data-type="${type}"]`)!;
      const button = row.querySelector('button')!;
      const costEl = row.querySelector('.cost-num')! as HTMLSpanElement;
      const countEl = row.querySelector('.count')! as HTMLSpanElement;
      button.addEventListener('click', () => this.game.buyBee(type));
      return { type, costEl, countEl, button };
    });
  }

  update(): void {
    const wax = spendableWax(this.game.state);
    const forager = getForagerHive(this.game.state);
    const waxh = getWaxHive(this.game.state);
    for (const row of this.rows) {
      const cost = nextBeeCost(this.game.state, row.type);
      const count = row.type === 'forager' ? forager.bees : waxh.bees;
      row.costEl.textContent = cost === 0 ? 'FREE' : `${cost} wax`;
      row.countEl.textContent = count.toString();
      row.button.disabled = cost > 0 && wax < cost;
    }
  }
}
