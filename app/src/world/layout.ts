// Logical world coordinates. Pixi views map these to canvas pixels.
// Designed around a 1280x720 reference; resizing handled by the renderer.

export const WORLD = {
  WIDTH: 1280,
  HEIGHT: 720,

  // Vertical bands (meadow at bottom, sky middle, stars top).
  MEADOW_Y: 540, // top of meadow band
  SKY_Y: 180,
  STARS_Y: 0,

  // Goal flower in the upper sky.
  FLOWER: { x: 640, y: 100, baseRadius: 20 },

  // Vessel construction site.
  VESSEL_PAD: { x: 640, y: 460 },

  // Single Forager Hive on the left, single Wax Hive on the right. Vessel pad
  // sits between them at center-meadow.
  HIVE_SLOTS: [
    { x: 380, y: 620 }, // Forager Hive (left of vessel)
    { x: 900, y: 620 }, // Wax Hive (right of vessel)
  ],

  // Decorative meadow flowers (static for MVP, future nectar mini-event).
  MEADOW_FLOWERS: [
    { x: 100, y: 660 },
    { x: 250, y: 690 },
    { x: 400, y: 670 },
    { x: 550, y: 700 },
    { x: 700, y: 680 },
    { x: 870, y: 695 },
    { x: 1000, y: 665 },
    { x: 1180, y: 685 },
  ],
} as const;

export function hiveSlotPosition(index: number): { x: number; y: number } {
  return WORLD.HIVE_SLOTS[index] ?? WORLD.HIVE_SLOTS[0];
}
