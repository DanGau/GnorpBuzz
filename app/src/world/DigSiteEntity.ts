// Positioned representation of the dig site. Strike target for cantors.
// Visual state (crack severity, glow, artifact-emerge pose) is read from sim
// by the view layer; the entity just provides a stable position and a
// canonical strike anchor.

import { WORLD } from './layout';

export class DigSiteEntity {
  id: string;
  x: number;
  y: number;

  constructor(id: string, x: number, y: number) {
    this.id = id;
    this.x = x;
    this.y = y;
  }

  // Canonical aim point — the boulder's upper-center. Used for HUD math
  // and any spot that wants a stable target.
  strikePoint(): { x: number; y: number } {
    return { x: this.x, y: this.y - 14 };
  }

  // Pick a random point on the boulder's face for a single strike, so
  // cracks and seed-spray origins scatter across the rock instead of
  // hammering the same pixel every cast. Sampling uses sqrt(random) for
  // radius to keep points uniformly distributed over the disc, and a
  // slight upward bias because the boulder visual extends higher than
  // it does to the sides (upper lobes in DigSiteView).
  randomStrikePoint(): { x: number; y: number } {
    const R = WORLD.DIG_SITE_RADIUS;
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * R * 0.55;
    return {
      x: this.x + Math.cos(angle) * radius,
      y: this.y - 8 + Math.sin(angle) * radius * 0.9,
    };
  }
}
