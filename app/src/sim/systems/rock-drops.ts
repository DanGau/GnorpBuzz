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
  const settledMass = TUNING.ROCK_DROP_SETTLED_MASS_RATIO;
  const impactThreshold = TUNING.ROCK_DROP_IMPACT_THRESHOLD;
  const impactStrength = TUNING.ROCK_DROP_IMPACT_STRENGTH;
  const impactRadius = TUNING.ROCK_DROP_IMPACT_RADIUS;

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

  // 2) Floor + side walls — velocity response only. Position is enforced
  //    by the iterative resolver in step 4, which fully eliminates
  //    overlap (no more soft Baumgarte slop on the boundaries).
  for (const d of drops) {
    if (d.settled) continue;
    if (d.y > floorY) {
      if (d.vy > velThreshold) {
        const incomingVy = d.vy;
        d.vy = -d.vy * restitution;
        // Hard floor smack — splash the absorbed downward energy outward
        // to every settled drop in a small radius. This is what makes the
        // pile *visibly thump* when a new drop hits ground next to it.
        if (incomingVy > impactThreshold) {
          shockwave(drops, d.x, floorY, incomingVy * impactStrength, impactRadius);
        }
      } else if (d.vy > 0) {
        d.vy = 0;
      }
      d.vx *= friction;
      // Rolling contact — couple spin to translation (ω = v/r) so the
      // drop's rotation reads as caused by its motion across the ground.
      d.spin = d.vx / r;
    }
    if (d.x > rightWall) {
      if (d.vx > velThreshold) d.vx = -d.vx * restitution;
      else if (d.vx > 0) d.vx = 0;
    }
    if (d.x < leftWall) {
      if (d.vx < -velThreshold) d.vx = -d.vx * restitution;
      else if (d.vx < 0) d.vx = 0;
    }
  }

  // 3) Pairwise velocity response. Position correction has moved to the
  //    iterative resolver in step 4, so this loop only handles the
  //    momentum side: restitution, wake-on-hard-impact, and shockwave.
  //    Two-settled pairs are still skipped — once both drops are at
  //    rest against each other, re-solving the contact every frame
  //    just bleeds energy into noise.
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

      const vRelN = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vRelN >= 0) continue;
      const closingSpeed = -vRelN;

      // Mass ratio: settled = SETTLED_MASS_RATIO, dynamic = 1. Each side
      // absorbs the OTHER's mass-share of the impulse.
      const massA = a.settled ? settledMass : 1;
      const massB = b.settled ? settledMass : 1;
      const invTotal = 1 / (massA + massB);
      const shareA = massB * invTotal;
      const shareB = massA * invTotal;

      const e = closingSpeed < velThreshold ? 0 : restitution;
      const jMag = -(1 + e) * vRelN;
      a.vx -= jMag * shareA * nx;
      a.vy -= jMag * shareA * ny;
      b.vx += jMag * shareB * nx;
      b.vy += jMag * shareB * ny;

      if (closingSpeed > TUNING.ROCK_DROP_WAKE_VEL) {
        if (a.settled) a.settled = false;
        if (b.settled) b.settled = false;
      }

      if (closingSpeed > impactThreshold) {
        const cxImpact = (a.x + b.x) * 0.5;
        const cyImpact = (a.y + b.y) * 0.5;
        shockwave(drops, cxImpact, cyImpact, closingSpeed * impactStrength, impactRadius);
      }
    }
  }

  // 4) Iterative position resolution (Projected Gauss-Seidel). Each
  //    iteration walks every pair and pushes overlaps fully to zero,
  //    then re-clamps to the walls/floor. Multiple iterations let the
  //    corrections propagate through stacks — a single pass would leave
  //    the bottom of a tall pile partially buried because pushing two
  //    drops apart can re-overlap them with a third. Settled drops
  //    participate (they have finite mass) so a heavy drop landing on
  //    them rearranges the heap geometry rather than clipping through.
  const iterations = TUNING.ROCK_DROP_POS_ITERATIONS;
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < drops.length; i++) {
      const a = drops[i];
      for (let j = i + 1; j < drops.length; j++) {
        const b = drops[j];
        const dx = b.x - a.x;
        if (dx > minDist || dx < -minDist) continue;
        const dy = b.y - a.y;
        if (dy > minDist || dy < -minDist) continue;
        const dist2 = dx * dx + dy * dy;
        if (dist2 >= minDist2) continue;

        let nx: number;
        let ny: number;
        let overlap: number;
        if (dist2 < 0.0001) {
          // Perfectly coincident drops — pick a deterministic direction
          // so they separate instead of NaN-ing the sqrt.
          nx = 1;
          ny = 0;
          overlap = minDist;
        } else {
          const dist = Math.sqrt(dist2);
          nx = dx / dist;
          ny = dy / dist;
          overlap = minDist - dist;
        }

        const massA = a.settled ? settledMass : 1;
        const massB = b.settled ? settledMass : 1;
        const invTotal = 1 / (massA + massB);
        let shareA = massB * invTotal;
        let shareB = massA * invTotal;
        // Gravity-aware resolution: whichever drop is higher (smaller y)
        // takes more of the fix. Two drops side-by-side on the floor
        // would otherwise slide sideways and spread the pile like water;
        // biasing the fix vertically forces the upper one to climb up
        // and over instead. Bias scales with how horizontal the contact
        // is — purely vertical contacts use the raw mass ratio.
        const horizontality = 1 - Math.abs(ny);
        if (horizontality > 0 && Math.abs(a.y - b.y) < r * 1.5) {
          const upper = a.y < b.y ? 'a' : 'b';
          const bias = horizontality * 0.6;
          if (upper === 'a') {
            shareA += bias * (1 - shareA);
            shareB = 1 - shareA;
          } else {
            shareB += bias * (1 - shareB);
            shareA = 1 - shareB;
          }
        }
        a.x -= nx * overlap * shareA;
        a.y -= ny * overlap * shareA;
        b.x += nx * overlap * shareB;
        b.y += ny * overlap * shareB;
      }
    }
    // Re-clamp to walls + floor after the pair pass so corrections that
    // pushed a drop through a boundary get snapped back. Without this,
    // an iteration could leave a drop sub-pixel past the wall, which
    // the next iteration would have to undo.
    for (const d of drops) {
      if (d.y > floorY) d.y = floorY;
      if (d.x > rightWall) d.x = rightWall;
      if (d.x < leftWall) d.x = leftWall;
    }
  }
  // Slop and the legacy partial-correction are no longer used — kept in
  // the TUNING table for save-shape compat only.
  void slop;
  void correction;
}

// Upward-biased impulse to every settled drop within `radius` of (cx, cy).
// Strength falls off linearly to zero at the edge. The kick is almost
// entirely vertical (the pile JUMPS) with only a faint horizontal nudge
// scaled by direction — radial spread would flatten the heap, which is
// exactly what we don't want. Gravity pulls everything back down within
// a few frames and the iterative resolver re-stacks the contacts.
function shockwave(
  drops: RockDrop[],
  cx: number,
  cy: number,
  strength: number,
  radius: number,
): void {
  const r2 = radius * radius;
  for (const d of drops) {
    if (!d.settled) continue;
    const dx = d.x - cx;
    const dy = d.y - cy;
    const dist2 = dx * dx + dy * dy;
    if (dist2 > r2 || dist2 < 0.0001) continue;
    const dist = Math.sqrt(dist2);
    const falloff = 1 - dist / radius;
    const impulse = strength * falloff;
    const nx = dx / dist;
    d.vx += nx * impulse * 0.12;
    d.vy -= impulse * 0.85;
    d.settled = false;
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
