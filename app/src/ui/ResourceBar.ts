import type { Game } from '../game/Game';
import { totalPollen, totalWaxBlocks } from '../sim/state';

export class ResourceBar {
  readonly el: HTMLDivElement;
  private pollenEl: HTMLSpanElement;
  private blocksEl: HTMLSpanElement;
  private beesEl: HTMLSpanElement;

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'resource-bar panel';
    this.el.innerHTML = `
      <span class="icon">🌼</span>
      <span><span class="pollen">0</span> pollen</span>
      <span style="opacity:0.5">·</span>
      <span class="icon">🍯</span>
      <span><span class="blocks">0</span> wax</span>
      <span style="opacity:0.5">·</span>
      <span><span class="bees">0</span> 🐝</span>
    `;
    this.pollenEl = this.el.querySelector('.pollen')!;
    this.blocksEl = this.el.querySelector('.blocks')!;
    this.beesEl = this.el.querySelector('.bees')!;
  }

  update(): void {
    this.pollenEl.textContent = totalPollen(this.game.state).toString();
    this.blocksEl.textContent = totalWaxBlocks(this.game.state).toString();
    const totalBees = this.game.state.hives.reduce((s, h) => s + h.bees, 0);
    this.beesEl.textContent = totalBees.toString();
  }
}
