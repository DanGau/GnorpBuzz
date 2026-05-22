// Logical world coordinates. Pixi views map these to canvas pixels.
// Designed around a 1280x720 reference; resizing handled by the renderer.

export const WORLD = {
  WIDTH: 1280,
  // Tall enough to give the meadow-ground buildings and their contextual
  // upgrade panels room below the hive without the camera clipping.
  HEIGHT: 1000,

  // Vertical bands (meadow at bottom, sky middle, stars top).
  MEADOW_Y: 540,
  SKY_Y: 180,
  STARS_Y: 0,

  // Goal flower in the upper sky.
  FLOWER: { x: 640, y: 100, baseRadius: 20 },

  // A massive cracked boulder dominates the RIGHT side of the meadow.
  // Center is the surface-level anchor; the visual draws much bigger than
  // the hive. Cantors fire sparks at it from across the meadow.
  DIG_SITE: { x: 1050, y: 560 },
  // Visual radius of the boulder — bees orbit around it within this radius
  // when picking a strike point.
  DIG_SITE_RADIUS: 120,

  // The single Hive — a honeycomb of hex cells. This is the world-space
  // center of the comb; cells fan outward. The comb is deliberately a
  // small structure in the world — dwarfed by the boulder — so the colony
  // reads as taking on a monumental task. The `hive` camera framing zooms
  // in when it's selected so the cells become workable.
  HIVE: { x: 250, y: 545 },
  // Hex cell "size" — the center-to-corner radius. Pointy-top orientation.
  // Small on purpose; see the note on HIVE above.
  HEX_SIZE: 10,

  // Above-ground resource containers, arranged left-to-right:
  //
  //   POLLEN_SILO  (left, economy)  →  HONEY_JAR (between, on the hive)  →  combat zone (right)
  //   WAX_BLOCK    (left, economy)
  //
  // Foragers deposit at the Pollen Silo; Honey Workers / Wax Workers pull
  // from the silo and deliver to the Honey Jar / Wax Block. The Honey Jar
  // is rendered by HoneyBarView and anchored above the hive (see that
  // file's offsets); only the two ground-level buildings need world coords
  // here. Bees never touch the comb directly — the comb is just a
  // population dial.
  POLLEN_SILO: { x: 110, y: 595 },
  WAX_BLOCK: { x: 195, y: 605 },
  // Honey Jar floats above the hive — its visual is owned by HoneyBarView
  // and bobs ±1px; this is the static reference point for routing logic.
  HONEY_JAR: { x: 250, y: 450 },

  // Overview camera frame — the world-space rect the zoomed-out view fits
  // into. Deliberately shorter (top→bottom) than WORLD.HEIGHT: it stops
  // just below the flower line so the underground band stays hidden until
  // the player zooms in, and the rect is ~16:9 so a typical widescreen
  // canvas fills with minimal letterboxing. Tweaking BOTTOM here is the
  // single knob for "where do the flowers sit on screen in overview."
  OVERVIEW: {
    LEFT: 0,
    RIGHT: 1280,
    TOP: 0,
    BOTTOM: 720,
  },

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
