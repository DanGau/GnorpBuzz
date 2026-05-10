import type { Game } from '../game/Game';
import { vesselTierConfig, totalNectar } from '../sim/state';

// Compact progress panel anchored above the airplane. Hidden by default;
// shown when the player selects the vessel. Shows current tier + name,
// block progress, and nectar requirement (when nonzero).

export class VesselProgress {
  readonly el: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private fillEl: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private nectarEl: HTMLDivElement;

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'vessel-progress panel hidden';
    this.el.innerHTML = `
      <div class="title">Paper Airplane</div>
      <div class="status">0 / 0 blocks</div>
      <div class="bar"><div class="fill" style="width: 0%"></div></div>
      <div class="nectar-row" style="display:none">💧 <span class="nectar">0</span> nectar</div>
      <div class="caret"></div>
    `;
    this.titleEl = this.el.querySelector('.title')! as HTMLDivElement;
    this.statusEl = this.el.querySelector('.status')! as HTMLDivElement;
    this.fillEl = this.el.querySelector('.fill')! as HTMLDivElement;
    this.nectarEl = this.el.querySelector('.nectar-row')! as HTMLDivElement;

    this.el.addEventListener('click', (e) => e.stopPropagation());
  }

  reposition(screenX: number, screenY: number): void {
    this.el.style.left = `${screenX}px`;
    this.el.style.top = `${screenY}px`;
  }

  update(): void {
    const v = this.game.state.vessel;
    const cfg = vesselTierConfig(v.tier);
    const selected = this.game.selectedId === 'vessel';
    this.el.classList.toggle('hidden', !selected);

    this.titleEl.textContent = `Tier ${v.tier} — ${cfg.name}`;

    const pct = v.requiredBlocks > 0 ? (v.deliveredBlocks / v.requiredBlocks) * 100 : 0;
    if (v.phase === 'building') {
      this.fillEl.style.width = `${Math.min(100, pct).toFixed(1)}%`;
      this.statusEl.textContent = `${v.deliveredBlocks} / ${v.requiredBlocks} blocks`;
    } else if (v.phase === 'ready') {
      this.fillEl.style.width = '100%';
      this.statusEl.textContent = 'Ready to launch';
    } else if (v.phase === 'launching') {
      this.fillEl.style.width = '100%';
      this.statusEl.textContent = 'Ascending…';
    } else if (v.phase === 'crashing') {
      this.statusEl.textContent = 'Falling.';
    } else if (v.phase === 'crashed') {
      this.statusEl.textContent = 'It crashed.';
    }

    if (v.requiredNectar > 0) {
      this.nectarEl.style.display = '';
      const have = totalNectar(this.game.state);
      const ok = have >= v.requiredNectar;
      this.nectarEl.innerHTML = `💧 <span class="nectar" style="color:${ok ? '#7fdbff' : '#cfc6a8'}">${have} / ${v.requiredNectar}</span> nectar`;
    } else {
      this.nectarEl.style.display = 'none';
    }
  }
}
