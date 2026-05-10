import { Container, Graphics } from 'pixi.js';
import type { GameState } from '../sim/state';
import { TUNING } from '../sim/state';
import { WORLD } from '../world/layout';

// Renders the vessel through its build → launch → crash arc.
// During building: a growing pile of wax blocks at the pad. When all blocks
// are delivered, the pile transforms into a paper airplane that launches.

const PAD = WORLD.VESSEL_PAD;
const APEX_Y = 200;

export class VesselView {
  readonly container: Container;
  private pile: Graphics; // building-phase pile of blocks
  private airplane: Graphics;

  constructor() {
    this.container = new Container();
    this.pile = new Graphics();
    this.airplane = new Graphics();
    this.container.addChild(this.pile);
    this.container.addChild(this.airplane);
  }

  update(state: GameState): void {
    this.pile.clear();
    this.airplane.clear();

    const v = state.vessel;
    if (v.phase === 'reviewed') return;

    if (v.phase === 'building') {
      this.drawPile(v.deliveredBlocks, v.requiredBlocks);
      this.pile.x = PAD.x;
      this.pile.y = PAD.y;
      this.pile.rotation = 0;
      this.airplane.x = PAD.x;
      this.airplane.y = PAD.y;
      this.airplane.rotation = 0;
      return;
    }

    // Airplane in flight or crashed
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
  }

  private drawPile(delivered: number, required: number): void {
    const g = this.pile;
    // Stack delivered blocks pyramid-style. Up to ~8 blocks; visually scale
    // each block so the pyramid sits cleanly on the pad.
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
    // Faint outline of where the airplane will appear
    if (delivered < required) {
      g.poly([
        40, 0,
        -30, -18,
        -10, 0,
        -30, 18,
      ]).stroke({ color: 0x9a8d65, width: 1, alpha: 0.3 });
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
