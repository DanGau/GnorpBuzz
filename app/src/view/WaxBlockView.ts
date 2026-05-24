import { Container, Graphics, Text } from 'pixi.js';
import type { GameState } from '../sim/state';
import { totalWax, waxCap } from '../sim/state';
import type { World } from '../world/World';
import { WORLD } from '../world/layout';

// World-space Wax Workshop — an open-front timber hut where wax-workers
// knead pollen batches into wax. The pallet inside holds the growing wax
// stack (the upgrade currency's home inventory), and a small porthole
// above lights up with a kneading bee silhouette while any wax-worker is
// converting a batch. A chimney puffs out the existing sparkle particles.

const BLOCK_W = 30; // wax stack footprint
const BLOCK_MAX_H = 32; // stack height at cap
const TILE_PAD = 0.6;
const TEXT_SUPERSAMPLE = 6;

// Workshop frame — wraps the stack with side posts, roof, and a window.
const BODY_W = BLOCK_W + 16;
const BODY_TOP = -BLOCK_MAX_H - 4; // top of the side posts
const ROOF_PEAK_Y = BODY_TOP - 11;
const POST_W = 4;
const WINDOW_W = 14;
const WINDOW_H = 9;
const WINDOW_Y = BODY_TOP - 2; // window sits just under the roof line

export class WaxBlockView {
  readonly container: Container;
  private shell: Graphics;
  private stack: Graphics;
  private glow: Graphics;
  private window: Graphics;
  private label: Text;
  private displayFill = 0;
  private pulse = 0;
  private bobPhase: number;
  private lastSeen = -1;
  private flashUp = 0;
  private flashDown = 0;
  private kneadAmount = 0; // 0..1, smoothed "is anyone kneading right now"
  private kneadPulse = 0; // advances only while kneading — drives the bob

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
          x >= -BODY_W / 2 - 2 &&
          x <= BODY_W / 2 + 2 &&
          y >= ROOF_PEAK_Y - 4 &&
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
    this.window = new Graphics();
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

    // Order: glow → shell (back wall + roof + posts) → stack (inside the
    // workshop) → window (foreground porthole with kneading bee) → label.
    this.container.addChild(
      this.glow,
      this.shell,
      this.stack,
      this.window,
      this.label,
    );
    this.drawShell();
  }

  update(state: GameState, dtMs: number, world?: World): void {
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

    // Are any wax-workers actively kneading a batch? Smooths the
    // window-lit / window-dim transition so the porthole doesn't flicker
    // when one worker finishes and the next is mid-trip.
    const kneadingNow = isAnyWaxWorkerKneading(world);
    const kneadEase = 1 - Math.pow(0.005, dtMs / 1000);
    this.kneadAmount += ((kneadingNow ? 1 : 0) - this.kneadAmount) * kneadEase;
    if (kneadingNow) this.kneadPulse += dtMs / 1000;

    this.drawStack(wax, cap);
    this.drawWindow();
    this.drawGlow();
    this.label.text = `${wax}/${cap}`;
  }

  // Static frame: the workshop hut around the wax stack. Ground shadow,
  // back wall (visible between the corner posts), two side posts, a
  // peaked timber roof, and a chimney that the existing sparkle
  // particles puff from. The stack itself draws on top (inside the hut).
  private drawShell(): void {
    const g = this.shell;
    g.clear();

    // Ground shadow — slightly wider than the building footprint.
    g.ellipse(0, 6, BODY_W * 0.55, 4)
      .fill({ color: 0x000000, alpha: 0.34 });

    // Back wall — a dim plank backdrop framing the stack so it reads as
    // "contents seen through the open front of the workshop".
    g.rect(-BODY_W / 2 + POST_W, BODY_TOP + 2, BODY_W - POST_W * 2, -BODY_TOP - 4)
      .fill(0x3a2510);
    // A few vertical grain lines on the back wall.
    for (let i = -2; i <= 2; i++) {
      const x = i * 5;
      g.moveTo(x, BODY_TOP + 4)
        .lineTo(x, 0)
        .stroke({ color: 0x2a1808, width: 0.3, alpha: 0.7 });
    }

    // Side posts — vertical timbers framing the open front.
    g.roundRect(-BODY_W / 2, BODY_TOP, POST_W, -BODY_TOP + 6, 0.8)
      .fill(0x7a4f25)
      .stroke({ color: 0x2e1808, width: 0.5 });
    g.roundRect(BODY_W / 2 - POST_W, BODY_TOP, POST_W, -BODY_TOP + 6, 0.8)
      .fill(0x7a4f25)
      .stroke({ color: 0x2e1808, width: 0.5 });

    // Peaked roof — sits on top of the side posts.
    g.poly([
      -BODY_W / 2 - 3, BODY_TOP + 1,
      0, ROOF_PEAK_Y,
      BODY_W / 2 + 3, BODY_TOP + 1,
    ])
      .fill(0x8d3a1a)
      .stroke({ color: 0x3a1408, width: 0.6 });
    // Eave shadow under the roof, helps the roof read as overhanging.
    g.moveTo(-BODY_W / 2 - 3, BODY_TOP + 1)
      .lineTo(BODY_W / 2 + 3, BODY_TOP + 1)
      .stroke({ color: 0x2a0e04, width: 0.6, alpha: 0.7 });

    // Chimney on the right slope, where sparkle puffs already emit.
    const chimX = 8;
    const chimTop = ROOF_PEAK_Y - 1;
    g.rect(chimX, chimTop, 4, 9)
      .fill(0x5a3215)
      .stroke({ color: 0x2e1808, width: 0.5 });
    g.rect(chimX - 0.6, chimTop - 1, 5.2, 1.6)
      .fill(0x6a4225)
      .stroke({ color: 0x2e1808, width: 0.4 });

    // Pallet — a short wide plank inside the workshop, where the stack
    // accumulates.
    g.roundRect(-BLOCK_W / 2 - 1, 2, BLOCK_W + 2, 4, 1)
      .fill(0x6a4a22)
      .stroke({ color: 0x2a1408, width: 0.6 });
    g.moveTo(-BLOCK_W / 2 + 2, 4)
      .lineTo(BLOCK_W / 2 - 2, 4)
      .stroke({ color: 0x3a2510, width: 0.3, alpha: 0.7 });
  }

  // Foreground porthole window with a kneading bee silhouette inside.
  // Window stays visible at all times; the interior glow and bee
  // animation only kick in when kneadAmount > 0.
  private drawWindow(): void {
    const g = this.window;
    g.clear();

    // Window frame.
    const fx = -WINDOW_W / 2;
    const fy = WINDOW_Y - WINDOW_H;
    g.roundRect(fx - 0.8, fy - 0.8, WINDOW_W + 1.6, WINDOW_H + 1.6, 1.2)
      .fill(0x3a2510);
    // Pane — warms up amber while a bee is kneading inside.
    const paneCold = 0x1a0e04;
    const paneWarm = 0xf2b34a;
    const paneCol = lerpColor(paneCold, paneWarm, this.kneadAmount * 0.85);
    g.roundRect(fx, fy, WINDOW_W, WINDOW_H, 1).fill(paneCol);

    // Kneading bee silhouette — only visible when something is happening
    // inside. Bobs and squishes in time with the work, like the bee is
    // pressing pollen down onto a slab.
    if (this.kneadAmount > 0.05) {
      const t = this.kneadPulse * 4.5; // ~1.4Hz squish
      const squish = 0.85 + 0.18 * Math.sin(t);
      const bobY = Math.sin(t * 0.9) * 0.7;
      const cx = 0;
      const cy = fy + WINDOW_H * 0.55 + bobY;
      const alpha = Math.min(1, this.kneadAmount * 1.4);
      // Body.
      g.ellipse(cx, cy, 3.2, 2.2 * squish)
        .fill({ color: 0x2a1808, alpha });
      // Stripe hint — one bright band so the silhouette reads as a bee.
      g.rect(cx - 0.7, cy - 1.2 * squish, 1.4, 0.6 * squish)
        .fill({ color: 0xf5c050, alpha: alpha * 0.7 });
      // Little impact puff under the body on the down-beat.
      const impact = Math.max(0, Math.sin(t));
      if (impact > 0.4) {
        g.ellipse(cx, cy + 2.2 * squish, 2.8, 0.7)
          .fill({ color: 0xfff2cf, alpha: alpha * (impact - 0.4) * 0.6 });
      }
    }

    // A single muntin across the middle for window-pane shape.
    g.moveTo(fx + 1, fy + WINDOW_H / 2)
      .lineTo(fx + WINDOW_W - 1, fy + WINDOW_H / 2)
      .stroke({ color: 0x3a2510, width: 0.5, alpha: 0.6 });
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

function isAnyWaxWorkerKneading(world: World | undefined): boolean {
  if (!world) return false;
  for (const bee of world.hive.allBees()) {
    if (bee.role === 'wax-worker' && bee.state === 'worker-depositing') {
      return true;
    }
  }
  return false;
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
