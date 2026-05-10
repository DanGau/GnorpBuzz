import { Container, Graphics } from 'pixi.js';
import type { World } from '../world/World';
import type { Bee } from '../world/Bee';
import { TIP_DURATION_MS } from '../world/Bee';

interface BeeSprite {
  bee: Bee;
  graphics: Graphics;
  carry: Graphics;
}

export class BeeView {
  readonly container: Container;
  private sprites: BeeSprite[] = [];

  constructor() {
    this.container = new Container();
  }

  update(world: World, elapsedMs: number): void {
    const liveBees: Bee[] = [];
    for (const hive of world.hives.values()) {
      for (const bee of hive.bees) liveBees.push(bee);
    }

    while (this.sprites.length < liveBees.length) {
      const g = new Graphics();
      const carry = new Graphics();
      this.drawBee(g, liveBees[this.sprites.length].role);
      this.container.addChild(g);
      this.container.addChild(carry);
      this.sprites.push({ bee: liveBees[this.sprites.length], graphics: g, carry });
    }
    while (this.sprites.length > liveBees.length) {
      const sprite = this.sprites.pop()!;
      this.container.removeChild(sprite.graphics);
      this.container.removeChild(sprite.carry);
      sprite.graphics.destroy();
      sprite.carry.destroy();
    }

    for (let i = 0; i < liveBees.length; i++) {
      const bee = liveBees[i];
      const sprite = this.sprites[i];
      if (sprite.bee !== bee) {
        this.drawBee(sprite.graphics, bee.role);
        sprite.bee = bee;
      }

      // Visual arc: bow the rendered position perpendicular to the travel
      // line so flights curve outward instead of running on a ruler.
      // Logical position (bee.x/y) is unchanged — arrival/proximity checks
      // still work cleanly. Arc damps at the start and end of the leg.
      const startDx = bee.targetX - bee.flightStartX;
      const startDy = bee.targetY - bee.flightStartY;
      const flightDist = Math.hypot(startDx, startDy);
      let arcOffsetX = 0;
      let arcOffsetY = 0;
      if (flightDist > 8 && bee.windupRemainingMs <= 0) {
        const traveled = Math.hypot(bee.x - bee.flightStartX, bee.y - bee.flightStartY);
        const progress = Math.min(1, traveled / flightDist);
        // Multi-bow path: bee weaves across the travel line N times where
        // N is per-bee (2–5 bows). Outer envelope sin(π·t) keeps the path
        // pinched at start and end so flights still launch and land clean.
        const numBows = 2 + Math.floor(Math.abs(bee.seed) * 4); // 2–5
        const inner = Math.sin(progress * Math.PI * numBows);
        const envelope = Math.sin(progress * Math.PI);
        const bow = inner * envelope;
        // Per-role amplitude.
        const roleAmp =
          bee.role === 'forager' ? 84 : bee.role === 'wax-maker' ? 54 : 36;
        // Distance scaling: short trips arc less. Linear ramp from 0 to
        // full amplitude over 0–250px so 30px wanders barely curve while
        // 800px flights get the full swoop.
        const distFactor = Math.min(1, flightDist / 250);
        const arcAmp = roleAmp * (1 + bee.seed * 0.3) * distFactor;
        // Per-bee sign for which side the first bow goes.
        const arcSign = bee.seed >= 0 ? 1 : -1;
        const perpX = -startDy / flightDist;
        const perpY = startDx / flightDist;
        arcOffsetX = perpX * bow * arcAmp * arcSign;
        arcOffsetY = perpY * bow * arcAmp * arcSign;
      }

      sprite.graphics.x = bee.x + arcOffsetX;
      sprite.graphics.y = bee.y + arcOffsetY;
      sprite.carry.x = sprite.graphics.x;
      sprite.carry.y = sprite.graphics.y;

      // Per-frame velocity components drive squash/stretch.
      const dx = bee.x - bee.prevX;
      const dy = bee.y - bee.prevY;

      // Wing-flap freq scales with role. Forager is jittery, wax-maker lazy.
      const flapBase = bee.role === 'forager' ? 1.3 : bee.role === 'wax-maker' ? 0.8 : 1.0;
      const flap = 0.85 + 0.25 * Math.sin(bee.flapPhase * flapBase);

      // Squash/stretch driven by velocity components separately. Horizontal
      // travel stretches horizontally; vertical travel squashes horizontally
      // and stretches vertically. Bees never rotate (their stripes stay put).
      const squashK = bee.role === 'wax-maker' ? 0.05 : bee.role === 'forager' ? 0.09 : 0.06;
      const cap = bee.role === 'wax-maker' ? 0.25 : 0.4;
      const horizSpeed = Math.abs(dx);
      const vertSpeed = Math.abs(dy);
      const stretchX = Math.min(cap, horizSpeed * squashK) - Math.min(cap * 0.6, vertSpeed * squashK * 0.5);
      const stretchY = Math.min(cap, vertSpeed * squashK) - Math.min(cap * 0.6, horizSpeed * squashK * 0.5);

      // Reaction shake — brief horizontal squish after a key event.
      let shake = 1;
      if (bee.shakeUntilMs > elapsedMs) {
        const t = Math.max(0, (bee.shakeUntilMs - elapsedMs) / 120);
        shake = 1 + 0.35 * t;
      }

      // Wind-up: brief vertical compression and a tiny lean while the bee
      // backs away from its target before launching.
      let windupSquash = 1;
      if (bee.windupRemainingMs > 0) {
        windupSquash = 1.18; // squat
      }

      // Tip-over animation: brief lean-and-snap while idle (~700ms total).
      // 0–280ms: lean forward to ~15°.
      // 280–360ms: snap back to -3° (overshoot).
      // 360–700ms: settle to 0°.
      let tipRotation = 0;
      if (bee.tipPhaseMs > 0) {
        const remaining = bee.tipPhaseMs;
        const elapsed = TIP_DURATION_MS - remaining;
        if (elapsed < 280) {
          tipRotation = (elapsed / 280) * 0.26; // lean forward
        } else if (elapsed < 360) {
          const t = (elapsed - 280) / 80;
          tipRotation = 0.26 + (-0.05 - 0.26) * t; // snap back overshoot
        } else {
          const t = (elapsed - 360) / (TIP_DURATION_MS - 360);
          tipRotation = -0.05 * (1 - t); // settle to 0
        }
      }

      sprite.graphics.rotation = tipRotation;
      sprite.graphics.scale.set(
        (1 + stretchX) * shake,
        (1 + stretchY) * flap * windupSquash,
      );
      sprite.carry.rotation = 0;
      sprite.carry.scale.set(1, 1);

      this.drawCarry(sprite.carry, bee.carrying);
    }
  }

  private drawBee(g: Graphics, role: 'forager' | 'wax-maker' | 'builder'): void {
    g.clear();
    const bodyColor =
      role === 'forager' ? 0xffd23f : role === 'wax-maker' ? 0xe6b833 : 0xe07a3a;
    g.ellipse(0, 0, 7, 5).fill(bodyColor);
    g.rect(-4, -2, 2.5, 4).fill(0x222222);
    g.rect(1.5, -2, 2.5, 4).fill(0x222222);
    g.ellipse(-2, -4, 4, 2.5).fill({ color: 0xffffff, alpha: 0.6 });
    g.ellipse(2, -4, 4, 2.5).fill({ color: 0xffffff, alpha: 0.6 });
  }

  private drawCarry(g: Graphics, carrying: 'none' | 'pollen' | 'wax-block'): void {
    g.clear();
    if (carrying === 'none') return;
    if (carrying === 'pollen') {
      g.circle(0, 4, 3).fill(0xf5d166);
      g.circle(-1, 3, 1).fill({ color: 0xfff2bf, alpha: 0.6 });
    } else if (carrying === 'wax-block') {
      const r = 4;
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        pts.push(Math.cos(a) * r, 4 + Math.sin(a) * r);
      }
      g.poly(pts).fill(0xfff2cf).stroke({ color: 0xb89858, width: 1 });
    }
  }
}
