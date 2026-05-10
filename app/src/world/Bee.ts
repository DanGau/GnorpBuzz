import type { GameState, ForagerHiveData } from '../sim/state';
import { TUNING } from '../sim/state';
import type { World } from './World';
import { WORLD } from './layout';

export type BeeRole = 'forager' | 'wax-maker';

export type BeeState =
  | 'idle'
  | 'flying-to-flower'
  | 'harvesting'
  | 'flying-to-pollen-source'
  | 'picking-up-pollen'
  | 'flying-home-with-pollen'
  | 'producing-wax'
  | 'flying-to-vessel'
  | 'dropping-block'
  | 'flying-home-empty';

export type BeeCarrying = 'none' | 'pollen' | 'wax-block';

const ARRIVE_THRESHOLD = 4;
const IDLE_WANDER_RADIUS = 30;

let beeIdSeq = 1;

export class Bee {
  id: string;
  role: BeeRole;
  homeHiveId: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: BeeState;
  carrying: BeeCarrying;
  workTimer: number;
  targetFlowerId: string | null;
  targetHiveId: string | null;
  flapPhase: number;
  // For idle wander pacing
  idleWaitMs: number;

  constructor(role: BeeRole, homeHiveId: string, homeX: number, homeY: number) {
    this.id = `bee-${beeIdSeq++}`;
    this.role = role;
    this.homeHiveId = homeHiveId;
    this.x = homeX + (Math.random() - 0.5) * 20;
    this.y = homeY + (Math.random() - 0.5) * 20;
    this.targetX = homeX;
    this.targetY = homeY;
    this.state = 'idle';
    this.carrying = 'none';
    this.workTimer = 0;
    this.targetFlowerId = null;
    this.targetHiveId = null;
    this.flapPhase = Math.random() * Math.PI * 2;
    this.idleWaitMs = 0;
  }

  /** Move toward (targetX, targetY). Returns true when arrived. */
  private flyToward(dtMs: number): boolean {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < ARRIVE_THRESHOLD) return true;
    const move = TUNING.BEE_SPEED * (dtMs / 1000);
    if (move >= dist) {
      this.x = this.targetX;
      this.y = this.targetY;
      return true;
    }
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
    return false;
  }

  private homePos(world: World): { x: number; y: number } {
    const home = world.getHivePosition(this.homeHiveId);
    return home ?? { x: this.x, y: this.y };
  }

  update(dtMs: number, state: GameState, world: World): void {
    this.flapPhase += dtMs / 1000 * 30;

    if (this.role === 'forager') {
      this.updateForager(dtMs, state, world);
    } else {
      this.updateWaxMaker(dtMs, state, world);
    }
  }

  // -------------------- Forager --------------------

  private updateForager(dtMs: number, state: GameState, world: World): void {
    switch (this.state) {
      case 'idle': {
        // Try to claim a flower; if none available, wander briefly.
        this.idleWaitMs -= dtMs;
        if (this.idleWaitMs <= 0) {
          const claimed = this.tryClaimFlower(state, world);
          if (claimed) {
            this.state = 'flying-to-flower';
          } else {
            this.idleWaitMs = TUNING.IDLE_WANDER_DURATION_MS;
            this.pickIdleTarget(world);
          }
        }
        // Always tick a small wander so bees look alive while idle
        this.flyToward(dtMs);
        break;
      }
      case 'flying-to-flower': {
        if (this.flyToward(dtMs)) {
          // Verify flower is still ours and harvestable
          const flower = state.flowers.find((f) => f.id === this.targetFlowerId);
          if (!flower || flower.claimedByBeeId !== this.id || flower.yieldRemaining === 0) {
            this.releaseFlowerClaim(state);
            this.returnToIdle(world);
          } else {
            this.state = 'harvesting';
            this.workTimer = TUNING.HARVEST_DURATION_MS;
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
          }
          this.targetFlowerId = null;
          this.carrying = 'pollen';
          // Head home
          const home = this.homePos(world);
          this.targetX = home.x;
          this.targetY = home.y - 10;
          this.state = 'flying-home-with-pollen';
        }
        break;
      }
      case 'flying-home-with-pollen': {
        if (this.flyToward(dtMs)) {
          // Deposit pollen into home hive
          const hive = state.hives.find((h) => h.id === this.homeHiveId);
          if (hive && hive.type === 'forager') {
            (hive as ForagerHiveData).pollen += 1;
          }
          this.carrying = 'none';
          this.state = 'idle';
          this.idleWaitMs = 0;
        }
        break;
      }
      default: {
        // Foragers shouldn't enter wax-maker states; reset if they do.
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

  private updateWaxMaker(dtMs: number, state: GameState, world: World): void {
    switch (this.state) {
      case 'idle': {
        this.idleWaitMs -= dtMs;
        if (this.idleWaitMs <= 0) {
          const source = this.findPollenSource(state, world);
          if (source) {
            this.targetHiveId = source.hiveId;
            this.targetX = source.x + 25;
            this.targetY = source.y - 10;
            this.state = 'flying-to-pollen-source';
          } else {
            this.idleWaitMs = TUNING.IDLE_WANDER_DURATION_MS;
            this.pickIdleTarget(world);
          }
        }
        this.flyToward(dtMs);
        break;
      }
      case 'flying-to-pollen-source': {
        if (this.flyToward(dtMs)) {
          // Verify still has pollen
          const hive = state.hives.find((h) => h.id === this.targetHiveId);
          if (hive && hive.type === 'forager' && (hive as ForagerHiveData).pollen > 0) {
            this.state = 'picking-up-pollen';
            this.workTimer = TUNING.PICKUP_DURATION_MS;
          } else {
            this.targetHiveId = null;
            this.returnToIdle(world);
          }
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
            // Head home to produce
            const home = this.homePos(world);
            this.targetX = home.x;
            this.targetY = home.y - 10;
            this.state = 'flying-home-with-pollen';
          } else {
            // Source ran dry between flights; back to idle
            this.returnToIdle(world);
          }
        }
        break;
      }
      case 'flying-home-with-pollen': {
        if (this.flyToward(dtMs)) {
          this.state = 'producing-wax';
          this.workTimer = TUNING.PRODUCE_DURATION_MS;
        }
        break;
      }
      case 'producing-wax': {
        this.workTimer -= dtMs;
        // Tiny visual wiggle while producing — bee jiggles in place
        this.x = this.targetX + Math.sin(this.workTimer / 100) * 2;
        this.y = this.targetY + Math.cos(this.workTimer / 90) * 2;
        if (this.workTimer <= 0) {
          this.carrying = 'wax-block';
          // Head to the vessel
          this.targetX = WORLD.VESSEL_PAD.x;
          this.targetY = WORLD.VESSEL_PAD.y - 30;
          this.state = 'flying-to-vessel';
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
          }
          this.carrying = 'none';
          // Head home
          const home = this.homePos(world);
          this.targetX = home.x;
          this.targetY = home.y - 10;
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

  private findPollenSource(
    state: GameState,
    world: World,
  ): { hiveId: string; x: number; y: number } | null {
    let best: { hiveId: string; x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const h of state.hives) {
      if (h.type !== 'forager') continue;
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
}
