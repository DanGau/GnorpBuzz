import type { GameState } from '../sim/state';
import {
  TUNING,
  getUpgradeTier,
  excavatorDamagePerStrike,
  cellSynergy,
} from '../sim/state';
import type { World } from './World';

interface BeeStats {
  speedMul: number;
  harvestMul: number;
  carryAmount: number;
}

// `synergy` is the count of same-role neighbor cells for this bee's home
// cell — foragers convert it into flight speed, excavators into damage.
function statsFor(role: BeeRole, state: GameState, synergy: number): BeeStats {
  const base: BeeStats = { speedMul: 1, harvestMul: 1, carryAmount: 1 };
  if (role === 'forager') {
    base.speedMul =
      Math.pow(1.15, getUpgradeTier(state, 'forager-swift-wings')) *
      (1 + TUNING.SYNERGY_FORAGER_SPEED * synergy);
    base.harvestMul = Math.pow(0.8, getUpgradeTier(state, 'forager-quick-forage'));
    base.carryAmount = 1 + getUpgradeTier(state, 'forager-pollen-pouches');
  } else {
    base.speedMul = Math.pow(1.15, getUpgradeTier(state, 'excavator-heavy-swarm'));
  }
  return base;
}

export type BeeRole = 'forager' | 'excavator';

export type BeeState =
  | 'idle'
  // forager
  | 'flying-to-flower'
  | 'harvesting'
  | 'flying-home-with-pollen'
  // excavator (one-shot: spawn → climb to hover → bob → dive → bonk → bounce → expire)
  | 'flying-to-hover'
  | 'hovering'
  | 'diving'
  | 'striking-impact'
  | 'bouncing'
  | 'expired';

export type BeeCarrying = 'none' | 'pollen';

const ARRIVE_THRESHOLD = 4;
const IDLE_WANDER_RADIUS = 30;
export const TIP_DURATION_MS = 700;

let beeIdSeq = 1;

export class Bee {
  id: string;
  role: BeeRole;
  // Home is the worker cell this bee belongs to: its hex coordinate and the
  // world-space position the comb cell sits at.
  cellQ: number;
  cellR: number;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  targetX: number;
  targetY: number;
  state: BeeState;
  carrying: BeeCarrying;
  carryAmount: number;
  workTimer: number;
  targetFlowerId: string | null;
  flapPhase: number;
  idleWaitMs: number;
  seed: number;
  shakeUntilMs: number;
  trailCooldownMs: number;
  windupRemainingMs: number;
  flightStartX: number;
  flightStartY: number;
  flightAgeMs: number;
  idleAccumulatedMs: number;
  consecutiveIdleResets: number;
  tipPhaseMs: number;
  nextTipScheduledAtMs: number;
  // Excavator-only: tracks position offset relative to dig site so multiple
  // excavators don't stack into the same pixel.
  swarmOffsetX: number;
  swarmOffsetY: number;
  // Excavator-only: cached strike geometry. impactX/Y is the boulder-surface
  // point the bee will ram. windupX/Y is the retreat point used during the
  // windup phase before charging forward.
  impactX: number;
  impactY: number;
  windupX: number;
  windupY: number;
  // Approach unit vector from windup point → impact point. Cached so the
  // charge animation knows which direction "forward" is.
  ramDirX: number;
  ramDirY: number;

  constructor(
    role: BeeRole,
    homeX: number,
    homeY: number,
    cellQ: number,
    cellR: number,
  ) {
    this.id = `bee-${beeIdSeq++}`;
    this.role = role;
    this.cellQ = cellQ;
    this.cellR = cellR;
    this.homeX = homeX;
    this.homeY = homeY;
    this.x = homeX + (Math.random() - 0.5) * 20;
    this.y = homeY + (Math.random() - 0.5) * 20;
    this.prevX = this.x;
    this.prevY = this.y;
    this.targetX = homeX;
    this.targetY = homeY;
    this.state = 'idle';
    this.carrying = 'none';
    this.carryAmount = 0;
    this.workTimer = 0;
    this.targetFlowerId = null;
    this.flapPhase = Math.random() * Math.PI * 2;
    this.idleWaitMs = 0;
    this.seed = Math.random() * 2 - 1;
    this.shakeUntilMs = 0;
    this.trailCooldownMs = 0;
    this.windupRemainingMs = 0;
    this.flightStartX = this.x;
    this.flightStartY = this.y;
    this.flightAgeMs = 0;
    this.idleAccumulatedMs = 0;
    this.consecutiveIdleResets = 0;
    this.tipPhaseMs = 0;
    this.nextTipScheduledAtMs = 4000 + Math.random() * 3000;
    // Spread impact points across the TOP face of the boulder. Bees will
    // hover above this spot then dive bomb straight down into it.
    // X within ±0.7R of center, Y on the upper half of the boulder.
    this.swarmOffsetX = (Math.random() - 0.5) * 1.4 * 100;
    this.swarmOffsetY = -30 - Math.random() * 30;
    this.impactX = 0;
    this.impactY = 0;
    this.windupX = 0;
    this.windupY = 0;
    this.ramDirX = 1;
    this.ramDirY = 0;
  }

  private flyToward(dtMs: number, state?: GameState): boolean {
    this.prevX = this.x;
    this.prevY = this.y;
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < ARRIVE_THRESHOLD && this.windupRemainingMs <= 0) return true;

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

    const speedMul = state ? this.stats(state).speedMul : 1;
    let baseSpeed = TUNING.BEE_SPEED * (1 + this.seed * 0.15) * speedMul;

    // Quad.out ease in / out so flight ramps up from rest and slows on approach.
    const accelFrac = Math.min(1, this.flightAgeMs / 200);
    const accelEase = accelFrac * (2 - accelFrac);
    let decelDist = 70;
    let easeFloor = 0.18;
    // Excavators are eager attackers — they zoom up to the hover spot with
    // minimal deceleration. Foragers keep the gentle approach.
    if (this.role === 'excavator') {
      baseSpeed *= 1.5;
      decelDist = 18;
      easeFloor = 0.6;
    }
    const decelFrac = Math.min(1, dist / decelDist);
    const decelEase = decelFrac * (2 - decelFrac);
    const easeMul = Math.max(easeFloor, Math.min(accelEase, decelEase));

    const move = baseSpeed * easeMul * (dtMs / 1000);
    if (move >= dist) {
      this.x = this.targetX;
      this.y = this.targetY;
      return true;
    }
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
    return false;
  }

  private pulseShake(state: GameState, durationMs = 120): void {
    this.shakeUntilMs = state.elapsedMs + durationMs;
  }

  private setFlightTarget(x: number, y: number, windupMs = 90): void {
    this.targetX = x;
    this.targetY = y;
    this.windupRemainingMs = windupMs;
    this.flightStartX = this.x;
    this.flightStartY = this.y;
    this.flightAgeMs = 0;
  }

  private homePos(_world: World): { x: number; y: number } {
    return { x: this.homeX, y: this.homeY };
  }

  // Stats for this bee, including the per-cell adjacency synergy bonus.
  private stats(state: GameState): BeeStats {
    const synergy = cellSynergy(state.hive, this.cellQ, this.cellR);
    return statsFor(this.role, state, synergy);
  }

  update(dtMs: number, state: GameState, world: World): void {
    this.flapPhase += (dtMs / 1000) * 30;

    if (this.state === 'idle') {
      this.idleAccumulatedMs += dtMs;
    } else {
      this.idleAccumulatedMs = 0;
      this.consecutiveIdleResets = 0;
    }

    if (this.tipPhaseMs > 0) {
      this.tipPhaseMs -= dtMs;
      if (this.tipPhaseMs < 0) this.tipPhaseMs = 0;
    } else if (
      this.state === 'idle' &&
      this.idleAccumulatedMs >= this.nextTipScheduledAtMs
    ) {
      this.tipPhaseMs = TIP_DURATION_MS;
      this.nextTipScheduledAtMs = this.idleAccumulatedMs + 4000 + Math.random() * 4000;
    }

    if (this.role === 'forager') {
      this.updateForager(dtMs, state, world);
    } else {
      this.updateExcavator(dtMs, state, world);
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
            // Poll fast — when a peer finishes harvesting and frees up a
            // flower slot we want the waiting bee to grab it immediately.
            this.idleWaitMs = 280;
            this.pickIdleTarget(world);
            // "?" only when there's genuinely no open flower slot anywhere
            // (everything wilted/regrowing or fully crewed).
            const anyOpenSlot = state.flowers.some(
              (f) => f.yieldRemaining - f.claimants > 0,
            );
            if (!anyOpenSlot) {
              this.bumpIdleConfusion(world);
            } else {
              this.consecutiveIdleResets = 0;
            }
          }
        }
        this.flyToward(dtMs, state);
        break;
      }
      case 'flying-to-flower': {
        if (this.flyToward(dtMs, state)) {
          const flower = state.flowers.find((f) => f.id === this.targetFlowerId);
          if (!flower || flower.yieldRemaining <= 0) {
            this.releaseFlowerClaim(state);
            this.returnToIdle(world);
          } else {
            this.state = 'harvesting';
            const fStats = this.stats(state);
            this.workTimer = TUNING.HARVEST_DURATION_MS * fStats.harvestMul;
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
            flower.claimants = Math.max(0, flower.claimants - 1);
            if (flower.yieldRemaining === 0) {
              flower.regrowTimerMs = TUNING.FLOWER_REGROW_MS;
            }
            world.particles.emit('sparkle', this.x, this.y - 4, 1);
          }
          this.carrying = 'pollen';
          this.targetFlowerId = null;
          const fs = this.stats(state);
          this.carryAmount = fs.carryAmount;
          const home = this.homePos(world);
          this.setFlightTarget(home.x, home.y - 10);
          this.state = 'flying-home-with-pollen';
          this.trailCooldownMs = 0;
        }
        break;
      }
      case 'flying-home-with-pollen': {
        this.trailCooldownMs -= dtMs;
        if (this.trailCooldownMs <= 0) {
          world.particles.emit('pollenPuff', this.x, this.y + 3, 1);
          this.trailCooldownMs = 600 + Math.random() * 200;
        }
        if (this.flyToward(dtMs, state)) {
          state.hive.pollen += this.carryAmount;
          world.particles.emit('pollenPuff', this.x, this.y, 4 + this.carryAmount * 2);
          this.pulseShake(state);
          this.carrying = 'none';
          this.carryAmount = 0;
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
      // A flower hosts as many bees as it has remaining yield — its bloom
      // is the cap, not a single exclusive claim.
      if (f.yieldRemaining - f.claimants <= 0) continue;
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
    f.claimants += 1;
    this.targetFlowerId = bestId;
    // Jitter the approach point so co-harvesting bees don't fully overlap.
    this.targetX = bestPos.x + this.seed * 7;
    this.targetY = bestPos.y - 6;
    return true;
  }

  private releaseFlowerClaim(state: GameState): void {
    if (!this.targetFlowerId) return;
    const f = state.flowers.find((x) => x.id === this.targetFlowerId);
    if (f) f.claimants = Math.max(0, f.claimants - 1);
    this.targetFlowerId = null;
  }

  // -------------------- Excavator --------------------
  // One-shot dive-bomb lifecycle:
  //   spawn → flying-to-hover (climb to a hover spot above the boulder)
  //         → hovering        (bob in mid-air, build anticipation)
  //         → diving          (plummet straight DOWN into the boulder)
  //         → striking-impact (contact frame — damage + dust burst)
  //         → bouncing        (knocked back up and away, arcing out)
  //         → expired         (hive queues a respawn)

  private updateExcavator(dtMs: number, state: GameState, world: World): void {
    const siteActive = state.digSite.state === 'active';

    switch (this.state) {
      case 'idle': {
        if (siteActive) {
          const site = world.digSite;
          if (site) {
            const sp = site.strikePoint();
            // Cache impact point (where the dive lands) and hover point
            // (directly above the impact, in the air).
            this.impactX = sp.x + this.swarmOffsetX;
            this.impactY = sp.y + this.swarmOffsetY;
            const HOVER_HEIGHT = 90;
            this.windupX = this.impactX;
            this.windupY = this.impactY - HOVER_HEIGHT;
            // Dive direction is straight down.
            this.ramDirX = 0;
            this.ramDirY = 1;
            // Fly to the hover point with a brisk approach (no late decel
            // sag — excavators are eager). flyToward still arrives cleanly
            // because we override the easing for excavator flight below.
            this.setFlightTarget(this.windupX, this.windupY);
            this.state = 'flying-to-hover';
          } else {
            this.flyToward(dtMs, state);
          }
        } else {
          this.idleWaitMs -= dtMs;
          if (this.idleWaitMs <= 0) {
            this.pickIdleTarget(world);
            this.idleWaitMs = TUNING.IDLE_WANDER_DURATION_MS;
          }
          this.flyToward(dtMs, state);
        }
        break;
      }
      case 'flying-to-hover': {
        if (!siteActive) {
          this.state = 'expired';
          world.particles.emit('crashDust', this.x, this.y, 2);
          break;
        }
        if (this.flyToward(dtMs, state)) {
          this.state = 'hovering';
          this.workTimer = 380; // mid-air anticipation window
        }
        break;
      }
      case 'hovering': {
        if (!siteActive) {
          this.state = 'expired';
          break;
        }
        this.workTimer -= dtMs;
        // Bob in mid-air with a gentle vertical sway + tiny horizontal
        // jitter. Sells the "lining up the shot" beat.
        this.prevX = this.x;
        this.prevY = this.y;
        const bobPhase = this.workTimer / 110;
        this.x = this.windupX + Math.sin(bobPhase * 0.8) * 2;
        this.y = this.windupY + Math.sin(bobPhase) * 4;
        // Last 90ms — bee tenses up, rises a hair higher for the snap.
        if (this.workTimer < 90) {
          const tense = 1 - this.workTimer / 90;
          this.y -= tense * 5;
        }
        if (this.workTimer <= 0) {
          this.state = 'diving';
          this.workTimer = 180; // dive duration
        }
        break;
      }
      case 'diving': {
        if (!siteActive) {
          this.state = 'expired';
          break;
        }
        this.workTimer -= dtMs;
        // Cubic ease-in from the hover point straight down to impact.
        const total = 180;
        const t = Math.max(0, Math.min(1, 1 - this.workTimer / total));
        const eased = t * t * t;
        this.prevX = this.x;
        this.prevY = this.y;
        this.x = this.windupX + (this.impactX - this.windupX) * eased;
        this.y = this.windupY + (this.impactY - this.windupY) * eased;
        // Speed lines streaming behind the diving bee.
        if (Math.random() < 0.6) {
          world.particles.emit('crashDust', this.x, this.y - 4, 1);
        }
        if (this.workTimer <= 0) {
          // BONK. Snap exactly to impact point, apply damage, burst.
          this.x = this.impactX;
          this.y = this.impactY;
          const synergy = cellSynergy(state.hive, this.cellQ, this.cellR);
          const dmg =
            excavatorDamagePerStrike(state) *
            (1 + TUNING.SYNERGY_EXCAVATOR_DAMAGE * synergy);
          state.digSite.hp = Math.max(0, state.digSite.hp - dmg);
          world.particles.emit('crashDust', this.impactX, this.impactY + 6, 12);
          world.particles.emit('sparkle', this.impactX, this.impactY, 3);
          this.pulseShake(state, 180);
          this.state = 'striking-impact';
          this.workTimer = 70; // very brief squashed-to-rock pose
        }
        break;
      }
      case 'striking-impact': {
        this.workTimer -= dtMs;
        // Pinned to impact point — view shows the splat squash.
        this.prevX = this.x;
        this.prevY = this.y;
        this.x = this.impactX;
        this.y = this.impactY;
        if (this.workTimer <= 0) {
          // Kick off the bounce: pick a tumble velocity up and sideways.
          // Side direction biased by which half of the boulder we're on so
          // bees fan out instead of all bouncing the same way.
          this.state = 'bouncing';
          this.workTimer = 360;
          // Stash bounce velocity in workTimer-adjacent fields. Reuse
          // ramDirX/Y as the tumble direction (up and outward).
          const sideways = Math.sign(this.swarmOffsetX || (Math.random() - 0.5));
          this.ramDirX = sideways * (0.7 + Math.random() * 0.5);
          this.ramDirY = -(1.6 + Math.random() * 0.6); // strongly upward
        }
        break;
      }
      case 'bouncing': {
        this.workTimer -= dtMs;
        // Ballistic tumble — initial velocity from impact, gravity drags
        // the bee back down. We integrate position directly here.
        this.prevX = this.x;
        this.prevY = this.y;
        const dt = dtMs / 1000;
        // ramDirX/Y are unitless "knockback" magnitudes. Convert to px/sec.
        const SPEED = 160;
        this.x += this.ramDirX * SPEED * dt;
        this.y += this.ramDirY * SPEED * dt;
        // Gravity-like drag pulls the upward velocity down over the bounce.
        this.ramDirY += 4 * dt;
        if (this.workTimer <= 0) {
          this.state = 'expired';
          world.particles.emit('crashDust', this.x, this.y + 4, 2);
        }
        break;
      }
      case 'expired': {
        break;
      }
      default: {
        this.state = 'expired';
      }
    }
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

  private bumpIdleConfusion(world: World): void {
    this.consecutiveIdleResets += 1;
    if (this.consecutiveIdleResets >= 3) {
      world.particles.emit('huh', this.x, this.y - 12, 1);
      this.consecutiveIdleResets = 0;
    }
  }
}
