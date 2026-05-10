import type { Game } from '../game/Game';

export class VesselProgress {
  readonly el: HTMLDivElement;
  private fillEl: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private labelEl: HTMLDivElement;

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'vessel-progress panel';
    this.el.innerHTML = `
      <div class="label">PAPER AIRPLANE</div>
      <div class="bar"><div class="fill" style="width: 0%"></div></div>
      <div class="status">0 / 0 blocks delivered</div>
    `;
    this.fillEl = this.el.querySelector('.fill')!;
    this.statusEl = this.el.querySelector('.status')!;
    this.labelEl = this.el.querySelector('.label')!;
  }

  update(): void {
    const v = this.game.state.vessel;
    if (v.phase === 'reviewed') {
      this.el.style.display = 'none';
      return;
    }
    this.el.style.display = '';

    const pct = v.requiredBlocks > 0 ? (v.deliveredBlocks / v.requiredBlocks) * 100 : 0;
    if (v.phase === 'building') {
      this.fillEl.style.width = `${Math.min(100, pct).toFixed(1)}%`;
      this.statusEl.textContent = `${v.deliveredBlocks} / ${v.requiredBlocks} wax blocks delivered`;
      this.labelEl.textContent = 'PAPER AIRPLANE — UNDER CONSTRUCTION';
      this.el.classList.remove('ready');
    } else if (v.phase === 'ready') {
      // Hide the bottom-center bar; the in-world Launch button takes over.
      this.el.style.display = 'none';
      return;
    } else if (v.phase === 'launching') {
      this.fillEl.style.width = `100%`;
      this.statusEl.textContent = 'Ascending…';
      this.labelEl.textContent = 'PAPER AIRPLANE — IN FLIGHT';
      this.el.classList.remove('ready');
    } else if (v.phase === 'crashing') {
      this.statusEl.textContent = 'Falling.';
      this.labelEl.textContent = 'PAPER AIRPLANE — IN FLIGHT';
      this.el.classList.remove('ready');
    } else if (v.phase === 'crashed') {
      this.statusEl.textContent = 'It crashed.';
      this.labelEl.textContent = 'PAPER AIRPLANE — DOWN';
      this.el.classList.remove('ready');
    }
  }
}
