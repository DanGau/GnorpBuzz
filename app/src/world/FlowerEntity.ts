// Decorative meadow flower with a stable id matching sim state. Position is
// fixed by layout. Visual state (bloom / partial / wilted) is read from sim.

export class FlowerEntity {
  id: string;
  x: number;
  y: number;
  hue: number;

  constructor(id: string, x: number, y: number, hue: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.hue = hue;
  }
}
