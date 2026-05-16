import { Container, Graphics } from 'pixi.js';
import type { CellRole, GameState } from '../sim/state';
import {
  cellAt,
  isCellBuyable,
  mustPlaceForager,
  cellCost,
  nextWorkerCost,
  totalPollen,
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

// Target alpha for the screen-dim overlay when the menu is open.
const OVERLAY_ALPHA = 0.55;
// World-space extent for the dim rect — large enough to cover the camera
// at any zoom level. The camera transform scales this with everything else.
const OVERLAY_EXTENT = 6000;

export class CellRadialView {
  readonly container: Container;
  private menu: RadialMenu;
  private overlay: Graphics;
  // Animated alpha that lerps toward `targetOverlayAlpha`.
  private overlayAlpha = 0;
  private targetOverlayAlpha = 0;

  constructor(private callbacks: CellRadialCallbacks) {
    this.container = new Container();

    // Screen-dim overlay sits behind the menu, ABOVE everything else in
    // the world. eventMode='none' so cell/background clicks pass through —
    // it's a purely visual "focus" cue.
    this.overlay = new Graphics();
    this.overlay
      .rect(-OVERLAY_EXTENT, -OVERLAY_EXTENT, OVERLAY_EXTENT * 2, OVERLAY_EXTENT * 2)
      .fill({ color: 0x000000, alpha: 1 });
    this.overlay.eventMode = 'none';
    this.overlay.alpha = 0;
    this.overlay.visible = false;

    this.menu = new RadialMenu({
      hexSize: WORLD.HEX_SIZE,
      spreadDeg: 100,
      radiusFactor: 3.0,
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

    // Frame-rate independent exponential ease toward the overlay's target.
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
      const affordable = totalPollen(state) >= cost;
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
    const have = totalPollen(state);
    const fCost = nextWorkerCost(state, 'forager');
    const xCost = nextWorkerCost(state, 'excavator');
    const opts: RadialOption[] = [
      {
        id: 'forager',
        title: 'Forager',
        detail: costLabel(fCost),
        glyph: '🌼',
        color: 0xe8b04c,
        enabled: fCost === 0 || have >= fCost,
        onSelect: () => cb.onAssignCell(q, r, 'forager'),
      },
    ];
    if (!firstOnly) {
      opts.push({
        id: 'excavator',
        title: 'Excavator',
        detail: costLabel(xCost),
        glyph: '⛏',
        color: 0xc94a2a,
        enabled: xCost === 0 || have >= xCost,
        onSelect: () => cb.onAssignCell(q, r, 'excavator'),
      });
    }
    return opts;
  }

  // Filled cell — no actions; cell visuals already convey role + synergy.
  return [];
}

// Outward direction = from comb center to the selected cell. For the very
// center cell (degenerate), fall back to "up" so the menu fans skyward.
function outwardDirection(
  q: number,
  r: number,
  pos: { x: number; y: number },
): { x: number; y: number } {
  if (q === 0 && r === 0) return { x: 0, y: -1 };
  return { x: pos.x - WORLD.HIVE.x, y: pos.y - WORLD.HIVE.y };
}

function costLabel(cost: number): string {
  return cost === 0 ? 'FREE' : `${cost}🌼`;
}
