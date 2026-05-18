import type { GameState } from '../sim/state';
import {
  TUNING,
  getUpgradeTier,
  geomancerDamagePerStrike,
  cantorDamagePerSpark,
  cantorCastIntervalMs,
  cantorRefundEveryNCasts,
  cellSynergy,
  refineHoney,
  spendHoney,
  manaCostFor,
} from '../sim/state';
import type { World } from './World';

interface BeeStats {
  speedMul: number;
  harvestMul: number;
  carryAmount: number;
}

// `synergy` is the count of same-role neighbor cells for this bee's home
// cell — foragers convert it into flight speed, geomancers into damage.
function statsFor(role: BeeRole, state: GameState, synergy: number): BeeStats {
  const base: BeeStats = { speedMul: 1, harvestMul: 1, carryAmount: 1 };
  if (role === 'forager') {
    base.speedMul =
      Math.pow(1.15, getUpgradeTier(state, 'forager-swift-wings')) *
      (1 + TUNING.SYNERGY_FORAGER_SPEED * synergy);
    base.harvestMul = Math.pow(0.8, getUpgradeTier(state, 'forager-quick-forage'));
    base.carryAmount = 1 + getUpgradeTier(state, 'forager-pollen-pouches');
  } else if (role === 'geomancer') {
    base.speedMul = Math.pow(1.15, getUpgradeTier(state, 'geomancer-heavy-swarm'));
  }
  // Cantor uses no flight speed multipliers — it hovers in place and casts.
  return base;
}

export type BeeRole = 'forager' | 'geomancer' | 'cantor';

export type BeeState =
  | 'idle'
  // shared: a spellcaster sitting on empty mana drifts in a loose swarm
  // near its home cell until honey is available again.
  | 'idle-swarm'
  // forager
  | 'flying-to-flower'
  | 'harvesting'
  | 'flying-home-with-pollen'
  // geomancer (one-shot: spawn → climb to hover → bob → dive → bonk → bounce → expire)
  | 'flying-to-hover'
  | 'hovering'
  | 'diving'
  | 'striking-impact'
  | 'bouncing'
  | 'expired'
  // cantor (persistent: rise to hover slot above home cell, then cycle
  // between hovering and casting sparks toward the dig site)
  | 'cantor-rising'
  | 'cantor-hovering'
  | 'cantor-casting';

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
  // Geomancer-only: tracks position offset relative to dig site so multiple
  // geomancers don't stack into the same pixel.
  swarmOffsetX: number;
  swarmOffsetY: number;
  // Geomancer-only: cached strike geometry. impactX/Y is the boulder-surface
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
  // Cantor-only bookkeeping. `castTimerMs` counts down between successful
  // casts (when 0, attempt the next cast). `castCount` is the running total
  // of casts this bee has performed — used by Mana Sip to refund every Nth
  // cast. `hoverX/Y` is the world-space hover slot above the home cell.
  castTimerMs: number;
  castCount: number;
  hoverX: number;
  hoverY: number;

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
    this.castTimerMs = 0;
    this.castCount = 0;
    // Cantor hover slot — a small lateral jitter so a cluster of cantors
    // spreads out above the comb rather than stacking on one pixel.
    this.hoverX = homeX + (Math.random() - 0.5) * 18;
    this.hoverY = homeY + TUNING.CANTOR_HOVER_OFFSET_Y + (Math.random() - 0.5) * 10;
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
    // Geomancers are eager attackers — they zoom up to the hover spot with
    // minimal deceleration. Foragers keep the gentle approach.
    if (this.role === 'geomancer') {
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
    } else if (this.role === 'cantor') {
      this.updateCantor(dtMs, state, world);
    } else {
      this.updateGeomancer(dtMs, state, world);
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
          // Refine some of the deposit into honey/mana up to the cap. Excess
          // pollen still sits in the upgrade pool — same deposit, two pools.
          const refined = refineHoney(state, this.carryAmount);
          world.particles.emit('pollenPuff', this.x, this.y, 4 + this.carryAmount * 2);
          if (refined > 0) {
            // Visual chain: pollen puff at the entrance + jar bump + sparkle
            // at the jar. Reads as the deposit "becoming" mana in the jar.
            world.emitManaRefine(refined);
          }
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

  // -------------------- Geomancer --------------------
  // One-shot dive-bomb lifecycle:
  //   spawn → flying-to-hover (climb to a hover spot above the boulder)
  //         → hovering        (bob in mid-air, build anticipation)
  //         → diving          (plummet straight DOWN into the boulder)
  //         → striking-impact (contact frame — damage + dust burst)
  //         → bouncing        (knocked back up and away, arcing out)
  //         → expired         (hive queues a respawn)

  private updateGeomancer(dtMs: number, state: GameState, world: World): void {
    const siteActive = state.digSite.state === 'active';

    switch (this.state) {
      case 'idle-swarm': {
        // Out of mana — drift in a small wandering loop near the hive until
        // the retry timer expires, then drop back to idle to check honey.
        this.tickIdleSwarm(dtMs, state, world);
        break;
      }
      case 'idle': {
        if (siteActive) {
          // Mana gate. A geomancer needs honey to cast its dive spell.
          // Pay up front so the player sees the reservoir drop the instant
          // the bee commits — and so an empty reservoir parks the bee in
          // an idle swarm instead of letting it fly out unfunded.
          if (!spendHoney(state, manaCostFor('geomancer'))) {
            this.enterIdleSwarm(world);
            break;
          }
          // Mana flows out of the jar toward the bee that just committed
          // to fly. Visual chain: jar squish → orb to bee → bee dives.
          world.emitManaDraw(this.x, this.y);
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
            // sag — geomancers are eager). flyToward still arrives cleanly
            // because we override the easing for geomancer flight below.
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
            geomancerDamagePerStrike(state) *
            (1 + TUNING.SYNERGY_GEOMANCER_DAMAGE * synergy);
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

  // -------------------- Cantor --------------------
  //
  // Persistent cantrip caster. Rises from its home cell to a hover slot
  // just above the comb, then cycles between hovering and casting tiny
  // sparks at the dig site. Cantors never fly to the rock and never expire;
  // they keep casting as long as the cell exists.
  //
  //   spawn → cantor-rising (ascend to hover slot)
  //         → cantor-hovering (idle bob; cast timer ticks down)
  //         → cantor-casting  (brief mid-air windup; emit spark; deal damage)
  //         → cantor-hovering (loop)
  //
  // If a cast is attempted with empty honey reserves, the cantor falls into
  // the shared idle-swarm state until honey is available again.

  private updateCantor(dtMs: number, state: GameState, world: World): void {
    const siteActive = state.digSite.state === 'active';

    switch (this.state) {
      case 'idle-swarm': {
        this.tickIdleSwarm(dtMs, state, world);
        // Cantors return to their hover slot specifically (not just 'idle')
        // when the swarm retry fires — so we override the post-swarm target.
        // The cast widens the union back out since the switch arm narrowed it.
        if ((this.state as BeeState) === 'idle') {
          this.setFlightTarget(this.hoverX, this.hoverY);
          this.state = 'cantor-rising';
        }
        break;
      }
      case 'idle':
      case 'cantor-rising': {
        // Climb to hover slot above the home cell, then settle into the
        // hovering cast loop.
        if (this.state === 'idle') {
          this.setFlightTarget(this.hoverX, this.hoverY);
          this.state = 'cantor-rising';
        }
        if (this.flyToward(dtMs, state)) {
          this.state = 'cantor-hovering';
          this.castTimerMs = cantorCastIntervalMs(state) * 0.5; // first cast comes soon
        }
        break;
      }
      case 'cantor-hovering': {
        // Bob in place. Slight horizontal drift so cantors don't look static.
        this.prevX = this.x;
        this.prevY = this.y;
        const bob = Math.sin((state.elapsedMs + this.seed * 1000) / 320) * 2.2;
        const sway = Math.sin((state.elapsedMs + this.seed * 600) / 540) * 1.4;
        this.x = this.hoverX + sway;
        this.y = this.hoverY + bob;

        if (!siteActive) break;

        this.castTimerMs -= dtMs;
        if (this.castTimerMs <= 0) {
          // Attempt to cast. Mana gate happens here.
          if (!spendHoney(state, manaCostFor('cantor'))) {
            this.enterIdleSwarm(world);
            break;
          }
          // Mana orb flies from the jar up to the cantor — connects the
          // jar dropping to the spark leaving the bee a moment later.
          world.emitManaDraw(this.x, this.y);
          // Mana Sip refund — every Nth cast returns 1 honey (still capped).
          const refundEvery = cantorRefundEveryNCasts(state);
          this.castCount += 1;
          if (refundEvery > 0 && this.castCount % refundEvery === 0) {
            refineHoney(state, 1);
          }

          // Apply damage immediately to the dig site. The flying spark is
          // cosmetic — keeps the sim deterministic and lets the projectile
          // be skipped at zero cost in headless tests.
          const synergy = cellSynergy(state.hive, this.cellQ, this.cellR);
          const dmg =
            cantorDamagePerSpark(state) *
            (1 + TUNING.SYNERGY_GEOMANCER_DAMAGE * synergy);
          state.digSite.hp = Math.max(0, state.digSite.hp - dmg);

          // Visual spark heading toward the rock.
          const site = world.digSite;
          if (site) {
            const sp = site.strikePoint();
            world.emitSpark(this.x, this.y, sp.x, sp.y);
            world.particles.emit('sparkle', this.x, this.y, 2);
          }
          this.pulseShake(state, 90);
          this.state = 'cantor-casting';
          this.workTimer = 160;
        }
        break;
      }
      case 'cantor-casting': {
        // Brief mid-air recoil pose. View handles the squash; sim just
        // counts time and returns to hovering.
        this.prevX = this.x;
        this.prevY = this.y;
        this.workTimer -= dtMs;
        if (this.workTimer <= 0) {
          this.state = 'cantor-hovering';
          this.castTimerMs = cantorCastIntervalMs(state);
        }
        break;
      }
      default: {
        this.state = 'cantor-rising';
        this.setFlightTarget(this.hoverX, this.hoverY);
      }
    }
  }

  // -------------------- Shared --------------------

  // Park a spellcaster bee in the shared idle-swarm state. Picks a small
  // wandering target near the home cell and starts the retry timer.
  private enterIdleSwarm(world: World): void {
    this.state = 'idle-swarm';
    this.idleWaitMs = TUNING.SPELL_IDLE_RETRY_MS;
    this.pickIdleTarget(world);
  }

  // Tick the idle-swarm loop: drift toward the swarm target, occasionally
  // pick a new one, and exit back to 'idle' when the retry timer expires.
  private tickIdleSwarm(dtMs: number, state: GameState, world: World): void {
    this.idleWaitMs -= dtMs;
    // Pick a fresh wander target every ~500ms so the swarm reads as alive.
    if (Math.random() < dtMs / 500) this.pickIdleTarget(world);
    this.flyToward(dtMs, state);
    if (this.idleWaitMs <= 0) {
      this.state = 'idle';
      this.idleWaitMs = 0;
    }
  }

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
