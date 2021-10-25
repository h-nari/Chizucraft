export class CoordinateTransformation {
  public ax: number = 1.0;
  public bx: number = 0.0;
  public ay: number = 1.0;
  public by: number = 0.0;

  constructor() { }

  toX(x: number) { return this.ax * x + this.bx; }
  toY(y: number) { return this.ay * y + this.by; }
  fromX(x: number) { return (x - this.bx) / this.ax; }
  fromY(y: number) { return (y - this.by) / this.ay; }
  tileX(x: number) { return Math.floor(this.fromX(x) / 128); }
  tileY(y: number) { return Math.floor(this.fromY(y) / 128); }

  zoom(factor: number, cx: number, cy: number) {
    this.bx = (1 - factor) * cx + factor * this.bx;
    this.by = (1 - factor) * cy + factor * this.by;
    this.ax *= factor;
    this.ay *= factor;
  }
  pan(dx: number, dy: number) {
    this.bx += dx;
    this.by += dy;
  }
}