import { Container, Graphics } from 'pixi.js';
import type { World } from '../world/World';
import type { GameState, HiveCell } from '../sim/state';
import { buyableCells, cellSynergy, hexDistance, TUNING } from '../sim/state';
import { WORLD, hexToWorld } from '../world/layout';

// Renders the Hive as a honeycomb of hex cells. Each cell is one of:
//   empty    — unlocked, no worker
//   forager  — holds a forager worker (gold)
//   excavator— holds an excavator worker (red stone)
//   buyable  — locked frontier cell, can be unlocked
// The selected cell gets a bright halo. Buyable cells pulse invitingly.
//
// Hit-testing is two-tier: when the camera is zoomed out, a single
// whole-hive hit area catches clicks (→ zoom into the hive); when zoomed
// in, the per-cell hit areas are live so the player can pick cells.

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

// A hexagon outline at an absolute position. `flatTop` rotates it so a flat
// edge faces up — the orientation of the macro-comb formed by pointy-top
// cells, used for the hive shell so it frames the comb uniformly.
function hexOutline(size: number, cx: number, cy: number, flatTop: boolean): number[] {
  const pts: number[] = [];
  const base = flatTop ? 0 : -30;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i + base);
    pts.push(cx + Math.cos(a) * size, cy + Math.sin(a) * size);
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
  // Generic honeycomb fill shown in the zoomed-out overview, in place of
  // the interactive cell grid — a solid comb with an entrance hole.
  private overviewFill: Graphics;
  // Single hit region covering the whole hive shell — active when zoomed
  // out, where individual cells are too small to click.
  private hiveHit: Graphics;
  private sprites: Map<string, CellSprite>;
  // The selection halo lives on its own Graphics, kept as the topmost child
  // so it always draws above neighboring cells.
  private selectionGfx: Graphics;
  private onCellClick: (q: number, r: number) => void;
  private onHiveClick: () => void;
  private pulse = 0;
  // Backdrop is redrawn only when the comb's outermost ring changes.
  private combRadius = -1;
  // True when the camera is zoomed into the hive — per-cell clicking is on.
  private cellsInteractive = false;

  constructor(
    onCellClick: (q: number, r: number) => void,
    onHiveClick: () => void,
  ) {
    this.container = new Container();
    this.onCellClick = onCellClick;
    this.onHiveClick = onHiveClick;

    this.backdrop = new Graphics();
    this.container.addChild(this.backdrop);

    this.overviewFill = new Graphics();
    this.container.addChild(this.overviewFill);

    this.hiveHit = new Graphics();
    this.hiveHit.eventMode = 'static';
    this.hiveHit.on('pointertap', (e) => {
      e.stopPropagation();
      // Zoomed out: clicking anywhere on the hive zooms in. Zoomed in: this
      // just absorbs clicks on the shell gaps so they don't deselect.
      if (!this.cellsInteractive) this.onHiveClick();
    });
    this.container.addChild(this.hiveHit);

    this.selectionGfx = new Graphics();
    this.container.addChild(this.selectionGfx);

    this.sprites = new Map();
  }

  update(
    state: GameState,
    _world: World,
    selectedCell: { q: number; r: number } | null,
    cellsInteractive: boolean,
    dtMs: number,
  ): void {
    this.pulse += dtMs / 1000;
    this.cellsInteractive = cellsInteractive;
    this.hiveHit.cursor = cellsInteractive ? 'default' : 'pointer';
    // Overview shows a solid honeycomb; the interactive cell grid only
    // appears once the camera has zoomed in.
    this.overviewFill.visible = !cellsInteractive;

    // Redraw the hive shell when the comb's outermost ring changes. The
    // shell extends one ring past the unlocked comb (capped at the comb's
    // max radius) so the buyable frontier cells sit inside the husk.
    let maxRing = 1;
    for (const c of state.hive.cells) {
      maxRing = Math.max(maxRing, hexDistance(c.q, c.r));
    }
    const shellRing = Math.min(maxRing + 1, TUNING.MAX_COMB_RADIUS);
    if (shellRing !== this.combRadius) {
      this.combRadius = shellRing;
      this.drawBackdrop(shellRing);
    }

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

      // Per-cell hits and visuals are only live when zoomed into the hive;
      // the overview shows the generic honeycomb fill instead.
      sprite.hit.eventMode = cellsInteractive ? 'static' : 'none';
      sprite.base.visible = cellsInteractive;

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
    g.poly(hexPoints(HEX * 1.077 * breath).map((v, i) => v + (i % 2 === 0 ? pos.x : pos.y)))
      .stroke({ color: 0xfff2cf, width: HEX * 0.115, alpha: 0.95 });
  }

  // The hive shell behind the comb — a waxy hexagonal husk with a peaked
  // roof, sized to frame the current comb so the grid reads as living
  // inside a beehive rather than floating in space. Also resizes the
  // whole-hive hit area to match.
  private drawBackdrop(radius: number): void {
    const g = this.backdrop;
    g.clear();
    const { x, y } = WORLD.HIVE;
    // World-space reach of the comb, plus a rim so the shell frames it.
    const reach = HEX * Math.sqrt(3) * radius;
    const shell = reach + HEX * 1.9;

    // A flat-top hexagon's top/bottom flat edges sit at ±sin(60°)·shell.
    const edgeY = shell * 0.866;

    // Ground shadow.
    g.ellipse(x, y + edgeY + HEX * 0.5, shell * 1.0, shell * 0.18)
      .fill({ color: 0x000000, alpha: 0.3 });

    // Peaked roof cap sitting flush on the top edge.
    g.poly([
      x - shell * 0.5, y - edgeY + HEX * 0.3,
      x, y - edgeY - HEX * 1.1,
      x + shell * 0.5, y - edgeY + HEX * 0.3,
    ])
      .fill(0x6e4a22)
      .stroke({ color: 0x3a2510, width: HEX * 0.08 });

    // Hive shell — a flat-top hexagon (the comb's macro outline) with a
    // dark husk rim and a warm wax body.
    g.poly(hexOutline(shell, x, y, true)).fill(0x241708);
    g.poly(hexOutline(shell - HEX * 0.5, x, y, true))
      .fill(0xb9863c)
      .stroke({ color: 0xd4a857, width: HEX * 0.08, alpha: 0.55 });

    // Whole-hive hit area — matches the shell footprint.
    this.hiveHit.clear();
    this.hiveHit
      .poly(hexOutline(shell, x, y, true))
      .fill({ color: 0xffffff, alpha: 0.001 });

    // Generic honeycomb fill for the zoomed-out overview — a uniform comb
    // tiling the whole shell, with a dark entrance hole near the bottom.
    const of = this.overviewFill;
    of.clear();
    const cellStroke = Math.max(0.5, HEX * 0.12);
    for (let q = -radius; q <= radius; q++) {
      for (let r = -radius; r <= radius; r++) {
        if (hexDistance(q, r) > radius) continue;
        const p = hexToWorld(q, r);
        const hp = hexPoints(HEX * 0.86).map((v, i) => v + (i % 2 === 0 ? p.x : p.y));
        of.poly(hp).fill(0xc89a4e);
        of.poly(hp).stroke({ color: 0x8a6326, width: cellStroke });
      }
    }
    // Entrance hole the bees come and go through.
    of.ellipse(x, y + edgeY - HEX * 1.7, HEX * 1.6, HEX * 1.15).fill(0x1c1206);
    of.ellipse(x, y + edgeY - HEX * 2.0, HEX * 1.6, HEX * 0.5).fill(0x120b03);
  }

  private drawCell(sprite: CellSprite): void {
    // Cell visuals were originally tuned at HEX_SIZE=26; all sizes here
    // are expressed as fractions of HEX so they scale identically when
    // the comb is rendered at any size or camera zoom.
    const g = sprite.base;
    g.clear();
    const outer = hexPoints(HEX * 0.942);
    const inner = hexPoints(HEX * 0.808);
    const strokeMain = HEX * 0.077;

    if (sprite.kind === 'buyable') {
      // Faint outline + a pulsing "+" to invite expansion.
      const breath = 0.45 + Math.sin(this.pulse * 3) * 0.18;
      g.poly(outer).fill({ color: 0xf0e9d2, alpha: 0.05 });
      g.poly(outer).stroke({ color: 0xf5d166, width: HEX * 0.058, alpha: breath });
      g.rect(-HEX * 0.192, -HEX * 0.054, HEX * 0.385, HEX * 0.108)
        .fill({ color: 0xf5d166, alpha: breath + 0.2 });
      g.rect(-HEX * 0.054, -HEX * 0.192, HEX * 0.108, HEX * 0.385)
        .fill({ color: 0xf5d166, alpha: breath + 0.2 });
      return;
    }

    if (sprite.kind === 'empty') {
      g.poly(outer).fill({ color: 0x2a2012, alpha: 0.85 });
      g.poly(inner).fill({ color: 0x1c160c, alpha: 0.9 });
      g.poly(outer).stroke({ color: 0x6e5a32, width: strokeMain });
      return;
    }

    // Worker cell — forager or excavator.
    const color = CELL_COLORS[sprite.kind];
    g.poly(outer).fill(0x2a2012);
    g.poly(outer).stroke({ color: 0x1a1408, width: strokeMain });
    g.poly(inner).fill(color);
    g.poly(hexPoints(HEX * 0.654)).fill({ color: 0xffffff, alpha: 0.12 });

    // Worker dot — a stylized bee body.
    g.ellipse(0, 0, HEX * 0.231, HEX * 0.154)
      .fill(sprite.kind === 'forager' ? 0xffd23f : 0x8a2a14);
    g.rect(-HEX * 0.115, -HEX * 0.077, HEX * 0.062, HEX * 0.154).fill(0x1a1408);
    g.rect(HEX * 0.046, -HEX * 0.077, HEX * 0.062, HEX * 0.154).fill(0x1a1408);

    // Synergy pips around the rim — one per same-role neighbor.
    for (let i = 0; i < sprite.synergy; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      g.circle(Math.cos(a) * HEX * 0.731, Math.sin(a) * HEX * 0.731, HEX * 0.077)
        .fill(0xfff2cf);
    }
  }
}

function kindOf(cell: HiveCell): CellKind {
  if (cell.role === 'forager') return 'forager';
  if (cell.role === 'excavator') return 'excavator';
  return 'empty';
}
