// Logical world coordinates. Pixi views map these to canvas pixels.
// Designed around a 1280x720 reference; resizing handled by the renderer.

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,

  // Vertical bands (meadow at bottom, sky middle, stars top).
  MEADOW_Y: 540,
  SKY_Y: 180,
  STARS_Y: 0,

  // Goal flower in the upper sky.
  FLOWER: { x: 640, y: 100, baseRadius: 20 },

  // A massive cracked boulder dominates the RIGHT side of the meadow.
  // Center is the surface-level anchor; the visual draws much bigger than
  // the hive. Excavators stream from left to right to hit it.
  DIG_SITE: { x: 1050, y: 560 },
  // Visual radius of the boulder — bees orbit around it within this radius
  // when picking a strike point.
  DIG_SITE_RADIUS: 120,

  // The single Hive — a honeycomb of hex cells. This is the world-space
  // center of the comb (the Queen cell sits here); cells fan outward.
  HIVE: { x: 410, y: 470 },
  // Hex cell "size" — the center-to-corner radius. Pointy-top orientation.
  HEX_SIZE: 26,

  // Decorative meadow flowers — clustered on the LEFT half of the meadow
  // away from the boulder. Twelve positions so larger colonies have enough
  // simultaneous work without bees stacking up idle behind claimed flowers.
  MEADOW_FLOWERS: [
    { x: 70, y: 670 },
    { x: 150, y: 695 },
    { x: 240, y: 665 },
    { x: 330, y: 690 },
    { x: 420, y: 670 },
    { x: 500, y: 695 },
    { x: 590, y: 680 },
    { x: 380, y: 700 },
    { x: 270, y: 705 },
    { x: 480, y: 705 },
    { x: 160, y: 670 },
    { x: 60, y: 695 },
  ],
} as const;

// Axial hex (q, r) → world pixel position, relative to the hive center.
// Pointy-top layout.
export function hexToWorld(q: number, r: number): { x: number; y: number } {
  const s = WORLD.HEX_SIZE;
  return {
    x: WORLD.HIVE.x + s * Math.sqrt(3) * (q + r / 2),
    y: WORLD.HIVE.y + s * 1.5 * r,
  };
}
