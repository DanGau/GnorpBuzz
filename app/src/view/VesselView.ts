import { Container, Graphics, FederatedPointerEvent } from 'pixi.js';
import type { GameState } from '../sim/state';
import { TUNING } from '../sim/state';
import { WORLD } from '../world/layout';

const PAD = WORLD.VESSEL_PAD;
const APEX_Y = 200;

export class VesselView {
  readonly container: Container;
  private pile: Graphics;
  private airplane: Graphics;
  private hint: Graphics;
  private hitArea: Graphics;
  private pulse = 0;
  private onLaunch: () => void;

  constructor(onLaunch: () => void) {
    this.onLaunch = onLaunch;
    this.container = new Container();
    this.pile = new Graphics();
    this.airplane = new Graphics();
    this.hint = new Graphics();
    this.hitArea = new Graphics();
    this.container.addChild(this.pile);
    this.container.addChild(this.hint);
    this.container.addChild(this.airplane);
    this.container.addChild(this.hitArea);

    // The hit area sits invisibly on top of the airplane and only catches
    // clicks while the vessel is 'ready'. It's enabled/disabled in update().
    this.hitArea.eventMode = 'none';
    this.hitArea.cursor = 'pointer';
    this.hitArea.on('pointertap', (_e: FederatedPointerEvent) => {
      this.onLaunch();
    });
  }

  update(state: GameState, dtMs: number): void {
    this.pulse += dtMs / 1000;
    this.pile.clear();
    this.airplane.clear();
    this.hint.clear();

    const v = state.vessel;
    if (v.phase === 'reviewed') {
      this.hitArea.eventMode = 'none';
      this.hitArea.clear();
      return;
    }

    if (v.phase === 'building') {
      this.drawPile(v.deliveredBlocks, v.requiredBlocks);
      this.pile.x = PAD.x;
      this.pile.y = PAD.y;
      this.airplane.x = PAD.x;
      this.airplane.y = PAD.y;
      this.airplane.rotation = 0;
      this.hitArea.eventMode = 'none';
      this.hitArea.clear();
      return;
    }

    if (v.phase === 'ready') {
      // Airplane assembled, sitting on the pad, gently glowing/pulsing
      const breath = 1 + Math.sin(this.pulse * 3) * 0.08;
      // Glow halo
      this.hint.circle(PAD.x, PAD.y - 4, 70 * breath).fill({ color: 0xfff2cf, alpha: 0.18 });
      this.hint.circle(PAD.x, PAD.y - 4, 50 * breath).fill({ color: 0xffe680, alpha: 0.22 });
      this.drawAirplane(1);
      this.airplane.x = PAD.x;
      this.airplane.y = PAD.y - 4;
      this.airplane.rotation = -0.08;
      // Activate hit area
      this.hitArea.eventMode = 'static';
      this.hitArea.clear();
      this.hitArea
        .roundRect(PAD.x - 60, PAD.y - 30, 120, 50, 8)
        .fill({ color: 0xffffff, alpha: 0.001 });
      return;
    }

    let x = PAD.x;
    let y = PAD.y;
    let rotation = 0;
    let scale = 1;

    if (v.phase === 'launching') {
      const t = Math.min(1, v.launchTimer / TUNING.LAUNCH_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 2);
      y = PAD.y + (APEX_Y - PAD.y) * eased;
      rotation = -0.3 + Math.sin(t * 6) * 0.05;
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
    this.hitArea.eventMode = 'none';
    this.hitArea.clear();
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
