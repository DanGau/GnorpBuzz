// Positioned representation of the dig site. Strike target for excavators.
// Visual state (crack severity, glow, artifact-emerge pose) is read from sim
// by the view layer; the entity just provides a stable position and a
// canonical strike anchor.

export class DigSiteEntity {
  id: string;
  x: number;
  y: number;

  constructor(id: string, x: number, y: number) {
    this.id = id;
    this.x = x;
    this.y = y;
  }

  // Excavators aim their strike at a point on the mound's surface, slightly
  // above center.
  strikePoint(): { x: number; y: number } {
    return { x: this.x, y: this.y - 14 };
  }
}
