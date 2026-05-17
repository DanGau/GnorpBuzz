// Logical world coordinates. Pixi views map these to canvas pixels.
// Designed around a 1280x720 reference; resizing handled by the renderer.

export const WORLD = {
  WIDTH: 1280,
  // Bumped to make room for an underground cross-section below the meadow
  // line — see `docs/underground.md`. The overview camera still fits the
  // whole world; the zoomed-in camera frames hive + underground together.
  // 1000 leaves soil room below the chamber upgrade panel.
  HEIGHT: 1000,

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
  // center of the comb; cells fan outward. The comb is deliberately a
  // small structure in the world — dwarfed by the boulder — so the colony
  // reads as taking on a monumental task. The `hive` camera framing zooms
  // in when it's selected so the cells become workable.
  HIVE: { x: 250, y: 545 },
  // Hex cell "size" — the center-to-corner radius. Pointy-top orientation.
  // Small on purpose; see the note on HIVE above.
  HEX_SIZE: 10,

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

// ---- Underground layout ----
//
// A cross-section "soil" layer below the meadow that hosts the chambers.
// Plots are arranged in horizontal rows; deeper rows host later-phase
// chambers. The center column aligns horizontally with the hive so the
// cross-section reads as "underneath the hill".
export const UNDERGROUND = {
  TOP_Y: 615,       // top edge of the soil layer (tucked close to the hive)
  ROW_HEIGHT: 50,   // vertical spacing between rows
  ROW_X_CENTER: WORLD.HIVE.x,
  COL_SPACING: 110,
  CHAMBER_W: 90,
  CHAMBER_H: 35,    // small footprint so the hive clearly dominates the view
} as const;

// Plot (row, col) → world position of the chamber's center.
// Columns are arranged symmetrically around `ROW_X_CENTER`: with two
// columns, col 0 sits left, col 1 sits right.
export function chamberWorldPosition(plot: { row: number; col: number }): {
  x: number;
  y: number;
} {
  const offsetX = (plot.col - 0.5) * UNDERGROUND.COL_SPACING;
  return {
    x: UNDERGROUND.ROW_X_CENTER + offsetX,
    y: UNDERGROUND.TOP_Y + UNDERGROUND.ROW_HEIGHT * (plot.row + 0.5),
  };
}
