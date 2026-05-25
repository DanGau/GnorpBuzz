import type { GameState, RockDrop } from '../state';
import { TUNING } from '../state';

// Circle-collider physics for the rock-drop pile.
//
// Each drop is a 2D circle subject to gravity, a floor, and pairwise
// contact with every other drop. We use:
//   - Gravity integration (semi-implicit Euler)
//   - Floor as a half-space at ROCK_PILE_FLOOR_Y; vy bounces with
//     restitution, vx loses energy to friction while in contact
//   - Pairwise circle-vs-circle: position correction to resolve overlap,
//     then a normal-impulse exchange for the bounce response
//   - Sleep / settle: a drop with low velocity that's resting on the
//     floor or on another drop becomes inert (foragers can claim it,
//     it stops costing physics work). Settled drops are immovable
//     obstacles for falling drops, so the pile is self-supporting.
//
// We do NOT use a spatial hash — at ROCK_DROP_CAP (250) the N² loop is
// ~31k pair checks per tick, well within budget. Add a grid if the cap
// climbs significantly.

export function rockDropsSystem(state: GameState, dtMs: number): void {
  const dt = dtMs / 1000;
  if (dt <= 0) return;
  const drops = state.rockDrops;
  if (drops.length === 0) return;

  const r = TUNING.ROCK_DROP_RADIUS;
  const minDist = r * 2;
  const minDist2 = minDist * minDist;
  const floorY = TUNING.ROCK_PILE_FLOOR_Y - 2;
  const gravity = TUNING.ROCK_DROP_GRAVITY;
  const restitution = TUNING.ROCK_DROP_RESTITUTION;
  const friction = Math.pow(1 - TUNING.ROCK_DROP_FRICTION, dt);
  const airDrag = Math.pow(1 - TUNING.ROCK_DROP_AIR_DRAG, dt);
  const sleepVel2 =
    TUNING.ROCK_DROP_SLEEP_VEL * TUNING.ROCK_DROP_SLEEP_VEL;

  // 1) Gravity + air drag + integration for unsettled drops. Air drag
  //    bleeds horizontal momentum even mid-bounce so drops don't skid
  //    forever across the map between contacts. Rotation integrates
  //    every frame with its own air-drag analogue so spin doesn't
  //    persist forever once the drop slows.
  const spinDrag = Math.pow(0.65, dt); // light bleed mid-air
  for (const d of drops) {
    if (d.settled) continue;
    d.vy += gravity * dt;
    d.vx *= airDrag;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.rotation += d.spin * dt;
    d.spin *= spinDrag;
  }

  // 2) Floor + side walls. The pile is fenced between LEFT_WALL (the
  //    boulder face) and RIGHT_WALL (just inside the world edge). Drops
  //    drifting past either wall bounce back inward; the floor below
  //    catches them with friction. Drops with |vy| below the bounce
  //    threshold just rest on the floor — avoids endless microbounces.
  const rightWall = TUNING.ROCK_PILE_RIGHT_WALL - r;
  const leftWall = TUNING.ROCK_PILE_LEFT_WALL + r;
  for (const d of drops) {
    if (d.settled) continue;
    if (d.y > floorY) {
      d.y = floorY;
      if (d.vy > TUNING.ROCK_DROP_BOUNCE_FLOOR_VY) {
        d.vy = -d.vy * restitution;
      } else if (d.vy > 0) {
        d.vy = 0;
      }
      d.vx *= friction;
      // Rolling contact — lock spin to translation (no-slip rolling) so
      // the drop's rotation reads as caused by its motion across the
      // ground, not as a separate inherited tumble. ω = v / r.
      d.spin = d.vx / r;
    }
    if (d.x > rightWall) {
      d.x = rightWall;
      if (d.vx > 0) d.vx = -d.vx * restitution;
    }
    if (d.x < leftWall) {
      d.x = leftWall;
      if (d.vx < 0) d.vx = -d.vx * restitution;
    }
  }

  // 3) Pairwise circle-vs-circle. Resolve overlap first, then apply a
  //    normal impulse for any approaching contact. Settled drops are
  //    "sleeping" obstacles — a hard enough hit (normal closing speed
  //    above WAKE_VEL) jostles them awake and the contact resolves as
  //    equal-mass. Soft bumps still treat them as immovable so the pile
  //    doesn't shimmer every time a forager kicks dust on it.
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

      // Closing speed along the contact normal. Used both for the
      // velocity response and the wake threshold.
      const vRelN = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      const closingSpeed = -vRelN;

      // Wake a sleeping drop if the incoming hit is energetic enough.
      // Threshold is intentionally above sleep velocity so settled-on-
      // settled or feather-tap contacts don't ripple through the pile.
      if (
        a.settled !== b.settled &&
        closingSpeed > TUNING.ROCK_DROP_WAKE_VEL
      ) {
        if (a.settled) a.settled = false;
        if (b.settled) b.settled = false;
      }

      // Position correction — split by mobility so settled drops don't move.
      if (a.settled) {
        b.x += nx * overlap;
        b.y += ny * overlap;
      } else if (b.settled) {
        a.x -= nx * overlap;
        a.y -= ny * overlap;
      } else {
        const half = overlap * 0.5;
        a.x -= nx * half;
        a.y -= ny * half;
        b.x += nx * half;
        b.y += ny * half;
      }

      // Velocity response — normal-impulse exchange. vRel measured along
      // the contact normal (b-a). Only resolve approaching velocities.
      let vax = a.vx;
      let vay = a.vy;
      let vbx = b.vx;
      let vby = b.vy;
      if (vRelN < 0) {
        // Mass model: settled = infinite mass, unsettled = mass 1.
        if (a.settled && !b.settled) {
          // b bounces off immovable a.
          const j = -(1 + restitution) * vRelN;
          vbx += j * nx;
          vby += j * ny;
        } else if (b.settled && !a.settled) {
          // a bounces off immovable b.
          const j = -(1 + restitution) * vRelN;
          vax -= j * nx;
          vay -= j * ny;
        } else {
          // Equal-mass elastic-ish exchange.
          const j = -(1 + restitution) * vRelN * 0.5;
          vax -= j * nx;
          vay -= j * ny;
          vbx += j * nx;
          vby += j * ny;
        }
        if (!a.settled) {
          a.vx = vax;
          a.vy = vay;
        }
        if (!b.settled) {
          b.vx = vbx;
          b.vy = vby;
        }
      }
    }
  }

  // 4) Sleep check — a drop with very low velocity that's resting on
  //    the floor or on a settled drop becomes settled itself. Pile grows
  //    as the topmost drops fall asleep on the shoulders of older ones.
  for (const d of drops) {
    if (d.settled) continue;
    const speed2 = d.vx * d.vx + d.vy * d.vy;
    if (speed2 > sleepVel2) continue;
    if (isSupported(d, drops, r, floorY)) {
      d.vx = 0;
      d.vy = 0;
      d.spin = 0;
      d.settled = true;
    }
  }

  // 5) Support check for the already-settled. If a forager hauled a
  //    drop out of the middle of the pile (the only thing that removes
  //    drops), or a settled drop was woken in step 3, anything that
  //    was resting on it would otherwise hang in mid-air. Re-test
  //    support and unsettle unsupported drops — gravity catches them
  //    next tick and they re-settle in the gap. The drop itself is
  //    never destroyed here; this only flips the settled flag.
  for (const d of drops) {
    if (!d.settled) continue;
    if (!isSupported(d, drops, r, floorY)) {
      d.settled = false;
    }
  }
}

function isSupported(
  d: RockDrop,
  drops: RockDrop[],
  r: number,
  floorY: number,
): boolean {
  // Sitting on the floor counts.
  if (d.y >= floorY - 0.5) return true;
  // Or resting on top of a settled drop. d "rests on" o when d is
  // roughly above o (positive dy from o → d in screen coords means d
  // is lower numerically… wait, in screen coords y increases downward,
  // so d being below o means d.y > o.y. d being above o means d.y < o.y).
  // For d to rest ON o, d should be ABOVE o → d.y < o.y → dy < 0.
  const contactRange = r * 2 + 0.4;
  const contactRange2 = contactRange * contactRange;
  for (const o of drops) {
    if (o === d || !o.settled) continue;
    const dx = d.x - o.x;
    if (dx > contactRange || dx < -contactRange) continue;
    const dy = d.y - o.y;
    if (dy > 0 || dy < -contactRange) continue; // require d to be above o
    if (dx * dx + dy * dy < contactRange2) return true;
  }
  return false;
}
