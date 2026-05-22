import { Container, Graphics } from 'pixi.js';
import type { CellRole, GameState } from '../sim/state';
import {
  cellAt,
  isCellBuyable,
  mustPlaceForager,
  cellCost,
  nextWorkerCost,
  totalWax,
} from '../sim/state';
import { hexToWorld, WORLD } from '../world/layout';
import { RadialMenu, type RadialOption } from '../ui/pixi/RadialMenu';

export interface CellRadialCallbacks {
  onBuyCell: (q: number, r: number) => void;
  onAssignCell: (q: number, r: number, role: CellRole) => void;
}

// World-space radial menu for hex cells — a Subnautica-style branching
// selector that fans option bubbles outward from the selected cell along
// the cell's outward normal (cell → comb-center).

const OVERLAY_ALPHA = 0.55;
const OVERLAY_EXTENT = 6000;

export class CellRadialView {
  readonly container: Container;
  private menu: RadialMenu;
  private overlay: Graphics;
  private overlayAlpha = 0;
  private targetOverlayAlpha = 0;

  constructor(private callbacks: CellRadialCallbacks) {
    this.container = new Container();

    this.overlay = new Graphics();
    this.overlay
      .rect(-OVERLAY_EXTENT, -OVERLAY_EXTENT, OVERLAY_EXTENT * 2, OVERLAY_EXTENT * 2)
      .fill({ color: 0x000000, alpha: 1 });
    this.overlay.eventMode = 'none';
    this.overlay.alpha = 0;
    this.overlay.visible = false;

    this.menu = new RadialMenu({
      hexSize: WORLD.HEX_SIZE,
      // Wider spread now that we have 5 worker options — keeps the bubbles
      // from overlapping at the far end of the fan.
      spreadDeg: 140,
      radiusFactor: 3.2,
    });

    this.container.addChild(this.overlay, this.menu.container);
  }

  update(
    state: GameState,
    selectedCell: { q: number; r: number } | null,
    dtMs: number,
  ): void {
    if (!selectedCell) {
      this.menu.hide();
      this.targetOverlayAlpha = 0;
    } else {
      const anchor = hexToWorld(selectedCell.q, selectedCell.r);
      const outward = outwardDirection(selectedCell.q, selectedCell.r, anchor);
      const options = configureMenu(state, selectedCell.q, selectedCell.r, this.callbacks);
      this.menu.show(anchor, outward, options);
      this.targetOverlayAlpha = OVERLAY_ALPHA;
    }

    this.menu.update(dtMs);

    const a = 1 - Math.pow(0.001, dtMs / 1000);
    this.overlayAlpha += (this.targetOverlayAlpha - this.overlayAlpha) * a;
    this.overlay.alpha = this.overlayAlpha;
    this.overlay.visible = this.overlayAlpha > 0.005;
  }
}

function configureMenu(
  state: GameState,
  q: number,
  r: number,
  cb: CellRadialCallbacks,
): RadialOption[] {
  const cell = cellAt(state.hive, q, r);

  if (!cell) {
    if (isCellBuyable(state.hive, q, r)) {
      const cost = cellCost(q, r);
      const affordable = totalWax(state) >= cost;
      return [
        {
          id: 'unlock',
          title: 'Unlock',
          detail: costLabel(cost),
          glyph: '+',
          color: 0xf5d166,
          enabled: affordable,
          onSelect: () => cb.onBuyCell(q, r),
        },
      ];
    }
    return [];
  }

  if (cell.role === null) {
    const firstOnly = mustPlaceForager(state);
    const have = totalWax(state);
    const can = (cost: number): boolean => cost === 0 || have >= cost;

    const fCost = nextWorkerCost(state, 'forager');
    const hCost = nextWorkerCost(state, 'honey-worker');
    const wCost = nextWorkerCost(state, 'wax-worker');
    const cCost = nextWorkerCost(state, 'cantor');

    const opts: RadialOption[] = [
      {
        id: 'forager',
        title: 'Forager',
        detail: costLabel(fCost),
        glyph: '🌼',
        color: 0xe8b04c,
        enabled: can(fCost),
        onSelect: () => cb.onAssignCell(q, r, 'forager'),
      },
    ];
    if (!firstOnly) {
      opts.push({
        id: 'honey-worker',
        title: 'Honey',
        detail: costLabel(hCost),
        glyph: '🍯',
        color: 0xe89638,
        enabled: can(hCost),
        onSelect: () => cb.onAssignCell(q, r, 'honey-worker'),
      });
      opts.push({
        id: 'wax-worker',
        title: 'Wax',
        detail: costLabel(wCost),
        glyph: '🕯',
        color: 0xe8d8a4,
        enabled: can(wCost),
        onSelect: () => cb.onAssignCell(q, r, 'wax-worker'),
      });
      opts.push({
        id: 'cantor',
        title: 'Cantor',
        detail: costLabel(cCost),
        glyph: '✦',
        color: 0x9a7adf,
        enabled: can(cCost),
        onSelect: () => cb.onAssignCell(q, r, 'cantor'),
      });
    }
    return opts;
  }

  // Filled cell — no actions; cell visuals already convey role + synergy.
  return [];
}

function outwardDirection(
  q: number,
  r: number,
  pos: { x: number; y: number },
): { x: number; y: number } {
  if (q === 0 && r === 0) return { x: 0, y: -1 };
  return { x: pos.x - WORLD.HIVE.x, y: pos.y - WORLD.HIVE.y };
}

function costLabel(cost: number): string {
  return cost === 0 ? 'FREE' : `${cost}🕯`;
}
