import type { GameState, ForagerHiveData, WaxHiveData } from '../sim/state';
import { TUNING } from '../sim/state';
import type { World } from './World';
import { WORLD } from './layout';

export type BeeRole = 'forager' | 'wax-maker' | 'builder';

export type BeeState =
  | 'idle'
  | 'flying-to-flower'
  | 'harvesting'
  | 'flying-to-pollen-source'
  | 'dive-bombing-pollen'
  | 'picking-up-pollen'
  | 'flying-home-with-pollen'
  | 'producing-wax'
  | 'flying-to-wax-source'
  | 'picking-up-block'
  | 'flying-to-vessel'
  | 'dropping-block'
  | 'flying-home-empty';

export type BeeCarrying = 'none' | 'pollen' | 'wax-block';

const ARRIVE_THRESHOLD = 4;
const IDLE_WANDER_RADIUS = 30;
export const TIP_DURATION_MS = 700;

let beeIdSeq = 1;

export class Bee {
  id: string;
  role: BeeRole;
  homeHiveId: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  targetX: number;
  targetY: number;
  state: BeeState;
  carrying: BeeCarrying;
  workTimer: number;
  targetFlowerId: string | null;
  targetHiveId: string | null;
  flapPhase: number;
  idleWaitMs: number;
  // Per-bee random factor in [-1, 1] used to desync timing/wobble across the
  // colony so identical sprites don't move in lockstep.
  seed: number;
  // Visual reaction frame: when set in the future, BeeView applies a brief
  // body-shake (squash/stretch) until elapsedMs catches up.
  shakeUntilMs: number;
  // Per-frame steam emission gate (used by wax-makers in producing-wax).
  steamCooldownMs: number;
  // Used by foragers to drop a sloppy pollen trail home.
  trailCooldownMs: number;
  // Wind-up countdown — while > 0, flyToward backs away from the target
  // before launching forward (anticipation lurch).
  windupRemainingMs: number;
  // Flight kinematics: tracked from the start of each flight leg so we can
  // ease velocity (accelerate from rest, decelerate near target) and so
  // BeeView can compute arc progress.
  flightStartX: number;
  flightStartY: number;
  flightAgeMs: number;
  // Idle bookkeeping: how long the bee has been continuously idle, used to
  // schedule tip-over animations and "?" pops on confused idle cycles.
  idleAccumulatedMs: number;
  consecutiveIdleResets: number;
  // Tip-over animation timeline. While > 0, BeeView reads tipPhaseMs to
  // animate a brief lean-and-snap. Reset to a future scheduled time when
  // animation completes.
  tipPhaseMs: number;
  nextTipScheduledAtMs: number;

  constructor(role: BeeRole, homeHiveId: string, homeX: number, homeY: number) {
    this.id = `bee-${beeIdSeq++}`;
    this.role = role;
    this.homeHiveId = homeHiveId;
    this.x = homeX + (Math.random() - 0.5) * 20;
    this.y = homeY + (Math.random() - 0.5) * 20;
    this.prevX = this.x;
    this.prevY = this.y;
    this.targetX = homeX;
    this.targetY = homeY;
    this.state = 'idle';
    this.carrying = 'none';
    this.workTimer = 0;
    this.targetFlowerId = null;
    this.targetHiveId = null;
    this.flapPhase = Math.random() * Math.PI * 2;
    this.idleWaitMs = 0;
    this.seed = Math.random() * 2 - 1;
    this.shakeUntilMs = 0;
    this.steamCooldownMs = 0;
    this.trailCooldownMs = 0;
    this.windupRemainingMs = 0;
    this.flightStartX = this.x;
    this.flightStartY = this.y;
    this.flightAgeMs = 0;
    this.idleAccumulatedMs = 0;
    this.consecutiveIdleResets = 0;
    this.tipPhaseMs = 0;
    this.nextTipScheduledAtMs = 4000 + Math.random() * 3000;
  }

  private flyToward(dtMs: number): boolean {
    this.prevX = this.x;
    this.prevY = this.y;
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < ARRIVE_THRESHOLD && this.windupRemainingMs <= 0) return true;

    // Wind-up: before any flight, lurch backward briefly. Cartoon anticipation.
    if (this.windupRemainingMs > 0) {
      this.windupRemainingMs -= dtMs;
      if (dist > 0) {
        const back = -45 * (dtMs / 1000);
        this.x += (dx / dist) * back;
        this.y += (dy / dist) * back;
      }
      return false;
    }

    this.flightAgeMs += dtMs;

    // Per-bee speed jitter (±15%) keeps the swarm from moving in lockstep.
    let baseSpeed = TUNING.BEE_SPEED * (1 + this.seed * 0.15);
    // Dive-bomb skips easing — punchy plunge at full speed.
    const isDive = this.state === 'dive-bombing-pollen';
    if (isDive) baseSpeed *= 2.2;

    let speedMul: number;
    if (isDive) {
      speedMul = 1;
    } else {
      // Quad.out acceleration ramp (200ms) — accelerate from rest.
      const accelFrac = Math.min(1, this.flightAgeMs / 200);
      const accelEase = accelFrac * (2 - accelFrac);
      // Quad.out deceleration ramp — slow as we approach the target.
      const decelDist = 70;
      const decelFrac = Math.min(1, dist / decelDist);
      const decelEase = decelFrac * (2 - decelFrac);
      // Floor at 0.18 so we don't asymptote and never arrive.
      speedMul = Math.max(0.18, Math.min(accelEase, decelEase));
    }

    const move = baseSpeed * speedMul * (dtMs / 1000);
    if (move >= dist) {
      this.x = this.targetX;
      this.y = this.targetY;
      return true;
    }
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
    return false;
  }

  /** Mark a brief reaction shake. View applies extra squash for ~100ms. */
  private pulseShake(state: GameState, durationMs = 120): void {
    this.shakeUntilMs = state.elapsedMs + durationMs;
  }

  /** Set a flight target with a small anticipation wind-up, and reset
   * the flight kinematics so velocity eases from rest. */
  private setFlightTarget(x: number, y: number, windupMs = 90): void {
    this.targetX = x;
    this.targetY = y;
    this.windupRemainingMs = windupMs;
    this.flightStartX = this.x;
    this.flightStartY = this.y;
    this.flightAgeMs = 0;
  }

  private homePos(world: World): { x: number; y: number } {
    const home = world.getHivePosition(this.homeHiveId);
    return home ?? { x: this.x, y: this.y };
  }

  update(dtMs: number, state: GameState, world: World): void {
    this.flapPhase += (dtMs / 1000) * 30;

    // Track continuous idle time for tip-over and "?" pops.
    if (this.state === 'idle') {
      this.idleAccumulatedMs += dtMs;
    } else {
      this.idleAccumulatedMs = 0;
      this.consecutiveIdleResets = 0;
    }

    // Tip-over scheduler: while idle, occasionally lean and snap upright.
    if (this.tipPhaseMs > 0) {
      this.tipPhaseMs -= dtMs;
      if (this.tipPhaseMs < 0) this.tipPhaseMs = 0;
    } else if (
      this.state === 'idle' &&
      this.idleAccumulatedMs >= this.nextTipScheduledAtMs
    ) {
      this.tipPhaseMs = TIP_DURATION_MS;
      this.nextTipScheduledAtMs =
        this.idleAccumulatedMs + 4000 + Math.random() * 4000;
    }

    if (this.role === 'forager') {
      this.updateForager(dtMs, state, world);
    } else if (this.role === 'wax-maker') {
      this.updateWaxMaker(dtMs, state, world);
    } else {
      this.updateBuilder(dtMs, state, world);
    }
  }

  // -------------------- Forager --------------------

  private updateForager(dtMs: number, state: GameState, world: World): void {
    switch (this.state) {
      case 'idle': {
        this.idleWaitMs -= dtMs;
        if (this.idleWaitMs <= 0) {
          const claimed = this.tryClaimFlower(state, world);
          if (claimed) {
            this.state = 'flying-to-flower';
            this.windupRemainingMs = 100;
            this.consecutiveIdleResets = 0;
          } else {
            this.idleWaitMs = TUNING.IDLE_WANDER_DURATION_MS;
            this.pickIdleTarget(world);
            this.bumpIdleConfusion(state, world);
          }
        }
        this.flyToward(dtMs);
        break;
      }
      case 'flying-to-flower': {
        if (this.flyToward(dtMs)) {
          const flower = state.flowers.find((f) => f.id === this.targetFlowerId);
          if (!flower || flower.claimedByBeeId !== this.id || flower.yieldRemaining === 0) {
            this.releaseFlowerClaim(state);
            this.returnToIdle(world);
          } else {
            this.state = 'harvesting';
            this.workTimer = TUNING.HARVEST_DURATION_MS;
            // Bee bumps the flower — squash + tiny pollen puff.
            this.pulseShake(state);
            world.particles.emit('pollenPuff', this.x, this.y, 2);
          }
        }
        break;
      }
      case 'harvesting': {
        this.workTimer -= dtMs;
        if (this.workTimer <= 0) {
          const flower = state.flowers.find((f) => f.id === this.targetFlowerId);
          if (flower) {
            flower.yieldRemaining = Math.max(0, flower.yieldRemaining - 1);
            flower.claimedByBeeId = null;
            if (flower.yieldRemaining === 0) {
              flower.regrowTimerMs = TUNING.FLOWER_REGROW_MS;
            }
            // Sparkle on a successful harvest.
            world.particles.emit('sparkle', this.x, this.y - 4, 1);
          }
          this.targetFlowerId = null;
          this.carrying = 'pollen';
          const home = this.homePos(world);
          this.setFlightTarget(home.x, home.y - 10);
          this.state = 'flying-home-with-pollen';
          this.trailCooldownMs = 0;
        }
        break;
      }
      case 'flying-home-with-pollen': {
        // Sloppy carry: drop a pollen-trail particle every ~600ms.
        this.trailCooldownMs -= dtMs;
        if (this.trailCooldownMs <= 0) {
          world.particles.emit('pollenPuff', this.x, this.y + 3, 1);
          this.trailCooldownMs = 600 + Math.random() * 200;
        }
        if (this.flyToward(dtMs)) {
          const hive = state.hives.find((h) => h.id === this.homeHiveId);
          if (hive && hive.type === 'forager') {
            (hive as ForagerHiveData).pollen += 1;
          }
          // Toss-overhead deposit: fan of pollen particles.
          world.particles.emit('pollenPuff', this.x, this.y, 6);
          this.pulseShake(state);
          this.carrying = 'none';
          this.state = 'idle';
          this.idleWaitMs = 0;
        }
        break;
      }
      default: {
        this.returnToIdle(world);
      }
    }
  }

  private tryClaimFlower(state: GameState, world: World): boolean {
    let bestId: string | null = null;
    let bestDist = Infinity;
    let bestPos: { x: number; y: number } | null = null;
    for (const f of state.flowers) {
      if (f.yieldRemaining === 0 || f.claimedByBeeId !== null) continue;
      const pos = world.getFlowerPosition(f.id);
      if (!pos) continue;
      const d = Math.hypot(pos.x - this.x, pos.y - this.y);
      if (d < bestDist) {
        bestDist = d;
        bestId = f.id;
        bestPos = pos;
      }
    }
    if (!bestId || !bestPos) return false;
    const f = state.flowers.find((x) => x.id === bestId)!;
    f.claimedByBeeId = this.id;
    this.targetFlowerId = bestId;
    this.targetX = bestPos.x;
    this.targetY = bestPos.y - 6;
    return true;
  }

  private releaseFlowerClaim(state: GameState): void {
    if (!this.targetFlowerId) return;
    const f = state.flowers.find((x) => x.id === this.targetFlowerId);
    if (f && f.claimedByBeeId === this.id) f.claimedByBeeId = null;
    this.targetFlowerId = null;
  }

  // -------------------- Wax-maker --------------------
  // Wax-makers fetch pollen, return home, produce a wax block, deposit it
  // in the wax hive's stockpile. They never visit the vessel — that's the
  // builder's job.

  private updateWaxMaker(dtMs: number, state: GameState, world: World): void {
    switch (this.state) {
      case 'idle': {
        this.idleWaitMs -= dtMs;
        if (this.idleWaitMs <= 0) {
          const source = this.findPollenSource(state, world);
          if (source) {
            this.targetHiveId = source.hiveId;
            // Dive-bomb approach: overshoot 50px above pickup point first.
            this.setFlightTarget(source.x + 25, source.y - 60);
            this.state = 'flying-to-pollen-source';
            this.consecutiveIdleResets = 0;
          } else {
            this.idleWaitMs = TUNING.IDLE_WANDER_DURATION_MS;
            this.pickIdleTarget(world);
            this.bumpIdleConfusion(state, world);
          }
        }
        this.flyToward(dtMs);
        break;
      }
      case 'flying-to-pollen-source': {
        if (this.flyToward(dtMs)) {
          // Reached the elevated overshoot point — now plummet to the pickup.
          const hive = state.hives.find((h) => h.id === this.targetHiveId);
          if (hive && hive.type === 'forager' && (hive as ForagerHiveData).pollen > 0) {
            const pos = world.getHivePosition(hive.id);
            if (pos) {
              this.targetX = pos.x + 25;
              this.targetY = pos.y - 10;
              this.windupRemainingMs = 60; // tiny held-breath beat at apex
              this.state = 'dive-bombing-pollen';
            } else {
              this.state = 'picking-up-pollen';
              this.workTimer = TUNING.PICKUP_DURATION_MS;
            }
          } else {
            this.targetHiveId = null;
            this.returnToIdle(world);
          }
        }
        break;
      }
      case 'dive-bombing-pollen': {
        if (this.flyToward(dtMs)) {
          this.state = 'picking-up-pollen';
          this.workTimer = TUNING.PICKUP_DURATION_MS;
          this.pulseShake(state, 160);
          world.particles.emit('crashDust', this.x, this.y + 4, 3);
        }
        break;
      }
      case 'picking-up-pollen': {
        this.workTimer -= dtMs;
        if (this.workTimer <= 0) {
          const hive = state.hives.find((h) => h.id === this.targetHiveId);
          if (hive && hive.type === 'forager' && (hive as ForagerHiveData).pollen > 0) {
            (hive as ForagerHiveData).pollen -= 1;
            this.carrying = 'pollen';
            this.targetHiveId = null;
            const home = this.homePos(world);
            this.setFlightTarget(home.x, home.y - 10);
            this.state = 'flying-home-with-pollen';
            // "Hup!" body-shake on pickup + small puff
            this.pulseShake(state);
            world.particles.emit('pollenPuff', this.x, this.y, 2);
          } else {
            this.returnToIdle(world);
          }
        }
        break;
      }
      case 'flying-home-with-pollen': {
        if (this.flyToward(dtMs)) {
          this.state = 'producing-wax';
          this.workTimer = TUNING.PRODUCE_DURATION_MS;
          this.steamCooldownMs = 0;
          this.pulseShake(state);
        }
        break;
      }
      case 'producing-wax': {
        this.workTimer -= dtMs;
        // Tiny visual wiggle while producing — bee jiggles in place
        this.x = this.targetX + Math.sin(this.workTimer / 100) * 2;
        this.y = this.targetY + Math.cos(this.workTimer / 90) * 2;
        // Continuous steam puff every ~140ms while producing.
        this.steamCooldownMs -= dtMs;
        if (this.steamCooldownMs <= 0) {
          const home = world.getHivePosition(this.homeHiveId);
          if (home) world.particles.emit('waxSteam', home.x + 17, home.y - 60, 1);
          this.steamCooldownMs = 140 + Math.random() * 80;
        }
        if (this.workTimer <= 0) {
          const home = state.hives.find((h) => h.id === this.homeHiveId);
          if (home && home.type === 'wax') {
            (home as WaxHiveData).waxBlocks += 1;
          }
          // Sparkle pop when the block lands in the stockpile.
          world.particles.emit('sparkle', this.x, this.y, 1);
          this.pulseShake(state, 160);
          this.carrying = 'none';
          this.state = 'idle';
          this.idleWaitMs = 0;
        }
        break;
      }
      default: {
        this.returnToIdle(world);
      }
    }
  }

  private findPollenSource(
    state: GameState,
    world: World,
  ): { hiveId: string; x: number; y: number } | null {
    let best: { hiveId: string; x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const h of state.hives) {
      if (h.type !== 'forager' || !h.built) continue;
      if ((h as ForagerHiveData).pollen <= 0) continue;
      const pos = world.getHivePosition(h.id);
      if (!pos) continue;
      const d = Math.hypot(pos.x - this.x, pos.y - this.y);
      if (d < bestDist) {
        bestDist = d;
        best = { hiveId: h.id, x: pos.x, y: pos.y };
      }
    }
    return best;
  }

  // -------------------- Builder --------------------
  // Builders fetch wax blocks from a wax hive's stockpile and deliver them
  // to the vessel pad.

  private updateBuilder(dtMs: number, state: GameState, world: World): void {
    switch (this.state) {
      case 'idle': {
        this.idleWaitMs -= dtMs;
        if (this.idleWaitMs <= 0) {
          if (state.vessel.phase !== 'building') {
            this.idleWaitMs = TUNING.IDLE_WANDER_DURATION_MS;
            this.pickIdleTarget(world);
            // Builders idling because vessel is full/ready get a "huh" too.
            this.bumpIdleConfusion(state, world);
          } else {
            const source = this.findWaxSource(state, world);
            if (source) {
              this.targetHiveId = source.hiveId;
              this.setFlightTarget(source.x - 25, source.y - 10);
              this.state = 'flying-to-wax-source';
              this.consecutiveIdleResets = 0;
            } else {
              this.idleWaitMs = TUNING.IDLE_WANDER_DURATION_MS;
              this.pickIdleTarget(world);
              this.bumpIdleConfusion(state, world);
            }
          }
        }
        this.flyToward(dtMs);
        break;
      }
      case 'flying-to-wax-source': {
        if (this.flyToward(dtMs)) {
          const hive = state.hives.find((h) => h.id === this.targetHiveId);
          if (hive && hive.type === 'wax' && (hive as WaxHiveData).waxBlocks > 0) {
            this.state = 'picking-up-block';
            this.workTimer = TUNING.PICKUP_DURATION_MS;
          } else {
            this.targetHiveId = null;
            this.returnToIdle(world);
          }
        }
        break;
      }
      case 'picking-up-block': {
        this.workTimer -= dtMs;
        if (this.workTimer <= 0) {
          const hive = state.hives.find((h) => h.id === this.targetHiveId);
          if (hive && hive.type === 'wax' && (hive as WaxHiveData).waxBlocks > 0) {
            (hive as WaxHiveData).waxBlocks -= 1;
            this.carrying = 'wax-block';
            this.targetHiveId = null;
            this.setFlightTarget(WORLD.VESSEL_PAD.x, WORLD.VESSEL_PAD.y - 30);
            this.state = 'flying-to-vessel';
            this.pulseShake(state);
            world.particles.emit('crashDust', this.x, this.y + 4, 2);
          } else {
            this.returnToIdle(world);
          }
        }
        break;
      }
      case 'flying-to-vessel': {
        if (this.flyToward(dtMs)) {
          this.state = 'dropping-block';
          this.workTimer = TUNING.DROP_DURATION_MS;
        }
        break;
      }
      case 'dropping-block': {
        this.workTimer -= dtMs;
        if (this.workTimer <= 0) {
          if (state.vessel.phase === 'building') {
            state.vessel.deliveredBlocks += 1;
          } else {
            const wax = state.hives.find((h) => h.type === 'wax');
            if (wax && wax.type === 'wax') (wax as WaxHiveData).waxBlocks += 1;
          }
          // Snap-place: dust puff + satisfied body-shake on the builder.
          world.particles.emit('crashDust', WORLD.VESSEL_PAD.x, WORLD.VESSEL_PAD.y + 8, 4);
          world.particles.emit('sparkle', WORLD.VESSEL_PAD.x, WORLD.VESSEL_PAD.y, 1);
          this.pulseShake(state, 200);
          this.carrying = 'none';
          const home = this.homePos(world);
          this.setFlightTarget(home.x, home.y - 10, 60);
          this.state = 'flying-home-empty';
        }
        break;
      }
      case 'flying-home-empty': {
        if (this.flyToward(dtMs)) {
          this.state = 'idle';
          this.idleWaitMs = 0;
        }
        break;
      }
      default: {
        this.returnToIdle(world);
      }
    }
  }

  private findWaxSource(
    state: GameState,
    world: World,
  ): { hiveId: string; x: number; y: number } | null {
    let best: { hiveId: string; x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const h of state.hives) {
      if (h.type !== 'wax' || !h.built) continue;
      if ((h as WaxHiveData).waxBlocks <= 0) continue;
      const pos = world.getHivePosition(h.id);
      if (!pos) continue;
      const d = Math.hypot(pos.x - this.x, pos.y - this.y);
      if (d < bestDist) {
        bestDist = d;
        best = { hiveId: h.id, x: pos.x, y: pos.y };
      }
    }
    return best;
  }

  // -------------------- Shared --------------------

  private returnToIdle(world: World): void {
    this.state = 'idle';
    this.idleWaitMs = 0;
    this.carrying = 'none';
    const home = this.homePos(world);
    this.targetX = home.x;
    this.targetY = home.y - 10;
  }

  private pickIdleTarget(world: World): void {
    const home = this.homePos(world);
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * IDLE_WANDER_RADIUS;
    this.targetX = home.x + Math.cos(angle) * radius;
    this.targetY = home.y + Math.sin(angle) * radius * 0.6 - 15;
  }

  /** Called when an idle cycle expires without finding work. After 3 in a
   * row, pop a "?" particle above the bee. */
  private bumpIdleConfusion(_state: GameState, world: World): void {
    this.consecutiveIdleResets += 1;
    if (this.consecutiveIdleResets >= 3) {
      world.particles.emit('huh', this.x, this.y - 12, 1);
      this.consecutiveIdleResets = 0;
    }
  }
}
