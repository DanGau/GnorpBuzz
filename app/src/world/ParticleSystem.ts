// Pooled particle system. Cosmetic — drives particle visuals via the
// ParticleView. Bees and views call `emit(type, x, y, count?)` on key
// transitions; the system updates positions/lifetimes each tick.

export type ParticleType =
  | 'pollenPuff'
  | 'sparkle'
  | 'waxSteam'
  | 'crashDust'
  | 'oof'
  | 'huh'
  | 'spark'
  | 'manaOrb'
  | 'honeyDrop';

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
  // Optional homing target. When non-null the particle steers toward
  // (targetX, targetY) every frame at `homingSpeed` px/sec and dies on
  // arrival (within `HOMING_ARRIVE_PX`). Used by the cantor's cantrip
  // spark so it actually reaches the rock rather than fading mid-flight.
  targetX: number | null;
  targetY: number | null;
  homingSpeed: number;
}

const POOL_SIZE = 240;
const HOMING_ARRIVE_PX = 6;

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
        targetX: null,
        targetY: null,
        homingSpeed: 0,
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
      p.targetX = null;
      p.targetY = null;
      p.homingSpeed = 0;
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
      case 'oof':
      case 'huh': {
        p.vx = 0;
        p.vy = -30;
        p.lifetimeMs = 800;
        p.rotationSpeed = 0;
        p.size = 1;
        break;
      }
      case 'spark': {
        // Spark projectile — direction/velocity is set by the caller via
        // `emitDirected`. Defaults here are safe fallbacks if `emit` is
        // used directly: float upward and dissipate.
        p.vx = 0;
        p.vy = -40;
        p.lifetimeMs = 700;
        p.rotationSpeed = 4;
        p.size = 1.2;
        break;
      }
      case 'manaOrb': {
        // Mana orb — homing payload, default velocity overridden by emitHoming.
        p.vx = 0;
        p.vy = 0;
        p.lifetimeMs = 1200;
        p.rotationSpeed = 1.5;
        p.size = 1.6;
        break;
      }
      case 'honeyDrop': {
        // Honey drip — short-lived droplet that falls a short distance.
        // Used as a "spilled mana" garnish on consume events.
        p.vx = (Math.random() - 0.5) * 12;
        p.vy = 20 + Math.random() * 20;
        p.lifetimeMs = 500;
        p.rotationSpeed = 0;
        p.size = 1 + Math.random() * 0.5;
        break;
      }
    }
  }

  // Spawn a particle with an explicit velocity / lifetime. Used for the
  // cantor's spell projectile, which needs to travel toward the dig site
  // rather than emit in a fan pattern.
  emitDirected(
    type: ParticleType,
    x: number,
    y: number,
    vx: number,
    vy: number,
    lifetimeMs: number,
    size = 1.2,
  ): void {
    const p = this.findFree();
    if (!p) return;
    p.alive = true;
    p.type = type;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.ageMs = 0;
    p.lifetimeMs = lifetimeMs;
    p.rotation = Math.random() * Math.PI * 2;
    p.rotationSpeed = 6;
    p.size = size;
    p.targetX = null;
    p.targetY = null;
    p.homingSpeed = 0;
  }

  // Spawn a homing projectile. Lifetime is a safety upper bound; the
  // particle normally dies when it arrives at (targetX, targetY). When it
  // arrives, a small impact burst is spawned at the contact point.
  emitHoming(
    type: ParticleType,
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    speed: number,
    size = 1.2,
  ): void {
    const p = this.findFree();
    if (!p) return;
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.max(0.0001, Math.hypot(dx, dy));
    p.alive = true;
    p.type = type;
    p.x = x;
    p.y = y;
    p.vx = (dx / dist) * speed;
    p.vy = (dy / dist) * speed;
    p.ageMs = 0;
    // Lifetime is a hard cap so a stale homing target can't pin a slot
    // forever — set to 2× the nominal travel time. Normal arrivals kill
    // the particle long before.
    p.lifetimeMs = (dist / speed) * 1000 * 2 + 200;
    p.rotation = Math.random() * Math.PI * 2;
    p.rotationSpeed = 8;
    p.size = size;
    p.targetX = targetX;
    p.targetY = targetY;
    p.homingSpeed = speed;
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

      // Homing projectiles steer toward their target every frame and die
      // on arrival. Skip the per-type forces below — homing sparks ignore
      // gravity so the trajectory reads as a direct magical bolt.
      if (p.targetX !== null && p.targetY !== null) {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= HOMING_ARRIVE_PX) {
          // Arrival burst at the contact point.
          this.emit('sparkle', p.targetX, p.targetY, 2);
          this.emit('crashDust', p.targetX, p.targetY, 4);
          p.alive = false;
          continue;
        }
        const step = Math.min(dist, p.homingSpeed * dt);
        p.vx = (dx / dist) * p.homingSpeed;
        p.vy = (dy / dist) * p.homingSpeed;
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
        p.rotation += p.rotationSpeed * dt;
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
      if (p.type === 'honeyDrop') {
        p.vy += 240 * dt; // heavier than crashDust — honey is sticky and fast
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
