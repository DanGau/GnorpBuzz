import { Container, Graphics, Text } from 'pixi.js';
import type { GameState } from '../sim/state';
import { totalWax, waxCap } from '../sim/state';
import { WORLD } from '../world/layout';

// World-space Wax Block — a growing stack of hex-shaped wax flakes on the
// meadow ground, the upgrade currency's home container. Reads as a
// physical inventory rather than a tank: the stack height tracks
// `state.hive.wax / state.hive.waxCap`, growing upward as wax workers
// deliver and dropping when the player spends.

const BLOCK_W = 30;
const BLOCK_MAX_H = 32; // stack height at cap
const TILE_PAD = 0.6;
const TEXT_SUPERSAMPLE = 6;

export class WaxBlockView {
  readonly container: Container;
  private shell: Graphics;
  private stack: Graphics;
  private glow: Graphics;
  private label: Text;
  private displayFill = 0;
  private pulse = 0;
  private bobPhase: number;
  private lastSeen = -1;
  private flashUp = 0;
  private flashDown = 0;

  constructor(onClick?: () => void) {
    this.container = new Container();
    this.container.x = WORLD.WAX_BLOCK.x;
    this.container.y = WORLD.WAX_BLOCK.y;
    this.bobPhase = Math.random() * Math.PI * 2;
    if (onClick) {
      this.container.eventMode = 'static';
      this.container.cursor = 'pointer';
      this.container.hitArea = {
        contains: (x: number, y: number): boolean =>
          x >= -BLOCK_W / 2 - 2 &&
          x <= BLOCK_W / 2 + 2 &&
          y >= -BLOCK_MAX_H - 2 &&
          y <= 8,
      };
      this.container.on('pointertap', (e) => {
        e.stopPropagation();
        onClick();
      });
    }

    this.glow = new Graphics();
    this.shell = new Graphics();
    this.stack = new Graphics();
    this.label = new Text({
      text: '0/0',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 7 * TEXT_SUPERSAMPLE,
        fontWeight: '800',
        fill: 0xfff2cf,
        stroke: { color: 0x2a1f0a, width: 1.5 * TEXT_SUPERSAMPLE },
        align: 'center',
      },
    });
    this.label.anchor.set(0.5);
    this.label.scale.set(1 / TEXT_SUPERSAMPLE);
    this.label.y = 12;

    this.container.addChild(this.glow, this.shell, this.stack, this.label);
    this.drawShell();
  }

  update(state: GameState, dtMs: number): void {
    const wax = totalWax(state);
    const cap = waxCap(state);
    const target = cap > 0 ? Math.max(0, Math.min(1, wax / cap)) : 0;

    if (this.lastSeen >= 0) {
      const delta = wax - this.lastSeen;
      if (delta > 0) this.flashUp = 1;
      else if (delta < 0) this.flashDown = 1;
    }
    this.lastSeen = wax;

    const ease = 1 - Math.pow(0.005, dtMs / 1000);
    this.displayFill += (target - this.displayFill) * ease;
    this.flashUp = Math.max(0, this.flashUp - dtMs / 300);
    this.flashDown = Math.max(0, this.flashDown - dtMs / 400);

    this.pulse += dtMs / 1000;
    const bob = Math.sin(this.pulse * 1.1 + this.bobPhase) * 0.4;
    this.container.y = WORLD.WAX_BLOCK.y + bob;
    // Up = small bump, down = small squish.
    const sx = 1 + this.flashUp * 0.06 - this.flashDown * 0.05;
    const sy = 1 + this.flashUp * 0.08 - this.flashDown * 0.06;
    this.container.scale.set(sx, sy);

    this.drawStack(wax, cap);
    this.drawGlow();
    this.label.text = `${wax}/${cap}`;
  }

  // Static frame: a flat wooden pallet under the stack, plus a ground
  // shadow. The stack itself is drawn each frame in drawStack.
  private drawShell(): void {
    const g = this.shell;
    g.clear();
    g.ellipse(0, 6, BLOCK_W * 0.55, 3.5)
      .fill({ color: 0x000000, alpha: 0.32 });
    // Pallet — a short wide plank.
    g.roundRect(-BLOCK_W / 2 - 1, 2, BLOCK_W + 2, 4, 1)
      .fill(0x6a4a22)
      .stroke({ color: 0x2a1408, width: 0.6 });
    // Wood-grain.
    g.moveTo(-BLOCK_W / 2 + 2, 4)
      .lineTo(BLOCK_W / 2 - 2, 4)
      .stroke({ color: 0x3a2510, width: 0.3, alpha: 0.7 });
  }

  private drawStack(wax: number, cap: number): void {
    const g = this.stack;
    g.clear();
    if (cap <= 0 || wax <= 0) return;

    // Render up to one "tile" per unit of wax, stacked upward. When the
    // stack would exceed BLOCK_MAX_H, compress vertically so it stays
    // contained — each tile gets thinner. This keeps the visual
    // distinguishable even at full cap.
    const stackH = Math.max(2, BLOCK_MAX_H * this.displayFill);
    const tilesShown = wax;
    const tileH = Math.max(0.9, stackH / Math.max(1, tilesShown));

    // Light/dark tile colors for the alternating pattern. Briefly warm
    // when freshly produced (flashUp).
    const baseLight = 0xe8d8a4;
    const baseDark = 0xc8a878;
    const brightLight = 0xfff5cc;
    const brightDark = 0xd8c088;
    const light = lerpColor(baseLight, brightLight, this.flashUp);
    const dark = lerpColor(baseDark, brightDark, this.flashUp);

    let y = 2; // top of pallet
    for (let i = 0; i < tilesShown; i++) {
      const top = y - tileH;
      // Hex-flake silhouette — wide trapezoid hint at flat-top hex.
      const half = (BLOCK_W * 0.5 - 1) * (1 - (i % 5) * 0.012); // tiny taper per row
      const innerHalf = half - 2;
      const col = i % 2 === 0 ? light : dark;
      g.poly([
        -half, y - TILE_PAD,
        -innerHalf, top,
        innerHalf, top,
        half, y - TILE_PAD,
      ])
        .fill(col)
        .stroke({ color: 0x6a4a22, width: 0.4, alpha: 0.75 });
      // Subtle highlight along the upper edge.
      g.moveTo(-innerHalf + 1, top + 0.4)
        .lineTo(innerHalf - 1, top + 0.4)
        .stroke({ color: 0xffffff, alpha: 0.25, width: 0.5 });
      y = top;
    }
  }

  private drawGlow(): void {
    const g = this.glow;
    g.clear();
    const a = 0.04 + this.displayFill * 0.12 + this.flashUp * 0.18;
    if (a < 0.03) return;
    g.circle(0, -BLOCK_MAX_H * 0.4, BLOCK_W * 1.2)
      .fill({ color: 0xfff2cf, alpha: a * 0.4 });
  }

  sourcePoint(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y - BLOCK_MAX_H * 0.5 };
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
