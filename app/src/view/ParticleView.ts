import { Container, Graphics } from 'pixi.js';
import type { Particle, ParticleSystem } from '../world/ParticleSystem';

const POOL_SIZE = 240;

// One Graphics per pool slot, reused. Hidden slots have visible=false.

export class ParticleView {
  readonly container: Container;
  private graphics: Graphics[];

  constructor() {
    this.container = new Container();
    this.graphics = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const g = new Graphics();
      g.visible = false;
      this.container.addChild(g);
      this.graphics.push(g);
    }
  }

  update(system: ParticleSystem): void {
    let i = 0;
    system.forEachActive((p) => {
      if (i >= this.graphics.length) return;
      const g = this.graphics[i++];
      g.visible = true;
      g.x = p.x;
      g.y = p.y;
      g.rotation = p.rotation;
      const lifeFrac = Math.min(1, p.ageMs / p.lifetimeMs);
      g.alpha = 1 - lifeFrac;
      g.clear();
      drawParticle(g, p, lifeFrac);
    });
    // Hide remaining sprites
    for (; i < this.graphics.length; i++) {
      const g = this.graphics[i];
      if (g.visible) g.visible = false;
    }
  }
}

function drawParticle(g: Graphics, p: Particle, lifeFrac: number): void {
  switch (p.type) {
    case 'pollenPuff': {
      const r = p.size * (1 + lifeFrac * 0.5);
      g.circle(0, 0, r).fill(0xf5d166);
      // Highlight dot
      g.circle(-r * 0.3, -r * 0.3, r * 0.4).fill({ color: 0xfff2bf, alpha: 0.7 });
      break;
    }
    case 'sparkle': {
      // Bell curve scale: 0 → 1 → 0.
      const s = Math.sin(lifeFrac * Math.PI);
      const r = 4 * s;
      // Four-point star
      g.poly([0, -r, r * 0.3, 0, 0, r, -r * 0.3, 0]).fill(0xffffff);
      g.poly([-r, 0, 0, -r * 0.3, r, 0, 0, r * 0.3]).fill(0xffffff);
      g.circle(0, 0, r * 0.35).fill(0xfff8d0);
      // Sparkle holds its own alpha curve
      g.alpha = s;
      break;
    }
    case 'waxSteam': {
      const r = p.size * (1.6 + lifeFrac * 2.4);
      g.circle(0, 0, r).fill({ color: 0xffffff, alpha: 0.7 - lifeFrac * 0.7 });
      // Renderer's g.alpha set above is also applied; keep semitransparent.
      break;
    }
    case 'crashDust': {
      const r = p.size * (1.4 + lifeFrac * 2.2);
      g.circle(0, 0, r).fill({ color: 0x9a8d65, alpha: 0.8 - lifeFrac * 0.8 });
      break;
    }
    case 'oof': {
      // Lightweight "!" — vertical line + dot below.
      g.rect(-1, -8, 2, 8).fill(0xffe680);
      g.circle(0, 4, 1.6).fill(0xffe680);
      break;
    }
    case 'huh': {
      // Lightweight "?" — top arc, vertical, dot below.
      // Stroked curve approximated with two arcs.
      g.arc(0, -4, 4, Math.PI * 1.1, Math.PI * 0.4, false)
        .stroke({ color: 0xffe680, width: 2 });
      g.rect(-1, 0, 2, 4).fill(0xffe680);
      g.circle(0, 6, 1.6).fill(0xffe680);
      break;
    }
    case 'spark': {
      // Cantor cantrip projectile — a small four-pointed magic star with
      // a soft purple-white halo. Pulses slightly as it travels.
      const r = p.size * (1.1 + Math.sin(lifeFrac * Math.PI * 4) * 0.18);
      g.circle(0, 0, r * 1.8).fill({ color: 0xa479ff, alpha: 0.35 });
      g.poly([0, -r * 1.2, r * 0.35, 0, 0, r * 1.2, -r * 0.35, 0]).fill(0xfff2cf);
      g.poly([-r * 1.2, 0, 0, -r * 0.35, r * 1.2, 0, 0, r * 0.35]).fill(0xfff2cf);
      g.circle(0, 0, r * 0.45).fill(0xffffff);
      break;
    }
    case 'manaOrb': {
      // Mana orb — small honey-gold sphere with a soft halo. Reads as
      // liquid magic flowing from the hive's reservoir to the caster.
      const r = p.size;
      g.circle(0, 0, r * 2.2).fill({ color: 0xf5d166, alpha: 0.35 });
      g.circle(0, 0, r * 1.3).fill({ color: 0xfff0a0, alpha: 0.85 });
      g.circle(0, 0, r * 0.6).fill(0xffffff);
      // Trailing arc — a faint comet tail behind the orb.
      g.circle(-r * 0.8, r * 0.6, r * 0.5).fill({ color: 0xf5d166, alpha: 0.5 });
      break;
    }
    case 'honeyDrop': {
      // Tear-shaped honey droplet — pointed top, round bottom. Reads as
      // a small bead of spilled mana falling away from the jar.
      const r = p.size;
      g.circle(0, 0, r * 0.9).fill(0xf5d166);
      g.poly([0, -r * 2, -r * 0.6, -r * 0.2, r * 0.6, -r * 0.2]).fill(0xf5d166);
      g.circle(-r * 0.3, -r * 0.3, r * 0.3).fill({ color: 0xfff0a0, alpha: 0.8 });
      break;
    }
  }
}
