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

  // Predetermined hive slot positions in the meadow. Up to 8 slots for MVP;
  // hives beyond this overflow onto a second row (handled at slot-pick time).
  HIVE_SLOTS: [
    { x: 160, y: 620 },
    { x: 320, y: 620 },
    { x: 480, y: 620 },
    { x: 800, y: 620 },
    { x: 960, y: 620 },
    { x: 1120, y: 620 },
    { x: 240, y: 680 },
    { x: 1040, y: 680 },
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
  if (index < WORLD.HIVE_SLOTS.length) return WORLD.HIVE_SLOTS[index];
  // Overflow: place along the back row at incremental x.
  const overflow = index - WORLD.HIVE_SLOTS.length;
  return { x: 100 + overflow * 100, y: 560 };
}
