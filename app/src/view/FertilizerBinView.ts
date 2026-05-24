import { Container, Graphics, Text } from 'pixi.js';
import type { GameState } from '../sim/state';
import { totalFertilizer, fertilizerCap } from '../sim/state';
import { WORLD } from '../world/layout';

// World-space Fertilizer Bin — a wooden compost crate next to the Pollen
// Silo, under the hive. Foragers haul fertilizer drops from the rock pile
// here; the contents are spent on permanent meadow/flower upgrades (panel
// wired in a later slice). Visually a sibling silhouette to the silo so
// the two read as a paired "intake counter" under the comb.

const BIN_W = 32;
const BIN_H = 30;
const RIM_H = 4;
const TEXT_SUPERSAMPLE = 6;

export class FertilizerBinView {
  readonly container: Container;
  private shell: Graphics;
  private fill: Graphics;
  private label: Text;
  private displayFill = 0;
  private pulse = 0;
  private bobPhase: number;
  private lastSeen = -1;
  private flash = 0;

  constructor(onClick?: () => void) {
    this.container = new Container();
    this.container.x = WORLD.FERTILIZER_BIN.x;
    this.container.y = WORLD.FERTILIZER_BIN.y;
    this.bobPhase = Math.random() * Math.PI * 2;
    if (onClick) {
      this.container.eventMode = 'static';
      this.container.cursor = 'pointer';
      this.container.hitArea = {
        contains: (x: number, y: number): boolean =>
          x >= -BIN_W / 2 - 2 &&
          x <= BIN_W / 2 + 2 &&
          y >= -BIN_H / 2 - 4 &&
          y <= BIN_H / 2 + 6,
      };
      this.container.on('pointertap', (e) => {
        e.stopPropagation();
        onClick();
      });
    }

    this.shell = new Graphics();
    this.fill = new Graphics();
    this.label = new Text({
      text: '0/0',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 7 * TEXT_SUPERSAMPLE,
        fontWeight: '800',
        fill: 0xeaf6cf,
        stroke: { color: 0x182a08, width: 1.5 * TEXT_SUPERSAMPLE },
        align: 'center',
      },
    });
    this.label.anchor.set(0.5);
    this.label.scale.set(1 / TEXT_SUPERSAMPLE);
    this.label.y = BIN_H / 2 + 9;

    this.container.addChild(this.shell, this.fill, this.label);
    this.drawShell();
  }

  update(state: GameState, dtMs: number): void {
    const f = totalFertilizer(state);
    const cap = fertilizerCap(state);
    const target = cap > 0 ? Math.max(0, Math.min(1, f / cap)) : 0;

    if (this.lastSeen >= 0 && f > this.lastSeen) this.flash = 1;
    this.lastSeen = f;

    const ease = 1 - Math.pow(0.005, dtMs / 1000);
    this.displayFill += (target - this.displayFill) * ease;
    this.flash = Math.max(0, this.flash - dtMs / 300);

    this.pulse += dtMs / 1000;
    const bob = Math.sin(this.pulse * 1.2 + this.bobPhase) * 0.4;
    this.container.y = WORLD.FERTILIZER_BIN.y + bob;
    this.container.scale.set(1 + this.flash * 0.08);

    this.drawFill();
    this.label.text = `${f}/${cap}`;
  }

  // Static frame: a stout wooden crate with two horizontal slats. Wider
  // and shorter than the silo so the two silhouettes don't read as twins.
  private drawShell(): void {
    const g = this.shell;
    g.clear();
    // Ground shadow.
    g.ellipse(0, BIN_H / 2 + 3, BIN_W * 0.55, 3.5)
      .fill({ color: 0x000000, alpha: 0.32 });
    // Body — a straight-sided crate.
    g.rect(-BIN_W / 2, -BIN_H / 2 + RIM_H, BIN_W, BIN_H - RIM_H)
      .fill(0x6a4520)
      .stroke({ color: 0x2a1408, width: 0.8 });
    // Plank seams — vertical lines splitting the crate face.
    for (let x = -BIN_W / 2 + 8; x < BIN_W / 2; x += 8) {
      g.moveTo(x, -BIN_H / 2 + RIM_H + 1)
        .lineTo(x, BIN_H / 2 - 1)
        .stroke({ color: 0x3a2510, width: 0.4, alpha: 0.7 });
    }
    // Iron strap — a darker horizontal band across the middle for the
    // "compost bin" silhouette.
    g.rect(-BIN_W / 2, -1, BIN_W, 2.5)
      .fill(0x3a2a18);
    // Top rim — slightly wider so the crate reads as open-topped.
    g.rect(-BIN_W / 2 - 1, -BIN_H / 2, BIN_W + 2, RIM_H)
      .fill(0x4a3018)
      .stroke({ color: 0x1a0e04, width: 0.5 });
  }

  // Compost pile inside the bin — a mound of dark loam with green and
  // amber flecks. Grows in height as `displayFill` rises.
  private drawFill(): void {
    const g = this.fill;
    g.clear();
    if (this.displayFill <= 0) return;
    const innerTop = -BIN_H / 2 + RIM_H + 1;
    const innerBottom = BIN_H / 2 - 1;
    const innerH = innerBottom - innerTop;
    const pileH = innerH * this.displayFill;
    const pileTop = innerBottom - pileH;
    // Loam body — slightly mounded silhouette so a half-full bin still
    // reads as a heap, not a flat layer.
    const baseLoam = 0x3a2814;
    const brightLoam = 0x5a3a1c;
    const loam = lerpColor(baseLoam, brightLoam, this.flash * 0.6);
    g.poly([
      -BIN_W / 2 + 1, innerBottom,
      -BIN_W / 2 + 3, pileTop + 1.5,
      0, pileTop - 1.5,
      BIN_W / 2 - 3, pileTop + 1.5,
      BIN_W / 2 - 1, innerBottom,
    ]).fill(loam);
    // Specks — small flecks of leaf-green and amber across the surface,
    // hinting at composted plant matter without redrawing the meadow.
    const specCount = Math.min(18, Math.floor(this.displayFill * 22));
    for (let i = 0; i < specCount; i++) {
      // Stable pseudo-random by index so flecks don't jitter frame to frame.
      const sx = ((i * 73) % (BIN_W - 6)) - (BIN_W / 2 - 3);
      const sy = pileTop + 1 + ((i * 41) % Math.max(1, Math.floor(pileH - 2)));
      const greenish = i % 3 === 0;
      g.circle(sx, sy, 0.7).fill({
        color: greenish ? 0x6e8c2a : 0xb88a3c,
        alpha: 0.85,
      });
    }
  }

  sourcePoint(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y - BIN_H / 2 + RIM_H };
  }
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const gc = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (gc << 8) | bl;
}
