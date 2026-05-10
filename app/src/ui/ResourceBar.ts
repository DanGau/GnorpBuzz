import type { Game } from '../game/Game';
import { totalPollen, totalNectar, spendableWax } from '../sim/state';

export class ResourceBar {
  readonly el: HTMLDivElement;
  private pollenEl: HTMLSpanElement;
  private nectarSegEl: HTMLSpanElement;
  private nectarEl: HTMLSpanElement;
  private waxEl: HTMLSpanElement;
  private beesEl: HTMLSpanElement;

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'resource-bar panel';
    this.el.innerHTML = `
      <span class="icon">🌼</span>
      <span><span class="pollen">0</span> pollen</span>
      <span class="nectar-seg" style="display:none">
        <span style="opacity:0.5"> · </span>
        <span class="icon">💧</span>
        <span><span class="nectar">0</span> nectar</span>
      </span>
      <span style="opacity:0.5"> · </span>
      <span class="icon">🍯</span>
      <span><span class="wax">0</span> wax</span>
      <span style="opacity:0.5"> · </span>
      <span><span class="bees">0</span> 🐝</span>
    `;
    this.pollenEl = this.el.querySelector('.pollen')!;
    this.nectarSegEl = this.el.querySelector('.nectar-seg')!;
    this.nectarEl = this.el.querySelector('.nectar')!;
    this.waxEl = this.el.querySelector('.wax')!;
    this.beesEl = this.el.querySelector('.bees')!;
  }

  update(): void {
    this.pollenEl.textContent = totalPollen(this.game.state).toString();
    this.waxEl.textContent = spendableWax(this.game.state).toString();
    const totalBees = this.game.state.hives.reduce((s, h) => s + h.bees, 0);
    this.beesEl.textContent = totalBees.toString();
    if (this.game.state.nectarUnlocked) {
      this.nectarSegEl.style.display = '';
      this.nectarEl.textContent = totalNectar(this.game.state).toString();
    } else {
      this.nectarSegEl.style.display = 'none';
    }
  }
}
