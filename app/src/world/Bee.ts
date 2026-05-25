import type { GameState, RockDrop } from '../sim/state';
import {
  TUNING,
  getUpgradeTier,
  cantorDamagePerSpark,
  cantorCastIntervalMs,
  cantorRefundEveryNCasts,
  cellSynergy,
  addPollen,
  takePollen,
  pollenSiloHasRoom,
  addHoney,
  addWax,
  addFertilizer,
  waxCap,
  fertilizerCap,
  waxPerDelivery,
  spendHoney,
  manaCostFor,
  digSiteAcceptingDamage,
  queuePendingHit,
  nearestEmptyMeadowTile,
  plantFlowerAt,
  removeRockDrop,
} from '../sim/state';
import type { World } from './World';
import { WORLD } from './layout';

// Per-role idle parking zones. Each bee role gathers around a visible
// world-space building, so the overview reads the colony's role mix at
// a glance:
//
//   FORAGER       → swarms the Pollen Silo (left meadow, economy)
//   WAX WORKER    → swarms the Wax Block  (left meadow, economy)
//   HONEY WORKER  → cluster around the Honey Jar (above hive, between zones)
//   CANTOR        → tight cluster around the Honey Jar (drawing mana)
//
// Each zone is `centerX/Y` ± `spreadX/Y`. Bees pick a random spot inside
// their zone at construction (once, stable) and use it as the wander
// center for any idle behavior plus the destination for return flights.
//
// The buildings (Pollen Silo, Wax Block, Honey Jar) are NOT here — they
// live at `WORLD.POLLEN_SILO`, `WORLD.WAX_BLOCK`, `WORLD.HONEY_JAR` and
// the bees route to those coordinates explicitly when working. The park
// anchors put each role HOVERING ABOVE its building like a small swarm
// cloud — not on top of it — so the building silhouette and its fill /
// count UI stay readable and the bees read as "tending the thing below
// them" rather than smothering it.
export const PARK_ANCHORS = {
  forager: { x: WORLD.POLLEN_SILO.x + 4, y: WORLD.POLLEN_SILO.y - 36 },
  'honey-worker': { x: WORLD.HONEY_JAR.x - 18, y: WORLD.HONEY_JAR.y - 38 },
  'wax-worker': { x: WORLD.WAX_BLOCK.x, y: WORLD.WAX_BLOCK.y - 76 },
  cantor: { x: WORLD.HIVE.x, y: WORLD.HIVE.y - 80 },
} as const;

type ParkRole = keyof typeof PARK_ANCHORS;

const PARK_ZONES: Record<
  ParkRole,
  { centerX: number; centerY: number; spreadX: number; spreadY: number }
> = {
  // Foragers swarm around the Pollen Silo where they drop their harvest.
  forager: {
    centerX: PARK_ANCHORS.forager.x,
    centerY: PARK_ANCHORS.forager.y,
    spreadX: 40,
    spreadY: 12,
  },
  // Honey workers cluster around the Honey Jar — tight, since they share
  // the jar with cantors. Slight downward bias so they read as the
  // ground-floor staff vs. the cantors hovering above.
  'honey-worker': {
    centerX: PARK_ANCHORS['honey-worker'].x,
    centerY: PARK_ANCHORS['honey-worker'].y,
    spreadX: 18,
    spreadY: 10,
  },
  // Wax workers cluster around the Wax Block.
  'wax-worker': {
    centerX: PARK_ANCHORS['wax-worker'].x,
    centerY: PARK_ANCHORS['wax-worker'].y,
    spreadX: 22,
    spreadY: 10,
  },
  // Cantors orbit the honey jar — the wizards' coven, drawing mana
  // straight from the reservoir they live next to.
  cantor: {
    centerX: PARK_ANCHORS.cantor.x,
    centerY: PARK_ANCHORS.cantor.y + 20,
    spreadX: 36,
    spreadY: 14,
  },
};

interface BeeStats {
  speedMul: number;
  harvestMul: number;
}

// `synergy` is the count of same-role neighbor cells for this bee's home
// cell — foragers convert it into flight speed, cantors into damage.
function statsFor(role: BeeRole, state: GameState, synergy: number): BeeStats {
  const base: BeeStats = { speedMul: 1, harvestMul: 1 };
  if (role === 'forager') {
    base.speedMul =
      Math.pow(1.15, getUpgradeTier(state, 'forager-swift-wings')) *
      (1 + TUNING.SYNERGY_FORAGER_SPEED * synergy);
    base.harvestMul = Math.pow(0.8, getUpgradeTier(state, 'forager-quick-forage'));
  } else if (role === 'wax-worker') {
    base.speedMul = Math.pow(1.12, getUpgradeTier(state, 'waxworker-swift-haul'));
  }
  // Cantors and honey-workers don't apply flight-speed multipliers.
  return base;
}

export type BeeRole =
  | 'forager'
  | 'honey-worker'
  | 'wax-worker'
  | 'cantor';

export type BeeState =
  | 'idle'
  // shared: a spellcaster sitting on empty mana drifts in a loose swarm
  // near its home cell until honey is available again.
  | 'idle-swarm'
  // forager — pollen path
  | 'flying-to-flower'
  | 'harvesting'
  | 'flying-home-with-pollen'
  // forager — rock-drop haul paths. Foragers split their attention between
  // the meadow (pollen) and the rock pile (seeds + fertilizer). Each idle
  // tick they pick the NEAREST viable task.
  | 'flying-to-drop'           // fetching a claimed drop from the rock pile
  | 'lifting-drop'             // hovering over the pile while the drop tweens up into the bee
  | 'flying-to-plant'          // carrying a seed to the nearest empty meadow tile
  | 'flying-to-fertilizer-bin' // carrying fertilizer to the Fertilizer Bin
  // worker (honey-worker or wax-worker): home → forager pile → home cycle
  // where deposit converts one pollen dot into honey or wax respectively.
  | 'worker-flying-out'
  | 'worker-flying-home'
  | 'worker-depositing'
  // cantor (persistent: rise to hover slot above home cell, then cycle
  // between hovering and casting sparks toward the dig site)
  | 'cantor-rising'
  | 'cantor-hovering'
  | 'cantor-casting';

export type BeeCarrying = 'none' | 'pollen' | 'seed' | 'fertilizer';

const ARRIVE_THRESHOLD = 4;
const IDLE_WANDER_RADIUS = 30;
export const TIP_DURATION_MS = 700;
// How long a forager hovers over the pile pulling a drop up before
// committing to its next flight. 150ms is long enough to read as "the
// rock is being plucked" without slowing the haul loop perceptibly.
const LIFT_DURATION_MS = 150;
// How long the carry sprite pops in with a back.out scale envelope after
// the lift completes. Slightly longer than the lift so the payload feels
// like it lands on the bee with weight.
const CARRY_FLASH_DURATION_MS = 220;

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
  // Cantor-only bookkeeping. `castTimerMs` counts down between successful
  // casts (when 0, attempt the next cast). `castCount` is the running total
  // of casts this bee has performed — used by Mana Sip to refund every Nth
  // cast. `hoverX/Y` is the world-space hover slot above the home cell.
  castTimerMs: number;
  castCount: number;
  hoverX: number;
  hoverY: number;
  // Forager rock-drop bookkeeping. When the bee claims a settled drop in
  // the rock pile, the drop's id and quality go here so we can release it
  // cleanly on cancel and know what to do on pickup. Tier is meaningful
  // only while carrying === 'seed'; plantTarget is the meadow tile we
  // committed to while flying-to-plant.
  claimedDropId: string | null;
  carrySeedTier: 1 | 2 | 3;
  plantTargetX: number;
  plantTargetY: number;
  // Pickup-lift bookkeeping. While in `lifting-drop`, the bee hovers in
  // place for `LIFT_DURATION_MS` while the drop's sprite tweens up to
  // the bee (the lift fields live on the RockDrop entity, so RockDropView
  // can interpolate without touching the drop's physics position).
  // After the lift completes, `carryFlashMs` runs the carry sprite
  // through a back.out pop-in so the payload appears with weight rather
  // than snapping into being.
  liftElapsedMs: number;
  carryFlashMs: number;
  // Sky parking spot above the hive — per-bee fixed, used as the wander
  // center for any idle state and the destination for return-to-base
  // flights. Replaces the old "wander around the home cell" behavior so
  // bees stop cluttering the honeycomb when zoomed in.
  parkX: number;
  parkY: number;

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
    // Every bee gets a stable parking spot inside its role's zone — a
    // visible cluster around the role's anchor building. Picked once at
    // construction so the bee always drifts back to the same pixel-cluster
    // instead of jumping around the zone every idle tick. The comb cell
    // is purely a population-slot bookkeeping device; bees never visit it.
    const zone = PARK_ZONES[role];
    this.parkX = zone.centerX + (Math.random() - 0.5) * zone.spreadX;
    this.parkY = zone.centerY + (Math.random() - 0.5) * zone.spreadY;
    // Spawn at the park spot directly — keeps freshly-bought workers from
    // popping in inside the comb.
    this.x = this.parkX;
    this.y = this.parkY;
    this.prevX = this.x;
    this.prevY = this.y;
    this.targetX = this.parkX;
    this.targetY = this.parkY;
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
    this.castTimerMs = 0;
    this.castCount = 0;
    this.claimedDropId = null;
    this.carrySeedTier = 1;
    this.plantTargetX = 0;
    this.plantTargetY = 0;
    this.liftElapsedMs = 0;
    this.carryFlashMs = 0;
    // Cantor's cast position — sits inside the park zone, slightly above
    // the other bees parked there so multiple cantors stack cleanly along
    // the top of the cloud rather than weaving through the drifters below.
    this.hoverX = this.parkX;
    this.hoverY = this.parkY - 10;
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
    const decelDist = 70;
    const easeFloor = 0.18;
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
    // "Home" for movement purposes is the bee's sky parking spot, not its
    // honeycomb cell. The cell position is kept on `homeX/homeY` for
    // synergy bookkeeping but bees never physically visit it any more.
    return { x: this.parkX, y: this.parkY };
  }

  // Stats for this bee, including the per-cell adjacency synergy bonus.
  private stats(state: GameState): BeeStats {
    const synergy = cellSynergy(state.hive, this.cellQ, this.cellR);
    return statsFor(this.role, state, synergy);
  }

  update(dtMs: number, state: GameState, world: World): void {
    this.flapPhase += (dtMs / 1000) * 30;
    if (this.carryFlashMs > 0) {
      this.carryFlashMs = Math.max(0, this.carryFlashMs - dtMs);
    }

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
    } else if (this.role === 'honey-worker' || this.role === 'wax-worker') {
      this.updateWorker(dtMs, state, world);
    } else {
      this.updateCantor(dtMs, state, world);
    }
  }

  // -------------------- Forager --------------------

  private updateForager(dtMs: number, state: GameState, world: World): void {
    switch (this.state) {
      case 'idle': {
        this.idleWaitMs -= dtMs;
        if (this.idleWaitMs <= 0) {
          // Pick the NEAREST viable task: a flower in the meadow OR a
          // settled drop on the rock pile. The silo being full only
          // gates the flower path — foragers can still haul seeds /
          // fertilizer because those go to different containers.
          const picked = this.pickForagerTask(state, world);
          if (picked) {
            this.consecutiveIdleResets = 0;
          } else {
            // Nothing actionable — bob in place. Poll fast so a freed-up
            // slot or a new drop is grabbed immediately.
            this.idleWaitMs = 280;
            this.pickIdleTarget(world);
            const anyOpenFlower = state.flowers.some(
              (f) => f.yieldRemaining - f.claimants > 0,
            );
            const anyDrop = state.rockDrops.some(
              (d) => d.settled && !d.claimedBy,
            );
            if (!anyOpenFlower && !anyDrop) {
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
          this.carryAmount = 1;
          // Fly to the Pollen Silo to drop off — NOT back to the park
          // spot or the comb cell. The silo is the visible deposit point.
          this.setFlightTarget(WORLD.POLLEN_SILO.x, WORLD.POLLEN_SILO.y - 6);
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
          // Drop pollen into the global silo. If the silo is full the
          // deposit clamps to 0 — but `idle` already gates on
          // `pollenSiloHasRoom`, so this is only an issue if the cap
          // changed mid-flight (debug grants).
          const added = addPollen(state, this.carryAmount);
          world.particles.emit('pollenPuff', this.x, this.y, 6);
          if (added > 0) {
            // Extra puff at the silo's lip — completes the visual "the
            // pollen went IN here" chain. Slightly above the bee so the
            // dust reads as bouncing off the container rim.
            world.particles.emit(
              'pollenPuff',
              WORLD.POLLEN_SILO.x,
              WORLD.POLLEN_SILO.y - 12,
              3,
            );
          }
          this.pulseShake(state);
          this.carrying = 'none';
          this.carryAmount = 0;
          this.state = 'idle';
          this.idleWaitMs = 0;
          // Return to the park spot — picked at construction, so the
          // forager always drifts back to the same cluster around the silo.
          this.targetX = this.parkX;
          this.targetY = this.parkY;
        }
        break;
      }
      case 'flying-to-drop': {
        if (this.flyToward(dtMs, state)) {
          // Arrived. Start the lift tween — the drop visibly travels up
          // into the bee over LIFT_DURATION_MS rather than disappearing
          // on contact. If the drop vanished mid-flight (defensive — the
          // claim should prevent this), abort to idle.
          const drop = state.rockDrops.find((d) => d.id === this.claimedDropId);
          if (!drop) {
            this.claimedDropId = null;
            this.returnToIdle(world);
            break;
          }
          // Snapshot the start positions onto the drop so RockDropView
          // can interpolate the sprite without us touching the entity's
          // own x/y (which the physics system still reads for stacking
          // and support checks on neighbors).
          this.liftElapsedMs = 0;
          drop.liftT = 0;
          drop.liftFromX = drop.x;
          drop.liftFromY = drop.y;
          drop.liftToX = this.x;
          drop.liftToY = this.y;
          this.state = 'lifting-drop';
        }
        break;
      }
      case 'lifting-drop': {
        const drop = state.rockDrops.find((d) => d.id === this.claimedDropId);
        if (!drop) {
          // Drop vanished mid-lift (couldn't happen short of a debug grant
          // or save-load; the claim should hold it). Bail cleanly.
          this.claimedDropId = null;
          this.returnToIdle(world);
          break;
        }
        this.liftElapsedMs += dtMs;
        const t = Math.min(1, this.liftElapsedMs / LIFT_DURATION_MS);
        // Keep the lift target tracking the bee's live position in case
        // the bee bobs slightly. (Currently it doesn't during lifting,
        // but this keeps it correct under any future hover motion.)
        drop.liftToX = this.x;
        drop.liftToY = this.y;
        drop.liftT = t;
        // Spin up on the way out — a final flourish that reads as torque.
        // Rotation is purely cosmetic so updating it on the entity is fine.
        drop.rotation += 22 * t * (dtMs / 1000);
        if (t >= 1) {
          // Lift complete — finalize the pickup. Decide destination, fire
          // sparkles + carry-pop, then transition.
          this.pulseShake(state, 80);
          world.particles.emit('sparkle', this.x, this.y, 3);
          if (drop.kind === 'seed') {
            this.carrying = 'seed';
            this.carrySeedTier = drop.tier;
            const tile = nearestEmptyMeadowTile(state, this.x, this.y);
            removeRockDrop(state, drop.id);
            this.claimedDropId = null;
            this.carryFlashMs = CARRY_FLASH_DURATION_MS;
            if (!tile) {
              // Meadow filled while the bee was hauling — drop the seed
              // and go idle. (User accepted that bad management wastes
              // resources.)
              this.carrying = 'none';
              this.carryFlashMs = 0;
              this.returnToIdle(world);
              break;
            }
            this.plantTargetX = tile.x;
            this.plantTargetY = tile.y;
            this.setFlightTarget(tile.x, tile.y - 4);
            this.state = 'flying-to-plant';
          } else {
            this.carrying = 'fertilizer';
            removeRockDrop(state, drop.id);
            this.claimedDropId = null;
            this.carryFlashMs = CARRY_FLASH_DURATION_MS;
            this.setFlightTarget(
              WORLD.FERTILIZER_BIN.x + this.seed * 4,
              WORLD.FERTILIZER_BIN.y - 6,
            );
            this.state = 'flying-to-fertilizer-bin';
          }
        }
        break;
      }
      case 'flying-to-plant': {
        if (this.flyToward(dtMs, state)) {
          // Plant! The new flower appears at the target tile. Slice 4
          // will replace the instant-bloom with a sapling growth phase.
          plantFlowerAt(state, this.plantTargetX, this.plantTargetY, this.carrySeedTier);
          world.particles.emit('sparkle', this.plantTargetX, this.plantTargetY - 4, 3);
          this.pulseShake(state, 90);
          this.carrying = 'none';
          this.state = 'idle';
          this.idleWaitMs = 0;
          this.setFlightTarget(this.parkX, this.parkY);
        }
        break;
      }
      case 'flying-to-fertilizer-bin': {
        if (this.flyToward(dtMs, state)) {
          const added = addFertilizer(state, 1);
          if (added > 0) {
            world.particles.emit(
              'sparkle',
              WORLD.FERTILIZER_BIN.x,
              WORLD.FERTILIZER_BIN.y - 8,
              3,
            );
          }
          this.pulseShake(state, 90);
          this.carrying = 'none';
          this.state = 'idle';
          this.idleWaitMs = 0;
          this.setFlightTarget(this.parkX, this.parkY);
        }
        break;
      }
      default: {
        this.returnToIdle(world);
      }
    }
  }

  // Pick the nearest actionable task for an idle forager — a flower
  // (pollen) or a settled rock-drop (seed/fertilizer). Sets up the claim
  // and transitions to the appropriate flying state. Returns true if a
  // task was claimed.
  private pickForagerTask(state: GameState, world: World): boolean {
    let bestKind: 'flower' | 'drop' | null = null;
    let bestDist = Infinity;
    let bestFlowerId: string | null = null;
    let bestFlowerPos: { x: number; y: number } | null = null;
    let bestDrop: RockDrop | null = null;

    // Flower candidates — only if silo has room AND the flower has an
    // open slot (yield > claimants).
    if (pollenSiloHasRoom(state)) {
      for (const f of state.flowers) {
        // Saplings (still growing) can't be harvested yet — skip until
        // they open up.
        if (f.growthMs > 0) continue;
        if (f.yieldRemaining - f.claimants <= 0) continue;
        const pos = world.getFlowerPosition(f.id);
        if (!pos) continue;
        const d = Math.hypot(pos.x - this.x, pos.y - this.y);
        if (d < bestDist) {
          bestDist = d;
          bestKind = 'flower';
          bestFlowerId = f.id;
          bestFlowerPos = pos;
        }
      }
    }

    // Drop candidates — only those that lead to a useful action right
    // now. Seeds require an empty meadow tile; fertilizer requires bin
    // room. Cheaper "any open tile" check is computed lazily on first
    // seed encounter so a fully-pollen-only situation doesn't pay for it.
    let meadowTileChecked = false;
    let meadowTileAvailable = false;
    const binFull = state.hive.fertilizer >= fertilizerCap(state);
    for (const drop of state.rockDrops) {
      if (!drop.settled || drop.claimedBy) continue;
      if (drop.kind === 'seed') {
        if (!meadowTileChecked) {
          meadowTileChecked = true;
          meadowTileAvailable = nearestEmptyMeadowTile(state, 0, 0) !== null;
        }
        if (!meadowTileAvailable) continue;
      } else if (drop.kind === 'fertilizer') {
        if (binFull) continue;
      }
      const d = Math.hypot(drop.x - this.x, drop.y - this.y);
      if (d < bestDist) {
        bestDist = d;
        bestKind = 'drop';
        bestDrop = drop;
      }
    }

    if (bestKind === 'flower' && bestFlowerId && bestFlowerPos) {
      const f = state.flowers.find((x) => x.id === bestFlowerId);
      if (!f) return false;
      f.claimants += 1;
      this.targetFlowerId = bestFlowerId;
      // Jitter the approach point so co-harvesting bees don't fully overlap.
      this.targetX = bestFlowerPos.x + this.seed * 7;
      this.targetY = bestFlowerPos.y - 6;
      this.windupRemainingMs = 100;
      this.state = 'flying-to-flower';
      return true;
    }
    if (bestKind === 'drop' && bestDrop) {
      bestDrop.claimedBy = this.id;
      this.claimedDropId = bestDrop.id;
      // Approach slightly above the drop so the bee doesn't bury its body
      // in the pile silhouette.
      this.setFlightTarget(bestDrop.x + this.seed * 4, bestDrop.y - 6);
      this.state = 'flying-to-drop';
      return true;
    }
    return false;
  }

  private releaseFlowerClaim(state: GameState): void {
    if (!this.targetFlowerId) return;
    const f = state.flowers.find((x) => x.id === this.targetFlowerId);
    if (f) f.claimants = Math.max(0, f.claimants - 1);
    this.targetFlowerId = null;
  }

  // -------------------- Worker (honey-worker / wax-worker) --------------------
  //
  // Persistent bee that lives at its building (Honey Jar for honey workers,
  // Wax Block for wax workers). Cycle: park spot → Pollen Silo (pick up
  // one pollen) → home building (deposit, convert) → park spot. Gates:
  //  - No pollen in the silo: bob at park, retry soon.
  //  - Output container at cap: bob at park, retry soon — visible "we
  //    have nowhere to put more honey/wax" tell.
  //
  //   idle              → check gates; if clear, fly to silo
  //   worker-flying-out → arrive at silo, pluck one pollen if available
  //   worker-flying-home→ fly to home building (Honey Jar or Wax Block)
  //   worker-depositing → brief bob, then add honey/wax and loop

  private updateWorker(dtMs: number, state: GameState, world: World): void {
    switch (this.state) {
      case 'idle': {
        this.idleWaitMs -= dtMs;
        if (this.idleWaitMs > 0) {
          this.flyToward(dtMs, state);
          break;
        }
        // Output-at-cap gate. Honey workers idle when the jar is full;
        // wax workers idle when the block is full. This is the visible
        // "you need to spend" beat.
        const outputFull =
          this.role === 'honey-worker'
            ? state.hive.honey >= state.hive.honeyCap
            : state.hive.wax >= waxCap(state);
        if (outputFull) {
          this.idleWaitMs = TUNING.WORKER_IDLE_RETRY_MS;
          this.pickIdleTarget(world);
          this.flyToward(dtMs, state);
          break;
        }
        // Pollen-stock gate. Honey workers run on a single pollen per cycle;
        // wax workers haul a full recipe back at once, so they wait for the
        // silo to actually contain enough to start a batch.
        const pollenNeeded =
          this.role === 'wax-worker' ? TUNING.WAX_RECIPE_POLLEN : 1;
        if (state.hive.pollen < pollenNeeded) {
          this.idleWaitMs = TUNING.WORKER_IDLE_RETRY_MS;
          this.pickIdleTarget(world);
          this.flyToward(dtMs, state);
          break;
        }
        // Fly to the Pollen Silo. Slight per-bee jitter on the approach
        // so multiple workers don't pile on the exact same pixel.
        this.setFlightTarget(
          WORLD.POLLEN_SILO.x + this.seed * 6,
          WORLD.POLLEN_SILO.y - 6,
        );
        this.state = 'worker-flying-out';
        this.consecutiveIdleResets = 0;
        break;
      }
      case 'worker-flying-out': {
        if (this.flyToward(dtMs, state)) {
          // Try to grab the full recipe from the silo. May have been
          // emptied mid-flight by another worker — if so, fly back empty
          // and try again next idle. Visible "missed it" beat without
          // locking up.
          const want =
            this.role === 'wax-worker' ? TUNING.WAX_RECIPE_POLLEN : 1;
          if (takePollen(state, want)) {
            this.carrying = 'pollen';
            this.carryAmount = want;
            world.particles.emit('pollenPuff', this.x, this.y, 3);
            this.pulseShake(state, 80);
          }
          // Aim for the building, slight jitter so workers don't stack.
          const dest =
            this.role === 'honey-worker' ? WORLD.HONEY_JAR : WORLD.WAX_BLOCK;
          this.setFlightTarget(dest.x + this.seed * 5, dest.y + 6);
          this.state = 'worker-flying-home';
        }
        break;
      }
      case 'worker-flying-home': {
        if (this.flyToward(dtMs, state)) {
          this.state = 'worker-depositing';
          // Wax-workers knead the batch for a beat so the "crafting"
          // silhouette is the dominant read; honey-workers keep their
          // snappy deposit so the honey loop stays brisk.
          this.workTimer =
            this.role === 'wax-worker'
              ? TUNING.WAX_KNEAD_MS
              : TUNING.WORKER_DEPOSIT_MS;
        }
        break;
      }
      case 'worker-depositing': {
        const beforeT = this.workTimer;
        this.workTimer -= dtMs;
        // Periodic kneading puffs while a wax-worker is converting pollen
        // into wax. One particle every ~300ms of work timer reads as
        // "something is happening in there" without spamming.
        if (
          this.role === 'wax-worker' &&
          this.carrying === 'pollen' &&
          Math.floor(beforeT / 300) !== Math.floor(this.workTimer / 300)
        ) {
          // Smoke puff from the workshop chimney — anchored to the
          // chimney top on the right slope of the roof (see WaxBlockView
          // for the building geometry).
          const jitterX = (this.seed - 0.5) * 2;
          world.particles.emit(
            'sparkle',
            WORLD.WAX_BLOCK.x + 10 + jitterX,
            WORLD.WAX_BLOCK.y - 48,
            1,
          );
        }
        if (this.workTimer <= 0) {
          if (this.carrying === 'pollen') {
            if (this.role === 'honey-worker') {
              const added = addHoney(state, 1);
              if (added > 0) world.emitManaRefine(added);
            } else {
              const added = addWax(state, waxPerDelivery(state));
              if (added > 0) {
                world.particles.emit(
                  'sparkle',
                  WORLD.WAX_BLOCK.x,
                  WORLD.WAX_BLOCK.y - 4,
                  3,
                );
              }
            }
            this.carrying = 'none';
            this.carryAmount = 0;
          }
          this.pulseShake(state, 90);
          // Drift back to the park spot for a beat before the next trip.
          this.setFlightTarget(this.parkX, this.parkY);
          this.state = 'idle';
          this.idleWaitMs = 0;
        }
        break;
      }
      default: {
        this.state = 'idle';
        this.idleWaitMs = 0;
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
    // Cantors don't cast when the rock can't take damage — either the
    // site isn't active, or the rock-drop pile is at cap (rock invincible
    // until foragers haul drops away). Without this gate the cantor would
    // spend mana on no-op casts; with it, the player feels the jam:
    // cantors hover idle until the pile drains.
    const siteActive = digSiteAcceptingDamage(state);

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
            addHoney(state, 1);
          }

          // Queue the hit so damage + drop spawns resolve when the visual
          // spark actually reaches the rock. Without this, the cracks
          // deepen and seeds pop out at cast-time — before the spark has
          // travelled — and the cause/effect reads as desynced.
          const synergy = cellSynergy(state.hive, this.cellQ, this.cellR);
          const dmg =
            cantorDamagePerSpark(state) *
            (1 + TUNING.SYNERGY_CANTOR_DAMAGE * synergy);
          const site = world.digSite;
          const strike = site
            ? site.randomStrikePoint()
            : { x: this.x, y: this.y };
          // Settle band sits just below the boulder visual — drops mound
          // up at the base on the meadow ground.
          const settleBaseY = (site ? site.y : 0) + WORLD.DIG_SITE_RADIUS - 8;
          queuePendingHit(state, dmg, this.x, this.y, strike.x, strike.y, settleBaseY);

          // Visual spark heading toward the rock.
          if (site) {
            world.emitSpark(this.x, this.y, strike.x, strike.y);
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

  private pickIdleTarget(_world: World): void {
    // Drift inside the bee's sky parking zone. Per-bee parkX/parkY is the
    // center; a small wander radius on top of it adds the buzz.
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * IDLE_WANDER_RADIUS;
    this.targetX = this.parkX + Math.cos(angle) * radius;
    this.targetY = this.parkY + Math.sin(angle) * radius * 0.6;
  }

  private bumpIdleConfusion(world: World): void {
    this.consecutiveIdleResets += 1;
    if (this.consecutiveIdleResets >= 3) {
      world.particles.emit('huh', this.x, this.y - 12, 1);
      this.consecutiveIdleResets = 0;
    }
  }
}
