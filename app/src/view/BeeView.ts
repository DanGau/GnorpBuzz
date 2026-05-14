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
    const liveBees: Bee[] = world.hive.allBees();

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

      // Visual arc — bow position perpendicular to the travel line.
      const startDx = bee.targetX - bee.flightStartX;
      const startDy = bee.targetY - bee.flightStartY;
      const flightDist = Math.hypot(startDx, startDy);
      let arcOffsetX = 0;
      let arcOffsetY = 0;
      if (flightDist > 8 && bee.windupRemainingMs <= 0) {
        const traveled = Math.hypot(bee.x - bee.flightStartX, bee.y - bee.flightStartY);
        const progress = Math.min(1, traveled / flightDist);
        const numBows = 2 + Math.floor(Math.abs(bee.seed) * 4);
        const inner = Math.sin(progress * Math.PI * numBows);
        const envelope = Math.sin(progress * Math.PI);
        const bow = inner * envelope;
        const roleAmp = bee.role === 'forager' ? 84 : 48;
        const distFactor = Math.min(1, flightDist / 250);
        const arcAmp = roleAmp * (1 + bee.seed * 0.3) * distFactor;
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

      const dx = bee.x - bee.prevX;
      const dy = bee.y - bee.prevY;

      const flapBase = bee.role === 'forager' ? 1.3 : 1.1;
      const flap = 0.85 + 0.25 * Math.sin(bee.flapPhase * flapBase);

      const squashK = bee.role === 'forager' ? 0.09 : 0.07;
      const cap = 0.35;
      const horizSpeed = Math.abs(dx);
      const vertSpeed = Math.abs(dy);
      const stretchX = Math.min(cap, horizSpeed * squashK) - Math.min(cap * 0.6, vertSpeed * squashK * 0.5);
      const stretchY = Math.min(cap, vertSpeed * squashK) - Math.min(cap * 0.6, horizSpeed * squashK * 0.5);

      let shake = 1;
      if (bee.shakeUntilMs > elapsedMs) {
        const t = Math.max(0, (bee.shakeUntilMs - elapsedMs) / 120);
        shake = 1 + 0.35 * t;
      }

      let windupSquash = 1;
      if (bee.windupRemainingMs > 0) windupSquash = 1.18;

      // Hovering: vertical bob handled by the sim; here we just add a soft
      // vertical pulse so the body breathes while it lines up the dive.
      let extraStretchX = 0;
      let extraStretchY = 0;
      if (bee.state === 'hovering') {
        const breathe = Math.sin(bee.workTimer / 60) * 0.04;
        extraStretchY = breathe;
      }
      // Diving: bee stretches VERTICALLY (along the dive direction) and
      // squashes horizontally — the classic dive-bomb pose.
      if (bee.state === 'diving') {
        const dp = Math.max(0, Math.min(1, 1 - bee.workTimer / 180));
        const mag = 0.55 * dp;
        extraStretchY = mag;
        extraStretchX = -0.18 * dp;
        windupSquash = 1;
      }
      // Impact splat: bee flattens against the rock on contact.
      if (bee.state === 'striking-impact') {
        const t = Math.max(0, bee.workTimer / 70);
        const splat = 1 - t;
        extraStretchY = -0.4 * splat;
        extraStretchX = 0.35 * splat;
        windupSquash = 1;
      }
      // Bouncing: tumble — bee shrinks and spins out as it arcs away.
      let bounceRotation = 0;
      if (bee.state === 'bouncing') {
        const t = Math.max(0, bee.workTimer / 360);
        const fadeScale = 0.6 + 0.4 * t; // shrinks slightly as it tumbles
        extraStretchX = -(1 - fadeScale);
        extraStretchY = -(1 - fadeScale);
        bounceRotation = (1 - t) * Math.PI * (bee.seed >= 0 ? 1.8 : -1.8);
        windupSquash = 1;
      }

      let tipRotation = 0;
      if (bee.tipPhaseMs > 0) {
        const remaining = bee.tipPhaseMs;
        const elapsed = TIP_DURATION_MS - remaining;
        if (elapsed < 280) tipRotation = (elapsed / 280) * 0.26;
        else if (elapsed < 360) {
          const t = (elapsed - 280) / 80;
          tipRotation = 0.26 + (-0.05 - 0.26) * t;
        } else {
          const t = (elapsed - 360) / (TIP_DURATION_MS - 360);
          tipRotation = -0.05 * (1 - t);
        }
      }

      // Strike-impact rotation: tilt forward briefly.
      if (bee.state === 'striking-impact') tipRotation = 0.4;

      sprite.graphics.rotation = tipRotation + bounceRotation;
      sprite.graphics.scale.set(
        (1 + stretchX + extraStretchX) * shake,
        (1 + stretchY + extraStretchY) * flap * windupSquash,
      );
      sprite.carry.rotation = 0;
      sprite.carry.scale.set(1, 1);

      this.drawCarry(sprite.carry, bee.carrying, bee.role);
    }
  }

  private drawBee(g: Graphics, role: 'forager' | 'excavator'): void {
    g.clear();
    const bodyColor = role === 'forager' ? 0xffd23f : 0xc94a2a;
    g.ellipse(0, 0, 7, 5).fill(bodyColor);
    // Stripes — black for forager, darker red-brown for excavator.
    const stripeColor = role === 'forager' ? 0x222222 : 0x501a08;
    g.rect(-4, -2, 2.5, 4).fill(stripeColor);
    g.rect(1.5, -2, 2.5, 4).fill(stripeColor);
    g.ellipse(-2, -4, 4, 2.5).fill({ color: 0xffffff, alpha: 0.6 });
    g.ellipse(2, -4, 4, 2.5).fill({ color: 0xffffff, alpha: 0.6 });
    if (role === 'excavator') {
      // A tiny stinger jutting downward — the excavator's "pickaxe".
      g.poly([0, 4, -2, 8, 2, 8]).fill(0x5a3020).stroke({ color: 0x2a1008, width: 0.8 });
    }
  }

  private drawCarry(g: Graphics, carrying: 'none' | 'pollen', role: 'forager' | 'excavator'): void {
    void role;
    g.clear();
    if (carrying === 'none') return;
    if (carrying === 'pollen') {
      g.circle(0, 4, 3).fill(0xf5d166);
      g.circle(-1, 3, 1).fill({ color: 0xfff2bf, alpha: 0.6 });
    }
  }
}
