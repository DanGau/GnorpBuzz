import type { Game } from '../game/Game';
import {
  nextBeeCost,
  costCurrency,
  spendableWax,
  totalPollen,
  buildCost,
  getForagerHive,
  getWaxHive,
  getBuilderHive,
  upgradesForRole,
  getUpgradeTier,
  isUpgradeUnlocked,
  nextUpgradeCost,
  UPGRADE_DEFS,
} from '../sim/state';
import type { HiveType, UpgradeId } from '../sim/state';

export class HiveControlPanel {
  readonly el: HTMLDivElement;
  readonly hiveId: string;
  private headerCount: HTMLSpanElement;
  private titleEl: HTMLSpanElement;
  private costEl: HTMLSpanElement;
  private button: HTMLButtonElement;
  private upgradeList: HTMLDivElement;
  private upgradeRows: Map<UpgradeId, {
    row: HTMLDivElement;
    tierEl: HTMLSpanElement;
    costEl: HTMLSpanElement;
    button: HTMLButtonElement;
  }>;

  constructor(
    private game: Game,
    private type: HiveType,
    hiveId: string,
    private worldX: number,
    private worldY: number,
  ) {
    this.hiveId = hiveId;
    this.upgradeRows = new Map();
    this.el = document.createElement('div');
    this.el.className = `hive-control panel hive-${type} hidden`;
    this.el.innerHTML = `
      <div class="header">
        <span class="title"></span>
        <span class="count-badge"><span class="count">0</span></span>
      </div>
      <div class="body">
        <div class="cost-row">Next: <span class="cost-num">FREE</span></div>
        <button class="build" type="button"></button>
        <div class="upgrade-list"></div>
      </div>
      <div class="caret"></div>
    `;
    this.titleEl = this.el.querySelector('.title')! as HTMLSpanElement;
    this.headerCount = this.el.querySelector('.count')! as HTMLSpanElement;
    this.costEl = this.el.querySelector('.cost-num')! as HTMLSpanElement;
    this.button = this.el.querySelector('.build')! as HTMLButtonElement;
    this.upgradeList = this.el.querySelector('.upgrade-list')! as HTMLDivElement;

    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      const hive = this.game.state.hives.find((h) => h.type === this.type);
      if (hive && !hive.built) {
        this.game.buildHive(this.type);
      } else {
        this.game.buyBee(this.type);
      }
    });
    this.el.addEventListener('click', (e) => e.stopPropagation());

    // Build the upgrade rows once. Visibility / state updates each frame.
    for (const def of upgradesForRole(this.type)) {
      const row = document.createElement('div');
      row.className = 'upgrade-row';
      row.innerHTML = `
        <div class="up-info">
          <div class="up-name"></div>
          <div class="up-blurb"></div>
        </div>
        <div class="up-action">
          <div class="up-tier"></div>
          <button class="up-btn" type="button"></button>
        </div>
      `;
      (row.querySelector('.up-name') as HTMLDivElement).textContent = def.name;
      (row.querySelector('.up-blurb') as HTMLDivElement).textContent = def.blurb;
      const btn = row.querySelector('.up-btn') as HTMLButtonElement;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.buyUpgrade(def.id);
      });
      this.upgradeList.appendChild(row);
      this.upgradeRows.set(def.id, {
        row,
        tierEl: row.querySelector('.up-tier') as HTMLSpanElement,
        costEl: btn,
        button: btn,
      });
    }
  }

  reposition(screenX: number, screenY: number): void {
    this.el.style.left = `${screenX}px`;
    this.el.style.top = `${screenY}px`;
  }

  update(): void {
    const hive =
      this.type === 'forager'
        ? getForagerHive(this.game.state)
        : this.type === 'wax'
          ? getWaxHive(this.game.state)
          : getBuilderHive(this.game.state);

    const visible = this.game.selectedId === this.hiveId;
    this.el.classList.toggle('hidden', !visible);

    if (!hive.built) {
      const bc = buildCost(this.type)!;
      const buildLabel =
        this.type === 'wax' ? 'Build Wax Hive' : 'Build Builder Hive';
      this.titleEl.textContent =
        this.type === 'wax' ? 'Wax Hive' : 'Builder Hive';
      this.headerCount.textContent = '–';
      this.costEl.textContent = `${bc.amount} ${bc.currency}`;
      this.button.textContent = buildLabel;
      const have =
        bc.currency === 'pollen'
          ? totalPollen(this.game.state)
          : spendableWax(this.game.state);
      this.button.disabled = have < bc.amount;
      // Hide upgrades for unbuilt hives.
      this.upgradeList.style.display = 'none';
    } else {
      const cost = nextBeeCost(this.game.state, this.type);
      const currency = costCurrency(this.type);
      const title =
        this.type === 'forager'
          ? 'Forager Bees'
          : this.type === 'wax'
            ? 'Wax-maker Bees'
            : 'Builder Bees';
      const buttonLabel =
        this.type === 'forager'
          ? 'Hire forager'
          : this.type === 'wax'
            ? 'Hire wax-maker'
            : 'Hire builder';
      this.titleEl.textContent = title;
      this.headerCount.textContent = hive.bees.toString();
      this.costEl.textContent = cost === 0 ? 'FREE' : `${cost} ${currency}`;
      this.button.textContent = buttonLabel;
      const have =
        currency === 'pollen'
          ? totalPollen(this.game.state)
          : spendableWax(this.game.state);
      this.button.disabled = cost > 0 && have < cost;
      this.upgradeList.style.display = '';

      // Update each upgrade row.
      for (const def of upgradesForRole(this.type)) {
        const row = this.upgradeRows.get(def.id)!;
        const tier = getUpgradeTier(this.game.state, def.id);
        const unlocked = isUpgradeUnlocked(this.game.state, def.id);
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
          const upgradeCost = nextUpgradeCost(this.game.state, def.id);
          const def2 = UPGRADE_DEFS[def.id];
          const haveU =
            def2.currency === 'pollen'
              ? totalPollen(this.game.state)
              : spendableWax(this.game.state);
          row.button.textContent = `${upgradeCost} ${def2.currency}`;
          row.button.disabled = haveU < upgradeCost;
        }
      }
    }
  }

  get anchor(): { worldX: number; worldY: number } {
    return { worldX: this.worldX, worldY: this.worldY };
  }
}
