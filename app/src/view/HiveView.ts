import { Container, Graphics } from 'pixi.js';
import type { World } from '../world/World';
import type { GameState, HiveCell } from '../sim/state';
import { buyableCells, cellSynergy } from '../sim/state';
import { WORLD, hexToWorld } from '../world/layout';

// Renders the Hive as a honeycomb of hex cells. Each cell is one of:
//   empty    — unlocked, no worker
//   forager  — holds a forager worker (gold)
//   excavator— holds an excavator worker (red stone)
//   buyable  — locked frontier cell, can be unlocked
// The selected cell gets a bright halo. Buyable cells pulse invitingly.

type CellKind = 'empty' | 'forager' | 'excavator' | 'buyable';

interface CellSprite {
  key: string;
  q: number;
  r: number;
  kind: CellKind;
  synergy: number;
  base: Graphics;
  hit: Graphics;
}

const HEX = WORLD.HEX_SIZE;

function hexPoints(size: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(Math.cos(a) * size, Math.sin(a) * size);
  }
  return pts;
}

const CELL_COLORS: Record<'forager' | 'excavator', number> = {
  forager: 0xe8b04c,
  excavator: 0xc94a2a,
};

export class HiveView {
  readonly container: Container;
  private backdrop: Graphics;
  private sprites: Map<string, CellSprite>;
  // The selection halo lives on its own Graphics, kept as the topmost child
  // so it always draws above neighboring cells (the halo extends past the
  // selected hex and would otherwise be occluded by later-added cells).
  private selectionGfx: Graphics;
  private onCellClick: (q: number, r: number) => void;
  private pulse = 0;

  constructor(onCellClick: (q: number, r: number) => void) {
    this.container = new Container();
    this.backdrop = new Graphics();
    this.container.addChild(this.backdrop);
    this.selectionGfx = new Graphics();
    this.container.addChild(this.selectionGfx);
    this.sprites = new Map();
    this.onCellClick = onCellClick;
    this.drawBackdrop();
  }

  update(
    state: GameState,
    _world: World,
    selectedCell: { q: number; r: number } | null,
    dtMs: number,
  ): void {
    this.pulse += dtMs / 1000;

    // Build the desired set of cells: every sim cell, plus the buyable
    // frontier.
    const desired = new Map<string, { q: number; r: number; kind: CellKind }>();
    for (const c of state.hive.cells) {
      desired.set(`${c.q},${c.r}`, { q: c.q, r: c.r, kind: kindOf(c) });
    }
    for (const b of buyableCells(state.hive)) {
      const key = `${b.q},${b.r}`;
      if (!desired.has(key)) desired.set(key, { q: b.q, r: b.r, kind: 'buyable' });
    }

    // Drop sprites no longer desired.
    for (const [key, sprite] of this.sprites) {
      if (!desired.has(key)) {
        this.container.removeChild(sprite.base, sprite.hit);
        sprite.base.destroy();
        sprite.hit.destroy();
        this.sprites.delete(key);
      }
    }

    // Create / update sprites.
    for (const [key, want] of desired) {
      let sprite = this.sprites.get(key);
      if (!sprite) {
        const pos = hexToWorld(want.q, want.r);
        const base = new Graphics();
        const hit = new Graphics();
        for (const g of [base, hit]) {
          g.x = pos.x;
          g.y = pos.y;
          this.container.addChild(g);
        }
        hit.eventMode = 'static';
        hit.cursor = 'pointer';
        const q = want.q;
        const r = want.r;
        hit.on('pointertap', (e) => {
          e.stopPropagation();
          this.onCellClick(q, r);
        });
        hit.poly(hexPoints(HEX)).fill({ color: 0xffffff, alpha: 0.001 });
        sprite = {
          key,
          q: want.q,
          r: want.r,
          kind: want.kind,
          synergy: -1,
          base,
          hit,
        };
        this.sprites.set(key, sprite);
      }

      const synergy =
        want.kind === 'forager' || want.kind === 'excavator'
          ? cellSynergy(state.hive, want.q, want.r)
          : 0;
      if (sprite.kind !== want.kind || sprite.synergy !== synergy) {
        sprite.kind = want.kind;
        sprite.synergy = synergy;
        this.drawCell(sprite);
      }
    }

    this.drawSelection(selectedCell);
  }

  // Draw the selection halo on its own always-on-top layer.
  private drawSelection(selectedCell: { q: number; r: number } | null): void {
    const g = this.selectionGfx;
    g.clear();
    // Re-add to move it back to the top — cell sprites created this frame
    // were appended after it.
    this.container.addChild(g);
    if (!selectedCell) return;
    const pos = hexToWorld(selectedCell.q, selectedCell.r);
    const breath = 1 + Math.sin(this.pulse * 4) * 0.04;
    g.poly(hexPoints((HEX + 2) * breath).map((v, i) => v + (i % 2 === 0 ? pos.x : pos.y)))
      .stroke({ color: 0xfff2cf, width: 3, alpha: 0.95 });
  }

  private drawBackdrop(): void {
    // A soft earthy mound the comb nestles into, plus a ground shadow.
    const g = this.backdrop;
    g.clear();
    const { x, y } = WORLD.HIVE;
    g.ellipse(x, y + HEX * 2.6, HEX * 5.4, HEX * 1.5).fill({ color: 0x000000, alpha: 0.22 });
    g.ellipse(x, y + HEX * 1.4, HEX * 4.6, HEX * 2.8).fill({ color: 0x3a2a16, alpha: 0.55 });
  }

  private drawCell(sprite: CellSprite): void {
    const g = sprite.base;
    g.clear();
    const outer = hexPoints(HEX - 1.5);
    const inner = hexPoints(HEX - 5);

    if (sprite.kind === 'buyable') {
      // Faint dashed-feel outline + a pulsing "+" to invite expansion.
      const breath = 0.45 + Math.sin(this.pulse * 3) * 0.18;
      g.poly(outer).fill({ color: 0xf0e9d2, alpha: 0.05 });
      g.poly(outer).stroke({ color: 0xf5d166, width: 1.5, alpha: breath });
      g.rect(-5, -1.4, 10, 2.8).fill({ color: 0xf5d166, alpha: breath + 0.2 });
      g.rect(-1.4, -5, 2.8, 10).fill({ color: 0xf5d166, alpha: breath + 0.2 });
      return;
    }

    if (sprite.kind === 'empty') {
      g.poly(outer).fill({ color: 0x2a2012, alpha: 0.85 });
      g.poly(inner).fill({ color: 0x1c160c, alpha: 0.9 });
      g.poly(outer).stroke({ color: 0x6e5a32, width: 2 });
    } else {
      const color = CELL_COLORS[sprite.kind];
      g.poly(outer).fill(0x2a2012);
      g.poly(outer).stroke({ color: 0x1a1408, width: 2 });
      g.poly(inner).fill(color);
      // Inner highlight band.
      g.poly(hexPoints(HEX - 9)).fill({ color: 0xffffff, alpha: 0.12 });

      // Worker dot — a stylized bee body.
      g.ellipse(0, 0, 6, 4).fill(sprite.kind === 'forager' ? 0xffd23f : 0x8a2a14);
      g.rect(-3, -2, 1.6, 4).fill(0x1a1408);
      g.rect(1.2, -2, 1.6, 4).fill(0x1a1408);
      // Synergy pips around the rim — one per same-role neighbor.
      for (let i = 0; i < sprite.synergy; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        g.circle(Math.cos(a) * (HEX - 7), Math.sin(a) * (HEX - 7), 2).fill(0xfff2cf);
      }
    }
  }
}

function kindOf(cell: HiveCell): CellKind {
  if (cell.role === 'forager') return 'forager';
  if (cell.role === 'excavator') return 'excavator';
  return 'empty';
}
