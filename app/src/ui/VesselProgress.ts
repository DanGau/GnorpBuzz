import type { Game } from '../game/Game';

// Compact progress panel anchored above the airplane. Hidden by default;
// shown when the player selects the vessel. Mirrors HiveControlPanel.

export class VesselProgress {
  readonly el: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private fillEl: HTMLDivElement;
  private titleEl: HTMLDivElement;

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'vessel-progress panel hidden';
    this.el.innerHTML = `
      <div class="title">Paper Airplane</div>
      <div class="status">0 / 0 blocks</div>
      <div class="bar"><div class="fill" style="width: 0%"></div></div>
      <div class="caret"></div>
    `;
    this.titleEl = this.el.querySelector('.title')! as HTMLDivElement;
    this.statusEl = this.el.querySelector('.status')! as HTMLDivElement;
    this.fillEl = this.el.querySelector('.fill')! as HTMLDivElement;

    this.el.addEventListener('click', (e) => e.stopPropagation());
  }

  reposition(screenX: number, screenY: number): void {
    this.el.style.left = `${screenX}px`;
    this.el.style.top = `${screenY}px`;
  }

  update(): void {
    const v = this.game.state.vessel;
    const selected = this.game.selectedId === 'vessel';
    // Don't show after the journal has been dismissed.
    const visible = selected && v.phase !== 'reviewed';
    this.el.classList.toggle('hidden', !visible);

    const pct = v.requiredBlocks > 0 ? (v.deliveredBlocks / v.requiredBlocks) * 100 : 0;
    if (v.phase === 'building') {
      this.fillEl.style.width = `${Math.min(100, pct).toFixed(1)}%`;
      this.statusEl.textContent = `${v.deliveredBlocks} / ${v.requiredBlocks} blocks`;
      this.titleEl.textContent = 'Paper Airplane';
    } else if (v.phase === 'ready') {
      this.fillEl.style.width = '100%';
      this.statusEl.textContent = 'Ready to launch';
      this.titleEl.textContent = 'Paper Airplane';
    } else if (v.phase === 'launching') {
      this.fillEl.style.width = '100%';
      this.statusEl.textContent = 'Ascending…';
      this.titleEl.textContent = 'Paper Airplane';
    } else if (v.phase === 'crashing') {
      this.statusEl.textContent = 'Falling.';
      this.titleEl.textContent = 'Paper Airplane';
    } else if (v.phase === 'crashed') {
      this.statusEl.textContent = 'It crashed.';
      this.titleEl.textContent = 'Paper Airplane';
    }
  }
}
