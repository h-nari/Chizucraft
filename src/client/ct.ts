export class CoordinateTransformation {
  public ax: number = 1.0;
  public bx: number = 0.0;
  public ay: number = 1.0;
  public by: number = 0.0;

  constructor() { }

  toX(x: number) { return this.ax * x + this.bx; }
  toY(y: number) { return this.ay * y + this.by; }
  fromX(sx: number) { return Math.floor((sx - this.bx) / this.ax); }
  fromY(sy: number) { return Math.floor((sy - this.by) / this.ay); }
  tileX(x: number) { return Math.floor(x / 128); }
  tileY(y: number) { return Math.floor(y / 128); }
  s2tileX(sx: number) { return this.tileX(this.fromX(sx)); }
  s2tileY(sy: number) { return this.tileY(this.fromY(sy)); }

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