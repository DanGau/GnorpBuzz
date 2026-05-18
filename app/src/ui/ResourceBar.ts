import type { Game } from '../game/Game';
import { totalPollen, totalHoney, honeyCap, totalBees, digSiteHpPct } from '../sim/state';

export class ResourceBar {
  readonly el: HTMLDivElement;
  private pollenEl: HTMLSpanElement;
  private honeyEl: HTMLSpanElement;
  private honeyCapEl: HTMLSpanElement;
  private hpEl: HTMLSpanElement;
  private tierEl: HTMLSpanElement;
  private beesEl: HTMLSpanElement;

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'resource-bar panel';
    this.el.innerHTML = `
      <span class="icon">🌼</span>
      <span><span class="pollen">0</span> pollen</span>
      <span style="opacity:0.5"> · </span>
      <span class="icon">🍯</span>
      <span><span class="honey">0</span>/<span class="honey-cap">10</span> mana</span>
      <span style="opacity:0.5"> · </span>
      <span class="icon">⛏️</span>
      <span>Tier <span class="tier">1</span></span>
      <span style="opacity:0.5"> · </span>
      <span class="icon">🪨</span>
      <span><span class="hp">100%</span> hp</span>
      <span style="opacity:0.5"> · </span>
      <span><span class="bees">0</span> 🐝</span>
    `;
    this.pollenEl = this.el.querySelector('.pollen')!;
    this.honeyEl = this.el.querySelector('.honey')!;
    this.honeyCapEl = this.el.querySelector('.honey-cap')!;
    this.hpEl = this.el.querySelector('.hp')!;
    this.tierEl = this.el.querySelector('.tier')!;
    this.beesEl = this.el.querySelector('.bees')!;
  }

  update(): void {
    this.pollenEl.textContent = totalPollen(this.game.state).toString();
    this.honeyEl.textContent = totalHoney(this.game.state).toString();
    this.honeyCapEl.textContent = honeyCap(this.game.state).toString();
    const pct = Math.round(digSiteHpPct(this.game.state) * 100);
    this.hpEl.textContent = `${pct}%`;
    this.tierEl.textContent = this.game.state.digSite.tier.toString();
    this.beesEl.textContent = totalBees(this.game.state).toString();
  }
}
