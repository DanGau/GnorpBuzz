import { Container, Graphics } from 'pixi.js';
import type { World } from '../world/World';
import type { GameState, ForagerHiveData, WaxHiveData } from '../sim/state';

// Renders Forager Hives (with visible pollen pots) and Wax Hives (with a
// visible cream-block stockpile). Each hive is interactive — clicking the
// body fires the onHiveClick callback. The selected hive gets a glowing
// halo + subtle scale pulse.

interface HiveSprite {
  id: string;
  type: 'forager' | 'wax';
  highlight: Graphics;
  body: Graphics;
  pollenPots: Graphics;
  blockStockpile: Graphics;
  x: number;
  y: number;
}

export class HiveView {
  readonly container: Container;
  private sprites: Map<string, HiveSprite>;
  private onHiveClick: (id: string) => void;
  private pulse = 0;

  constructor(onHiveClick: (id: string) => void) {
    this.container = new Container();
    this.sprites = new Map();
    this.onHiveClick = onHiveClick;
  }

  update(state: GameState, world: World, selectedHiveId: string | null, dtMs: number): void {
    this.pulse += dtMs / 1000;

    for (const hive of world.hives.values()) {
      if (!this.sprites.has(hive.hiveId)) {
        const highlight = new Graphics();
        const body = new Graphics();
        const pollenPots = new Graphics();
        const blockStockpile = new Graphics();
        for (const g of [highlight, body, pollenPots, blockStockpile]) {
          g.x = hive.x;
          g.y = hive.y;
          this.container.addChild(g);
        }
        // Make the body interactive — click fires selection callback.
        body.eventMode = 'static';
        body.cursor = 'pointer';
        const id = hive.hiveId;
        body.on('pointertap', (e) => {
          e.stopPropagation();
          this.onHiveClick(id);
        });
        const sprite: HiveSprite = {
          id: hive.hiveId,
          type: hive.type,
          highlight,
          body,
          pollenPots,
          blockStockpile,
          x: hive.x,
          y: hive.y,
        };
        this.drawBody(sprite);
        this.sprites.set(hive.hiveId, sprite);
      }
    }
    const liveIds = new Set(Array.from(world.hives.values()).map((h) => h.hiveId));
    for (const [id, sprite] of this.sprites) {
      if (!liveIds.has(id)) {
        for (const g of [sprite.highlight, sprite.body, sprite.pollenPots, sprite.blockStockpile]) {
          this.container.removeChild(g);
          g.destroy();
        }
        this.sprites.delete(id);
      }
    }

    for (const sprite of this.sprites.values()) {
      const simHive = state.hives.find((h) => h.id === sprite.id);
      if (!simHive) continue;
      if (sprite.type === 'forager') {
        this.drawPollenPots(sprite, (simHive as ForagerHiveData).pollen);
      } else {
        this.drawBlockStockpile(sprite, (simHive as WaxHiveData).waxBlocks);
      }
      this.drawHighlight(sprite, sprite.id === selectedHiveId);
    }
  }

  private drawHighlight(sprite: HiveSprite, selected: boolean): void {
    const g = sprite.highlight;
    g.clear();
    if (!selected) return;
    const breath = 1 + Math.sin(this.pulse * 3) * 0.08;
    g.ellipse(0, -8, 56 * breath, 60 * breath).fill({ color: 0xfff2cf, alpha: 0.18 });
    g.ellipse(0, -8, 44 * breath, 48 * breath).fill({ color: 0xffe680, alpha: 0.18 });
    // Crisp outline ring at the hive base
    g.ellipse(0, 16, 42, 8).stroke({ color: 0xffe680, width: 2, alpha: 0.9 });
  }

  private drawBody(sprite: HiveSprite): void {
    const g = sprite.body;
    g.clear();
    if (sprite.type === 'forager') {
      const bands = [
        { y: -50, w: 50, h: 18 },
        { y: -32, w: 60, h: 18 },
        { y: -14, w: 65, h: 18 },
        { y: 4, w: 60, h: 18 },
      ];
      const colors = [0xe8b04c, 0xd49a36, 0xc18922, 0xa6741b];
      for (let i = 0; i < bands.length; i++) {
        const b = bands[i];
        g.roundRect(-b.w / 2, b.y, b.w, b.h, 6).fill(colors[i]);
      }
      g.circle(0, 0, 7).fill(0x3a2a10);
    } else {
      g.rect(-32, -45, 64, 50).fill(0xc7a86a);
      g.rect(-32, -45, 64, 6).fill(0x8d7440);
      for (let i = 0; i < 4; i++) {
        g.rect(-32 + i * 16, -45, 1, 50).fill({ color: 0x8d7440, alpha: 0.4 });
      }
      g.roundRect(-8, -10, 16, 18, 2).fill(0x3a2a10);
      g.rect(12, -60, 10, 18).fill(0x8d7440);
      g.rect(11, -62, 12, 4).fill(0x6b5631);
    }
    g.ellipse(0, 14, 36, 6).fill({ color: 0x000000, alpha: 0.25 });
  }

  private drawPollenPots(sprite: HiveSprite, pollen: number): void {
    const g = sprite.pollenPots;
    g.clear();
    if (pollen <= 0) return;
    const maxVisible = 6;
    const shown = Math.min(maxVisible, pollen);
    const startX = -25;
    for (let i = 0; i < shown; i++) {
      const x = startX + i * 10;
      const y = 18;
      g.roundRect(x - 4, y - 5, 8, 8, 2).fill(0x8b5a2b);
      g.circle(x, y - 2, 3).fill(0xf5d166);
    }
    if (pollen > maxVisible) {
      const overflow = Math.min(20, pollen - maxVisible);
      for (let i = 0; i < overflow; i++) {
        const px = startX + maxVisible * 10 + (i % 4) * 3;
        const py = 18 - Math.floor(i / 4) * 3;
        g.circle(px, py, 1.5).fill(0xf5d166);
      }
    }
  }

  private drawBlockStockpile(sprite: HiveSprite, blocks: number): void {
    const g = sprite.blockStockpile;
    g.clear();
    if (blocks <= 0) return;
    const maxVisible = 8;
    const shown = Math.min(maxVisible, blocks);
    for (let i = 0; i < shown; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = -42 + col * 10;
      const cy = 12 - row * 8;
      drawHex(g, cx, cy, 4);
    }
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
