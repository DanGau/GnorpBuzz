import { Container, Graphics } from 'pixi.js';
import type { GameState } from '../sim/state';
import { TUNING } from '../sim/state';
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
      this.drawAirplane(1);
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

    this.drawAirplane(scale);
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

  private drawAirplane(scale: number): void {
    const g = this.airplane;
    const s = scale;
    g.poly([40 * s, 0, -30 * s, -18 * s, -10 * s, 0, -30 * s, 18 * s])
      .fill(0xfaf6e8)
      .stroke({ color: 0x6e6240, width: 2 });
    g.moveTo(40 * s, 0).lineTo(-30 * s, 0).stroke({ color: 0x9a8d65, width: 1 });
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
