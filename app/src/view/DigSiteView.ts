import { Container, Graphics } from 'pixi.js';
import type { GameState } from '../sim/state';
import { TUNING } from '../sim/state';
import { WORLD } from '../world/layout';

// Renders the dig site as a massive cracked boulder anchored on the right
// side of the meadow. As HP falls the boulder shows ever more violent
// fissures and rubble; at the reveal moment a brilliant glow erupts and the
// uncovered artifact rises out of the split rock.

const SITE = WORLD.DIG_SITE;
const R = WORLD.DIG_SITE_RADIUS; // boulder visual radius

export class DigSiteView {
  readonly container: Container;
  private boulder: Graphics;
  private cracks: Graphics;
  private glow: Graphics;
  private artifactArt: Graphics;
  private highlight: Graphics;
  private hpBar: Graphics;
  private hitArea: Graphics;
  private pulse = 0;
  private onSelect: () => void;

  constructor(onSelect: () => void) {
    this.onSelect = onSelect;
    this.container = new Container();
    this.highlight = new Graphics();
    this.glow = new Graphics();
    this.boulder = new Graphics();
    this.cracks = new Graphics();
    this.artifactArt = new Graphics();
    this.hpBar = new Graphics();
    this.hitArea = new Graphics();

    this.container.addChild(this.highlight);
    this.container.addChild(this.glow);
    this.container.addChild(this.boulder);
    this.container.addChild(this.cracks);
    this.container.addChild(this.artifactArt);
    this.container.addChild(this.hpBar);
    this.container.addChild(this.hitArea);

    this.hitArea.eventMode = 'static';
    this.hitArea.cursor = 'pointer';
    this.hitArea.on('pointertap', (e) => {
      e.stopPropagation();
      this.onSelect();
    });
  }

  update(state: GameState, dtMs: number, selected: boolean): void {
    this.pulse += dtMs / 1000;
    this.boulder.clear();
    this.cracks.clear();
    this.glow.clear();
    this.artifactArt.clear();
    this.highlight.clear();
    this.hpBar.clear();
    this.hitArea.clear();

    const site = state.digSite;
    const hpFrac = site.maxHp > 0 ? site.hp / site.maxHp : 0;
    const damageFrac = 1 - hpFrac;

    if (state.ascent.phase !== 'none') {
      this.hitArea.eventMode = 'none';
      return;
    }

    this.drawBoulder(damageFrac);
    this.drawCracks(damageFrac);

    if (site.state === 'revealing' || state.artifacts.pending) {
      const breath = 1 + Math.sin(this.pulse * 3) * 0.12;
      // Massive reveal glow scaled to the boulder.
      this.glow.circle(SITE.x, SITE.y - 30, R * 1.6 * breath).fill({ color: 0xfff2cf, alpha: 0.28 });
      this.glow.circle(SITE.x, SITE.y - 30, R * 1.05 * breath).fill({ color: 0xffe680, alpha: 0.38 });
      this.glow.circle(SITE.x, SITE.y - 30, R * 0.6 * breath).fill({ color: 0xfff8d0, alpha: 0.5 });
      this.drawArtifact(state, breath);
    }

    if (selected) this.drawSelectionHalo();
    this.drawHpBar(hpFrac, site.state);
    this.drawHitArea();
  }

  private drawHpBar(hpFrac: number, siteState: string): void {
    // Slim always-visible HP bar floating above the boulder. The detailed
    // panel (numbers + tier name) is selection-gated.
    if (siteState === 'sealed') return;
    const g = this.hpBar;
    const w = R * 1.4;
    const h = 8;
    const x = SITE.x - w / 2;
    const y = SITE.y - R - 22;
    // Frame
    g.roundRect(x - 1, y - 1, w + 2, h + 2, 4).fill({ color: 0x000000, alpha: 0.55 });
    // Track
    g.roundRect(x, y, w, h, 3).fill({ color: 0x2a1d10, alpha: 0.9 });
    // Fill — color shifts from green → amber → red as HP drains.
    const fillW = Math.max(0, Math.min(1, hpFrac)) * w;
    const fillColor =
      hpFrac > 0.55 ? 0x4caf50 : hpFrac > 0.25 ? 0xf2b347 : 0xe04848;
    if (fillW > 0) {
      g.roundRect(x, y, fillW, h, 3).fill(fillColor);
      // Subtle highlight on the top half of the fill.
      g.rect(x + 1, y + 1, Math.max(0, fillW - 2), h / 2 - 1).fill({
        color: 0xffffff,
        alpha: 0.18,
      });
    }
  }

  private drawHitArea(): void {
    this.hitArea.eventMode = 'static';
    this.hitArea
      .roundRect(SITE.x - R - 10, SITE.y - R - 10, R * 2 + 20, R * 2 + 30, 12)
      .fill({ color: 0xffffff, alpha: 0.001 });
  }

  private drawSelectionHalo(): void {
    const breath = 1 + Math.sin(this.pulse * 3) * 0.08;
    this.highlight
      .ellipse(SITE.x, SITE.y + R * 0.7, R * 1.2 * breath, 18 * breath)
      .stroke({ color: 0xffe680, width: 2, alpha: 0.9 });
  }

  private drawBoulder(damageFrac: number): void {
    const g = this.boulder;
    const cx = SITE.x;
    const cy = SITE.y;

    // Crater shadow on the ground — half-buried boulder feel.
    g.ellipse(cx, cy + R * 0.7, R * 1.15, 18)
      .fill({ color: 0x000000, alpha: 0.32 });
    // Soil ring around the base of the boulder where dirt has been kicked up.
    g.ellipse(cx, cy + R * 0.62, R * 1.08, 14)
      .fill({ color: 0x3a2a18, alpha: 0.55 });

    // Main boulder body — irregular blob built from overlapping ellipses.
    // Shrinks subtly as damage rises (chunks falling off).
    const damageShrink = 1 - damageFrac * 0.08;
    const w = R * 1.0 * damageShrink;
    const h = R * 0.95 * damageShrink;

    // Stone palette — cool grey with warm undertones.
    const stoneBase = 0x6e6258;
    const stoneShadow = 0x4a4036;
    const stoneHigh = 0x9c8e7c;

    // Bottom shadow lobe
    g.ellipse(cx + 8, cy + 14, w * 1.02, h * 0.95).fill(stoneShadow);
    // Main body
    g.ellipse(cx, cy, w, h).fill(stoneBase);
    // Upper lobe — gives the boulder an irregular silhouette
    g.ellipse(cx - w * 0.35, cy - h * 0.45, w * 0.7, h * 0.6).fill(stoneBase);
    g.ellipse(cx + w * 0.4, cy - h * 0.35, w * 0.65, h * 0.55).fill(stoneBase);
    // Top highlight (light from above)
    g.ellipse(cx - w * 0.18, cy - h * 0.55, w * 0.55, h * 0.3)
      .fill({ color: stoneHigh, alpha: 0.7 });
    g.ellipse(cx + w * 0.25, cy - h * 0.4, w * 0.32, h * 0.22)
      .fill({ color: stoneHigh, alpha: 0.55 });

    // Surface speckle — small darker dots for stone texture.
    let seed = 0xa5b7c9;
    const rand = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return ((seed >>> 0) % 10000) / 10000;
    };
    for (let i = 0; i < 28; i++) {
      const t = rand() * Math.PI * 2;
      const rr = (0.3 + rand() * 0.6) * Math.min(w, h);
      const sx = cx + Math.cos(t) * rr * 0.85;
      const sy = cy + Math.sin(t) * rr * 0.7;
      const sz = 1 + rand() * 2;
      g.circle(sx, sy, sz).fill({ color: stoneShadow, alpha: 0.55 });
    }

    // Rubble piles around the base — grow with damage.
    if (damageFrac > 0.15) {
      const piles = Math.min(8, Math.floor(damageFrac * 9));
      for (let i = 0; i < piles; i++) {
        const t = (i / piles) * Math.PI - Math.PI * 0.5; // bottom half arc
        const rx = cx + Math.cos(t) * R * (0.95 + rand() * 0.2);
        const ry = cy + R * 0.55 + Math.sin(t) * 12;
        g.ellipse(rx, ry, 12 + rand() * 8, 5 + rand() * 3).fill(stoneShadow);
      }
    }
    if (damageFrac > 0.45) {
      // Smaller scattered chunks further out.
      for (let i = 0; i < 10; i++) {
        const off = (rand() - 0.5) * R * 2.2;
        const rx = cx + off;
        const ry = cy + R * 0.7 + rand() * 12;
        g.circle(rx, ry, 2 + rand() * 2).fill(stoneShadow);
      }
    }
  }

  private drawCracks(damageFrac: number): void {
    if (damageFrac <= 0) return;
    const g = this.cracks;
    const cx = SITE.x;
    const cy = SITE.y - 8;

    // Fissure count and length both scale with damage.
    const numCracks = Math.min(8, 2 + Math.floor(damageFrac * 8));
    const baseLen = R * 0.55;
    for (let i = 0; i < numCracks; i++) {
      const a = (i / numCracks) * Math.PI * 2 + 0.3 + i * 0.13;
      const len = baseLen + damageFrac * R * 0.6;
      // Build a jagged polyline from origin to (cos*len, sin*len).
      const segments = 4;
      let lx: number = cx;
      let ly: number = cy;
      for (let s = 1; s <= segments; s++) {
        const frac = s / segments;
        const wobble = (i % 2 ? 1 : -1) * (1 - frac) * 6;
        const nx = cx + Math.cos(a) * len * frac + Math.cos(a + Math.PI / 2) * wobble;
        const ny = cy + Math.sin(a) * len * frac * 0.85 + Math.sin(a + Math.PI / 2) * wobble;
        g.moveTo(lx, ly)
          .lineTo(nx, ny)
          .stroke({ color: 0x1f1810, width: 2.4, alpha: 0.7 + damageFrac * 0.3 });
        lx = nx;
        ly = ny;
      }
    }

    // Hot inner glow that builds as the reveal nears.
    if (damageFrac > 0.55) {
      const glowAlpha = (damageFrac - 0.55) / 0.45;
      g.circle(cx, cy, 18 + damageFrac * 12).fill({ color: 0xffd86b, alpha: 0.4 * glowAlpha });
      g.circle(cx, cy, 8 + damageFrac * 6).fill({ color: 0xfff2cf, alpha: 0.55 * glowAlpha });
    }
  }

  private drawArtifact(state: GameState, breath: number): void {
    const g = this.artifactArt;
    const cx = SITE.x;
    const cy = SITE.y - R * 0.4;
    const tier = state.digSite.tier;
    // Artifacts render large now — proportional to the boulder.
    const s = 2.4 * (1 + (breath - 1) * 0.3);
    switch (tier) {
      case 1: // bottle cap
        g.circle(cx, cy, 9 * s).fill(0x1a4dbf).stroke({ color: 0xffffff, width: 1.5 });
        g.circle(cx, cy, 6 * s).fill({ color: 0x2a64d8, alpha: 0.9 });
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          g.circle(cx + Math.cos(a) * 8 * s, cy + Math.sin(a) * 8 * s, 1.6).fill(0x0a1a40);
        }
        break;
      case 2: // soda can
        g.rect(cx - 6 * s, cy - 10 * s, 12 * s, 20 * s).fill(0xc83a3a).stroke({ color: 0x501010, width: 1.5 });
        g.rect(cx - 6 * s, cy - 10 * s, 12 * s, 3 * s).fill(0xb0b0b0);
        g.rect(cx - 4 * s, cy - 3 * s, 8 * s, 6 * s).fill({ color: 0xffffff, alpha: 0.7 });
        break;
      case 3: // AirPod
        g.ellipse(cx, cy, 5 * s, 7 * s).fill(0xffffff).stroke({ color: 0x9a9a9a, width: 1.5 });
        g.rect(cx - 1.5 * s, cy + 4 * s, 3 * s, 10 * s).fill(0xffffff).stroke({ color: 0x9a9a9a, width: 1.5 });
        g.circle(cx, cy - 1 * s, 2).fill(0xa8b6c4);
        break;
      case 4: // lego brick
        g.rect(cx - 12 * s, cy - 5 * s, 24 * s, 10 * s).fill(0xd23a3a).stroke({ color: 0x6a1010, width: 1.5 });
        for (let i = 0; i < 4; i++) {
          const sx = cx - 10 * s + i * 6.5 * s;
          g.circle(sx, cy - 7 * s, 2.8).fill(0xff5a5a).stroke({ color: 0x6a1010, width: 0.8 });
        }
        break;
      case 5: // rubber duck
        g.ellipse(cx, cy + 2 * s, 10 * s, 6 * s).fill(0xffd23f).stroke({ color: 0xa67a10, width: 1.5 });
        g.circle(cx + 5 * s, cy - 4 * s, 5 * s).fill(0xffd23f).stroke({ color: 0xa67a10, width: 1.5 });
        g.poly([cx + 9 * s, cy - 4 * s, cx + 14 * s, cy - 3 * s, cx + 9 * s, cy - 2 * s]).fill(0xff8b3a);
        g.circle(cx + 6 * s, cy - 5 * s, 1.2).fill(0x000000);
        break;
      case 6: // cracked phone screen
        g.rect(cx - 7 * s, cy - 11 * s, 14 * s, 22 * s).fill(0x222a36).stroke({ color: 0x9a9a9a, width: 1.5 });
        g.rect(cx - 5 * s, cy - 9 * s, 10 * s, 18 * s).fill({ color: 0x4a7ab0, alpha: 0.7 });
        g.moveTo(cx - 4 * s, cy - 8 * s).lineTo(cx + 4 * s, cy + 6 * s).stroke({ color: 0xffffff, width: 1.5 });
        g.moveTo(cx, cy - 6 * s).lineTo(cx - 3 * s, cy + 4 * s).stroke({ color: 0xffffff, width: 1.5 });
        break;
      case 7: // mylar balloon
        g.circle(cx, cy - 2 * s, 11 * s).fill(0xff66aa).stroke({ color: 0x8a2050, width: 1.5 });
        g.ellipse(cx - 4 * s, cy - 6 * s, 4 * s, 2 * s).fill({ color: 0xffffff, alpha: 0.7 });
        g.moveTo(cx, cy + 9 * s).lineTo(cx - 2 * s, cy + 20 * s).stroke({ color: 0x444444, width: 1 });
        break;
    }
  }
}

export { TUNING };
