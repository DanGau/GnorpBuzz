import { Container, Graphics } from 'pixi.js';
import type { GameState } from '../sim/state';
import { TUNING, vesselTierConfig } from '../sim/state';
import { WORLD } from '../world/layout';
import type { World } from '../world/World';

const PAD = WORLD.VESSEL_PAD;
const APEX_Y = 200;
const SHUDDER_MS = 350;

export class VesselView {
  readonly container: Container;
  private pile: Graphics;
  private airplane: Graphics;
  private hint: Graphics;
  private highlight: Graphics;
  private hitArea: Graphics;
  private pulse = 0;
  private onSelect: () => void;

  constructor(onSelect: () => void) {
    this.onSelect = onSelect;
    this.container = new Container();
    this.highlight = new Graphics();
    this.pile = new Graphics();
    this.airplane = new Graphics();
    this.hint = new Graphics();
    this.hitArea = new Graphics();

    // Z-order: highlight halo → glow hint → pile / airplane → invisible hit area on top.
    this.container.addChild(this.highlight);
    this.container.addChild(this.hint);
    this.container.addChild(this.pile);
    this.container.addChild(this.airplane);
    this.container.addChild(this.hitArea);

    this.hitArea.eventMode = 'static';
    this.hitArea.cursor = 'pointer';
    this.hitArea.on('pointertap', (e) => {
      e.stopPropagation();
      this.onSelect();
    });
  }

  private dustCooldownMs = 0;

  update(state: GameState, dtMs: number, selected: boolean, world?: World): void {
    this.pulse += dtMs / 1000;
    this.pile.clear();
    this.airplane.clear();
    this.hint.clear();
    this.highlight.clear();
    this.hitArea.clear();

    const v = state.vessel;
    if (v.phase === 'reviewed') {
      this.hitArea.eventMode = 'none';
      return;
    }

    if (v.phase === 'building') {
      this.drawPile(v.deliveredBlocks, v.requiredBlocks);
      this.pile.x = PAD.x;
      this.pile.y = PAD.y;
      this.airplane.x = PAD.x;
      this.airplane.y = PAD.y;
      this.airplane.rotation = 0;
      this.drawSelectionHalo(selected);
      this.drawHitArea();
      return;
    }

    if (v.phase === 'ready') {
      const breath = 1 + Math.sin(this.pulse * 3) * 0.08;
      this.hint.circle(PAD.x, PAD.y - 4, 70 * breath).fill({ color: 0xfff2cf, alpha: 0.18 });
      this.hint.circle(PAD.x, PAD.y - 4, 50 * breath).fill({ color: 0xffe680, alpha: 0.22 });
      this.drawVessel(state, 1);
      this.airplane.x = PAD.x;
      this.airplane.y = PAD.y - 4;
      this.airplane.rotation = -0.08;
      this.drawSelectionHalo(selected);
      this.drawHitArea();
      return;
    }

    // In flight or crashed — no selection, no hit area.
    this.hitArea.eventMode = 'none';

    let x = PAD.x;
    let y = PAD.y;
    let rotation = 0;
    let scale = 1;

    if (v.phase === 'launching') {
      if (v.launchTimer < SHUDDER_MS) {
        // Pre-launch shudder: stay on the pad, jitter horizontally, kick up dust.
        const shake = Math.sin(v.launchTimer * 0.08) * 4;
        x = PAD.x + shake;
        y = PAD.y - 4;
        rotation = -0.08 + Math.sin(v.launchTimer * 0.06) * 0.04;
        this.dustCooldownMs -= dtMs;
        if (this.dustCooldownMs <= 0 && world) {
          world.particles.emit('crashDust', PAD.x, PAD.y + 12, 3);
          this.dustCooldownMs = 60;
        }
      } else {
        const t = Math.min(
          1,
          (v.launchTimer - SHUDDER_MS) / (TUNING.LAUNCH_DURATION_MS - SHUDDER_MS),
        );
        const eased = 1 - Math.pow(1 - t, 2);
        y = PAD.y + (APEX_Y - PAD.y) * eased;
        rotation = -0.3 + Math.sin(t * 6) * 0.05;
        // Big takeoff puff once we leave the pad.
        if (this.dustCooldownMs >= 0 && world) {
          world.particles.emit('crashDust', PAD.x, PAD.y + 14, 8);
          this.dustCooldownMs = -1;
        }
      }
    } else if (v.phase === 'crashing') {
      const t = Math.min(1, v.launchTimer / TUNING.CRASH_DURATION_MS);
      const eased = t * t;
      y = APEX_Y + (PAD.y + 40 - APEX_Y) * eased;
      rotation = 0.6 + t * 1.4;
    } else if (v.phase === 'crashed') {
      y = PAD.y + 40;
      rotation = Math.PI * 0.7;
      scale = 0.95;
    }

    this.drawVessel(state, scale);
    this.airplane.x = x;
    this.airplane.y = y;
    this.airplane.rotation = rotation;
  }

  private drawSelectionHalo(selected: boolean): void {
    if (!selected) return;
    const breath = 1 + Math.sin(this.pulse * 3) * 0.08;
    this.highlight
      .circle(PAD.x, PAD.y - 2, 60 * breath)
      .fill({ color: 0xfff2cf, alpha: 0.22 });
    this.highlight
      .circle(PAD.x, PAD.y - 2, 44 * breath)
      .fill({ color: 0xffe680, alpha: 0.18 });
  }

  private drawHitArea(): void {
    this.hitArea.eventMode = 'static';
    // Generous box around the vessel pad / airplane.
    this.hitArea
      .roundRect(PAD.x - 60, PAD.y - 40, 120, 80, 10)
      .fill({ color: 0xffffff, alpha: 0.001 });
  }

  private drawPile(delivered: number, required: number): void {
    const g = this.pile;
    const blockSize = 7;
    let placed = 0;
    let row = 0;
    while (placed < delivered) {
      const inThisRow = Math.max(1, 4 - row);
      const startX = -((inThisRow - 1) * blockSize);
      for (let i = 0; i < inThisRow && placed < delivered; i++) {
        const cx = startX + i * blockSize * 2;
        const cy = -row * blockSize * 1.5 - 4;
        drawHex(g, cx, cy, blockSize);
        placed += 1;
      }
      row += 1;
    }
    if (delivered < required) {
      g.poly([40, 0, -30, -18, -10, 0, -30, 18])
        .stroke({ color: 0x9a8d65, width: 1, alpha: 0.3 });
    }
  }

  private drawVessel(state: GameState, scale: number): void {
    const cfg = vesselTierConfig(state.vessel.tier);
    const g = this.airplane;
    const s = scale;
    switch (cfg.shape) {
      case 'airplane':
        this.drawAirplane(g, s);
        break;
      case 'balloon':
        this.drawBalloon(g, s);
        break;
      case 'propeller':
        this.drawPropeller(g, s);
        break;
      case 'jet':
        this.drawJet(g, s);
        break;
    }
  }

  private drawAirplane(g: Graphics, s: number): void {
    g.poly([40 * s, 0, -30 * s, -18 * s, -10 * s, 0, -30 * s, 18 * s])
      .fill(0xfaf6e8)
      .stroke({ color: 0x6e6240, width: 2 });
    g.moveTo(40 * s, 0).lineTo(-30 * s, 0).stroke({ color: 0x9a8d65, width: 1 });
  }

  private drawBalloon(g: Graphics, s: number): void {
    // Round envelope
    g.circle(0, -30 * s, 34 * s).fill(0xff8b3a).stroke({ color: 0x8a3a18, width: 2 });
    // Striped panels (vertical wedges)
    g.poly([0, -64 * s, -12 * s, -30 * s, 12 * s, -30 * s]).fill({ color: 0xffd23f, alpha: 0.85 });
    g.poly([0, 4 * s, -12 * s, -30 * s, 12 * s, -30 * s]).fill({ color: 0xffd23f, alpha: 0.85 });
    // Ropes
    g.moveTo(-22 * s, -10 * s).lineTo(-14 * s, 14 * s).stroke({ color: 0x4a3520, width: 1.5 });
    g.moveTo(22 * s, -10 * s).lineTo(14 * s, 14 * s).stroke({ color: 0x4a3520, width: 1.5 });
    // Basket
    g.rect(-16 * s, 14 * s, 32 * s, 16 * s).fill(0x8a5a2b).stroke({ color: 0x4a3520, width: 1.5 });
  }

  private drawPropeller(g: Graphics, s: number): void {
    // Fuselage
    g.roundRect(-32 * s, -6 * s, 56 * s, 14 * s, 6).fill(0xc5d5e0).stroke({ color: 0x4a5560, width: 2 });
    // Cockpit window
    g.circle(10 * s, -2 * s, 4 * s).fill(0x6ab0e0);
    // Wings (horizontal)
    g.rect(-20 * s, -2 * s, 36 * s, 4 * s).fill(0xa0b0c0);
    // Tail fin
    g.poly([-32 * s, -6 * s, -38 * s, -16 * s, -28 * s, -6 * s]).fill(0xa0b0c0);
    // Propeller — spinning illusion: two crossed blades
    g.rect(22 * s, -1 * s, 8 * s, 2 * s).fill(0x4a3520);
    const spin = (this.pulse * 12) % 1;
    const a = spin * Math.PI;
    g.rect(28 * s - 1, -10 * s, 2, 20 * s).fill({ color: 0x6e5a3a, alpha: 1 - spin });
    const cy = Math.sin(a) * 10 * s;
    g.rect(28 * s - 1, cy - 1, 2, 2).fill(0x4a3520);
  }

  private drawJet(g: Graphics, s: number): void {
    // Sleek body
    g.poly([
      40 * s, 0,
      30 * s, -8 * s,
      -28 * s, -10 * s,
      -34 * s, -4 * s,
      -34 * s, 4 * s,
      -28 * s, 10 * s,
      30 * s, 8 * s,
    ]).fill(0xb8c4cc).stroke({ color: 0x4a5560, width: 2 });
    // Cockpit
    g.circle(20 * s, -2 * s, 4 * s).fill(0x6ab0e0);
    // Swept wings (delta-ish)
    g.poly([-6 * s, -8 * s, -20 * s, -22 * s, 4 * s, -10 * s]).fill(0x8a98a6);
    g.poly([-6 * s, 8 * s, -20 * s, 22 * s, 4 * s, 10 * s]).fill(0x8a98a6);
    // Tail fin
    g.poly([-28 * s, -8 * s, -36 * s, -22 * s, -22 * s, -10 * s]).fill(0x8a98a6);
    // Afterburner glow
    g.circle(-34 * s, 0, 4 * s).fill({ color: 0xff8855, alpha: 0.7 });
    g.circle(-34 * s, 0, 2 * s).fill(0xffe680);
  }
}

function drawHex(g: Graphics, cx: number, cy: number, r: number): void {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.poly(pts).fill(0xfff2cf).stroke({ color: 0xb89858, width: 1 });
}
