import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';

// A Subnautica-style branching radial menu rendered in Pixi. Hex-shaped
// option bubbles fan out from an anchor (a hive cell) along an outward
// direction, on a short arc. Selecting an option fires its callback.
//
// Lives in world space — caller adds `container` to whichever parent matches
// its desired coordinate frame, then drives `open` / `refresh` / `close`
// every frame. `update(dtMs)` animates the open/close transition.

export interface RadialOption {
  id: string;
  title: string;
  detail?: string;
  glyph?: string;
  color?: number;
  enabled: boolean;
  onSelect: () => void;
}

export interface RadialMenuOptions {
  hexSize: number;
  spreadDeg?: number;
  radiusFactor?: number;
}

interface Item {
  id: string;
  container: Container;
  hex: Graphics;
  glyph: Text;
  title: Text;
  // Cost badge — a small circular chip docked to the lower-right corner of
  // the hex with the cost text inside. Optional: hidden when no detail set.
  badge: Container;
  badgeGfx: Graphics;
  badgeText: Text;
  targetX: number;
  targetY: number;
  enabled: boolean;
  color: number;
  onSelect: () => void;
}

const ANIM_MS = 220;
// Text lives in world space and gets scaled up ~5x by the hive camera. We
// rasterize fonts at SUPERSAMPLE× the world-unit size, then scale the Text
// node down by 1/SUPERSAMPLE so the final on-screen size is unchanged but
// the texture has plenty of pixels to remain crisp.
const TEXT_SUPERSAMPLE = 6;

export class RadialMenu {
  readonly container: Container;
  private items = new Map<string, Item>();
  private order: string[] = [];
  private anchorX = 0;
  private anchorY = 0;
  private dirX = 0;
  private dirY = -1;
  private opts: Required<RadialMenuOptions>;
  private state: 'closed' | 'opening' | 'open' | 'closing' = 'closed';
  private animMs = 0;
  private signature = '';

  constructor(opts: RadialMenuOptions) {
    this.opts = {
      spreadDeg: 110,
      radiusFactor: 4.6,
      ...opts,
    };
    this.container = new Container();
    this.container.visible = false;
    this.container.eventMode = 'static';
  }

  // Configure or update the menu. If the option ids match the current set,
  // labels/enabled state are refreshed in place without recreating sprites.
  // Otherwise the sprites are rebuilt and the open animation restarts.
  show(
    anchor: { x: number; y: number },
    outward: { x: number; y: number },
    options: RadialOption[],
  ): void {
    this.anchorX = anchor.x;
    this.anchorY = anchor.y;
    const len = Math.hypot(outward.x, outward.y);
    if (len > 0.0001) {
      this.dirX = outward.x / len;
      this.dirY = outward.y / len;
    } else {
      this.dirX = 0;
      this.dirY = -1;
    }

    this.container.x = this.anchorX;
    this.container.y = this.anchorY;

    const sig = options.map((o) => o.id).join('|');
    if (sig !== this.signature) {
      this.rebuild(options);
      this.signature = sig;
      this.state = 'opening';
      this.animMs = 0;
    } else {
      this.refreshExisting(options);
      if (this.state === 'closed' || this.state === 'closing') {
        this.state = 'opening';
        this.animMs = 0;
      }
    }
    this.container.visible = true;
  }

  hide(): void {
    if (this.state === 'closed') {
      this.container.visible = false;
      return;
    }
    if (this.state !== 'closing') {
      // Reverse from current animation progress so closing feels symmetric.
      this.animMs = ANIM_MS - this.animMs;
      this.state = 'closing';
    }
  }

  update(dtMs: number): void {
    if (this.state === 'closed') return;

    this.animMs = Math.min(ANIM_MS, this.animMs + dtMs);
    const t = this.animMs / ANIM_MS;
    const opening = this.state === 'opening' || this.state === 'open';
    const alpha = opening ? Math.min(1, t * 1.6) : 1 - t;

    for (let i = 0; i < this.order.length; i++) {
      const id = this.order[i];
      const item = this.items.get(id);
      if (!item) continue;
      // Stagger each child slightly so the fan blooms outward.
      const delay = i * 0.06;
      const localT = clamp((t - delay) / Math.max(0.0001, 1 - delay), 0, 1);
      const localP = opening ? easeOutBack(localT) : 1 - easeInCubic(t);
      const scale = 0.2 + 0.8 * localP;
      item.container.x = item.targetX * localP;
      item.container.y = item.targetY * localP;
      item.container.scale.set(scale);
      item.container.alpha = alpha;
    }

    if (this.animMs >= ANIM_MS) {
      if (this.state === 'opening') {
        this.state = 'open';
      } else if (this.state === 'closing') {
        this.state = 'closed';
        this.container.visible = false;
      }
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  private rebuild(options: RadialOption[]): void {
    for (const item of this.items.values()) {
      this.container.removeChild(item.container);
      item.container.destroy({ children: true });
    }
    this.items.clear();
    this.order = [];

    for (const opt of options) {
      const item = this.createItem(opt);
      this.items.set(opt.id, item);
      this.order.push(opt.id);
      this.container.addChild(item.container);
    }
    this.layoutItems();
    this.refreshExisting(options);
  }

  private refreshExisting(options: RadialOption[]): void {
    for (const opt of options) {
      const item = this.items.get(opt.id);
      if (!item) continue;
      item.enabled = opt.enabled;
      item.color = opt.color ?? 0xe8b04c;
      item.onSelect = opt.onSelect;
      if (item.title.text !== opt.title) item.title.text = opt.title;
      const detailText = opt.detail ?? '';
      if (item.badgeText.text !== detailText) item.badgeText.text = detailText;
      item.badge.visible = detailText.length > 0;
      const glyphText = opt.glyph ?? '';
      if (item.glyph.text !== glyphText) item.glyph.text = glyphText;
      this.drawItemHex(item);
      this.drawBadge(item);
      item.container.cursor = opt.enabled ? 'pointer' : 'not-allowed';
      item.container.alpha = opt.enabled ? 1 : 0.85;
    }
  }

  private createItem(opt: RadialOption): Item {
    const c = new Container();
    c.eventMode = 'static';
    const hex = new Graphics();
    // Glyph in the upper half of the hex, label in the lower half — both
    // live INSIDE the bubble so the option reads as one unit.
    const glyph = makeCrispText(opt.glyph ?? '', itemGlyphStyle(this.opts.hexSize));
    glyph.y = -this.opts.hexSize * 0.4;
    const title = makeCrispText(opt.title, itemTitleStyle(this.opts.hexSize));
    title.y = this.opts.hexSize * 0.8;
    // Cost badge — circular chip in the lower-right corner of the hex.
    const badge = new Container();
    const badgeGfx = new Graphics();
    const badgeText = makeCrispText('', itemDetailStyle(this.opts.hexSize));
    badge.addChild(badgeGfx, badgeText);
    // Center the badge exactly ON the upper-right vertex of the pointy-top
    // hex — the corner pierces the badge for a "notification chip" feel.
    const hexOuter = this.opts.hexSize * 1.95;
    const cornerAngle = -Math.PI / 6; // upper-right vertex of a pointy-top hex
    badge.x = Math.cos(cornerAngle) * hexOuter;
    badge.y = Math.sin(cornerAngle) * hexOuter;
    c.addChild(hex, glyph, title, badge);
    const item: Item = {
      id: opt.id,
      container: c,
      hex,
      glyph,
      title,
      badge,
      badgeGfx,
      badgeText,
      targetX: 0,
      targetY: 0,
      enabled: opt.enabled,
      color: opt.color ?? 0xe8b04c,
      onSelect: opt.onSelect,
    };
    c.on('pointertap', (e) => {
      e.stopPropagation();
      if (!item.enabled) return;
      item.onSelect();
    });
    return item;
  }

  private layoutItems(): void {
    const n = this.order.length;
    if (n === 0) return;
    const radius = this.opts.hexSize * this.opts.radiusFactor;
    const spread = (this.opts.spreadDeg * Math.PI) / 180;
    // Angle of the outward direction in standard math (y up). dirY points
    // down in screen space, so atan2 is fine — we're rotating around z.
    const baseAngle = Math.atan2(this.dirY, this.dirX);
    const step = n === 1 ? 0 : spread / (n - 1);
    const start = baseAngle - spread / 2;
    for (let i = 0; i < n; i++) {
      const item = this.items.get(this.order[i]);
      if (!item) continue;
      const a = n === 1 ? baseAngle : start + step * i;
      item.targetX = Math.cos(a) * radius;
      item.targetY = Math.sin(a) * radius;
    }
  }

  private drawBadge(item: Item): void {
    const g = item.badgeGfx;
    g.clear();
    if (!item.badge.visible) return;
    // Pad the circle to fit the text — costs can be "FREE", "12", etc.
    const padX = this.opts.hexSize * 0.12;
    const padY = this.opts.hexSize * 0.06;
    const tw = item.badgeText.width;
    const th = item.badgeText.height;
    const radius = Math.max(this.opts.hexSize * 0.35, Math.hypot(tw / 2 + padX, th / 2 + padY));
    // Affordability color shift: warm gold when the player can afford it,
    // muted gray when not. The hex bubble itself also dims (alpha) so the
    // badge is a redundant cue.
    const fill = item.enabled ? 0xf5d166 : 0x6a5634;
    const stroke = item.enabled ? 0x6e4a16 : 0x2a2012;
    g.circle(0, 0, radius)
      .fill({ color: fill, alpha: 1 })
      .stroke({ color: stroke, width: Math.max(1, this.opts.hexSize * 0.07), alpha: 0.95 });
  }

  private drawItemHex(item: Item): void {
    const size = this.opts.hexSize * 1.95;
    const g = item.hex;
    g.clear();
    const pts = hexPoints(size);
    const innerPts = hexPoints(size * 0.86);
    const stroke = Math.max(1, size * 0.1);
    const fill = item.enabled ? item.color : 0x4a3a22;
    g.poly(pts).fill({ color: 0x120b03, alpha: 0.95 });
    g.poly(innerPts).fill({ color: fill, alpha: item.enabled ? 0.95 : 0.75 });
    g.poly(pts).stroke({
      color: item.enabled ? 0xfff2cf : 0x6a5634,
      width: stroke,
      alpha: 0.9,
    });
    // Hit area = the outer hex polygon.
    g.hitArea = { contains: (x, y) => pointInHex(x, y, size) };
  }
}

function hexPoints(size: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(Math.cos(a) * size, Math.sin(a) * size);
  }
  return pts;
}

function pointInHex(x: number, y: number, size: number): boolean {
  // Pointy-top hex: inscribed circle radius is size * sqrt(3)/2 along the
  // flat axes. Cheap conservative test using axis-aligned bounds + slope.
  const qx = Math.abs(x);
  const qy = Math.abs(y);
  if (qy > size) return false;
  const limit = (size - qy / 2) * Math.sqrt(3) * 0.5 + size * 0.5;
  return qx <= limit;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = t - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

function easeInCubic(t: number): number {
  return t * t * t;
}

// Build a Text whose texture is rasterized at SUPERSAMPLE×, then scale the
// node back down so its visual size matches the requested world-unit font
// size — but with a high-res texture so the camera's upscaling stays crisp.
function makeCrispText(
  text: string,
  style: TextStyleOptions,
  anchor: { ax?: number; ay?: number } = {},
): Text {
  const t = new Text({ text, style });
  t.anchor.set(anchor.ax ?? 0.5, anchor.ay ?? 0.5);
  t.scale.set(1 / TEXT_SUPERSAMPLE);
  return t;
}

function itemGlyphStyle(hexSize: number): TextStyleOptions {
  return {
    fontFamily: 'system-ui, sans-serif',
    fontSize: Math.max(8, hexSize * 0.95) * TEXT_SUPERSAMPLE,
    fontWeight: '700',
    fill: 0x1a1408,
    align: 'center',
  };
}

// In-hex role label — sits over the colored hex fill so we use a dark
// font for contrast against the gold/red bubble.
function itemTitleStyle(hexSize: number): TextStyleOptions {
  return {
    fontFamily: 'system-ui, sans-serif',
    fontSize: Math.max(5, hexSize * 0.42) * TEXT_SUPERSAMPLE,
    fontWeight: '700',
    fill: 0x1a1408,
    align: 'center',
  };
}

// Cost badge text — sits inside the gold circular badge, so use a dark
// fill for contrast.
function itemDetailStyle(hexSize: number): TextStyleOptions {
  return {
    fontFamily: 'system-ui, sans-serif',
    fontSize: Math.max(4, hexSize * 0.38) * TEXT_SUPERSAMPLE,
    fontWeight: '800',
    fill: 0x1a1408,
    align: 'center',
  };
}
