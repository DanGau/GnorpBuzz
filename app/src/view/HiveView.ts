import { Container, Graphics, Text } from 'pixi.js';
import type { World } from '../world/World';
import type { GameState, HiveCell } from '../sim/state';
import { buyableCells, cellCost, cellSynergy, hexDistance, totalWax, TUNING } from '../sim/state';
import { WORLD, hexToWorld } from '../world/layout';

// Renders the Hive as a honeycomb of hex cells. Each cell is one of:
//   empty    — unlocked, no worker
//   forager  — holds a forager worker (gold)
//   buyable  — locked frontier cell, can be unlocked
// The selected cell gets a bright halo. Buyable cells pulse invitingly.
//
// Hit-testing is two-tier: when the camera is zoomed out, a single
// whole-hive hit area catches clicks (→ zoom into the hive); when zoomed
// in, the per-cell hit areas are live so the player can pick cells.

type CellKind =
  | 'empty'
  | 'forager'
  | 'honey-worker'
  | 'wax-worker'
  | 'cantor'
  | 'buyable';

type FilledKind = Exclude<CellKind, 'empty' | 'buyable'>;

interface CellSprite {
  key: string;
  q: number;
  r: number;
  kind: CellKind;
  synergy: number;
  base: Graphics;
  hit: Graphics;
  glyph: Text | null;
  // Price label for buyable cells (e.g. "12🕯"). Lazily created.
  priceLabel: Text | null;
  // Visual cost cached so we only redraw when the displayed value or
  // affordability actually changes.
  shownCost: number;
  shownAffordable: boolean;
  hovered: boolean;
}

// Match the radial menu's worker glyphs so the shop icon and the cell icon
// read as the same thing.
const ROLE_GLYPH: Record<FilledKind, string> = {
  forager: '🌼',
  'honey-worker': '🍯',
  'wax-worker': '🕯',
  cantor: '✦',
};
const GLYPH_SUPERSAMPLE = 6;

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

const CELL_COLORS: Record<FilledKind, number> = {
  forager: 0xe8b04c,
  // Honey workers tint warm-amber, wax workers pale cream — so a glance at
  // the comb shows the honey-vs-wax mix without reading any text.
  'honey-worker': 0xe89638,
  'wax-worker': 0xe8d8a4,
  cantor: 0x9a7adf,
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
  private onBuyCell: (q: number, r: number) => void;
  private pulse = 0;
  // Backdrop is redrawn only when the comb's outermost ring changes.
  private combRadius = -1;

  constructor(
    onCellClick: (q: number, r: number) => void,
    onHiveClick: () => void,
    onBuyCell: (q: number, r: number) => void,
  ) {
    this.container = new Container();
    this.onCellClick = onCellClick;
    this.onHiveClick = onHiveClick;
    this.onBuyCell = onBuyCell;

    this.backdrop = new Graphics();
    this.container.addChild(this.backdrop);

    this.overviewFill = new Graphics();
    this.container.addChild(this.overviewFill);

    this.hiveHit = new Graphics();
    this.hiveHit.eventMode = 'static';
    this.hiveHit.on('pointertap', (e) => {
      e.stopPropagation();
      // Zoomed out: zooms into the hive. Zoomed in: fires onHiveClick which
      // demotes any cell selection to whole-hive (closes the radial menu)
      // — Game.select('hive') no-ops when already on hive with no cell.
      this.onHiveClick();
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
        if (sprite.glyph) {
          this.container.removeChild(sprite.glyph);
          sprite.glyph.destroy();
        }
        if (sprite.priceLabel) {
          this.container.removeChild(sprite.priceLabel);
          sprite.priceLabel.destroy();
        }
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
        const spriteRef: { current: CellSprite | null } = { current: null };
        hit.on('pointertap', (e) => {
          e.stopPropagation();
          // Buyable cells purchase on a single click — no detour through
          // the radial menu. Everything else still routes through the
          // normal cell selection.
          if (spriteRef.current?.kind === 'buyable') {
            this.onBuyCell(q, r);
          } else {
            this.onCellClick(q, r);
          }
        });
        hit.on('pointerover', () => {
          if (spriteRef.current) spriteRef.current.hovered = true;
        });
        hit.on('pointerout', () => {
          if (spriteRef.current) spriteRef.current.hovered = false;
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
          glyph: null,
          priceLabel: null,
          shownCost: -1,
          shownAffordable: false,
          hovered: false,
        };
        spriteRef.current = sprite;
        this.sprites.set(key, sprite);
      }

      // Per-cell hits and visuals are only live when zoomed into the hive;
      // the overview shows the generic honeycomb fill instead.
      sprite.hit.eventMode = cellsInteractive ? 'static' : 'none';
      sprite.base.visible = cellsInteractive;
      if (sprite.glyph) sprite.glyph.visible = cellsInteractive;

      const synergy =
        want.kind !== 'empty' && want.kind !== 'buyable'
          ? cellSynergy(state.hive, want.q, want.r)
          : 0;
      if (sprite.kind !== want.kind || sprite.synergy !== synergy) {
        sprite.kind = want.kind;
        sprite.synergy = synergy;
        this.drawCell(sprite);
      }

      // Buyable cells get an always-visible price label (when zoomed in),
      // tinted by affordability and re-rendered when the displayed value
      // changes. Hover brightens the cell; that's handled in drawCell on
      // every frame for buyables (the breath animation already redraws).
      if (sprite.kind === 'buyable') {
        const cost = cellCost(sprite.q, sprite.r);
        const affordable = totalWax(state) >= cost;
        if (sprite.shownCost !== cost || sprite.shownAffordable !== affordable) {
          sprite.shownCost = cost;
          sprite.shownAffordable = affordable;
          this.ensurePriceLabel(sprite, cost, affordable);
        }
        if (sprite.priceLabel) sprite.priceLabel.visible = cellsInteractive;
        // Buyables are animated (pulse + hover), so redraw each frame.
        this.drawCell(sprite);
      } else if (sprite.priceLabel) {
        this.removePriceLabel(sprite);
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

    if (sprite.kind === 'buyable' || sprite.kind === 'empty') {
      this.removeGlyphIfAny(sprite);
    }

    if (sprite.kind === 'buyable') {
      // Faint outline + a pulsing "+" to invite expansion. Hover brightens
      // the whole cell so the player sees the click target clearly; an
      // unaffordable buyable still pulses but dimmer and in a cooler tint.
      const affordable = sprite.shownAffordable;
      const breath = 0.45 + Math.sin(this.pulse * 3) * 0.18;
      const hoverBoost = sprite.hovered ? 0.35 : 0;
      const tint = affordable ? 0xf5d166 : 0x6e5a32;
      const fillAlpha = sprite.hovered ? 0.18 : 0.05;
      g.poly(outer).fill({ color: 0xf0e9d2, alpha: fillAlpha });
      g.poly(outer).stroke({
        color: tint,
        width: HEX * (sprite.hovered ? 0.085 : 0.058),
        alpha: Math.min(1, breath + hoverBoost),
      });
      const plusAlpha = Math.min(1, breath + 0.2 + hoverBoost);
      g.rect(-HEX * 0.192, -HEX * 0.054, HEX * 0.385, HEX * 0.108)
        .fill({ color: tint, alpha: plusAlpha });
      g.rect(-HEX * 0.054, -HEX * 0.192, HEX * 0.108, HEX * 0.385)
        .fill({ color: tint, alpha: plusAlpha });
      return;
    }

    if (sprite.kind === 'empty') {
      g.poly(outer).fill({ color: 0x2a2012, alpha: 0.85 });
      g.poly(inner).fill({ color: 0x1c160c, alpha: 0.9 });
      g.poly(outer).stroke({ color: 0x6e5a32, width: strokeMain });
      return;
    }

    // Filled cell — forager, honey-worker, wax-worker, or cantor. The glyph
    // (flower / honeypot / candle / spark) matches the shop's option so the
    // cell icon and the radial bubble read as the same thing.
    const filledKind = sprite.kind as FilledKind;
    const color = CELL_COLORS[filledKind];
    g.poly(outer).fill(0x2a2012);
    g.poly(outer).stroke({ color: 0x1a1408, width: strokeMain });
    g.poly(inner).fill(color);
    g.poly(hexPoints(HEX * 0.654)).fill({ color: 0xffffff, alpha: 0.12 });

    this.ensureGlyph(sprite, ROLE_GLYPH[filledKind]);

    // Synergy pips around the rim — one per same-role neighbor.
    for (let i = 0; i < sprite.synergy; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      g.circle(Math.cos(a) * HEX * 0.731, Math.sin(a) * HEX * 0.731, HEX * 0.077)
        .fill(0xfff2cf);
    }
  }

  // Lazily attach a Text glyph to the cell sprite — rasterized at SUPERSAMPLE×
  // the world-unit font size and scaled down, so it stays crisp under the
  // hive camera's zoom. Glyph follows the sprite position.
  private ensureGlyph(sprite: CellSprite, glyphChar: string): void {
    if (!sprite.glyph) {
      const t = new Text({
        text: glyphChar,
        style: {
          fontFamily: 'system-ui, sans-serif',
          fontSize: HEX * 0.85 * GLYPH_SUPERSAMPLE,
          fontWeight: '700',
          fill: 0x1a1408,
          align: 'center',
        },
      });
      t.anchor.set(0.5);
      t.scale.set(1 / GLYPH_SUPERSAMPLE);
      t.x = sprite.base.x;
      t.y = sprite.base.y;
      this.container.addChild(t);
      sprite.glyph = t;
    } else if (sprite.glyph.text !== glyphChar) {
      sprite.glyph.text = glyphChar;
    }
  }

  // Price label for a buyable cell — supersampled like the role glyph so
  // it stays crisp at zoom. Sits just below the pulsing "+".
  private ensurePriceLabel(sprite: CellSprite, cost: number, affordable: boolean): void {
    const text = cost === 0 ? 'FREE' : `${cost}🕯`;
    const fill = affordable ? 0xfff2cf : 0x8a7a4a;
    if (!sprite.priceLabel) {
      const t = new Text({
        text,
        style: {
          fontFamily: 'system-ui, sans-serif',
          fontSize: HEX * 0.32 * GLYPH_SUPERSAMPLE,
          fontWeight: '700',
          fill,
          align: 'center',
        },
      });
      t.anchor.set(0.5);
      t.scale.set(1 / GLYPH_SUPERSAMPLE);
      t.x = sprite.base.x;
      t.y = sprite.base.y + HEX * 0.5;
      this.container.addChild(t);
      sprite.priceLabel = t;
    } else {
      sprite.priceLabel.text = text;
      sprite.priceLabel.style.fill = fill;
    }
  }

  private removePriceLabel(sprite: CellSprite): void {
    if (!sprite.priceLabel) return;
    this.container.removeChild(sprite.priceLabel);
    sprite.priceLabel.destroy();
    sprite.priceLabel = null;
  }

  private removeGlyphIfAny(sprite: CellSprite): void {
    if (!sprite.glyph) return;
    this.container.removeChild(sprite.glyph);
    sprite.glyph.destroy();
    sprite.glyph = null;
  }

}

function kindOf(cell: HiveCell): CellKind {
  if (cell.role === 'forager') return 'forager';
  if (cell.role === 'honey-worker') return 'honey-worker';
  if (cell.role === 'wax-worker') return 'wax-worker';
  if (cell.role === 'cantor') return 'cantor';
  return 'empty';
}
