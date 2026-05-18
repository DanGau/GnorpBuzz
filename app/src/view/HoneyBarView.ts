import { Container, Graphics, Text } from 'pixi.js';
import type { GameState } from '../sim/state';
import { totalHoney, honeyCap } from '../sim/state';
import { WORLD } from '../world/layout';

// World-space honey/mana reservoir, anchored above the hive. A wooden jar
// with a glass front; the honey level rises and falls in real time as
// foragers refine pollen into mana and casters burn it. Acts as the
// player's primary at-a-glance read on the spell economy — both the HTML
// resource bar and this jar are kept in sync.
//
// State changes are exposed to the rest of the view via:
//   produceFlash() — call when honey just went up (refine event)
//   consumeFlash() — call when honey just went down (spell cast)
// These trigger a brief scale bump + tint, so the jar reads as REACTING
// to events rather than just sliding silently.

const JAR_X_OFFSET = 0;
const JAR_Y_OFFSET = -95; // sits in the sky above the hive's peaked roof

const JAR_W = 34;
const JAR_H = 44;
const NECK_W = 18;
const NECK_H = 6;
const FILL_INSET = 3;

const TEXT_SUPERSAMPLE = 6;

export class HoneyBarView {
  readonly container: Container;
  private shell: Graphics;       // jar outline + wood frame
  private fill: Graphics;        // honey body (animated height)
  private highlight: Graphics;   // glass highlight overlay
  private glow: Graphics;        // ambient halo around the jar (when full)
  private label: Text;           // "3/10" inline numeric readout
  private pulse = 0;

  private displayFill = 0;       // smoothly tracks honey/cap (0..1)
  private targetFill = 0;
  // Brief reactions kicked off by produce/consume events. The view interpolates
  // these toward zero; a non-zero value tints + scales the jar.
  private produceFlash = 0;      // 0..1, decays to 0
  private consumeFlash = 0;      // 0..1, decays to 0
  // Vertical bob applied to the jar — gentle ambient float in the sky.
  private bobPhase: number;
  // Track the last observed honey value so we can detect production /
  // consumption events without the sim having to call us explicitly.
  private lastSeenHoney = -1;

  constructor() {
    this.container = new Container();
    this.container.x = WORLD.HIVE.x + JAR_X_OFFSET;
    this.container.y = WORLD.HIVE.y + JAR_Y_OFFSET;
    this.bobPhase = Math.random() * Math.PI * 2;

    this.glow = new Graphics();
    this.shell = new Graphics();
    this.fill = new Graphics();
    this.highlight = new Graphics();
    this.label = new Text({
      text: '0/10',
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 9 * TEXT_SUPERSAMPLE,
        fontWeight: '800',
        fill: 0xfff2cf,
        stroke: { color: 0x2a1f0a, width: 1.5 * TEXT_SUPERSAMPLE },
        align: 'center',
      },
    });
    this.label.anchor.set(0.5);
    this.label.scale.set(1 / TEXT_SUPERSAMPLE);
    this.label.y = JAR_H / 2 + 11;

    this.container.addChild(this.glow, this.shell, this.fill, this.highlight, this.label);
    this.drawShell();
  }

  // Public hooks — called by Bee.ts when something interesting happens.
  flashProduce(): void {
    this.produceFlash = 1;
  }

  flashConsume(): void {
    this.consumeFlash = 1;
  }

  update(state: GameState, dtMs: number): void {
    const honey = totalHoney(state);
    const cap = honeyCap(state);
    this.targetFill = cap > 0 ? Math.max(0, Math.min(1, honey / cap)) : 0;

    // Detect produce/consume by observing the sim's honey delta. Bee.ts
    // also fires explicit flashes (so the view animates at the right
    // moment regardless of frame timing), but this catches debug grants
    // and any path that bypasses the explicit hooks.
    if (this.lastSeenHoney >= 0) {
      const delta = honey - this.lastSeenHoney;
      if (delta > 0 && this.produceFlash < 0.5) this.produceFlash = 1;
      else if (delta < 0 && this.consumeFlash < 0.5) this.consumeFlash = 1;
    }
    this.lastSeenHoney = honey;

    // Frame-rate-independent easing of the displayed fill toward target.
    const fillEase = 1 - Math.pow(0.005, dtMs / 1000);
    this.displayFill += (this.targetFill - this.displayFill) * fillEase;

    // Reactions decay toward zero. Consume decays slower than produce so
    // the "drained" squish lingers long enough for the player to see.
    this.produceFlash = Math.max(0, this.produceFlash - dtMs / 280);
    this.consumeFlash = Math.max(0, this.consumeFlash - dtMs / 520);

    // Ambient bob.
    this.pulse += dtMs / 1000;
    const bob = Math.sin(this.pulse * 1.4 + this.bobPhase) * 1.2;
    this.container.y = WORLD.HIVE.y + JAR_Y_OFFSET + bob;

    // Reaction-driven scale + glow. Produce = bump up; consume = squish down.
    const scaleBump =
      1 + this.produceFlash * 0.15 - this.consumeFlash * 0.08;
    this.container.scale.set(scaleBump);

    this.drawFill(honey, cap);
    this.drawGlow();
    this.label.text = `${honey}/${cap}`;
  }

  // Outer jar frame — wood top + dark outline. Drawn once.
  private drawShell(): void {
    const g = this.shell;
    g.clear();
    // Cork / wax stopper on top.
    g.rect(-NECK_W / 2 - 1.5, -JAR_H / 2 - NECK_H - 2.5, NECK_W + 3, NECK_H + 2.5)
      .fill(0x3a2510)
      .stroke({ color: 0x1a1408, width: 1 });
    g.rect(-NECK_W / 2, -JAR_H / 2 - NECK_H, NECK_W, NECK_H).fill(0x6a4a22);
    // Jar body — outlined rounded rect with a slight curvature at the corners.
    g.roundRect(-JAR_W / 2 - 1.5, -JAR_H / 2 - 1.5, JAR_W + 3, JAR_H + 3, 8)
      .fill(0x1a1408)
      .stroke({ color: 0x000000, width: 0.6, alpha: 0.6 });
    g.roundRect(-JAR_W / 2, -JAR_H / 2, JAR_W, JAR_H, 6.5).fill(0x2a1f0a);
  }

  // Animated honey fill — height tracks displayFill, color shifts toward
  // bright when produce-flashing or toward sickly-pale when consume-flashing.
  private drawFill(_honey: number, _cap: number): void {
    const g = this.fill;
    g.clear();
    const innerW = JAR_W - FILL_INSET * 2;
    const innerH = JAR_H - FILL_INSET * 2;
    const fillH = Math.max(0, innerH * this.displayFill);
    const x = -innerW / 2;
    const y = JAR_H / 2 - FILL_INSET - fillH;

    if (fillH <= 0.5) {
      // Empty — just paint a faint base shimmer so the jar doesn't look broken.
      g.rect(x, JAR_H / 2 - FILL_INSET - 1.5, innerW, 1.5)
        .fill({ color: 0xf5d166, alpha: 0.15 });
      return;
    }

    // Color: warm gold by default, brighter during produce, dim during consume.
    const baseGold = 0xf5d166;
    const bright = 0xfff0a0;
    const drained = 0xb88638;
    let color = baseGold;
    if (this.produceFlash > 0.05) {
      // Lerp toward bright proportional to flash strength.
      color = lerpColor(baseGold, bright, this.produceFlash);
    } else if (this.consumeFlash > 0.05) {
      color = lerpColor(baseGold, drained, this.consumeFlash);
    }

    g.roundRect(x, y, innerW, fillH, 4).fill(color);

    // Surface menisc — a thin lighter band at the top of the fill so it
    // reads as a liquid surface rather than a flat color block.
    if (fillH > 4) {
      g.rect(x, y, innerW, 1.5).fill({ color: 0xffffff, alpha: 0.45 });
    }

    // Honeycomb pattern hinted in the body via faint horizontal banding.
    const bandStep = 6;
    for (let by = y + bandStep; by < y + fillH - 2; by += bandStep) {
      g.rect(x, by, innerW, 0.8).fill({ color: 0xc89a3a, alpha: 0.35 });
    }

    // Glass highlight along the left edge.
    const hg = this.highlight;
    hg.clear();
    hg.rect(-JAR_W / 2 + 2, -JAR_H / 2 + 3, 2.5, JAR_H - 6)
      .fill({ color: 0xffffff, alpha: 0.18 });
    hg.rect(JAR_W / 2 - 3.5, -JAR_H / 2 + 3, 1, JAR_H - 6)
      .fill({ color: 0xffffff, alpha: 0.08 });
  }

  // Ambient halo behind the jar — intensity ramps with fill level, plus
  // a burst kick on produce events.
  private drawGlow(): void {
    const g = this.glow;
    g.clear();
    const baseAlpha = 0.06 + this.displayFill * 0.18;
    const burst = this.produceFlash * 0.25;
    const alpha = Math.min(0.6, baseAlpha + burst);
    if (alpha < 0.02) return;
    const r1 = JAR_W * 0.95;
    const r2 = JAR_W * 1.45;
    g.circle(0, 0, r2).fill({ color: 0xf5d166, alpha: alpha * 0.4 });
    g.circle(0, 0, r1).fill({ color: 0xfff2cf, alpha: alpha * 0.7 });
  }

  // World position of the jar — used by Bee.ts so spell-cast mana orbs
  // fly OUT of the jar toward the caster.
  manaSourcePoint(): { x: number; y: number } {
    return {
      x: this.container.x,
      y: this.container.y,
    };
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
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
