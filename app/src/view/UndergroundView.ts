import { Container, Graphics, Text } from 'pixi.js';
import type { GameState } from '../sim/state';
import { CHAMBERS, isChamberBuilt, totalPollen, type ChamberSpec } from '../sim/state';
import { UNDERGROUND, WORLD, chamberWorldPosition } from '../world/layout';

// The underground cross-section. Visible only when the camera is zoomed in:
// a soil layer below the meadow line, with chamber sprites (built rooms)
// and plot affordances (undug "Dig here" outlines) at fixed grid positions.
// Click handlers route to the Game's selection model.

const GLYPH_SUPERSAMPLE = 6;

interface ChamberSprite {
  id: string;
  spec: ChamberSpec;
  container: Container;
  body: Graphics;
  // Building-themed animation that runs inside built chambers. Forager Den
  // gets a bobbing flower bloom, Geomancer Hall a swinging pickaxe. Per-
  // chamber visual identity that distinguishes chambers at a glance.
  decoration: Graphics;
  glyph: Text;
  nameLabel: Text;
  costLabel: Text;
  hit: Graphics;
  shownBuilt: boolean | null;
  shownSelected: boolean;
  shownAffordable: boolean;
  shownCost: number;
  hovered: boolean;
}

export interface UndergroundCallbacks {
  // Click a built chamber → open its upgrade panel.
  onChamberClick: (id: string) => void;
  // Click an undug plot → dig immediately (same single-click pattern as
  // buyable comb cells). No radial detour for the purchase action.
  onDigChamber: (id: string) => void;
}

export class UndergroundView {
  readonly container: Container;
  private soil: Graphics;
  private tunnels: Graphics;
  private chamberLayer: Container;
  private sprites: Map<string, ChamberSprite>;
  private callbacks: UndergroundCallbacks;
  private pulse = 0;
  private visibleNow = false;

  constructor(callbacks: UndergroundCallbacks) {
    this.callbacks = callbacks;
    this.container = new Container();
    this.container.visible = false;

    this.soil = new Graphics();
    this.tunnels = new Graphics();
    this.chamberLayer = new Container();
    this.container.addChild(this.soil, this.tunnels, this.chamberLayer);

    this.sprites = new Map();
    this.drawSoil();
    for (const spec of CHAMBERS) this.createChamberSprite(spec);
  }

  update(
    state: GameState,
    selectedChamber: string | null,
    visible: boolean,
    dtMs: number,
  ): void {
    this.pulse += dtMs / 1000;
    this.container.visible = visible;
    this.visibleNow = visible;

    for (const sprite of this.sprites.values()) {
      const built = isChamberBuilt(state, sprite.id);
      const selected = selectedChamber === sprite.id;
      const cost = sprite.spec.digCost;
      const affordable = totalPollen(state) >= cost;
      const needsRedraw =
        sprite.shownBuilt !== built ||
        sprite.shownSelected !== selected ||
        sprite.shownAffordable !== affordable ||
        sprite.shownCost !== cost ||
        !built; // undug chambers pulse, so redraw every frame
      if (needsRedraw) {
        sprite.shownBuilt = built;
        sprite.shownSelected = selected;
        sprite.shownAffordable = affordable;
        sprite.shownCost = cost;
        this.drawChamber(sprite, built, selected, affordable);
      }
      // Built-chamber decoration animates continuously, so redraw it every
      // frame independent of the body redraw above.
      if (built) this.drawChamberDecoration(sprite);
      sprite.hit.eventMode = visible ? 'static' : 'none';
    }

    this.drawTunnels(state);
  }

  private createChamberSprite(spec: ChamberSpec): void {
    const pos = chamberWorldPosition(spec.plot);
    const container = new Container();
    container.x = pos.x;
    container.y = pos.y;

    const body = new Graphics();
    const decoration = new Graphics();
    const hit = new Graphics();
    const spriteRef: { current: ChamberSprite | null } = { current: null };
    hit.eventMode = 'static';
    hit.cursor = 'pointer';
    hit.on('pointertap', (e) => {
      e.stopPropagation();
      if (!this.visibleNow) return;
      // Built → open upgrade panel. Undug → dig directly.
      if (spriteRef.current?.shownBuilt === true) {
        this.callbacks.onChamberClick(spec.id);
      } else {
        this.callbacks.onDigChamber(spec.id);
      }
    });
    const glyph = makeCrispText(spec.glyph, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 16 * GLYPH_SUPERSAMPLE,
      fontWeight: '700',
      fill: 0x1a1408,
      align: 'center',
    });
    glyph.y = -UNDERGROUND.CHAMBER_H * 0.22;
    const nameLabel = makeCrispText(spec.name, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 7 * GLYPH_SUPERSAMPLE,
      fontWeight: '800',
      fill: 0x1a1408,
      align: 'center',
    });
    nameLabel.y = UNDERGROUND.CHAMBER_H * 0.28;
    const costLabel = makeCrispText('', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: 6.5 * GLYPH_SUPERSAMPLE,
      fontWeight: '800',
      fill: 0xfff2cf,
      align: 'center',
    });
    costLabel.y = UNDERGROUND.CHAMBER_H * 0.52;

    container.addChild(body, decoration, hit, glyph, nameLabel, costLabel);
    this.chamberLayer.addChild(container);

    const sprite: ChamberSprite = {
      id: spec.id,
      spec,
      container,
      body,
      decoration,
      glyph,
      nameLabel,
      costLabel,
      hit,
      shownBuilt: null,
      shownSelected: false,
      shownAffordable: false,
      shownCost: -1,
      hovered: false,
    };
    hit.on('pointerover', () => {
      sprite.hovered = true;
    });
    hit.on('pointerout', () => {
      sprite.hovered = false;
    });
    spriteRef.current = sprite;
    this.sprites.set(spec.id, sprite);
  }

  private drawChamber(
    sprite: ChamberSprite,
    built: boolean,
    selected: boolean,
    affordable: boolean,
  ): void {
    const g = sprite.body;
    g.clear();
    const w = UNDERGROUND.CHAMBER_W;
    const h = UNDERGROUND.CHAMBER_H;
    const r = 12;

    if (built) {
      // Excavated chamber — a warm-lit room carved into the rock with a
      // building-themed animation playing inside. The selection halo lights
      // its border. The static glyph hides; the animated decoration takes
      // its visual role.
      const fill = 0xd49a3a;
      const stroke = selected ? 0xfff2cf : 0x6e4a16;
      const strokeW = selected ? 3.5 : 2.2;
      g.roundRect(-w / 2, -h / 2, w, h, r)
        .fill({ color: 0x120b03, alpha: 0.95 });
      // Lit interior — warm gradient bands from top (lamp-lit) to bottom.
      const innerY = -h / 2 + 3;
      const innerH = h - 6;
      g.roundRect(-w / 2 + 3, innerY, w - 6, innerH, r - 3)
        .fill(fill);
      // Floor band — slightly darker bottom third reads as a wooden floor.
      g.rect(-w / 2 + 3, innerY + innerH * 0.65, w - 6, innerH * 0.35)
        .fill({ color: 0x8a5a22, alpha: 0.55 });
      g.roundRect(-w / 2 + 3, innerY, w - 6, innerH, r - 3)
        .stroke({ color: stroke, width: strokeW, alpha: 0.95 });
      sprite.glyph.visible = false;
      sprite.nameLabel.style.fill = 0x1a1408;
      sprite.costLabel.text = '';
    } else {
      // Undug plot — dashed outline, faded glyph, pulsing pickaxe cue. Hover
      // brightens it. Unaffordable plots use a cooler tint.
      const breath = 0.55 + Math.sin(this.pulse * 3) * 0.18;
      const hoverBoost = sprite.hovered ? 0.3 : 0;
      const tint = affordable ? 0xf5d166 : 0x6e5a32;
      const alpha = Math.min(1, breath + hoverBoost);
      const fillAlpha = sprite.hovered ? 0.18 : 0.07;
      g.roundRect(-w / 2, -h / 2, w, h, r)
        .fill({ color: 0xf0e9d2, alpha: fillAlpha });
      drawDashedRoundedRect(g, -w / 2, -h / 2, w, h, r, tint, alpha);
      sprite.glyph.visible = true;
      sprite.glyph.style.fill = tint;
      sprite.glyph.alpha = alpha;
      sprite.nameLabel.style.fill = tint;
      sprite.nameLabel.alpha = alpha;
      const costText = `Dig · ${sprite.spec.digCost}🌼`;
      if (sprite.costLabel.text !== costText) sprite.costLabel.text = costText;
      sprite.costLabel.style.fill = affordable ? 0xfff2cf : 0x8a7a4a;
    }

    // Hit area — full rectangle so a click anywhere on the chamber opens it.
    sprite.hit.clear();
    sprite.hit.roundRect(-w / 2, -h / 2, w, h, r).fill({ color: 0xffffff, alpha: 0.001 });
  }

  // Building-themed animation that fills the chamber when built. Each
  // chamber id has its own routine — the visual character of the room.
  private drawChamberDecoration(sprite: ChamberSprite): void {
    const g = sprite.decoration;
    g.clear();
    const t = this.pulse;
    // Decoration sits inside the chamber, slightly above the floor band.
    const cy = -UNDERGROUND.CHAMBER_H * 0.04;
    if (sprite.spec.id === 'forager-den') {
      drawForagerDecoration(g, 0, cy, t);
    } else if (sprite.spec.id === 'geomancer-hall') {
      drawGeomancerDecoration(g, 0, cy, t);
    } else if (sprite.spec.id === 'cantor-cloister') {
      drawCantorDecoration(g, 0, cy, t);
    }
  }

  // Connect built chambers in the same row with a faint tunnel line.
  private drawTunnels(state: GameState): void {
    const g = this.tunnels;
    g.clear();
    const byRow = new Map<number, ChamberSpec[]>();
    for (const spec of CHAMBERS) {
      if (!isChamberBuilt(state, spec.id)) continue;
      const row = spec.plot.row;
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row)!.push(spec);
    }
    for (const [, list] of byRow) {
      const sorted = list.slice().sort((a, b) => a.plot.col - b.plot.col);
      for (let i = 0; i + 1 < sorted.length; i++) {
        const a = chamberWorldPosition(sorted[i].plot);
        const b = chamberWorldPosition(sorted[i + 1].plot);
        const startX = a.x + UNDERGROUND.CHAMBER_W / 2;
        const endX = b.x - UNDERGROUND.CHAMBER_W / 2;
        const y = (a.y + b.y) / 2;
        g.moveTo(startX, y).lineTo(endX, y).stroke({
          color: 0x6e4a22,
          width: 6,
          alpha: 0.7,
        });
      }
    }
  }

  // Brown soil cross-section under the meadow line, slightly darker toward
  // the bottom to convey depth. Drawn once at construction; doesn't change.
  private drawSoil(): void {
    const g = this.soil;
    g.clear();
    const top = UNDERGROUND.TOP_Y - 12;
    const bottom = WORLD.HEIGHT;
    const w = WORLD.WIDTH;
    // Layered bands to fake a vertical gradient without textures.
    const bands = 6;
    for (let i = 0; i < bands; i++) {
      const t0 = i / bands;
      const t1 = (i + 1) / bands;
      const y0 = top + (bottom - top) * t0;
      const y1 = top + (bottom - top) * t1;
      const shade = 0x4a + Math.round((0x28 - 0x4a) * t0); // 0x4a → 0x28
      const color = (shade << 16) | ((shade - 0x10) << 8) | 0x18;
      g.rect(0, y0, w, y1 - y0).fill({ color, alpha: 1 });
    }
    // A subtle meadow-line band so the soil reads as separate from the grass.
    g.rect(0, top, w, 4).fill({ color: 0x2a1c0a, alpha: 0.9 });
  }
}

// Forager Den interior — a pollen flower bobs on a slender stem with a
// gentle sway, petals fanning around a glowing yellow center.
function drawForagerDecoration(g: Graphics, cx: number, cy: number, t: number): void {
  const bob = Math.sin(t * 1.6) * 0.9;
  const sway = Math.sin(t * 1.1) * 0.12;
  const stemBase = cy + 10;
  const headY = cy - 4 + bob;
  g.moveTo(cx, stemBase);
  const midX = cx + Math.sin(t * 0.9) * 0.7;
  const midY = (stemBase + headY) / 2;
  g.bezierCurveTo(midX, midY + 2, midX + sway * 2, midY - 1, cx + sway * 2.5, headY)
    .stroke({ color: 0x3a7a2a, width: 1.4 });
  g.ellipse(cx + 3, stemBase - 3, 2.5, 1.3).fill(0x4ea03a);
  const headX = cx + sway * 2.5;
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 * i) / 5 + sway + t * 0.2;
    const px = headX + Math.cos(a) * 3.6;
    const py = headY + Math.sin(a) * 3.6;
    g.circle(px, py, 2.3).fill(0xf5b8d2);
  }
  g.circle(headX, headY, 2.8).fill({ color: 0xf5d166, alpha: 0.35 });
  g.circle(headX, headY, 1.8).fill(0xf5d166);
  for (let i = 0; i < 3; i++) {
    const phase = (t * 0.8 + i * 0.33) % 1;
    const mx = headX + Math.sin(t * 1.4 + i * 1.7) * 3.5;
    const my = headY - phase * 8;
    const alpha = (1 - phase) * 0.8;
    g.circle(mx, my, 0.6).fill({ color: 0xfff2cf, alpha });
  }
}

// Geomancer Hall interior — a pickaxe swings from a fixed pivot, striking
// the floor with a small spark burst at the bottom of each arc.
function drawGeomancerDecoration(g: Graphics, cx: number, cy: number, t: number): void {
  const phase = (Math.sin(t * 2.2) + 1) * 0.5;
  const swing = -Math.PI / 2 + (1 - phase) * (Math.PI * 0.45);
  const pivotX = cx - 2.5;
  const pivotY = cy - 3;
  const handleLen = 10;
  const ex = pivotX + Math.cos(swing) * handleLen;
  const ey = pivotY + Math.sin(swing) * handleLen;
  g.moveTo(pivotX, pivotY).lineTo(ex, ey)
    .stroke({ color: 0x6a4a22, width: 1.6 });
  g.circle(pivotX, pivotY, 1.1).fill(0x3a2510);
  const perp = swing + Math.PI / 2;
  const tip = swing;
  const headR = 2.8;
  const hx0 = ex + Math.cos(perp) * headR;
  const hy0 = ey + Math.sin(perp) * headR;
  const hx1 = ex - Math.cos(perp) * headR;
  const hy1 = ey - Math.sin(perp) * headR;
  const hx2 = ex + Math.cos(tip) * headR;
  const hy2 = ey + Math.sin(tip) * headR;
  g.poly([hx0, hy0, hx2, hy2, hx1, hy1])
    .fill(0x9a9a8a)
    .stroke({ color: 0x3a3a2a, width: 0.9 });
  if (phase < 0.18) {
    const brightness = 1 - phase / 0.18;
    for (let i = 0; i < 4; i++) {
      const sa = (i - 1.5) * 0.45;
      const sd = 2.2 + (1 - brightness) * 3;
      g.circle(ex + Math.cos(swing + sa) * sd, ey + Math.sin(swing + sa) * sd, 0.55)
        .fill({ color: 0xfff2cf, alpha: brightness });
    }
    g.circle(ex, ey + 0.5, 0.9).fill({ color: 0x3a2a18, alpha: brightness * 0.7 });
  }
}

// Cantor Cloister interior — a floating spellbook with three orbiting motes
// of light. Reads as the cantrip caster's study/library.
function drawCantorDecoration(g: Graphics, cx: number, cy: number, t: number): void {
  const bob = Math.sin(t * 1.4) * 0.7;
  // Open book — two trapezoidal pages with a dark spine.
  const bx = cx;
  const by = cy + bob;
  g.poly([bx - 6, by + 3, bx - 5, by - 2, bx - 0.4, by - 1, bx - 0.4, by + 3])
    .fill(0xf3e8c8)
    .stroke({ color: 0x6e4a22, width: 0.6 });
  g.poly([bx + 6, by + 3, bx + 5, by - 2, bx + 0.4, by - 1, bx + 0.4, by + 3])
    .fill(0xf3e8c8)
    .stroke({ color: 0x6e4a22, width: 0.6 });
  g.rect(bx - 0.5, by - 1.5, 1, 5).fill(0x3a1a78);
  // Three orbiting motes of light circling the book.
  for (let i = 0; i < 3; i++) {
    const a = t * 1.7 + (i * Math.PI * 2) / 3;
    const orbitR = 7;
    const ox = bx + Math.cos(a) * orbitR;
    const oy = by + Math.sin(a) * orbitR * 0.45 - 2;
    g.circle(ox, oy, 1.6).fill({ color: 0x9a7adf, alpha: 0.35 });
    g.circle(ox, oy, 0.8).fill(0xfff2cf);
  }
}

function drawDashedRoundedRect(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: number,
  alpha: number,
): void {
  // Approximate a dashed outline with short straight segments around the
  // rounded rect. Cheap and good enough for the undug-plot affordance.
  const dashLen = 8;
  const gapLen = 5;
  const stroke = { color, width: 2, alpha };
  // Top edge
  drawDashedSegment(g, x + r, y, x + w - r, y, dashLen, gapLen, stroke);
  // Right edge
  drawDashedSegment(g, x + w, y + r, x + w, y + h - r, dashLen, gapLen, stroke);
  // Bottom edge
  drawDashedSegment(g, x + w - r, y + h, x + r, y + h, dashLen, gapLen, stroke);
  // Left edge
  drawDashedSegment(g, x, y + h - r, x, y + r, dashLen, gapLen, stroke);
  // Corners as solid arcs (just draw rounded rect outline overlay at low alpha)
  g.roundRect(x, y, w, h, r).stroke({ color, width: 1.2, alpha: alpha * 0.5 });
}

function drawDashedSegment(
  g: Graphics,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  dashLen: number,
  gapLen: number,
  stroke: { color: number; width: number; alpha: number },
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len <= 0.0001) return;
  const ux = dx / len;
  const uy = dy / len;
  const step = dashLen + gapLen;
  for (let d = 0; d < len; d += step) {
    const a = d;
    const b = Math.min(d + dashLen, len);
    g.moveTo(x0 + ux * a, y0 + uy * a)
      .lineTo(x0 + ux * b, y0 + uy * b)
      .stroke(stroke);
  }
}

function makeCrispText(
  text: string,
  style: import('pixi.js').TextStyleOptions,
): Text {
  const t = new Text({ text, style });
  t.anchor.set(0.5);
  t.scale.set(1 / GLYPH_SUPERSAMPLE);
  return t;
}
