// Pooled particle system. Cosmetic — drives particle visuals via the
// ParticleView. Bees and views call `emit(type, x, y, count?)` on key
// transitions; the system updates positions/lifetimes each tick.

export type ParticleType =
  | 'pollenPuff'
  | 'sparkle'
  | 'waxSteam'
  | 'crashDust'
  | 'oof';

export interface Particle {
  type: ParticleType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
  lifetimeMs: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  alive: boolean;
}

const POOL_SIZE = 240;

export class ParticleSystem {
  private pool: Particle[];

  constructor() {
    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool.push({
        type: 'pollenPuff',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        ageMs: 0,
        lifetimeMs: 0,
        rotation: 0,
        rotationSpeed: 0,
        size: 1,
        alive: false,
      });
    }
  }

  emit(type: ParticleType, x: number, y: number, count = 1): void {
    for (let n = 0; n < count; n++) {
      const p = this.findFree();
      if (!p) return;
      p.alive = true;
      p.type = type;
      p.x = x;
      p.y = y;
      p.ageMs = 0;
      p.rotation = Math.random() * Math.PI * 2;
      this.configure(p);
    }
  }

  private findFree(): Particle | null {
    for (const p of this.pool) if (!p.alive) return p;
    return null;
  }

  private configure(p: Particle): void {
    switch (p.type) {
      case 'pollenPuff': {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
        const speed = 40 + Math.random() * 60;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.lifetimeMs = 600 + Math.random() * 200;
        p.rotationSpeed = (Math.random() - 0.5) * 6;
        p.size = 1.5 + Math.random() * 1.5;
        break;
      }
      case 'sparkle': {
        p.vx = (Math.random() - 0.5) * 10;
        p.vy = -10 - Math.random() * 10;
        p.lifetimeMs = 500;
        p.rotationSpeed = 1.5;
        p.size = 1;
        break;
      }
      case 'waxSteam': {
        p.vx = (Math.random() - 0.5) * 8;
        p.vy = -22 - Math.random() * 12;
        p.lifetimeMs = 900;
        p.rotationSpeed = 0;
        p.size = 1 + Math.random();
        break;
      }
      case 'crashDust': {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 50;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed * 0.6;
        p.lifetimeMs = 600;
        p.rotationSpeed = (Math.random() - 0.5) * 4;
        p.size = 1 + Math.random() * 1.5;
        break;
      }
      case 'oof': {
        p.vx = 0;
        p.vy = -30;
        p.lifetimeMs = 700;
        p.rotationSpeed = 0;
        p.size = 1;
        break;
      }
    }
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.ageMs += dtMs;
      if (p.ageMs >= p.lifetimeMs) {
        p.alive = false;
        continue;
      }
      // Per-type forces.
      if (p.type === 'pollenPuff' || p.type === 'crashDust') {
        p.vy += 140 * dt; // gravity
      }
      if (p.type === 'waxSteam') {
        // Sin wobble — drifts side to side as it rises.
        p.x += Math.sin(p.ageMs / 90) * dt * 18;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotationSpeed * dt;
    }
  }

  // Iterator for the renderer (avoids allocating a new array per frame).
  forEachActive(fn: (p: Particle) => void): void {
    for (const p of this.pool) {
      if (p.alive) fn(p);
    }
  }
}
