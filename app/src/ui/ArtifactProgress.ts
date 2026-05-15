import type { Game } from '../game/Game';
import { artifactForTier, digSiteHpPct, ARTIFACTS } from '../sim/state';
import { WORLD } from '../world/layout';

// Compact progress panel anchored above the dig site. Visible only when the
// player selects the dig site. Shows site tier + HP bar + a teaser of the
// artifact being uncovered + a tally of revealed artifacts.

export class ArtifactProgress {
  readonly el: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private fillEl: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private tallyEl: HTMLDivElement;

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'vessel-progress panel hidden';
    this.el.innerHTML = `
      <div class="title">Dig Site I</div>
      <div class="status">100% hp</div>
      <div class="bar"><div class="fill" style="width: 100%"></div></div>
      <div class="tally" style="margin-top:6px; opacity:0.85;">Artifacts: 0 / ${ARTIFACTS.length}</div>
      <div class="caret"></div>
    `;
    this.titleEl = this.el.querySelector('.title')! as HTMLDivElement;
    this.statusEl = this.el.querySelector('.status')! as HTMLDivElement;
    this.fillEl = this.el.querySelector('.fill')! as HTMLDivElement;
    this.tallyEl = this.el.querySelector('.tally')! as HTMLDivElement;
    this.el.addEventListener('click', (e) => e.stopPropagation());
  }

  update(): void {
    const selected = this.game.selectedId === 'dig-site';
    this.el.classList.toggle('hidden', !selected);

    // Anchor above the boulder in screen space — recomputed each frame so
    // it tracks the camera as it pans/zooms.
    const above = this.game.renderer.worldToScreen(
      WORLD.DIG_SITE.x,
      WORLD.DIG_SITE.y - WORLD.DIG_SITE_RADIUS - 40,
      this.game.app,
    );
    this.el.style.left = `${above.x}px`;
    this.el.style.top = `${above.y}px`;

    const site = this.game.state.digSite;
    const spec = artifactForTier(site.tier);
    const tierName = spec ? `Dig Site ${roman(site.tier)} — buried beneath: ?` : 'Dig Site';
    this.titleEl.textContent = tierName;

    const pct = Math.max(0, Math.min(1, digSiteHpPct(this.game.state)));
    this.fillEl.style.width = `${(pct * 100).toFixed(1)}%`;
    if (site.state === 'revealing') {
      this.statusEl.textContent = 'Artifact uncovered!';
    } else if (site.state === 'sealed') {
      this.statusEl.textContent = 'Sealed.';
    } else {
      this.statusEl.textContent = `${Math.round(pct * 100)}% hp · ${Math.round(site.hp)} / ${Math.round(site.maxHp)}`;
    }
    const revealed = this.game.state.artifacts.revealed.length;
    this.tallyEl.textContent = `Artifacts: ${revealed} / ${ARTIFACTS.length}`;
  }
}

function roman(n: number): string {
  return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][n - 1] ?? n.toString();
}
