import type { Game } from '../game/Game';
import { nextHiveCost, totalWaxBlocks } from '../sim/state';
import type { HiveType } from '../sim/state';

export class BuyHivePanel {
  readonly el: HTMLDivElement;
  private rows: { type: HiveType; costEl: HTMLSpanElement; countEl: HTMLSpanElement; button: HTMLButtonElement }[];

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'buy-panel panel';
    this.el.innerHTML = `
      <div class="hive-row" data-type="forager">
        <div class="label">FORAGER HIVE</div>
        <div class="cost">You have <span class="count">0</span> · Next: <span class="cost-num">0</span> wax</div>
        <button>Build forager hive</button>
      </div>
      <hr style="border:0;border-top:1px solid #5a4a30;margin:10px 0;">
      <div class="hive-row" data-type="wax">
        <div class="label">WAX HIVE</div>
        <div class="cost">You have <span class="count">0</span> · Next: <span class="cost-num">0</span> wax</div>
        <button>Build wax hive</button>
      </div>
    `;
    this.rows = (['forager', 'wax'] as HiveType[]).map((type) => {
      const row = this.el.querySelector(`.hive-row[data-type="${type}"]`)!;
      const button = row.querySelector('button')!;
      const costEl = row.querySelector('.cost-num')! as HTMLSpanElement;
      const countEl = row.querySelector('.count')! as HTMLSpanElement;
      button.addEventListener('click', () => this.game.buyHive(type));
      return { type, costEl, countEl, button };
    });
  }

  update(): void {
    const wax = totalWaxBlocks(this.game.state);
    for (const row of this.rows) {
      const cost = nextHiveCost(this.game.state, row.type);
      const count = this.game.state.hives.filter((h) => h.type === row.type).length;
      row.costEl.textContent = cost.toString();
      row.countEl.textContent = count.toString();
      row.button.disabled = wax < cost;
    }
  }
}
