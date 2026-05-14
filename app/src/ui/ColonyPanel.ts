import type { Game } from '../game/Game';
import {
  upgradesForRole,
  getUpgradeTier,
  isUpgradeUnlocked,
  nextUpgradeCost,
  countRole,
  totalPollen,
} from '../sim/state';
import type { HiveType, UpgradeId } from '../sim/state';

// Docked panel on the right edge. The centralized progression hub: both
// per-role upgrade paths live here, applied colony-wide regardless of where
// workers sit on the comb. Placement is the comb's job; progression is this
// panel's job.

interface UpgradeRow {
  row: HTMLDivElement;
  tierEl: HTMLSpanElement;
  button: HTMLButtonElement;
}

export class ColonyPanel {
  readonly el: HTMLDivElement;
  private countEls: Record<HiveType, HTMLSpanElement>;
  private rows: Map<UpgradeId, UpgradeRow>;

  constructor(private game: Game) {
    this.rows = new Map();
    this.el = document.createElement('div');
    this.el.className = 'colony-panel panel';
    this.el.innerHTML = `<div class="cl-head">Colony Upgrades</div>`;
    this.el.addEventListener('click', (e) => e.stopPropagation());

    this.countEls = {
      forager: this.buildSection('forager', 'Forager Path', '🐝'),
      excavator: this.buildSection('excavator', 'Excavator Path', '⛏️'),
    };
  }

  private buildSection(role: HiveType, title: string, icon: string): HTMLSpanElement {
    const section = document.createElement('div');
    section.className = `cl-section cl-${role}`;
    section.innerHTML = `
      <div class="cl-section-head">
        <span class="cl-icon">${icon}</span>
        <span class="cl-title">${title}</span>
        <span class="cl-count"><span class="cl-count-num">0</span> on comb</span>
      </div>
      <div class="cl-rows"></div>
    `;
    const rowsEl = section.querySelector('.cl-rows') as HTMLDivElement;
    for (const def of upgradesForRole(role)) {
      const row = document.createElement('div');
      row.className = 'upgrade-row';
      row.innerHTML = `
        <div class="up-info">
          <div class="up-name">${def.name}</div>
          <div class="up-blurb">${def.blurb}</div>
        </div>
        <div class="up-action">
          <div class="up-tier"></div>
          <button class="up-btn" type="button"></button>
        </div>
      `;
      const button = row.querySelector('.up-btn') as HTMLButtonElement;
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.buyUpgrade(def.id);
      });
      rowsEl.appendChild(row);
      this.rows.set(def.id, {
        row,
        tierEl: row.querySelector('.up-tier') as HTMLSpanElement,
        button,
      });
    }
    this.el.appendChild(section);
    return section.querySelector('.cl-count-num') as HTMLSpanElement;
  }

  update(): void {
    const state = this.game.state;
    const have = totalPollen(state);
    this.countEls.forager.textContent = countRole(state, 'forager').toString();
    this.countEls.excavator.textContent = countRole(state, 'excavator').toString();

    for (const [id, row] of this.rows) {
      const def = upgradesForRole('forager')
        .concat(upgradesForRole('excavator'))
        .find((d) => d.id === id)!;
      const tier = getUpgradeTier(state, id);
      const unlocked = isUpgradeUnlocked(state, id);
      row.tierEl.textContent = `${tier}/${def.maxTier}`;
      if (tier >= def.maxTier) {
        row.button.textContent = 'MAX';
        row.button.disabled = true;
        row.row.classList.remove('locked');
      } else if (!unlocked) {
        row.button.textContent = 'Locked';
        row.button.disabled = true;
        row.row.classList.add('locked');
      } else {
        row.row.classList.remove('locked');
        const cost = nextUpgradeCost(state, id);
        row.button.textContent = `${cost}🌼`;
        row.button.disabled = have < cost;
      }
    }
  }
}
