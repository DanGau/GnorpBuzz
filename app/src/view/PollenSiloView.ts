import { Container, Graphics, Text } from 'pixi.js';
import type { GameState } from '../sim/state';
import { totalPollen, pollenCap } from '../sim/state';
import { WORLD } from '../world/layout';

// World-space Pollen Silo — a woven basket on the meadow ground where
// foragers drop pollen and workers pick it up. Visualized like a smaller
// sibling of the honey jar: a body that fills with a clustered pile of
// pollen dots as `state.hive.pollen` rises, and a fill bar below for a
// precise read of the cap.

const SILO_W = 28;
const SILO_H = 34;
const RIM_H = 5;
const TEXT_SUPERSAMPLE = 6;

export class PollenSiloView {
  readonly container: Container;
  private shell: Graphics;
  private fill: Graphics;
  private rim: Graphics;
  private glow: Graphics;
  private label: Text;
  private displayFill = 0;
  private pulse = 0;
  private bobPhase: number;
  private lastSeen = -1;
  private flash = 0;
  // Per-dot interpolation state, keyed by dot id. Tracks the falling
  // animation: a new dot starts at the silo lip (y = lipY) and eases
  // down to its target slot. Existing dots whose target changed because
  // ones below them were removed also re-ease toward the new slot.
  private dotAnim = new Map<string, { y: number; targetY: number }>();

  constructor(onClick?: () => void) {
    this.container = new Container();
    this.container.x = WORLD.POLLEN_SILO.x;
    this.container.y = WORLD.POLLEN_SILO.y;
    this.bobPhase = Math.random() * Math.PI * 2;
    if (onClick) {
      this.container.eventMode = 'static';
      this.container.cursor = 'pointer';
      this.container.hitArea = {
        contains: (x: number, y: number): boolean =>
          x >= -SILO_W / 2 - 2 &&
          x <= SILO_W / 2 + 2 &&
          y >= -SILO_H / 2 - 4 &&
          y <= SILO_H / 2 + 6,
      };
      this.container.on('pointertap', (e) => {
        e.stopPropagation();
        onClick();
      });
    }

    this.glow = new Graphics();
    this.shell = new Graphics();
    this.fill = new Graphics();
    this.rim = new Graphics();
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
    this.label.y = SILO_H / 2 + 9;

    this.container.addChild(this.glow, this.shell, this.fill, this.rim, this.label);
    this.drawShell();
  }

  update(state: GameState, dtMs: number): void {
    const pollen = totalPollen(state);
    const cap = pollenCap(state);
    const target = cap > 0 ? Math.max(0, Math.min(1, pollen / cap)) : 0;

    if (this.lastSeen >= 0 && pollen > this.lastSeen) this.flash = 1;
    this.lastSeen = pollen;

    const ease = 1 - Math.pow(0.005, dtMs / 1000);
    this.displayFill += (target - this.displayFill) * ease;
    this.flash = Math.max(0, this.flash - dtMs / 300);

    this.pulse += dtMs / 1000;
    // Almost no bob — silos sit on the ground.
    const bob = Math.sin(this.pulse * 1.2 + this.bobPhase) * 0.4;
    this.container.y = WORLD.POLLEN_SILO.y + bob;
    // Punch-and-settle: scale peaks at 1.18 on impact then crosses
    // slightly below 1.0 around 75% of the decay before settling. The
    // tiny undershoot is the "back" in easeOutBack — what gives the
    // bump weight rather than feeling like a static highlight pop.
    const punch = 1 + this.flash * 0.18 - this.flash * (1 - this.flash) * 0.10;
    this.container.scale.set(punch);

    this.drawFill(state, dtMs);
    this.drawGlow();
    this.label.text = `${pollen}/${cap}`;
  }

  // Static frame: a woven basket with a wood rim. Looks rustic next to
  // the honey jar's glass body so the two read as different containers
  // at a glance.
  private drawShell(): void {
    const g = this.shell;
    g.clear();
    // Ground shadow.
    g.ellipse(0, SILO_H / 2 + 3, SILO_W * 0.55, 3.5)
      .fill({ color: 0x000000, alpha: 0.32 });
    // Body — tapered basket, wider at top.
    g.poly([
      -SILO_W / 2, -SILO_H / 2 + RIM_H,
      SILO_W / 2, -SILO_H / 2 + RIM_H,
      SILO_W / 2 - 2, SILO_H / 2,
      -SILO_W / 2 + 2, SILO_H / 2,
    ])
      .fill(0x8a5a22)
      .stroke({ color: 0x2a1408, width: 0.8 });
    // Weave hatching — vertical strands every ~3px.
    for (let x = -SILO_W / 2 + 3; x < SILO_W / 2 - 2; x += 3) {
      g.moveTo(x, -SILO_H / 2 + RIM_H + 1)
        .lineTo(x - 1.5, SILO_H / 2 - 1)
        .stroke({ color: 0x3a2510, width: 0.35, alpha: 0.7 });
    }
    // Horizontal weave bands.
    for (let y = -SILO_H / 2 + RIM_H + 5; y < SILO_H / 2 - 2; y += 6) {
      g.moveTo(-SILO_W / 2 + 2, y)
        .lineTo(SILO_W / 2 - 2, y)
        .stroke({ color: 0xc89a4e, width: 0.4, alpha: 0.55 });
    }
  }

  // Render each pollen entity at its silo-local slot, with a per-dot
  // falling animation: newly added dots enter at the basket lip and ease
  // down to their target. Brightens briefly when the count increases.
  private drawFill(state: GameState, dtMs: number): void {
    const g = this.fill;
    g.clear();
    const dots = state.hive.pollenDots ?? [];

    const lipY = -SILO_H / 2 + RIM_H + 1;

    // Garbage-collect anim entries whose dot no longer exists.
    const liveIds = new Set<string>();
    for (const d of dots) liveIds.add(d.id);
    for (const id of this.dotAnim.keys()) {
      if (!liveIds.has(id)) this.dotAnim.delete(id);
    }

    // Ease factor — fast enough to feel like a settling grain, slow
    // enough that newly added dots read as "falling in" not "snapping".
    const ease = 1 - Math.pow(0.0008, dtMs / 1000);

    const baseGold = 0xf5d166;
    const bright = 0xfff0a0;
    const dotColor = lerpColor(baseGold, bright, this.flash);

    for (const d of dots) {
      let anim = this.dotAnim.get(d.id);
      if (!anim) {
        // Spawn animation: start at the lip with a small horizontal
        // jitter so multiple dots arriving on the same tick don't
        // overlay perfectly.
        anim = { y: lipY, targetY: d.y };
        this.dotAnim.set(d.id, anim);
      } else {
        anim.targetY = d.y;
      }
      anim.y += (anim.targetY - anim.y) * ease;

      g.circle(d.x, anim.y, 1.6).fill(dotColor);
      // Tiny highlight pip — gives each grain a hint of dimensionality.
      g.circle(d.x - 0.5, anim.y - 0.5, 0.55).fill({
        color: 0xfff2cf,
        alpha: 0.85,
      });
    }

    // Rim shadow on top to anchor the pile inside the basket.
    const r = this.rim;
    r.clear();
    r.ellipse(0, -SILO_H / 2 + RIM_H, SILO_W / 2 - 1, 3)
      .fill({ color: 0x2a1408, alpha: 0.5 });
    r.ellipse(0, -SILO_H / 2 + RIM_H, SILO_W / 2 - 1.5, 2.4)
      .stroke({ color: 0xc89a4e, width: 0.5, alpha: 0.8 });
  }

  private drawGlow(): void {
    const g = this.glow;
    g.clear();
    const a = 0.05 + this.displayFill * 0.15 + this.flash * 0.2;
    if (a < 0.03) return;
    g.circle(0, 0, SILO_W * 1.3).fill({ color: 0xf5d166, alpha: a * 0.35 });
    g.circle(0, 0, SILO_W * 0.95).fill({ color: 0xfff2cf, alpha: a * 0.55 });
  }

  // World position of the silo lip — used if the sim wants to fire
  // bee-deposit visual chains aimed at the building.
  sourcePoint(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y - SILO_H / 2 + RIM_H };
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
