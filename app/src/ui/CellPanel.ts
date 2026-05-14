import type { Game } from '../game/Game';
import {
  cellAt,
  cellSynergy,
  isCellBuyable,
  mustPlaceForager,
  cellCost,
  nextWorkerCost,
  totalPollen,
  TUNING,
} from '../sim/state';
import { hexToWorld } from '../world/layout';

// World-anchored popover for the currently selected hex cell. Its contents
// depend on the cell's state: a locked frontier cell can be unlocked, an
// empty cell can be assigned a role. Filled cells are permanent — they only
// show their role and synergy, with no clear or reassign action.
//
// update() runs every frame. The DOM structure is only rebuilt when the
// cell's "shape" changes (its coordinate or mode) — rebuilding innerHTML
// every frame would thrash the buttons and swallow clicks. Costs and
// affordability are refreshed live against the cached element refs.

export class CellPanel {
  readonly el: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private bodyEl: HTMLDivElement;
  private sig = '';
  private liveUpdate: (() => void) | null = null;

  constructor(private game: Game) {
    this.el = document.createElement('div');
    this.el.className = 'cell-panel panel hidden';
    this.el.innerHTML = `
      <div class="cp-title"></div>
      <div class="cp-body"></div>
      <div class="caret"></div>
    `;
    this.titleEl = this.el.querySelector('.cp-title') as HTMLDivElement;
    this.bodyEl = this.el.querySelector('.cp-body') as HTMLDivElement;
    this.el.addEventListener('click', (e) => e.stopPropagation());
  }

  update(): void {
    const sel = this.game.selectedCell;
    if (!sel) {
      this.el.classList.add('hidden');
      this.sig = '';
      return;
    }
    this.el.classList.remove('hidden');

    // Anchor above the cell in screen space.
    const world = hexToWorld(sel.q, sel.r);
    const screen = this.game.renderer.worldToScreen(world.x, world.y - 30, this.game.app);
    this.el.style.left = `${screen.x}px`;
    this.el.style.top = `${screen.y}px`;

    const state = this.game.state;
    const cell = cellAt(state.hive, sel.q, sel.r);
    const mode = cell
      ? cell.role ?? 'empty'
      : isCellBuyable(state.hive, sel.q, sel.r)
        ? 'buyable'
        : 'locked';
    const firstOnly = mode === 'empty' && mustPlaceForager(state);
    const sig = `${sel.q},${sel.r}:${mode}${firstOnly ? ':first' : ''}`;

    if (sig !== this.sig) {
      this.sig = sig;
      this.rebuild(sel.q, sel.r, mode, firstOnly);
    }
    if (this.liveUpdate) this.liveUpdate();
  }

  // Build the DOM for the given cell mode once, wiring click handlers and
  // installing a `liveUpdate` closure that refreshes costs/affordability.
  private rebuild(q: number, r: number, mode: string, firstOnly: boolean): void {
    const state = this.game.state;
    this.liveUpdate = null;

    if (mode === 'locked') {
      this.titleEl.textContent = 'Locked Comb Cell';
      this.bodyEl.innerHTML = `<div class="cp-note">Not adjacent to the comb.</div>`;
      return;
    }

    if (mode === 'buyable') {
      this.titleEl.textContent = 'Locked Comb Cell';
      this.bodyEl.innerHTML = `
        <div class="cp-note">Extend the honeycomb with a fresh cell.</div>
        <button class="cp-btn unlock" type="button"></button>
      `;
      const btn = this.bodyEl.querySelector('.unlock') as HTMLButtonElement;
      btn.onclick = (e) => {
        e.stopPropagation();
        this.game.buyCell(q, r);
      };
      this.liveUpdate = () => {
        const cost = cellCost(q, r);
        btn.textContent = `Unlock — ${cost} pollen`;
        btn.disabled = totalPollen(state) < cost;
      };
      return;
    }

    if (mode === 'empty') {
      this.titleEl.textContent = 'Empty Cell';
      if (firstOnly) {
        // The very first worker must be a Forager — only offer that.
        this.bodyEl.innerHTML = `
          <div class="cp-note">Your first worker must be a Forager — the colony needs pollen coming in.</div>
          <div class="cp-actions">
            <button class="cp-btn forager" type="button"></button>
          </div>
        `;
        const fBtn = this.bodyEl.querySelector('.forager') as HTMLButtonElement;
        fBtn.onclick = (e) => {
          e.stopPropagation();
          this.game.assignCell(q, r, 'forager');
        };
        this.liveUpdate = () => {
          fBtn.textContent = `Forager · ${costLabel(nextWorkerCost(state, 'forager'))}`;
          fBtn.disabled = false;
        };
        return;
      }
      this.bodyEl.innerHTML = `
        <div class="cp-note">Assign a worker to this cell. This is permanent.</div>
        <div class="cp-actions">
          <button class="cp-btn forager" type="button"></button>
          <button class="cp-btn excavator" type="button"></button>
        </div>
      `;
      const fBtn = this.bodyEl.querySelector('.forager') as HTMLButtonElement;
      const xBtn = this.bodyEl.querySelector('.excavator') as HTMLButtonElement;
      fBtn.onclick = (e) => {
        e.stopPropagation();
        this.game.assignCell(q, r, 'forager');
      };
      xBtn.onclick = (e) => {
        e.stopPropagation();
        this.game.assignCell(q, r, 'excavator');
      };
      this.liveUpdate = () => {
        const have = totalPollen(state);
        const fCost = nextWorkerCost(state, 'forager');
        const xCost = nextWorkerCost(state, 'excavator');
        fBtn.textContent = `Forager · ${costLabel(fCost)}`;
        xBtn.textContent = `Excavator · ${costLabel(xCost)}`;
        fBtn.disabled = fCost > 0 && have < fCost;
        xBtn.disabled = xCost > 0 && have < xCost;
      };
      return;
    }

    // Filled cell — mode is 'forager' or 'excavator'. Permanent: info only.
    const role = mode as 'forager' | 'excavator';
    const roleName = role === 'forager' ? 'Forager' : 'Excavator';
    this.titleEl.textContent = `${roleName} Cell`;
    this.bodyEl.innerHTML = `<div class="cp-synergy"></div>`;
    const synergyEl = this.bodyEl.querySelector('.cp-synergy') as HTMLDivElement;
    this.liveUpdate = () => {
      const synergy = cellSynergy(state.hive, q, r);
      const bonusPct =
        role === 'forager'
          ? Math.round(TUNING.SYNERGY_FORAGER_SPEED * synergy * 100)
          : Math.round(TUNING.SYNERGY_EXCAVATOR_DAMAGE * synergy * 100);
      const bonusLabel =
        role === 'forager' ? `+${bonusPct}% flight speed` : `+${bonusPct}% strike damage`;
      synergyEl.innerHTML = `${synergy} same-role neighbor${synergy === 1 ? '' : 's'} · <b>${bonusLabel}</b>`;
    };
  }
}

function costLabel(cost: number): string {
  return cost === 0 ? 'FREE' : `${cost}🌼`;
}
