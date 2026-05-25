import type { GameState, RockDrop } from '../state';
import { TUNING } from '../state';

// Circle-collider physics for the rock-drop pile.
//
// Design goal: piles must visibly *come to rest* in a handful of frames,
// but also feel *alive* — landing a new drop on a stack should jostle
// it, and there is no hard "sleep flag" gate that skips integration.
// The whole pile re-integrates every substep. Rest emerges from the
// combination of techniques rather than a discontinuity.
//
// Anti-jitter recipe (Box2D + PBD borrowings):
//   - Sub-stepping (SUBSTEPS=2). Halves `g·dt` per step, halving the
//     artificial energy each contact resolution has to remove.
//   - Linear damping. A small per-second bleed on both axes that kills
//     residual sub-threshold jitter the velocity threshold misses.
//   - Restitution threshold (Box2D's b2_velocityThreshold). Closing
//     speeds below it are treated as fully inelastic regardless of `e`.
//     Without this, even 0.32 restitution makes piles immortal.
//   - Position-correction slop. Penetration up to POS_SLOP is ignored;
//     beyond it we correct only POS_CORRECTION % per substep. Snapping
//     out of overlap is what re-injects bounce energy.
//   - Floor bounce-cutoff. |vy| below threshold just rests on the floor
//     instead of micro-bouncing.
//
// `settled` is kept as a *derived* flag (re-evaluated every frame): if
// a drop's speed is below SETTLE_VEL and it's supported, we clamp its
// velocity to zero and mark it pickable. Settled drops are immovable
// for soft contacts (mass=∞) but a hard hit (closingSpeed > WAKE_VEL)
// flips them back to dynamic — that propagation is what makes a fresh
// drop landing on the stack still feel reactive.
//
// We do NOT use a spatial hash — at ROCK_DROP_CAP (250) the N² loop is
// ~31k pair checks per substep, well within budget.

export function rockDropsSystem(state: GameState, dtMs: number): void {
  const dt = dtMs / 1000;
  if (dt <= 0) return;
  const drops = state.rockDrops;
  if (drops.length === 0) return;

  const substeps = TUNING.ROCK_DROP_SUBSTEPS;
  const subDt = dt / substeps;
  for (let s = 0; s < substeps; s++) {
    integrateSubstep(drops, subDt);
  }

  // Soft snap-to-rest, evaluated once per render frame. Doing it once
  // per substep would over-clamp moving drops near rest; once per frame
  // is the right cadence to mark "pickable by foragers" without fighting
  // the integrator inside the substep loop.
  const r = TUNING.ROCK_DROP_RADIUS;
  const floorY = TUNING.ROCK_PILE_FLOOR_Y - 2;
  const settleVel2 = TUNING.ROCK_DROP_SETTLE_VEL * TUNING.ROCK_DROP_SETTLE_VEL;
  for (const d of drops) {
    const speed2 = d.vx * d.vx + d.vy * d.vy;
    if (speed2 < settleVel2 && isSupported(d, drops, r, floorY)) {
      d.vx = 0;
      d.vy = 0;
      d.spin = 0;
      d.settled = true;
    } else if (speed2 > settleVel2 * 4) {
      // Faster-than-settle drops are definitely not at rest. Drops in
      // the gray zone (settle..2×settle) keep their previous flag —
      // hysteresis so a drop teetering at the threshold doesn't flicker
      // on and off every frame.
      d.settled = false;
    }
  }
}

function integrateSubstep(drops: RockDrop[], dt: number): void {
  const r = TUNING.ROCK_DROP_RADIUS;
  const minDist = r * 2;
  const minDist2 = minDist * minDist;
  const floorY = TUNING.ROCK_PILE_FLOOR_Y - 2;
  const gravity = TUNING.ROCK_DROP_GRAVITY;
  const restitution = TUNING.ROCK_DROP_RESTITUTION;
  const velThreshold = TUNING.ROCK_DROP_VEL_THRESHOLD;
  const slop = TUNING.ROCK_DROP_POS_SLOP;
  const correction = TUNING.ROCK_DROP_POS_CORRECTION;
  const friction = Math.pow(1 - TUNING.ROCK_DROP_FRICTION, dt);
  const airDrag = Math.pow(1 - TUNING.ROCK_DROP_AIR_DRAG, dt);
  const linearDamp = Math.pow(1 - TUNING.ROCK_DROP_LINEAR_DAMPING, dt);
  const spinDrag = Math.pow(0.65, dt);
  const rightWall = TUNING.ROCK_PILE_RIGHT_WALL - r;
  const leftWall = TUNING.ROCK_PILE_LEFT_WALL + r;

  // 1) Gravity + damping + integration. Settled drops are skipped so
  //    they truly hold their stack position — without this, even with
  //    snap-to-rest the bottom of a stack would creep down by the
  //    uncorrected portion of `g·dt` every frame.
  for (const d of drops) {
    if (d.settled) continue;
    d.vy += gravity * dt;
    d.vx *= airDrag * linearDamp;
    d.vy *= linearDamp;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.rotation += d.spin * dt;
    d.spin *= spinDrag;
  }

  // 2) Floor + side walls. Position correction uses slop — small
  //    overshoots are absorbed silently; large overshoots are corrected
  //    a fraction at a time. Velocity response uses the threshold so
  //    soft floor taps don't micro-bounce.
  for (const d of drops) {
    if (d.settled) continue;
    if (d.y > floorY) {
      const over = d.y - floorY;
      if (over > slop) d.y -= (over - slop) * correction;
      if (d.vy > velThreshold) {
        d.vy = -d.vy * restitution;
      } else if (d.vy > 0) {
        d.vy = 0;
      }
      d.vx *= friction;
      // Rolling contact — couple spin to translation (ω = v/r) so the
      // drop's rotation reads as caused by its motion across the ground.
      d.spin = d.vx / r;
    }
    if (d.x > rightWall) {
      const over = d.x - rightWall;
      if (over > slop) d.x -= (over - slop) * correction;
      if (d.vx > velThreshold) d.vx = -d.vx * restitution;
      else if (d.vx > 0) d.vx = 0;
    }
    if (d.x < leftWall) {
      const over = leftWall - d.x;
      if (over > slop) d.x += (over - slop) * correction;
      if (d.vx < -velThreshold) d.vx = -d.vx * restitution;
      else if (d.vx < 0) d.vx = 0;
    }
  }

  // 3) Pairwise circle-vs-circle. Position correction uses slop +
  //    fractional fix; velocity response uses the restitution threshold.
  //    Settled drops are immovable obstacles for soft contacts; a hit
  //    above WAKE_VEL wakes them back to dynamic so a falling drop can
  //    still jostle the pile.
  for (let i = 0; i < drops.length; i++) {
    const a = drops[i];
    for (let j = i + 1; j < drops.length; j++) {
      const b = drops[j];
      if (a.settled && b.settled) continue;
      const dx = b.x - a.x;
      if (dx > minDist || dx < -minDist) continue;
      const dy = b.y - a.y;
      if (dy > minDist || dy < -minDist) continue;
      const dist2 = dx * dx + dy * dy;
      if (dist2 >= minDist2 || dist2 === 0) continue;

      const dist = Math.sqrt(dist2);
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;

      const vRelN = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      const closingSpeed = -vRelN;

      if (
        a.settled !== b.settled &&
        closingSpeed > TUNING.ROCK_DROP_WAKE_VEL
      ) {
        if (a.settled) a.settled = false;
        if (b.settled) b.settled = false;
      }

      // Position correction with slop. Settled drops don't move.
      if (overlap > slop) {
        const fix = (overlap - slop) * correction;
        if (a.settled) {
          b.x += nx * fix;
          b.y += ny * fix;
        } else if (b.settled) {
          a.x -= nx * fix;
          a.y -= ny * fix;
        } else {
          const half = fix * 0.5;
          a.x -= nx * half;
          a.y -= ny * half;
          b.x += nx * half;
          b.y += ny * half;
        }
      }

      // Velocity response with restitution threshold. Below the
      // threshold, treat as fully inelastic — the single biggest
      // anti-jitter knob for stacking.
      if (vRelN < 0) {
        const e = closingSpeed < velThreshold ? 0 : restitution;
        if (a.settled && !b.settled) {
          const j = -(1 + e) * vRelN;
          b.vx += j * nx;
          b.vy += j * ny;
        } else if (b.settled && !a.settled) {
          const j = -(1 + e) * vRelN;
          a.vx -= j * nx;
          a.vy -= j * ny;
        } else if (!a.settled && !b.settled) {
          const j = -(1 + e) * vRelN * 0.5;
          a.vx -= j * nx;
          a.vy -= j * ny;
          b.vx += j * nx;
          b.vy += j * ny;
        }
      }
    }
  }
}

function isSupported(
  d: RockDrop,
  drops: RockDrop[],
  r: number,
  floorY: number,
): boolean {
  if (d.y >= floorY - 0.5) return true;
  // Resting on top of a settled drop: d above o → dy < 0 in screen coords.
  const contactRange = r * 2 + 0.4;
  const contactRange2 = contactRange * contactRange;
  for (const o of drops) {
    if (o === d || !o.settled) continue;
    const dx = d.x - o.x;
    if (dx > contactRange || dx < -contactRange) continue;
    const dy = d.y - o.y;
    if (dy > 0 || dy < -contactRange) continue;
    if (dx * dx + dy * dy < contactRange2) return true;
  }
  return false;
}
